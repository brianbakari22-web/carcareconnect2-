import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
  try {
    const { order_id, driver_id } = await req.json()
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    )
    const { data: order } = await supabase.from("orders").select("id, customer_id, delivery_driver_id, order_number").eq("id", order_id).maybeSingle()
    if (!order) return new Response(JSON.stringify({ error: "Order not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } })
    if (order.delivery_driver_id !== driver_id) return new Response(JSON.stringify({ error: "Not authorized for this delivery" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } })
    const otp = Math.floor(1000 + Math.random() * 9000).toString()
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString()
    await supabase.from("orders").update({
      delivery_otp: otp,
      delivery_otp_expires_at: expiresAt,
      delivery_otp_verified: false
    }).eq("id", order_id)
    await supabase.from("notifications").insert({
      user_id: order.customer_id,
      title: "🔐 Delivery Verification Code",
      message: `Your driver has arrived! Give them this code: ${otp}. Valid for 30 minutes. NEVER share this with anyone else.`,
      type: "info"
    })
    return new Response(JSON.stringify({ success: true, message: "OTP sent to customer" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    })
  }
})
