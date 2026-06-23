import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

const PESAPAL_CONSUMER_KEY = Deno.env.get("PESAPAL_CONSUMER_KEY") ?? ""
const PESAPAL_CONSUMER_SECRET = Deno.env.get("PESAPAL_CONSUMER_SECRET") ?? ""
const PESAPAL_BASE_URL = "https://pay.pesapal.com/v3"

async function getToken() {
  const res = await fetch(PESAPAL_BASE_URL + "/api/Auth/RequestToken", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Accept": "application/json" },
    body: JSON.stringify({ consumer_key: PESAPAL_CONSUMER_KEY, consumer_secret: PESAPAL_CONSUMER_SECRET })
  })
  const data = await res.json()
  return data.token
}

async function registerIPN(token: string) {
  const res = await fetch(PESAPAL_BASE_URL + "/api/URLSetup/RegisterIPN", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Accept": "application/json", "Authorization": "Bearer " + token },
    body: JSON.stringify({ url: "https://carcareconnect.care/payment/callback", ipn_notification_type: "GET" })
  })
  const data = await res.json()
  return data.ipn_id
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })

  try {
    const { amount, bookingId, customerEmail, customerPhone, customerName } = await req.json()

    const token = await getToken()
    if (!token) throw new Error("Failed to get Pesapal token")

    const ipnId = await registerIPN(token)

    const nameParts = (customerName || "Customer").split(" ")
    const res = await fetch(PESAPAL_BASE_URL + "/api/Transactions/SubmitOrderRequest", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json", "Authorization": "Bearer " + token },
      body: JSON.stringify({
        id: bookingId,
        currency: "KES",
        amount: amount,
        description: "Car Care Connect booking payment",
        callback_url: "https://carcareconnect.care/payment/callback",
        notification_id: ipnId,
        billing_address: {
          email_address: customerEmail || "",
          phone_number: customerPhone || "",
          first_name: nameParts[0] || "",
          last_name: nameParts[1] || "",
          country_code: "KE"
        }
      })
    })

    const data = await res.json()
    return new Response(JSON.stringify(data), { headers: { ...corsHeaders, "Content-Type": "application/json" } })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } })
  }
})

