import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}
async function payParty(supabase: any, opts: {
  partyId: string, amount: number, orderId: string, orderNumber: string,
  narrativeLabel: string, jobType: string
}) {
  const { partyId, amount, orderId, orderNumber, narrativeLabel, jobType } = opts
  const { data: sensRows } = await supabase.rpc("get_provider_payment_details", { provider_id_input: partyId })
  const sens = sensRows?.[0] || null
  const method = sens?.preferred_payment_method || "mpesa"
  const phone = method === "till" ? sens?.till_number
    : method === "paybill" ? sens?.paybill_number
    : method === "pochi" ? sens?.pochi_number
    : (sens?.mpesa_number || sens?.till_number || sens?.pochi_number)
  if (!phone) {
    const msg = `${narrativeLabel} has no payment number configured`
    await supabase.from("failed_jobs").insert({ job_type: jobType, error_message: msg, payload: { order_id: orderId, party_id: partyId, amount }, status: "failed" })
    return { success: false, error: msg }
  }
  try {
    const resp = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/daraja-b2c-payout`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
      body: JSON.stringify({ phone, amount, narrative: `CCC ${narrativeLabel} ${orderNumber}`, booking_id: orderId, provider_id: partyId, payment_method: method, account_reference: (method === "paybill" && sens?.paybill_account) ? sens.paybill_account : orderNumber })
    })
    const text = await resp.text()
    const data = text ? JSON.parse(text) : {}
    if (!resp.ok || data.error || !data.success) {
      const msg = data.error || `${narrativeLabel} B2C payout was not accepted`
      await supabase.from("failed_jobs").insert({ job_type: jobType, error_message: msg, payload: { order_id: orderId, party_id: partyId, amount, phone }, status: "failed" })
      return { success: false, error: msg }
    }
    return { success: true, method }
  } catch (err: any) {
    await supabase.from("failed_jobs").insert({ job_type: jobType, error_message: err.message, payload: { order_id: orderId, party_id: partyId, amount }, status: "failed" })
    return { success: false, error: err.message }
  }
}
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
  try {
    const { order_id } = await req.json()
    if (!order_id) throw new Error("order_id required")
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { autoRefreshToken: false, persistSession: false }
    })
    const { data: order, error } = await supabase.from("orders").select("*").eq("id", order_id).single()
    if (error || !order) throw new Error("Order not found")
    if (!order.payment_held) throw new Error("No payment held for this order")
    if (order.payment_released) throw new Error("Payment already fully released")
    const { data: openClaims } = await supabase.from("service_claims")
      .select("against_type").eq("order_id", order_id).in("status", ["pending", "under_review"])
    const claimAgainstProvider = (openClaims || []).some((c: any) => c.against_type === "provider" || !c.against_type)
    const claimAgainstDriver = (openClaims || []).some((c: any) => c.against_type === "driver")
    const providerAmount = Number(order.provider_earnings || 0)
    // The driver only earns a commission of the delivery fee, not the full amount - CCC keeps
    // the rest (matching the same admin-editable rate the frontend already displays to drivers).
    // This was previously paying out the FULL delivery_fee, meaning the platform earned zero
    // commission from marketplace deliveries despite the UI showing an 85% driver share.
    const { data: rateSetting } = await supabase.from("app_settings").select("value").eq("key", "marketplace_driver_commission_rate").maybeSingle()
    const driverCommissionRate = Number(rateSetting?.value || 85) / 100
    const driverAmount = Math.round(Number(order.delivery_fee || 0) * driverCommissionRate)
    const hasDriver = !!order.delivery_driver_id && driverAmount > 0
    let providerDone = !!order.provider_payment_released
    let driverDone = !!order.driver_payment_released || !hasDriver
    let anyPayoutAttempted = false
    let blockedReasons: string[] = []
    // Provider is paid once delivery (or pickup) is genuinely confirmed - for delivery orders
    // that means the dual-confirmation delivery OTP, matching the exact same reasoning GO
    // Service uses: the provider shouldn't be paid until the customer genuinely has their item.
    const deliveryConfirmed = hasDriver ? !!order.delivery_otp_verified : (order.status === "delivered" || order.status === "completed")
    if (!providerDone) {
      if (!deliveryConfirmed) {
        blockedReasons.push("Provider payout on hold - delivery/pickup not yet confirmed")
      } else if (claimAgainstProvider) {
        blockedReasons.push("Provider payout on hold due to an open claim")
      } else if (providerAmount > 0) {
        anyPayoutAttempted = true
        const result = await payParty(supabase, { partyId: order.provider_id, amount: providerAmount, orderId: order.id, orderNumber: order.order_number, narrativeLabel: "Order Payment", jobType: "order_provider_payout" })
        if (result.success) {
          providerDone = true
          await supabase.from("orders").update({ provider_payment_released: true }).eq("id", order_id)
          await supabase.from("notifications").insert({ user_id: order.provider_id, title: "Payment released!", message: `KES ${providerAmount.toLocaleString()} has been sent to your ${result.method} for order #${order.order_number}`, type: "success" })
        } else {
          blockedReasons.push("Provider payout failed: " + result.error)
        }
      } else {
        providerDone = true
      }
    }
    if (hasDriver && !driverDone) {
      if (!order.delivery_otp_verified) {
        blockedReasons.push("Driver payout on hold - delivery not yet confirmed by customer")
      } else if (claimAgainstDriver) {
        blockedReasons.push("Driver payout on hold due to an open claim")
      } else {
        anyPayoutAttempted = true
        const result = await payParty(supabase, { partyId: order.delivery_driver_id, amount: driverAmount, orderId: order.id, orderNumber: order.order_number, narrativeLabel: "Delivery Fee", jobType: "order_driver_payout" })
        if (result.success) {
          driverDone = true
          await supabase.from("orders").update({ driver_payment_released: true }).eq("id", order_id)
          await supabase.from("notifications").insert({ user_id: order.delivery_driver_id, title: "Payment released!", message: `KES ${driverAmount.toLocaleString()} delivery fee sent to your ${result.method} for order #${order.order_number}`, type: "success" })
        } else {
          blockedReasons.push("Driver payout failed: " + result.error)
        }
      }
    }
    const fullyReleased = providerDone && driverDone
    if (fullyReleased) {
      await supabase.from("orders").update({ payment_released: true, status: "completed" }).eq("id", order_id)
      await supabase.from("notifications").insert({ user_id: order.customer_id, title: "Order complete!", message: `Your order #${order.order_number} is complete. Thank you for shopping with CCC!`, type: "success" })
    }
    if (!anyPayoutAttempted && blockedReasons.length > 0) throw new Error(blockedReasons.join("; "))
    if (!fullyReleased && blockedReasons.length > 0) {
      return new Response(JSON.stringify({ success: true, partial: true, provider_done: providerDone, driver_done: driverDone, note: blockedReasons.join("; ") }), { headers: { ...corsHeaders, "Content-Type": "application/json" } })
    }
    if (!fullyReleased && !anyPayoutAttempted) throw new Error("Nothing to release")
    return new Response(JSON.stringify({ success: true, partial: false, amount: providerAmount + (hasDriver ? driverAmount : 0) }), { headers: { ...corsHeaders, "Content-Type": "application/json" } })
  } catch (error: any) {
    console.error("Release order payment error:", error.message)
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } })
  }
})
