import { supabase } from "./supabase"
import jsPDF from "jspdf"

function isNativePlatform() {
  return !!(window.Capacitor && window.Capacitor.isNativePlatform())
}

function browserDownload(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

async function exportFile(content, filename, mimeType) {
  if (isNativePlatform()) {
    try {
      const { Filesystem, Directory } = await import("@capacitor/filesystem")
      const { Share } = await import("@capacitor/share")
      let base64
      if (typeof content === "string") {
        base64 = btoa(unescape(encodeURIComponent(content)))
      } else if (content instanceof ArrayBuffer) {
        const bytes = new Uint8Array(content)
        let binary = ""
        bytes.forEach(b => binary += String.fromCharCode(b))
        base64 = btoa(binary)
      } else {
        base64 = await new Promise((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result.split(",")[1])
          reader.onerror = reject
          reader.readAsDataURL(content)
        })
      }
      const result = await Filesystem.writeFile({
        path: filename,
        data: base64,
        directory: Directory.Cache,
        recursive: true
      })
      await Share.share({
        title: "Car Care Connect Export",
        text: "Your personal data from Car Care Connect",
        url: result.uri,
        dialogTitle: "Save or share your data"
      })
    } catch(err) {
      console.error("Native export error:", err)
      const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType })
      browserDownload(blob, filename)
    }
  } else {
    const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType })
    browserDownload(blob, filename)
  }
}

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

export async function downloadJSON(data, filename) {
  const json = JSON.stringify(data, null, 2)
  await exportFile(json, filename || "ccc-my-data.json", "application/json")
}

export async function downloadCSV(rows, filename) {
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
  await exportFile(csv, filename || "ccc-bookings.csv", "text/csv")
}

export async function downloadPDF(data, filename) {
  const doc = new jsPDF()
  const pageW = doc.internal.pageSize.getWidth()
  let y = 20
  function checkPage() { if (y > 270) { doc.addPage(); y = 20 } }
  function heading(text, size=16) {
    checkPage()
    doc.setFontSize(size); doc.setTextColor(230,130,30); doc.setFont("helvetica","bold")
    doc.text(text, 14, y); y += size * 0.6
  }
  function row(label, value) {
    checkPage()
    doc.setFontSize(10); doc.setFont("helvetica","bold"); doc.setTextColor(100,100,100)
    doc.text(String(label), 14, y)
    doc.setFont("helvetica","normal"); doc.setTextColor(30,30,30)
    const lines = doc.splitTextToSize(String(value||"—"), pageW-80)
    doc.text(lines, 80, y); y += Math.max(6, lines.length*5)
  }
  function divider() {
    checkPage(); doc.setDrawColor(220,220,220)
    doc.line(14, y, pageW-14, y); y += 6
  }
  doc.setFillColor(17,17,17); doc.rect(0,0,pageW,30,"F")
  doc.setFontSize(20); doc.setFont("helvetica","bold"); doc.setTextColor(230,130,30)
  doc.text("Car Care Connect", 14, 18)
  doc.setFontSize(10); doc.setTextColor(150,150,150)
  doc.text("Personal Data Export", 14, 26)
  doc.text("Generated: "+new Date().toLocaleString(), pageW-14, 26, { align:"right" })
  y = 45
  const p = data.profile
  heading("Personal Information")
  divider()
  row("Full name", (p.first_name||"")+" "+(p.last_name||""))
  row("Email", p.email||"—")
  row("Phone", p.phone||"—")
  row("City", p.city||"—")
  row("Role", p.role||"—")
  row("Member since", p.created_at ? new Date(p.created_at).toLocaleDateString() : "—")
  y += 8
  if (data.bookings?.length > 0) {
    heading("Bookings ("+data.bookings.length+")")
    divider()
    data.bookings.slice(0,20).forEach(b => {
      row(b.booking_number||b.id?.slice(0,8)||"", (b.service_name||"")+" | "+(b.status||"")+" | KES "+(b.total_amount||0))
    })
    y += 8
  }
  if (data.vehicles?.length > 0) {
    heading("Vehicles")
    divider()
    data.vehicles.forEach(v => row((v.make||"")+" "+(v.model||""), v.license_plate||""))
    y += 8
  }
  const pageCount = doc.internal.getNumberOfPages()
  for (let i=1; i<=pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(8); doc.setTextColor(180,180,180)
    doc.text("Car Care Connect · Data Export · Page "+i+" of "+pageCount, pageW/2, 290, { align:"center" })
  }
  if (isNativePlatform()) {
    const buffer = doc.output("arraybuffer")
    await exportFile(buffer, filename || "ccc-my-data.pdf", "application/pdf")
  } else {
    const blob = doc.output("blob")
    browserDownload(blob, filename || "ccc-my-data.pdf")
  }
}
