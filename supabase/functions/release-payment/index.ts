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
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { autoRefreshToken: false, persistSession: false }
    })
    const { data: booking, error } = await supabase.from("bookings")
      .select("*").eq("id", booking_id).single()
    if (error || !booking) throw new Error("Booking not found")
    if (booking.payment_released) throw new Error("Payment already released")
    if (!booking.payment_held) throw new Error("No payment held for this booking")
    const providerAmount = Number(booking.provider_earnings || 0)
    if (providerAmount <= 0) throw new Error("Invalid provider amount")
    const { data: pSensRows } = await supabase.rpc("get_provider_payment_details", { provider_id_input: booking.provider_id })
    const pSens = pSensRows?.[0] || null
    const prefMethod = pSens?.preferred_payment_method || "mpesa"
    const providerPhone = prefMethod === "till" ? pSens?.till_number
      : prefMethod === "paybill" ? pSens?.paybill_number
      : prefMethod === "pochi" ? pSens?.pochi_number
      : (pSens?.mpesa_number || pSens?.till_number || pSens?.pochi_number)
    const finalPhone = providerPhone || pSens?.mpesa_number || pSens?.till_number || pSens?.pochi_number
    if (!finalPhone) throw new Error("Provider has no payment number configured")

    // Call B2C payout - this call must genuinely succeed for us to proceed
    let payoutData: any = {}
    let payoutFailed = false
    let payoutErrorMsg = ""
    try {
      const payoutResp = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/daraja-b2c-payout`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
        body: JSON.stringify({ phone: finalPhone, amount: providerAmount, narrative: `CCC Payment ${booking.booking_number}`, booking_id: booking.id, provider_id: booking.provider_id, payment_method: prefMethod, account_reference: booking.booking_number })
      })
      const text = await payoutResp.text()
      payoutData = text ? JSON.parse(text) : {}
      if (!payoutResp.ok || payoutData.error || !payoutData.success) {
        payoutFailed = true
        payoutErrorMsg = payoutData.error || "B2C payout was not accepted by Safaricom"
      }
    } catch (payoutErr: any) {
      payoutFailed = true
      payoutErrorMsg = payoutErr.message
    }

    if (payoutFailed) {
      // Log the failure so admin can see it and retry - do NOT mark payment released
      await supabase.from("failed_jobs").insert({
        job_type: "b2c_payout",
        error_message: payoutErrorMsg,
        payload: { booking_id: booking.id, booking_number: booking.booking_number, amount: providerAmount, phone: finalPhone },
        status: "failed"
      })
      await supabase.from("notifications").insert({
        user_id: booking.provider_id,
        title: "Payment delayed",
        message: `We could not release KES ${providerAmount.toLocaleString()} to you yet. Our team has been notified and will resolve this shortly.`,
        type: "warning"
      })
      throw new Error("Payout failed: " + payoutErrorMsg)
    }

    // Payout genuinely accepted by Safaricom - mark released
    await supabase.from("bookings").update({
      payment_released: true,
      payment_released_at: new Date().toISOString(),
      completion_confirmed_at: confirmed_by === "customer" ? new Date().toISOString() : null,
      status: "completed"
    }).eq("id", booking_id)

    await supabase.from("notifications").insert({
      user_id: booking.provider_id,
      title: "Payment released!",
      message: `KES ${providerAmount.toLocaleString()} has been sent to your ${prefMethod} for ${booking.service_name} #${booking.booking_number}`,
      type: "success"
    })
    await supabase.from("notifications").insert({
      user_id: booking.customer_id,
      title: confirmed_by === "auto" ? "Payment auto-released" : "Payment confirmed",
      message: confirmed_by === "auto"
        ? `Payment of KES ${providerAmount.toLocaleString()} was automatically released to the provider after 24 hours.`
        : `Thank you for confirming! KES ${providerAmount.toLocaleString()} has been released to the provider.`,
      type: "info"
    })
    try {
      await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-push`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
        body: JSON.stringify({ user_id: booking.provider_id, title: "Payment released!", message: `KES ${providerAmount.toLocaleString()} sent to your ${prefMethod}` })
      })
    } catch (e) {}

    return new Response(JSON.stringify({ success: true, amount: providerAmount }), { headers: { ...corsHeaders, "Content-Type": "application/json" } })
  } catch (error: any) {
    console.error("Release payment error:", error.message)
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } })
  }
})

