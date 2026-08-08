import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!)
    // Find all bookings where payment is held and auto_release_at has passed
    const now = new Date().toISOString()
    const { data: bookings, error } = await supabase.from("bookings")
      .select("*")
      .eq("payment_held", true)
      .eq("payment_released", false)
      .lte("auto_release_at", now)
    if (error) throw error

    // Find any bookings with an unresolved claim - these must NOT be auto-released
    const bookingIds = (bookings||[]).map(b => b.id)
    let blockedBookingIds = new Set()
    if (bookingIds.length > 0) {
      const { data: openClaims } = await supabase.from("service_claims")
        .select("booking_id")
        .in("booking_id", bookingIds)
        .in("status", ["pending", "under_review"])
      blockedBookingIds = new Set((openClaims||[]).map(c => c.booking_id).filter(Boolean))
    }

    const eligibleBookings = (bookings||[]).filter(b => !blockedBookingIds.has(b.id))
    console.log(`Found ${bookings?.length||0} bookings due for auto-release, ${blockedBookingIds.size} blocked by open claims, ${eligibleBookings.length} proceeding`)

    const results = []
    for (const booking of eligibleBookings) {
      try {
        const resp = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/release-payment`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`
          },
          body: JSON.stringify({ booking_id: booking.id, confirmed_by: "auto" })
        })
        const data = await resp.json()
        console.log(`Auto-released booking ${booking.booking_number}:`, JSON.stringify(data))
        results.push({ booking_id: booking.id, booking_number: booking.booking_number, success: true, amount: data.amount })
      } catch(e: any) {
        console.error(`Failed to auto-release ${booking.booking_number}:`, e.message)
        results.push({ booking_id: booking.id, booking_number: booking.booking_number, success: false, error: e.message })
      }
    }
    return new Response(JSON.stringify({
      ok: true,
      processed: results.length,
      blocked_by_claims: blockedBookingIds.size,
      results
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    })
  } catch (error: any) {
    console.error("Auto-release error:", error.message)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    })
  }
})
