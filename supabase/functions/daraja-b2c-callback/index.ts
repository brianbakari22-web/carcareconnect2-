import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? ""
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""

serve(async (req) => {
  try {
    const body = await req.json()
    console.log("B2C callback received:", JSON.stringify(body))

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    const result = body?.Result

    if (!result) return new Response("OK", { status: 200 })

    const resultCode = result.ResultCode
    const resultDesc = result.ResultDesc
    const conversationId = result.OriginatorConversationID

    // Extract booking ID from conversation ID (CCC-PAYOUT-{bookingId}-{timestamp})
    const bookingId = conversationId?.split("-").slice(2, -1).join("-")

    if (!bookingId) {
      console.error("Could not extract booking ID from:", conversationId)
      return new Response("OK", { status: 200 })
    }

    if (resultCode === 0) {
      // Payout successful
      const params = result.ResultParameters?.ResultParameter || []
      const getParam = (key) => params.find(p => p.Key === key)?.Value

      const transactionId = getParam("TransactionID")
      const amount = getParam("TransactionAmount")
      const receiverName = getParam("ReceiverPartyPublicName")

      // Update booking
      const { data: booking } = await supabase.from("bookings")
        .update({
          provider_payout_status: "paid",
          provider_payout_mpesa_code: transactionId,
          provider_payout_completed_at: new Date().toISOString()
        })
        .eq("id", bookingId)
        .select("provider_id, customer_id, booking_number, service_name")
        .single()

      if (booking) {
        // Notify provider
        await supabase.from("notifications").insert({
          user_id: booking.provider_id,
          type: "payment",
          title: "Payment received! 🎉",
          message: `KES ${amount} received for ${booking.service_name} (#${booking.booking_number}). M-Pesa: ${transactionId}`,
          data: { booking_id: bookingId }
        })
      }

      console.log("B2C payout successful:", transactionId, "Amount:", amount)

    } else {
      // Payout failed
      await supabase.from("bookings")
        .update({
          provider_payout_status: "failed",
          provider_payout_error: resultDesc
        })
        .eq("id", bookingId)

      // Get provider to notify
      const { data: booking } = await supabase.from("bookings")
        .select("provider_id, booking_number")
        .eq("id", bookingId)
        .single()

      if (booking) {
        await supabase.from("notifications").insert({
          user_id: booking.provider_id,
          type: "payment",
          title: "Payment failed ⚠️",
          message: `Payout for booking #${booking.booking_number} failed: ${resultDesc}. Contact support.`,
          data: { booking_id: bookingId }
        })
      }

      console.log("B2C payout failed:", resultDesc)
    }

    return new Response("OK", { status: 200 })

  } catch (error) {
    console.error("B2C callback error:", error.message)
    return new Response("OK", { status: 200 })
  }
})
