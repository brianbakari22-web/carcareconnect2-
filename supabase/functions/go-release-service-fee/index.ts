import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
  try {
    const { booking_id } = await req.json()
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    )
    const { data: booking } = await supabase
      .from("bookings")
      .select("*")
      .eq("id", booking_id)
      .single()
    if (!booking) throw new Error("Booking not found")
    if (booking.go_service_fee_paid) throw new Error("Service fee already released")

    if (booking.payment_method === "test") {
      console.log("Test booking - skipping payout")
      await supabase.from("bookings").update({ go_service_fee_paid: true }).eq("id", booking_id)
      return new Response(JSON.stringify({ success: true, test: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      })
    }

    const { data: settings } = await supabase
      .from("app_settings")
      .select("key, value")
      .in("key", ["go_service_provider_rate"])
    const rates = {}
    settings?.forEach((s) => { rates[s.key] = Number(s.value) / 100 })

    const serviceFee = Number(booking.go_service_fee || 0)
    if (serviceFee <= 0) throw new Error("Invalid service fee amount")
    const providerRate = rates.go_service_provider_rate || 0.85
    const providerAmount = Math.round(serviceFee * providerRate)

    const { data: sensitive } = await supabase
      .from("profile_sensitive")
      .select("mpesa_number, till_number")
      .eq("id", booking.provider_id)
      .single()
    const phone = sensitive?.mpesa_number || sensitive?.till_number
    if (!phone) throw new Error("Provider has no M-Pesa number set")

    await supabase.functions.invoke("daraja-b2c-payout", {
      body: {
        booking_id,
        provider_id: booking.provider_id,
        amount: providerAmount,
        phone,
        narrative: `GO Service fee - ${booking.booking_number}`
      }
    })

    await supabase.from("bookings").update({
      go_service_fee_paid: true,
      payment_released: true,
      payment_released_at: new Date().toISOString(),
    }).eq("id", booking_id)

    await supabase.from("notifications").insert({
      user_id: booking.provider_id,
      title: "Service fee received! 💰",
      message: `KES ${providerAmount.toLocaleString()} sent to your M-Pesa for completed service.`,
      type: "success"
    })

    return new Response(JSON.stringify({ success: true, provider_amount: providerAmount }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    })
  } catch (error) {
    console.error("Service fee release error:", error.message)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    })
  }
})
