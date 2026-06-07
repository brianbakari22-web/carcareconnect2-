import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"
import { useAuth } from "../../contexts/AuthContext"
import { useLanguage } from "../../contexts/LanguageContext"
import { useNavigate } from "react-router-dom"

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener("resize", h)
    return () => window.removeEventListener("resize", h)
  }, [])
  return isMobile
}

export default function CustomerDashboard() {
  const { user, profile } = useAuth()
  const { t } = useLanguage()
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const [stats, setStats] = useState({ bookings:0, pending:0, completed:0, points:0 })
  const [recentBookings, setRecentBookings] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { if (user) load() }, [user])

  async function load() {
    const [{ data: bookings }, { data: loyalty }] = await Promise.all([
      supabase.from("bookings").select("status,created_at,service_name,total_amount,booking_date").eq("customer_id", user.id).order("created_at",{ascending:false}),
      supabase.from("loyalty_points").select("points").eq("user_id", user.id).maybeSingle()
    ])
    const bks = bookings||[]
    setStats({
      bookings: bks.length,
      pending: bks.filter(b=>b.status==="pending").length,
      completed: bks.filter(b=>b.status==="completed").length,
      points: loyalty?.points||0
    })
    setRecentBookings(bks.slice(0,5))
    setLoading(false)
  }

  const SC = { pending:"#e6821e", confirmed:"#378add", "in-progress":"#8b5cf6", completed:"#1d9e75", cancelled:"#e24b4a" }

  const quickActions = [
    { label:t("findServices"), icon:"🔍", path:"/dashboard/services", color:"#e6821e" },
    { label:t("myVehicles"), icon:"🚗", path:"/dashboard/vehicles", color:"#378add" },
    { label:t("trackDriver"), icon:"📍", path:"/dashboard/tracking", color:"#1d9e75" },
    { label:t("discover"), icon:"🌍", path:"/dashboard/discover", color:"#8b5cf6" },
  ]

  return (
    <div>
      <div style={{ marginBottom:"1.25rem" }}>
        <div style={{ fontFamily:"Syne", fontSize:isMobile?18:22, fontWeight:800, color:"#000000" }}>
          {t("welcomeBack")}, <span style={{ color:"#e6821e" }}>{profile?.first_name}</span>
        <div style={{ fontSize:12, color:"#888888", marginTop:2 }}>{t("goodToSeeYou")}</div>
      </div>

      {/* GO Service Emergency Banner */}
      <div onClick={()=>navigate("/dashboard/emergency")}
        style={{ background:"linear-gradient(135deg,#1a0808,#2a0a0a)", border:"1px solid #e24b4a40", borderRadius:14, padding:"1rem 1.25rem", marginBottom:"1.25rem", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"space-between", gap:12 }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ width:44, height:44, borderRadius:"50%", background:"#e24b4a20", border:"1px solid #e24b4a40", display:"flex", alignItems:"center", justifyContent:"center", fontSize:22, flexShrink:0, animation:"pulse 2s infinite" }}>🚨</div>
          <div>
            <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:800, color:"#e24b4a" }}>Car breakdown? GO Service</div>
            <div style={{ fontSize:11, color:"#666666", marginTop:2 }}>24/7 emergency roadside assistance · Mechanic comes to you</div>
          </div>
        </div>
        <div style={{ fontSize:20, color:"#e24b4a", flexShrink:0 }}>→</div>
      </div>
        <div style={{ fontSize:12, color:"#888888", marginTop:2 }}>{new Date().toLocaleDateString("default",{weekday:"long",year:"numeric",month:"long",day:"numeric"})}</div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:isMobile?"repeat(2,1fr)":"repeat(4,1fr)", gap:isMobile?8:10, marginBottom:"1.25rem" }}>
        {[
          { label:t("bookings"), value:stats.bookings },
          { label:t("pending"), value:stats.pending, color:stats.pending>0?"#e6821e":undefined },
          { label:t("completed"), value:stats.completed, color:"#1d9e75" },
          { label:t("loyalty"), value:`${stats.points.toLocaleString()} pts`, color:"#e6821e" },
        ].map(s=>(
          <div key={s.label} style={{ background:"#f5f5f5", borderRadius:10, padding:isMobile?"0.75rem":"1rem", border:"1px solid #e0e0e0" }}>
            <div style={{ fontSize:10, color:"#888888", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:4 }}>{s.label}</div>
            <div style={{ fontFamily:"Syne", fontSize:isMobile?16:20, fontWeight:800, color:s.color||"#f0ede6" }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display:"grid", gridTemplateColumns:isMobile?"repeat(2,1fr)":"repeat(4,1fr)", gap:isMobile?8:10, marginBottom:"1.25rem" }}>
        {quickActions.map(a=>(
          <button key={a.path} onClick={()=>navigate(a.path)}
            style={{ background:"#f5f5f5", border:`1px solid ${a.color}30`, borderRadius:12, padding:isMobile?"1rem 0.75rem":"1.25rem 1rem", cursor:"pointer", textAlign:"center", fontFamily:"'DM Sans',sans-serif", width:"100%" }}
            onMouseEnter={e=>e.currentTarget.style.background=`${a.color}15`}
            onMouseLeave={e=>e.currentTarget.style.background="#111"}>
            <div style={{ fontSize:isMobile?24:28, marginBottom:6 }}>{a.icon}</div>
            <div style={{ fontSize:isMobile?11:12, fontWeight:500, color:a.color }}>{a.label}</div>
          </button>
        ))}
      </div>

      <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:700, marginBottom:10, color:"#000000" }}>{t("bookings")}</div>
      {loading&&<div style={{ color:"#888888", fontSize:13 }}>{t("loading")}</div>}
      {!loading&&recentBookings.length===0&&<div style={{ color:"#999999", fontSize:13, textAlign:"center", padding:"1.5rem" }}>{t("noBookingsFound")}</div>}
      {recentBookings.map(b=>(
        <div key={b.created_at+b.service_name} style={{ background:"#f5f5f5", border:"1px solid #e0e0e0", borderRadius:10, padding:isMobile?"0.75rem":"0.9rem", marginBottom:8, display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:36, height:36, borderRadius:8, background:"#1a1208", display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, flexShrink:0 }}>🔧</div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:13, fontWeight:500, color:"#000000", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{b.service_name}</div>
            <div style={{ fontSize:11, color:"#888888", marginTop:2 }}>{b.booking_date}</div>
          </div>
          <div style={{ textAlign:"right", flexShrink:0 }}>
            <span style={{ fontSize:10, padding:"2px 8px", borderRadius:20, background:`${SC[b.status]}20`, color:SC[b.status]||"#888" }}>{t(b.status)||b.status}</span>
            <div style={{ fontFamily:"Syne", fontSize:13, fontWeight:700, color:"#e6821e", marginTop:4 }}>KES {Number(b.total_amount).toLocaleString()}</div>
          </div>
        </div>
      ))}
    </div>
  )
}






