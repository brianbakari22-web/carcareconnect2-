import { supabase } from "./supabase"

const FUNCTION_URL = "https://gcnefnqtjxtqbhynyoxe.supabase.co/functions/v1/send-email"

async function getAuthHeaders() {
  const { data: { session } } = await supabase.auth.getSession()
  return {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${session?.access_token}`,
    "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdjbmVmbnF0anh0cWJoeW55b3hlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2MDg0MzIsImV4cCI6MjA5NTE4NDQzMn0.Ybyce3psBj2I-hdoF95H5UAklr6hsgQi-mciI9uMIgc"
  }
}

export async function sendEmail(to, type, data) {
  if (!to) return
  try {
    const headers = await getAuthHeaders()
    await fetch(FUNCTION_URL, {
      method: "POST",
      headers,
      body: JSON.stringify({ to, type, data })
    })
  } catch(err) {
    console.error("Email error:", err)
  }
}

export async function sendBookingConfirmation(customerEmail, booking, providerName) {
  await sendEmail(customerEmail, "booking_confirmed", {
    service_name: booking.service_name,
    provider_name: providerName,
    booking_date: booking.booking_date,
    booking_time: booking.booking_time?.slice(0,5),
    booking_number: booking.booking_number,
    total_amount: Number(booking.total_amount).toFixed(2)
  })
}

export async function sendBookingCancellation(customerEmail, booking) {
  await sendEmail(customerEmail, "booking_cancelled", {
    service_name: booking.service_name,
    booking_date: booking.booking_date,
    booking_number: booking.booking_number
  })
}

export async function sendBookingReminder(customerEmail, booking, providerName) {
  await sendEmail(customerEmail, "booking_reminder", {
    service_name: booking.service_name,
    provider_name: providerName,
    booking_date: booking.booking_date,
    booking_time: booking.booking_time?.slice(0,5)
  })
}

export async function sendDriverAssigned(customerEmail, booking, driverName) {
  await sendEmail(customerEmail, "driver_assigned", {
    driver_name: driverName,
    service_name: booking.service_name,
    pickup_address: booking.pickup_address
  })
}

export async function sendPayoutProcessed(userEmail, payout) {
  await sendEmail(userEmail, "payout_processed", {
    amount: Number(payout.amount).toFixed(2),
    bank_name: payout.bank_name,
    bank_account_number: payout.bank_account_number
  })
}

export async function sendRefundApproved(customerEmail, refund, serviceName) {
  await sendEmail(customerEmail, "refund_approved", {
    amount: Number(refund.amount).toFixed(2),
    service_name: serviceName
  })
}
