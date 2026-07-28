import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
  try {
    const { phone, amount, booking_id, provider_id, narrative } = await req.json()
    if (!phone || !amount || !booking_id) throw new Error("phone, amount and booking_id required")

    const CONSUMER_KEY = Deno.env.get("DARAJA_CONSUMER_KEY")!
    const CONSUMER_SECRET = Deno.env.get("DARAJA_CONSUMER_SECRET")!
    const SHORTCODE = Deno.env.get("DARAJA_SHORTCODE") || "4326921"
    const BASE_URL = "https://api.safaricom.co.ke"
    const RESULT_URL = `${Deno.env.get("SUPABASE_URL")}/functions/v1/daraja-callback`
    const TIMEOUT_URL = `${Deno.env.get("SUPABASE_URL")}/functions/v1/daraja-callback`

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

    // Clean narrative
    const cleanNarrative = (narrative || `CCC payout ${booking_id}`).replace(/[^a-zA-Z0-9_ -]/g, " ").substring(0, 100)

    // B2C Payment Request
    const b2cBody = {
      InitiatorName: "BBAKARI",
      SecurityCredential: Deno.env.get("DARAJA_SECURITY_CREDENTIAL") || "",
      CommandID: "BusinessPayment",
      Amount: Math.floor(amount),
      PartyA: SHORTCODE,
      PartyB: formattedPhone,
      Remarks: cleanNarrative,
      QueueTimeOutURL: TIMEOUT_URL,
      ResultURL: RESULT_URL,
      Occassion: "Provider Payout"
    }

    console.log("B2C body:", JSON.stringify(b2cBody))

    const b2cResp = await fetch(`${BASE_URL}/mpesa/b2c/v1/paymentrequest`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${authData.access_token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(b2cBody)
    })

    const b2cData = await b2cResp.json()
    console.log("B2C response:", JSON.stringify(b2cData))

    if (b2cData.ResponseCode !== "0") throw new Error(b2cData.errorMessage || b2cData.ResponseDescription || "B2C failed")

    // Log payout
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    await supabase.from("payment_transactions").insert({
      booking_id,
      provider_id,
      amount,
      phone: formattedPhone,
      status: "pending",
      provider: "daraja",
      payment_method: "daraja_b2c",
      raw_response: b2cData,
      type: "payout"
    })

    return new Response(JSON.stringify({
      success: true,
      conversation_id: b2cData.ConversationID,
      originator_conversation_id: b2cData.OriginatorConversationID,
      message: `B2C payout of KES ${amount} initiated to ${formattedPhone}`
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } })

  } catch (error: any) {
    console.error("B2C payout error:", error.message)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    })
  }
})
