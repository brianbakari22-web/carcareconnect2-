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
const DARAJA_ENV = Deno.env.get("DARAJA_ENV") ?? "sandbox"
const INITIATOR_NAME = Deno.env.get("DARAJA_INITIATOR_NAME") ?? "testapi"
const INITIATOR_PASSWORD = Deno.env.get("DARAJA_INITIATOR_PASSWORD") ?? "Safaricom999!*!"
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
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    const body = await req.json()
    const { bookingId, auto } = body

    // For auto triggers from DB, skip auth check
    // For manual admin triggers, verify admin role
    if (!auto) {
      const authHeader = req.headers.get("Authorization")
      if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } })
      const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""))
      if (authError || !user) return new Response(JSON.stringify({ error: "Invalid session" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } })
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
      if (profile?.role !== "admin") return new Response(JSON.stringify({ error: "Admin only" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } })
    }

    if (!bookingId) return new Response(JSON.stringify({ error: "bookingId required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } })

    // Get booking with provider details
    const { data: booking } = await supabase.from("bookings")
      .select("*, provider:profiles!bookings_provider_id_fkey(id, provider_type, first_name, last_name)")
      .eq("id", bookingId)
      .single()

    // Get provider phone from profile_sensitive
    const { data: providerSensitive } = await supabase.from("profile_sensitive")
      .select("phone, mpesa_number")
      .eq("id", booking?.provider_id)
      .single()

    if (!booking) return new Response(JSON.stringify({ error: "Booking not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } })
    if (booking.payment_status !== "paid") return new Response(JSON.stringify({ error: "Booking not paid" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } })
    if (booking.provider_payout_status === "paid") return new Response(JSON.stringify({ error: "Already paid" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } })

    // Get live commission rate
    const { data: commissionRate } = await supabase.from("commission_rates")
      .select("platform_rate, provider_rate")
      .eq("provider_type", booking.provider?.provider_type)
      .single()

    const platformRate = parseFloat(commissionRate?.platform_rate || 0.10)
    const providerRate = parseFloat(commissionRate?.provider_rate || 0.90)
    const totalAmount = parseFloat(booking.total_amount)
    const providerAmount = Math.round(totalAmount * providerRate)
    const platformAmount = Math.round(totalAmount * platformRate)

    // Format provider phone - use mpesa_number first, fallback to phone
    const rawPhone = providerSensitive?.mpesa_number || providerSensitive?.phone || ""
    let phone = rawPhone.replace(/[^0-9]/g, "")
    if (phone.startsWith("0")) phone = "254" + phone.slice(1)
    if (!phone.startsWith("254")) phone = "254" + phone
    if (!phone || phone.length < 12) return new Response(JSON.stringify({ error: "Invalid provider phone" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } })

    // Get access token
    const token = await getAccessToken()
    if (!token) throw new Error("Failed to get Daraja token")

    // B2C payout
    const b2cRes = await fetch(`${BASE_URL}/mpesa/b2c/v3/paymentrequest`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        OriginatorConversationID: `CCC-PAYOUT-${bookingId}-${Date.now()}`,
        InitiatorName: INITIATOR_NAME,
        SecurityCredential: INITIATOR_PASSWORD,
        CommandID: "BusinessPayment",
        Amount: providerAmount,
        PartyA: SHORTCODE,
        PartyB: phone,
        Remarks: `CCC payout booking ${booking.booking_number || bookingId}`,
        QueueTimeOutURL: `${SUPABASE_URL}/functions/v1/daraja-b2c-callback`,
        ResultURL: `${SUPABASE_URL}/functions/v1/daraja-b2c-callback`,
        Occasion: `Booking ${booking.booking_number || bookingId}`
      })
    })

    const b2cData = await b2cRes.json()
    console.log("B2C response:", JSON.stringify(b2cData))

    if (b2cData.ResponseCode === "0") {
      // Update booking payout status
      await supabase.from("bookings").update({
        provider_payout_status: "processing",
        provider_payout_amount: providerAmount,
        platform_commission: platformAmount,
        provider_payout_initiated_at: new Date().toISOString()
      }).eq("id", bookingId)

      // Notify provider
      await supabase.from("notifications").insert({
        user_id: booking.provider_id,
        type: "payment",
        title: "Payment incoming! 💰",
        message: `KES ${providerAmount.toLocaleString()} is being sent to your M-Pesa for booking #${booking.booking_number}`,
        data: { booking_id: bookingId }
      })

      // Audit log
      await supabase.from("ccc_audit_log").insert({
        user_id: booking.provider_id,
        action: "payout.processed",
        entity_type: "booking",
        entity_id: bookingId,
        new_data: { provider_amount: providerAmount, platform_amount: platformAmount, auto }
      })
    }

    return new Response(JSON.stringify({
      success: b2cData.ResponseCode === "0",
      providerAmount,
      platformAmount,
      platformRate: `${(platformRate*100).toFixed(0)}%`,
      providerRate: `${(providerRate*100).toFixed(0)}%`,
      response: b2cData
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } })

  } catch (error) {
    console.error("B2C error:", error.message)
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } })
  }
})
