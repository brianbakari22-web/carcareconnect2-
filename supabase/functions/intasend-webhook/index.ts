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

    const receivedChallenge = req.headers.get("x-intasend-signature") || req.headers.get("challenge") || payload.challenge
    if (WEBHOOK_SECRET && receivedChallenge && receivedChallenge !== WEBHOOK_SECRET) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders })
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!)
    const invoiceId = payload.invoice_id || payload.invoice?.invoice_id
    const state = payload.state || payload.invoice?.state
    console.log("Invoice:", invoiceId, "State:", state)

    if (!invoiceId) return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders })

    // Find transaction
    const { data: txn } = await supabase.from("payment_transactions")
      .select("*").eq("intasend_invoice_id", invoiceId).maybeSingle()
    if (!txn) {
      console.log("Transaction not found:", invoiceId)
      return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders })
    }

    if (state === "COMPLETE") {
      // Mark transaction complete
      await supabase.from("payment_transactions")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("intasend_invoice_id", invoiceId)

      // Fetch settings
      const { data: settingsRows } = await supabase.from("app_settings").select("key,value")
        .in("key", ["driver_commission_rate","driver_transport_allowance","concierge_surcharge_rate","ccc_processing_fee_rate","provider_processing_fee_rate"])
      const S: Record<string, number> = {}
      settingsRows?.forEach((s: any) => { S[s.key] = Number(s.value) })

      let booking: any = null
      if (txn.booking_id) {
        const { data: bk } = await supabase.from("bookings").select("*").eq("id", txn.booking_id).single()
        booking = bk
      }

      const grossAmount = txn.amount
      const platformCommissionRate = Number(booking?.platform_commission_rate || 0.10)
      const cccProcessingFee = Math.floor(grossAmount * ((S.ccc_processing_fee_rate || 1) / 100))
      const providerProcessingFee = Math.floor(grossAmount * ((S.provider_processing_fee_rate || 1) / 100))
      const platformCommission = Math.floor(grossAmount * platformCommissionRate)

      // Driver payout - immediate (service already rendered)
      let driverAmount = 0
      if (booking?.is_concierge && booking?.driver_id) {
        const surchargeAmount = Number(booking.concierge_surcharge || 0)
        const driverSurchargeRate = (S.driver_commission_rate || 15) / 100
        const driverAllowance = S.driver_transport_allowance || 200
        driverAmount = Math.round(surchargeAmount * driverSurchargeRate) + driverAllowance

        const { data: dSens } = await supabase.from("profile_sensitive")
          .select("mpesa_number,till_number,pochi_number,preferred_payment_method")
          .eq("id", booking.driver_id).single()
        const driverPrefMethod = dSens?.preferred_payment_method || "mpesa"
        const driverPhone = driverPrefMethod==="till" ? dSens?.till_number : driverPrefMethod==="pochi" ? dSens?.pochi_number : dSens?.mpesa_number

        if (driverPhone) {
          await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/intasend-payout`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
            body: JSON.stringify({ phone: driverPhone, amount: driverAmount, narrative: "CCC Driver earnings", payment_method: driverPrefMethod, booking_id: booking?.id, provider_id: booking?.driver_id })
          })
        }
        await supabase.from("bookings").update({ driver_earnings: driverAmount, driver_payout: driverAmount }).eq("id", txn.booking_id)
      }

      // Provider amount - HOLD in escrow, release after customer confirms
      const providerAmount = grossAmount - platformCommission - providerProcessingFee - cccProcessingFee - driverAmount
      const autoReleaseAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours

      // Update booking - payment held, waiting for customer confirmation
      if (txn.booking_id) {
        await supabase.from("bookings").update({
          payment_status: "paid",
          status: "confirmed",
          payment_held: true,
          payment_released: false,
          auto_release_at: autoReleaseAt,
          provider_earnings: providerAmount,
          platform_commission: platformCommission,
        }).eq("id", txn.booking_id)
      }

      // Save provider payout details for later release
      await supabase.from("payment_transactions").update({
        provider_amount: providerAmount,
        platform_commission: platformCommission,
        metadata: { ...txn.metadata, provider_amount: providerAmount, auto_release_at: autoReleaseAt }
      }).eq("id", txn.id)

      // Notify customer to confirm service
      if (booking?.customer_id) {
        await supabase.from("notifications").insert({
          user_id: booking.customer_id,
          title: "Payment received ✅",
          message: `Your payment of KES ${grossAmount.toLocaleString()} for ${booking.service_name} is held safely. Once your service is complete, confirm satisfaction to release payment to the provider.`,
          type: "success"
        })
      }

      console.log(`Payment held: gross=${grossAmount}, provider=${providerAmount}, driver=${driverAmount}, auto-release=${autoReleaseAt}`)

    } else if (state === "FAILED" || state === "CANCELLED") {
      await supabase.from("payment_transactions").update({ status: "failed" }).eq("intasend_invoice_id", invoiceId)
      if (txn.booking_id) {
        await supabase.from("bookings").update({ payment_status: "failed" }).eq("id", txn.booking_id)
      }
    }

    return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders })
  } catch (error: any) {
    console.error("Webhook error:", error.message)
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})

