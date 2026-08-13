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
  },
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
      const DESTRUCTIVE_TOOLS = ["cancel_booking", "verify_driver", "release_payment", "resolve_sos_alert", "send_notification"]
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

      // Add assistant response and tool results to messages
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
