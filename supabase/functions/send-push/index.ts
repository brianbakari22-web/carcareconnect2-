import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? ""
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
const ONESIGNAL_APP_ID = "8722cee5-c2e2-431c-a15d-2af78773b404"
const ONESIGNAL_API_KEY = Deno.env.get("ONESIGNAL_API_KEY") ?? ""

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
  try {
    const { user_id, title, message, data } = await req.json()
    if (!user_id || !title) return new Response(JSON.stringify({ error: "Missing user_id or title" }), { status: 400, headers: corsHeaders })
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    // Get all device tokens for this user
    const { data: tokens } = await supabase.from("device_tokens").select("token,platform").eq("user_id", user_id)
    if (!tokens?.length) return new Response(JSON.stringify({ error: "No tokens found", user_id }), { status: 200, headers: corsHeaders })
    const results = []
    for (const t of tokens) {
      try {
        const payload = {
          app_id: ONESIGNAL_APP_ID,
          include_subscription_ids: [t.token],
          headings: { en: title },
          contents: { en: message || title },
          data: data || {},
        }
        const res = await fetch("https://api.onesignal.com/notifications", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Key ${ONESIGNAL_API_KEY}` },
          body: JSON.stringify(payload)
        })
        const result = await res.json()
        results.push({ token: t.token, platform: t.platform, status: res.status, result })
      } catch(e) { results.push({ token: t.token, error: e.message }) }
    }
    return new Response(JSON.stringify({ sent: results.length, results }), { headers: { ...corsHeaders, "Content-Type": "application/json" } })
  } catch(error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})
