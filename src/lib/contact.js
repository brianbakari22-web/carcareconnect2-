import { supabase } from "./supabase"

export async function contactViaWhatsApp(bookingId, customerName, serviceName, senderName) {
  try {
    const { data: phone } = await supabase.rpc("get_booking_customer_phone", { booking_id: bookingId })
    const msg = encodeURIComponent(`Hi ${customerName||"there"}, this is ${senderName||"your service provider"} regarding your booking for ${serviceName}.`)
    if (phone) {
      const cleaned = phone.replace(/\D/g, "")
      window.open(`https://wa.me/${cleaned}?text=${msg}`, "_blank")
    } else {
      window.open(`https://wa.me/?text=${msg}`, "_blank")
    }
  } catch(err) {
    const msg = encodeURIComponent(`Hi ${customerName||"there"}, this is regarding your booking for ${serviceName}.`)
    window.open(`https://wa.me/?text=${msg}`, "_blank")
  }
}

export async function contactViaEmail(bookingId, customerName, serviceName, senderName) {
  try {
    const { data: email } = await supabase.rpc("get_booking_customer_email", { booking_id: bookingId })
    const subject = encodeURIComponent(`Your booking: ${serviceName}`)
    const body = encodeURIComponent(`Hi ${customerName||"there"},\n\nThis is ${senderName||"your service provider"} reaching out regarding your booking for ${serviceName}.\n\nPlease feel free to reply to this email.\n\nBest regards,\n${senderName||"Car Care Connect"}`)
    if (email) {
      window.open(`mailto:${email}?subject=${subject}&body=${body}`, "_blank")
    } else {
      window.open(`mailto:?subject=${subject}&body=${body}`, "_blank")
    }
  } catch(err) {
    const subject = encodeURIComponent(`Your booking: ${serviceName}`)
    const body = encodeURIComponent(`Hi ${customerName||"there"},\n\nThis is regarding your booking for ${serviceName}.`)
    window.open(`mailto:?subject=${subject}&body=${body}`, "_blank")
  }
}
