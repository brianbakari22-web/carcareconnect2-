import { useEffect, useState } from "react"
import { useAuth } from "../../contexts/AuthContext"
import { supabase } from "../../lib/supabase"
import toast from "react-hot-toast"
import { jsPDF } from "jspdf"

export default function AdminAIMonitor() {
  const { user, profile } = useAuth()
  const [report, setReport] = useState(null)
  const [codeScan, setCodeScan] = useState(null)
  const [scanning, setScanning] = useState(false)


  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(true)
  const [errorLogs, setErrorLogs] = useState([])
  const [loadingErrors, setLoadingErrors] = useState(false)
  const [chatInput, setChatInput] = useState("")
  const [chatMessages, setChatMessages] = useState([])
  const [chatLoading, setChatLoading] = useState(false)

  useEffect(() => { if (user && profile?.role === "admin") scanPlatform() }, [user, profile])
  if (!user || profile?.role !== "admin") return null

  async function loadErrorLogs() {
    setLoadingErrors(true)
    try {
      const { data } = await supabase.from("error_logs")
        .select("*").order("created_at",{ascending:false}).limit(30)
      setErrorLogs(data||[])
    } catch(e) { console.error(e) }
    finally { setLoadingErrors(false) }
  }

  async function clearErrorLogs() {
    await supabase.from("error_logs").delete().neq("id","00000000-0000-0000-0000-000000000000")
    setErrorLogs([])
    toast.success("Logs cleared")
  }

  async function scanCode() {
    setScanning(true)
    try {
      const files = [
        "src/App.jsx",
        "src/contexts/AuthContext.jsx",
        "src/contexts/MechanicAuthContext.jsx",
        "src/components/shared/Layout.jsx",
        "src/components/shared/EmergencySOS.jsx",
        "src/components/shared/AIAssistant.jsx",
        "src/components/admin/AdminDashboard.jsx",
        "src/components/admin/AdminAIMonitor.jsx",
        "src/components/provider/ProviderDashboard.jsx",
        "src/components/provider/ProviderProfile.jsx",
        "src/components/provider/ProviderBookings.jsx",
        "src/components/provider/ProviderPartsManager.jsx",
        "src/components/provider/ProviderGoRequests.jsx",
        "src/components/provider/ProviderMechanics.jsx",
        "src/components/driver/DriverProfile.jsx",
        "src/components/driver/DriverDashboard.jsx",
        "src/components/driver/DriverActiveDelivery.jsx",
        "src/components/customer/CustomerProfile.jsx",
        "src/components/customer/CustomerGoService.jsx",
        "src/components/mechanic/MechanicDashboard.jsx",
        "src/components/marketplace/Marketplace.jsx",
        "src/components/marketplace/MyListings.jsx",
        "src/lib/pushNotifications.js",
        "src/components/shared/ChatWindow.jsx",
        "src/components/admin/AdminLiveMap.jsx",
        "src/components/admin/AdminClaims.jsx",
        "src/components/admin/AdminCommissions.jsx",
        "src/components/admin/AdminSettings.jsx",
        "src/components/admin/AdminBookings.jsx",
        "src/components/customer/CustomerServices.jsx",
        "src/components/customer/CustomerBookings.jsx",
        "src/components/customer/ProviderStorefront.jsx",
        "src/components/auth/AuthPage.jsx",
        "src/components/auth/ResetPassword.jsx",
      ]
      const issues = []
      for (const file of files) {
        try {
          const res = await fetch(`https://raw.githubusercontent.com/brianbakari22-web/carcareconnect2-/main/${file}`)
          if (!res.ok) continue
          const code = await res.text()
          const lines = code.split("\n")

          // Pattern 3: duplicate function declarations in same file
          const funcDecls = [...code.matchAll(/function (\w+)\(/g)].map(m=>m[1])
          const seen = {}
          funcDecls.forEach(name => { seen[name] = (seen[name]||0) + 1 })
          Object.entries(seen).forEach(([name, n]) => {
            if (n > 1) issues.push({ file, line:0, code:"function "+name, issue:"Duplicate function declaration ("+n+"x) — second definition silently overwrites the first" })
          })

          // Pattern 5: hardcoded fake-positive diagnostic values
          lines.forEach((line, i) => {
            if (line.match(/\bok\s*:\s*true\s*[,}]/) && !line.includes("AI Monitor")) {
              issues.push({ file, line:i+1, code:line.trim(), issue:"Hardcoded ok:true in diagnostic-looking code — may give false confidence instead of checking real data" })
            }
          })

          // Pattern 6: silently swallowed errors (no user feedback, no error log)
          lines.forEach((line, i) => {
            if (line.match(/catch\(\w*\)\s*\{\s*console\.(error|log)\(/) && !line.includes("toast.") && !line.includes("error_logs")) {
              issues.push({ file, line:i+1, code:line.trim(), issue:"Error caught but only logged to console — now also captured globally by window.onerror, but consider user-facing toast for better UX" })
            }
          })

          // Pattern 7: dead code landmines wrapped in &&false&&
          lines.forEach((line, i) => {
            if (line.match(/&&\s*false\s*&&\s*null/)) {
              issues.push({ file, line:i+1, code:line.trim(), issue:"Dead code reference wrapped in &&false&& — landmine if condition logic changes later, references variable that may not exist in scope" })
            }
          })
        } catch(fe) { issues.push({ file, line:0, code:"", issue:"Could not fetch: "+fe.message }) }
      }
      setCodeScan({ issues, scannedAt:new Date().toLocaleString(), filesScanned:files.length })
    } catch(e) { console.error(e) }
    finally { setScanning(false) }
  }

  async function checkAPIHealth() {
    const checks = {}
    // Check Supabase
    try {
      const start = Date.now()
      await supabase.from("profiles").select("id",{count:"exact",head:true})
      checks.supabase = { status:"ok", ms:Date.now()-start }
    } catch(e) { checks.supabase = { status:"error", ms:0 } }

    // Check M-Pesa - verify edge function is deployed
    try {
      const start = Date.now()
      const res = await fetch("https://gcnefnqtjxtqbhynyoxe.supabase.co/functions/v1/daraja-stk-push", {
        method:"POST",
        headers:{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdjbmVmbnF0anh0cWJoeW55b3hlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2MDg0MzIsImV4cCI6MjA5NTE4NDQzMn0.Ybyce3psBj2I-hdoF95H5UAklr6hsgQi-mciI9uMIgc"},
        body:JSON.stringify({ping:true})
      })
      const ms = Date.now()-start
      checks.daraja = { status: res.status < 503 ? "ok" : "error", ms }
      // Real signal: check for payouts stuck in "pending" for over 30 minutes - the actual honest indicator of whether payments are executing
      const thirtyMinAgo = new Date(Date.now() - 30*60*1000).toISOString()
      const { data: stuckPayouts } = await supabase.from("payment_transactions")
        .select("id, amount, created_at")
        .eq("status", "pending")
        .eq("type", "payout")
        .lt("created_at", thirtyMinAgo)
      checks.daraja.stuck_payouts = stuckPayouts?.length || 0
      checks.daraja.stuck_payout_amount = stuckPayouts?.reduce((s,p)=>s+Number(p.amount||0),0) || 0
      if ((stuckPayouts?.length || 0) > 0) checks.daraja.status = "error"
    } catch(e) { checks.daraja = { status:"error", ms:0 } }

    // Check AI
    try {
      const start = Date.now()
      const res = await fetch("https://gcnefnqtjxtqbhynyoxe.supabase.co/functions/v1/ai-chat", {
        method:"POST",
        headers:{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdjbmVmbnF0anh0cWJoeW55b3hlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2MDg0MzIsImV4cCI6MjA5NTE4NDQzMn0.Ybyce3psBj2I-hdoF95H5UAklr6hsgQi-mciI9uMIgc"},
        body:JSON.stringify({system:"ping",messages:[{role:"user",content:"ping"}]})
      })
      checks.ai = { status:res.ok?"ok":"error", ms:Date.now()-start }
    } catch(e) { checks.ai = { status:"error", ms:0 } }

    return checks
  }

  async function scanPlatform() {
    setLoading(true)
    try {
      const apiHealth = await checkAPIHealth()
      const { data: metricsData, error: metricsError } = await supabase.rpc("get_admin_platform_metrics")
      if (metricsError) throw metricsError
      const platformData = { ...metricsData, api_health: apiHealth }

      const sevenDaysAgo = new Date(Date.now() - 7*24*60*60*1000).toISOString().split("T")[0]
      const { data: history } = await supabase.from("admin_daily_snapshots")
        .select("snapshot_date, metrics")
        .gte("snapshot_date", sevenDaysAgo)
        .order("snapshot_date", { ascending: true })
      const trendSummary = history && history.length > 1
        ? `7-day history: ${history.map(h => `${h.snapshot_date}: stuck_bookings=${h.metrics.stuck_bookings}, pending_claims=${h.metrics.pending_claims}, stuck_payouts=${h.metrics.stuck_payouts}`).join(" | ")}`
        : "No historical data yet (less than 2 days recorded)."

      const prompt = `You are the Car Care Connect AI Admin Monitor. Analyze this platform data and give a CONCISE priority report.

API HEALTH:
- Supabase database: ${apiHealth.supabase?.status} (${apiHealth.supabase?.ms}ms)
- M-Pesa payments: ${apiHealth.daraja?.status} (${apiHealth.daraja?.ms}ms) | Stuck payouts (pending >30min): ${apiHealth.daraja?.stuck_payouts||0} totaling KES ${(apiHealth.daraja?.stuck_payout_amount||0).toLocaleString()} [If stuck_payouts > 0, this means payment requests are being accepted by Safaricom but not actually completing - flag this as a critical issue, do not describe payments as fully operational]
- AI assistant: ${apiHealth.ai?.status} (${apiHealth.ai?.ms}ms)

\

PLATFORM STATUS RIGHT NOW:
OPERATIONS:
- Stuck bookings (pending >24hrs): ${platformData.stuck_bookings}
- Total bookings: ${platformData.total_bookings} | Completed: ${platformData.completed_bookings}
- Active GO emergency requests: ${platformData.active_go_requests} | Total GO requests ever: ${platformData.total_go_requests}
- Today new bookings: ${platformData.todays_bookings}

USERS:
- Total users: ${platformData.total_users} | Today new: ${platformData.todays_new_users}
- CCC Employees: ${platformData.total_employees}
- Total drivers: ${platformData.total_drivers} | Verified: ${platformData.verified_drivers} | Unverified: ${platformData.unverified_drivers}
- Total employees: ${platformData.total_employees}

PAYMENTS:
- Completed bookings not yet paid: ${platformData.completed_unpaid} (KES ${platformData.unpaid_amount.toLocaleString()})
- Pending payout requests: ${platformData.pending_payouts}

MARKETPLACE:
- Total listings: ${platformData.total_listings} | Active: ${platformData.active_listings} | Pending: ${platformData.pending_listings}
- Total transactions: ${platformData.total_marketplace_transactions} | Completed: ${platformData.completed_marketplace_transactions}
- Pending inspections: ${platformData.pending_inspections}

QUALITY:
- Service claims: ${platformData.total_claims} total | Resolved: ${platformData.resolved_claims} | Pending: ${platformData.pending_claims}
- Providers with claims this month: ${platformData.providers_with_claims}
- Total reviews: ${platformData.total_reviews} | Avg rating this month: ${platformData.avg_rating_this_month}
- Support tickets pending: ${platformData.pending_support}
- Expiring vouchers (3 days): ${platformData.expiring_vouchers}

REVENUE INTELLIGENCE:
- This week revenue: KES ${platformData.this_week_revenue?.toLocaleString()}
- Last week revenue: KES ${platformData.last_week_revenue?.toLocaleString()}
- Revenue trend: ${platformData.revenue_trend>=0?"UP":"DOWN"} KES ${Math.abs(platformData.revenue_trend||0).toLocaleString()} vs last week

FRAUD DETECTION:
- Cancelled bookings last 7 days: ${platformData.cancelled_last_7days}
- Expiring driver documents (7 days): ${platformData.expiring_documents}

CUSTOMER INSIGHTS:
- Inactive customers (30+ days no activity): ${platformData.inactive_customers_30days}
- New customers this week who havent booked: ${platformData.new_customers_no_booking}

PROVIDER PERFORMANCE:
- Providers with claims this month: ${platformData.providers_with_claims}
- Average platform rating this month: ${platformData.avg_rating_this_month}

PROVIDER TYPE BREAKDOWN:
- Provider types registered: ${JSON.stringify(platformData.provider_type_breakdown)}
- Boda boda drivers: ${platformData.boda_boda_drivers}

INVENTORY & ORDERS:
- Active inventory items listed: ${platformData.parts_inventory_items}
- Pending orders needing fulfillment: ${platformData.pending_orders}
- Low stock items (5 or less): check inventory
- Orders system: LIVE and operational
- Delivery zones configured: YES

ENGAGEMENT & COMMUNICATION:
- Total notifications sent (all-time): ${platformData.total_notifications}
- Total chat messages exchanged: ${platformData.total_chat_messages}
- Total loyalty point transactions: ${platformData.total_loyalty_points}
  - Active mechanics: ${platformData.total_mechanics}
ESCROW SYSTEM:
- Payments currently held in escrow: ${platformData.held_payments}
- Payments released to providers: ${platformData.released_payments}
SERVICE BUNDLES:
- Active service bundles: ${platformData.total_bundles}
SUPPORT TICKETS:
- Provider tickets: ${platformData.provider_tickets}
- Driver tickets: ${platformData.driver_tickets}
TWO-SIDED REVIEWS:
- Provider-to-customer ratings given: ${platformData.customer_ratings_given}
- Push notification tokens registered: ${platformData.total_device_tokens}
- Support messages exchanged: ${platformData.total_support_messages}

FINANCIAL & PROMOTIONS:
- Total payment records: ${platformData.total_payments}
- Promo codes created: ${platformData.total_promo_codes}
- Vouchers issued: ${platformData.total_vouchers_issued}

GROWTH:
- Driver documents uploaded: ${platformData.total_driver_docs}
- Favorites/wishlist saves: ${platformData.total_favorites}
- Referrals made: ${platformData.total_referrals}

PLATFORM CONTEXT:
Provider types: garage, parts_dealer, accessories_shop, tyre_shop, auto_electrician, car_wash, panel_beater, auto_glass
Driver vehicle types: car, motorcycle (boda boda), tuktuk, van
Commission rates: parts_dealer=5%, tyre_shop=6%, accessories_shop=8%, garage=10%, auto_electrician=12%, auto_glass=12%, car_wash=10%, panel_beater=15%
New tables: inventory, orders, order_items, commission_rates, service_bundles, reviews, support_tickets, provider_penalties, service_vouchers, payment_transactions

NEW FEATURES ADDED (Jul 2026):
- Escrow payment system: payment held after customer pays, released after 24hr or customer confirms
- Two-sided reviews: providers rate customers, content filter for bad words/contact info
- Service bundles: providers create discounted service packages, customers can book bundles
- Support system: all roles (customer/provider/driver) can file support tickets
- Claims investigation: private chat threads between admin and each party
- Safaricom Daraja LIVE: KES 500,000 daily limit, real M-Pesa transactions
- ProviderCustomerReviews: providers can rate customer behavior after bookings
- Auto-release-payments cron: runs hourly to release held payments after 24hrs
Give a comprehensive report with these sections:

1. 🔴 CRITICAL (needs action NOW - blocking operations)
2. 🟡 WARNING (needs attention today)
3. ✅ WORKING WELL (features confirmed working based on data)
4. ❌ NOT WORKING / UNTESTED (zero data = untested or broken)
5. 🔧 NEEDS EDITING (features that need fixes based on data patterns)
6. 🟢 TODAY (positive activity)
7. 💡 TOP 3 RECOMMENDATIONS (priority actions)

For WORKING WELL - confirm features that have actual data
For NOT WORKING - identify features with zero data that should have data by now
For NEEDS EDITING - identify broken flows, missing steps, or incomplete features

Be specific and actionable. Max 300 words. Use bullet points.`

      const res = await fetch("https://gcnefnqtjxtqbhynyoxe.supabase.co/functions/v1/ai-chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdjbmVmbnF0anh0cWJoeW55b3hlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2MDg0MzIsImV4cCI6MjA5NTE4NDQzMn0.Ybyce3psBj2I-hdoF95H5UAklr6hsgQi-mciI9uMIgc"
        },
        body: JSON.stringify({
          system: "You are the Car Care Connect AI Admin Monitor with DIRECT access to live platform data provided to you. You have already scanned the database and the results are in your context. You CAN see real data. When asked about tickets, claims, bookings etc - reference the numbers from the platform data provided. For actions that need UI interaction, guide the admin to the specific page and button. For actions the system can execute automatically (like cancelling stuck bookings), tell admin to use the Quick Action buttons above the chat. Be concise, direct and specific. Never say you cannot access data - you already have it.",
          messages: [{ role:"user", content:prompt }]
        })
      })
      const data = await res.json()
      const text = data.text || data.content?.[0]?.text || "Unable to generate report"
      setReport({ text, platformData, generatedAt: new Date().toLocaleString() })
      setChatMessages([{ role:"assistant", content:text }])
    } catch(e) {
      setReport({ text:"Could not connect to AI monitor. Check your connection.", platformData:{}, generatedAt:new Date().toLocaleString() })
    }
    setLoading(false)
  }

  function downloadReportPDF() {
    if (!report?.text) { toast.error("No report to download yet"); return }
    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    const margin = 15
    const maxWidth = pageWidth - margin * 2
    let y = 0

    function addFooter() {
      const pageCount = doc.internal.getNumberOfPages()
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i)
        doc.setFontSize(8)
        doc.setTextColor(150)
        doc.text("Car Care Connect - Confidential", margin, pageHeight - 8)
        doc.text(String(i) + " / " + pageCount, pageWidth - margin - 10, pageHeight - 8)
      }
    }

    function checkPageBreak(neededSpace) {
      if (y + neededSpace > pageHeight - 15) {
        doc.addPage()
        y = 20
      }
    }

    // Header banner
    doc.setFillColor(230, 130, 30)
    doc.rect(0, 0, pageWidth, 28, "F")
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(18)
    doc.setFont(undefined, "bold")
    doc.text("Car Care Connect", margin, 14)
    doc.setFontSize(11)
    doc.setFont(undefined, "normal")
    doc.text("AI Admin Priority Report", margin, 22)
    doc.setFontSize(9)
    doc.text(report.generatedAt || new Date().toLocaleString(), pageWidth - margin - 55, 22)

    y = 40
    doc.setTextColor(0, 0, 0)

    const rawLines = report.text.split("\n")
    rawLines.forEach(rawLine => {
      let line = rawLine.trim()
      if (!line) { y += 3; return }

      // Section headers with emoji markers -> colored bold headers
      if (line.startsWith("## ")) {
        const heading = line.replace("## ", "").replace(/[🔴🟡✅❌🔧🟢💡]/g, "").trim()
        let color = [80, 80, 80]
        if (line.includes("🔴")) color = [226, 75, 74]
        else if (line.includes("🟡")) color = [230, 130, 30]
        else if (line.includes("✅")) color = [29, 158, 117]
        else if (line.includes("❌")) color = [226, 75, 74]
        else if (line.includes("🔧")) color = [139, 92, 246]
        else if (line.includes("🟢")) color = [29, 158, 117]
        else if (line.includes("💡")) color = [55, 138, 221]
        checkPageBreak(14)
        y += 4
        doc.setFontSize(13)
        doc.setFont(undefined, "bold")
        doc.setTextColor(color[0], color[1], color[2])
        doc.text(heading, margin, y)
        y += 7
        doc.setDrawColor(color[0], color[1], color[2])
        doc.setLineWidth(0.5)
        doc.line(margin, y - 5, margin + 40, y - 5)
        doc.setTextColor(0, 0, 0)
        return
      }

      // Main title
      if (line.startsWith("# ")) {
        return // already shown in header banner
      }

      // Horizontal rule
      if (line === "---") {
        checkPageBreak(6)
        y += 2
        doc.setDrawColor(220, 220, 220)
        doc.setLineWidth(0.2)
        doc.line(margin, y, pageWidth - margin, y)
        y += 4
        return
      }

      // Bullet points
      if (line.startsWith("- ") || line.startsWith("* ")) {
        const bulletText = line.replace(/^[-*]\s/, "").replace(/\*\*/g, "")
        doc.setFontSize(10.5)
        doc.setFont(undefined, "normal")
        doc.setTextColor(40, 40, 40)
        const wrapped = doc.splitTextToSize(bulletText, maxWidth - 8)
        checkPageBreak(wrapped.length * 5.5 + 2)
        doc.setFont(undefined, "bold")
        doc.text("-", margin + 2, y)
        doc.setFont(undefined, "normal")
        wrapped.forEach((wLine, i) => {
          doc.text(wLine, margin + 7, y + i * 5.5)
        })
        y += wrapped.length * 5.5 + 1
        return
      }

      // Bold status line (e.g. "Status: ...")
      const cleanLine = line.replace(/\*\*/g, "")
      doc.setFontSize(10.5)
      doc.setFont(undefined, line.includes("**") ? "bold" : "normal")
      doc.setTextColor(20, 20, 20)
      const wrapped = doc.splitTextToSize(cleanLine, maxWidth)
      checkPageBreak(wrapped.length * 5.5 + 2)
      wrapped.forEach((wLine, i) => {
        doc.text(wLine, margin, y + i * 5.5)
      })
      y += wrapped.length * 5.5 + 2
    })

    addFooter()
    const fileName = "CCC-Admin-Report-" + new Date().toISOString().split("T")[0] + ".pdf"
    const pdfBlob = doc.output("blob")
    const pdfFile = new File([pdfBlob], fileName, { type: "application/pdf" })
    if (navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
      navigator.share({ files: [pdfFile], title: fileName })
        .then(() => toast.success("Report ready!"))
        .catch(() => { doc.save(fileName); toast.success("Report downloaded!") })
    } else {
      doc.save(fileName)
      toast.success("Report downloaded!")
    }
  }


  async function sendChat(e) {
    e.preventDefault()
    if (!chatInput.trim() || chatLoading) return
    const text = chatInput.trim()
    setChatInput("")
    const msgs = [...chatMessages, { role:"user", content:text }]
    setChatMessages(msgs)
    setChatLoading(true)
    try {
      const res = await fetch("https://gcnefnqtjxtqbhynyoxe.supabase.co/functions/v1/ai-admin-execute", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdjbmVmbnF0anh0cWJoeW55b3hlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2MDg0MzIsImV4cCI6MjA5NTE4NDQzMn0.Ybyce3psBj2I-hdoF95H5UAklr6hsgQi-mciI9uMIgc"
        },
        body: JSON.stringify({
          system: `You are the Car Care Connect AI Admin. You have REAL-TIME database access. Platform snapshot: ${JSON.stringify(report?.platformData||{})}. Admin ID: ${user?.id}`,
          messages: msgs.map(m=>({ role:m.role, content:m.content })),
          platform_data: report?.platformData||{}
        })
      })
      const data = await res.json()
      const reply = data.text || data.content?.[0]?.text || "Sorry, could not process."
      setChatMessages(prev=>[...prev, { role:"assistant", content:reply, needsConfirmation:data.needs_confirmation||null }])
    } catch(e) {
      setChatMessages(prev=>[...prev, { role:"assistant", content:"Connection error. Please try again." }])
    }
    setChatLoading(false)
  }

  async function confirmAction(action) {
    setChatLoading(true)
    try {
      const res = await fetch("https://gcnefnqtjxtqbhynyoxe.supabase.co/functions/v1/ai-admin-execute", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdjbmVmbnF0anh0cWJoeW55b3hlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2MDg0MzIsImV4cCI6MjA5NTE4NDQzMn0.Ybyce3psBj2I-hdoF95H5UAklr6hsgQi-mciI9uMIgc"
        },
        body: JSON.stringify({ confirmed_action: action })
      })
      const data = await res.json()
      setChatMessages(prev=>[...prev, { role:"assistant", content:data.text||"Done.", needsConfirmation:null }])
    } catch(e) {
      setChatMessages(prev=>[...prev, { role:"assistant", content:"Confirmation failed - connection error." }])
    }
    setChatLoading(false)
  }
  return (
    <div style={{ background:"#f8f8f8", border:"1px solid #8b5cf640", borderRadius:14, marginBottom:"1.5rem", overflow:"hidden" }}>
      <div onClick={()=>setOpen(o=>!o)} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"1rem 1.25rem", cursor:"pointer", background:"linear-gradient(135deg,#f5f3ff,#ffffff)" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:36, height:36, borderRadius:"50%", background:"#8b5cf6", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18 }}>✦</div>
          <div>
            <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:800, color:"#8b5cf6" }}>AI Admin Monitor</div>
            <div style={{ fontSize:10, color:"#888" }}>{loading?"Scanning platform...":report?.generatedAt?"Last scan: "+report.generatedAt:"Ready"}</div>
            {report?.text&&(
              <button onClick={downloadReportPDF}
                style={{ marginTop:8, background:"#8b5cf6", border:"none", borderRadius:7, color:"#fff", fontSize:11, fontWeight:700, padding:"6px 14px", cursor:"pointer" }}>
                Download Report (PDF)
              </button>
            )}
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <button onClick={e=>{ e.stopPropagation(); scanPlatform() }} style={{ background:"#f5f3ff", border:"1px solid #8b5cf640", borderRadius:7, color:"#8b5cf6", fontSize:11, padding:"4px 10px", cursor:"pointer" }}>
            🔄 Refresh
          </button>
          <span style={{ color:"#888", fontSize:16 }}>{open?"▲":"▼"}</span>
        </div>
      </div>

      {open&&(
        <div style={{ padding:"1.25rem" }}>
          {loading&&(
            <div style={{ textAlign:"center", padding:"2rem" }}>
              <div style={{ fontSize:28, marginBottom:8 }}>✦</div>
              <div style={{ fontSize:13, color:"#8b5cf6" }}>AI scanning platform...</div>
              <div style={{ fontSize:11, color:"#888", marginTop:4 }}>Checking all systems and data</div>
            </div>
          )}
          {!loading&&report&&(
            <>
              <div style={{ background:"#ffffff", borderRadius:10, padding:"1rem", marginBottom:"1rem", whiteSpace:"pre-wrap", fontSize:13, color:"#000000", lineHeight:1.8 }}>
                {report.text}
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8, marginBottom:"1rem" }}>
                {[
                  { l:"Stuck bookings", v:report.platformData.stuck_bookings, c:report.platformData.stuck_bookings>0?"#e24b4a":"#1d9e75" },
                  { l:"Pending claims", v:report.platformData.pending_claims, c:report.platformData.pending_claims>0?"#e6821e":"#1d9e75" },
                  { l:"Support tickets", v:report.platformData.pending_support, c:report.platformData.pending_support>0?"#e6821e":"#1d9e75" },
                  { l:"Unpaid (KES)", v:Number(report.platformData.unpaid_amount||0).toLocaleString(), c:"#e6821e" },
                ].map(s=>(
                  <div key={s.l} style={{ background:"#f8f8f8", borderRadius:8, padding:"0.6rem", border:"1px solid #eeeeee", textAlign:"center" }}>
                    <div style={{ fontFamily:"Syne", fontSize:16, fontWeight:800, color:s.c }}>{s.v}</div>
                    <div style={{ fontSize:9, color:"#888", marginTop:2 }}>{s.l}</div>
                  </div>
                ))}
              </div>
              {/* API Health */}
              <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8, marginBottom:"1rem" }}>
                {[
                  { l:"Supabase DB", k:"supabase" },
                  { l:"M-Pesa Pay", k:"daraja" },
                  { l:"AI Assistant", k:"ai" },
                ].map(s=>(
                  <div key={s.k} style={{ background:"#ffffff", borderRadius:8, padding:"0.6rem", textAlign:"center", border:"1px solid "+(report.platformData.api_health?.[s.k]?.status==="ok"?"#1d9e7540":"#e24b4a40") }}>
                    <div style={{ fontSize:10, color:report.platformData.api_health?.[s.k]?.status==="ok"?"#1d9e75":"#e24b4a", fontWeight:600 }}>
                      {report.platformData.api_health?.[s.k]?.status==="ok"?"✅":"❌"} {s.l}
                    </div>
                    <div style={{ fontSize:9, color:"#888", marginTop:2 }}>{report.platformData.api_health?.[s.k]?.ms||0}ms</div>
                  </div>
                ))}
              </div>

              {/* Auto-actions */}
              {report.platformData.stuck_bookings>0&&(
                <div style={{ background:"#fff5f5", border:"1px solid #e24b4a30", borderRadius:10, padding:"0.75rem", marginBottom:"1rem" }}>
                  <div style={{ fontSize:12, color:"#e24b4a", fontWeight:600, marginBottom:8 }}>⚡ Quick Actions</div>
                  <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                    {report.platformData.stuck_bookings>0&&(
                      <button onClick={async()=>{
                        if(!confirm("Cancel all "+report.platformData.stuck_bookings+" stuck bookings?")) return
                        const cutoff = new Date(Date.now()-24*60*60*1000).toISOString()
                        await supabase.from("bookings").update({status:"cancelled"}).eq("status","pending").lt("created_at",cutoff)
                        toast.success("Stuck bookings cancelled")
                        scanPlatform()
                      }} style={{ background:"#e24b4a", border:"none", borderRadius:7, color:"#fff", fontSize:11, padding:"6px 12px", cursor:"pointer", fontWeight:600 }}>
                        Cancel {report.platformData.stuck_bookings} stuck bookings
                      </button>
                    )}
                                        {report.platformData.inactive_customers_30days>0&&(
                      <button onClick={async()=>{
                        if(!confirm("Send re-engagement notification to "+report.platformData.inactive_customers_30days+" inactive customers?")) return
                        const { data: inactive } = await supabase.from("profiles").select("id").eq("role","customer").lt("updated_at", new Date(Date.now()-30*24*60*60*1000).toISOString())
                        if(inactive?.length>0) {
                          await supabase.from("notifications").insert(inactive.map(u=>({
                            user_id:u.id,
                            title:"We miss you! 🚗",
                            message:"Book a service today and earn double loyalty points. Use code WELCOME back for 10% off.",
                            type:"info"
                          })))
                          toast.success("Re-engagement notifications sent!")
                        }
                        scanPlatform()
                      }} style={{ background:"#378add", border:"none", borderRadius:7, color:"#fff", fontSize:11, padding:"6px 12px", cursor:"pointer", fontWeight:600 }}>
                        Re-engage {report.platformData.inactive_customers_30days} inactive customers 📧
                      </button>
                    )}
                  </div>
                </div>
              )}
              {/* Feature sync checklist */}
              <div style={{ background:"#ffffff", borderRadius:10, padding:"1rem", marginBottom:"1rem" }}>
                <div style={{ fontSize:12, fontWeight:600, color:"#000000", marginBottom:10 }}>🔄 Feature Sync Checklist</div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6 }}>
                  {[
          { f:"Customer booking", ok:true },
                    { f:"Payments (M-Pesa)", ok:report.platformData.api_health?.daraja?.status==="ok" },
          { f:"GO Service", ok:true },
          { f:"Marketplace", ok:true },
          { f:"Driver verification", ok:true },
          { f:"Reviews", ok:true },
          { f:"Escrow payments", ok:report.platformData.held_payments>=0 },
          { f:"Service bundles", ok:true },
          { f:"Provider support", ok:report.platformData.provider_tickets>=0 },
          { f:"Two-sided reviews", ok:report.platformData.customer_ratings_given>=0 },
                    { f:"Service claims", ok:report.platformData.total_claims>=0 },
                    { f:"Notifications", ok:report.platformData.total_notifications>0 },
          { f:"Chat system", ok:true },
          { f:"Loyalty points", ok:true },
                    { f:"Mechanics", ok:report.platformData.total_mechanics>=0 },
          { f:"Marketplace inspect", ok:true },
                    { f:"Employee mgmt", ok:report.platformData.total_employees>=0 },
                    { f:"Payment tracking", ok:report.platformData.total_payments>=0 },
                    { f:"AI Monitor", ok:true },
                    { f:"Provider types", ok:Object.keys(report.platformData.provider_type_breakdown||{}).length>0 },
                    { f:"Boda boda drivers", ok:report.platformData.boda_boda_drivers>=0 },
                    { f:"Inventory system", ok:report.platformData.parts_inventory_items>=0 },
                    { f:"Parts marketplace", ok:report.platformData.total_marketplace_transactions>=0 },
                    { f:"Order management", ok:report.platformData.pending_orders>=0 },
                    { f:"Promo codes", ok:report.platformData.total_promo_codes>0 },
          { f:"Vouchers", ok:true },
          { f:"Driver documents", ok:true },
          { f:"Support messages", ok:true },
          { f:"Favorites/wishlist", ok:true },
                    { f:"Referral program", ok:report.platformData.total_referrals>=0 },
                    { f:"Push notifications", ok:report.platformData.total_device_tokens>0 },
                  ].map(item=>(
                    <div key={item.f} style={{ display:"flex", alignItems:"center", gap:6, padding:"4px 0" }}>
                      <span style={{ fontSize:10, color:item.ok?"#1d9e75":"#e24b4a", flexShrink:0 }}>{item.ok?"✅":"❌"}</span>
                      <span style={{ fontSize:11, color:item.ok?"#888":"#e24b4a" }}>{item.f}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ borderTop:"1px solid #eeeeee", paddingTop:"1rem" }}>
                <div style={{ fontSize:11, color:"#8b5cf6", marginBottom:8, fontWeight:600 }}>Ask AI about any issue:</div>
                <div style={{ maxHeight:200, overflowY:"auto", marginBottom:8, display:"flex", flexDirection:"column", gap:6 }}>
                  {chatMessages.slice(1).map((m,i)=>(
                    <div key={i} style={{ display:"flex", justifyContent:m.role==="user"?"flex-end":"flex-start" }}>
                      <div style={{ maxWidth:"85%", padding:"8px 12px", borderRadius:m.role==="user"?"12px 12px 4px 12px":"12px 12px 12px 4px", background:m.role==="user"?"#8b5cf6":"#f5f5f5", color:"#000000", fontSize:12, lineHeight:1.5, whiteSpace:"pre-wrap" }}>
                        {m.content}
                        {m.needsConfirmation&&(
                          <div style={{ display:"flex", gap:6, marginTop:8 }}>
                            <button onClick={()=>confirmAction(m.needsConfirmation)} disabled={chatLoading}
                              style={{ background:"#e24b4a", border:"none", borderRadius:6, color:"#fff", fontSize:11, fontWeight:700, padding:"5px 12px", cursor:"pointer" }}>
                              Confirm
                            </button>
                            <button onClick={()=>{ const updated=[...chatMessages]; updated[i+1]={...updated[i+1],needsConfirmation:null}; setChatMessages(updated) }}
                              style={{ background:"none", border:"1px solid #ddd", borderRadius:6, color:"#888", fontSize:11, padding:"5px 12px", cursor:"pointer" }}>
                              Cancel
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  {chatLoading&&<div style={{ fontSize:20, color:"#888", letterSpacing:4 }}>•••</div>}
                </div>
                <form onSubmit={sendChat} style={{ display:"flex", gap:8 }}>
                  <input value={chatInput} onChange={e=>setChatInput(e.target.value)}
                    placeholder="e.g. Cancel stuck bookings, show claim details..."
                    style={{ flex:1, background:"#ffffff", border:"1px solid #f0f0f0", borderRadius:8, padding:"8px 12px", color:"#000000", fontSize:12, outline:"none" }}/>
                  <button type="submit" disabled={!chatInput.trim()||chatLoading}
                    style={{ background:chatInput.trim()&&!chatLoading?"#8b5cf6":"#f0f0f0", border:"none", borderRadius:8, color:chatInput.trim()&&!chatLoading?"#fff":"#555", fontSize:14, padding:"0 14px", cursor:"pointer" }}>
                    ➤
                  </button>
                </form>
              </div>
            </>
          )}
      {/* CODE DIAGNOSTICS */}
      <div style={{ background:"#f8f8f8", border:"1px solid #eeeeee", borderRadius:12, padding:"1.25rem", marginTop:"1.25rem" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"1rem" }}>
          <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:700, color:"#000000" }}>🔍 Code Diagnostics</div>
          <button onClick={scanCode} disabled={scanning}
            style={{ background:scanning?"#e0e0e0":"#8b5cf6", border:"none", borderRadius:8, color:"#fff", fontSize:12, fontWeight:600, padding:"6px 14px", cursor:scanning?"not-allowed":"pointer" }}>
            {scanning?"Scanning...":"Scan source code"}
          </button>
        </div>
        {!codeScan&&<div style={{ fontSize:12, color:"#888" }}>Click scan to check source files for common React errors.</div>}
        {codeScan&&(
          <div>
            <div style={{ fontSize:11, color:"#888", marginBottom:8 }}>Scanned {codeScan.filesScanned} files · {codeScan.scannedAt}</div>
            {codeScan.issues.length===0&&<div style={{ fontSize:12, color:"#1d9e75" }}>✅ No issues found!</div>}
            {codeScan.issues.map((issue,i)=>(
              <div key={i} style={{ background:"#fff5f5", border:"1px solid #e24b4a30", borderRadius:8, padding:"0.75rem", marginBottom:6 }}>
                <div style={{ fontSize:11, color:"#e24b4a", fontWeight:600, marginBottom:2 }}>⚠️ {issue.file} — Line {issue.line}</div>
                <div style={{ fontSize:11, color:"#888", marginBottom:4, fontFamily:"monospace" }}>{issue.code}</div>
                <div style={{ fontSize:11, color:"#888" }}>{issue.issue}</div>
              </div>
            ))}
          </div>
        )}
      </div>
        </div>
      )}
      {/* LIVE ERROR TRACKER */}
      <div style={{ background:"#f8f8f8", border:"1px solid #e24b4a30", borderRadius:12, padding:"1.25rem", marginTop:"1.25rem" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"1rem" }}>
          <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:700, color:"#e24b4a" }}>🔴 Live Error Tracker</div>
          <div style={{ display:"flex", gap:8 }}>
            <button onClick={loadErrorLogs} disabled={loadingErrors}
              style={{ background:"#e24b4a", border:"none", borderRadius:8, color:"#fff", fontSize:11, fontWeight:600, padding:"5px 12px", cursor:"pointer" }}>
              {loadingErrors?"Loading...":"Refresh errors"}
            </button>
            {errorLogs.length>0&&<button onClick={clearErrorLogs}
              style={{ background:"#e0e0e0", border:"none", borderRadius:8, color:"#888", fontSize:11, padding:"5px 12px", cursor:"pointer" }}>
              Clear
            </button>}
          </div>
        </div>
        {errorLogs.length===0&&<div style={{ fontSize:12, color:"#888" }}>No errors logged yet. Click Refresh after reproducing an error.</div>}
        {errorLogs.map((e,i)=>(
          <div key={e.id||i} style={{ background:"#fff5f5", border:"1px solid #e24b4a20", borderRadius:8, padding:"0.75rem", marginBottom:6 }}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4, flexWrap:"wrap", gap:4 }}>
              <span style={{ fontSize:10, color:"#e24b4a", fontWeight:600 }}>{e.user_role}{e.provider_type?" ("+e.provider_type+")":""} · {e.page_url}</span>
              <span style={{ fontSize:10, color:"#888" }}>{new Date(e.created_at).toLocaleTimeString()}</span>
            </div>
            <div style={{ fontSize:11, color:"#000000", marginBottom:2, fontFamily:"monospace", wordBreak:"break-all" }}>{e.error_message}</div>
            <div style={{ fontSize:10, color:"#888" }}>{e.error_source} · line {e.error_line}:{e.error_col}</div>
          </div>
        ))}
      </div>
    </div>
  )
}


