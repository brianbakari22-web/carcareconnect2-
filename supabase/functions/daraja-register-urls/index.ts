import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
  try {
    const CONSUMER_KEY = Deno.env.get("DARAJA_CONSUMER_KEY")!
    const CONSUMER_SECRET = Deno.env.get("DARAJA_CONSUMER_SECRET")!
    const SHORTCODE = Deno.env.get("DARAJA_SHORTCODE") || "4326921"
    const BASE_URL = "https://api.safaricom.co.ke"
    const CALLBACK_URL = `${Deno.env.get("SUPABASE_URL")}/functions/v1/daraja-callback`

    // Get OAuth token
    const credentials = btoa(`${CONSUMER_KEY}:${CONSUMER_SECRET}`)
    const authResp = await fetch(`${BASE_URL}/oauth/v1/generate?grant_type=client_credentials`, {
      method: "GET",
      headers: { "Authorization": `Basic ${credentials}` }
    })
    const authData = await authResp.json()
    if (!authData.access_token) throw new Error("Auth failed: " + JSON.stringify(authData))

    // Register C2B URLs
    const regResp = await fetch(`${BASE_URL}/mpesa/c2b/v2/registerurl`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${authData.access_token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        ShortCode: SHORTCODE,
        ResponseType: "Completed",
        ConfirmationURL: CALLBACK_URL,
        ValidationURL: CALLBACK_URL
      })
    })

    const regData = await regResp.json()
    console.log("Register URLs response:", JSON.stringify(regData))

    return new Response(JSON.stringify({ success: true, response: regData }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    })
  } catch (error: any) {
    console.error("Register URLs error:", error.message)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    })
  }
})
