import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

// Proactive health check for the Daraja B2C static-IP proxy, independent of any real
// payout happening. The payout function's own fallback logic already guarantees no
// payout is lost if the proxy is down - this just gives an earlier warning, before a
// real payout ever needs it, and catches failure modes systemd's own Restart=always
// cannot (a changed firewall rule, VM networking issues, a Google Cloud outage, etc).
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { autoRefreshToken: false, persistSession: false }
  })
  try {
    const { data: proxySetting } = await supabase.from("app_settings").select("value").eq("key", "daraja_b2c_use_proxy").maybeSingle()
    const useProxy = proxySetting?.value === "true"
    if (!useProxy) {
      return new Response(JSON.stringify({ skipped: true, reason: "proxy toggle is disabled" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } })
    }

    const proxyUrl = Deno.env.get("DARAJA_PROXY_URL")
    if (!proxyUrl) throw new Error("DARAJA_PROXY_URL secret is not set")

    const httpClient = Deno.createHttpClient({ proxy: { url: proxyUrl } })
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)
    let healthy = false
    let errorMessage = ""
    try {
      const resp = await fetch("https://api.safaricom.co.ke", { client: httpClient, signal: controller.signal } as any)
      healthy = resp.status > 0 // any real HTTP response (even 404) means the proxy genuinely worked
    } catch (e: any) {
      errorMessage = e.message
    } finally {
      clearTimeout(timeout)
    }

    if (!healthy) {
      const { data: admins } = await supabase.from("profiles").select("id").eq("role", "admin")
      for (const admin of admins || []) {
        await supabase.from("notifications").insert({
          user_id: admin.id,
          title: "Daraja proxy health check failed \u26a0\ufe0f",
          message: `Proactive check found the static-IP proxy unreachable: ${errorMessage}. Real payouts will still succeed via automatic fallback, but the proxy server itself needs attention.`,
          type: "warning"
        })
      }
    }

    return new Response(JSON.stringify({ healthy, errorMessage }), { headers: { ...corsHeaders, "Content-Type": "application/json" } })
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } })
  }
})
