import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

const PESAPAL_CONSUMER_KEY = Deno.env.get("PESAPAL_CONSUMER_KEY") ?? ""
const PESAPAL_CONSUMER_SECRET = Deno.env.get("PESAPAL_CONSUMER_SECRET") ?? ""
const PESAPAL_BASE_URL = "https://pay.pesapal.com/v3"

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
  try {
    const { trackingId } = await req.json()

    const tokenRes = await fetch(PESAPAL_BASE_URL + "/api/Auth/RequestToken", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({ consumer_key: PESAPAL_CONSUMER_KEY, consumer_secret: PESAPAL_CONSUMER_SECRET })
    })
    const tokenData = await tokenRes.json()
    const token = tokenData.token

    const statusRes = await fetch(PESAPAL_BASE_URL + "/api/Transactions/GetTransactionStatus?orderTrackingId=" + trackingId, {
      headers: { "Accept": "application/json", "Authorization": "Bearer " + token }
    })
    const statusData = await statusRes.json()

    return new Response(JSON.stringify(statusData), { headers: { ...corsHeaders, "Content-Type": "application/json" } })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } })
  }
})
