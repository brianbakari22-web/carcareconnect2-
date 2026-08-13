import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
  try {
    const { phone, amount, booking_id, account_ref, description } = await req.json()
    if (!phone || !amount || !booking_id) throw new Error("phone, amount and booking_id required")

    const CONSUMER_KEY = Deno.env.get("DARAJA_CONSUMER_KEY")!
    const CONSUMER_SECRET = Deno.env.get("DARAJA_CONSUMER_SECRET")!
    const SHORTCODE = Deno.env.get("DARAJA_SHORTCODE") || "4326921"
    const PASSKEY = Deno.env.get("DARAJA_PASSKEY")!
    const BASE_URL = "https://api.safaricom.co.ke"
    const CALLBACK_URL = `${Deno.env.get("SUPABASE_URL")}/functions/v1/daraja-callback`

    // Format phone
    let formattedPhone = phone.replace(/\s/g, "")
    if (formattedPhone.startsWith("0")) formattedPhone = "254" + formattedPhone.slice(1)
    if (formattedPhone.startsWith("+")) formattedPhone = formattedPhone.slice(1)

    // Get OAuth token
    const credentials = btoa(`${CONSUMER_KEY}:${CONSUMER_SECRET}`)
    const authResp = await fetch(`${BASE_URL}/oauth/v1/generate?grant_type=client_credentials`, {
      method: "GET",
      headers: { "Authorization": `Basic ${credentials}` }
    })
    const authData = await authResp.json()
    if (!authData.access_token) throw new Error("Auth failed: " + JSON.stringify(authData))

    // Generate timestamp and password
    const timestamp = new Date().toISOString().replace(/[-T:.Z]/g, "").slice(0, 14)
    const password = btoa(`${SHORTCODE}${PASSKEY}${timestamp}`)

    // STK Push
    const stkBody = {
      BusinessShortCode: SHORTCODE,
      Password: password,
      Timestamp: timestamp,
      TransactionType: "CustomerPayBillOnline",
      Amount: Math.round(amount),
      PartyA: formattedPhone,
      PartyB: SHORTCODE,
      PhoneNumber: formattedPhone,
      CallBackURL: CALLBACK_URL,
      AccountReference: account_ref || booking_id.substring(0, 12),
      TransactionDesc: description || "CCC Payment"
    }

    console.log("STK Push body:", JSON.stringify(stkBody))

    const stkResp = await fetch(`${BASE_URL}/mpesa/stkpush/v1/processrequest`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${authData.access_token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(stkBody)
    })

    const stkData = await stkResp.json()
    console.log("STK Push response:", JSON.stringify(stkData))

    if (stkData.ResponseCode !== "0") throw new Error(stkData.errorMessage || stkData.ResponseDescription || "STK Push failed")

    // Save to payment_transactions
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    await supabase.from("payment_transactions").insert({
      booking_id,
      amount,
      phone: formattedPhone,
      status: "pending",
      provider: "daraja",
      payment_method: "daraja_stk",
      checkout_request_id: stkData.CheckoutRequestID,
      merchant_request_id: stkData.MerchantRequestID,
      raw_response: stkData,
      type: "collection"
    })

    return new Response(JSON.stringify({
      success: true,
      checkout_request_id: stkData.CheckoutRequestID,
      merchant_request_id: stkData.MerchantRequestID,
      message: "STK Push sent to " + formattedPhone
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } })

  } catch (error: any) {
    console.error("STK Push error:", error.message)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    })
  }
})
