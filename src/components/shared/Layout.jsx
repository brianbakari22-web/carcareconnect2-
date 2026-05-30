import { useState, useEffect } from "react"
import { useAuth } from "../../contexts/AuthContext"
import { useLanguage } from "../../contexts/LanguageContext"
import { useTheme } from "../../contexts/ThemeContext"
import { useNavigate, useLocation } from "react-router-dom"
import ThemeSwitcher from "./ThemeSwitcher"
import { supabase } from "../../lib/supabase"
import AIAssistant from "./AIAssistant"

const NAV = {
  customer: [
    { path:"/dashboard", key:"overview", icon:"🏠" },
    { path:"/dashboard/bookings", key:"bookings", icon:"📅" },
    { path:"/dashboard/services", key:"findServices", icon:"🔍" },
    { path:"/dashboard/vehicles", key:"myVehicles", icon:"🚗" },
    { path:"/dashboard/discover", key:"discover", icon:"🌍" },
    { path:"/dashboard/tracking", key:"trackDriver", icon:"📍" },
    { path:"/dashboard/loyalty", key:"loyalty", icon:"⭐" },
    { path:"/dashboard/payments", key:"payments", icon:"💳" },
    { path:"/dashboard/reviews", key:"reviews", icon:"💬" },
    { path:"/dashboard/favorites", key:"favorites", icon:"❤️" },
    { path:"/dashboard/referral", key:"referEarn", icon:"🎁" },
    { path:"/dashboard/support", label:"Support", icon:"🎫" },
    { path:"/dashboard/emergency", label:"GO Service 🚨", icon:"🚨" },
    { path:"/dashboard/vehicle-reports", label:"Vehicle Reports", icon:"📋" },
    { path:"/dashboard/claims", label:"Service Guarantee", icon:"🛡️" },
    { path:"/dashboard/marketplace", label:"Marketplace", icon:"🛒" },
    { path:"/dashboard/marketplace/my-listings", label:"My Listings", icon:"📦" },
    { path:"/dashboard/marketplace/my-offers", label:"My Offers", icon:"💰" },
    { path:"/dashboard/marketplace/transactions", label:"My Transactions", icon:"💳" },
    { path:"/dashboard/chat", key:"messages", icon:"✉️" },
    { path:"/dashboard/notifications", key:"notifications", icon:"🔔" },
    { path:"/dashboard/profile", key:"profile", icon:"⚙️" },
  ],
  provider: [
    { path:"/dashboard", key:"overview", icon:"🏠" },
    { path:"/dashboard/bookings", key:"bookings", icon:"📅" },
    { path:"/dashboard/services", key:"myServices", icon:"🔧" },
    { path:"/dashboard/earnings", key:"earnings", icon:"💰" },
    { path:"/dashboard/analytics", key:"analytics", icon:"📊" },
    { path:"/dashboard/reviews", key:"reviews", icon:"⭐" },
    { path:"/dashboard/hours", key:"businessHours", icon:"🕐" },
    { path:"/dashboard/availability", key:"availability", icon:"📆" },
    { path:"/dashboard/payouts", key:"payouts", icon:"🏦" },
    { path:"/dashboard/mechanics", label:"My Mechanics", icon:"👨‍🔧" },
    { path:"/dashboard/go-requests", label:"GO Requests 🚨", icon:"🚨" },
    { path:"/dashboard/claims", label:"Service Claims", icon:"🛡️" },
    { path:"/dashboard/marketplace", label:"Marketplace", icon:"🛒" },
    { path:"/dashboard/marketplace/my-listings", label:"My Listings", icon:"📦" },
    { path:"/dashboard/marketplace/my-offers", label:"My Offers", icon:"💰" },
    { path:"/dashboard/marketplace/transactions", label:"My Transactions", icon:"💳" },
    { path:"/dashboard/chat", key:"messages", icon:"✉️" },
    { path:"/dashboard/notifications", key:"notifications", icon:"🔔" },
    { path:"/dashboard/profile", key:"profile", icon:"⚙️" },
  ],
  driver: [
    { path:"/dashboard", key:"overview", icon:"🏠" },
    { path:"/dashboard/jobs", key:"availableJobs", icon:"📦" },
    { path:"/dashboard/active", key:"activeDelivery", icon:"🚗" },
    { path:"/dashboard/earnings", key:"earnings", icon:"💰" },
    { path:"/dashboard/reviews", key:"myRatings", icon:"⭐" },
    { path:"/dashboard/payouts", key:"payouts", icon:"🏦" },
    { path:"/dashboard/marketplace", label:"Marketplace", icon:"🛒" },
    { path:"/dashboard/marketplace/my-listings", label:"My Listings", icon:"📦" },
    { path:"/dashboard/marketplace/my-offers", label:"My Offers", icon:"💰" },
    { path:"/dashboard/marketplace/transactions", label:"My Transactions", icon:"💳" },
    { path:"/dashboard/notifications", key:"notifications", icon:"🔔" },
    { path:"/dashboard/chat", key:"messages", icon:"✉️" },
    { path:"/dashboard/profile", key:"profile", icon:"⚙️" },
  ],
  admin: [
    { path:"/admin-dashboard", key:"overview", icon:"🏠" },
    { path:"/admin-dashboard/users", label:"Users", icon:"👥" },
    { path:"/admin-dashboard/providers", label:"Providers", icon:"🔧" },
    { path:"/admin-dashboard/drivers", label:"Drivers", icon:"🚗" },
    { path:"/admin-dashboard/mechanics", label:"Mechanics & Services", icon:"👨‍🔧" },
    { path:"/admin-dashboard/disputes", label:"Disputes & Reports", icon:"⚠️" },
    { path:"/admin-dashboard/claims", label:"Service Claims", icon:"🛡️" },
    { path:"/admin-dashboard/bookings", key:"bookings", icon:"📅" },
    { path:"/admin-dashboard/services", label:"Services", icon:"⚙️" },
    { path:"/admin-dashboard/revenue", label:"Revenue", icon:"💰" },
    { path:"/admin-dashboard/payouts", label:"Payouts", icon:"🏦" },
    { path:"/admin-dashboard/promos", label:"Promo Codes", icon:"🎟️" },
    { path:"/admin-dashboard/reviews", key:"reviews", icon:"⭐" },
    { path:"/admin-dashboard/loyalty", key:"loyalty", icon:"🏆" },
    { path:"/admin-dashboard/categories", label:"Categories", icon:"📂" },
    { path:"/admin-dashboard/security", label:"2FA Security", icon:"🔐" },
    { path:"/admin-dashboard/support", label:"Support Tickets", icon:"🎫" },
    { path:"/admin-dashboard/notifications", label:"Notifications", icon:"🔔" },
    { path:"/admin-dashboard/health", label:"System Health", icon:"🩺" },
    { path:"/admin-dashboard/marketplace", label:"Marketplace", icon:"🛒" },
  ],
}
const BOTTOM_NAV = {
  customer: [
    { path:"/dashboard", key:"overview", icon:"🏠" },
    { path:"/dashboard/bookings", key:"bookings", icon:"📅" },
    { path:"/dashboard/services", key:"findServices", icon:"🔍" },
    { path:"/dashboard/chat", key:"messages", icon:"✉️" },
    { path:"/dashboard/profile", key:"profile", icon:"⚙️" },
  ],
  provider: [
    { path:"/dashboard", key:"overview", icon:"🏠" },
    { path:"/dashboard/bookings", key:"bookings", icon:"📅" },
    { path:"/dashboard/services", key:"myServices", icon:"🔧" },
    { path:"/dashboard/mechanics", label:"Mechanics", icon:"👨‍🔧" },
    { path:"/dashboard/profile", key:"profile", icon:"⚙️" },
  ],
  driver: [
    { path:"/dashboard", key:"overview", icon:"🏠" },
    { path:"/dashboard/jobs", key:"availableJobs", icon:"📦" },
    { path:"/dashboard/active", key:"activeDelivery", icon:"🚗" },
    { path:"/dashboard/earnings", key:"earnings", icon:"💰" },
    { path:"/dashboard/profile", key:"profile", icon:"⚙️" },
  ],
  admin: [
    { path:"/admin-dashboard", key:"overview", icon:"🏠" },
    { path:"/admin-dashboard/users", label:"Users", icon:"👥" },
    { path:"/admin-dashboard/bookings", key:"bookings", icon:"📅" },
    { path:"/admin-dashboard/revenue", label:"Revenue", icon:"💰" },
    { path:"/admin-dashboard/support", label:"Support", icon:"🎫" },
  ],
}

