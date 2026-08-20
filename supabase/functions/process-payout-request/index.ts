import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}
// Safaricom's B2C API rejects any single payout above KES 250,000 outright - this is a hard
// technical ceiling, not a business preference. Anything above it must go to manual admin
// review since an automatic attempt would simply fail at Safaricom's end regardless.
const B2C_MAX_SINGLE_TXN = 250000
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
  try {
    const { user_id, amount, source_label, reference_id } = await req.json()
    if (!user_id || !amount || !source_label) throw new Error("user_id, amount and source_label required")
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { autoRefreshToken: false, persistSession: false }
    })
    // Above the B2C ceiling - straight to manual review, automatic attempt would fail anyway.
    if (Number(amount) > B2C_MAX_SINGLE_TXN) {
      await supabase.from("payout_requests").insert({ user_id, amount, status: "pending" })
      return new Response(JSON.stringify({ success: true, automatic: false, reason: "Above the automatic payout limit - sent for manual review" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      })
    }
    const { data: sensRows } = await supabase.rpc("get_provider_payment_details", { provider_id_input: user_id })
    const sens = sensRows?.[0] || null
    const phone = sens?.mpesa_number
    if (!phone) {
      await supabase.from("payout_requests").insert({ user_id, amount, status: "pending" })
      return new Response(JSON.stringify({ success: true, automatic: false, reason: "No payment number configured - sent for manual review" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      })
    }
    try {
      const resp = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/daraja-b2c-payout`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
        body: JSON.stringify({ phone, amount, narrative: `CCC ${source_label}`, booking_id: reference_id || user_id, provider_id: user_id, payment_method: "mpesa" })
      })
      const text = await resp.text()
      const data = text ? JSON.parse(text) : {}
      if (!resp.ok || data.error || !data.success) {
        // Automatic attempt genuinely failed - fall back to the manual queue so the money
        // still reaches the person, just via admin instead.
        await supabase.from("payout_requests").insert({ user_id, amount, status: "pending", admin_note: "Automatic payout failed: " + (data.error || "unknown error") })
        return new Response(JSON.stringify({ success: true, automatic: false, reason: "Automatic payout failed - sent for manual review" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        })
      }
      return new Response(JSON.stringify({ success: true, automatic: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      })
    } catch (err: any) {
      await supabase.from("payout_requests").insert({ user_id, amount, status: "pending", admin_note: "Automatic payout error: " + err.message })
      return new Response(JSON.stringify({ success: true, automatic: false, reason: "Automatic payout failed - sent for manual review" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      })
    }
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } })
  }
})
