import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"
import useIsMobile from "../../lib/useIsMobile"
import toast from "react-hot-toast"

const CHECKS = [
  { key:"stuck_bookings", label:"Stuck bookings", desc:"Bookings pending >24hrs", icon:"📅", category:"business" },
  { key:"go_service_timeout", label:"GO Service timeouts", desc:"Emergency requests with no provider response", icon:"🚨", category:"business" },
  { key:"pending_claims", label:"Pending claims", desc:"Service claims awaiting review >24hrs", icon:"🛡️", category:"business" },
  { key:"pending_payouts", label:"Pending payouts", desc:"Payout requests older than 7 days", icon:"💰", category:"payments" },
  { key:"unpaid_bookings", label:"Unpaid completed bookings", desc:"Completed bookings still unpaid >24hrs", icon:"💳", category:"payments" },
  { key:"unverified_drivers", label:"Unverified drivers", desc:"Drivers with credentials submitted but not verified", icon:"🚗", category:"users" },
  { key:"mileage_alerts", label:"Unresolved mileage alerts", desc:"Mileage alerts not resolved >48hrs", icon:"🚗", category:"business" },
  { key:"unanswered_tickets", label:"Unanswered support tickets", desc:"Support tickets open >24hrs", icon:"🎫", category:"business" },
  { key:"expiring_vouchers", label:"Expiring vouchers", desc:"Active vouchers expiring within 3 days", icon:"🎟️", category:"users" },
  { key:"online_drivers", label:"Idle online drivers", desc:"Drivers online >4hrs with no job", icon:"🟢", category:"users" },
  { key:"provider_services", label:"Providers without services", desc:"Active providers with no services listed", icon:"🏪", category:"users" },
  { key:"database", label:"Database connection", desc:"Supabase connection and response time", icon:"🗄️", category:"system" },
]

const CATEGORY_COLORS = {
  business: "#e6821e",
  payments: "#1d9e75",
  users: "#378add",
  system: "#8b5cf6",
}

