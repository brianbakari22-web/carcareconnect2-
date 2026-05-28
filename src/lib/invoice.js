import jsPDF from "jspdf"

export function generateInvoice(booking, provider, customer, mechanic, driver) {
  const doc = new jsPDF()
  const pageW = doc.internal.pageSize.getWidth()
  let y = 20

  function checkPage() {
    if (y > 270) { doc.addPage(); y = 20 }
  }

  function line(x1, y1, x2, y2, color=[220,220,220]) {
    doc.setDrawColor(...color)
    doc.line(x1, y1, x2, y2)
  }

  function text(str, x, yPos, opts={}) {
    doc.text(String(str||""), x, yPos, opts)
  }

  // Header background
  doc.setFillColor(15, 15, 15)
  doc.rect(0, 0, pageW, 35, "F")

  // Brand
  doc.setFontSize(18)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(230, 130, 30)
  text("CarCare", 14, 18)
  doc.setTextColor(240, 237, 230)
  text("Connect", 51, 18)

  // Invoice label
  doc.setFontSize(10)
  doc.setTextColor(150, 150, 150)
  text("SERVICE INVOICE", pageW - 14, 15, { align:"right" })
  doc.setFontSize(8)
  text(`#${booking.booking_number||booking.id?.slice(0,8).toUpperCase()}`, pageW - 14, 22, { align:"right" })
  text(new Date(booking.created_at||Date.now()).toLocaleDateString("default",{ day:"numeric", month:"long", year:"numeric" }), pageW - 14, 29, { align:"right" })

  y = 48

  // Customer + Provider info
  doc.setFontSize(9)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(150, 150, 150)
  text("BILLED TO", 14, y)
  text("SERVICE PROVIDER", pageW/2, y)
  y += 6

  doc.setFont("helvetica", "normal")
  doc.setTextColor(240, 237, 230)
  doc.setFontSize(10)
  text(`${customer?.first_name||""} ${customer?.last_name||""}`, 14, y)
  text(provider?.business_name||`${provider?.first_name||""} ${provider?.last_name||""}`, pageW/2, y)
  y += 5

  doc.setFontSize(9)
  doc.setTextColor(130, 130, 130)
  if (customer?.phone) { text(customer.phone, 14, y); y += 5 }
  if (provider?.city) { text(provider.city, pageW/2, y); y += 5 } else y += 5
  if (customer?.city) text(customer.city, 14, y)
  y += 10

  line(14, y, pageW - 14, y)
  y += 8

  // Service category badge
  const CATS = {
    shop_standard: { label:"Shop Standard", color:[55, 138, 221] },
    shop_premium: { label:"Shop Premium", color:[139, 92, 246] },
    go_service: { label:"GO Service — Emergency", color:[226, 75, 74] },
  }
  const cat = CATS[booking.service_category]||CATS.shop_standard
  doc.setFillColor(...cat.color)
  doc.roundedRect(14, y-4, 50, 8, 2, 2, "F")
  doc.setFontSize(8)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(255, 255, 255)
  text(cat.label, 39, y+1, { align:"center" })
  y += 10

  // Service details table header
  doc.setFillColor(26, 26, 26)
  doc.rect(14, y-4, pageW-28, 10, "F")
  doc.setFontSize(9)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(150, 150, 150)
  text("SERVICE", 16, y+2)
  text("DATE", pageW/2 - 10, y+2)
  text("AMOUNT", pageW - 16, y+2, { align:"right" })
  y += 12

  // Service row
  doc.setFont("helvetica", "normal")
  doc.setTextColor(240, 237, 230)
  doc.setFontSize(10)
  text(booking.service_name||"Service", 16, y)
  doc.setFontSize(9)
  doc.setTextColor(150, 150, 150)
  text(booking.booking_date||"", pageW/2 - 10, y)
  doc.setFontSize(11)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(230, 130, 30)
  text(`KES ${Number(booking.total_amount||0).toLocaleString()}`, pageW - 16, y, { align:"right" })
  y += 8

  if (booking.booking_time) {
    doc.setFontSize(8)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(100, 100, 100)
    text(`Time: ${booking.booking_time?.slice(0,5)}`, 16, y)
    y += 6
  }

  if (booking.notes) {
    doc.setFontSize(8)
    doc.setTextColor(100, 100, 100)
    const noteLines = doc.splitTextToSize(`Note: ${booking.notes}`, pageW - 40)
    noteLines.forEach(l => { text(l, 16, y); y += 4 })
  }

  y += 4
  line(14, y, pageW - 14, y)
  y += 10

  // ACCOUNTABILITY SECTION
  doc.setFillColor(10, 26, 18)
  doc.rect(14, y-4, pageW-28, booking.is_concierge && driver ? 36 : 24, "F")

  doc.setFontSize(9)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(29, 158, 117)
  text("SERVICE ACCOUNTABILITY", 16, y+2)
  y += 8

  doc.setFont("helvetica", "normal")
  doc.setTextColor(134, 184, 150)
  doc.setFontSize(9)

  if (mechanic) {
    text(`Service performed by: ${mechanic.first_name} ${mechanic.last_name} (${mechanic.specialization||"Mechanic"})`, 16, y)
    y += 6
    if (mechanic.phone) { text(`Mechanic contact: ${mechanic.phone}`, 16, y); y += 6 }
  } else {
    text(`Service performed by: ${provider?.business_name||`${provider?.first_name||""} ${provider?.last_name||""}`}`, 16, y)
    y += 6
  }

  if (booking.is_concierge && driver) {
    text(`Vehicle transported by: ${driver.first_name} ${driver.last_name} (Concierge Driver)`, 16, y)
    y += 6
    if (driver.phone) { text(`Driver contact: ${driver.phone}`, 16, y); y += 6 }
  }

  y += 6

  // Payment summary
  line(14, y, pageW - 14, y)
  y += 10

  const commRate = booking.platform_commission_rate||0.10
  const isGoService = booking.service_category==="go_service"
  const isPremium = booking.service_category==="shop_premium"

  const rows = [
    { label:"Service total", value:`KES ${Number(booking.total_amount||0).toLocaleString()}` },
  ]

  if (booking.is_concierge) {
    rows.push({ label:"Concierge fee (15%)", value:`KES ${(Number(booking.total_amount)*0.15).toFixed(0)}` })
  }

  rows.push({ label:`Platform fee (${Math.round(commRate*100)}%)`, value:`KES ${Number(booking.platform_commission||0).toFixed(0)}` })
  rows.push({ label:`Provider earnings (${Math.round((1-commRate)*100)}%)`, value:`KES ${Number(booking.provider_earnings||0).toFixed(0)}` })

  rows.forEach(r => {
    doc.setFontSize(9)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(130, 130, 130)
    text(r.label, 14, y)
    doc.setTextColor(200, 200, 200)
    text(r.value, pageW - 14, y, { align:"right" })
    y += 7
  })

  line(pageW/2, y, pageW - 14, y)
  y += 6

  doc.setFontSize(12)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(230, 130, 30)
  text("TOTAL PAID", 14, y)
  text(`KES ${Number(booking.total_amount||0).toLocaleString()}`, pageW - 14, y, { align:"right" })
  y += 10

  // Payment method + status
  doc.setFontSize(9)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(100, 100, 100)
  text(`Payment method: ${booking.payment_method?.toUpperCase()||"—"}`, 14, y)
  const paidColor = booking.payment_status==="paid" ? [29,158,117] : [230,130,30]
  doc.setTextColor(...paidColor)
  text(`Status: ${booking.payment_status?.toUpperCase()||"PENDING"}`, pageW - 14, y, { align:"right" })
  y += 14

  // Mileage section if applicable
  if (booking.service_category==="shop_premium"||booking.service_category==="go_service"||booking.is_concierge) {
    line(14, y, pageW - 14, y, [40, 40, 40])
    y += 8
    doc.setFontSize(8)
    doc.setTextColor(100, 100, 100)
    text("Vehicle condition reports and mileage records are available in your Car Care Connect account.", 14, y)
    y += 5
    text("Any mileage disputes must be raised within 24 hours of service completion.", 14, y)
    y += 10
  }

  // Footer
  const pageCount = doc.internal.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFillColor(15, 15, 15)
    doc.rect(0, 283, pageW, 14, "F")
    doc.setFontSize(7)
    doc.setTextColor(80, 80, 80)
    text("Car Care Connect · Nairobi, Kenya · carcareconnect254@gmail.com · 0113858966", pageW/2, 289, { align:"center" })
    text("This invoice is computer generated and valid without signature.", pageW/2, 293, { align:"center" })
    text(`Page ${i} of ${pageCount}`, pageW - 14, 293, { align:"right" })
  }

  return doc
}

export function downloadInvoice(booking, provider, customer, mechanic, driver) {
  const doc = generateInvoice(booking, provider, customer, mechanic, driver)
  doc.save(`invoice-${booking.booking_number||booking.id?.slice(0,8)}.pdf`)
}
