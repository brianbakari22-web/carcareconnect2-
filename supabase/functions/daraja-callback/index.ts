import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
  try {
    const body = await req.json()
    console.log("Daraja callback received:", JSON.stringify(body))

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    // STK Push callback
    if (body.Body?.stkCallback) {
      const stk = body.Body.stkCallback
      const checkoutRequestId = stk.CheckoutRequestID
      const resultCode = stk.ResultCode
      const resultDesc = stk.ResultDesc

      console.log("STK callback:", checkoutRequestId, resultCode, resultDesc)

      if (resultCode === 0) {
        // Payment successful
        const items = stk.CallbackMetadata?.Item || []
        const amount = items.find((i: any) => i.Name === "Amount")?.Value
        const mpesaCode = items.find((i: any) => i.Name === "MpesaReceiptNumber")?.Value
        const phone = items.find((i: any) => i.Name === "PhoneNumber")?.Value

        // Update payment transaction
        await supabase.from("payment_transactions")
          .update({
            status: "completed",
            mpesa_code: mpesaCode,
            amount_paid: amount,
            completed_at: new Date().toISOString(),
            raw_callback: body
          })
          .eq("checkout_request_id", checkoutRequestId)

        // Get booking from transaction and mark payment held
        const { data: txn } = await supabase.from("payment_transactions")
          .select("booking_id")
          .eq("checkout_request_id", checkoutRequestId)
          .single()

        if (txn?.booking_id) {
          const { data: bk } = await supabase.from("bookings").select("is_emergency, status, go_service_fee_paid").eq("id", txn.booking_id).maybeSingle()
          const isGoServiceFeePayment = bk?.is_emergency && bk?.status === "completed" && !bk?.go_service_fee_paid
          const isGoCalloutPayment = bk?.is_emergency && bk?.status === "pending"
          if (isGoServiceFeePayment) {
            // This is the service fee payment, not the initial callout fee - the booking is already
            // "completed" and must stay that way. Trigger the actual provider payout instead.
            await supabase.from("bookings").update({ payment_held: true }).eq("id", txn.booking_id)
            const releaseRes = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/go-release-service-fee`, {
              method: "POST",
              headers: { "Content-Type": "application/json", "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
              body: JSON.stringify({ booking_id: txn.booking_id })
            })
            console.log("GO service fee release triggered:", txn.booking_id, releaseRes.status)
          } else if (isGoCalloutPayment) {
            // Initial GO Service callout fee payment. Only NOW that payment has genuinely been
            // confirmed do we trigger provider dispatch - previously the frontend called
            // assign-go-provider immediately after booking creation, before payment even
            // confirmed, meaning a provider could be notified for a request the customer might
            // cancel or never actually pay for.
            await supabase.from("bookings").update({ payment_held: true }).eq("id", txn.booking_id)
            const assignRes = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/assign-go-provider`, {
              method: "POST",
              headers: { "Content-Type": "application/json", "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
              body: JSON.stringify({ booking_id: txn.booking_id })
            })
            console.log("assign-go-provider triggered after confirmed callout payment:", txn.booking_id, assignRes.status)
            console.log("GO callout fee payment held (status stays pending):", txn.booking_id)
          } else {
            await supabase.from("bookings").update({
              payment_held: true,
              status: "confirmed",
              auto_release_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
            }).eq("id", txn.booking_id)
            console.log("Booking confirmed:", txn.booking_id)
          }
        }
      } else {
        // Payment failed
        await supabase.from("payment_transactions")
          .update({ status: "failed", result_desc: resultDesc, raw_callback: body })
          .eq("checkout_request_id", checkoutRequestId)
      }
    }

    // B2C callback
    if (body.Result) {
      const result = body.Result
      const conversationId = result.ConversationID
      const resultCode = result.ResultCode
      const resultDesc = result.ResultDesc

      console.log("B2C callback:", conversationId, resultCode, resultDesc)

      if (resultCode === 0) {
        const params = result.ResultParameters?.ResultParameter || []
        const amount = params.find((p: any) => p.Key === "TransactionAmount")?.Value
        const mpesaCode = params.find((p: any) => p.Key === "TransactionID")?.Value

        await supabase.from("payment_transactions")
          .update({
            status: "completed",
            mpesa_code: mpesaCode,
            amount_paid: amount,
            completed_at: new Date().toISOString(),
            raw_callback: body
          })
          .eq("raw_response->>ConversationID", conversationId)

        console.log("B2C payout completed:", mpesaCode, amount)
      } else {
        await supabase.from("payment_transactions")
          .update({ status: "failed", result_desc: resultDesc, raw_callback: body })
          .eq("raw_response->>ConversationID", conversationId)
      }
    }

    return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: "Success" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    })

  } catch (error: any) {
    console.error("Daraja callback error:", error.message)
    try {
      const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
        auth: { autoRefreshToken: false, persistSession: false }
      })
      await supabase.from("failed_jobs").insert({
        job_type: "payment_callback",
        error_message: error.message,
        payload: { error: String(error) },
        status: "failed"
      })
    } catch (logErr) { console.error("Failed to log to failed_jobs:", logErr) }
    return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: "Received" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    })
  }
})

