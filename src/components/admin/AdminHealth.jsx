import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"
import useIsMobile from "../../lib/useIsMobile"
import toast from "react-hot-toast"

const CHECKS = [
  { key:"stuck_bookings", label:"Stuck bookings", desc:"Bookings pending >24hrs", icon:"📅", category:"business" },
  { key:"go_service_timeout", label:"GO Service timeouts", desc:"Emergency requests with no response", icon:"🚨", category:"business" },
  { key:"pending_claims", label:"Pending claims", desc:"Service claims awaiting review >24hrs", icon:"🛡️", category:"business" },
  { key:"unanswered_tickets", label:"Unanswered tickets", desc:"Support tickets open >24hrs", icon:"🎫", category:"business" },
  { key:"mileage_alerts", label:"Unresolved mileage alerts", desc:"Mileage alerts not resolved >48hrs", icon:"🚗", category:"business" },
  { key:"pending_payouts", label:"Pending payouts", desc:"Payout requests older than 7 days", icon:"💰", category:"payments" },
  { key:"unpaid_bookings", label:"Unpaid completed bookings", desc:"Completed bookings unpaid >24hrs", icon:"💳", category:"payments" },
  { key:"unverified_drivers", label:"Unverified drivers", desc:"Drivers with credentials not yet verified", icon:"🪪", category:"users" },
  { key:"expiring_vouchers", label:"Expiring vouchers", desc:"Active vouchers expiring within 3 days", icon:"🎟️", category:"users" },
  { key:"idle_drivers", label:"Idle online drivers", desc:"Drivers online >4hrs with no job", icon:"🟢", category:"users" },
  { key:"database", label:"Database connection", desc:"Supabase connection and response time", icon:"🗄️", category:"system" },
]

const CATEGORY_COLORS = {
  business:"#e6821e", payments:"#1d9e75", users:"#378add", system:"#8b5cf6"
}

