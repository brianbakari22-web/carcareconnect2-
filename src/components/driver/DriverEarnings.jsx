import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"
import { useAuth } from "../../contexts/AuthContext"
import useIsMobile from "../../lib/useIsMobile"

export default function DriverEarnings() {
  const { user } = useAuth()
  const isMobile = useIsMobile()
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState("week")
  const [expanded, setExpanded] = useState(null)

  useEffect(() => { if (user) load() }, [user])

  async function load() {
    const { data } = await supabase.from("bookings")
      .select("*, vehicles(make,model,license_plate)")
      .eq("driver_id", user.id)
      .eq("status", "completed")
      .order("created_at", { ascending:false })
    setBookings(data||[])
    setLoading(false)
  }

  function filterByPeriod(bks) {
    const now = new Date()
    if (period==="today") {
      const today = now.toISOString().split("T")[0]
      return bks.filter(b=>b.booking_date===today)
    }
    if (period==="week") {
      const weekAgo = new Date(now-7*24*60*60*1000)
      return bks.filter(b=>new Date(b.booking_date)>=weekAgo)
    }
    if (period==="month") {
      const monthAgo = new Date(now-30*24*60*60*1000)
      return bks.filter(b=>new Date(b.booking_date)>=monthAgo)
    }
    return bks
  }

  const filtered = filterByPeriod(bookings)

  const totalCommission = filtered.reduce((s,b)=>s+Number(b.total_amount||0)*0.15, 0)
  const totalAllowance = filtered.reduce((s,b)=>s+Number(b.transport_allowance||200), 0)
  const totalEarnings = filtered.reduce((s,b)=>s+Number(b.driver_earnings||0), 0)
  const totalJobs = filtered.length
  const avgPerJob = totalJobs ? (totalEarnings/totalJobs).toFixed(0) : 0
  const unpaidCount = filtered.filter(b=>b.payment_status!=="paid").length

  return (
    <div>
      <div style={{ fontFamily:"Syne", fontSize:isMobile?16:18, fontWeight:800, color:"#000000", marginBottom:"1.25rem" }}>Earnings & History</div>

      {/* Period filter */}
      <div style={{ display:"flex", gap:6, marginBottom:"1.25rem" }}>
        {["today","week","month","all"].map(p=>(
          <button key={p} onClick={()=>setPeriod(p)}
            style={{ padding:"7px 16px", borderRadius:8, border:"none", fontSize:12, cursor:"pointer", background:period===p?"#1d9e75":"#111", color:period===p?"#fff":"#666", fontFamily:"'DM Sans',sans-serif", fontWeight:period===p?700:400 }}>
            {p==="today"?"Today":p==="week"?"This week":p==="month"?"This month":"All time"}
          </button>
        ))}
      </div>

      {/* Earnings breakdown */}
      <div style={{ background:"#f0fdf4", border:"1px solid #1d9e7540", borderRadius:12, padding:"1.25rem", marginBottom:"1.5rem" }}>
        <div style={{ fontFamily:"Syne", fontSize:13, fontWeight:700, color:"#1d9e75", marginBottom:"1rem" }}>💰 Earnings breakdown</div>
        <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr 1fr":"repeat(4,1fr)", gap:10, marginBottom:12 }}>
          {[
            { label:"Commission (15%)", value:`KES ${totalCommission.toFixed(0)}`, color:"#378add" },
            { label:"Transport allowance", value:`KES ${totalAllowance.toFixed(0)}`, color:"#e6821e" },
            { label:"Total earned", value:`KES ${totalEarnings.toFixed(0)}`, color:"#1d9e75" },
            { label:"Avg per job", value:`KES ${Number(avgPerJob).toLocaleString()}`, color:"#8b5cf6" },
          ].map(s=>(
            <div key={s.label} style={{ background:"#ffffff", borderRadius:8, padding:"0.75rem", textAlign:"center" }}>
              <div style={{ fontFamily:"Syne", fontSize:isMobile?13:16, fontWeight:800, color:s.color }}>{s.value}</div>
              <div style={{ fontSize:9, color:"#888888", marginTop:2 }}>{s.label}</div>
            </div>
          ))}
        </div>
        <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:"#777777" }}>
          <span>{totalJobs} job{totalJobs!==1?"s":""} completed</span>
          {unpaidCount>0&&<span style={{ color:"#e6821e" }}>⚠️ {unpaidCount} pending payment</span>}
        </div>
      </div>

      {/* How earnings work */}
      <div style={{ background:"#ffffff", border:"1px solid #eeeeee", borderRadius:10, padding:"0.9rem", marginBottom:"1.5rem" }}>
        <div style={{ fontFamily:"Syne", fontSize:12, fontWeight:700, color:"#000000", marginBottom:8 }}>How your earnings work</div>
        {[
          { icon:"💵", label:"Commission", desc:"15% of service fee — paid after delivery complete" },
          { icon:"🚌", label:"Transport allowance", desc:"KES 200 per job — covers your travel costs" },
          { icon:"🔒", label:"Payment security", desc:"Both are released only after you complete the delivery and file the dropoff report" },
          { icon:"⚠️", label:"No-show penalty", desc:"If you accept a job and don't show up, you lose both the commission and allowance" },
        ].map(item=>(
          <div key={item.label} style={{ display:"flex", gap:10, alignItems:"flex-start", marginBottom:8 }}>
            <span style={{ fontSize:16, flexShrink:0 }}>{item.icon}</span>
            <div>
              <div style={{ fontSize:12, color:"#000000", fontWeight:600 }}>{item.label}</div>
              <div style={{ fontSize:11, color:"#777777", lineHeight:1.4 }}>{item.desc}</div>
            </div>
          </div>
        ))}
      </div>

      {/* History list */}
      {loading&&<div style={{ color:"#777777", fontSize:13 }}>Loading...</div>}
      {!loading&&filtered.length===0&&(
        <div style={{ color:"#888888", fontSize:13, textAlign:"center", padding:"2rem" }}>
          <div style={{ fontSize:32, marginBottom:10 }}>💰</div>
          No completed jobs for this period
        </div>
      )}

      {filtered.map(b=>{
        const commission = Number(b.total_amount||0)*0.15
        const allowance = Number(b.transport_allowance||200)
        const total = Number(b.driver_earnings||0)
        return (
          <div key={b.id} style={{ background:"#ffffff", border:"1px solid #eeeeee", borderRadius:10, padding:isMobile?"0.75rem":"1rem", marginBottom:8 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:13, fontWeight:600, color:"#000000", marginBottom:2 }}>{b.service_name}</div>
                <div style={{ fontSize:11, color:"#777777", marginBottom:2 }}>#{b.booking_number} · {b.booking_date}</div>
                {b.vehicles&&<div style={{ fontSize:11, color:"#378add" }}>🚗 {b.vehicles.make} {b.vehicles.model} — {b.vehicles.license_plate}</div>}
              </div>
              <div style={{ textAlign:"right", flexShrink:0 }}>
                <div style={{ fontFamily:"Syne", fontSize:15, fontWeight:800, color:"#1d9e75" }}>KES {total.toLocaleString()}</div>
                <div style={{ fontSize:10, color:b.payment_status==="paid"?"#1d9e75":"#e6821e", marginTop:2 }}>{b.payment_status}</div>
                <button onClick={()=>setExpanded(expanded===b.id?null:b.id)}
                  style={{ background:"none", border:"none", color:"#777777", fontSize:10, cursor:"pointer", marginTop:2, padding:0 }}>
                  {expanded===b.id?"hide":"details"}
                </button>
              </div>
            </div>

            {expanded===b.id&&(
              <div style={{ marginTop:10, paddingTop:10, borderTop:"1px solid #eeeeee" }}>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8 }}>
                  {[
                    { l:"Service fee", v:`KES ${Number(b.total_amount||0).toLocaleString()}` },
                    { l:"Commission (15%)", v:`KES ${commission.toFixed(0)}`, c:"#378add" },
                    { l:"Transport allowance", v:`KES ${allowance.toLocaleString()}`, c:"#e6821e" },
                  ].map(f=>(
                    <div key={f.l} style={{ background:"#ffffff", borderRadius:7, padding:"0.6rem", textAlign:"center" }}>
                      <div style={{ fontSize:12, fontWeight:700, color:f.c||"#f0ede6" }}>{f.v}</div>
                      <div style={{ fontSize:9, color:"#888888", marginTop:2 }}>{f.l}</div>
                    </div>
                  ))}
                </div>
                <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, color:"#1d9e75", fontWeight:700, marginTop:8, paddingTop:8, borderTop:"1px solid #eeeeee" }}>
                  <span>Total paid to you</span>
                  <span>KES {total.toLocaleString()}</span>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}


