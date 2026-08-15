import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

async function payParty(supabase: any, opts: {
  partyId: string, amount: number, bookingId: string, bookingNumber: string,
  narrativeLabel: string, jobType: string
}) {
  const { partyId, amount, bookingId, bookingNumber, narrativeLabel, jobType } = opts
  const { data: sensRows } = await supabase.rpc("get_provider_payment_details", { provider_id_input: partyId })
  const sens = sensRows?.[0] || null
  const method = sens?.preferred_payment_method || "mpesa"
  const phone = method === "till" ? sens?.till_number
    : method === "paybill" ? sens?.paybill_number
    : method === "pochi" ? sens?.pochi_number
    : (sens?.mpesa_number || sens?.till_number || sens?.pochi_number)
  if (!phone) {
    const msg = `${narrativeLabel} has no payment number configured`
    await supabase.from("failed_jobs").insert({ job_type: jobType, error_message: msg, payload: { booking_id: bookingId, party_id: partyId, amount }, status: "failed" })
    return { success: false, error: msg }
  }
  try {
    const resp = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/daraja-b2c-payout`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
      body: JSON.stringify({ phone, amount, narrative: `CCC ${narrativeLabel} ${bookingNumber}`, booking_id: bookingId, provider_id: partyId, payment_method: method, account_reference: (method === "paybill" && sens?.paybill_account) ? sens.paybill_account : bookingNumber })
    })
    const text = await resp.text()
    const data = text ? JSON.parse(text) : {}
    if (!resp.ok || data.error || !data.success) {
      const msg = data.error || `${narrativeLabel} B2C payout was not accepted`
      await supabase.from("failed_jobs").insert({ job_type: jobType, error_message: msg, payload: { booking_id: bookingId, party_id: partyId, amount, phone }, status: "failed" })
      return { success: false, error: msg }
    }
    return { success: true, method }
  } catch (err: any) {
    await supabase.from("failed_jobs").insert({ job_type: jobType, error_message: err.message, payload: { booking_id: bookingId, party_id: partyId, amount }, status: "failed" })
    return { success: false, error: err.message }
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
  try {
    const { booking_id, confirmed_by } = await req.json()
    if (!booking_id) throw new Error("booking_id required")
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { autoRefreshToken: false, persistSession: false }
    })
    const { data: booking, error } = await supabase.from("bookings").select("*").eq("id", booking_id).single()
    if (error || !booking) throw new Error("Booking not found")
    if (!booking.payment_held) throw new Error("No payment held for this booking")
    if (booking.payment_released) throw new Error("Payment already fully released")

    const { data: openClaims } = await supabase.from("service_claims")
      .select("against_type").eq("booking_id", booking_id).in("status", ["pending", "under_review"])
    const claimAgainstProvider = (openClaims || []).some((c: any) => c.against_type === "provider" || !c.against_type)
    const claimAgainstDriver = (openClaims || []).some((c: any) => c.against_type === "driver")

    const providerAmount = Number(booking.provider_earnings || 0)
    const driverAmount = Number(booking.driver_earnings || 0)
    const hasDriver = !!booking.driver_id && driverAmount > 0

    let providerDone = !!booking.provider_payment_released
    let driverDone = !!booking.driver_payment_released || !hasDriver
    let anyPayoutAttempted = false
    let blockedReasons: string[] = []

    if (!providerDone) {
      if (claimAgainstProvider) {
        blockedReasons.push("Provider payout on hold due to an open claim")
      } else if (providerAmount > 0) {
        anyPayoutAttempted = true
        const result = await payParty(supabase, { partyId: booking.provider_id, amount: providerAmount, bookingId: booking.id, bookingNumber: booking.booking_number, narrativeLabel: "Payment", jobType: "b2c_payout" })
        if (result.success) {
          providerDone = true
          await supabase.from("bookings").update({ provider_payment_released: true }).eq("id", booking_id)
          await supabase.from("notifications").insert({ user_id: booking.provider_id, title: "Payment released!", message: `KES ${providerAmount.toLocaleString()} has been sent to your ${result.method} for ${booking.service_name} #${booking.booking_number}`, type: "success" })
        } else {
          blockedReasons.push("Provider payout failed: " + result.error)
          await supabase.from("notifications").insert({ user_id: booking.provider_id, title: "Payment delayed", message: `We could not release KES ${providerAmount.toLocaleString()} to you yet. Our team has been notified.`, type: "warning" })
        }
      } else {
        providerDone = true
      }
    }

    if (hasDriver && !driverDone) {
      const bookingIdNormalized = String(booking_id ?? "").trim()
      const { data: dropoffReports, error: dropoffError } = await supabase
        .from("vehicle_condition_reports")
        .select("id, booking_id, report_type, created_at")
        .eq("booking_id", bookingIdNormalized)
        .eq("report_type", "dropoff")
      console.log("========== DROPOFF DEBUG ==========")
      console.log("booking_id:", JSON.stringify(bookingIdNormalized))
      console.log("reports:", JSON.stringify(dropoffReports))
      console.log("count:", dropoffReports?.length)
      console.log("error:", JSON.stringify(dropoffError))
      console.log("===================================")
      if (dropoffError) throw new Error("Dropoff query failed: " + dropoffError.message)
      const dropoffReport = dropoffReports?.[0] ?? null
      if (!dropoffReport) {
        blockedReasons.push("Driver payout on hold - dropoff condition report not yet filed")
      } else
      if (claimAgainstDriver) {
        blockedReasons.push("Driver payout on hold due to an open claim")
      } else {
        anyPayoutAttempted = true
        const result = await payParty(supabase, { partyId: booking.driver_id, amount: driverAmount, bookingId: booking.id, bookingNumber: booking.booking_number, narrativeLabel: "Driver Payment", jobType: "driver_payout" })
        if (result.success) {
          driverDone = true
          await supabase.from("bookings").update({ driver_payment_released: true }).eq("id", booking_id)
          await supabase.from("notifications").insert({ user_id: booking.driver_id, title: "Payment released!", message: `KES ${driverAmount.toLocaleString()} has been sent to your ${result.method} for ${booking.service_name} #${booking.booking_number}`, type: "success" })
        } else {
          blockedReasons.push("Driver payout failed: " + result.error)
        }
      }
    }

    const allowanceAmount = Number(booking.transport_allowance || 0)
    if (booking.driver_id && allowanceAmount > 0 && !booking.transport_allowance_paid) {
      const { data: pickupReport } = await supabase.from("vehicle_condition_reports").select("id").eq("booking_id", booking_id).eq("report_type", "pickup").maybeSingle()
      if (!pickupReport) {
        blockedReasons.push("Transport allowance on hold - pickup condition report not yet filed")
      } else {
        const allowanceResult = await payParty(supabase, { partyId: booking.driver_id, amount: allowanceAmount, bookingId: booking.id, bookingNumber: booking.booking_number, narrativeLabel: "Transport Allowance", jobType: "transport_allowance_payout" })
        if (allowanceResult.success) {
          await supabase.from("bookings").update({ transport_allowance_paid: true }).eq("id", booking_id)
          await supabase.from("notifications").insert({ user_id: booking.driver_id, title: "Transport allowance paid!", message: `KES ${allowanceAmount.toLocaleString()} transport allowance sent to your ${allowanceResult.method} for #${booking.booking_number}`, type: "success" })
        } else {
          blockedReasons.push("Transport allowance payout failed: " + allowanceResult.error)
        }
      }
    }

    const fullyReleased = providerDone && driverDone
    if (fullyReleased) {
      await supabase.from("bookings").update({
        payment_released: true,
        payment_released_at: new Date().toISOString(),
        completion_confirmed_at: confirmed_by === "customer" ? new Date().toISOString() : null,
        status: "completed"
      }).eq("id", booking_id)
      await supabase.from("notifications").insert({
        user_id: booking.customer_id,
        title: confirmed_by === "auto" ? "Payment auto-released" : "Payment confirmed",
        message: confirmed_by === "auto"
          ? `Payment for ${booking.service_name} was automatically released after 24 hours.`
          : `Thank you for confirming! Payment for ${booking.service_name} has been released.`,
        type: "info"
      })
      try {
        await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-push`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
          body: JSON.stringify({ user_id: booking.provider_id, title: "Payment released!", message: `Payment sent for ${booking.service_name}` })
        })
      } catch (e) { /* non-critical */ }
    }

    if (!anyPayoutAttempted && blockedReasons.length > 0) {
      throw new Error(blockedReasons.join("; "))
    }
    if (!fullyReleased && blockedReasons.length > 0) {
      return new Response(JSON.stringify({ success: true, partial: true, provider_done: providerDone, driver_done: driverDone, note: blockedReasons.join("; ") }), { headers: { ...corsHeaders, "Content-Type": "application/json" } })
    }
    if (!fullyReleased && !anyPayoutAttempted) {
      throw new Error("Nothing to release")
    }

    return new Response(JSON.stringify({ success: true, partial: false, amount: providerAmount + (hasDriver ? driverAmount : 0) }), { headers: { ...corsHeaders, "Content-Type": "application/json" } })
  } catch (error: any) {
    console.error("Release payment error:", error.message)
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } })
  }
})
