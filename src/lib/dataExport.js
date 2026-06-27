import { supabase } from "./supabase"
import jsPDF from "jspdf"

export async function exportUserData(userId) {
  const [
    { data: profile },
    { data: sensitive },
    { data: bookings },
    { data: payments },
    { data: reviews },
    { data: loyalty },
    { data: notifications },
    { data: favorites },
    { data: referrals },
    { data: tickets },
    { data: vehicles },
    { data: payouts },
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).single(),
    supabase.from("profile_sensitive").select("phone,email,address").eq("id", userId).maybeSingle(),
    supabase.from("bookings").select("*").or(`customer_id.eq.${userId},provider_id.eq.${userId},driver_id.eq.${userId}`).order("created_at",{ascending:false}),
    supabase.from("payments").select("*").or(`customer_id.eq.${userId},provider_id.eq.${userId}`),
    supabase.from("reviews").select("*").or(`customer_id.eq.${userId},provider_id.eq.${userId}`),
    supabase.from("loyalty_points").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("notifications").select("*").eq("user_id", userId).order("created_at",{ascending:false}),
    supabase.from("favorites").select("*").eq("customer_id", userId),
    supabase.from("referrals").select("*").eq("referrer_id", userId),
    supabase.from("support_tickets").select("*").eq("customer_id", userId),
    supabase.from("vehicles").select("*").eq("user_id", userId),
    supabase.from("payout_requests").select("*").eq("user_id", userId),
  ])

  return {
    exported_at: new Date().toISOString(),
    profile: { ...profile, ...sensitive },
    bookings: bookings||[],
    payments: payments||[],
    reviews: reviews||[],
    loyalty: loyalty||{},
    notifications: notifications||[],
    favorites: favorites||[],
    referrals: referrals||[],
    support_tickets: tickets||[],
    vehicles: vehicles||[],
    payouts: payouts||[],
  }
}