const DIAGNOSTICS = {
  stuck_bookings: {
    causes:["Provider has not confirmed the booking","Provider may be offline","Provider missed the notification"],
    resolution:"Send reminder notification to provider",
    link:"/admin-dashboard/bookings",
    autoFix: async () => {
      const dayAgo = new Date(Date.now()-24*60*60*1000).toISOString()
      const { data } = await supabase.from("bookings").select("provider_id,service_name,booking_number").eq("status","pending").lt("created_at",dayAgo)
      if (!data?.length) return "No stuck bookings found"
      for (const b of data) {
        await supabase.from("notifications").insert({ user_id:b.provider_id, title:"⏰ Booking needs attention", message:`Booking #${b.booking_number} for ${b.service_name} has been pending over 24 hours. Please confirm or decline.`, type:"warning" })
      }
      return `Reminder sent to ${data.length} provider(s)`
    }
  },
  go_service_timeout: {
    causes:["No providers currently online","All nearby providers declined","Provider not checking app"],
    resolution:"Notify all active providers of pending emergency",
    link:"/admin-dashboard/mechanics",
    autoFix: async () => {
      const { data: providers } = await supabase.from("profiles").select("id").eq("role","provider").eq("is_active",true)
      if (!providers?.length) return "No providers found"
      for (const p of providers) {
        await supabase.from("notifications").insert({ user_id:p.id, title:"🚨 Emergency request waiting", message:"A customer has an emergency GO Service request with no provider response. Check your GO Requests tab.", type:"error" })
      }
      return `Alert sent to ${providers.length} provider(s)`
    }
  },
  pending_claims: {
    causes:["Admin has not reviewed the claim","High volume of claims","Claim requires investigation"],
    resolution:"Mark claims as under review to acknowledge them",
    link:"/admin-dashboard/claims",
    autoFix: async () => {
      const dayAgo = new Date(Date.now()-24*60*60*1000).toISOString()
      const { data } = await supabase.from("service_claims").select("id,customer_id").eq("status","pending").lt("created_at",dayAgo)
      if (!data?.length) return "No pending claims found"
      const ids = data.map(c=>c.id)
      await supabase.from("service_claims").update({ status:"under_review" }).in("id",ids)
      for (const c of data) {
        await supabase.from("notifications").insert({ user_id:c.customer_id, title:"Claim update 📋", message:"Your service claim is now under review. We will respond within 24 hours.", type:"info" })
      }
      return `${data.length} claim(s) marked under review`
    }
  },
  unanswered_tickets: {
    causes:["Support team missed tickets","High volume of requests","Notification not seen"],
    resolution:"Send acknowledgement to customers with open tickets",
    link:"/admin-dashboard/support",
    autoFix: async () => {
      const dayAgo = new Date(Date.now()-24*60*60*1000).toISOString()
      const { data } = await supabase.from("support_tickets").select("id,customer_id,subject").eq("status","open").lt("created_at",dayAgo)
      if (!data?.length) return "No open tickets found"
      for (const t of data) {
        await supabase.from("notifications").insert({ user_id:t.customer_id, title:"Support update", message:`Your ticket "${t.subject}" is being reviewed. We apologize for the delay.`, type:"info" })
      }
      return `Acknowledgement sent for ${data.length} ticket(s)`
    }
  },
  mileage_alerts: {
    causes:["Driver used vehicle for personal errands","Long service route","Odometer reading error"],
    resolution:"Review and resolve disputes in Disputes & Reports",
    link:"/admin-dashboard/disputes",
    autoFix: null
  },
  pending_payouts: {
    causes:["Payout not processed manually","Provider banking details incomplete"],
    resolution:"Go to Payouts page to process manually",
    link:"/admin-dashboard/payouts",
    autoFix: null
  },
  unpaid_bookings: {
    causes:["Customer paid cash but not marked paid","Payment gateway issue","Provider forgot to mark paid"],
    resolution:"Review and mark completed bookings as paid",
    link:"/admin-dashboard/bookings",
    autoFix: null
  },
  unverified_drivers: {
    causes:["Driver submitted credentials but admin not notified","Documents need manual review"],
    resolution:"Verify drivers in the Drivers section",
    link:"/admin-dashboard/drivers",
    autoFix: null
  },
  expiring_vouchers: {
    causes:["Customer not aware voucher is expiring","Customer forgot to use voucher"],
    resolution:"Send reminder to customers with expiring vouchers",
    link:"/admin-dashboard/claims",
    autoFix: async () => {
      const threeDays = new Date(Date.now()+3*24*60*60*1000).toISOString()
      const now = new Date().toISOString()
      const { data } = await supabase.from("service_vouchers").select("customer_id,voucher_code,amount,expires_at").eq("is_used",false).lt("expires_at",threeDays).gt("expires_at",now)
      if (!data?.length) return "No expiring vouchers"
      for (const v of data) {
        await supabase.from("notifications").insert({ user_id:v.customer_id, title:"⏰ Voucher expiring soon!", message:`Your voucher ${v.voucher_code} worth KES ${Number(v.amount).toLocaleString()} expires ${new Date(v.expires_at).toLocaleDateString()}. Use it before it expires!`, type:"warning" })
      }
      return `Reminder sent for ${data.length} voucher(s)`
    }
  },
  idle_drivers: {
    causes:["Driver forgot to go offline","No concierge bookings available","Driver waiting for jobs"],
    resolution:"Send reminder to go offline if not available",
    link:"/admin-dashboard/drivers",
    autoFix: async () => {
      const { data } = await supabase.from("driver_status").select("driver_id,is_online,current_booking_id,last_seen").eq("is_online",true)
      const fourHrsAgo = new Date(Date.now()-4*60*60*1000).toISOString()
      const idle = data?.filter(d=>!d.current_booking_id&&d.last_seen<fourHrsAgo)||[]
      if (!idle.length) return "No idle drivers found"
      for (const d of idle) {
        await supabase.from("notifications").insert({ user_id:d.driver_id, title:"Reminder", message:"You have been online for over 4 hours with no active job. Please go offline if you are no longer available.", type:"info" })
      }
      return `Reminder sent to ${idle.length} driver(s)`
    }
  },
  database: {
    causes:["High server load","Network latency","Supabase free tier limitations"],
    resolution:"Monitor response times — consider upgrading to Supabase Pro",
    link:"https://supabase.com/dashboard",
    autoFix: null
  },
}

