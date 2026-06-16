import useIsMobile from "../../lib/useIsMobile"
import { useEffect, useState } from "react"
import { useLanguage } from "../../contexts/LanguageContext"
import { generateInvoice } from "../../lib/invoice"
import { supabase } from "../../lib/supabase"
import { useAuth } from "../../contexts/AuthContext"

export default function ProviderEarnings() {
  const isMobile = useIsMobile()
  const { user } = useAuth()
  const { t, language } = useLanguage()
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState("all")

  useEffect(() => { if (user) load() }, [user])

  async function load() {
    const { data } = await supabase.from("bookings")
      .select("*")
      .eq("provider_id", user.id)
      .eq("status", "completed")
      .order("booking_date", { ascending:false })
    setBookings(data||[])
    setLoading(false)
  }

  const now = new Date()
  const filtered = bookings.filter(b => {
    if (period === "all") return true
    const d = new Date(b.booking_date)
    if (period === t("today")) return b.booking_date === now.toISOString().split("T")[0]
    if (period === "week") return (now - d) <= 7*24*60*60*1000
    if (period === "month") return d.getMonth()===now.getMonth() && d.getFullYear()===now.getFullYear()
    return true
  })

  const totalRevenue = filtered.reduce((s,b)=>s+Number(b.total_amount),0)
  const totalEarned = filtered.reduce((s,b)=>s+Number(b.provider_earnings||0),0)
  const totalCommission = filtered.reduce((s,b)=>s+Number(b.platform_commission||0),0)

  const byMonth = bookings.reduce((acc,b) => {
    const month = b.booking_date?.slice(0,7)
    if (!month) return acc
    if (!acc[month]) acc[month] = { revenue:0, earned:0, count:0 }
    acc[month].revenue += Number(b.total_amount)
    acc[month].earned += Number(b.provider_earnings||0)
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
            style={{ padding:"7px 14px", borderRadius:8, border:"none", fontSize:12, cursor:"pointer", background:period===t.k?"#e6821e":"#555555", color:period===t.k?"#fff":"#666", fontFamily:"'DM Sans',sans-serif", fontWeight:period===t.k?700:400 }}>
            {t.l}
          </button>
        ))}
      </div>

      <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"repeat(3,1fr)", gap:10, marginBottom:"1.5rem" }}>
        {[
          { label:t("earnings"), value:`KES ${totalEarned.toFixed(2)}`, color:"#e6821e" },
          { label:"Total revenue", value:`KES ${totalRevenue.toFixed(2)}` },
          { label:"Platform commission", value:`KES ${totalCommission.toFixed(2)}` },
        ].map(s=>(
          <div key={s.label} style={{ background:"#ffffff", borderRadius:10, padding:"1rem", border:"1px solid #eeeeee" }}>
            <div style={{ fontSize:11, color:"#777777", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:6 }}>{s.label}</div>
            <div style={{ fontFamily:"Syne", fontSize:22, fontWeight:800, color:s.color||"#000000" }}>{s.value}</div>
            <div style={{ fontSize:11, color:"#777777", marginTop:4 }}>{filtered.length} completed booking{filtered.length!==1?"s":""}</div>
          </div>
        ))}
      </div>

      {months.length > 0 && (
        <div style={{ background:"#ffffff", border:"1px solid #eeeeee", borderRadius:12, padding:"1.25rem", marginBottom:"1.5rem" }}>
          <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:700, marginBottom:"1rem", color:"#000000" }}>Monthly earnings</div>
          <div style={{ display:"flex", gap:8, alignItems:"flex-end", height:120 }}>
            {months.reverse().map(([month, data])=>(
              <div key={month} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
                <div style={{ fontSize:10, color:"#e6821e", fontWeight:600 }}>${data.earned.toFixed(0)}</div>
                <div style={{ width:"100%", background:"#e6821e", borderRadius:"4px 4px 0 0", height:`${Math.max(4,(data.earned/maxEarned)*80)}px`, transition:"height 0.5s" }}/>
                <div style={{ fontSize:9, color:"#777777", textAlign:"center" }}>
                  {new Date(month+"-01").toLocaleString("default",{month:"short"})}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:700, marginBottom:10, color:"#000000" }}>Completed bookings</div>
      {loading&&<div style={{ color:"#777777", fontSize:13 }}>Loading...</div>}
      {!loading&&filtered.length===0&&<div style={{ color:"#888888", fontSize:13, textAlign:"center", padding:"1.5rem" }}>No completed bookings in this period</div>}
      {filtered.map(b=>(
        <div key={b.id} style={{ background:"#ffffff", border:"1px solid #eeeeee", borderRadius:10, padding:"1rem", marginBottom:8, display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:13, fontWeight:500, color:"#000000" }}>{b.service_name}</div>
            <div style={{ fontSize:11, color:"#777777", marginTop:2 }}>{b.booking_date} · #{b.booking_number}</div>
          </div>
          <div style={{ textAlign:"right" }}>
              <button onClick={()=>generateInvoice(b, profile, "provider")} style={{ background:"#eff6ff", border:"1px solid #378add40", borderRadius:6, color:"#378add", fontSize:10, padding:"4px 8px", cursor:"pointer", marginBottom:4, display:"block" }}>Invoice</button>
            <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:700, color:"#e6821e" }}>+${Number(b.provider_earnings||0).toFixed(2)}</div>
            <div style={{ fontSize:10, color:"#777777" }}>of ${Number(b.total_amount).toFixed(2)}</div>
          </div>
        </div>
      ))}
    </div>
  )
}