export default function AdminHealth() {
  const isMobile = useIsMobile()
  const [results, setResults] = useState({})
  const [loading, setLoading] = useState(true)
  const [lastChecked, setLastChecked] = useState(null)
  const [running, setRunning] = useState(false)
  const [logs, setLogs] = useState([])
  const [tab, setTab] = useState("dashboard")

  useEffect(() => {
    runChecks()
    loadLogs()
  }, [])

  async function loadLogs() {
    const { data } = await supabase.from("system_health_logs")
      .select("*").order("checked_at",{ascending:false}).limit(50)
    setLogs(data||[])
  }

  async function runChecks() {
    setRunning(true)
    const checkResults = {}
    const now = new Date()

    try {
      // 1. Database connection
      const dbStart = Date.now()
      const { error: dbError } = await supabase.from("profiles").select("id").limit(1)
      const dbTime = Date.now() - dbStart
      checkResults.database = dbError
        ? { status:"critical", count:0, message:`Database error: ${dbError.message}`, details:[] }
        : { status:dbTime>2000?"warning":"healthy", count:0, message:`Response time: ${dbTime}ms`, details:[] }

      // 2. Stuck bookings >24hrs
      const dayAgo = new Date(now-24*60*60*1000).toISOString()
      const { data: stuckBks } = await supabase.from("bookings")
        .select("id,booking_number,service_name,created_at").eq("status","pending").lt("created_at",dayAgo)
      checkResults.stuck_bookings = {
        status: stuckBks?.length>5?"critical":stuckBks?.length>0?"warning":"healthy",
        count: stuckBks?.length||0,
        message: stuckBks?.length>0?`${stuckBks.length} booking(s) stuck in pending`:"All bookings processing normally",
        details: stuckBks?.slice(0,5).map(b=>({id:b.id,label:`#${b.booking_number} — ${b.service_name}`,time:b.created_at}))||[]
      }

      // 3. GO Service timeouts
      const { data: goTimeouts } = await supabase.from("go_service_requests")
        .select("id,booking_id,attempt_number,sent_at").eq("status","pending")
      checkResults.go_service_timeout = {
        status: goTimeouts?.length>0?"critical":"healthy",
        count: goTimeouts?.length||0,
        message: goTimeouts?.length>0?`${goTimeouts.length} emergency request(s) awaiting response`:"No pending emergency requests",
        details: goTimeouts?.slice(0,5).map(r=>({id:r.id,label:`Attempt ${r.attempt_number}/5`,time:r.sent_at}))||[]
      }

      // 4. Pending claims >24hrs
      const { data: pendingClaims } = await supabase.from("service_claims")
        .select("id,reason,created_at").eq("status","pending").lt("created_at",dayAgo)
      checkResults.pending_claims = {
        status: pendingClaims?.length>3?"critical":pendingClaims?.length>0?"warning":"healthy",
        count: pendingClaims?.length||0,
        message: pendingClaims?.length>0?`${pendingClaims.length} claim(s) awaiting review`:"All claims reviewed",
        details: pendingClaims?.slice(0,5).map(c=>({id:c.id,label:c.reason,time:c.created_at}))||[]
      }

      // 5. Pending payouts >7 days
      const weekAgo = new Date(now-7*24*60*60*1000).toISOString()
      const { data: pendingPayouts } = await supabase.from("payout_requests")
        .select("id,amount,created_at").eq("status","pending").lt("created_at",weekAgo)
      checkResults.pending_payouts = {
        status: pendingPayouts?.length>0?"warning":"healthy",
        count: pendingPayouts?.length||0,
        message: pendingPayouts?.length>0?`${pendingPayouts.length} payout(s) pending >7 days`:"All payouts processed",
        details: pendingPayouts?.slice(0,5).map(p=>({id:p.id,label:`KES ${Number(p.amount).toLocaleString()}`,time:p.created_at}))||[]
      }

      // 6. Unpaid completed bookings >24hrs
      const { data: unpaidBks } = await supabase.from("bookings")
        .select("id,booking_number,total_amount,created_at").eq("status","completed").eq("payment_status","pending").lt("created_at",dayAgo)
      checkResults.unpaid_bookings = {
        status: unpaidBks?.length>10?"critical":unpaidBks?.length>0?"warning":"healthy",
        count: unpaidBks?.length||0,
        message: unpaidBks?.length>0?`${unpaidBks.length} completed booking(s) unpaid`:"All payments up to date",
        details: unpaidBks?.slice(0,5).map(b=>({id:b.id,label:`#${b.booking_number} — KES ${Number(b.total_amount).toLocaleString()}`,time:b.created_at}))||[]
      }

      // 7. Unverified drivers with credentials
      const { data: unverifiedDrivers } = await supabase.from("profiles")
        .select("id,first_name,last_name,created_at").eq("role","driver").eq("documents_verified",false).eq("is_active",true).not("license_number","is",null)
      checkResults.unverified_drivers = {
        status: unverifiedDrivers?.length>0?"warning":"healthy",
        count: unverifiedDrivers?.length||0,
        message: unverifiedDrivers?.length>0?`${unverifiedDrivers.length} driver(s) awaiting verification`:"All drivers verified",
        details: unverifiedDrivers?.slice(0,5).map(d=>({id:d.id,label:`${d.first_name} ${d.last_name}`,time:d.created_at}))||[]
      }

      // 8. Unresolved mileage alerts >48hrs
      const twoDaysAgo = new Date(now-48*60*60*1000).toISOString()
      const { data: mileageAlerts } = await supabase.from("mileage_alerts")
        .select("id,difference,created_at").eq("resolved",false).gt("difference",30).lt("created_at",twoDaysAgo)
      checkResults.mileage_alerts = {
        status: mileageAlerts?.length>0?"warning":"healthy",
        count: mileageAlerts?.length||0,
        message: mileageAlerts?.length>0?`${mileageAlerts.length} mileage alert(s) unresolved`:"All mileage alerts resolved",
        details: mileageAlerts?.slice(0,5).map(a=>({id:a.id,label:`${a.difference}km over threshold`,time:a.created_at}))||[]
      }

      // 9. Unanswered support tickets >24hrs
      const { data: openTickets } = await supabase.from("support_tickets")
        .select("id,subject,created_at").eq("status","open").lt("created_at",dayAgo)
      checkResults.unanswered_tickets = {
        status: openTickets?.length>5?"critical":openTickets?.length>0?"warning":"healthy",
        count: openTickets?.length||0,
        message: openTickets?.length>0?`${openTickets.length} support ticket(s) unanswered`:"All tickets answered",
        details: openTickets?.slice(0,5).map(t=>({id:t.id,label:t.subject,time:t.created_at}))||[]
      }

      // 10. Expiring vouchers within 3 days
      const threeDays = new Date(now+3*24*60*60*1000).toISOString()
      const { data: expiringVouchers } = await supabase.from("service_vouchers")
        .select("id,voucher_code,amount,expires_at").eq("is_used",false).lt("expires_at",threeDays).gt("expires_at",now.toISOString())
      checkResults.expiring_vouchers = {
        status: expiringVouchers?.length>0?"warning":"healthy",
        count: expiringVouchers?.length||0,
        message: expiringVouchers?.length>0?`${expiringVouchers.length} voucher(s) expiring within 3 days`:"No vouchers expiring soon",
        details: expiringVouchers?.slice(0,5).map(v=>({id:v.id,label:`${v.voucher_code} — KES ${Number(v.amount).toLocaleString()}`,time:v.expires_at}))||[]
      }

      // 11. Idle online drivers >4hrs
      const fourHrsAgo = new Date(now-4*60*60*1000).toISOString()
      const { data: idleDrivers } = await supabase.from("driver_status")
        .select("driver_id,last_seen").eq("is_online",true).is("current_booking_id",null).lt("last_seen",fourHrsAgo)
      checkResults.online_drivers = {
        status: idleDrivers?.length>0?"warning":"healthy",
        count: idleDrivers?.length||0,
        message: idleDrivers?.length>0?`${idleDrivers.length} driver(s) online >4hrs with no job`:"All online drivers active",
        details: idleDrivers?.slice(0,5).map(d=>({id:d.driver_id,label:`Driver ID: ${d.driver_id?.slice(0,8)}`,time:d.last_seen}))||[]
      }

      // 12. Providers without services
      const { data: allProviders } = await supabase.from("profiles").select("id").eq("role","provider").eq("is_active",true)
      const { data: activeServices } = await supabase.from("services").select("provider_id").eq("is_active",true)
      const activeProviderIds = [...new Set(activeServices?.map(s=>s.provider_id)||[])]
      const providersNoServices = allProviders?.filter(p=>!activeProviderIds.includes(p.id))||[]
      checkResults.provider_services = {
        status: providersNoServices.length>3?"warning":providersNoServices.length>0?"warning":"healthy",
        count: providersNoServices.length,
        message: providersNoServices.length>0?`${providersNoServices.length} provider(s) with no active services`:"All providers have active services",
        details: []
      }

      setResults(checkResults)
      setLastChecked(new Date())

      // Save to health log
      const criticalChecks = Object.entries(checkResults).filter(([,v])=>v.status==="critical")
      const warningChecks = Object.entries(checkResults).filter(([,v])=>v.status==="warning")
      const overallStatus = criticalChecks.length>0?"critical":warningChecks.length>0?"warning":"healthy"

      await supabase.from("system_health_logs").insert({
        check_type: "full_scan",
        status: overallStatus,
        message: `${criticalChecks.length} critical, ${warningChecks.length} warnings, ${CHECKS.length-criticalChecks.length-warningChecks.length} healthy`,
        affected_count: criticalChecks.length+warningChecks.length,
        details: checkResults,
      })

      if (criticalChecks.length>0) {
        toast.error(`⚠️ ${criticalChecks.length} critical issue(s) found`, { duration:8000 })
      } else if (warningChecks.length>0) {
        toast(`${warningChecks.length} warning(s) found`, { icon:"⚠️", duration:5000 })
      } else {
        toast.success("All systems healthy ✅")
      }

      loadLogs()
    } catch(err) {
      toast.error("Health check failed: " + err.message)
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
      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"1.5rem", flexWrap:"wrap", gap:10 }}>
        <div>
          <div style={{ fontFamily:"Syne", fontSize:isMobile?16:20, fontWeight:800, color:"#f0ede6" }}>System Health Monitor</div>
          <div style={{ fontSize:12, color:"#555", marginTop:2 }}>
            {lastChecked?`Last checked: ${lastChecked.toLocaleTimeString()}`:"Running checks..."}
          </div>
        </div>
        <button onClick={runChecks} disabled={running}
          style={{ background:running?"#333":"#8b5cf6", border:"none", borderRadius:9, color:running?"#555":"#fff", fontFamily:"Syne,sans-serif", fontSize:13, fontWeight:700, padding:"10px 20px", cursor:running?"not-allowed":"pointer" }}>
          {running?"⏳ Checking...":"🔄 Run checks"}
        </button>
      </div>

      {/* Overall status */}
      <div style={{ background:overallStatus==="critical"?"#1a0808":overallStatus==="warning"?"#1a1208":"#071a12", border:`2px solid ${overallColor}`, borderRadius:14, padding:"1.25rem", marginBottom:"1.5rem", textAlign:"center" }}>
        <div style={{ fontSize:40, marginBottom:8 }}>
          {overallStatus==="critical"?"🔴":overallStatus==="warning"?"🟡":"🟢"}
        </div>
        <div style={{ fontFamily:"Syne", fontSize:isMobile?18:24, fontWeight:800, color:overallColor, marginBottom:4 }}>
          {overallStatus==="critical"?"CRITICAL ISSUES FOUND":overallStatus==="warning"?"WARNINGS DETECTED":"ALL SYSTEMS HEALTHY"}
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10, marginTop:12, maxWidth:400, margin:"12px auto 0" }}>
          {[
            { label:"Critical", value:critical, color:"#e24b4a" },
            { label:"Warnings", value:warnings, color:"#e6821e" },
            { label:"Healthy", value:healthy, color:"#1d9e75" },
          ].map(s=>(
            <div key={s.label} style={{ background:"rgba(0,0,0,0.3)", borderRadius:8, padding:"0.6rem" }}>
              <div style={{ fontFamily:"Syne", fontSize:20, fontWeight:800, color:s.color }}>{s.value}</div>
              <div style={{ fontSize:10, color:"#555" }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display:"flex", gap:6, marginBottom:"1.25rem", flexWrap:"wrap" }}>
        {[
          { k:"dashboard", l:"Dashboard" },
          { k:"logs", l:`History (${logs.length})` },
        ].map(t=>(
          <button key={t.k} onClick={()=>setTab(t.k)}
            style={{ padding:"8px 16px", borderRadius:8, border:"none", fontSize:12, cursor:"pointer", background:tab===t.k?"#8b5cf6":"#111", color:tab===t.k?"#fff":"#666", fontFamily:"'DM Sans',sans-serif", fontWeight:tab===t.k?700:400 }}>
            {t.l}
          </button>
        ))}
      </div>

      {/* DASHBOARD TAB */}
      {tab==="dashboard"&&(
        <div>
          {loading&&(
            <div style={{ textAlign:"center", padding:"3rem", color:"#555", fontSize:13 }}>
              <div style={{ fontSize:32, marginBottom:10 }}>⏳</div>
              Running system checks...
            </div>
          )}

          {!loading&&categories.map(cat=>(
            <div key={cat} style={{ marginBottom:"1.5rem" }}>
              <div style={{ fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.05em", color:CATEGORY_COLORS[cat], marginBottom:8 }}>
                {cat === "business" ? "📊 Business" : cat === "payments" ? "💰 Payments" : cat === "users" ? "👥 Users" : "🖥️ System"}
              </div>
              {CHECKS.filter(c=>c.category===cat).map(check=>{
                const result = results[check.key]
                if (!result) return null
                const color = result.status==="critical"?"#e24b4a":result.status==="warning"?"#e6821e":"#1d9e75"
                const bg = result.status==="critical"?"#1a0808":result.status==="warning"?"#1a1208":"#071a12"
                return (
                  <div key={check.key} style={{ background:"#111", border:`1px solid ${color}30`, borderRadius:10, padding:"0.9rem", marginBottom:8 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                          <span style={{ fontSize:16 }}>{check.icon}</span>
                          <div style={{ fontSize:13, fontWeight:600, color:"#f0ede6" }}>{check.label}</div>
                          <span style={{ fontSize:10, padding:"2px 8px", borderRadius:10, background:`${color}20`, color }}>
                            {result.status}
                          </span>
                          {result.count>0&&<span style={{ fontSize:10, color:"#555" }}>{result.count} affected</span>}
                        </div>
                        <div style={{ fontSize:12, color:"#666" }}>{result.message}</div>
                      </div>
                      <div style={{ width:10, height:10, borderRadius:"50%", background:color, boxShadow:`0 0 6px ${color}`, flexShrink:0, marginTop:4 }}/>
                    </div>

                    {result.details?.length>0&&(
                      <div style={{ marginTop:8, paddingTop:8, borderTop:`1px solid ${color}20` }}>
                        {result.details.map((d,i)=>(
                          <div key={i} style={{ display:"flex", justifyContent:"space-between", fontSize:11, padding:"4px 0", borderBottom:"1px solid #1a1a1a" }}>
                            <span style={{ color:"#888" }}>{d.label}</span>
                            <span style={{ color:"#444" }}>{d.time?new Date(d.time).toLocaleString():""}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {result.status!=="healthy"&&(
                      <div style={{ marginTop:8 }}>
                        <ActionButton checkKey={check.key} />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      )}

      {/* LOGS TAB */}
      {tab==="logs"&&(
        <div>
          {logs.length===0&&<div style={{ color:"#444", fontSize:13, textAlign:"center", padding:"2rem" }}>No health check history yet</div>}
          {logs.map(log=>{
            const color = log.status==="critical"?"#e24b4a":log.status==="warning"?"#e6821e":"#1d9e75"
            return (
              <div key={log.id} style={{ background:"#111", border:`1px solid ${color}20`, borderRadius:10, padding:"0.9rem", marginBottom:8 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <div>
                    <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                      <div style={{ width:8, height:8, borderRadius:"50%", background:color }}/>
                      <div style={{ fontSize:12, fontWeight:600, color:color }}>{log.status?.toUpperCase()}</div>
                      <div style={{ fontSize:11, color:"#555" }}>{log.affected_count} issue{log.affected_count!==1?"s":""}</div>
                    </div>
                    <div style={{ fontSize:12, color:"#888" }}>{log.message}</div>
                  </div>
                  <div style={{ fontSize:10, color:"#444", flexShrink:0, textAlign:"right" }}>
                    {new Date(log.checked_at).toLocaleString()}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function ActionButton({ checkKey }) {
  const actions = {
    stuck_bookings: { label:"Go to bookings →", path:"/admin-dashboard/bookings" },
    go_service_timeout: { label:"Go to GO requests →", path:"/admin-dashboard/mechanics" },
    pending_claims: { label:"Review claims →", path:"/admin-dashboard/claims" },
    pending_payouts: { label:"Process payouts →", path:"/admin-dashboard/payouts" },
    unpaid_bookings: { label:"Go to bookings →", path:"/admin-dashboard/bookings" },
    unverified_drivers: { label:"Verify drivers →", path:"/admin-dashboard/drivers" },
    mileage_alerts: { label:"Review alerts →", path:"/admin-dashboard/disputes" },
    unanswered_tickets: { label:"Answer tickets →", path:"/admin-dashboard/support" },
    expiring_vouchers: { label:"View claims →", path:"/admin-dashboard/claims" },
    online_drivers: { label:"View drivers →", path:"/admin-dashboard/drivers" },
    provider_services: { label:"View providers →", path:"/admin-dashboard/providers" },
  }
  const action = actions[checkKey]
  if (!action) return null
  return (
    <a href={action.path}
      style={{ fontSize:11, color:"#8b5cf6", textDecoration:"none", fontWeight:600 }}>
      {action.label}
    </a>
  )
}
