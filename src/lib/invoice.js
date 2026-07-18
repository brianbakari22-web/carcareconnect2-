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
    const cleanNote = ("Note: " + booking.notes).replace(/[^\x20-\x7E]/g, "")
    const noteLines = doc.splitTextToSize(cleanNote, pageW - 36)
    noteLines.forEach(l => { checkPage(); text(l, 18, y); y += 5 })
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


// ============ ORDER RECEIPT (Parts Marketplace) ============
export function downloadOrderReceipt(order, provider, customer, items) {
  const { jsPDF } = window.jspdf
  const doc = new jsPDF({ unit:"mm", format:"a4" })
  const pageW = doc.internal.pageSize.getWidth()
  let y = 20

  function text(str, x, yPos, opts={}) {
    const { size=10, bold=false, color=[0,0,0], align="left" } = opts
    doc.setFontSize(size)
    doc.setFont("helvetica", bold ? "bold" : "normal")
    doc.setTextColor(...color)
    doc.text(String(str||""), x, yPos, { align })
  }

  function line(x1, y1, x2, y2, color=[230,130,30]) {
    doc.setDrawColor(...color)
    doc.setLineWidth(0.3)
    doc.line(x1, y1, x2, y2)
  }

  // Header
  doc.setFillColor(230, 130, 30)
  doc.rect(0, 0, pageW, 28, "F")
  text("CAR CARE CONNECT", pageW/2, 12, { size:16, bold:true, color:[255,255,255], align:"center" })
  text("ORDER RECEIPT", pageW/2, 20, { size:10, color:[255,230,200], align:"center" })
  y = 38

  // Order details
  text("Order #" + (order.order_number||order.id?.slice(0,8)||"N/A"), 20, y, { size:13, bold:true })
  text(new Date(order.created_at||Date.now()).toLocaleDateString("en-KE"), pageW-20, y, { align:"right", color:[100,100,100] })
  y += 8
  line(20, y, pageW-20, y)
  y += 8

  // Customer & Provider
  text("BILLED TO", 20, y, { size:8, color:[150,150,150], bold:true })
  text("SUPPLIER", pageW/2+5, y, { size:8, color:[150,150,150], bold:true })
  y += 6
  text((customer?.first_name||"") + " " + (customer?.last_name||""), 20, y, { bold:true })
  text(provider?.business_name||provider?.first_name||"Parts Supplier", pageW/2+5, y, { bold:true })
  y += 5
  text(customer?.phone||"", 20, y, { color:[100,100,100] })
  text(provider?.city||"Nairobi, Kenya", pageW/2+5, y, { color:[100,100,100] })
  y += 12
  line(20, y, pageW-20, y)
  y += 8

  // Items table header
  doc.setFillColor(245, 245, 245)
  doc.rect(20, y-4, pageW-40, 10, "F")
  text("ITEM", 22, y+2, { size:9, bold:true, color:[80,80,80] })
  text("QTY", pageW-70, y+2, { size:9, bold:true, color:[80,80,80], align:"center" })
  text("PRICE", pageW-45, y+2, { size:9, bold:true, color:[80,80,80], align:"center" })
  text("TOTAL", pageW-20, y+2, { size:9, bold:true, color:[80,80,80], align:"right" })
  y += 12

  // Items
  const orderItems = items||order.order_items||[]
  orderItems.forEach(item => {
    const name = item.name||item.inventory?.name||"Part"
    const qty = item.quantity||1
    const price = Number(item.unit_price||item.price||0)
    const total = qty * price
    text(name.substring(0,35), 22, y)
    text(String(qty), pageW-70, y, { align:"center" })
    text("KES " + price.toLocaleString(), pageW-45, y, { align:"center" })
    text("KES " + total.toLocaleString(), pageW-20, y, { align:"right" })
    y += 7
    line(20, y-2, pageW-20, y-2, [240,240,240])
  })

  y += 5
  line(20, y, pageW-20, y)
  y += 8

  // Totals
  const subtotal = Number(order.subtotal||0)
  const deliveryFee = Number(order.delivery_fee||0)
  const total = subtotal + deliveryFee

  text("Subtotal:", pageW-60, y, { color:[100,100,100] })
  text("KES " + subtotal.toLocaleString(), pageW-20, y, { align:"right" })
  y += 7

  if (deliveryFee > 0) {
    text("Delivery fee:", pageW-60, y, { color:[100,100,100] })
    text("KES " + deliveryFee.toLocaleString(), pageW-20, y, { align:"right" })
    y += 7
  }

  line(pageW-65, y, pageW-20, y, [230,130,30])
  y += 6
  text("TOTAL:", pageW-60, y, { size:12, bold:true })
  text("KES " + total.toLocaleString(), pageW-20, y, { size:12, bold:true, color:[230,130,30], align:"right" })
  y += 8

  // Payment status
  const paid = order.payment_status === "paid"
  doc.setFillColor(paid ? 29 : 230, paid ? 158 : 130, paid ? 117 : 30)
  doc.roundedRect(20, y, 40, 8, 2, 2, "F")
  text(paid ? "PAID" : "PENDING", 40, y+5.5, { size:9, bold:true, color:[255,255,255], align:"center" })

  if (order.fulfillment_type === "delivery") {
    text("Delivery to: " + (order.delivery_address||""), 68, y+5, { size:9, color:[100,100,100] })
  }
  y += 18

  // Footer
  line(20, y, pageW-20, y)
  y += 6
  text("Thank you for shopping on Car Care Connect", pageW/2, y, { size:9, color:[150,150,150], align:"center" })
  text("carcareconnect.care  |  0113858966  |  carcareconnect254@gmail.com", pageW/2, y+6, { size:8, color:[180,180,180], align:"center" })

  doc.save("CCC-Order-" + (order.order_number||order.id?.slice(0,8)) + ".pdf")
}