function DiagnosticPanel({ checkKey, onResolved }) {
  const [expanded, setExpanded] = useState(false)
  const [resolving, setResolving] = useState(false)
  const diag = DIAGNOSTICS[checkKey]
  if (!diag) return null

  async function handleAutoFix() {
    if (!diag.autoFix) return
    setResolving(true)
    try {
      const msg = await diag.autoFix()
      toast.success(msg||"Action completed")
      if (onResolved) onResolved()
    } catch(err) { toast.error(err.message) }
    finally { setResolving(false) }
  }

  return (
    <div style={{ marginTop:8 }}>
      <button onClick={()=>setExpanded(e=>!e)}
        style={{ background:"none", border:"none", color:"#8b5cf6", fontSize:11, cursor:"pointer", padding:0, fontWeight:600 }}>
        {expanded?"▲ Hide diagnosis":"▼ Show diagnosis & fix"}
      </button>
      {expanded&&(
        <div style={{ marginTop:8, background:"#ffffff", borderRadius:8, padding:"0.9rem" }}>
          <div style={{ marginBottom:10 }}>
            <div style={{ fontSize:11, color:"#888", textTransform:"uppercase", marginBottom:6 }}>Possible causes:</div>
            {diag.causes.map((c,i)=>(
              <div key={i} style={{ display:"flex", gap:8, marginBottom:4 }}>
                <span style={{ color:"#888", flexShrink:0 }}>•</span>
                <span style={{ fontSize:11, color:"#888" }}>{c}</span>
              </div>
            ))}
          </div>
          <div style={{ marginBottom:10 }}>
            <div style={{ fontSize:11, color:"#888", textTransform:"uppercase", marginBottom:4 }}>Recommended action:</div>
            <div style={{ fontSize:12, color:"#e6821e" }}>→ {diag.resolution}</div>
          </div>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
            {diag.autoFix&&(
              <button onClick={handleAutoFix} disabled={resolving}
                style={{ background:resolving?"#e0e0e0":"#1d9e75", border:"none", borderRadius:7, color:resolving?"#555":"#fff", fontFamily:"Syne,sans-serif", fontSize:11, fontWeight:700, padding:"7px 14px", cursor:resolving?"not-allowed":"pointer" }}>
                {resolving?"Processing...":"⚡ Auto-fix"}
              </button>
            )}
            {diag.link&&(
              <a href={diag.link} target={diag.link.startsWith("http")?"_blank":"_self"}
                style={{ background:"#f5f3ff", border:"1px solid #8b5cf640", borderRadius:7, color:"#8b5cf6", fontSize:11, fontWeight:600, padding:"7px 14px", textDecoration:"none" }}>
                Go fix it →
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function AdminHealth() {
  const isMobile = useIsMobile()
  const [results, setResults] = useState({})
  const [loading, setLoading] = useState(true)
  const [lastChecked, setLastChecked] = useState(null)
  const [running, setRunning] = useState(false)
  const [logs, setLogs] = useState([])
  const [tab, setTab] = useState("dashboard")

  useEffect(() => { runChecks(); loadLogs() }, [])

  async function loadLogs() {
    const { data } = await supabase.from("system_health_logs").select("*").order("checked_at",{ascending:false}).limit(50)
    setLogs(data||[])
  }

  async function runChecks() {
    setRunning(true)
    const checkResults = {}
    const now = new Date()
    try {
      const dayAgo = new Date(now-24*60*60*1000).toISOString()
      const twoDaysAgo = new Date(now-48*60*60*1000).toISOString()
      const weekAgo = new Date(now-7*24*60*60*1000).toISOString()
      const fourHrsAgo = new Date(now-4*60*60*1000).toISOString()
      const threeDays = new Date(now.getTime()+3*24*60*60*1000).toISOString()

      // Database check
      const dbStart = Date.now()
      const { error: dbError } = await supabase.from("profiles").select("id").limit(1)
      const dbTime = Date.now() - dbStart
      checkResults.database = dbError
        ? { status:"critical", count:0, message:`Database error: ${dbError.message}`, details:[] }
        : { status:dbTime>2000?"warning":"healthy", count:0, message:`Response time: ${dbTime}ms`, details:[] }

      // All other checks
      const [
        { data: stuckBks },
        { data: goTimeouts },
        { data: pendingClaims },
        { data: openTickets },
        { data: mileageAlerts },
        { data: pendingPayouts },
        { data: unpaidBks },
        { data: unverifiedDrivers },
        { data: expiringVouchers },
        { data: onlineDrivers },
      ] = await Promise.all([
        supabase.from("bookings").select("id,booking_number,service_name,created_at").eq("status","pending").lt("created_at",dayAgo),
        supabase.from("go_service_requests").select("id,attempt_number,sent_at").eq("status","pending"),
        supabase.from("service_claims").select("id,reason,created_at").eq("status","pending").lt("created_at",dayAgo),
        supabase.from("support_tickets").select("id,subject,created_at").eq("status","open").lt("created_at",dayAgo),
        supabase.from("mileage_alerts").select("id,difference,created_at").eq("resolved",false).gt("difference",30).lt("created_at",twoDaysAgo),
        supabase.from("payout_requests").select("id,amount,created_at").eq("status","pending").lt("created_at",weekAgo),
        supabase.from("bookings").select("id,booking_number,total_amount,created_at").eq("status","completed").eq("payment_status","pending").lt("created_at",dayAgo),
        supabase.from("profiles").select("id,first_name,last_name,created_at").eq("role","driver").eq("documents_verified",false).eq("is_active",true).not("license_number","is",null),
        supabase.from("service_vouchers").select("id,voucher_code,amount,expires_at").eq("is_used",false).lt("expires_at",threeDays).gt("expires_at",now.toISOString()),
        supabase.from("driver_status").select("driver_id,is_online,current_booking_id,last_seen").eq("is_online",true),
      ])

      const idleDrivers = onlineDrivers?.filter(d=>!d.current_booking_id&&(d.last_seen||"")< fourHrsAgo)||[]

      const mk = (data, crit, warn, goodMsg, badMsg, detailFn) => ({
        status: (data?.length||0)>=crit?"critical":(data?.length||0)>=warn?"warning":"healthy",
        count: data?.length||0,
        message: (data?.length||0)>0?`${data.length} ${badMsg}`:`✓ ${goodMsg}`,
        details: data?.slice(0,5).map(detailFn)||[]
      })

      checkResults.stuck_bookings = mk(stuckBks,5,1,"All bookings processing","booking(s) stuck in pending",b=>({label:`#${b.booking_number} — ${b.service_name}`,time:b.created_at}))
      checkResults.go_service_timeout = mk(goTimeouts,1,1,"No pending emergencies","emergency request(s) awaiting response",r=>({label:`Attempt ${r.attempt_number}/5`,time:r.sent_at}))
      checkResults.pending_claims = mk(pendingClaims,3,1,"All claims reviewed","claim(s) awaiting review >24hrs",c=>({label:c.reason,time:c.created_at}))
      checkResults.unanswered_tickets = mk(openTickets,5,1,"All tickets answered","ticket(s) unanswered >24hrs",t=>({label:t.subject,time:t.created_at}))
      checkResults.mileage_alerts = mk(mileageAlerts,5,1,"All mileage alerts resolved","mileage alert(s) unresolved >48hrs",a=>({label:`${a.difference}km over threshold`,time:a.created_at}))
      checkResults.pending_payouts = mk(pendingPayouts,3,1,"All payouts processed","payout(s) pending >7 days",p=>({label:`KES ${Number(p.amount).toLocaleString()}`,time:p.created_at}))
      checkResults.unpaid_bookings = mk(unpaidBks,10,1,"All payments up to date","completed booking(s) unpaid",b=>({label:`#${b.booking_number} — KES ${Number(b.total_amount).toLocaleString()}`,time:b.created_at}))
      checkResults.unverified_drivers = mk(unverifiedDrivers,5,1,"All drivers verified","driver(s) awaiting verification",d=>({label:`${d.first_name} ${d.last_name}`,time:d.created_at}))
      checkResults.expiring_vouchers = mk(expiringVouchers,5,1,"No vouchers expiring soon","voucher(s) expiring within 3 days",v=>({label:`${v.voucher_code} — KES ${Number(v.amount).toLocaleString()}`,time:v.expires_at}))
      checkResults.idle_drivers = mk(idleDrivers,3,1,"All online drivers active","driver(s) idle online >4hrs",d=>({label:`Driver: ${d.driver_id?.slice(0,8)}`,time:d.last_seen}))

      setResults(checkResults)
      setLastChecked(new Date())

      const criticalCount = Object.values(checkResults).filter(r=>r.status==="critical").length
      const warningCount = Object.values(checkResults).filter(r=>r.status==="warning").length
      const overallStatus = criticalCount>0?"critical":warningCount>0?"warning":"healthy"

      await supabase.from("system_health_logs").insert({
        check_type:"full_scan", status:overallStatus,
        message:`${criticalCount} critical, ${warningCount} warnings`,
        affected_count:criticalCount+warningCount,
        details:checkResults,
      })

      if (criticalCount>0) toast.error(`🔴 ${criticalCount} critical issue(s) found`,{duration:8000})
      else if (warningCount>0) toast(`⚠️ ${warningCount} warning(s) found`,{duration:5000})
      else toast.success("✅ All systems healthy")
      loadLogs()
    } catch(err) {
      toast.error("Health check failed: "+err.message)
    } finally {
      setRunning(false)
      setLoading(false)
    }
  }

  const critical = Object.values(results).filter(r=>r?.status==="critical").length
  const warnings = Object.values(results).filter(r=>r?.status==="warning").length
  const healthy = Object.values(results).filter(r=>r?.status==="healthy").length
  const overallStatus = critical>0?"critical":warnings>0?"warning":"healthy"
  const overallColor = overallStatus==="critical"?"#e24b4a":overallStatus==="warning"?"#e6821e":"#1d9e75"
  const categories = [...new Set(CHECKS.map(c=>c.category))]

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"1.5rem", flexWrap:"wrap", gap:10 }}>
        <div>
          <div style={{ fontFamily:"Syne", fontSize:isMobile?16:20, fontWeight:800, color:"#000000" }}>System Health Monitor</div>
          <div style={{ fontSize:12, color:"#888", marginTop:2 }}>{lastChecked?`Last checked: ${lastChecked.toLocaleTimeString()}`:"Running checks..."}</div>
        </div>
        <button onClick={runChecks} disabled={running}
          style={{ background:running?"#e0e0e0":"#8b5cf6", border:"none", borderRadius:9, color:running?"#555":"#fff", fontFamily:"Syne,sans-serif", fontSize:13, fontWeight:700, padding:"10px 20px", cursor:running?"not-allowed":"pointer" }}>
          {running?"⏳ Checking...":"🔄 Run checks"}
        </button>
      </div>

      {/* Overall status */}
      <div style={{ background:overallStatus==="critical"?"#1a0808":overallStatus==="warning"?"#1a1208":"#071a12", border:`2px solid ${overallColor}`, borderRadius:14, padding:"1.25rem", marginBottom:"1.5rem", textAlign:"center" }}>
        <div style={{ fontSize:40, marginBottom:8 }}>{overallStatus==="critical"?"🔴":overallStatus==="warning"?"🟡":"🟢"}</div>
        <div style={{ fontFamily:"Syne", fontSize:isMobile?18:22, fontWeight:800, color:overallColor, marginBottom:4 }}>
          {overallStatus==="critical"?"CRITICAL ISSUES FOUND":overallStatus==="warning"?"WARNINGS DETECTED":"ALL SYSTEMS HEALTHY"}
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10, marginTop:12, maxWidth:360, margin:"12px auto 0" }}>
          {[
            { label:"Critical", value:critical, color:"#e24b4a" },
            { label:"Warnings", value:warnings, color:"#e6821e" },
            { label:"Healthy", value:healthy, color:"#1d9e75" },
          ].map(s=>(
            <div key={s.label} style={{ background:"rgba(0,0,0,0.3)", borderRadius:8, padding:"0.6rem" }}>
              <div style={{ fontFamily:"Syne", fontSize:20, fontWeight:800, color:s.color }}>{s.value}</div>
              <div style={{ fontSize:10, color:"#888" }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display:"flex", gap:6, marginBottom:"1.25rem" }}>
        {[{k:"dashboard",l:"Dashboard"},{k:"logs",l:`History (${logs.length})`}].map(t=>(
          <button key={t.k} onClick={()=>setTab(t.k)}
            style={{ padding:"8px 16px", borderRadius:8, border:"none", fontSize:12, cursor:"pointer", background:tab===t.k?"#8b5cf6":"#f8f8f8", color:tab===t.k?"#fff":"#666", fontFamily:"'DM Sans',sans-serif", fontWeight:tab===t.k?700:400 }}>
            {t.l}
          </button>
        ))}
      </div>

      {/* DASHBOARD */}
      {tab==="dashboard"&&(
        <div>
          {loading&&(
            <div style={{ textAlign:"center", padding:"3rem", color:"#888", fontSize:13 }}>
              <div style={{ fontSize:32, marginBottom:10 }}>⏳</div>
              Running system checks...
            </div>
          )}
          {!loading&&categories.map(cat=>(
            <div key={cat} style={{ marginBottom:"1.5rem" }}>
              <div style={{ fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.05em", color:CATEGORY_COLORS[cat], marginBottom:8 }}>
                {cat==="business"?"📊 Business":cat==="payments"?"💰 Payments":cat==="users"?"👥 Users":"🖥️ System"}
              </div>
              {CHECKS.filter(c=>c.category===cat).map(check=>{
                const result = results[check.key]
                if (!result) return null
                const color = result.status==="critical"?"#e24b4a":result.status==="warning"?"#e6821e":"#1d9e75"
                return (
                  <div key={check.key} style={{ background:"#f8f8f8", border:`1px solid ${color}30`, borderRadius:10, padding:"0.9rem", marginBottom:8 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4, flexWrap:"wrap" }}>
                          <span style={{ fontSize:16 }}>{check.icon}</span>
                          <div style={{ fontSize:13, fontWeight:600, color:"#000000" }}>{check.label}</div>
                          <span style={{ fontSize:10, padding:"2px 8px", borderRadius:10, background:`${color}20`, color }}>{result.status}</span>
                          {result.count>0&&<span style={{ fontSize:10, color:"#888" }}>{result.count} affected</span>}
                        </div>
                        <div style={{ fontSize:12, color:"#888" }}>{result.message}</div>
                      </div>
                      <div style={{ width:10, height:10, borderRadius:"50%", background:color, boxShadow:`0 0 6px ${color}`, flexShrink:0, marginTop:4 }}/>
                    </div>
                    {result.details?.length>0&&(
                      <div style={{ marginTop:8, paddingTop:8, borderTop:`1px solid ${color}20` }}>
                        {result.details.map((d,i)=>(
                          <div key={i} style={{ display:"flex", justifyContent:"space-between", fontSize:11, padding:"4px 0", borderBottom:"1px solid #f5f5f5" }}>
                            <span style={{ color:"#888" }}>{d.label}</span>
                            <span style={{ color:"#888" }}>{d.time?new Date(d.time).toLocaleString():""}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {result.status!=="healthy"&&<DiagnosticPanel checkKey={check.key} onResolved={runChecks}/>}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      )}

      {/* LOGS */}
      {tab==="logs"&&(
        <div>
          {logs.length===0&&<div style={{ color:"#888", fontSize:13, textAlign:"center", padding:"2rem" }}>No health check history yet</div>}
          {logs.map(log=>{
            const color = log.status==="critical"?"#e24b4a":log.status==="warning"?"#e6821e":"#1d9e75"
            return (
              <div key={log.id} style={{ background:"#f8f8f8", border:`1px solid ${color}20`, borderRadius:10, padding:"0.9rem", marginBottom:8 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <div>
                    <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                      <div style={{ width:8, height:8, borderRadius:"50%", background:color }}/>
                      <div style={{ fontSize:12, fontWeight:600, color }}>{log.status?.toUpperCase()}</div>
                      <div style={{ fontSize:11, color:"#888" }}>{log.affected_count} issue{log.affected_count!==1?"s":""}</div>
                    </div>
                    <div style={{ fontSize:12, color:"#888" }}>{log.message}</div>
                  </div>
                  <div style={{ fontSize:10, color:"#888", flexShrink:0 }}>{new Date(log.checked_at).toLocaleString()}</div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
