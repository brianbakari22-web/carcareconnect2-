import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
)
// Tools the AI can use
const tools = [
  {
    name: "query_table",
    description: "Query any CCC database table to get real-time data. Use this to answer questions about bookings, users, payments, providers, drivers, reviews, claims, support tickets, etc.",
    input_schema: {
      type: "object",
      properties: {
        table: { type: "string", description: "Table name e.g. bookings, profiles, services, reviews, service_claims, payment_transactions" },
        filters: { type: "object", description: "Filters as key-value pairs e.g. {status: 'pending', role: 'driver'}" },
        limit: { type: "number", description: "Max rows to return (default 20)" },
        select: { type: "string", description: "Columns to select (default *)" },
        order_by: { type: "string", description: "Column to order by" },
        order_desc: { type: "boolean", description: "Order descending (default true)" }
      },
      required: ["table"]
    }
  },
  {
    name: "count_records",
    description: "Count records in a table with optional filters. Use this for statistics.",
    input_schema: {
      type: "object",
      properties: {
        table: { type: "string", description: "Table name" },
        filters: { type: "object", description: "Filters as key-value pairs" }
      },
      required: ["table"]
    }
  },
  {
    name: "cancel_booking",
    description: "Cancel a stuck or problematic booking and notify the customer. Use ONLY when admin confirms.",
    input_schema: {
      type: "object",
      properties: {
        booking_id: { type: "string", description: "The booking UUID to cancel" },
        reason: { type: "string", description: "Reason for cancellation" }
      },
      required: ["booking_id", "reason"]
    }
  },
  {
    name: "send_notification",
    description: "Send a push notification to a specific user or all users of a role.",
    input_schema: {
      type: "object",
      properties: {
        user_id: { type: "string", description: "Specific user ID, or 'all_customers', 'all_providers', 'all_drivers'" },
        title: { type: "string", description: "Notification title" },
        message: { type: "string", description: "Notification message" },
        type: { type: "string", description: "Type: info, success, warning, error" }
      },
      required: ["user_id", "title", "message"]
    }
  },
  {
    name: "verify_driver",
    description: "Verify a driver account so they can accept jobs.",
    input_schema: {
      type: "object",
      properties: {
        driver_id: { type: "string", description: "The driver's profile UUID" },
        driver_name: { type: "string", description: "Driver name for confirmation" }
      },
      required: ["driver_id", "driver_name"]
    }
  },
  {
    name: "release_payment",
    description: "Release held escrow payment to provider.",
    input_schema: {
      type: "object",
      properties: {
        booking_id: { type: "string", description: "The booking UUID" }
      },
      required: ["booking_id"]
    }
  },
  {
    name: "update_booking_status",
    description: "Update the status of a booking.",
    input_schema: {
      type: "object",
      properties: {
        booking_id: { type: "string", description: "The booking UUID" },
        status: { type: "string", description: "New status: pending, confirmed, in-progress, completed, cancelled" }
      },
      required: ["booking_id", "status"]
    }
  },
  {
    name: "resolve_sos_alert",
    description: "Mark an active emergency SOS alert as resolved. Use when admin confirms the emergency has been handled.",
    input_schema: {
      type: "object",
      properties: {
        alert_id: { type: "string", description: "The emergency_alerts UUID" }
      },
      required: ["alert_id"]
    }
  },
  {
    name: "check_stuck_payouts",
    description: "Check for M-Pesa payout transactions stuck in pending status for over 30 minutes - indicates payments accepted by Safaricom but not actually completing. Read-only, always safe to call.",
    input_schema: {
      type: "object",
      properties: {}
    }
  }
]
// Execute tool calls
async function executeTool(name: string, input: any): Promise<string> {
  try {
    switch(name) {
      case "query_table": {
        let query = supabase.from(input.table).select(input.select || "*")
        if(input.filters) {
          Object.entries(input.filters).forEach(([key, val]) => {
            query = query.eq(key, val as any)
          })
        }
        if(input.order_by) query = query.order(input.order_by, { ascending:!input.order_desc })
        query = query.limit(input.limit || 20)
        const { data, error } = await query
        if(error) return `Error: ${error.message}`
        return JSON.stringify(data)
      }

      case "count_records": {
        let query = supabase.from(input.table).select("*", { count: "exact", head: true })
        if(input.filters) {
          Object.entries(input.filters).forEach(([key, val]) => {
            query = query.eq(key, val as any)
          })
        }
        const { count, error } = await query
        if(error) return `Error: ${error.message}`
        return JSON.stringify({ count })
      }
      case "cancel_booking": {
        const { error } = await supabase.from("bookings")
          .update({ status: "cancelled", notes: `Admin cancelled: ${input.reason}` })
          .eq("id", input.booking_id)
        if(error) return `Error: ${error.message}`
        const { data: booking } = await supabase.from("bookings")
          .select("customer_id, service_name, booking_number")
          .eq("id", input.booking_id).maybeSingle()
        if(booking?.customer_id) {
          await supabase.from("notifications").insert({
            user_id: booking.customer_id,
            title: "Booking Cancelled",
            message: `Your booking for ${booking.service_name} (#${booking.booking_number}) has been cancelled by admin. Reason: ${input.reason}`,
            type: "warning"
          })
        }
        await supabase.from("ccc_audit_log").insert({
          user_id: null,
          action: "ADMIN_AI_CANCEL_BOOKING",
          entity_type: "booking",
          entity_id: input.booking_id,
          new_data: { reason: input.reason }
        })
        return `Booking ${input.booking_id} cancelled successfully. Customer notified.`
      }
      case "send_notification": {
        const notifications = []
        if(input.user_id.startsWith("all_")) {
          const role = input.user_id.replace("all_", "").slice(0,-1)
          const { data: users } = await supabase.from("profiles")
            .select("id").eq("role", role).eq("is_active", true)
          users?.forEach(u => notifications.push({
            user_id: u.id, title: input.title, message: input.message, type: input.type || "info"
          }))
        } else {
          notifications.push({
            user_id: input.user_id, title: input.title, message: input.message, type: input.type || "info"
          })
        }
        if(notifications.length > 0) {
          const { error } = await supabase.from("notifications").insert(notifications)
          if(error) return `Error: ${error.message}`
        }
        return `Notification sent to ${notifications.length} user(s).`
      }
      case "verify_driver": {
        const { error } = await supabase.from("profiles").update({
          is_verified: true,
          documents_verified: true,
          vetting_status: "approved",
          verified_at: new Date().toISOString()
        }).eq("id", input.driver_id)
        if(error) return `Error: ${error.message}`
        await supabase.from("notifications").insert({
          user_id: input.driver_id,
          title: "Account Verified! ✅",
          message: "Your driver account has been verified by admin. You can now accept jobs.",
          type: "success"
        })
        await supabase.from("ccc_audit_log").insert({
          action: "ADMIN_AI_VERIFY_DRIVER",
          entity_type: "profile",
          entity_id: input.driver_id,
          new_data: { verified: true }
        })
        return `Driver ${input.driver_name} verified successfully. They have been notified.`
      }
      case "release_payment": {
        const res = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/release-payment`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
          body: JSON.stringify({ booking_id: input.booking_id, confirmed_by: "admin_ai" })
        })
        const data = await res.json()
        if(data.error) return `Error: ${data.error}`
        return `Payment released successfully! KES ${data.amount?.toLocaleString()} sent to provider.`
      }
      case "update_booking_status": {
        const { error } = await supabase.from("bookings")
          .update({ status: input.status }).eq("id", input.booking_id)
        if(error) return `Error: ${error.message}`
        return `Booking ${input.booking_id} status updated to ${input.status}.`
      }
      case "resolve_sos_alert": {
        const { error } = await supabase.from("emergency_alerts")
          .update({ status: "resolved", resolved_at: new Date().toISOString() })
          .eq("id", input.alert_id)
        if(error) return `Error: ${error.message}`
        return `SOS alert ${input.alert_id} marked resolved.`
      }
      case "check_stuck_payouts": {
        const thirtyMinAgo = new Date(Date.now() - 30*60*1000).toISOString()
        const { data: stuck, error } = await supabase.from("payment_transactions")
          .select("id, amount, phone, created_at, booking_id")
          .eq("status", "pending")
          .eq("type", "payout")
          .lt("created_at", thirtyMinAgo)
        if(error) return `Error: ${error.message}`
        if (!stuck || stuck.length === 0) return "No stuck payouts found - all payments processing normally."
        const total = stuck.reduce((s: number, p: any) => s + Number(p.amount || 0), 0)
        return `Found ${stuck.length} stuck payout(s) totaling KES ${total.toLocaleString()}: ${JSON.stringify(stuck)}`
      }
      default:
        return `Unknown tool: ${name}`
    }
  } catch(e: any) {
    return `Tool error: ${e.message}`
  }
}

const DESTRUCTIVE_TOOLS = ["cancel_booking", "verify_driver", "release_payment", "resolve_sos_alert", "send_notification"]

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
  try {
    const { messages, system, platform_data, confirmed_action } = await req.json()

    // Direct execution path - only reached when admin clicked Confirm in the UI. Bypasses the AI entirely.
    if (confirmed_action?.name) {
      const result = await executeTool(confirmed_action.name, confirmed_action.input)
      return new Response(JSON.stringify({ text: result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const enhancedSystem = `${system}
You are an AUTONOMOUS AI admin assistant for Car Care Connect. You have REAL-TIME access to the CCC database through tools.
IMPORTANT RULES:
1. Always query the database for current data - don't rely only on platform_data snapshot
2. For DESTRUCTIVE actions (cancel, verify, release payment, resolve alerts, send notifications) - the system will automatically require UI confirmation, so just call the tool and explain what you're proposing
3. For READ actions (query, count, check_stuck_payouts) - execute immediately and show results
4. Be specific with numbers and data
5. Format responses clearly with bullet points and KES amounts
6. If asked about a specific booking/user/driver - query the DB to get real details
7. After executing an action - confirm what was done
CAPABILITIES:
- Query any database table in real-time
- Cancel bookings and notify customers
- Verify driver accounts
- Release held escrow payments
- Send notifications to users
- Update booking statuses
- Resolve SOS emergency alerts
- Check for stuck/failed M-Pesa payouts

KEY SCHEMA NOTES (use these EXACT column/table names, do not guess):
- profiles table: role column has values 'customer','provider','driver','admin','mechanic'. To find providers: query_table with table='profiles', filters={role:'provider'}.
- Verification status lives on profiles as TWO separate boolean columns kept in sync together: is_verified AND documents_verified (both set true/false together by admin action). Use either one for filtering - they should match.
- profile_public is a READ-ONLY VIEW with limited columns (id, first_name, last_name, business_name, role, provider_type, is_verified, is_active, city, latitude, longitude) - it does NOT have documents_verified. When querying profile_public specifically, use is_verified, not documents_verified.
- The full profiles table (not profile_public) DOES have documents_verified.
- profile_sensitive table holds phone, email, mpesa_number, till_number, paybill_number, paybill_account, pochi_number, preferred_payment_method - NEVER query this for anything except admin-authorized payment/contact lookups, and never expose its contents in a response unless specifically asked for payment troubleshooting.
- bookings table: payment_held/payment_released booleans control escrow status. status column values: pending, confirmed, driver-assigned, arrived-for-pickup, in-progress, arrived-at-dropoff, completed, cancelled.
- payment_transactions table: type column is 'payout' or 'collection', status is 'pending'/'completed'/'failed'.
Current platform snapshot: ${JSON.stringify(platform_data || {})}`

    let currentMessages = messages.map((m: any) => ({ role: m.role, content: m.content }))
    let finalText = ""
    let iterations = 0
    const maxIterations = 5
    while(iterations < maxIterations) {
      iterations++

      const response = await fetch("https://api.anthropic.com/v1/messages",{
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": Deno.env.get("ANTHROPIC_API_KEY") ?? "",
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 2048,
          system: enhancedSystem,
          tools,
          messages: currentMessages,
        })
      })
      const data = await response.json()

      const toolUseBlocks = data.content?.filter((b: any) => b.type === "tool_use") || []
      const textBlocks = data.content?.filter((b: any) => b.type === "text") || []

      if(textBlocks.length > 0) {
        finalText = textBlocks.map((b: any) => b.text).join("\n")
      }
      if(toolUseBlocks.length === 0 || data.stop_reason === "end_turn") {
        break
      }

      // Intercept destructive tool calls - require explicit UI confirmation instead of executing
      const destructiveCall = toolUseBlocks.find((t: any) => DESTRUCTIVE_TOOLS.includes(t.name))
      if (destructiveCall) {
        return new Response(JSON.stringify({
          text: `I'd like to ${destructiveCall.name.replace(/_/g, " ")} with these details: ${JSON.stringify(destructiveCall.input)}. Please confirm below to proceed.`,
          needs_confirmation: { name: destructiveCall.name, input: destructiveCall.input }
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        })
      }

      const toolResults = []
      for(const toolUse of toolUseBlocks) {
        console.log(`Executing tool: ${toolUse.name}`, JSON.stringify(toolUse.input))
        const result = await executeTool(toolUse.name, toolUse.input)
        toolResults.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: result
        })
      }
      currentMessages = [
        ...currentMessages,
        { role: "assistant", content: data.content },
        { role: "user", content: toolResults }
      ]
    }
    return new Response(JSON.stringify({ text: finalText || "Done." }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    })
  } catch(err: any) {
    console.error("AI Execute error:", err)
    return new Response(
      JSON.stringify({ text: "Connection error: " + err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
})
