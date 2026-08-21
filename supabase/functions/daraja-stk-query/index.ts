import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
  try {
    const { checkout_request_id, booking_id } = await req.json()
    if (!checkout_request_id) throw new Error("checkout_request_id required")

    const CONSUMER_KEY = Deno.env.get("DARAJA_CONSUMER_KEY")!
    const CONSUMER_SECRET = Deno.env.get("DARAJA_CONSUMER_SECRET")!
    const SHORTCODE = Deno.env.get("DARAJA_SHORTCODE") || "4326921"
    const PASSKEY = Deno.env.get("DARAJA_PASSKEY")!
    const BASE_URL = "https://api.safaricom.co.ke"

    // Get OAuth token
    const credentials = btoa(`${CONSUMER_KEY}:${CONSUMER_SECRET}`)
    const authResp = await fetch(`${BASE_URL}/oauth/v1/generate?grant_type=client_credentials`, {
      method: "GET",
      headers: { "Authorization": `Basic ${credentials}` }
    })
    const authData = await authResp.json()
    if (!authData.access_token) throw new Error("Auth failed")

    // Generate timestamp and password
    const timestamp = new Date().toISOString().replace(/[-T:.Z]/g, "").slice(0, 14)
    const password = btoa(`${SHORTCODE}${PASSKEY}${timestamp}`)

    // Query STK Push status
    const queryResp = await fetch(`${BASE_URL}/mpesa/stkpushquery/v1/query`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${authData.access_token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        BusinessShortCode: SHORTCODE,
        Password: password,
        Timestamp: timestamp,
        CheckoutRequestID: checkout_request_id
      })
    })

    const queryData = await queryResp.json()
    console.log("STK Query response:", JSON.stringify(queryData))

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    if (queryData.ResultCode === "0") {
      // Payment successful - update transaction
      await supabase.from("payment_transactions")
        .update({
          status: "completed",
          mpesa_code: queryData.MpesaReceiptNumber || null,
          completed_at: new Date().toISOString()
        })
        .eq("checkout_request_id", checkout_request_id)

      // Update booking
      if (booking_id) {
        // Same GO Service awareness as daraja-callback needed here - this polling path can win
        // the race against the webhook callback, so bypassing this logic here bypasses it entirely:
        // never touch status for the initial callout (let assign-go-provider do real dispatch),
        // never revert a completed service-fee booking back to confirmed.
        const { data: bk } = await supabase.from("bookings").select("is_emergency, status, go_service_fee_paid").eq("id", booking_id).maybeSingle()
    if (!bk) {
      const { data: groupOrders } = await supabase.from("orders").select("id, customer_id, provider_id").eq("group_order_id", booking_id)
      if (groupOrders && groupOrders.length > 0) {
        await supabase.from("orders").update({ payment_status: "paid", payment_held: true, status: "pending" }).eq("group_order_id", booking_id)
        for (const o of groupOrders) {
          await supabase.from("notifications").insert({ user_id: o.provider_id, title: "New order received! 📦", message: "A customer has paid for their order. Check your Orders dashboard.", type: "success" })
        }
        const order = groupOrders[0]
        await supabase.from("notifications").insert({ user_id: order.customer_id, title: "Order placed! 🛒", message: "Your payment was successful and your order has been placed.", type: "success" })
      } else {
        // Not a booking or order - check if this is a new car dealer listing fee, same gap
        // that existed for orders before this fix.
        const { data: carListing } = await supabase.from("new_car_listings").select("id, dealer_id, brand, model").eq("id", booking_id).maybeSingle()
        if (carListing) {
          await supabase.from("new_car_listings").update({ listing_fee_paid: true, listing_paid_at: new Date().toISOString(), is_active: true, listing_expires_at: new Date(Date.now() + 30*24*60*60*1000).toISOString() }).eq("id", carListing.id)
          await supabase.from("notifications").insert({ user_id: carListing.dealer_id, title: "Listing activated! \uD83D\uDE97", message: `Your listing for ${carListing.brand} ${carListing.model} is now live.`, type: "success" })
        } else {
          const { data: featPayment } = await supabase.from("featured_payments").select("id, listing_id, weeks").eq("id", booking_id).maybeSingle()
          if (featPayment) {
            const featuredUntil = new Date(Date.now() + (featPayment.weeks||1) * 7 * 24 * 60 * 60 * 1000).toISOString()
            const { data: updatedCar } = await supabase.from("new_car_listings").update({ is_featured: true, featured_until: featuredUntil }).eq("id", featPayment.listing_id).select("id")
            if (!updatedCar?.length) {
              await supabase.from("marketplace_listings").update({ is_featured: true, featured_until: featuredUntil }).eq("id", featPayment.listing_id)
            }
            await supabase.from("featured_payments").update({ status: "paid" }).eq("id", featPayment.id)
          } else {
            const { data: enquiry } = await supabase.from("car_enquiries").select("id").eq("id", booking_id).maybeSingle()
            if (enquiry) {
              await supabase.from("car_enquiries").update({ lead_fee_paid: true }).eq("id", enquiry.id)
            } else {
              const { data: mpTxn } = await supabase.from("marketplace_transactions").select("id, seller_id, payment_status").eq("id", booking_id).maybeSingle()
              if (mpTxn) {
                if (mpTxn.payment_status === "awaiting_facilitation_fee") {
                  await supabase.from("marketplace_transactions").update({ facilitation_fee_paid: true }).eq("id", mpTxn.id)
                  await supabase.from("notifications").insert({ user_id: mpTxn.seller_id, title: "Facilitation fee received! \uD83D\uDCB0", message: "You can now arrange handover directly with the buyer and confirm the sale.", type: "success" })
                  const { data: mpTxnFull } = await supabase.from("marketplace_transactions").select("sale_price").eq("id", mpTxn.id).maybeSingle()
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
                const { data: insp } = await supabase.from("inspection_requests").select("id, seller_id").eq("id", booking_id).maybeSingle()
                if (insp) {
                  await supabase.from("inspection_requests").update({ status: "scheduled" }).eq("id", insp.id)
                  await supabase.from("notifications").insert({ user_id: insp.seller_id, title: "Inspection payment received", message: "Your vehicle inspection has been scheduled. A CCC mechanic will contact you.", type: "success" })
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
          await supabase.from("bookings").update({ payment_held: true }).eq("id", booking_id)
          await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/go-release-service-fee`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
            body: JSON.stringify({ booking_id })
          })
        } else if (isGoCalloutPayment) {
          await supabase.from("bookings").update({ payment_held: true }).eq("id", booking_id)
          await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/assign-go-provider`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
            body: JSON.stringify({ booking_id })
          })
        } else {
          await supabase.from("bookings").update({
            payment_held: true,
            status: "confirmed",
            auto_release_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
          }).eq("id", booking_id)
        }
    }

        // Get booking for notifications
        const { data: booking } = await supabase.from("bookings")
          .select("customer_id, provider_id, service_name, booking_number")
          .eq("id", booking_id).single()

        if (booking) {
          const pushUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-push`
          const pushHeaders = { "Content-Type": "application/json", "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` }

          await fetch(pushUrl, {
            method: "POST", headers: pushHeaders,
            body: JSON.stringify({
              user_id: booking.customer_id,
              title: "Payment confirmed! ✅",
              message: `KES ${queryData.Amount || ""} received for ${booking.service_name}.`,
              data: { type: "payment", booking_id }
            })
          })
          await fetch(pushUrl, {
            method: "POST", headers: pushHeaders,
            body: JSON.stringify({
              user_id: booking.provider_id,
              title: "Payment received! 💰",
              message: `KES ${queryData.Amount || ""} paid for ${booking.service_name} #${booking.booking_number}.`,
              data: { type: "payment", booking_id }
            })
          })
        }
      }

      return new Response(JSON.stringify({ success: true, status: "completed", result: queryData }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      })
    } else if (queryData.ResultCode === "1032") {
      return new Response(JSON.stringify({ success: false, status: "cancelled", result: queryData }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      })
    } else if (queryData.ResultCode !== undefined && queryData.ResultCode !== null) {
      // A definitive, terminal Safaricom result that isn't success or a plain user cancel
      // (e.g. "1037" DS timeout, insufficient funds, etc.) - this payment genuinely failed,
      // not merely still-in-progress. Mark it failed so it stops being treated as pending
      // forever and the dealer can cleanly retry, rather than silently aging out of
      // check-stuck-payments' recovery window with no resolution ever recorded.
      await supabase.from("payment_transactions")
        .update({ status: "failed", result_desc: queryData.ResultDesc || null, completed_at: new Date().toISOString() })
        .eq("checkout_request_id", checkout_request_id)
      return new Response(JSON.stringify({ success: false, status: "failed", result: queryData }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      })
    } else {
      return new Response(JSON.stringify({ success: false, status: "pending", result: queryData }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      })
    }
  } catch (error: any) {
    console.error("STK Query error:", error.message)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    })
  }
})

