import useIsMobile from "../../lib/useIsMobile"
import { useEffect, useState } from "react"
import { useLanguage } from "../../contexts/LanguageContext"
import { generateInvoice } from "../../lib/invoice"
import { supabase } from "../../lib/supabase"
import { useAuth } from "../../contexts/AuthContext"

export default function DriverEarnings() {
  const isMobile = useIsMobile()
  const { user } = useAuth()
  const { t, language } = useLanguage()
  const [deliveries, setDeliveries] = useState([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState("all")

  useEffect(() => { if (user) load() }, [user])

  async function load() {
    const { data } = await supabase.from("bookings")
      .select("*").eq("driver_id", user.id).eq("status", "completed").order("booking_date", { ascending:false })
    setDeliveries(data||[])
    setLoading(false)
  }

  const now = new Date()
  const filtered = deliveries.filter(d => {
    if (period==="all") return true
    const dt = new Date(d.booking_date)
    if (period===t("today")) return d.booking_date===now.toISOString().split("T")[0]
    if (period==="week") return (now-dt)<=7*24*60*60*1000
    if (period==="month") return dt.getMonth()===now.getMonth()&&dt.getFullYear()===now.getFullYear()
    return true
  })

  const total = filtered.reduce((s,d)=>s+Number(d.driver_earnings||15),0)

  const byMonth = deliveries.reduce((acc,d) => {
    const month = d.booking_date?.slice(0,7)
    if (!month) return acc
    if (!acc[month]) acc[month] = { earned:0, count:0 }
    acc[month].earned += Number(d.driver_earnings||15)
    acc[month].count += 1
    return acc
  }, {})
  const months = Object.entries(byMonth).sort((a,b)=>b[0].localeCompare(a[0])).slice(0,6)
  const maxEarned = Math.max(...months.map(([,v])=>v.earned), 1)

  return (
    <div>
      <div style={{ display:"flex", gap:6, marginBottom:"1.25rem", flexWrap:"wrap" }}>
        {[{k:t("today"),l:t("today")},{k:"week",l:language==="sw"?"Wiki hii":"This week"},{k:"month",l:language==="sw"?"Mwezi huu":"This month"},{k:"all",l:language==="sw"?"Wakati wote":"All time"}].map(t=>(
          <button key={t.k} onClick={()=>setPeriod(t.k)}
            style={{ padding:"7px 14px", borderRadius:8, border:"none", fontSize:12, cursor:"pointer", background:period===t.k?"#e6821e":"#111", color:period===t.k?"#fff":"#666", fontFamily:"'DM Sans',sans-serif", fontWeight:period===t.k?700:400 }}>
            {t.l}
          </button>
        ))}
      </div>

      <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"repeat(3,1fr)", gap:10, marginBottom:"1.5rem" }}>
        {[
          { label:language==="sw"?"Jumla iliyopatikana":"Total earned", value:`$${total.toFixed(2)}`, color:"#e6821e" },
          { label:language==="sw"?"Usafirishaji":"Deliveries", value:filtered.length },
          { label:language==="sw"?"Kwa kila usafirishaji":"Per delivery", value:`$${filtered.length>0?(total/filtered.length).toFixed(2):"0.00"}` },
        ].map(s=>(
          <div key={s.label} style={{ background:"#111", borderRadius:10, padding:"1rem", border:"1px solid #1e1e1e" }}>
            <div style={{ fontSize:11, color:"#555", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:6 }}>{s.label}</div>
            <div style={{ fontFamily:"Syne", fontSize:22, fontWeight:800, color:s.color||"#f0ede6" }}>{s.value}</div>
          </div>
        ))}
      </div>

      {months.length > 0 && (
        <div style={{ background:"#111", border:"1px solid #1e1e1e", borderRadius:12, padding:"1.25rem", marginBottom:"1.5rem" }}>
          <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:700, marginBottom:"1rem", color:"#f0ede6" }}>Monthly earnings</div>
          <div style={{ display:"flex", gap:8, alignItems:"flex-end", height:120 }}>
            {months.reverse().map(([month,data])=>(
              <div key={month} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
                <div style={{ fontSize:10, color:"#e6821e", fontWeight:600 }}>${data.earned.toFixed(0)}</div>
                <div style={{ width:"100%", background:"#e6821e", borderRadius:"4px 4px 0 0", height:`${Math.max(4,(data.earned/maxEarned)*80)}px`, transition:"height 0.5s" }}/>
                <div style={{ fontSize:9, color:"#555" }}>{new Date(month+"-01").toLocaleString("default",{month:"short"})}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:700, marginBottom:10, color:"#f0ede6" }}>Delivery history</div>
      {loading&&<div style={{ color:"#555", fontSize:13 }}>Loading...</div>}
      {!loading&&filtered.length===0&&<div style={{ color:"#444", fontSize:13, textAlign:"center", padding:"1.5rem" }}>No deliveries in this period</div>}
      {filtered.map(d=>(
        <div key={d.id} style={{ background:"#111", border:"1px solid #1e1e1e", borderRadius:10, padding:"0.9rem", marginBottom:8, display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:13, fontWeight:500, color:"#f0ede6" }}>{d.service_name}</div>
            <div style={{ fontSize:11, color:"#555", marginTop:2 }}>{d.booking_date} · #{d.booking_number}</div>
            {d.pickup_address&&<div style={{ fontSize:10, color:"#444", marginTop:2 }}>Pickup: {d.pickup_address}</div>}
          </div>
          <div style={{ textAlign:"right" }}>
              <button onClick={()=>generateInvoice(d, profile, "driver")} style={{ background:"#0c1f2e", border:"1px solid #378add40", borderRadius:6, color:"#378add", fontSize:10, padding:"4px 8px", cursor:"pointer", marginBottom:4, display:"block" }}>Invoice</button>
            <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:700, color:"#e6821e" }}>+${Number(d.driver_earnings||15).toFixed(2)}</div>
          </div>
        </div>
      ))}
    </div>
  )
}


