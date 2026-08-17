import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

function getDistance(lat1, lng1, lat2, lng2) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng/2) * Math.sin(dLng/2)
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL"),
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  )
  try {
    const { booking_id } = await req.json()
    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .select("*")
      .eq("id", booking_id)
      .maybeSingle()
    if (bookingError || !booking) {
      return new Response(JSON.stringify({ error: "Booking not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } })
    }
    if (!booking.is_emergency || booking.provider_id) {
      return new Response(JSON.stringify({ message: "Booking already assigned or not a GO Service request" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } })
    }
    const attempt = (booking.go_attempt_number || 0) + 1
    const MAX_ATTEMPTS = 5
    const { data: tried } = await supabase
      .from("go_service_requests")
      .select("provider_id")
      .eq("booking_id", booking_id)
    const triedIds = (tried || []).map(t => t.provider_id)
    if (attempt > MAX_ATTEMPTS) {
      const calloutFee = Number(booking.go_callout_fee || 0)
      if (calloutFee > 0) {
        try {
          const { data: custSens } = await supabase.from("profile_sensitive").select("phone, mpesa_number").eq("id", booking.customer_id).maybeSingle()
          const custPhone = custSens?.mpesa_number || custSens?.phone
          if (custPhone) {
            await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/daraja-b2c-payout`, {
              method: "POST",
              headers: { "Content-Type": "application/json", "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
              body: JSON.stringify({ phone: custPhone, amount: calloutFee, narrative: `GO Service refund ${booking.booking_number}`, booking_id: booking.id, provider_id: booking.customer_id })
            })
          }
        } catch (e) {
          await supabase.from("failed_jobs").insert({ job_type: "go_service_refund", error_message: e.message, payload: { booking_id: booking.id }, status: "failed" })
        }
      }
      await supabase.from("bookings").update({ status: "cancelled", go_attempt_number: attempt }).eq("id", booking_id)
      await supabase.from("notifications").insert({
        user_id: booking.customer_id,
        title: "No providers available 😔",
        message: `We couldn't find an available provider for your emergency request. Your callout fee of KES ${calloutFee.toLocaleString()} has been refunded.`,
        type: "warning"
      })
      return new Response(JSON.stringify({ message: "No provider found - refund issued" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } })
    }
    const { data: candidates, error: candErr } = await supabase
      .from("services")
      .select("id, provider_id, price, profiles!services_provider_id_fkey(id, latitude, longitude, go_service_radius_km, is_online, is_active, is_verified)")
      .eq("id", booking.service_id)
      .eq("is_active", true)
    console.log("CANDIDATES QUERY:", { service_id: booking.service_id, candidates, candErr })
    let eligible = (candidates || [])
      .filter(c => c.profiles && c.profiles.is_active && c.profiles.is_online && c.profiles.is_verified && !triedIds.includes(c.provider_id))
    console.log("ELIGIBLE AFTER FIRST FILTER:", eligible.length, "triedIds:", triedIds)
    if (eligible.length === 0) {
      const { data: broaderCandidates, error: broadErr } = await supabase
        .from("services")
        .select("id, provider_id, price, profiles!services_provider_id_fkey(id, latitude, longitude, go_service_radius_km, is_online, is_active, is_verified)")
        .eq("category", "go_service")
        .eq("is_active", true)
      console.log("BROADER CANDIDATES QUERY:", { broaderCandidates, broadErr })
      eligible = (broaderCandidates || [])
        .filter(c => c.profiles && c.profiles.is_active && c.profiles.is_online && c.profiles.is_verified && !triedIds.includes(c.provider_id))
      console.log("ELIGIBLE AFTER BROADER FILTER:", eligible.length)
    }
    if (eligible.length) {
      const { data: availableMechs } = await supabase
        .from("mechanics")
        .select("provider_id")
        .in("provider_id", eligible.map(e => e.provider_id))
        .eq("is_active", true)
        .eq("is_available", true)
      const providersWithMechanics = new Set((availableMechs || []).map(m => m.provider_id))
      eligible = eligible.filter(e => providersWithMechanics.has(e.provider_id))
    }
    if (!eligible.length) {
      await supabase.from("bookings").update({ go_attempt_number: attempt }).eq("id", booking_id)
      await supabase.from("notifications").insert({
        user_id: booking.customer_id,
        title: "Finding a provider... 🔍",
        message: `Attempt ${attempt}/${MAX_ATTEMPTS}: No providers online right now. We'll keep trying.`,
        type: "info"
      })
      return new Response(JSON.stringify({ version: "2026-08-17-DISPATCH-01", message: "No providers online, will retry", eligible_count: eligible.length }), { headers: { ...corsHeaders, "Content-Type": "application/json" } })
    }
    const custLat = booking.emergency_location_lat
    const custLng = booking.emergency_location_lng
    eligible.sort((a, b) => {
      const distA = a.profiles.latitude && a.profiles.longitude && custLat && custLng ? getDistance(custLat, custLng, a.profiles.latitude, a.profiles.longitude) : 999
      const distB = b.profiles.latitude && b.profiles.longitude && custLat && custLng ? getDistance(custLat, custLng, b.profiles.latitude, b.profiles.longitude) : 999
      return distA - distB
    })
    const nearest = eligible[0]
    const distance = nearest.profiles.latitude && nearest.profiles.longitude && custLat && custLng
      ? Math.round(getDistance(custLat, custLng, nearest.profiles.latitude, nearest.profiles.longitude) * 10) / 10
      : null
    const expiresAt = new Date(Date.now() + 15*60*1000).toISOString()
    await supabase.from("bookings").update({
      go_attempt_number: attempt,
      go_service_fee: Number(nearest.price),
      provider_id: nearest.provider_id,
    }).eq("id", booking_id)
    const { error: reqError } = await supabase.from("go_service_requests").insert({
      booking_id: booking.id,
      provider_id: nearest.provider_id,
      status: "pending",
      attempt_number: attempt,
    })
    if (reqError) {
      await supabase.from("failed_jobs").insert({ job_type: "go_service_request_create", error_message: reqError.message, payload: { booking_id: booking.id, provider_id: nearest.provider_id }, status: "failed" })
      return new Response(JSON.stringify({ error: "Failed to create request", detail: reqError.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } })
    }
    await supabase.from("notifications").insert({
      user_id: nearest.provider_id,
      title: "🚨 Emergency GO Service request! (Attempt " + attempt + "/" + MAX_ATTEMPTS + ")",
      message: `${booking.emergency_type ? booking.emergency_type.replace(/_/g," ") : "Emergency"} nearby${distance ? " - " + distance + "km away" : ""}. You have 15 minutes to accept.`,
      type: "error"
    })
    await supabase.from("notifications").insert({
      user_id: booking.customer_id,
      title: "Finding your provider... 🔍",
      message: `Attempt ${attempt}/${MAX_ATTEMPTS}: We found a nearby provider and sent them your request.`,
      type: "info"
    })
    return new Response(JSON.stringify({
      version: "2026-08-17-DISPATCH-01",
      message: "Provider offered job",
      provider_id: nearest.provider_id,
      attempt,
      expires_at: expiresAt,
      distance_km: distance,
      request_created: !reqError
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } })
  } catch (err) {
    console.error("Error:", err.message)
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } })
  }
})
