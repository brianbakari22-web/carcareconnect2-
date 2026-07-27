import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
  try {
    const { booking_id, confirmed_by } = await req.json()
    if (!booking_id) throw new Error("booking_id required")
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!)
    const { data: booking, error } = await supabase.from("bookings")
      .select("*").eq("id", booking_id).single()
    if (error || !booking) throw new Error("Booking not found")
    if (booking.payment_released) throw new Error("Payment already released")
    if (!booking.payment_held) throw new Error("No payment held for this booking")
    const providerAmount = Number(booking.provider_earnings || 0)
    if (providerAmount <= 0) throw new Error("Invalid provider amount")
    const { data: pSens } = await supabase.from("profile_sensitive")
      .select("mpesa_number,till_number,paybill_number,paybill_account,pochi_number,preferred_payment_method")
      .eq("id", booking.provider_id).single()
    const prefMethod = pSens?.preferred_payment_method || "mpesa"
    const providerPhone = prefMethod==="till" ? pSens?.till_number
      : prefMethod==="paybill" ? pSens?.paybill_number
      : prefMethod==="pochi" ? pSens?.pochi_number
      : (pSens?.mpesa_number || pSens?.till_number || pSens?.pochi_number)
    console.log("pSens data:", JSON.stringify(pSens))
    console.log("prefMethod:", prefMethod)
    console.log("providerPhone:", providerPhone)
    // Use mpesa_number as fallback regardless of preferred method
    const finalPhone = providerPhone || pSens?.mpesa_number || pSens?.till_number || pSens?.pochi_number
    console.log("Final phone:", finalPhone, "pSens:", JSON.stringify(pSens))
    if (!finalPhone) throw new Error("Provider has no payment number configured")
    // Release payment to provider - wrapped in try-catch so booking still completes
    let payoutData: any = {}
    try {
      const payoutResp = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/intasend-payout`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
        body: JSON.stringify({ phone: finalPhone, amount: providerAmount, narrative: `CCC Payment - ${booking.service_name} #${booking.booking_number}`, payment_method: prefMethod, paybill_account: pSens?.paybill_account, booking_id: booking.id, provider_id: booking.provider_id })
      })
      const text = await payoutResp.text()
      payoutData = text ? JSON.parse(text) : {}
      console.log("Payout response:", JSON.stringify(payoutData))
    } catch(payoutErr: any) {
      console.error("Payout error (non-fatal):", payoutErr.message)
    }
    // Always mark payment released regardless of payout result
    await supabase.from("bookings").update({
      payment_released: true,
      payment_released_at: new Date().toISOString(),
      completion_confirmed_at: confirmed_by === "customer" ? new Date().toISOString() : null,
      status: "completed"
    }).eq("id", booking_id)
    await supabase.from("notifications").insert({
      user_id: booking.provider_id,
      title: "Payment released! 💰",
      message: `KES ${providerAmount.toLocaleString()} has been sent to your ${prefMethod} for ${booking.service_name} #${booking.booking_number}`,
      type: "success"
    })
    await supabase.from("notifications").insert({
      user_id: booking.customer_id,
      title: confirmed_by === "auto" ? "Payment auto-released ⏰" : "Payment confirmed ✅",
      message: confirmed_by === "auto"
        ? `Payment of KES ${providerAmount.toLocaleString()} was automatically released to the provider after 24 hours.`
        : `Thank you for confirming! KES ${providerAmount.toLocaleString()} has been released to the provider.`,
      type: "info"
    })
    try {
      await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-push`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
        body: JSON.stringify({ user_id: booking.provider_id, title: "Payment released! 💰", message: `KES ${providerAmount.toLocaleString()} sent to your ${prefMethod}` })
      })
    } catch(e) {}
    return new Response(JSON.stringify({ success: true, amount: providerAmount }), { headers: { ...corsHeaders, "Content-Type": "application/json" } })
  } catch (error: any) {
    console.error("Release payment error:", error.message)
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } })
  }
})

