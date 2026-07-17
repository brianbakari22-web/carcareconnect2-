import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })

  try {
    const WEBHOOK_SECRET = Deno.env.get("INTASEND_WEBHOOK_SECRET")
    const challenge = req.headers.get("x-intasend-signature") || req.headers.get("challenge")

    // Verify webhook secret
    if (challenge !== WEBHOOK_SECRET) {
      console.error("Invalid webhook secret")
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders })
    }

    const payload = await req.json()
    console.log("IntaSend webhook:", JSON.stringify(payload))

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    )

    const invoiceId = payload.invoice_id || payload.invoice?.invoice_id
    const state = payload.state || payload.invoice?.state
    const apiRef = payload.api_ref || payload.invoice?.api_ref

    // Find transaction by invoice_id
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
      // Mark transaction as paid
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
      const { data: rates } = await supabase
        .from("commission_rates")
        .select("*")
        .single()

      const commissionRate = rates?.provider_commission_rate || 0.10
      const platformAbsorptionRate = rates?.platform_processing_rate || 0.01
      const providerAbsorptionRate = rates?.provider_processing_rate || 0.01

      const grossAmount = txn.amount
      const platformCommission = Math.floor(grossAmount * commissionRate)
      const platformProcessingFee = Math.floor(grossAmount * platformAbsorptionRate)
      const providerProcessingFee = Math.floor(grossAmount * providerAbsorptionRate)
      const providerAmount = grossAmount - platformCommission - providerProcessingFee

      // Trigger provider payout
      if (txn.provider_id && providerAmount > 0) {
        // Get provider M-Pesa number
        const { data: sensitive } = await supabase
          .from("profile_sensitive")
          .select("mpesa_number")
          .eq("id", txn.provider_id)
          .single()

        if (sensitive?.mpesa_number) {
          // Call intasend-payout
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
              phone: sensitive.mpesa_number,
              narrative: `CCC payout for booking ${apiRef}`,
            })
          })
        }
      }

      // Notify customer
      await supabase.from("notifications").insert({
        user_id: txn.customer_id,
        type: "payment",
        title: "Payment confirmed ✅",
        message: `Your payment of KES ${grossAmount.toLocaleString()} has been received. Your booking is confirmed.`,
      })

      // Notify provider
      if (txn.provider_id) {
        await supabase.from("notifications").insert({
          user_id: txn.provider_id,
          type: "payment",
          title: "Payment received 💰",
          message: `You will receive KES ${providerAmount.toLocaleString()} for booking ${apiRef}.`,
        })
      }

    } else if (state === "FAILED") {
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
    console.error("Webhook error:", error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    })
  }
})
