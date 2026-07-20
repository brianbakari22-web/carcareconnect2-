import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-intasend-signature",
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })

  try {
    const WEBHOOK_SECRET = Deno.env.get("INTASEND_WEBHOOK_SECRET")
    const bodyText = await req.text()
    let payload: any = {}
    try { payload = JSON.parse(bodyText) } catch(e) { console.error("Body parse error:", e) }

    console.log("IntaSend webhook received:", bodyText.substring(0, 500))

    // Check challenge
    const challengeHeader = req.headers.get("x-intasend-signature") || 
                           req.headers.get("challenge") ||
                           req.headers.get("x-intasend-challenge")
    const receivedChallenge = challengeHeader || payload.challenge

    if (WEBHOOK_SECRET && receivedChallenge && receivedChallenge !== WEBHOOK_SECRET) {
      console.error("Invalid webhook secret")
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders })
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    )

    const invoiceId = payload.invoice_id || payload.invoice?.invoice_id
    const state = payload.state || payload.invoice?.state
    const apiRef = payload.api_ref || payload.invoice?.api_ref

    console.log("Invoice:", invoiceId, "State:", state)

    if (!invoiceId) {
      return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders })
    }

    // Find transaction
    const { data: txn } = await supabase
      .from("payment_transactions")
      .select("*")
      .eq("intasend_invoice_id", invoiceId)
      .maybeSingle()

    if (!txn) {
      console.log("Transaction not found for invoice:", invoiceId)
      return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders })
    }

    if (state === "COMPLETE") {
      // Mark transaction complete
      await supabase.from("payment_transactions")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("intasend_invoice_id", invoiceId)

      // Update booking payment status
      if (txn.booking_id) {
        await supabase.from("bookings")
          .update({ payment_status: "paid", status: "confirmed" })
          .eq("id", txn.booking_id)
      }

      // Get commission rates
      const { data: rates } = await supabase.from("commission_rates").select("*").single()
      const { data: settings } = await supabase.from("app_settings").select("key,value")
        .in("key", ["driver_commission_rate", "driver_transport_allowance"])

      const settingsMap: Record<string, number> = {}
      settings?.forEach((s: any) => { settingsMap[s.key] = Number(s.value) })

      const grossAmount = txn.amount
      const commissionRate = rates?.provider_commission_rate || 0.10
      const providerProcessingFee = Math.floor(grossAmount * (rates?.provider_processing_rate || 0.01))

      // Get booking to check if concierge
      let booking = null
      if (txn.booking_id) {
        const { data: bk } = await supabase.from("bookings").select("*").eq("id", txn.booking_id).single()
        booking = bk
      }

      // Calculate driver earnings for concierge
      let driverAmount = 0
      let driverPhone = null

      if (booking?.is_concierge && booking?.driver_id) {
        const driverCommissionRate = (settingsMap.driver_commission_rate || 15) / 100
        const driverAllowance = settingsMap.driver_transport_allowance || 200
        driverAmount = Math.round(grossAmount * driverCommissionRate) + driverAllowance

        // Get driver phone
        const { data: driverSensitive } = await supabase
          .from("profile_sensitive")
          .select("phone, mpesa_number")
          .eq("id", booking.driver_id)
          .single()
        driverPhone = driverSensitive?.mpesa_number || driverSensitive?.phone

        // Update driver_earnings on booking
        await supabase.from("bookings")
          .update({ driver_earnings: driverAmount, driver_payout: driverAmount })
          .eq("id", txn.booking_id)
      }

      // Provider gets amount minus commission, processing fee, and driver cut
      const providerAmount = grossAmount - Math.floor(grossAmount * commissionRate) - providerProcessingFee - driverAmount

      // Payout provider
      if (txn.provider_id && providerAmount > 0) {
        const { data: sensitive } = await supabase
          .from("profile_sensitive")
          .select("mpesa_number, till_number")
          .eq("id", txn.provider_id)
          .single()

        const providerPhone = sensitive?.mpesa_number || sensitive?.till_number

        if (providerPhone) {
          await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/intasend-payout`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
            },
            body: JSON.stringify({
              booking_id: txn.booking_id,
              provider_id: txn.provider_id,
              amount: providerAmount,
              phone: providerPhone,
              narrative: `CCC provider payout - ${apiRef}`,
            })
          })
        }
      }

      // Payout driver if concierge
      if (driverAmount > 0 && driverPhone && booking?.driver_id) {
        await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/intasend-payout`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          },
          body: JSON.stringify({
            booking_id: txn.booking_id,
            provider_id: booking.driver_id,
            amount: driverAmount,
            phone: driverPhone,
            narrative: `CCC driver payout - ${apiRef}`,
          })
        })

        await supabase.from("notifications").insert({
          user_id: booking.driver_id,
          type: "payment",
          title: "Payment received 💰",
          message: `You received KES ${driverAmount.toLocaleString()} for concierge delivery.`,
        })
      }

      // Notify customer
      if (txn.customer_id) {
        await supabase.from("notifications").insert({
          user_id: txn.customer_id,
          type: "payment",
          title: "Payment confirmed ✅",
          message: `Your payment of KES ${grossAmount.toLocaleString()} has been received.`,
        })
      }

      // Notify provider
      if (txn.provider_id) {
        await supabase.from("notifications").insert({
          user_id: txn.provider_id,
          type: "payment",
          title: "Payment received 💰",
          message: `You will receive KES ${providerAmount.toLocaleString()} for booking ${apiRef}.`,
        })
      }

    } else if (state === "FAILED" || state === "CANCELLED") {
      await supabase.from("payment_transactions")
        .update({ status: "failed" })
        .eq("intasend_invoice_id", invoiceId)

      if (txn.customer_id) {
        await supabase.from("notifications").insert({
          user_id: txn.customer_id,
          type: "payment",
          title: "Payment failed ❌",
          message: "Your payment was not completed. Please try again.",
        })
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    })

  } catch (error) {
    console.error("Webhook error:", error.message)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    })
  }
})