export function downloadJSON(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type:"application/json" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function downloadCSV(rows, filename) {
  if (!rows || !rows.length) return
  const headers = Object.keys(rows[0])
  const csv = [
    headers.join(","),
    ...rows.map(row => headers.map(h => {
      const val = row[h]
      if (val === null || val === undefined) return ""
      const str = String(val).replace(/"/g, '""')
      return str.includes(",") || str.includes("\n") ? `"${str}"` : str
    }).join(","))
  ].join("\n")
  const blob = new Blob([csv], { type:"text/csv;charset=utf-8;" })
  try {
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(()=>URL.revokeObjectURL(url), 1000)
  } catch(e) {
    // Mobile fallback
    const reader = new FileReader()
    reader.onload = () => { window.open(reader.result) }
    reader.readAsDataURL(blob)
  }
}

export function downloadPDF(data, filename) {
  const doc = new jsPDF()
  const pageW = doc.internal.pageSize.getWidth()
  let y = 20

  function checkPage() {
    if (y > 270) { doc.addPage(); y = 20 }
  }

  function heading(text, size=16, color=[230,130,30]) {
    checkPage()
    doc.setFontSize(size)
    doc.setTextColor(...color)
    doc.setFont("helvetica", "bold")
    doc.text(text, 14, y)
    y += size * 0.6
  }

  function subheading(text) {
    checkPage()
    doc.setFontSize(12)
    doc.setTextColor(80, 80, 80)
    doc.setFont("helvetica", "bold")
    doc.text(text, 14, y)
    y += 7
  }

  function row(label, value) {
    checkPage()
    doc.setFontSize(10)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(100, 100, 100)
    doc.text(String(label), 14, y)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(30, 30, 30)
    const val = String(value || "—")
    const lines = doc.splitTextToSize(val, pageW - 80)
    doc.text(lines, 80, y)
    y += Math.max(6, lines.length * 5)
  }

  function divider() {
    checkPage()
    doc.setDrawColor(220, 220, 220)
    doc.line(14, y, pageW - 14, y)
    y += 6
  }

  function tableHeader(cols, widths) {
    checkPage()
    doc.setFontSize(9)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(255, 255, 255)
    doc.setFillColor(230, 130, 30)
    doc.rect(14, y - 4, pageW - 28, 8, "F")
    let x = 16
    cols.forEach((col, i) => { doc.text(col, x, y); x += widths[i] })
    y += 6
  }

  function tableRow(vals, widths, even) {
    checkPage()
    if (even) {
      doc.setFillColor(248, 248, 248)
      doc.rect(14, y - 4, pageW - 28, 7, "F")
    }
    doc.setFontSize(8)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(50, 50, 50)
    let x = 16
    vals.forEach((val, i) => {
      const text = String(val || "—").slice(0, 30)
      doc.text(text, x, y)
      x += widths[i]
    })
    y += 7
  }

  // Header
  doc.setFillColor(17, 17, 17)
  doc.rect(0, 0, pageW, 30, "F")
  doc.setFontSize(20)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(230, 130, 30)
  doc.text("CarCare Connect", 14, 18)
  doc.setFontSize(10)
  doc.setTextColor(150, 150, 150)
  doc.text("Personal Data Export Report", 14, 26)
  doc.setTextColor(150, 150, 150)
  doc.text(`Generated: ${new Date().toLocaleString()}`, pageW - 14, 26, { align:"right" })
  y = 45

  // Profile section
  heading("Personal Information")
  divider()
  const p = data.profile
  row("Full name", `${p.first_name||""} ${p.last_name||""}`)
  row("Email", p.email||"—")
  row("Phone", p.phone||"—")
  row("City", p.city||"—")
  row("Role", p.role||"—")
  row("Account status", p.is_active?"Active":"Suspended")
  row("Verified", p.is_verified?"Yes":"No")
  row("Member since", p.created_at ? new Date(p.created_at).toLocaleDateString() : "—")
  row("Referral code", p.referral_code||"—")
  if (p.business_name) row("Business name", p.business_name)
  y += 8

  // Bookings section
  if (data.bookings?.length > 0) {
    heading("Bookings History")
    divider()
    doc.setFontSize(10)
    doc.setTextColor(100,100,100)
    doc.text(`Total: ${data.bookings.length} bookings`, 14, y)
    y += 8
    tableHeader(["Service", "Date", "Status", "Amount", "Payment"], [55, 28, 28, 25, 30])
    data.bookings.slice(0, 30).forEach((b, i) => {
      tableRow([
        (b.service_name||"").slice(0,20),
        b.booking_date||"",
        b.status||"",
        `KES ${Number(b.total_amount||0).toLocaleString()}`,
        b.payment_status||""
      ], [55, 28, 28, 25, 30], i%2===0)
    })
    if (data.bookings.length > 30) {
      doc.setFontSize(8)
      doc.setTextColor(150,150,150)
      doc.text(`... and ${data.bookings.length - 30} more bookings`, 14, y)
      y += 6
    }
    y += 8
  }

  // Payments section
  if (data.payments?.length > 0) {
    checkPage()
    heading("Payment History")
    divider()
    doc.setFontSize(10)
    doc.setTextColor(100,100,100)
    const totalPaid = data.payments.reduce((s,p)=>s+Number(p.amount||0),0)
    doc.text(`Total: ${data.payments.length} payments · Total paid: KES ${totalPaid.toFixed(2)}`, 14, y)
    y += 8
    tableHeader(["Method", "Amount", "Status", "Date"], [50, 35, 35, 50])
    data.payments.slice(0, 20).forEach((p, i) => {
      tableRow([
        p.payment_method||"",
        `KES ${Number(p.amount||0).toFixed(2)}`,
        p.status||"",
        p.created_at ? new Date(p.created_at).toLocaleDateString() : ""
      ], [50, 35, 35, 50], i%2===0)
    })
    y += 8
  }

  // Loyalty section
  if (data.loyalty?.points !== undefined) {
    checkPage()
    heading("Loyalty Points")
    divider()
    row("Current points", data.loyalty.points?.toLocaleString()||"0")
    row("Lifetime earned", data.loyalty.lifetime_points?.toLocaleString()||"0")
    y += 8
  }

  // Support tickets
  if (data.support_tickets?.length > 0) {
    checkPage()
    heading("Support Tickets")
    divider()
    tableHeader(["Ticket #", "Subject", "Category", "Status"], [30, 70, 35, 30])
    data.support_tickets.forEach((t, i) => {
      tableRow([
        t.ticket_number||"",
        (t.subject||"").slice(0,30),
        t.category||"",
        t.status||""
      ], [30, 70, 35, 30], i%2===0)
    })
    y += 8
  }

  // Vehicles
  if (data.vehicles?.length > 0) {
    checkPage()
    heading("Vehicles")
    divider()
    data.vehicles.forEach((v, i) => {
      subheading(`Vehicle ${i+1}`)
      row("Make/Model", `${v.make||""} ${v.model||""}`)
      row("Year", v.year||"")
      row("License plate", v.license_plate||"")
      row("Color", v.color||"")
      y += 4
    })
  }

  // Footer
  const pageCount = doc.internal.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(180,180,180)
    doc.text(`Car Care Connect · Personal Data Export · Page ${i} of ${pageCount}`, pageW/2, 290, { align:"center" })
    doc.text("Generated under Kenya Data Protection Act 2019", pageW/2, 295, { align:"center" })
  }

  // Mobile-compatible download
  try {
    // Try standard download first
    doc.save(filename)
  } catch(e) {
    // Fallback for mobile - open in new tab
    try {
      const pdfOutput = doc.output("bloburl")
      window.open(pdfOutput, "_blank")
    } catch(e2) {
      // Last resort - data URI
      const dataUri = doc.output("datauristring")
      const link = document.createElement("a")
      link.href = dataUri
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
  }
}

