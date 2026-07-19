import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })

  try {
    const { booking_id, customer_id } = await req.json()
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    )

    // Get booking
    const { data: booking } = await supabase
      .from("bookings")
      .select("*")
      .eq("id", booking_id)
      .single()

    if (!booking) throw new Error("Booking not found")

    // Check strike count for provider
    const { count } = await supabase
      .from("go_provider_strikes")
      .select("id", { count: "exact" })
      .eq("provider_id", booking.provider_id)

    // Get strike limit from settings
    const { data: limitSetting } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "go_provider_strike_limit")
      .single()

    const strikeLimit = Number(limitSetting?.value || 3)

    // Suspend provider if limit reached
    if ((count || 0) >= strikeLimit) {
      await supabase.from("profiles").update({ is_active: false }).eq("id", booking.provider_id)
      await supabase.from("notifications").insert({
        user_id: booking.provider_id,
        title: "⚠️ GO Service suspended",
        message: `You have received ${count} no-show strikes. Your GO service access has been suspended. Contact support to appeal.`,
        type: "error"
      })
    }

    // Get customer M-Pesa for refund
    const { data: sensitive } = await supabase
      .from("profile_sensitive")
      .select("mpesa_number, phone")
      .eq("id", customer_id)
      .single()

    const phone = sensitive?.mpesa_number || sensitive?.phone

    if (phone) {
      // Refund callout fee to customer
      await supabase.functions.invoke("intasend-payout", {
        body: {
          booking_id,
          provider_id: customer_id,
          amount: Number(booking.go_callout_fee || 500),
          phone,
          narrative: `GO Service refund - provider no-show - ${booking.booking_number}`
        }
      })
    }

    // Cancel booking
    await supabase.from("bookings").update({ status: "cancelled" }).eq("id", booking_id)

    // Notify customer
    await supabase.from("notifications").insert({
      user_id: customer_id,
      title: "Refund initiated 💸",
      message: `KES ${booking.go_callout_fee || 500} callout fee refund has been initiated to your M-Pesa.`,
      type: "success"
    })

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    })
  }
})
