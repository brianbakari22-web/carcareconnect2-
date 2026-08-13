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

    // Gather the most actionable, time-sensitive metrics
    const [
      { data: stuckBookings },
      { data: pendingClaims },
      { data: pendingTickets },
      { data: unverifiedDrivers },
      { data: pendingListings },
      { data: pendingPayouts },
      { data: todayBookings },
      { data: todayUsers },
    ] = await Promise.all([
      supabase.from("bookings").select("id").eq("status", "pending").lt("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
      supabase.from("service_claims").select("id").eq("status", "pending"),
      supabase.from("support_tickets").select("id").eq("status", "open"),
      supabase.from("profiles").select("id").eq("role", "driver").eq("is_verified", false),
      supabase.from("marketplace_listings").select("id").eq("status", "pending"),
      supabase.from("payout_requests").select("id").eq("status", "pending"),
      supabase.from("bookings").select("id").gte("created_at", new Date().toISOString().split("T")[0]),
      supabase.from("profiles").select("id").gte("created_at", new Date().toISOString().split("T")[0]),
    ])

    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString()
    const { data: stuckPayouts } = await supabase.from("payment_transactions")
      .select("id, amount")
      .eq("status", "pending")
      .eq("type", "payout")
      .lt("created_at", thirtyMinAgo)

    const metrics = {
      stuck_bookings: stuckBookings?.length || 0,
      pending_claims: pendingClaims?.length || 0,
      pending_support_tickets: pendingTickets?.length || 0,
      unverified_drivers: unverifiedDrivers?.length || 0,
      pending_listings: pendingListings?.length || 0,
      pending_payout_requests: pendingPayouts?.length || 0,
      todays_bookings: todayBookings?.length || 0,
      todays_new_users: todayUsers?.length || 0,
      stuck_payouts: stuckPayouts?.length || 0,
      stuck_payout_amount: stuckPayouts?.reduce((s: number, p: any) => s + Number(p.amount || 0), 0) || 0,
    }

    // Ask Claude for a short, prioritized digest
    const prompt = `You are CCC's daily admin digest. Give a SHORT (max 5 bullet points), prioritized summary of what needs attention today. Only mention things that are actually significant - skip items that are zero or normal. Be direct and specific with numbers.

Today's metrics:
- Bookings stuck pending >24hrs: ${metrics.stuck_bookings}
- Pending service claims: ${metrics.pending_claims}
- Open support tickets: ${metrics.pending_support_tickets}
- Unverified drivers waiting: ${metrics.unverified_drivers}
- Pending marketplace listings: ${metrics.pending_listings}
- Pending payout requests: ${metrics.pending_payout_requests}
- New bookings today: ${metrics.todays_bookings}
- New users today: ${metrics.todays_new_users}
- Payouts stuck >30min (not completing): ${metrics.stuck_payouts} (KES ${metrics.stuck_payout_amount.toLocaleString()})

If everything is quiet (all zeros or normal), just say things look good today in one line.`

    const aiResp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": Deno.env.get("ANTHROPIC_API_KEY") ?? "",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 500,
        messages: [{ role: "user", content: prompt }],
      }),
    })
    const aiData = await aiResp.json()
    const digestText = aiData.content?.[0]?.text || "Daily digest unavailable - check AdminAIMonitor directly."

    // Send to all admins as a notification
    const { data: admins } = await supabase.from("profiles").select("id").eq("role", "admin")
    const notifications = (admins || []).map((a: any) => ({
      user_id: a.id,
      title: "📋 Daily CCC Digest",
      message: digestText.length > 200 ? digestText.slice(0, 200) + "..." : digestText,
      type: metrics.stuck_payouts > 0 || metrics.stuck_bookings > 0 ? "warning" : "info",
    }))
    if (notifications.length > 0) {
      await supabase.from("notifications").insert(notifications)
    }

    return new Response(JSON.stringify({ ok: true, metrics, digest: digestText, admins_notified: notifications.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch (error: any) {
    console.error("Daily digest error:", error.message)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})
