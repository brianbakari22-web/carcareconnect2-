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

    console.log("Webhook received:", bodyText.substring(0, 300))

    // Verify challenge
    const receivedChallenge = req.headers.get("x-intasend-signature") || 
                              req.headers.get("challenge") || payload.challenge
    if (WEBHOOK_SECRET && receivedChallenge && receivedChallenge !== WEBHOOK_SECRET) {
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
    if (!invoiceId) return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders })

    // Find transaction
    const { data: txn } = await supabase
      .from("payment_transactions").select("*")
      .eq("intasend_invoice_id", invoiceId).maybeSingle()

    if (!txn) {
      console.log("Transaction not found:", invoiceId)
      return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders })
    }

    if (state === "COMPLETE") {
      // Mark complete
      await supabase.from("payment_transactions")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("intasend_invoice_id", invoiceId)

      if (txn.booking_id) {
        await supabase.from("bookings")
          .update({ payment_status: "paid", status: "confirmed" })
          .eq("id", txn.booking_id)
      }

      // Fetch all rates from app_settings
      const { data: settingsRows } = await supabase
        .from("app_settings").select("key,value")
        .in("key", [
          "driver_commission_rate",
          "driver_transport_allowance",
          "concierge_surcharge_rate",
          "ccc_processing_fee_rate",
          "provider_processing_fee_rate"
        ])
      const S: Record<string, number> = {}
      settingsRows?.forEach((s: any) => { S[s.key] = Number(s.value) })

      // Fetch commission rates
      const { data: rates } = await supabase.from("commission_rates").select("*").single()
      const platformCommissionRate = rates?.provider_commission_rate || 0.10
      // 3% IntaSend fee split: customer already paid 1%, CCC absorbs 1%, provider absorbs 1%
      const cccProcessingFee = Math.floor(txn.amount * ((S.ccc_processing_fee_rate || 1) / 100))
      const providerProcessingFee = Math.floor(txn.amount * ((S.provider_processing_fee_rate || 1) / 100))
      const totalProcessingFee = cccProcessingFee + providerProcessingFee

      // Fetch booking for concierge check
      let booking: any = null
      if (txn.booking_id) {
        const { data: bk } = await supabase.from("bookings").select("*").eq("id", txn.booking_id).single()
        booking = bk
      }

      const grossAmount = txn.amount

      // ============================
      // COMMISSION CALCULATION
      // ============================
      // Platform commission on total
      const platformCommission = Math.floor(grossAmount * platformCommissionRate)
      
      // Driver earnings (only for concierge bookings)
      let driverAmount = 0
      let driverPhone = null

      if (booking?.is_concierge && booking?.driver_id) {
        // Driver gets % of concierge surcharge + fixed allowance
        const surchargeAmount = Number(booking.concierge_surcharge || 0)
        const driverSurchargeRate = (S.driver_commission_rate || 15) / 100
        const driverAllowance = S.driver_transport_allowance || 200
        driverAmount = Math.round(surchargeAmount * driverSurchargeRate) + driverAllowance

        console.log(`Concierge: surcharge=${surchargeAmount}, driver rate=${driverSurchargeRate}, allowance=${driverAllowance}, driver total=${driverAmount}`)

        // Get driver M-Pesa
        const { data: dSens } = await supabase
          .from("profile_sensitive").select("phone,mpesa_number,till_number,pochi_number,preferred_payment_method")
          .eq("id", booking.driver_id).single()
        const driverPrefMethod = dSens?.preferred_payment_method || "mpesa"
        driverPhone = driverPrefMethod==="till" ? dSens?.till_number : driverPrefMethod==="pochi" ? dSens?.pochi_number : (dSens?.mpesa_number || dSens?.phone)
        // Update booking with driver earnings
        await supabase.from("bookings")
          .update({ driver_earnings: driverAmount, driver_payout: driverAmount })
          .eq("id", txn.booking_id)
      }

      // Provider gets remainder
      const providerAmount = grossAmount - platformCommission - providerProcessingFee - cccProcessingFee - driverAmount

      console.log(`Split: gross=${grossAmount}, platform=${platformCommission}, driver=${driverAmount}, provider=${providerAmount}`)

      // ============================
      // PAYOUTS
      // ============================
      // 1. Provider payout
      if (txn.provider_id && providerAmount > 0) {
        const { data: pSens } = await supabase
          .from("profile_sensitive").select("mpesa_number,till_number,paybill_number,paybill_account,pochi_number,preferred_payment_method")
          .eq("id", txn.provider_id).single()
        const prefMethod = pSens?.preferred_payment_method || "mpesa"
        const providerPhone = prefMethod==="till" ? pSens?.till_number : prefMethod==="paybill" ? pSens?.paybill_number : prefMethod==="pochi" ? pSens?.pochi_number : (pSens?.mpesa_number || pSens?.till_number || pSens?.pochi_number || pSens?.paybill_number)
        if (providerPhone) {
          await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/intasend-payout`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
            body: JSON.stringify({ booking_id: txn.booking_id, provider_id: txn.provider_id, amount: providerAmount, phone: providerPhone, narrative: `CCC provider payout - ${apiRef}` })
          })
        }

        await supabase.from("notifications").insert({
          user_id: txn.provider_id, type: "payment",
          title: "Payment received 💰",
          message: `You will receive KES ${providerAmount.toLocaleString()} for booking ${apiRef}.`
        })
      }

      // 2. Driver payout (concierge only)
      if (driverAmount > 0 && driverPhone && booking?.driver_id) {
        await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/intasend-payout`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
          body: JSON.stringify({ booking_id: txn.booking_id, provider_id: booking.driver_id, amount: driverAmount, phone: driverPhone, narrative: `CCC driver payout - ${apiRef}` })
        })

        await supabase.from("notifications").insert({
          user_id: booking.driver_id, type: "payment",
          title: "Concierge payment received 💰",
          message: `You received KES ${driverAmount.toLocaleString()} for concierge delivery (${Math.round((S.driver_commission_rate||15))}% surcharge + KES ${S.driver_transport_allowance||200} allowance).`
        })
      }

      // 3. Customer notification
      if (txn.customer_id) {
        await supabase.from("notifications").insert({
          user_id: txn.customer_id, type: "payment",
          title: "Payment confirmed ✅",
          message: `Your payment of KES ${grossAmount.toLocaleString()} has been received. Booking confirmed!`
        })
      }

    } else if (state === "FAILED" || state === "CANCELLED") {
      await supabase.from("payment_transactions")
        .update({ status: "failed" })
        .eq("intasend_invoice_id", invoiceId)

      if (txn.customer_id) {
        await supabase.from("notifications").insert({
          user_id: txn.customer_id, type: "payment",
          title: "Payment failed ❌",
          message: "Your payment was not completed. Please try again."
        })
      }
    }

    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } })

  } catch (error) {
    console.error("Webhook error:", error.message)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    })
  }
})
