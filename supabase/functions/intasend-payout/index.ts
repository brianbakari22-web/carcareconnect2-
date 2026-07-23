import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
  try {
    const { booking_id, provider_id, amount, phone, narrative, payment_method, paybill_account } = await req.json()
    const INTASEND_SECRET_KEY = Deno.env.get("INTASEND_SECRET_KEY")
    const INTASEND_ENV = Deno.env.get("INTASEND_ENV") || "sandbox"
    const BASE_URL = INTASEND_ENV === "production"
      ? "https://payment.intasend.com"
      : "https://sandbox.intasend.com"

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    )

    // Format phone/account number
    let formattedAccount = phone.replace(/\s/g, "")
    if (formattedAccount.startsWith("0")) formattedAccount = "254" + formattedAccount.slice(1)
    if (formattedAccount.startsWith("+")) formattedAccount = formattedAccount.slice(1)

    // Determine endpoint based on payment method
    const method = payment_method || "mpesa"
    let endpoint = ""
    let body: any = {
      currency: "KES",
      transactions: [{
        name: "Provider",
        account: formattedAccount,
        amount: amount,
        narrative: narrative || `CCC payout for booking ${booking_id}`,
      }]
    }

    if (method === "till") {
      endpoint = `${BASE_URL}/api/v1/send-money/till/`
    } else if (method === "paybill") {
      endpoint = `${BASE_URL}/api/v1/send-money/paybill/`
      // Paybill needs account number
      body.transactions[0].account_number = paybill_account || "000"
    } else if (method === "pochi") {
      endpoint = `${BASE_URL}/api/v1/send-money/mpesa/`
      // Pochi la biashara uses same endpoint as M-Pesa
    } else {
      // Default: M-Pesa
      endpoint = `${BASE_URL}/api/v1/send-money/mpesa/`
    }

    console.log(`Payout via ${method} to ${formattedAccount}, amount: ${amount}`)

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${INTASEND_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body)
    })

    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.detail || JSON.stringify(data) || "Payout failed")
    }

    // Log payout
    await supabase.from("payment_transactions").insert({
      booking_id,
      provider_id,
      amount,
      payment_method: `intasend_${method}`,
      status: "pending",
      intasend_ref: data.tracking_id || data.id,
      raw_response: data,
      type: "payout",
    })

    console.log("Payout initiated:", JSON.stringify(data))
    return new Response(JSON.stringify({
      success: true,
      tracking_id: data.tracking_id || data.id,
      message: `Payout of KES ${amount} initiated via ${method} to ${formattedAccount}`,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } })

  } catch (error: any) {
    console.error("Payout error:", error.message)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    })
  }
})
