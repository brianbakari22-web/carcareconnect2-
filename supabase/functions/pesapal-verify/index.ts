import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

const PESAPAL_CONSUMER_KEY = Deno.env.get("PESAPAL_CONSUMER_KEY") ?? ""
const PESAPAL_CONSUMER_SECRET = Deno.env.get("PESAPAL_CONSUMER_SECRET") ?? ""
const PESAPAL_BASE_URL = "https://pay.pesapal.com/v3"
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? ""
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
  try {
    const { trackingId, bookingId } = await req.json()
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    // Get Pesapal token
    const tokenRes = await fetch(PESAPAL_BASE_URL + "/api/Auth/RequestToken", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({ consumer_key: PESAPAL_CONSUMER_KEY, consumer_secret: PESAPAL_CONSUMER_SECRET })
    })
    const tokenData = await tokenRes.json()
    const token = tokenData.token

    // Check transaction status
    const statusRes = await fetch(PESAPAL_BASE_URL + "/api/Transactions/GetTransactionStatus?orderTrackingId=" + trackingId, {
      headers: { "Accept": "application/json", "Authorization": "Bearer " + token }
    })
    const statusData = await statusRes.json()

    // If payment completed, update booking + notify
    if (statusData.payment_status_description === "Completed" && bookingId) {
      // Update booking
      const { data: bk } = await supabase.from("bookings")
        .update({ payment_status: "paid", status: "confirmed", pesapal_tracking_id: trackingId })
        .eq("id", bookingId)
        .select("provider_id, service_name, booking_number, customer_id")
        .single()

      if (bk) {
        // Notify provider
        if (bk.provider_id) {
          await supabase.from("notifications").insert({
            user_id: bk.provider_id,
            type: "booking",
            title: "New booking received! 🎉",
            message: `A customer has booked ${bk.service_name} (#${bk.booking_number}). Payment confirmed.`,
            data: { booking_id: bookingId }
          })
        }
        // Notify customer
        await supabase.from("notifications").insert({
          user_id: bk.customer_id,
          type: "booking",
          title: "Booking confirmed! ✅",
          message: `Your booking #${bk.booking_number} has been confirmed. The provider will be in touch shortly.`,
          data: { booking_id: bookingId }
        })
      }

      // Also handle orders
      const { data: ord } = await supabase.from("orders")
        .update({ payment_status: "paid", status: "confirmed", pesapal_tracking_id: trackingId })
        .eq("id", bookingId)
        .select("provider_id, order_number, customer_id")
        .single()

      if (ord?.provider_id) {
        await supabase.from("notifications").insert({
          user_id: ord.provider_id,
          type: "order",
          title: "New order received! 📦",
          message: `Order #${ord.order_number} payment confirmed. Please prepare for dispatch.`,
          data: { order_id: bookingId }
        })
      }
    }

    return new Response(JSON.stringify(statusData), { headers: { ...corsHeaders, "Content-Type": "application/json" } })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } })
  }
})