// ============ BOOKING CSV EXPORT ============
export function downloadBookingsCSV(bookings) {
  const headers = ["Booking #","Service","Date","Status","Payment Status","Amount (KES)","Provider","Vehicle"]
  const rows = bookings.map(b => [
    b.booking_number||b.id?.slice(0,8),
    b.service_name||"",
    b.booking_date||"",
    b.status||"",
    b.payment_status||"",
    b.total_amount||0,
    b.provider_name||"",
    b.vehicle_plate||""
  ])
  const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(",")).join("\n")
  const filename = "CCC-Bookings-" + new Date().toISOString().slice(0,10) + ".csv"
  const isNative = typeof window !== "undefined" && window.Capacitor?.isNativePlatform?.()
  if(!isNative) { const blob = new Blob([csv], { type:"text/csv" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url); return }
}

// ============ PAYMENT CSV EXPORT ============
export function downloadPaymentsCSV(payments) {
  const headers = ["Date","Reference","Type","Description","Amount (KES)","Status","Method"]
  const rows = payments.map(p => [
    new Date(p.created_at||Date.now()).toLocaleDateString("en-KE"),
    p.booking_number||p.order_number||p.id?.slice(0,8),
    p.type||"Service",
    p.description||p.service_name||"",
    p.amount||p.total_amount||0,
    p.payment_status||p.status||"",
    p.payment_method||"M-Pesa"
  ])
  const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(",")).join("\n")
  const blob = new Blob([csv], { type:"text/csv" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url; a.download = "CCC-Payments-" + new Date().toISOString().slice(0,10) + ".csv"
}

// ============ ORDERS CSV EXPORT ============
export function downloadOrdersCSV(orders) {
  const headers = ["Order #","Date","Status","Payment","Subtotal (KES)","Delivery (KES)","Total (KES)","Fulfillment","Delivery Zone"]
  const rows = orders.map(o => [
    o.order_number||o.id?.slice(0,8),
    new Date(o.created_at||Date.now()).toLocaleDateString("en-KE"),
    o.status||"",
    o.payment_status||"",
    o.subtotal||0,
    o.delivery_fee||0,
    Number(o.subtotal||0)+Number(o.delivery_fee||0),
    o.fulfillment_type||"",
    o.delivery_zone||""
  ])
  const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(",")).join("\n")
  const blob = new Blob([csv], { type:"text/csv" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url; a.download = "CCC-Orders-" + new Date().toISOString().slice(0,10) + ".csv"
}
