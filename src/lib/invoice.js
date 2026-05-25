export function generateInvoice(booking, profile, role) {
  const total = Number(booking.total_amount).toFixed(2)
  const platform = Number(booking.platform_commission||booking.total_amount*0.15).toFixed(2)
  const providerEarnings = Number(booking.provider_earnings||0).toFixed(2)
  const driverEarnings = Number(booking.driver_earnings||0).toFixed(2)
  const discount = Number(booking.discount_amount||0).toFixed(2)
  const date = new Date().toLocaleDateString("default", { year:"numeric", month:"long", day:"numeric" })

  const earningsRow = role === "driver"
    ? `<tr><td>Your earnings (driver)</td><td style="text-align:right;color:#e6821e;font-weight:700">$${driverEarnings}</td></tr>`
    : role === "provider"
    ? `<tr><td>Your earnings (provider 70%)</td><td style="text-align:right;color:#e6821e;font-weight:700">$${providerEarnings}</td></tr>`
    : ""

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8"/>
      <title>Invoice ${booking.booking_number}</title>
      <style>
        * { box-sizing:border-box; margin:0; padding:0; }
        body { font-family:Arial,sans-serif; background:#fff; color:#111; padding:40px; max-width:700px; margin:0 auto; }
        .header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:40px; padding-bottom:20px; border-bottom:3px solid #e6821e; }
        .brand { font-size:24px; font-weight:800; }
        .brand span { color:#e6821e; }
        .invoice-label { font-size:30px; font-weight:800; color:#e6821e; }
        .meta { font-size:12px; color:#555; margin-top:4px; }
        .section { margin-bottom:28px; }
        .section-title { font-size:11px; text-transform:uppercase; letter-spacing:0.08em; color:#888; margin-bottom:10px; font-weight:700; border-bottom:1px solid #eee; padding-bottom:6px; }
        table { width:100%; border-collapse:collapse; }
        th { background:#f8f8f8; padding:10px 12px; text-align:left; font-size:11px; text-transform:uppercase; letter-spacing:0.06em; color:#555; }
        td { padding:10px 12px; font-size:13px; border-bottom:1px solid #f0f0f0; }
        .total-row td { font-weight:700; font-size:16px; color:#e6821e; border-bottom:none; border-top:2px solid #e6821e; padding-top:14px; }
        .badge { display:inline-block; padding:3px 10px; border-radius:20px; font-size:11px; font-weight:600; background:#e8f5e9; color:#2e7d32; }
        .footer { margin-top:48px; padding-top:20px; border-top:1px solid #eee; font-size:11px; color:#aaa; text-align:center; line-height:1.8; }
        .highlight { background:#fff8f0; border:1px solid #e6821e30; border-radius:8px; padding:12px 16px; margin-bottom:20px; }
        @media print { body { padding:20px; } }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <div class="brand">Car<span>Care</span> Connect</div>
          <div class="meta">Automotive Service Platform · Nairobi, Kenya</div>
        </div>
        <div style="text-align:right">
          <div class="invoice-label">INVOICE</div>
          <div class="meta">Ref: ${booking.booking_number}</div>
          <div class="meta">Issued: ${date}</div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">Issued to</div>
        <div style="font-size:15px;font-weight:700">${profile?.first_name||""} ${profile?.last_name||""}</div>
        ${profile?.business_name ? `<div style="font-size:13px;color:#555;margin-top:2px">${profile.business_name}</div>` : ""}
        <div style="font-size:12px;color:#888;margin-top:2px;text-transform:capitalize">${role||"customer"}</div>
      </div>

      <div class="section">
        <div class="section-title">Service details</div>
        <table>
          <tr><th>Description</th><th>Date</th><th>Time</th><th>Status</th><th style="text-align:right">Total</th></tr>
          <tr>
            <td><strong>${booking.service_name}</strong></td>
            <td>${booking.booking_date}</td>
            <td>${booking.booking_time?.slice(0,5)||""}</td>
            <td><span class="badge">${booking.status}</span></td>
            <td style="text-align:right;font-weight:600">$${total}</td>
          </tr>
          ${booking.is_concierge ? `<tr><td colspan="4" style="color:#555;font-size:12px">Concierge pickup/delivery included</td><td style="text-align:right;font-size:12px">+$20</td></tr>` : ""}
          ${Number(discount)>0 ? `<tr><td colspan="4" style="color:#2e7d32;font-size:12px">Promo code: ${booking.promo_code||""}</td><td style="text-align:right;font-size:12px;color:#2e7d32">-$${discount}</td></tr>` : ""}
          <tr class="total-row"><td colspan="4">Total</td><td style="text-align:right">$${total}</td></tr>
        </table>
      </div>

      <div class="section">
        <div class="section-title">Commission breakdown</div>
        <table>
          <tr><th>Party</th><th>Rate</th><th style="text-align:right">Amount</th></tr>
          <tr><td>Platform fee</td><td>15%</td><td style="text-align:right">$${platform}</td></tr>
          <tr><td>Service provider</td><td>70%</td><td style="text-align:right">$${providerEarnings}</td></tr>
          ${booking.is_concierge ? `<tr><td>Driver</td><td>15%</td><td style="text-align:right">$${driverEarnings}</td></tr>` : ""}
        </table>
      </div>

      ${earningsRow ? `
      <div class="highlight">
        <div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px">Your earnings this transaction</div>
        <table><tr>${earningsRow}</tr></table>
      </div>` : ""}

      <div class="section">
        <div class="section-title">Payment information</div>
        <table>
          <tr><td style="color:#555">Payment status</td><td style="font-weight:500">${booking.payment_status}</td></tr>
          <tr><td style="color:#555">Booking reference</td><td style="font-weight:500">${booking.booking_number}</td></tr>
          ${booking.promo_code ? `<tr><td style="color:#555">Promo code used</td><td style="font-weight:500">${booking.promo_code}</td></tr>` : ""}
        </table>
      </div>

      <div class="footer">
        <p><strong>Car Care Connect</strong> · Nairobi, Kenya</p>
        <p>support@carcareconnect.com · carcareconnect.com</p>
        <p style="margin-top:8px">This is a system-generated invoice. Thank you for using Car Care Connect.</p>
      </div>
    </body>
    </html>
  `

  const blob = new Blob([html], { type:"text/html" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `Invoice-${booking.booking_number}.html`
  a.click()
  URL.revokeObjectURL(url)
}
