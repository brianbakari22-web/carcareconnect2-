import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? ""
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""

// CARTRACK KENYA API
async function getCartrackLocation(username: string, password: string, vehicleId: string) {
  const credentials = btoa(`${username}:${password}`)
  const res = await fetch(`https://fleetapi-ke.cartrack.com/rest/vehicles/${vehicleId}/status`, {
    headers: { "Accept": "application/json", "Authorization": `Basic ${credentials}` }
  })
  if (!res.ok) throw new Error(`Cartrack error: ${res.status}`)
  const data = await res.json()
  return {
    lat: data.latitude || data.lat || data.position?.latitude,
    lng: data.longitude || data.lon || data.position?.longitude,
    speed: data.speed || 0,
    timestamp: data.timestamp || new Date().toISOString()
  }
}

// ITRACK.LIVE API
async function getItrackLocation(apiKey: string, vehicleId: string) {
  const res = await fetch(`https://api.itrack.live/tracker/get_state?tracker_id=${vehicleId}`, {
    headers: { "Accept": "application/json", "Authorization": `Key ${apiKey}` }
  })
  if (!res.ok) throw new Error(`iTrack error: ${res.status}`)
  const data = await res.json()
  const state = data.state || data
  return {
    lat: state.gps?.lat || state.lat,
    lng: state.gps?.lng || state.lng,
    speed: state.gps?.speed || 0,
    timestamp: state.gps?.updated || new Date().toISOString()
  }
}

// ITRACE AFRICA API  
async function getItraceLocation(apiKey: string, vehicleId: string) {
  const res = await fetch(`https://api.itraceafrica.com/v1/vehicles/${vehicleId}/position`, {
    headers: { "Accept": "application/json", "X-API-Key": apiKey }
  })
  if (!res.ok) throw new Error(`iTrace error: ${res.status}`)
  const data = await res.json()
  return {
    lat: data.latitude || data.lat,
    lng: data.longitude || data.lng,
    speed: data.speed || 0,
    timestamp: data.timestamp || new Date().toISOString()
  }
}

async function getTrackerLocation(provider: string, apiKey: string, apiSecret: string, vehicleId: string) {
  switch(provider) {
    case "cartrack": return await getCartrackLocation(apiKey, apiSecret, vehicleId)
    case "itrack": return await getItrackLocation(apiKey, vehicleId)
    case "itrace": return await getItraceLocation(apiKey, vehicleId)
    default: throw new Error(`Provider ${provider} not yet supported`)
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    const { data: trackers } = await supabase.from("vehicle_trackers").select("*").eq("is_active", true)
    const results = []
    for (const tracker of (trackers || [])) {
      try {
        const location = await getTrackerLocation(tracker.provider, tracker.api_key, tracker.api_secret || "", tracker.vehicle_identifier)
        if (location.lat && location.lng) {
          // Update last known location
          await supabase.from("vehicle_trackers").update({
            last_lat: location.lat, last_lng: location.lng, last_seen: new Date().toISOString()
          }).eq("id", tracker.id)
          // Check for active booking
          const { data: activeBooking } = await supabase.from("bookings")
            .select("id,driver_id").eq("customer_id", tracker.customer_id)
            .in("status", ["confirmed","in-progress","driver-assigned"]).maybeSingle()
          if (activeBooking?.id) {
            // Log tracker GPS point
            await supabase.from("booking_location_logs").insert({
              booking_id: activeBooking.id, driver_id: activeBooking.driver_id,
              lat: location.lat, lng: location.lng, source: "tracker"
            })
            // Check divergence with driver GPS
            const { data: driverStatus } = await supabase.from("driver_status")
              .select("current_lat,current_lng").eq("driver_id", activeBooking.driver_id).maybeSingle()
            if (driverStatus?.current_lat) {
              const R = 6371
              const dLat = (location.lat - driverStatus.current_lat) * Math.PI/180
              const dLng = (location.lng - driverStatus.current_lng) * Math.PI/180
              const a = Math.sin(dLat/2)**2 + Math.cos(driverStatus.current_lat*Math.PI/180)*Math.cos(location.lat*Math.PI/180)*Math.sin(dLng/2)**2
              const distance = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
              if (distance > 0.5) {
                // Alert customer
                await supabase.from("notifications").insert({
                  user_id: tracker.customer_id,
                  title: "⚠️ Vehicle location alert",
                  message: `Your vehicle tracker shows a different location than your driver GPS (${distance.toFixed(1)}km apart). Contact your driver immediately.`,
                  type: "error"
                })
                // Alert admins
                const { data: admins } = await supabase.from("profiles").select("id").eq("role","admin")
                for (const admin of (admins||[])) {
                  await supabase.from("notifications").insert({
                    user_id: admin.id,
                    title: "⚠️ Driver-Tracker divergence",
                    message: `Booking ${activeBooking.id}: Driver GPS and vehicle tracker are ${distance.toFixed(1)}km apart.`,
                    type: "error"
                  })
                }
              }
            }
          }
          results.push({ tracker_id: tracker.id, status: "success", location })
        }
      } catch(e) { results.push({ tracker_id: tracker.id, status: "error", error: e.message }) }
    }
    return new Response(JSON.stringify({ processed: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    })
  } catch(error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    })
  }
})
