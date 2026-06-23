import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// Haversine formula to calculate distance between two GPS points in km
function getDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng/2) * Math.sin(dLng/2)
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
}

Deno.serve(async (req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  )
  try {
    console.log("Function called, method:", req.method)
    const body = await req.json()
    console.log("Request body:", JSON.stringify(body))
    const { booking_id } = body

    // Get booking details
    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .select("*")
      .eq("id", booking_id)
      .single()

    console.log("Booking fetch result:", JSON.stringify({ booking: booking?.id, error: bookingError?.message }))
    if (bookingError || !booking) {
      return new Response(JSON.stringify({ error: "Booking not found", detail: bookingError?.message }), { status: 404 })
    }

    // Check if booking is still concierge and unassigned
    if (!booking.is_concierge || booking.driver_id) {
      return new Response(JSON.stringify({ message: "Booking already assigned or not concierge" }))
    }

    // Check attempt limit (max 6 attempts)
    const attempt = (booking.concierge_attempt || 0) + 1
    if (attempt > 6) {
      // All attempts exhausted — refund concierge surcharge and downgrade
      const surcharge = Number(booking.concierge_surcharge || 0)
      
      await supabase.from("bookings").update({
        is_concierge: false,
        concierge_attempt: attempt,
        concierge_current_driver_id: null,
        concierge_attempt_expires_at: null,
      }).eq("id", booking_id)

      // Create refund payout request for customer
      if (surcharge > 0) {
        await supabase.from("payout_requests").insert({
          user_id: booking.customer_id,
          amount: surcharge,
          status: "pending",
          admin_note: `Concierge surcharge refund - no driver found for booking #${booking.booking_number}`
        })
      }

      // Notify customer
      await supabase.from("notifications").insert({
        user_id: booking.customer_id,
        title: "No driver available 😔",
        message: `We couldn't find an available driver for your booking. Your concierge fee of KES ${surcharge.toLocaleString()} will be refunded. Your service booking remains active — please bring your vehicle to the provider directly.`,
        type: "warning"
      })

      // Notify provider
      await supabase.from("notifications").insert({
        user_id: booking.provider_id,
        title: "Booking update 📋",
        message: `Customer's concierge driver was unavailable for booking #${booking.booking_number}. Customer will bring their vehicle directly.`,
        type: "info"
      })

      return new Response(JSON.stringify({ message: "No driver found - refund issued", refunded: surcharge }))
    }

    // Get all online, approved, available drivers (excluding already declined)
    // Get online approved drivers not currently assigned to an active booking
    const { data: onlineDrivers } = await supabase
      .from("driver_status")
      .select("driver_id, current_lat, current_lng")
      .eq("is_online", true)

    // Filter out drivers with active bookings
    const activeDriverIds = onlineDrivers?.length ? (await supabase
      .from("bookings")
      .select("driver_id")
      .in("driver_id", onlineDrivers.map(d=>d.driver_id))
      .in("status", ["driver-assigned","in-progress","arrived-for-pickup","arrived-at-dropoff"])
    ).data?.map(b=>b.driver_id) || [] : []

    const availableDrivers = (onlineDrivers||[]).filter(d => !activeDriverIds.includes(d.driver_id))

    if (!availableDrivers?.length) {
      // No online drivers — try again in 10 minutes if attempts remain
      await supabase.from("bookings").update({
        concierge_attempt: attempt,
        concierge_attempt_expires_at: new Date(Date.now() + 10*60*1000).toISOString(),
      }).eq("id", booking_id)

      await supabase.from("notifications").insert({
        user_id: booking.customer_id,
        title: "Finding your driver... 🔍",
        message: `Attempt ${attempt}/6: No drivers online right now. We'll keep trying. You'll be notified as soon as a driver is found.`,
        type: "info"
      })

      return new Response(JSON.stringify({ message: "No online drivers, will retry" }))
    }

    // Filter out declined drivers
    const declinedIds = booking.concierge_declined_drivers || []
    const eligibleDrivers = availableDrivers.filter(d => !declinedIds.includes(d.driver_id))

    if (!eligibleDrivers.length) {
      // All available drivers declined — same as no drivers
      return new Response(JSON.stringify({ message: "All available drivers declined" }))
    }

    // Sort by distance to customer pickup location
    const customerLat = booking.customer_location_lat
    const customerLng = booking.customer_location_lng

    let nearestDriver = eligibleDrivers[0]
    if (customerLat && customerLng) {
      eligibleDrivers.sort((a, b) => {
        const distA = a.current_lat && a.current_lng ? getDistance(customerLat, customerLng, a.current_lat, a.current_lng) : 999
        const distB = b.current_lat && b.current_lng ? getDistance(customerLat, customerLng, b.current_lat, b.current_lng) : 999
        return distA - distB
      })
      nearestDriver = eligibleDrivers[0]
    }

    const expiresAt = new Date(Date.now() + 10*60*1000).toISOString()

    // Assign to nearest driver
    await supabase.from("bookings").update({
      concierge_attempt: attempt,
      concierge_current_driver_id: nearestDriver.driver_id,
      concierge_attempt_expires_at: expiresAt,
    }).eq("id", booking_id)

    // Notify the selected driver with urgency
    const distance = customerLat && customerLng && nearestDriver.current_lat && nearestDriver.current_lng
      ? Math.round(getDistance(customerLat, customerLng, nearestDriver.current_lat, nearestDriver.current_lng) * 10) / 10
      : null

    await supabase.from("notifications").insert({
      user_id: nearestDriver.driver_id,
      title: "🚗 Concierge job offer! (Attempt " + attempt + "/6)",
      message: `New concierge pickup job${distance ? " — " + distance + "km from you" : ""}. You have 10 minutes to accept. Open the app now!`,
      type: "info"
    })

    // Notify customer of progress
    await supabase.from("notifications").insert({
      user_id: booking.customer_id,
      title: "Finding your driver... 🔍",
      message: `Attempt ${attempt}/6: We found a nearby driver and sent them your request. You'll be notified once they accept.`,
      type: "info"
    })

    return new Response(JSON.stringify({ 
      message: "Driver offered job", 
      driver_id: nearestDriver.driver_id,
      attempt,
      expires_at: expiresAt,
      distance_km: distance
    }), { headers: { "Content-Type": "application/json" } })

  } catch(err) {
    console.error("Error:", err.message)
    return new Response(JSON.stringify({ error: err.message }), { status: 500 })
  }
})
