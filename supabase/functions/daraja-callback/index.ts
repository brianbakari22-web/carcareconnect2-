import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? ""
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""

serve(async (req) => {
  try {
    const body = await req.json()
    console.log("Daraja callback received:", JSON.stringify(body))

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    const callback = body?.Body?.stkCallback

    if (!callback) return new Response("OK", { status: 200 })

    const checkoutRequestId = callback.CheckoutRequestID
    const resultCode = callback.ResultCode
    const resultDesc = callback.ResultDesc

    // Get transaction from DB
    const { data: transaction } = await supabase
      .from("payment_transactions")
      .select("*")
      .eq("checkout_request_id", checkoutRequestId)
      .single()

    if (!transaction) {
      console.error("Transaction not found:", checkoutRequestId)
      return new Response("OK", { status: 200 })
    }

    if (resultCode === 0) {
      // Payment successful
      const metadata = callback.CallbackMetadata?.Item || []
      const getMeta = (name) => metadata.find(i => i.Name === name)?.Value

      const mpesaCode = getMeta("MpesaReceiptNumber")
      const amount = getMeta("Amount")
      const phone = getMeta("PhoneNumber")
      const transDate = getMeta("TransactionDate")

      // Update transaction status
      await supabase.from("payment_transactions").update({
        status: "completed",
        mpesa_code: mpesaCode,
        amount_paid: amount,
        completed_at: new Date().toISOString(),
        raw_callback: body
      }).eq("checkout_request_id", checkoutRequestId)

      // Update booking if exists
      if (transaction.booking_id) {
        const { data: booking } = await supabase.from("bookings")
          .update({ payment_status: "paid", status: "confirmed", mpesa_code: mpesaCode })
          .eq("id", transaction.booking_id)
          .select("provider_id, customer_id, service_name, booking_number")
          .single()

        if (booking) {
          // Notify provider
          if (booking.provider_id) {
            await supabase.from("notifications").insert({
              user_id: booking.provider_id,
              type: "booking",
              title: "New booking received! 🎉",
              message: `Payment confirmed for ${booking.service_name} (#${booking.booking_number}). M-Pesa: ${mpesaCode}`,
              data: { booking_id: transaction.booking_id }
            })
          }
          // Notify customer
          await supabase.from("notifications").insert({
            user_id: booking.customer_id,
            type: "booking",
            title: "Payment confirmed! ✅",
            message: `Your payment of KES ${amount} was received. M-Pesa code: ${mpesaCode}`,
            data: { booking_id: transaction.booking_id }
          })
        }
      }

      // Update order if exists
      if (transaction.order_id) {
        await supabase.from("orders")
          .update({ payment_status: "paid", status: "confirmed", mpesa_code: mpesaCode })
          .eq("id", transaction.order_id)
      }

      console.log("Payment completed:", mpesaCode, "Amount:", amount)

    } else {
      // Payment failed or cancelled
      await supabase.from("payment_transactions").update({
        status: resultCode === 1032 ? "cancelled" : "failed",
        result_desc: resultDesc,
        raw_callback: body
      }).eq("checkout_request_id", checkoutRequestId)

      // Notify customer of failure
      if (transaction.user_id) {
        await supabase.from("notifications").insert({
          user_id: transaction.user_id,
          type: "payment",
          title: resultCode === 1032 ? "Payment cancelled" : "Payment failed",
          message: resultCode === 1032 ? "You cancelled the M-Pesa payment. Please try again." : `Payment failed: ${resultDesc}`,
          data: { booking_id: transaction.booking_id }
        })
      }

      console.log("Payment failed/cancelled:", resultDesc)
    }

    return new Response("OK", { status: 200 })

  } catch (error) {
    console.error("Callback error:", error.message)
    return new Response("OK", { status: 200 }) // Always return 200 to Safaricom
  }
})
