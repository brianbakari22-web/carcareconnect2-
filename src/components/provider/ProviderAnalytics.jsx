import useIsMobile from "../../lib/useIsMobile"
import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"
import { useAuth } from "../../contexts/AuthContext"

export default function ProviderAnalytics() {
  const isMobile = useIsMobile()
  const { user } = useAuth()
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { if (user) load() }, [user])

  async function load() {
    const { data } = await supabase.from("bookings")
      .select("*").eq("provider_id", user.id)
      .order("created_at", { ascending:false })
    setBookings(data||[])
    setLoading(false)
  }

  const completed = bookings.filter(b=>b.status==="completed")
  const cancelled = bookings.filter(b=>b.status==="cancelled")
  const completionRate = bookings.length>0 ? Math.round((completed.length/bookings.length)*100) : 0

  // Service performance
  const byService = bookings.reduce((acc,b) => {
    if (!acc[b.service_name]) acc[b.service_name] = { name:b.service_name, total:0, completed:0, revenue:0 }
    acc[b.service_name].total++
    if (b.status==="completed") { acc[b.service_name].completed++; acc[b.service_name].revenue += Number(b.provider_earnings||0) }
    return acc
  }, {})
  const services = Object.values(byService).sort((a,b)=>b.total-a.total)

  // Customer retention
  const customerBookings = bookings.reduce((acc,b) => {
    if (!acc[b.customer_id]) acc[b.customer_id] = 0
    acc[b.customer_id]++
    return acc
  }, {})
  const returning = Object.values(customerBookings).filter(c=>c>1).length
  const total = Object.keys(customerBookings).length
  const retentionRate = total>0 ? Math.round((returning/total)*100) : 0

  // Monthly revenue
  const byMonth = completed.reduce((acc,b) => {
    const month = b.booking_date?.slice(0,7)
    if (!month) return acc
    acc[month] = (acc[month]||0) + Number(b.provider_earnings||0)
    return acc
  }, {})
  const months = Object.entries(byMonth).sort((a,b)=>b[0].localeCompare(a[0])).slice(0,6)
  const maxRev = Math.max(...months.map(([,v])=>v), 1)

  if (loading) return <div style={{ color:"#555", fontSize:13 }}>Loading...</div>

  return (
    <div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10, marginBottom:"1.5rem" }}>
        {[
          { label:"Completion rate", value:`${completionRate}%`, color:completionRate>=80?"#1d9e75":completionRate>=50?"#e6821e":"#e24b4a" },
          { label:"Returning customers", value:`${retentionRate}%`, color:"#378add" },
          { label:"Cancelled bookings", value:cancelled.length, color:cancelled.length>0?"#e24b4a":undefined },
        ].map(s=>(
          <div key={s.label} style={{ background:"#111", borderRadius:10, padding:"1rem", border:"1px solid #1e1e1e" }}>
            <div style={{ fontSize:11, color:"#555", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:6 }}>{s.label}</div>
            <div style={{ fontFamily:"Syne", fontSize:22, fontWeight:800, color:s.color||"#f0ede6" }}>{s.value}</div>
          </div>
        ))}
      </div>

      {months.length>0&&(
        <div style={{ background:"#111", border:"1px solid #1e1e1e", borderRadius:12, padding:"1.25rem", marginBottom:"1.5rem" }}>
          <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:700, marginBottom:"1rem", color:"#f0ede6" }}>Revenue trend</div>
          <div style={{ display:"flex", gap:8, alignItems:"flex-end", height:120 }}>
            {months.reverse().map(([month,rev])=>(
              <div key={month} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
                <div style={{ fontSize:10, color:"#378add", fontWeight:600 }}>${rev.toFixed(0)}</div>
                <div style={{ width:"100%", background:"#378add", borderRadius:"4px 4px 0 0", height:`${Math.max(4,(rev/maxRev)*80)}px`, transition:"height 0.5s" }}/>
                <div style={{ fontSize:9, color:"#555" }}>{new Date(month+"-01").toLocaleString("default",{month:"short"})}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:700, marginBottom:10, color:"#f0ede6" }}>Service performance</div>
      {services.length===0&&<div style={{ color:"#444", fontSize:13, textAlign:"center", padding:"1.5rem" }}>No bookings yet</div>}
      {services.map(s=>(
        <div key={s.name} style={{ background:"#111", border:"1px solid #1e1e1e", borderRadius:10, padding:"1rem", marginBottom:8 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
            <div style={{ fontSize:13, fontWeight:500, color:"#f0ede6" }}>{s.name}</div>
            <div style={{ fontFamily:"Syne", fontSize:13, fontWeight:700, color:"#378add" }}>${s.revenue.toFixed(2)}</div>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8 }}>
            {[
              { l:"Total bookings", v:s.total },
              { l:"Completed", v:s.completed },
              { l:"Rate", v:`${s.total>0?Math.round((s.completed/s.total)*100):0}%` },
            ].map(f=>(
              <div key={f.l}>
                <div style={{ fontSize:10, color:"#555", textTransform:"uppercase" }}>{f.l}</div>
                <div style={{ fontSize:13, color:"#f0ede6", marginTop:2 }}>{f.v}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop:8, height:4, background:"#1e1e1e", borderRadius:2, overflow:"hidden" }}>
            <div style={{ height:"100%", background:"#378add", borderRadius:2, width:`${s.total>0?Math.round((s.completed/s.total)*100):0}%`, transition:"width 0.5s" }}/>
          </div>
        </div>
      ))}

      <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:700, marginTop:"1.5rem", marginBottom:10, color:"#f0ede6" }}>Customer summary</div>
      <div style={{ background:"#111", border:"1px solid #1e1e1e", borderRadius:10, padding:"1rem" }}>
        {[
          { label:"Total customers", value:total },
          { label:"Returning customers", value:returning, color:"#1d9e75" },
          { label:"One-time customers", value:total-returning },
          { label:"Retention rate", value:`${retentionRate}%`, color:"#378add" },
        ].map(s=>(
          <div key={s.label} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 0", borderBottom:"1px solid #1a1a1a" }}>
            <div style={{ fontSize:13, color:"#888" }}>{s.label}</div>
            <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:700, color:s.color||"#f0ede6" }}>{s.value}</div>
          </div>
        ))}
      </div>
    </div>
  )
}


