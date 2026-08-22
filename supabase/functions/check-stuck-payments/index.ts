import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

// Safety net: both the webhook callback (daraja-callback) and the frontend's own polling
// (daraja-stk-query, called from DarajaPayment.jsx while the customer waits) are supposed to
// resolve a payment the moment it completes. But if the customer closes the app right after
// paying, or the webhook is delayed, or the frontend poll never got a chance to run, a
// transaction can sit "pending" indefinitely even though the money genuinely moved - leaving
// the provider''s split payout stuck forever. This runs on a schedule and actively re-queries
// Safaricom for any transaction that''s been pending too long, reusing daraja-stk-query''s own
// (already GO-Service-aware) resolution logic so nothing has to be duplicated here.
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    const { data: stuck } = await supabase
      .from("payment_transactions")
      .select("checkout_request_id, booking_id, created_at")
      .eq("status", "pending")
      .not("checkout_request_id", "is", null)
      .lt("created_at", new Date(Date.now() - 30 * 1000).toISOString())
      .gt("created_at", new Date(Date.now() - 20 * 60 * 1000).toISOString())
      .limit(20)

    const results = []
    // Small deliberate gap between each sequential Safaricom call - up to 20 transactions
    // could otherwise fire back-to-back in the same instant, which is exactly the kind of
    // burst pattern that trips Safaricom's own rate limiting (a real "Spike arrest
    // violation" was already hit once during earlier testing). Adds a few seconds at most
    // to a job that only runs every 2 minutes, which is genuinely negligible.
    for (const txn of stuck || []) {
      try {
        if (results.length > 0) await new Promise(r => setTimeout(r, 300))
        const res = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/daraja-stk-query`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
          body: JSON.stringify({ checkout_request_id: txn.checkout_request_id, booking_id: txn.booking_id })
        })
        const data = await res.json()
        results.push({ checkout_request_id: txn.checkout_request_id, status: data.status })
      } catch (e) {
        results.push({ checkout_request_id: txn.checkout_request_id, error: String(e) })
      }
    }

    console.log("check-stuck-payments results:", JSON.stringify(results))
    return new Response(JSON.stringify({ checked: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    })
  } catch (error: any) {
    console.error("check-stuck-payments error:", error.message)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    })
  }
})
