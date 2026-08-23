import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
  let proxyFallbackHappened = false
  try {
    const { phone, amount, booking_id, provider_id, narrative, payment_method, account_reference } = await req.json()
    if (!phone || !amount || !booking_id) throw new Error("phone, amount and booking_id required")

    // Genuinely optional static-IP proxy, toggled via app_settings.daraja_b2c_use_proxy -
    // an admin can flip this off instantly if the proxy server ever has issues, reverting
    // to calling Safaricom directly with zero code change or redeploy needed.
    const earlySupabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { autoRefreshToken: false, persistSession: false }
    })
    const { data: proxySetting } = await earlySupabase.from("app_settings").select("value").eq("key", "daraja_b2c_use_proxy").maybeSingle()
    const useProxy = proxySetting?.value === "true"
    const proxyUrl = Deno.env.get("DARAJA_PROXY_URL")
    const httpClient = (useProxy && proxyUrl) ? Deno.createHttpClient({ proxy: { url: proxyUrl } }) : undefined
    console.log("Daraja B2C proxy routing:", useProxy ? "ENABLED" : "disabled (calling Safaricom directly)")
    // Tries the proxy first (when enabled). If that fails at the network level - proxy
    // server down, unreachable, etc, NOT a Safaricom-side error response - falls back
    // to a direct call so a temporary proxy issue doesn't block a real payout outright.
    async function fetchWithFallback(url: string, options: RequestInit) {
      if (!httpClient) return fetch(url, options)
      try {
        return await fetch(url, { ...options, client: httpClient } as any)
      } catch (proxyErr) {
        console.error("Proxy call failed, falling back to direct:", proxyErr)
        proxyFallbackHappened = true
        return await fetch(url, options)
      }
    }

    const CONSUMER_KEY = Deno.env.get("DARAJA_CONSUMER_KEY")!
    const CONSUMER_SECRET = Deno.env.get("DARAJA_CONSUMER_SECRET")!
    const SHORTCODE = Deno.env.get("DARAJA_SHORTCODE") || "4326921"
    const BASE_URL = "https://api.safaricom.co.ke"
    const RESULT_URL = `${Deno.env.get("SUPABASE_URL")}/functions/v1/daraja-callback`
    const TIMEOUT_URL = `${Deno.env.get("SUPABASE_URL")}/functions/v1/daraja-callback`

    // Format phone (only relevant for standard B2C to a personal number)
    let formattedPhone = String(phone).replace(/\s/g, "")
    if (formattedPhone.startsWith("0")) formattedPhone = "254" + formattedPhone.slice(1)
    if (formattedPhone.startsWith("+")) formattedPhone = formattedPhone.slice(1)

    // Get OAuth token
    const credentials = btoa(`${CONSUMER_KEY}:${CONSUMER_SECRET}`)
    const authResp = await fetchWithFallback(`${BASE_URL}/oauth/v1/generate?grant_type=client_credentials`, {
      method: "GET",
      headers: { "Authorization": `Basic ${credentials}` }
    })
    const authData = await authResp.json()
    if (!authData.access_token) throw new Error("Auth failed: " + JSON.stringify(authData))

    const cleanNarrative = (narrative || `CCC payout ${booking_id}`).replace(/[^a-zA-Z0-9_ -]/g, " ").substring(0, 100)

    // Route by payment method - PartyB and CommandID differ per method.
    // "mpesa" (personal number) requires standard B2C approval from Safaricom (pending as of this writing).
    // "till" and "paybill" use B2B, which is already enabled on this account.
    // "pochi" is not wired here yet - needs the exact Business To Pochi endpoint/spec confirmed in Daraja docs.
    let commandId: string
    let partyB: string
    let endpoint: string
    let extraFields: Record<string, any> = {}

    const method = (payment_method || "mpesa").toLowerCase()

    if (method === "till") {
      commandId = "BusinessBuyGoods"
      partyB = String(phone).replace(/\s/g, "")
      endpoint = `${BASE_URL}/mpesa/b2b/v1/paymentrequest`
      extraFields = {
        SenderIdentifierType: "4",
        RecieverIdentifierType: "4",
      }
    } else if (method === "paybill") {
      commandId = "BusinessPayBill"
      partyB = String(phone).replace(/\s/g, "")
      endpoint = `${BASE_URL}/mpesa/b2b/v1/paymentrequest`
      extraFields = {
        SenderIdentifierType: "4",
        RecieverIdentifierType: "4",
        AccountReference: account_reference || booking_id,
      }
    } else if (method === "pochi") {
      // Not implemented yet - Business To Pochi uses a different request shape
      // that hasn't been confirmed. Fail clearly instead of guessing.
      throw new Error("Pochi payout routing not yet implemented - check Daraja docs for Business To Pochi request format")
    } else {
      // Standard B2C to a personal M-Pesa number - requires Safaricom B2C product approval
      commandId = "BusinessPayment"
      partyB = formattedPhone
      endpoint = `${BASE_URL}/mpesa/b2c/v1/paymentrequest`
    }

    const isB2B = method === "till" || method === "paybill"
    const initiatorFieldName = isB2B ? "Initiator" : "InitiatorName"
    const payBody: Record<string, any> = {
      [initiatorFieldName]: Deno.env.get("DARAJA_INITIATOR_NAME") || "CCCAPI",
      SecurityCredential: Deno.env.get("DARAJA_SECURITY_CREDENTIAL") || "",
      CommandID: commandId,
      Amount: Math.round(amount),
      PartyA: SHORTCODE,
      PartyB: partyB,
      Remarks: cleanNarrative,
      QueueTimeOutURL: TIMEOUT_URL,
      ResultURL: RESULT_URL,
      Occassion: "Provider Payout",
      ...extraFields,
    }

    console.log("Payout body:", JSON.stringify({ ...payBody, SecurityCredential: "[redacted]" }))
    const payResp = await fetchWithFallback(endpoint, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${authData.access_token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payBody)
    })
    const payData = await payResp.json()
    console.log("Payout response:", JSON.stringify(payData))
    if (payData.ResponseCode !== "0") throw new Error(payData.errorMessage || payData.ResponseDescription || "Payout failed")

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { autoRefreshToken: false, persistSession: false }
    })
    await supabase.from("payment_transactions").insert({
      booking_id,
      provider_id,
      amount,
      phone: partyB,
      status: "pending",
      provider: "daraja",
      payment_method: `daraja_${method}`,
      raw_response: payData,
      type: "payout"
    })

    if (proxyFallbackHappened) {
      const { data: admins } = await supabase.from("profiles").select("id").eq("role", "admin")
      for (const admin of admins || []) {
        await supabase.from("notifications").insert({
          user_id: admin.id,
          title: "Daraja proxy fallback used ⚠️",
          message: "A B2C payout succeeded, but the static-IP proxy was unreachable and the call fell back to a direct connection. Check the proxy server.",
          type: "warning"
        })
      }
    }

    return new Response(JSON.stringify({
      success: true,
      conversation_id: payData.ConversationID,
      originator_conversation_id: payData.OriginatorConversationID,
      message: `Payout of KES ${amount} initiated to ${partyB} via ${method}`
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } })
  } catch (error: any) {
    console.error("Payout error:", error.message)
    try {
      const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
        auth: { autoRefreshToken: false, persistSession: false }
      })
      const body = await req.clone().json().catch(() => ({}))
      await supabase.from("failed_jobs").insert({
        job_type: "b2c_payout",
        error_message: error.message,
        payload: body,
        status: "failed"
      })
      if (proxyFallbackHappened) {
        const { data: admins } = await supabase.from("profiles").select("id").eq("role", "admin")
        for (const admin of admins || []) {
          await supabase.from("notifications").insert({
            user_id: admin.id,
            title: "Daraja proxy fallback + payout failed ⚠️",
            message: "A B2C payout failed after the static-IP proxy was unreachable and fell back to a direct connection, which also failed. Check the proxy server and the error in Failed Jobs.",
            type: "error"
          })
        }
      }
    } catch (logErr) { console.error("Failed to log to failed_jobs:", logErr) }
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    })
  }
})

