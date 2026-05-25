import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")
const FROM_EMAIL = "noreply@carcareconnect.com"
const FROM_NAME = "Car Care Connect"

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      }
    })
  }

  try {
    const { to, subject, html, type, data } = await req.json()

    let emailHtml = html
    let emailSubject = subject

    if (type && data) {
      const template = getTemplate(type, data)
      emailHtml = template.html
      emailSubject = template.subject
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: `${FROM_NAME} <${FROM_EMAIL}>`,
        to: [to],
        subject: emailSubject,
        html: emailHtml
      })
    })

    const result = await res.json()

    if (!res.ok) {
      throw new Error(result.message || "Failed to send email")
    }

    return new Response(JSON.stringify({ success: true, id: result.id }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    })
  }
})

function getTemplate(type: string, data: any) {
  const base = (content: string) => `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8"/>
      <style>
        body { font-family: Arial, sans-serif; background:#f5f5f5; margin:0; padding:20px; }
        .container { max-width:580px; margin:0 auto; background:#fff; borderRadius:12px; overflow:hidden; box-shadow:0 2px 8px rgba(0,0,0,0.08); }
        .header { background:#111; padding:24px 32px; text-align:center; }
        .brand { font-size:22px; font-weight:800; color:#fff; }
        .brand span { color:#e6821e; }
        .body { padding:32px; color:#333; }
        .title { font-size:20px; font-weight:700; color:#111; margin-bottom:8px; }
        .subtitle { font-size:14px; color:#888; margin-bottom:24px; }
        .card { background:#f9f9f9; border-radius:8px; padding:16px; margin-bottom:20px; }
        .row { display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px solid #eee; font-size:13px; }
        .row:last-child { border-bottom:none; }
        .label { color:#888; }
        .value { font-weight:500; color:#111; }
        .amount { font-size:22px; font-weight:800; color:#e6821e; }
        .btn { display:inline-block; background:#e6821e; color:#fff; padding:12px 28px; border-radius:8px; text-decoration:none; font-weight:700; font-size:14px; margin-top:16px; }
        .footer { background:#f5f5f5; padding:16px 32px; text-align:center; font-size:11px; color:#aaa; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="brand">Car<span>Care</span> Connect</div>
        </div>
        <div class="body">${content}</div>
        <div class="footer">
          Car Care Connect · Nairobi, Kenya<br/>
          This is an automated email. Please do not reply.
        </div>
      </div>
    </body>
    </html>
  `

  switch(type) {
    case "booking_confirmed":
      return {
        subject: `Booking Confirmed — ${data.service_name}`,
        html: base(`
          <div class="title">Your booking is confirmed! ✅</div>
          <div class="subtitle">Here are your booking details</div>
          <div class="card">
            <div class="row"><span class="label">Service</span><span class="value">${data.service_name}</span></div>
            <div class="row"><span class="label">Provider</span><span class="value">${data.provider_name}</span></div>
            <div class="row"><span class="label">Date</span><span class="value">${data.booking_date}</span></div>
            <div class="row"><span class="label">Time</span><span class="value">${data.booking_time}</span></div>
            <div class="row"><span class="label">Booking ref</span><span class="value">${data.booking_number}</span></div>
            <div class="row"><span class="label">Total</span><span class="value amount">$${data.total_amount}</span></div>
          </div>
          <p style="font-size:13px;color:#666;">Thank you for booking with Car Care Connect. We look forward to serving you!</p>
        `)
      }

    case "booking_cancelled":
      return {
        subject: `Booking Cancelled — ${data.service_name}`,
        html: base(`
          <div class="title">Booking Cancelled</div>
          <div class="subtitle">Your booking has been cancelled</div>
          <div class="card">
            <div class="row"><span class="label">Service</span><span class="value">${data.service_name}</span></div>
            <div class="row"><span class="label">Date</span><span class="value">${data.booking_date}</span></div>
            <div class="row"><span class="label">Booking ref</span><span class="value">${data.booking_number}</span></div>
          </div>
          <p style="font-size:13px;color:#666;">If you did not request this cancellation, please contact us immediately.</p>
        `)
      }

    case "booking_reminder":
      return {
        subject: `Reminder: ${data.service_name} tomorrow`,
        html: base(`
          <div class="title">Appointment reminder 🔔</div>
          <div class="subtitle">Your service is scheduled for tomorrow</div>
          <div class="card">
            <div class="row"><span class="label">Service</span><span class="value">${data.service_name}</span></div>
            <div class="row"><span class="label">Provider</span><span class="value">${data.provider_name}</span></div>
            <div class="row"><span class="label">Date</span><span class="value">${data.booking_date}</span></div>
            <div class="row"><span class="label">Time</span><span class="value">${data.booking_time}</span></div>
          </div>
          <p style="font-size:13px;color:#666;">Please ensure your vehicle is ready. See you tomorrow!</p>
        `)
      }

    case "driver_assigned":
      return {
        subject: `Driver assigned for ${data.service_name}`,
        html: base(`
          <div class="title">Your driver is on the way! 🚗</div>
          <div class="subtitle">A driver has been assigned to your booking</div>
          <div class="card">
            <div class="row"><span class="label">Driver</span><span class="value">${data.driver_name}</span></div>
            <div class="row"><span class="label">Service</span><span class="value">${data.service_name}</span></div>
            <div class="row"><span class="label">Pickup</span><span class="value">${data.pickup_address||"Your location"}</span></div>
          </div>
          <p style="font-size:13px;color:#666;">Your driver will contact you shortly. Track their location in the app.</p>
        `)
      }

    case "payout_processed":
      return {
        subject: `Payout of $${data.amount} processed`,
        html: base(`
          <div class="title">Your payout has been sent! 💰</div>
          <div class="subtitle">Payment is on its way to your account</div>
          <div class="card">
            <div class="row"><span class="label">Amount</span><span class="value amount">$${data.amount}</span></div>
            <div class="row"><span class="label">Bank</span><span class="value">${data.bank_name}</span></div>
            <div class="row"><span class="label">Account</span><span class="value">${data.bank_account_number}</span></div>
            <div class="row"><span class="label">ETA</span><span class="value">2-3 business days</span></div>
          </div>
        `)
      }

    case "new_message":
      return {
        subject: `New message from ${data.sender_name}`,
        html: base(`
          <div class="title">You have a new message 💬</div>
          <div class="subtitle">From ${data.sender_name} regarding ${data.service_name}</div>
          <div class="card">
            <p style="font-size:14px;color:#333;margin:0;">"${data.message}"</p>
          </div>
          <p style="font-size:13px;color:#666;">Log in to Car Care Connect to reply.</p>
        `)
      }

    case "refund_approved":
      return {
        subject: `Refund of $${data.amount} approved`,
        html: base(`
          <div class="title">Your refund has been approved ✅</div>
          <div class="card">
            <div class="row"><span class="label">Amount</span><span class="value amount">$${data.amount}</span></div>
            <div class="row"><span class="label">Service</span><span class="value">${data.service_name}</span></div>
          </div>
          <p style="font-size:13px;color:#666;">Your refund will be processed within 5-7 business days.</p>
        `)
      }

    default:
      return { subject, html: base(`<p>${data.message||""}</p>`) }
  }
}
