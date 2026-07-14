import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://carcareconnect.care",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

const CONSUMER_KEY = Deno.env.get("DARAJA_CONSUMER_KEY") ?? ""
const CONSUMER_SECRET = Deno.env.get("DARAJA_CONSUMER_SECRET") ?? ""
const SHORTCODE = Deno.env.get("DARAJA_SHORTCODE") ?? "174379"
const PASSKEY = Deno.env.get("DARAJA_PASSKEY") ?? ""
const DARAJA_ENV = Deno.env.get("DARAJA_ENV") ?? "sandbox"
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? ""
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""

const BASE_URL = DARAJA_ENV === "production"
  ? "https://api.safaricom.co.ke"
  : "https://sandbox.safaricom.co.ke"

async function getAccessToken() {
  const credentials = btoa(`${CONSUMER_KEY}:${CONSUMER_SECRET}`)
  const res = await fetch(`${BASE_URL}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { "Authorization": `Basic ${credentials}` }
  })
  const data = await res.json()
  return data.access_token
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } })

  try {
    // Verify caller is authenticated
    const authHeader = req.headers.get("Authorization")
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } })

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""))
    if (authError || !user) return new Response(JSON.stringify({ error: "Invalid session" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } })

    const { phone, amount, bookingId, orderId, description } = await req.json()

    // Validate inputs
    if (!phone || !amount) return new Response(JSON.stringify({ error: "Phone and amount required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } })

    const parsedAmount = Math.round(parseFloat(amount))
    if (isNaN(parsedAmount) || parsedAmount < 1 || parsedAmount > 500000) {
      return new Response(JSON.stringify({ error: "Invalid amount" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } })
    }

    // Format phone number to 254XXXXXXXXX
    let formattedPhone = phone.replace(/[^0-9]/g, "")
    if (formattedPhone.startsWith("0")) formattedPhone = "254" + formattedPhone.slice(1)
    if (formattedPhone.startsWith("+")) formattedPhone = formattedPhone.slice(1)
    if (!formattedPhone.startsWith("254")) formattedPhone = "254" + formattedPhone

    // Generate timestamp and password
    const timestamp = new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 14)
    const password = btoa(`${SHORTCODE}${PASSKEY}${timestamp}`)

    // Get access token
    const token = await getAccessToken()
    if (!token) throw new Error("Failed to get Daraja access token")

    // Reference ID
    const refId = bookingId || orderId || `CCC-${Date.now()}`

    // STK Push request
    const stkRes = await fetch(`${BASE_URL}/mpesa/stkpush/v1/processrequest`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        BusinessShortCode: SHORTCODE,
        Password: password,
        Timestamp: timestamp,
        TransactionType: "CustomerPayBillOnline",
        Amount: parsedAmount,
        PartyA: formattedPhone,
        PartyB: SHORTCODE,
        PhoneNumber: formattedPhone,
        CallBackURL: "https://gcnefnqtjxtqbhynyoxe.supabase.co/functions/v1/daraja-callback",
        AccountReference: refId,
        TransactionDesc: description || "Car Care Connect Payment"
      })
    })

    const stkData = await stkRes.json()
    console.log("STK Push response:", JSON.stringify(stkData))

    if (stkData.ResponseCode === "0") {
      // Save pending transaction to DB
      await supabase.from("payment_transactions").upsert({
        user_id: user.id,
        booking_id: bookingId || null,
        order_id: orderId || null,
        amount: parsedAmount,
        phone: formattedPhone,
        checkout_request_id: stkData.CheckoutRequestID,
        merchant_request_id: stkData.MerchantRequestID,
        status: "pending",
        provider: "daraja",
        description: description || "Car Care Connect Payment",
        created_at: new Date().toISOString()
      }, { onConflict: "checkout_request_id" })
    }

    return new Response(JSON.stringify(stkData), { headers: { ...corsHeaders, "Content-Type": "application/json" } })

  } catch (error) {
    console.error("STK Push error:", error.message)
    return new Response(JSON.stringify({ error: "Payment initiation failed" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } })
  }
})
