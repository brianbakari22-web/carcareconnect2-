import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://carcareconnect.care",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

const PESAPAL_CONSUMER_KEY = Deno.env.get("PESAPAL_CONSUMER_KEY") ?? ""
const PESAPAL_CONSUMER_SECRET = Deno.env.get("PESAPAL_CONSUMER_SECRET") ?? ""
const PESAPAL_BASE_URL = "https://pay.pesapal.com/v3"
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? ""
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""

// Valid amount ranges per service type (KES)
const AMOUNT_LIMITS = { min: 10, max: 500000 }

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

  // Only allow POST
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { 
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } 
    })
  }

  try {
    // 1. Verify the caller is authenticated
    const authHeader = req.headers.get("Authorization")
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { 
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } 
      })
    }

    // 2. Verify user session
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    const token = authHeader.replace("Bearer ", "")
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid session" }), { 
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } 
      })
    }

    const { amount, bookingId, customerEmail, customerPhone, customerName, orderId } = await req.json()

    // 3. Validate amount
    const parsedAmount = parseFloat(amount)
    if (isNaN(parsedAmount) || parsedAmount < AMOUNT_LIMITS.min || parsedAmount > AMOUNT_LIMITS.max) {
      return new Response(JSON.stringify({ error: "Invalid amount" }), { 
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } 
      })
    }

    // 4. Validate bookingId exists and belongs to this user
    if (bookingId) {
      const { data: booking } = await supabase.from("bookings")
        .select("id, customer_id, total_amount, payment_status")
        .eq("id", bookingId)
        .single()
      
      if (!booking) {
        return new Response(JSON.stringify({ error: "Booking not found" }), { 
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } 
        })
      }
      if (booking.customer_id !== user.id) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { 
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } 
        })
      }
      if (booking.payment_status === "paid") {
        return new Response(JSON.stringify({ error: "Already paid" }), { 
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } 
        })
      }
    }

    // 5. Sanitize inputs
    const sanitize = (str: string) => str?.replace(/[<>'"]/g, "").trim().substring(0, 100) || ""
    const safeEmail = sanitize(customerEmail).toLowerCase()
    const safePhone = (customerPhone || "").replace(/[^0-9+]/g, "").substring(0, 15)
    const safeName = sanitize(customerName)
    const nameParts = safeName.split(" ")

    const pesapalToken = await getToken()
    if (!pesapalToken) throw new Error("Failed to get Pesapal token")
    const ipnId = await registerIPN(pesapalToken)

    const refId = bookingId || orderId || `CCC-${Date.now()}`
    const res = await fetch(PESAPAL_BASE_URL + "/api/Transactions/SubmitOrderRequest", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json", "Authorization": "Bearer " + pesapalToken },
      body: JSON.stringify({
        id: refId,
        currency: "KES",
        amount: parsedAmount,
        description: "Car Care Connect payment",
        callback_url: "https://carcareconnect.care/payment/callback",
        notification_id: ipnId,
        billing_address: {
          email_address: safeEmail,
          phone_number: safePhone,
          first_name: nameParts[0] || "",
          last_name: nameParts[1] || "",
          country_code: "KE"
        }
      })
    })
    const data = await res.json()
    return new Response(JSON.stringify(data), { headers: { ...corsHeaders, "Content-Type": "application/json" } })

  } catch (error) {
    console.error("pesapal-payment error:", error.message)
    return new Response(JSON.stringify({ error: "Payment processing failed" }), { 
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } 
    })
  }
})
