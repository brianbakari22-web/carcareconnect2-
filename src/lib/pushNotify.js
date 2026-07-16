// Push notification utility for CCC
// Calls the send-push Edge Function for real device notifications

import { supabase } from "./supabase"

const PUSH_URL = "https://gcnefnqtjxtqbhynyoxe.supabase.co/functions/v1/send-push"

async function getSession() {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token
}

async function sendPush(userId, title, message, data = {}) {
  try {
    const token = await getSession()
    if (!token) return
    await fetch(PUSH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
      body: JSON.stringify({ user_id: userId, title, message, data })
    })
  } catch(e) {
    console.warn("Push notification failed:", e.message)
  }
}

// Pre-built notification templates for CCC
export const pushNotify = {
  // Booking notifications
  bookingConfirmed: (userId, bookingNumber, serviceName) =>
    sendPush(userId, "Booking confirmed! ✅", `Your booking #${bookingNumber} for ${serviceName} is confirmed.`, { type: "booking" }),

  bookingStarted: (userId, bookingNumber, serviceName) =>
    sendPush(userId, "Service started 🔧", `Your ${serviceName} service has begun. (#${bookingNumber})`, { type: "booking" }),

  bookingCompleted: (userId, bookingNumber) =>
    sendPush(userId, "Service complete! 🎉", `Your booking #${bookingNumber} is complete. Please leave a review.`, { type: "booking" }),

  bookingCancelled: (userId, bookingNumber) =>
    sendPush(userId, "Booking cancelled ❌", `Booking #${bookingNumber} has been cancelled.`, { type: "booking" }),

  // Payment notifications
  paymentReceived: (userId, amount, mpesaCode) =>
    sendPush(userId, "Payment received! 💰", `KES ${Number(amount).toLocaleString()} received. M-Pesa: ${mpesaCode}`, { type: "payment" }),

  paymentConfirmed: (userId, amount) =>
    sendPush(userId, "Payment confirmed ✅", `Your payment of KES ${Number(amount).toLocaleString()} was successful.`, { type: "payment" }),

  payoutSent: (userId, amount) =>
    sendPush(userId, "Payout sent! 💸", `KES ${Number(amount).toLocaleString()} has been sent to your M-Pesa.`, { type: "payout" }),

  // Provider notifications
  newBooking: (userId, customerName, serviceName) =>
    sendPush(userId, "New booking! 🎉", `${customerName} booked ${serviceName}. Confirm now!`, { type: "new_booking" }),

  newMessage: (userId, senderName) =>
    sendPush(userId, "New message 💬", `${senderName} sent you a message.`, { type: "message" }),

  // GO Service
  goServiceRequest: (userId, location) =>
    sendPush(userId, "🚨 Emergency GO Service!", `Customer needs help near ${location}. Respond now!`, { type: "go_service" }),

  // Reminders
  bookingReminder: (userId, bookingNumber, time) =>
    sendPush(userId, "Reminder ⏰", `You have a booking #${bookingNumber} at ${time}. Get ready!`, { type: "reminder" }),

  reviewReminder: (userId, serviceName) =>
    sendPush(userId, "How was your service? ⭐", `Please rate your ${serviceName} experience.`, { type: "review" }),

  // Admin notifications
  accountDeletionRequest: (adminUserId, userName, userId) =>
    sendPush(adminUserId, "Account deletion request ⚠️", userName + " ("+userId.slice(0,8)+") has requested account deletion. Review in admin dashboard.", { type: "account_deletion", user_id: userId }),

  // Marketplace
  offerReceived: (userId, amount, listingTitle) =>
    sendPush(userId, "New offer! 💰", `Someone offered KES ${Number(amount).toLocaleString()} for ${listingTitle}`, { type: "offer" }),

  offerAccepted: (userId, listingTitle) =>
    sendPush(userId, "Offer accepted! 🎉", `Your offer for ${listingTitle} was accepted. Proceed to payment.`, { type: "offer" }),
}
