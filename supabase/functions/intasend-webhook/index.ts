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
    
    // Read body first
    const bodyText = await req.text()
    let payload: any = {}
    try { payload = JSON.parse(bodyText) } catch(e) { console.error("Body parse error:", e) }

    console.log("IntaSend webhook received:", bodyText.substring(0, 500))
    console.log("Headers:", JSON.stringify(Object.fromEntries(req.headers.entries())))

    // Check challenge in multiple places
    const challengeHeader = req.headers.get("x-intasend-signature") || 
                           req.headers.get("challenge") ||
                           req.headers.get("x-intasend-challenge")
    const challengeBody = payload.challenge

    const receivedChallenge = challengeHeader || challengeBody

    // Verify webhook secret - be flexible
    if (WEBHOOK_SECRET && receivedChallenge && receivedChallenge !== WEBHOOK_SECRET) {
      console.error("Invalid webhook secret. Got:", receivedChallenge, "Expected:", WEBHOOK_SECRET)
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
      console.log("No invoice ID in payload - returning ok")
      return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders })
    }

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
      await supabase.from("payment_transactions")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("intasend_invoice_id", invoiceId)

      if (txn.booking_id) {
        await supabase.from("bookings")
          .update({ payment_status: "paid", status: "confirmed" })
          .eq("id", txn.booking_id)
      }

      const { data: rates } = await supabase.from("commission_rates").select("*").single()
      const commissionRate = rates?.provider_commission_rate || 0.10
      const providerProcessingFee = Math.floor(txn.amount * (rates?.provider_processing_rate || 0.01))
      const providerAmount = txn.amount - Math.floor(txn.amount * commissionRate) - providerProcessingFee

      if (txn.provider_id && providerAmount > 0) {
        const { data: sensitive } = await supabase
          .from("profile_sensitive")
          .select("mpesa_number, till_number, preferred_payment_method")
          .eq("id", txn.provider_id)
          .single()

        const phone = sensitive?.mpesa_number || sensitive?.till_number

        if (phone) {
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
              phone,
              narrative: `CCC payout - ${apiRef}`,
            })
          })
        }
      }

      if (txn.customer_id) {
        await supabase.from("notifications").insert({
          user_id: txn.customer_id,
          type: "payment",
          title: "Payment confirmed ✅",
          message: `Your payment of KES ${Number(txn.amount).toLocaleString()} has been received.`,
        })
      }

      if (txn.provider_id) {
        await supabase.from("notifications").insert({
          user_id: txn.provider_id,
          type: "payment",
          title: "Payment received 💰",
          message: `You will receive KES ${providerAmount.toLocaleString()} shortly.`,
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
