import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../../contexts/AuthContext"
import { supabase } from "../../lib/supabase"

export default function AppHomePage() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [recentBooking, setRecentBooking] = useState(null)
  const [greeting, setGreeting] = useState("Good day")

  useEffect(() => {
    const h = new Date().getHours()
    if (h < 12) setGreeting("Good morning")
    else if (h < 17) setGreeting("Good afternoon")
    else setGreeting("Good evening")
    if (user) {
      supabase.from("bookings").select("id,service_name,status,booking_date").eq("customer_id",user.id)
        .in("status",["confirmed","in_progress","pending"]).order("created_at",{ascending:false}).limit(1)
        .then(({data}) => { if (data?.length) setRecentBooking(data[0]) })
    }
  }, [user])

  const QUICK_ACTIONS = [
    { icon:"\u{1F527}", label:"Book mechanic", desc:"Find & book near you", color:"#fff8f0", border:"#e6821e30", path:"/dashboard/services" },
    { icon:"\u{1F6A8}", label:"GO Emergency", desc:"24/7 roadside help", color:"#fff5f5", border:"#e24b4a30", path:"/dashboard/emergency" },
    { icon:"\u{1F6D2}", label:"Order parts", desc:"Genuine parts delivered", color:"#eff6ff", border:"#378add30", path:"/dashboard/parts" },
    { icon:"\u{1F697}", label:"Concierge", desc:"We pick up your car", color:"#f0fdf4", border:"#1d9e7530", path:"/dashboard/services" },
    { icon:"\u{1F4CD}", label:"Track my car", desc:"Live GPS tracking", color:"#faf5ff", border:"#8b5cf630", path:"/dashboard/tracking" },
    { icon:"\u{1F381}", label:"My rewards", desc:"View loyalty points", color:"#fefce8", border:"#f59e0b30", path:"/dashboard/loyalty" },
  ]

  const name = profile?.first_name || "there"

  return (
    <div style={{ fontFamily:"DM Sans,sans-serif", background:"#f8f8f8", minHeight:"100vh", paddingBottom:80 }}>
      {/* Header */}
      <div style={{ background:"#fff", padding:"3.5rem 1.25rem 1.25rem", borderBottom:"1px solid #f0f0f0" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
          <div>
            <div style={{ fontSize:13, color:"#888", marginBottom:2 }}>{greeting} 👋</div>
            <div style={{ fontFamily:"Syne,sans-serif", fontSize:22, fontWeight:800, color:"#000", letterSpacing:"-0.5px" }}>
              {user ? name : "Welcome back"}
            </div>
            <div style={{ fontSize:12, color:"#aaa", marginTop:2 }}>🇰🇪 Car Care Connect · Kenya</div>
          </div>
          <div style={{ display:"flex", gap:8, alignItems:"center" }}>
            <button onClick={()=>navigate("/dashboard/notifications")}
              style={{ background:"#f8f8f8", border:"1px solid #eee", borderRadius:"50%", width:40, height:40, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, cursor:"pointer" }}>
              🔔
            </button>
            <button onClick={()=>navigate("/dashboard/profile")}
              style={{ background:"#e6821e", border:"none", borderRadius:"50%", width:40, height:40, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"Syne,sans-serif", fontSize:14, fontWeight:800, color:"#fff", cursor:"pointer" }}>
              {name.charAt(0).toUpperCase()}
            </button>
          </div>
        </div>
        <div onClick={()=>navigate("/dashboard/discover")} style={{ marginTop:"1rem", background:"#f5f5f5", border:"1.5px solid #eee", borderRadius:12, padding:"11px 14px", display:"flex", alignItems:"center", gap:10, cursor:"pointer" }}>
          <span style={{ fontSize:16, color:"#aaa" }}>🔍</span>
          <span style={{ fontSize:14, color:"#bbb" }}>Search mechanics, parts, services...</span>
        </div>
      </div>

      <div style={{ padding:"1.25rem" }}>
        {recentBooking && (
          <div onClick={()=>navigate("/dashboard/bookings")}
            style={{ background:"#e6821e", borderRadius:16, padding:"1rem 1.25rem", marginBottom:"1.25rem", display:"flex", alignItems:"center", gap:12, cursor:"pointer" }}>
            <div style={{ width:40, height:40, borderRadius:10, background:"rgba(255,255,255,0.2)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, flexShrink:0 }}>
              {recentBooking.status==="in_progress"?"🔧":recentBooking.status==="confirmed"?"✅":"⏳"}
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontFamily:"Syne,sans-serif", fontSize:13, fontWeight:700, color:"#fff" }}>{recentBooking.service_name || "Active booking"}</div>
              <div style={{ fontSize:11, color:"rgba(255,255,255,0.8)", marginTop:1, textTransform:"capitalize" }}>{recentBooking.status.replace("_"," ")} · Tap to track</div>
            </div>
            <span style={{ color:"rgba(255,255,255,0.7)", fontSize:18 }}>›</span>
          </div>
        )}

        <div onClick={()=>navigate("/dashboard/emergency")}
          style={{ background:"#fff", border:"1.5px solid #e24b4a20", borderRadius:16, padding:"1rem 1.25rem", marginBottom:"1.25rem", display:"flex", alignItems:"center", gap:12, cursor:"pointer" }}>
          <div style={{ width:48, height:48, borderRadius:12, background:"#fff5f5", display:"flex", alignItems:"center", justifyContent:"center", fontSize:26, flexShrink:0 }}>🚨</div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:10, fontWeight:700, color:"#e24b4a", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:2 }}>GO SERVICE · 24/7 EMERGENCY</div>
            <div style={{ fontFamily:"Syne,sans-serif", fontSize:14, fontWeight:700, color:"#000" }}>Broke down? We come to you.</div>
            <div style={{ fontSize:11, color:"#888", marginTop:1 }}>KES 500 callout · Mechanic in under 15 min</div>
          </div>
          <span style={{ color:"#e24b4a", fontSize:18 }}>›</span>
        </div>

        <div style={{ fontFamily:"Syne,sans-serif", fontSize:14, fontWeight:700, color:"#000", marginBottom:12 }}>Quick actions</div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:10, marginBottom:"1.5rem" }}>
          {QUICK_ACTIONS.map(a => (
            <div key={a.label} onClick={()=>navigate(a.path)}
              style={{ background:a.color, border:"1.5px solid "+a.border, borderRadius:16, padding:"1rem", cursor:"pointer" }}>
              <div style={{ fontSize:28, marginBottom:8 }}>{a.icon}</div>
              <div style={{ fontWeight:700, fontSize:13, color:"#000", marginBottom:2 }}>{a.label}</div>
              <div style={{ fontSize:11, color:"#888" }}>{a.desc}</div>
            </div>
          ))}
        </div>

        <div style={{ fontFamily:"Syne,sans-serif", fontSize:14, fontWeight:700, color:"#000", marginBottom:12 }}>Popular services</div>
        <div style={{ display:"flex", gap:8, overflowX:"auto", paddingBottom:4, marginBottom:"1.5rem" }}>
          {[{icon:"🛢️",name:"Oil change"},{icon:"🔴",name:"Brake service"},{icon:"🛞",name:"Tyre change"},{icon:"🔋",name:"Battery"},{icon:"❄️",name:"AC repair"},{icon:"🔍",name:"Diagnostics"}].map(s=>(
            <div key={s.name} onClick={()=>navigate("/dashboard/services")}
              style={{ background:"#fff", border:"1px solid #eee", borderRadius:12, padding:"10px 14px", display:"flex", flexDirection:"column", alignItems:"center", gap:6, cursor:"pointer", flexShrink:0, minWidth:80 }}>
              <span style={{ fontSize:24 }}>{s.icon}</span>
              <span style={{ fontSize:10, fontWeight:600, color:"#555", whiteSpace:"nowrap" }}>{s.name}</span>
            </div>
          ))}
        </div>

        <div style={{ background:"#fff", border:"1px solid #eee", borderRadius:16, padding:"1rem 1.25rem", display:"flex", alignItems:"center", gap:12, cursor:"pointer" }}
          onClick={()=>navigate("/dashboard/discover")}>
          <div style={{ width:44, height:44, borderRadius:12, background:"#fff8f0", display:"flex", alignItems:"center", justifyContent:"center", fontSize:22, flexShrink:0 }}>🗺️</div>
          <div style={{ flex:1 }}>
            <div style={{ fontWeight:700, fontSize:13, color:"#000" }}>Discover providers near you</div>
            <div style={{ fontSize:11, color:"#888", marginTop:1 }}>Mechanics, garages, car washes & more</div>
          </div>
          <span style={{ color:"#e6821e", fontSize:18 }}>›</span>
        </div>
      </div>

      <a href="https://wa.me/254113858966" target="_blank" rel="noopener noreferrer"
        style={{ position:"fixed", bottom:90, right:18, background:"#25d366", borderRadius:"50%", width:50, height:50, display:"flex", alignItems:"center", justifyContent:"center", fontSize:24, boxShadow:"0 4px 16px rgba(37,211,102,0.45)", textDecoration:"none", zIndex:999 }}>
        💬
      </a>
    </div>
  )
}
