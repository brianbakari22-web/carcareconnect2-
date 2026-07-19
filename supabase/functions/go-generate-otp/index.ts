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

    // Generate 4-digit OTP
    const otp = Math.floor(1000 + Math.random() * 9000).toString()
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString() // 30 min

    // Save OTP to booking
    await supabase.from("bookings").update({
      go_arrival_otp: otp,
      go_otp_expires_at: expiresAt,
      go_otp_verified: false
    }).eq("id", booking_id)

    // Get booking + customer details
    const { data: booking } = await supabase
      .from("bookings")
      .select("customer_id, service_name, booking_number")
      .eq("id", booking_id)
      .single()

    // Notify customer with OTP
    await supabase.from("notifications").insert({
      user_id: booking.customer_id,
      title: "🔐 Mechanic Arrival OTP",
      message: `Your mechanic has arrived! Give them this code: ${otp}. Valid for 30 minutes. NEVER share this with anyone else.`,
      type: "info"
    })

    console.log("OTP generated for booking:", booking_id, "OTP:", otp)

    return new Response(JSON.stringify({ 
      success: true,
      message: "OTP sent to customer"
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    })

  } catch (error) {
    console.error("OTP error:", error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    })
  }
})
