import jsPDF from "jspdf"

export function generateInvoice(booking, provider, customer, mechanic, driver) {
  const doc = new jsPDF()
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  let y = 0

  function checkPage() {
    if (y > 265) { doc.addPage(); y = 20 }
  }

  function line(x1, y1, x2, y2, color=[230,230,230]) {
    doc.setDrawColor(...color)
    doc.line(x1, y1, x2, y2)
  }

  function text(str, x, yPos, opts={}) {
    doc.text(String(str||""), x, yPos, opts)
  }

  doc.setFillColor(230, 130, 30)
  doc.rect(0, 0, pageW, 42, "F")
  doc.setFillColor(255, 255, 255)
  doc.rect(0, 38, pageW, 4, "F")

  doc.setFontSize(22)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(255, 255, 255)
  text("CarCare", 14, 20)
  doc.setTextColor(26, 12, 8)
  text("Connect", 57, 20)

  doc.setFontSize(7)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(255, 255, 255)
  text("YOUR CAR · OUR CARE · SIMPLIFIED", 14, 28)

  doc.setFillColor(255, 255, 255)
  doc.roundedRect(14, 30, 28, 6, 1, 1, "F")
  doc.setFontSize(6)
  doc.setTextColor(230, 130, 30)
  doc.setFont("helvetica", "bold")
  text("Nairobi, Kenya", 16, 34.5)

  doc.setFontSize(18)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(255, 255, 255)
  text("INVOICE", pageW - 14, 18, { align:"right" })
  doc.setFontSize(8)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(255, 255, 255)
  text("#" + (booking.booking_number||booking.id?.slice(0,8).toUpperCase()||"N/A"), pageW - 14, 26, { align:"right" })
  text(new Date(booking.created_at||Date.now()).toLocaleDateString("en-KE",{ day:"numeric", month:"long", year:"numeric" }), pageW - 14, 33, { align:"right" })

  y = 52

  doc.setFillColor(248, 248, 248)
  doc.roundedRect(14, y, 82, 36, 3, 3, "F")
  doc.setFontSize(7)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(180, 180, 180)
  text("BILLED TO", 20, y + 8)
  doc.setFontSize(10)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(0, 0, 0)
  text((customer?.first_name||"") + " " + (customer?.last_name||""), 20, y + 16)
  doc.setFontSize(8)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(100, 100, 100)
  if (customer?.phone) text(customer.phone, 20, y + 22)
  if (customer?.email) text(customer.email, 20, y + 28)
  if (customer?.city) text(customer.city, 20, y + 34)

  doc.setFillColor(248, 248, 248)
  doc.roundedRect(pageW - 96, y, 82, 36, 3, 3, "F")
  doc.setFontSize(7)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(180, 180, 180)
  text("SERVICE PROVIDER", pageW - 90, y + 8)
  doc.setFontSize(10)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(0, 0, 0)
  const provName = provider?.business_name||(provider?.first_name||"") + " " + (provider?.last_name||"")
  text(provName.length > 22 ? provName.substring(0,22)+"..." : provName, pageW - 90, y + 16)
  doc.setFontSize(8)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(100, 100, 100)
  if (provider?.city) text(provider.city, pageW - 90, y + 22)
  if (provider?.phone) text(provider.phone, pageW - 90, y + 28)

  y += 44

  const CATS = {
    shop_standard: { label:"Shop Standard", color:[55, 138, 221] },
    shop_premium:  { label:"Shop Premium",  color:[139, 92, 246] },
    go_service:    { label:"GO Service - Emergency", color:[226, 75, 74] },
    car_wash:      { label:"Car Wash", color:[29, 158, 117] },
    basic_wash:    { label:"Basic Wash", color:[29, 158, 117] },
    standard_wash: { label:"Standard Wash", color:[29, 158, 117] },
    premium_detail:{ label:"Premium Detail", color:[139, 92, 246] },
  }
  const cat = CATS[booking.service_category] || CATS.shop_standard
  doc.setFillColor(...cat.color)
  doc.roundedRect(14, y, 58, 8, 2, 2, "F")
  doc.setFontSize(7)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(255, 255, 255)
  text(cat.label, 43, y + 5.5, { align:"center" })

  const statusColor = booking.payment_status==="paid" ? [29,158,117] : [230,130,30]
  doc.setFillColor(...statusColor)
  doc.roundedRect(pageW - 42, y, 28, 8, 2, 2, "F")
  doc.setFontSize(7)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(255, 255, 255)
  text((booking.payment_status||"PENDING").toUpperCase(), pageW - 28, y + 5.5, { align:"center" })

  y += 14

  doc.setFillColor(26, 26, 26)
  doc.rect(14, y, pageW - 28, 10, "F")
  doc.setFontSize(8)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(150, 150, 150)
  text("DESCRIPTION", 18, y + 7)
  text("DATE", pageW/2 - 10, y + 7)
  text("TIME", pageW/2 + 20, y + 7)
  text("AMOUNT", pageW - 16, y + 7, { align:"right" })
  y += 14

  doc.setFont("helvetica", "normal")
  doc.setTextColor(0, 0, 0)
  doc.setFontSize(10)
  const svcName = booking.service_name||"Service"
  text(svcName.length > 35 ? svcName.substring(0,35)+"..." : svcName, 18, y)
  doc.setFontSize(9)
  doc.setTextColor(100, 100, 100)
  text(booking.booking_date||"", pageW/2 - 10, y)
  text(booking.booking_time?.slice(0,5)||"", pageW/2 + 20, y)
  doc.setFontSize(11)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(230, 130, 30)
  text("KES " + Number(booking.total_amount||0).toLocaleString(), pageW - 16, y, { align:"right" })
  y += 8

  if (booking.notes) {
    doc.setFontSize(8)
    doc.setFont("helvetica", "italic")
    doc.setTextColor(130, 130, 130)
    const noteLines = doc.splitTextToSize("Note: " + booking.notes, pageW - 50)
    noteLines.forEach(l => { checkPage(); text(l, 18, y); y += 4 })
  }

  y += 4
  line(14, y, pageW - 14, y)
  y += 10

  const acctH = booking.is_concierge && driver ? 34 : 22
  doc.setFillColor(240, 253, 244)
  doc.roundedRect(14, y, pageW - 28, acctH, 3, 3, "F")
  doc.setDrawColor(29, 158, 117)
  doc.setLineWidth(0.5)
  doc.roundedRect(14, y, pageW - 28, acctH, 3, 3, "S")
  doc.setLineWidth(0.2)
  doc.setFontSize(8)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(29, 158, 117)
  text("SERVICE ACCOUNTABILITY", 18, y + 7)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(60, 100, 70)
  doc.setFontSize(8)
  if (mechanic) {
    text("Performed by: " + mechanic.first_name + " " + mechanic.last_name + (mechanic.specialization ? " (" + mechanic.specialization + ")" : ""), 18, y + 14)
    if (mechanic.phone) text("Mechanic: " + mechanic.phone, 18, y + 20)
  } else {
    text("Performed by: " + provName, 18, y + 14)
  }
  if (booking.is_concierge && driver) {
    text("Transported by: " + driver.first_name + " " + driver.last_name + " (Concierge Driver)", 18, y + 22)
    if (driver.phone) text("Driver: " + driver.phone, 18, y + 28)
  }
  y += acctH + 10

  doc.setFillColor(248, 248, 248)
  doc.roundedRect(pageW/2, y, pageW/2 - 14, 52, 3, 3, "F")
  doc.setFontSize(8)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(150, 150, 150)
  text("PAYMENT SUMMARY", pageW/2 + 6, y + 8)

  const commRate = booking.platform_commission_rate||0.10
  const rows = [{ label:"Service total", value:"KES " + Number(booking.total_amount||0).toLocaleString() }]
  if (booking.is_concierge) rows.push({ label:"Concierge fee (15%)", value:"KES " + (Number(booking.total_amount)*0.15).toFixed(0) })
  rows.push({ label:"Platform fee (" + Math.round(commRate*100) + "%)", value:"KES " + Number(booking.platform_commission||0).toFixed(0) })
  rows.push({ label:"Provider earnings (" + Math.round((1-commRate)*100) + "%)", value:"KES " + Number(booking.provider_earnings||0).toFixed(0) })

  let ry = y + 16
  rows.forEach(r => {
    doc.setFontSize(8)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(100, 100, 100)
    text(r.label, pageW/2 + 6, ry)
    doc.setTextColor(0, 0, 0)
    text(r.value, pageW - 16, ry, { align:"right" })
    ry += 7
  })
  line(pageW/2 + 4, ry, pageW - 14, ry, [200,200,200])
  ry += 6
  doc.setFontSize(10)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(230, 130, 30)
  text("TOTAL PAID", pageW/2 + 6, ry)
  text("KES " + Number(booking.total_amount||0).toLocaleString(), pageW - 16, ry, { align:"right" })
  doc.setFontSize(8)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(130, 130, 130)
  text("Via: " + (booking.payment_method?.toUpperCase()||""), pageW/2 + 6, ry + 7)

  y += 58

  doc.setFillColor(255, 248, 240)
  doc.roundedRect(14, y, pageW/2 - 20, 26, 3, 3, "F")
  doc.setFontSize(7)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(180, 120, 60)
  text("BOOKING REFERENCE", 18, y + 7)
  doc.setFontSize(9)
  doc.setTextColor(0, 0, 0)
  text("#" + (booking.booking_number||booking.id?.slice(0,8).toUpperCase()), 18, y + 15)
  doc.setFontSize(7)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(130, 130, 130)
  text("Created: " + new Date(booking.created_at||Date.now()).toLocaleString("en-KE"), 18, y + 21)

  y += 34

  if (booking.service_category==="shop_premium"||booking.service_category==="go_service"||booking.is_concierge) {
    doc.setFontSize(7)
    doc.setFont("helvetica", "italic")
    doc.setTextColor(150, 150, 150)
    text("Vehicle condition reports and mileage records are available in your Car Care Connect account.", 14, y)
    y += 5
    text("Any disputes must be raised within 24 hours of service completion.", 14, y)
  }

  const pageCount = doc.internal.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFillColor(230, 130, 30)
    doc.rect(0, pageH - 16, pageW, 16, "F")
    doc.setFontSize(7)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(255, 255, 255)
    text("Car Care Connect", pageW/2, pageH - 9, { align:"center" })
    doc.setFont("helvetica", "normal")
    doc.setTextColor(255, 220, 170)
    text("carcareconnect254@gmail.com  ·  0113858966  ·  carcareconnect.care  ·  Nairobi, Kenya", pageW/2, pageH - 4, { align:"center" })
    doc.setTextColor(255, 255, 255)
    text(i + "/" + pageCount, pageW - 14, pageH - 6, { align:"right" })
  }

  return doc
}

export function downloadInvoice(booking, provider, customer, mechanic, driver) {
  const doc = generateInvoice(booking, provider, customer, mechanic, driver)
  doc.save("CCC-Invoice-" + (booking.booking_number||booking.id?.slice(0,8)) + ".pdf")
}