export default function Layout({ children }) {
  const { profile, signOut } = useAuth()
  const { t, language, toggleLanguage } = useLanguage()
  const { theme } = useTheme()
  const navigate = useNavigate()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(false)
  const [showThemeBanner, setShowThemeBanner] = useState(!localStorage.getItem("ccc_theme_banner_seen"))
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  const [unreadCount, setUnreadCount] = useState(0)
  const { user } = useAuth()

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener("resize", handler)
    return () => window.removeEventListener("resize", handler)
  }, [])

  const role = profile?.role || "customer"

  useEffect(() => {
    if (!user) return
    supabase.from("notifications").select("id",{count:"exact"}).eq("user_id",user.id).eq("is_read",false).then(({count})=>setUnreadCount(count||0))
    const sub = supabase.channel(`layout-notifs-${user.id}`)
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"notifications",filter:`user_id=eq.${user.id}`},()=>setUnreadCount(c=>c+1))
      .on("postgres_changes",{event:"UPDATE",schema:"public",table:"notifications",filter:`user_id=eq.${user.id}`},()=>{
        supabase.from("notifications").select("id",{count:"exact"}).eq("user_id",user.id).eq("is_read",false).then(({count})=>setUnreadCount(count||0))
      })
      .subscribe()
    return () => supabase.removeChannel(sub)
  }, [user?.id])
  const nav = NAV[role] || []
  const bottomNav = BOTTOM_NAV[role] || []
  const initials = `${profile?.first_name?.[0]||""}${profile?.last_name?.[0]||""}`.toUpperCase()

  const roleColors = {
    customer: { active:"#e6821e", activeBg:"#1a1208" },
    provider: { active:"#378add", activeBg:"#0c1f2e" },
    driver:   { active:"#1d9e75", activeBg:"#071a12" },
    admin:    { active:"#8b5cf6", activeBg:"#160a2e" },
  }
  const activeColor = roleColors[role]?.active || theme.primary
  const activeBg = roleColors[role]?.activeBg || theme.primaryBg

  function getLabel(item) {
    if (item.key) return t(item.key)
    return item.label || ""
  }

  function isActive(item) {
    if (item.path === "/dashboard" || item.path === "/admin-dashboard") {
      return location.pathname === item.path
    }
    return location.pathname === item.path || location.pathname.startsWith(item.path + "/")
  }

  if (isMobile) return (
    <div style={{ display:"flex", flexDirection:"column", minHeight:"100vh", background:theme.bg, fontFamily:"'DM Sans',sans-serif", color:theme.text }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@300;400;500&display=swap');
      ::-webkit-scrollbar{width:4px;}::-webkit-scrollbar-track{background:transparent;}::-webkit-scrollbar-thumb{background:${theme.border};border-radius:2px;}`}</style>

      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0.75rem 1rem", borderBottom:`1px solid ${theme.border}`, background:theme.bgSecondary, position:"sticky", top:0, zIndex:50 }}>
        <div style={{ fontFamily:"Syne", fontSize:15, fontWeight:800, color:theme.text }}>
          🚗 Car<span style={{ color:"#e6821e" }}>Care</span>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ fontFamily:"Syne", fontSize:13, fontWeight:700, color:theme.textMuted }}>
            {getLabel(nav.find(n=>isActive(n))||{}) || "Dashboard"}
          </div>
          <button onClick={()=>setMobileMenuOpen(o=>!o)}
            style={{ background:theme.bgCard, border:`1px solid ${theme.border}`, borderRadius:8, color:theme.text, cursor:"pointer", fontSize:18, padding:"4px 10px" }}>
            {mobileMenuOpen?"✕":"☰"}
          </button>
        </div>
      </div>

      {mobileMenuOpen&&(
        <div style={{ position:"fixed", inset:0, zIndex:100, display:"flex" }}>
          <div style={{ flex:1, background:"rgba(0,0,0,0.6)" }} onClick={()=>setMobileMenuOpen(false)}/>
          <div style={{ width:260, background:theme.bgSecondary, borderLeft:`1px solid ${theme.border}`, display:"flex", flexDirection:"column", overflowY:"auto" }}>
            <div style={{ padding:"1rem", borderBottom:`1px solid ${theme.border}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div style={{ fontFamily:"Syne", fontSize:15, fontWeight:800, color:theme.text }}>Menu</div>
              <button onClick={()=>setMobileMenuOpen(false)} style={{ background:"none", border:"none", color:theme.textFaint, cursor:"pointer", fontSize:20 }}>✕</button>
            </div>
            <div style={{ padding:"0.5rem", flex:1 }}>
              {nav.map(item=>(
                <button key={item.path}
                  onClick={()=>{ navigate(item.path); setMobileMenuOpen(false) }}
                  style={{ display:"flex", alignItems:"center", gap:10, width:"100%", padding:"10px 12px", background:isActive(item)?activeBg:"transparent", border:`1px solid ${isActive(item)?activeColor:"transparent"}`, borderRadius:9, color:isActive(item)?activeColor:theme.textMuted, fontSize:13, cursor:"pointer", marginBottom:4, fontFamily:"'DM Sans',sans-serif", textAlign:"left", fontWeight:isActive(item)?600:400 }}>
                  <span style={{ fontSize:18 }}>{item.icon}</span>
                  {getLabel(item)}
                </button>
              ))}
            </div>
            <div style={{ padding:"1rem", borderTop:`1px solid ${theme.border}` }}>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12, padding:"0.75rem", background:theme.bgCard, borderRadius:8 }}>
                <div style={{ width:32, height:32, borderRadius:"50%", background:activeBg, border:`1px solid ${activeColor}40`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:800, color:activeColor, flexShrink:0 }}>{initials}</div>
                <div style={{ minWidth:0, flex:1 }}>
                  <div style={{ fontSize:12, color:theme.text, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{profile?.first_name} {profile?.last_name}</div>
                  <div style={{ fontSize:10, color:theme.textFaint, textTransform:"capitalize" }}>{role}</div>
                </div>
              </div>
              <ThemeSwitcher collapsed={false} />
              <button onClick={toggleLanguage}
                style={{ background:"none", border:`1px solid ${theme.border}`, borderRadius:6, color:theme.textFaint, cursor:"pointer", fontSize:11, width:"100%", textAlign:"center", fontFamily:"'DM Sans',sans-serif", padding:"7px 0", marginTop:6, marginBottom:6 }}>
                🌐 {language==="en"?"Kiswahili":"English"}
              </button>
              <button onClick={()=>{ signOut(); setMobileMenuOpen(false) }}
                style={{ background:"#1a0808", border:"1px solid #e24b4a40", borderRadius:8, color:"#e24b4a", cursor:"pointer", fontSize:13, fontWeight:700, width:"100%", textAlign:"center", fontFamily:"'DM Sans',sans-serif", padding:"10px 0" }}>
                🚪 {t("signOut")}
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ flex:1, padding:"1rem", overflowY:"auto", paddingBottom:80 }}>
        {children}
      </div>

      <AIAssistant />
      <div style={{ position:ixed, bottom:0, left:0, right:0, background:theme.bgSecondary, borderTop:1px solid , display:lex, zIndex:40, paddingBottom:nv(safe-area-inset-bottom) }}>
        {bottomNav.map(item=>(
          <button key={item.path}
            onClick={()=>navigate(item.path)}
            style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:3, padding:"8px 4px", background:"transparent", border:"none", cursor:"pointer", color:isActive(item)?activeColor:theme.textFaint, borderTop:`2px solid ${isActive(item)?activeColor:"transparent"}` }}>
            <span style={{ position:"relative", display:"inline-block" }}>
              <span style={{ fontSize:20 }}>{item.icon}</span>
              {item.key==="notifications"&&unreadCount>0&&(
                <span style={{ position:"absolute", top:-4, right:-4, background:"#e24b4a", color:"#fff", borderRadius:"50%", fontSize:8, fontWeight:800, minWidth:14, height:14, display:"flex", alignItems:"center", justifyContent:"center" }}>{unreadCount>9?"9+":unreadCount}</span>
              )}
            </span>
            <span style={{ fontSize:9, fontFamily:"'DM Sans',sans-serif", fontWeight:isActive(item)?600:400 }}>{getLabel(item)}</span>
          </button>
        ))}
      </div>
    </div>
  )

  return (
    <div style={{ display:"flex", minHeight:"100vh", background:theme.bg, fontFamily:"'DM Sans',sans-serif", color:theme.text }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@300;400;500&display=swap');
        .nav-btn { display:flex; align-items:center; gap:9px; padding:8px 1rem; cursor:pointer; font-size:13px; color:${theme.textFaint}; border:none; background:none; width:100%; text-align:left; border-right:2px solid transparent; transition:all 0.12s; white-space:nowrap; overflow:hidden; }
        .nav-btn:hover { background:${theme.bgCardHover}; color:${theme.textMuted}; }
        .nav-btn.active { color:${activeColor}; border-right-color:${activeColor}; background:${activeBg}; }
        ::-webkit-scrollbar { width:4px; } ::-webkit-scrollbar-track { background:transparent; } ::-webkit-scrollbar-thumb { background:${theme.border}; border-radius:2px; }
      `}</style>

      <div style={{ width:collapsed?52:210, background:theme.bgSecondary, borderRight:`1px solid ${theme.border}`, display:"flex", flexDirection:"column", transition:"width 0.2s", flexShrink:0, overflow:"hidden" }}>
        <div style={{ padding:"1rem", display:"flex", alignItems:"center", gap:8, borderBottom:`1px solid ${theme.border}`, minHeight:52 }}>
          <div style={{ width:28, height:28, background:"#e6821e", borderRadius:6, display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, flexShrink:0 }}>🚗</div>
          {!collapsed&&<span style={{ fontFamily:"Syne", fontSize:13, fontWeight:800, color:theme.text, whiteSpace:"nowrap" }}>Car<span style={{color:"#e6821e"}}>Care</span></span>}
        </div>

        <nav style={{ flex:1, paddingTop:6, overflowY:"auto", overflowX:"hidden" }}>
          {nav.map(item=>(
            <button key={item.path}
              className={`nav-btn${isActive(item)?" active":""}`}
              onClick={()=>navigate(item.path)}
              title={collapsed?getLabel(item):""}>
              <span style={{ fontSize:16, flexShrink:0 }}>{item.icon}</span>
              {!collapsed&&<span style={{ overflow:"hidden", textOverflow:"ellipsis" }}>{getLabel(item)}</span>}
            </button>
          ))}
        </nav>

        <div style={{ padding:"0.75rem", borderTop:`1px solid ${theme.border}` }}>
          {!collapsed&&(
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8, padding:"0.5rem", background:theme.bgCard, borderRadius:8 }}>
              <div style={{ width:28, height:28, borderRadius:"50%", background:activeBg, border:`1px solid ${activeColor}40`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, fontWeight:800, color:activeColor, flexShrink:0 }}>{initials}</div>
              <div style={{ minWidth:0, flex:1 }}>
                <div style={{ fontSize:12, color:theme.textMuted, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{profile?.first_name} {profile?.last_name}</div>
                <div style={{ fontSize:10, color:theme.textFaint, textTransform:"capitalize" }}>{role}</div>
              </div>
            </div>
          )}
          {collapsed&&(
            <div style={{ width:28, height:28, borderRadius:"50%", background:activeBg, border:`1px solid ${activeColor}40`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, fontWeight:800, color:activeColor, margin:"0 auto 8px" }}>{initials}</div>
          )}

          <ThemeSwitcher collapsed={collapsed} />

          <button onClick={toggleLanguage}
            style={{ background:"none", border:`1px solid ${theme.border}`, borderRadius:6, color:theme.textFaint, cursor:"pointer", fontSize:11, width:"100%", textAlign:"center", fontFamily:"'DM Sans',sans-serif", padding:"5px 0", marginBottom:4 }}
            title={language==="en"?"Switch to Swahili":"Badilisha kwenda Kiingereza"}>
            {collapsed?"🌐":`🌐 ${language==="en"?"Kiswahili":"English"}`}
          </button>

          <button onClick={()=>setCollapsed(c=>!c)}
            style={{ background:"none", border:"none", color:theme.textVeryFaint, cursor:"pointer", fontSize:11, width:"100%", textAlign:"center", fontFamily:"'DM Sans',sans-serif", padding:"4px 0", marginBottom:6 }}>
            {collapsed?"→":`← ${t("collapse")}`}
          </button>

          <button onClick={signOut}
            style={{ background:"#1a0808", border:"1px solid #e24b4a40", borderRadius:8, color:"#e24b4a", cursor:"pointer", fontSize:12, fontWeight:700, width:"100%", textAlign:"center", fontFamily:"'DM Sans',sans-serif", padding:"8px 0", transition:"all 0.12s" }}>
            {collapsed?"🚪":`🚪 ${t("signOut")}`}
          </button>
        </div>
      </div>

      <div style={{ flex:1, display:"flex", flexDirection:"column", minWidth:0, overflow:"hidden" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0.9rem 1.5rem", borderBottom:`1px solid ${theme.border}`, flexShrink:0, background:theme.bgSecondary }}>
          <div style={{ fontFamily:"Syne", fontSize:16, fontWeight:700, color:theme.text }}>
            {getLabel(nav.find(n=>isActive(n))||{}) || "Dashboard"}
          </div>
          <div style={{ fontSize:11, color:theme.textFaint }}>{new Date().toDateString()}</div>
        </div>
        <div style={{ flex:1, padding:"1.5rem", overflowY:"auto", background:theme.bg }}>{children}</div>
        <AIAssistant />
      </div>
    </div>
  )
}
























