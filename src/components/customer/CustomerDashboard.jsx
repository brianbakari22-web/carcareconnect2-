import { useState, useEffect } from "react"
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
      supabase.from("bookings").select("status,created_at,service_name,total_amount,booking_date,service_category").eq("customer_id", user.id).order("created_at",{ascending:false}),
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
  const tier = stats.points>=10000?"Platinum":stats.points>=5000?"Gold":stats.points>=1000?"Silver":"Bronze"
  const tierColors = { Bronze:"#cd7f32", Silver:"#aaa", Gold:"#e6821e", Platinum:"#8b5cf6" }
  const nextTier = { Bronze:1000, Silver:5000, Gold:10000, Platinum:99999 }
  const progress = Math.min(100, (stats.points / nextTier[tier]) * 100)
  const quickActions = [
    { label:"Book service", icon:"🔧", path:"/dashboard/services", color:"#e6821e" },
    { label:"GO Service", icon:"🚨", path:"/dashboard/emergency", color:"#e24b4a" },
    { label:"Order parts", icon:"⚙️", path:"/dashboard/parts", color:"#378add" },
    { label:"Car wash", icon:"🚿", path:"/dashboard/discover", color:"#1d9e75" },
    { label:"Track driver", icon:"📍", path:"/dashboard/tracking", color:"#8b5cf6" },
    { label:"Marketplace", icon:"🛒", path:"/dashboard/marketplace", color:"#e6821e" },
    { label:"Loyalty", icon:"⭐", path:"/dashboard/loyalty", color:"#e6821e" },
    { label:"AI Help", icon:"🤖", path:"/dashboard/support", color:"#378add" },
  ]
  return (
    <div style={{ margin:"-1rem", fontFamily:"DM Sans,sans-serif" }}>
      {/* Orange header */}
      <div style={{ background:"#e6821e", padding:"1.25rem 1.25rem 2.5rem" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
          <div>
            <div style={{ fontSize:12, color:"rgba(255,255,255,0.75)", marginBottom:2 }}>
              {new Date().toLocaleDateString("en-KE",{weekday:"long",day:"numeric",month:"long"})}
            </div>
            <div style={{ fontFamily:"Syne", fontSize:20, fontWeight:800, color:"#fff" }}>
              Good morning, {profile?.first_name || "there"} 👋
            </div>
            <div style={{ fontSize:12, color:"rgba(255,255,255,0.8)", marginTop:2 }}>
              {tier} member · {stats.points.toLocaleString()} pts
            </div>
          </div>
          <div onClick={()=>navigate("/dashboard/notifications")}
            style={{ width:36, height:36, borderRadius:"50%", background:"rgba(255,255,255,0.2)", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", fontSize:18 }}>
            🔔
          </div>
        </div>
      </div>

      {/* Quick actions floating card */}
      <div style={{ margin:"-1.25rem 1rem 1rem", background:"#fff", borderRadius:16, padding:"1rem", boxShadow:"0 4px 20px rgba(0,0,0,0.08)", border:"1px solid #f0f0f0" }}>
        <div style={{ fontSize:11, color:"#888", marginBottom:10, fontWeight:500, textTransform:"uppercase", letterSpacing:"0.05em" }}>Quick actions</div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8, textAlign:"center", marginBottom:8 }}>
          {quickActions.slice(0,4).map(a=>(
            <div key={a.label} onClick={()=>navigate(a.path)} style={{ cursor:"pointer", padding:"6px 0" }}>
              <div style={{ fontSize:24, marginBottom:4 }}>{a.icon}</div>
              <div style={{ fontSize:9, color:"#555", lineHeight:1.2 }}>{a.label}</div>
            </div>
          ))}
        </div>
        <div style={{ borderTop:"1px solid #f5f5f5", paddingTop:8, display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8, textAlign:"center" }}>
          {quickActions.slice(4,8).map(a=>(
            <div key={a.label} onClick={()=>navigate(a.path)} style={{ cursor:"pointer", padding:"4px 0" }}>
              <div style={{ fontSize:20, marginBottom:3 }}>{a.icon}</div>
              <div style={{ fontSize:9, color:"#888", lineHeight:1.2 }}>{a.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding:"0 1rem" }}>
        {/* GO Service banner */}
        <div onClick={()=>navigate("/dashboard/emergency")}
          style={{ background:"#fff5f5", border:"1px solid #e24b4a30", borderRadius:14, padding:"0.85rem 1rem", marginBottom:"1rem", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"space-between", gap:12 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ width:40, height:40, borderRadius:"50%", background:"#e24b4a15", border:"1px solid #e24b4a30", display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, flexShrink:0 }}>🚨</div>
            <div>
              <div style={{ fontFamily:"Syne", fontSize:13, fontWeight:800, color:"#e24b4a" }}>Car breakdown? GO Service</div>
              <div style={{ fontSize:11, color:"#888", marginTop:1 }}>24/7 emergency · Mechanic comes to you · KES 500</div>
            </div>
          </div>
          <div style={{ fontSize:18, color:"#e24b4a", flexShrink:0 }}>→</div>
        </div>

        {/* Stats row */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:8, marginBottom:"1rem" }}>
          {[
            { label:"Total bookings", value:stats.bookings, icon:"📅", color:"#e6821e" },
            { label:"Pending", value:stats.pending, icon:"⏳", color:"#378add" },
            { label:"Completed", value:stats.completed, icon:"✅", color:"#1d9e75" },
            { label:"Loyalty points", value:stats.points.toLocaleString(), icon:"⭐", color:"#e6821e" },
          ].map(s=>(
            <div key={s.label} style={{ background:"#f8f8f8", borderRadius:12, padding:"0.85rem", display:"flex", alignItems:"center", gap:10 }}>
              <div style={{ fontSize:22 }}>{s.icon}</div>
              <div>
                <div style={{ fontFamily:"Syne", fontSize:18, fontWeight:800, color:s.color }}>{s.value}</div>
                <div style={{ fontSize:11, color:"#888" }}>{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Loyalty progress */}
        <div style={{ background:"#fff", border:"1px solid #f0f0f0", borderRadius:14, padding:"1rem", marginBottom:"1rem", boxShadow:"0 2px 8px rgba(0,0,0,0.04)" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
            <div style={{ fontFamily:"Syne", fontSize:13, fontWeight:800, color:tierColors[tier] }}>{tier} Member</div>
            <div style={{ fontSize:11, color:"#888" }}>{stats.points.toLocaleString()} / {nextTier[tier].toLocaleString()} pts</div>
          </div>
          <div style={{ height:6, background:"#f0f0f0", borderRadius:3, overflow:"hidden" }}>
            <div style={{ width:`${progress}%`, height:"100%", background:tierColors[tier], borderRadius:3, transition:"width 1s ease" }}/>
          </div>
          <div style={{ fontSize:10, color:"#aaa", marginTop:6 }}>
            {tier === "Platinum" ? "Maximum tier reached!" : `${(nextTier[tier]-stats.points).toLocaleString()} pts to ${tier==="Bronze"?"Silver":tier==="Silver"?"Gold":"Platinum"}`}
          </div>
        </div>

        {/* Recent bookings */}
        <div style={{ marginBottom:"1rem" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
            <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:800, color:"#000" }}>Recent bookings</div>
            <button onClick={()=>navigate("/dashboard/bookings")} style={{ background:"none", border:"none", color:"#e6821e", fontSize:12, cursor:"pointer", fontFamily:"DM Sans,sans-serif" }}>View all →</button>
          </div>
          {loading && <div style={{ color:"#888", fontSize:13, textAlign:"center", padding:"1rem" }}>Loading...</div>}
          {!loading && recentBookings.length === 0 && (
            <div style={{ textAlign:"center", padding:"2rem", background:"#f8f8f8", borderRadius:12 }}>
              <div style={{ fontSize:36, marginBottom:8 }}>🚗</div>
              <div style={{ fontSize:14, color:"#888" }}>No bookings yet</div>
              <button onClick={()=>navigate("/dashboard/services")}
                style={{ marginTop:12, background:"#e6821e", border:"none", borderRadius:20, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:12, fontWeight:700, padding:"8px 20px", cursor:"pointer" }}>
                Book your first service
              </button>
            </div>
          )}
          {recentBookings.map(b=>(
            <div key={b.id||b.created_at} onClick={()=>navigate("/dashboard/bookings")}
              style={{ background:"#fff", border:"0.5px solid #eeeeee", borderRadius:12, padding:"0.85rem", marginBottom:8, display:"flex", alignItems:"center", gap:10, cursor:"pointer" }}>
              <div style={{ width:40, height:40, borderRadius:10, background:`${SC[b.status]||"#eee"}15`, border:`1px solid ${SC[b.status]||"#eee"}30`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0 }}>
                {b.service_category==="go_service"?"🚨":b.service_category==="car_wash"||b.service_category==="basic_wash"||b.service_category==="standard_wash"||b.service_category==="premium_detail"?"🚿":b.service_category==="shop_premium"?"🏡":"🏪"}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:13, fontWeight:500, color:"#000", marginBottom:2, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{b.service_name}</div>
                <div style={{ fontSize:11, color:"#888" }}>{b.booking_date} · KES {Number(b.total_amount||0).toLocaleString()}</div>
              </div>
              <span style={{ fontSize:10, padding:"3px 8px", borderRadius:20, background:`${SC[b.status]||"#eee"}15`, color:SC[b.status]||"#888", fontWeight:600, flexShrink:0 }}>
                {b.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

