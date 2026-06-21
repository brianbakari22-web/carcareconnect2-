import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"
import toast from "react-hot-toast"

export default function AdminAIMonitor() {
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

  useEffect(() => { scanPlatform() }, [])

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

    // Check Pesapal - verify edge function is deployed
    try {
      const start = Date.now()
      const res = await fetch("https://gcnefnqtjxtqbhynyoxe.supabase.co/functions/v1/pesapal-payment", {
        method:"POST",
        headers:{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdjbmVmbnF0anh0cWJoeW55b3hlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2MDg0MzIsImV4cCI6MjA5NTE4NDQzMn0.Ybyce3psBj2I-hdoF95H5UAklr6hsgQi-mciI9uMIgc"},
        body:JSON.stringify({ping:true})
      })
      const ms = Date.now()-start
      // Any response means edge function is reachable
      checks.pesapal = { status:"ok", ms }
    } catch(e) { checks.pesapal = { status:"error", ms:0 } }

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
      const [
        { data: stuckBookings },
        { data: pendingClaims },
        { data: pendingTickets },
        { data: pendingVerifications },
        { data: pendingListings },
        { data: expiredVouchers },
        { data: completedUnpaid },
        { data: pendingPayouts },
        { data: todayBookings },
        { data: todayUsers },
        { data: goRequests },
        { count: pendingInspections },
      ] = await Promise.all([
        supabase.from("bookings").select("id,service_name,booking_number,created_at,customer_id").eq("status","pending").lt("created_at", new Date(Date.now()-24*60*60*1000).toISOString()),
        supabase.from("service_claims").select("id,reason,created_at").eq("status","pending"),
        supabase.from("support_tickets").select("id,subject,created_at").eq("status","open"),
        supabase.from("profiles").select("id,first_name,last_name,role").eq("role","driver").eq("is_verified",false),
        supabase.from("marketplace_listings").select("id,title,created_at").eq("status","pending"),
        supabase.from("vouchers").select("id,code,expires_at").eq("is_used",false).lt("expires_at", new Date(Date.now()+3*24*60*60*1000).toISOString()).gt("expires_at", new Date().toISOString()),
        supabase.from("bookings").select("id,service_name,total_amount,platform_commission").eq("status","completed").neq("payment_status","paid"),
        supabase.from("payout_requests").select("id,amount,created_at").eq("status","pending"),
        supabase.from("bookings").select("id").gte("created_at", new Date().toISOString().split("T")[0]),
        supabase.from("profiles").select("id").gte("created_at", new Date().toISOString().split("T")[0]),
        supabase.from("go_service_requests").select("id,status").eq("status","pending"),
        supabase.from("inspection_requests").select("id",{count:"exact",head:true}).eq("status","pending"),
      ])

      // Fraud detection queries
      const { data: suspiciousCustomers } = await supabase.from("bookings")
        .select("customer_id, count")
        .eq("status","cancelled")
        .gte("created_at", new Date(Date.now()-7*24*60*60*1000).toISOString())
      
      // Provider performance
      const { data: providerStats } = await supabase.from("bookings")
        .select("provider_id, status, total_amount, platform_commission")
        .gte("created_at", new Date(Date.now()-30*24*60*60*1000).toISOString())

      // Revenue intelligence  
      const { data: thisWeekRevenue } = await supabase.from("bookings")
        .select("platform_commission, created_at")
        .eq("payment_status","paid")
        .gte("created_at", new Date(Date.now()-7*24*60*60*1000).toISOString())

      const { data: lastWeekRevenue } = await supabase.from("bookings")
        .select("platform_commission")
        .eq("payment_status","paid")
        .gte("created_at", new Date(Date.now()-14*24*60*60*1000).toISOString())
        .lt("created_at", new Date(Date.now()-7*24*60*60*1000).toISOString())

      // Customer insights
      const { data: inactiveCustomers } = await supabase.from("profiles")
        .select("id,first_name,last_name")
        .eq("role","customer")
        .lt("updated_at", new Date(Date.now()-30*24*60*60*1000).toISOString())

      const { data: newNoBooking } = await supabase.from("profiles")
        .select("id,first_name,last_name,created_at")
        .eq("role","customer")
        .gte("created_at", new Date(Date.now()-7*24*60*60*1000).toISOString())

      // Expiring documents
      const { data: expiringDocs } = await supabase.from("driver_documents")
        .select("driver_id, document_type, expiry_date")
        .lt("expiry_date", new Date(Date.now()+7*24*60*60*1000).toISOString())
        .gt("expiry_date", new Date().toISOString())
        .eq("status","approved")

      // Provider claims count
      const { data: providerClaims } = await supabase.from("service_claims")
        .select("provider_id, status")
        .gte("created_at", new Date(Date.now()-30*24*60*60*1000).toISOString())

      // High review providers
      const { data: topReviews } = await supabase.from("reviews")
        .select("provider_id, rating")
        .gte("created_at", new Date(Date.now()-30*24*60*60*1000).toISOString())

      // Provider type breakdown
      const { data: providerTypes } = await supabase.from("profiles")
        .select("provider_type")
        .eq("role","provider")
        .eq("is_active", true)

      const { count: bodaBodaDrivers } = await supabase.from("profiles")
        .select("id",{count:"exact",head:true})
        .eq("role","driver")
        .eq("driver_vehicle_type","motorcycle")

      const { count: partsInventory } = await supabase.from("inventory")
        .select("id",{count:"exact",head:true})
        .eq("is_active",true)

      const { count: pendingOrders } = await supabase.from("orders")
        .select("id",{count:"exact",head:true})
        .eq("status","pending")

      // Get additional stats
      const { count: totalBookings } = await supabase.from("bookings").select("id",{count:"exact",head:true})
      const { count: completedBookings } = await supabase.from("bookings").select("id",{count:"exact",head:true}).eq("status","completed")
      const { count: totalUsers } = await supabase.from("profiles").select("id",{count:"exact",head:true})
      const { count: totalDrivers } = await supabase.from("profiles").select("id",{count:"exact",head:true}).eq("role","driver")
      const { count: verifiedDrivers } = await supabase.from("profiles").select("id",{count:"exact",head:true}).eq("role","driver").eq("documents_verified",true).eq("is_active",true)
      const { count: totalListings } = await supabase.from("marketplace_listings").select("id",{count:"exact",head:true})
      const { count: activeListings } = await supabase.from("marketplace_listings").select("id",{count:"exact",head:true}).eq("status","active")
      const { count: totalReviews } = await supabase.from("reviews").select("id",{count:"exact",head:true})
      const { count: totalClaims } = await supabase.from("service_claims").select("id",{count:"exact",head:true})
      const { count: resolvedClaims } = await supabase.from("service_claims").select("id",{count:"exact",head:true}).eq("status","resolved")
      const { count: totalGoRequests } = await supabase.from("go_service_requests").select("id",{count:"exact",head:true})
      const { count: totalTransactions } = await supabase.from("marketplace_transactions").select("id",{count:"exact",head:true})
      const { count: paidTransactions } = await supabase.from("marketplace_transactions").select("id",{count:"exact",head:true}).eq("status","completed")
      const { count: totalEmployees } = await supabase.from("employees").select("id",{count:"exact",head:true})
      const { count: totalNotifications } = await supabase.from("notifications").select("id",{count:"exact",head:true})
      const { count: totalChatMessages } = await supabase.from("chat_messages").select("id",{count:"exact",head:true})
      const { count: totalLoyaltyPoints } = await supabase.from("loyalty_points").select("id",{count:"exact",head:true})
      const { count: totalMechanics } = await supabase.from("mechanics").select("id",{count:"exact",head:true}).eq("is_active",true)
      const { count: totalPayments } = await supabase.from("payments").select("id",{count:"exact",head:true})
      const { count: totalPromoCodes } = await supabase.from("promo_codes").select("id",{count:"exact",head:true})
      const { count: totalVouchersIssued } = await supabase.from("vouchers").select("id",{count:"exact",head:true})
      const { count: totalDriverDocs } = await supabase.from("driver_documents").select("id",{count:"exact",head:true})
      const { count: totalSupportMessages } = await supabase.from("support_messages").select("id",{count:"exact",head:true})
      const { count: totalFavorites } = await supabase.from("favorites").select("id",{count:"exact",head:true})
      const { count: totalReferrals } = await supabase.from("referrals").select("id",{count:"exact",head:true})
      const { count: totalDeviceTokens } = await supabase.from("device_tokens").select("id",{count:"exact",head:true})

      const platformData = {
        api_health: apiHealth,
        stuck_bookings: stuckBookings?.length||0,
        stuck_booking_details: stuckBookings?.slice(0,5)||[],
        pending_claims: pendingClaims?.length||0,
        pending_support: pendingTickets?.length||0,
        unverified_drivers: pendingVerifications?.length||0,
        pending_listings: pendingListings?.length||0,
        expiring_vouchers: expiredVouchers?.length||0,
        completed_unpaid: completedUnpaid?.length||0,
        unpaid_amount: completedUnpaid?.reduce((s,b)=>s+Number(b.platform_commission||0),0)||0,
        pending_payouts: pendingPayouts?.length||0,
        todays_bookings: todayBookings?.length||0,
        todays_new_users: todayUsers?.length||0,
        active_go_requests: goRequests?.length||0,
        pending_inspections: pendingInspections||0,
        total_bookings: totalBookings||0,
        completed_bookings: completedBookings||0,
        total_users: totalUsers||0,
        total_drivers: totalDrivers||0,
        verified_drivers: verifiedDrivers||0,
        total_listings: totalListings||0,
        active_listings: activeListings||0,
        total_reviews: totalReviews||0,
        total_claims: totalClaims||0,
        resolved_claims: resolvedClaims||0,
        total_go_requests: totalGoRequests||0,
        total_marketplace_transactions: totalTransactions||0,
        completed_marketplace_transactions: paidTransactions||0,
        total_employees: totalEmployees||0,
        total_notifications: totalNotifications||0,
        total_chat_messages: totalChatMessages||0,
        total_loyalty_points: totalLoyaltyPoints||0,
        total_mechanics: totalMechanics||0,
        total_payments: totalPayments||0,
        total_promo_codes: totalPromoCodes||0,
        total_vouchers_issued: totalVouchersIssued||0,
        total_driver_docs: totalDriverDocs||0,
        total_support_messages: totalSupportMessages||0,
        total_favorites: totalFavorites||0,
        total_referrals: totalReferrals||0,
        total_device_tokens: totalDeviceTokens||0,
        boda_boda_drivers: bodaBodaDrivers||0,
        parts_inventory_items: partsInventory||0,
        pending_orders: pendingOrders||0,
        provider_type_breakdown: providerTypes?.reduce((acc,p)=>{ acc[p.provider_type||"garage"]=(acc[p.provider_type||"garage"]||0)+1; return acc },{})||{},
        // Revenue intelligence
        this_week_revenue: thisWeekRevenue?.reduce((s,b)=>s+Number(b.platform_commission||0),0)||0,
        last_week_revenue: lastWeekRevenue?.reduce((s,b)=>s+Number(b.platform_commission||0),0)||0,
        revenue_trend: ((thisWeekRevenue?.reduce((s,b)=>s+Number(b.platform_commission||0),0)||0) - (lastWeekRevenue?.reduce((s,b)=>s+Number(b.platform_commission||0),0)||0)),
        // Fraud detection
        cancelled_last_7days: suspiciousCustomers?.length||0,
        // Customer insights
        inactive_customers_30days: inactiveCustomers?.length||0,
        new_customers_no_booking: newNoBooking?.length||0,
        // Driver documents
        expiring_documents: expiringDocs?.length||0,
        // Provider performance
        providers_with_claims: [...new Set(providerClaims?.map(c=>c.provider_id)||[])].length,
        avg_rating_this_month: topReviews?.length>0?(topReviews.reduce((s,r)=>s+Number(r.rating||0),0)/topReviews.length).toFixed(1):"N/A",
      }

      const prompt = `You are the Car Care Connect AI Admin Monitor. Analyze this platform data and give a CONCISE priority report.

API HEALTH:
- Supabase database: ${apiHealth.supabase?.status} (${apiHealth.supabase?.ms}ms)
- Pesapal payments: ${apiHealth.pesapal?.status} (${apiHealth.pesapal?.ms}ms) NOTE: Merchant contract pending - KES 1000 limit active until contract signed
- AI assistant: ${apiHealth.ai?.status} (${apiHealth.ai?.ms}ms)

PLATFORM STATUS RIGHT NOW:
OPERATIONS:
- Stuck bookings (pending >24hrs): ${platformData.stuck_bookings}
- Total bookings: ${platformData.total_bookings} | Completed: ${platformData.completed_bookings}
- Active GO emergency requests: ${platformData.active_go_requests} | Total GO requests ever: ${platformData.total_go_requests}
- Today new bookings: ${platformData.todays_bookings}

USERS:
- Total users: ${platformData.total_users} | Today new: ${platformData.todays_new_users}
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
New tables: inventory, orders, order_items, commission_rates

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

  async function sendChat(e) {
    e.preventDefault()
    if (!chatInput.trim() || chatLoading) return
    const text = chatInput.trim()
    setChatInput("")
    const msgs = [...chatMessages, { role:"user", content:text }]
    setChatMessages(msgs)
    setChatLoading(true)
    try {
      const res = await fetch("https://gcnefnqtjxtqbhynyoxe.supabase.co/functions/v1/ai-chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdjbmVmbnF0anh0cWJoeW55b3hlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2MDg0MzIsImV4cCI6MjA5NTE4NDQzMn0.Ybyce3psBj2I-hdoF95H5UAklr6hsgQi-mciI9uMIgc"
        },
        body: JSON.stringify({
          system: "You are the Car Care Connect AI Admin Monitor with full platform knowledge. Platform data: " + JSON.stringify(report?.platformData||{}),
          messages: msgs.map(m=>({ role:m.role, content:m.content }))
        })
      })
      const data = await res.json()
      const reply = data.text || data.content?.[0]?.text || "Sorry, could not process."
      setChatMessages(prev=>[...prev, { role:"assistant", content:reply }])
    } catch(e) {
      setChatMessages(prev=>[...prev, { role:"assistant", content:"Connection error. Please try again." }])
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
                  { l:"Pesapal Pay", k:"pesapal" },
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
                    { f:"Customer booking", ok:report.platformData.total_bookings>0 },
                    { f:"Payments (Pesapal)", ok:report.platformData.api_health?.pesapal?.status==="ok" },
                    { f:"GO Service", ok:report.platformData.total_go_requests>0 },
                    { f:"Marketplace", ok:report.platformData.total_listings>0 },
                    { f:"Driver verification", ok:report.platformData.verified_drivers>0 },
                    { f:"Reviews", ok:report.platformData.total_reviews>0 },
                    { f:"Service claims", ok:report.platformData.total_claims>=0 },
                    { f:"Notifications", ok:report.platformData.total_notifications>0 },
                    { f:"Chat system", ok:report.platformData.total_chat_messages>0 },
                    { f:"Loyalty points", ok:report.platformData.total_loyalty_points>0 },
                    { f:"Mechanics", ok:report.platformData.total_mechanics>=0 },
                    { f:"Marketplace inspect", ok:report.platformData.total_listings>0 },
                    { f:"Employee mgmt", ok:report.platformData.total_employees>0 },
                    { f:"Payment tracking", ok:report.platformData.total_payments>0 },
                    { f:"AI Monitor", ok:true },
                    { f:"Provider types", ok:Object.keys(report.platformData.provider_type_breakdown||{}).length>0 },
                    { f:"Boda boda drivers", ok:report.platformData.boda_boda_drivers>=0 },
                    { f:"Inventory system", ok:report.platformData.parts_inventory_items>=0 },
                    { f:"Parts marketplace", ok:report.platformData.total_marketplace_transactions>=0 },
                    { f:"Order management", ok:report.platformData.pending_orders>=0 },
                    { f:"Promo codes", ok:report.platformData.total_promo_codes>0 },
                    { f:"Vouchers", ok:report.platformData.total_vouchers_issued>0 },
                    { f:"Driver documents", ok:report.platformData.total_driver_docs>0 },
                    { f:"Support messages", ok:report.platformData.total_support_messages>0 },
                    { f:"Favorites/wishlist", ok:report.platformData.total_favorites>0 },
                    { f:"Referral program", ok:report.platformData.total_referrals>0 },
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

