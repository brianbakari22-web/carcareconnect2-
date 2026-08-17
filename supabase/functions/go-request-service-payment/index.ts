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

    // Skip for test bookings
    if (booking.payment_method === "test") {
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

    const serviceAmount = Number(booking.go_service_fee || 0)

    // Send STK Push using fetch with proper auth headers
    const stkRes = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/daraja-stk-push`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: JSON.stringify({
        amount: serviceAmount,
        booking_id,
        customer_id: booking.customer_id,
        provider_id: booking.provider_id,
        phone,
        service_name: booking.service_name
      })
    })

    const stkData = await stkRes.json()
    console.log("STK PUSH RESPONSE:", { status: stkRes.status, ok: stkRes.ok, stkData })
    if (!stkRes.ok) throw new Error(JSON.stringify(stkData) || "STK push failed")

    // Notify customer
    await supabase.from("notifications").insert({
      user_id: booking.customer_id,
      title: "💳 M-Pesa payment request sent!",
      message: `Please enter your M-Pesa PIN to pay KES ${serviceAmount.toLocaleString()} for ${booking.service_name}. Check your phone now!`,
      type: "info"
    })

    // Notify provider
    await supabase.from("notifications").insert({
      user_id: booking.provider_id,
      title: "Payment requested from customer 💰",
      message: `STK push sent to customer for KES ${serviceAmount.toLocaleString()}.`,
      type: "info"
    })

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
