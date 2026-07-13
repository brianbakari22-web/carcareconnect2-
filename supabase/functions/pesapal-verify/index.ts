import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://carcareconnect.care",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

const PESAPAL_CONSUMER_KEY = Deno.env.get("PESAPAL_CONSUMER_KEY") ?? ""
const PESAPAL_CONSUMER_SECRET = Deno.env.get("PESAPAL_CONSUMER_SECRET") ?? ""
const PESAPAL_BASE_URL = "https://pay.pesapal.com/v3"
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? ""
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" }
    })
  }

  try {
    // 1. Verify caller is authenticated
    const authHeader = req.headers.get("Authorization")
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
      })
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    const userToken = authHeader.replace("Bearer ", "")
    const { data: { user }, error: authError } = await supabase.auth.getUser(userToken)
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
      })
    }

    const { trackingId, bookingId } = await req.json()

    // 2. Validate inputs
    if (!trackingId || typeof trackingId !== "string" || trackingId.length > 100) {
      return new Response(JSON.stringify({ error: "Invalid tracking ID" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
      })
    }

    // 3. Verify booking belongs to this user (if bookingId provided)
    if (bookingId) {
      const { data: booking } = await supabase.from("bookings")
        .select("customer_id, payment_status")
        .eq("id", bookingId)
        .single()

      if (!booking) {
        // Check orders table
        const { data: order } = await supabase.from("orders")
          .select("customer_id, payment_status")
          .eq("id", bookingId)
          .single()
        if (!order || order.customer_id !== user.id) {
          return new Response(JSON.stringify({ error: "Not found" }), {
            status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" }
          })
        }
      } else if (booking.customer_id !== user.id) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" }
        })
      }
    }

    // 4. Get fresh Pesapal token
    const tokenRes = await fetch(PESAPAL_BASE_URL + "/api/Auth/RequestToken", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({ consumer_key: PESAPAL_CONSUMER_KEY, consumer_secret: PESAPAL_CONSUMER_SECRET })
    })
    const tokenData = await tokenRes.json()
    const token = tokenData.token
    if (!token) throw new Error("Failed to get Pesapal token")

    // 5. Verify transaction status directly with Pesapal
    const statusRes = await fetch(
      PESAPAL_BASE_URL + "/api/Transactions/GetTransactionStatus?orderTrackingId=" + encodeURIComponent(trackingId),
      { headers: { "Accept": "application/json", "Authorization": "Bearer " + token } }
    )
    const statusData = await statusRes.json()

    // 6. If payment completed, update records
    if (statusData.payment_status_description === "Completed" && bookingId) {
      // Update booking
      const { data: bk } = await supabase.from("bookings")
        .update({ payment_status: "paid", status: "confirmed", pesapal_tracking_id: trackingId })
        .eq("id", bookingId)
        .eq("payment_status", "processing") // Only update if still processing - prevent double processing
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

      // Update order if booking not found
      if (!bk) {
        const { data: ord } = await supabase.from("orders")
          .update({ payment_status: "paid", status: "confirmed", pesapal_tracking_id: trackingId })
          .eq("id", bookingId)
          .eq("payment_status", "processing")
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
    }

    return new Response(JSON.stringify(statusData), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    })

  } catch (error) {
    console.error("pesapal-verify error:", error.message)
    return new Response(JSON.stringify({ error: "Verification failed" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    })
  }
})
