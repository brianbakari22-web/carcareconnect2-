// Audit logging utility for Car Care Connect
// Tracks important business actions for compliance and debugging

import { supabase } from "./supabase"

export async function auditLog({ action, entityType, entityId, oldData, newData }) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from("ccc_audit_log").insert({
      user_id: user?.id || null,
      action,
      entity_type: entityType,
      entity_id: entityId || null,
      old_data: oldData || null,
      new_data: newData || null,
    })
  } catch(e) {
    // Non-critical - never block the main action
    console.warn("Audit log failed:", e.message)
  }
}

// Pre-defined audit actions
export const AUDIT_ACTIONS = {
  // Bookings
  BOOKING_CREATED: "booking.created",
  BOOKING_CONFIRMED: "booking.confirmed",
  BOOKING_CANCELLED: "booking.cancelled",
  BOOKING_COMPLETED: "booking.completed",
  BOOKING_PAID: "booking.paid",

  // Providers
  PROVIDER_APPROVED: "provider.approved",
  PROVIDER_SUSPENDED: "provider.suspended",
  PROVIDER_PROFILE_UPDATED: "provider.profile_updated",

  // Commission
  COMMISSION_CHANGED: "commission.changed",

  // Auth
  ADMIN_LOGIN: "auth.admin_login",
  PASSWORD_CHANGED: "auth.password_changed",

  // Payments
  PAYMENT_INITIATED: "payment.initiated",
  PAYMENT_COMPLETED: "payment.completed",
  PAYMENT_FAILED: "payment.failed",
  PAYOUT_PROCESSED: "payout.processed",

  // Messages
  CONVERSATION_DELETED: "chat.conversation_deleted",

  // Admin actions
  USER_ROLE_CHANGED: "admin.user_role_changed",
  SETTINGS_CHANGED: "admin.settings_changed",
}
