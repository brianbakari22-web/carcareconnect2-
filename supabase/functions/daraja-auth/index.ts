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
    const BASE_URL = "https://api.safaricom.co.ke"

    const credentials = btoa(`${CONSUMER_KEY}:${CONSUMER_SECRET}`)
    const response = await fetch(`${BASE_URL}/oauth/v1/generate?grant_type=client_credentials`, {
      method: "GET",
      headers: {
        "Authorization": `Basic ${credentials}`,
        "Content-Type": "application/json",
      }
    })

    const data = await response.json()
    console.log("Auth response:", JSON.stringify(data))

    if (!data.access_token) throw new Error("Failed to get access token: " + JSON.stringify(data))

    return new Response(JSON.stringify({ access_token: data.access_token, expires_in: data.expires_in }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    })
  } catch (error: any) {
    console.error("Daraja auth error:", error.message)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    })
  }
})
