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
          if (!bk) {
            // Not a booking - check if this is a marketplace order payment instead. Orders were
            // previously never recognized here at all: real customer payments confirmed with
            // Safaricom but the order's own payment_status stayed "awaiting_payment" forever,
            // since nothing ever told it the money had actually arrived.
            const { data: groupOrders } = await supabase.from("orders").select("id, customer_id, provider_id, order_number").eq("group_order_id", txn.booking_id)
            if (groupOrders && groupOrders.length > 0) {
              await supabase.from("orders").update({ payment_status: "paid", payment_held: true, status: "pending" }).eq("group_order_id", txn.booking_id)
              for (const order of groupOrders) {
                await supabase.from("notifications").insert({ user_id: order.provider_id, title: "New order received! 📦", message: "A customer has paid for their order. Check your Orders dashboard.", type: "success" })
              }
              const order = groupOrders[0]
              await supabase.from("notifications").insert({ user_id: order.customer_id, title: "Order placed! 🛒", message: "Your payment was successful and your order has been placed.", type: "success" })
              console.log("Order payment confirmed:", order.id)
            } else {
              // Not an order either - check if this is a new car dealer listing fee. Same gap that
              // existed for orders before: real payment confirms with Safaricom but the listing
              // itself never activates since nothing ever tells it the money arrived.
              const { data: carListing } = await supabase.from("new_car_listings").select("id, dealer_id, brand, model").eq("id", txn.booking_id).maybeSingle()
              if (carListing) {
                await supabase.from("new_car_listings").update({ listing_fee_paid: true, listing_paid_at: new Date().toISOString(), is_active: true, listing_expires_at: new Date(Date.now() + 30*24*60*60*1000).toISOString() }).eq("id", carListing.id)
                await supabase.from("notifications").insert({ user_id: carListing.dealer_id, title: "Listing activated! \uD83D\uDE97", message: `Your listing for ${carListing.brand} ${carListing.model} is now live.`, type: "success" })
              } else {
                // Not the initial listing fee either - check if this is a feature-fee payment
                // (its own dedicated featured_payments record, separate from the listing fee,
                // so the two can genuinely be told apart) or a lead fee (car_enquiries).
                const { data: featPayment } = await supabase.from("featured_payments").select("id, listing_id, weeks").eq("id", txn.booking_id).maybeSingle()
                if (featPayment) {
                  // A featured_payments record can point to either a dealer's new_car_listings
                  // or a peer seller's marketplace_listings - try dealer cars first, and if that
                  // genuinely affects nothing, it must be a peer listing instead.
                  const featuredUntil = new Date(Date.now() + (featPayment.weeks||1) * 7 * 24 * 60 * 60 * 1000).toISOString()
                  const { data: updatedCar } = await supabase.from("new_car_listings").update({ is_featured: true, featured_until: featuredUntil }).eq("id", featPayment.listing_id).select("id")
                  if (!updatedCar?.length) {
                    await supabase.from("marketplace_listings").update({ is_featured: true, featured_until: featuredUntil }).eq("id", featPayment.listing_id)
                  }
                  await supabase.from("featured_payments").update({ status: "paid" }).eq("id", featPayment.id)
                } else {
                  const { data: enquiry } = await supabase.from("car_enquiries").select("id").eq("id", txn.booking_id).maybeSingle()
                  if (enquiry) {
                    await supabase.from("car_enquiries").update({ lead_fee_paid: true }).eq("id", enquiry.id)
                  } else {
                    // Not any of the above - check if this is a peer-to-peer vehicle escrow
                    // purchase. Real money genuinely moves via M-Pesa here too, but nothing
                    // ever told the transaction it had been paid, leaving the buyer stuck
                    // with no way to ever reach the "Confirm Receipt" step.
                    const { data: mpTxn } = await supabase.from("marketplace_transactions").select("id, seller_id, listing_id, payment_status").eq("id", txn.booking_id).maybeSingle()
                    if (mpTxn) {
                      if (mpTxn.payment_status === "awaiting_facilitation_fee") {
                        // This is a large sale (above Safaricom's B2C ceiling) - this payment was
                        // only ever the seller's small facilitation fee, not the buyer's full
                        // sale amount. Mark the fee paid, which unlocks the handover step -
                        // the real money for large sales still moves directly between the two
                        // parties themselves, CCC was never going to hold it.
                        await supabase.from("marketplace_transactions").update({ facilitation_fee_paid: true }).eq("id", mpTxn.id)
                        await supabase.from("notifications").insert({ user_id: mpTxn.seller_id, title: "Facilitation fee received! \uD83D\uDCB0", message: "You can now arrange handover directly with the buyer and confirm the sale.", type: "success" })
                        // Large sales are higher-risk (bigger sums, CCC never holds the money
                        // directly) - alert admin so they have visibility into these even
                        // without being directly involved in the money movement.
                        const { data: mpTxnFull } = await supabase.from("marketplace_transactions").select("sale_price, buyer_id").eq("id", mpTxn.id).maybeSingle()
                        const { data: admins } = await supabase.from("profiles").select("id").eq("role", "admin")
                        if (admins?.length) {
                          await supabase.from("notifications").insert(admins.map((a: any) => ({
                            user_id: a.id, title: "Large sale in progress \uD83D\uDD14",
                            message: `A KES ${Number(mpTxnFull?.sale_price||0).toLocaleString()} sale is proceeding directly between buyer and seller - facilitation fee paid, handover pending.`,
                            type: "info"
                          })))
                        }
                      } else {
                        await supabase.from("marketplace_transactions").update({ payment_status: "paid" }).eq("id", mpTxn.id)
                        await supabase.from("notifications").insert({ user_id: mpTxn.seller_id, title: "Payment received! \uD83D\uDCB0", message: "The buyer has paid for your listing. Arrange handover to receive your payout once they confirm receipt.", type: "success" })
                      }
                    } else {
                      const { data: insp } = await supabase.from("inspection_requests").select("id, seller_id").eq("id", txn.booking_id).maybeSingle()
                      if (insp) {
                        await supabase.from("inspection_requests").update({ status: "scheduled" }).eq("id", insp.id)
                        await supabase.from("notifications").insert({ user_id: insp.seller_id, title: "Inspection payment received", message: "Your vehicle inspection has been scheduled. A CCC mechanic will contact you.", type: "success" })
                      } else {
                        console.error("Payment confirmed but no matching booking, order, car listing, feature payment, enquiry, marketplace transaction, or inspection request found:", txn.booking_id)
                      }
                    }
                  }
                }
              }
            }
          } else {
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

