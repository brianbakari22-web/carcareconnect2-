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
      .select("*, profiles!bookings_customer_id_fkey(first_name)")
      .eq("id", booking_id)
      .single()

    if (!booking) throw new Error("Booking not found")

    // Skip for test bookings
    if (booking.payment_method === "test") {
      console.log("Test booking - skipping STK push")
      await supabase.from("notifications").insert({
        user_id: booking.customer_id,
        title: "🧪 Test: Service complete!",
        message: `Test mode - service fee of KES ${Number(booking.total_amount).toLocaleString()} would be charged here.`,
        type: "success"
      })
      return new Response(JSON.stringify({ success: true, test: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      })
    }

    // Get customer phone
    const { data: sensitive } = await supabase
      .from("profile_sensitive")
      .select("phone, mpesa_number")
      .eq("id", booking.customer_id)
      .single()

    const phone = sensitive?.mpesa_number || sensitive?.phone
    if (!phone) throw new Error("Customer has no phone number set")

    // Get GO service rates
    const { data: settings } = await supabase
      .from("app_settings")
      .select("key, value")
      .in("key", ["go_service_provider_rate", "go_service_platform_rate"])

    const rates: Record<string, number> = {}
    settings?.forEach((s: any) => { rates[s.key] = Number(s.value) / 100 })

    const serviceAmount = Number(booking.total_amount || 0)
    const providerRate = rates.go_service_provider_rate || 0.85

    // Send STK Push to customer
    const { data: stkData, error: stkError } = await supabase.functions.invoke("intasend-stk-push", {
      body: {
        amount: serviceAmount,
        booking_id,
        customer_id: booking.customer_id,
        provider_id: booking.provider_id,
        phone,
        service_name: booking.service_name
      }
    })

    if (stkError) throw stkError
    if (stkData?.error) throw new Error(stkData.error)

    // Notify customer
    await supabase.from("notifications").insert({
      user_id: booking.customer_id,
      title: "💳 M-Pesa payment request sent!",
      message: `Please enter your M-Pesa PIN to pay KES ${serviceAmount.toLocaleString()} for ${booking.service_name}. Check your phone now!`,
      type: "info"
    })

    // Notify mechanic
    await supabase.from("notifications").insert({
      user_id: booking.provider_id,
      title: "Payment requested from customer",
      message: `STK push sent to customer for KES ${serviceAmount.toLocaleString()}. Waiting for payment.`,
      type: "info"
    })

    console.log("STK push sent for service fee:", booking_id, "Amount:", serviceAmount)

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    })

  } catch (error) {
    console.error("Service payment error:", error.message)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    })
  }
})
