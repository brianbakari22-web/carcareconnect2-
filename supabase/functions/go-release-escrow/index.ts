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

    // Get booking details
    const { data: booking } = await supabase
      .from("bookings")
      .select("*, profiles!bookings_provider_id_fkey(id)")
      .eq("id", booking_id)
      .single()

    if (!booking) throw new Error("Booking not found")

    // Get GO commission rates
    const { data: settings } = await supabase
      .from("app_settings")
      .select("key, value")
      .in("key", ["go_callout_provider_rate", "go_callout_platform_rate"])

    const rates = {}
    settings?.forEach(s => { rates[s.key] = Number(s.value) / 100 })

    const calloutFee = Number(booking.go_callout_fee || 500)
    const providerRate = rates.go_callout_provider_rate || 0.70
    const providerAmount = Math.round(calloutFee * providerRate)

    // Get provider M-Pesa number
    const { data: sensitive } = await supabase
      .from("profile_sensitive")
      .select("mpesa_number, till_number, paybill_number, preferred_payment_method")
      .eq("id", booking.provider_id)
      .single()

    const phone = sensitive?.mpesa_number || sensitive?.till_number

    if (!phone) throw new Error("Provider has no payment method set")

    // Payout to provider via IntaSend B2C
    const { data: payout, error: payoutError } = await supabase.functions.invoke("intasend-payout", {
      body: {
        booking_id,
        provider_id: booking.provider_id,
        amount: providerAmount,
        phone,
        narrative: `GO Service callout fee payout - ${booking.booking_number}`
      }
    })

    if (payoutError) throw payoutError

    // Update booking
    await supabase.from("bookings").update({
      go_callout_paid: true,
    }).eq("id", booking_id)

    // Notify provider
    await supabase.from("notifications").insert({
      user_id: booking.provider_id,
      title: "Callout fee received! 💰",
      message: `KES ${providerAmount.toLocaleString()} has been sent to your M-Pesa for GO service arrival.`,
      type: "success"
    })

    return new Response(JSON.stringify({ success: true, provider_amount: providerAmount }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    })

  } catch (error) {
    console.error("Escrow release error:", error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    })
  }
})
