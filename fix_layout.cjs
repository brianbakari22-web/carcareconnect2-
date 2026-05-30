const fs = require('fs');
let content = fs.readFileSync('src/components/shared/Layout.jsx', 'utf8');

// Update BOTTOM_NAV
const oldNav = `const BOTTOM_NAV = {
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
}`;

const newNav = `const BOTTOM_NAV = {
  customer: [
    { path:"/dashboard", key:"overview", icon:"🏠" },
    { path:"/dashboard/bookings", key:"bookings", icon:"📅" },
    { path:"/dashboard/services", key:"findServices", icon:"🔍" },
    { path:"/dashboard/chat", key:"messages", icon:"✉️" },
    { path:"more", label:"More", icon:"⋯" },
  ],
  provider: [
    { path:"/dashboard", key:"overview", icon:"🏠" },
    { path:"/dashboard/bookings", key:"bookings", icon:"📅" },
    { path:"/dashboard/services", key:"myServices", icon:"🔧" },
    { path:"/dashboard/chat", key:"messages", icon:"✉️" },
    { path:"more", label:"More", icon:"⋯" },
  ],
  driver: [
    { path:"/dashboard", key:"overview", icon:"🏠" },
    { path:"/dashboard/jobs", key:"availableJobs", icon:"📦" },
    { path:"/dashboard/active", key:"activeDelivery", icon:"🚗" },
    { path:"/dashboard/earnings", key:"earnings", icon:"💰" },
    { path:"more", label:"More", icon:"⋯" },
  ],
  admin: [
    { path:"/admin-dashboard", key:"overview", icon:"🏠" },
    { path:"/admin-dashboard/users", label:"Users", icon:"👥" },
    { path:"/admin-dashboard/bookings", key:"bookings", icon:"📅" },
    { path:"/admin-dashboard/revenue", label:"Revenue", icon:"💰" },
    { path:"more", label:"More", icon:"⋯" },
  ],
}`;

content = content.replace(oldNav, newNav);

// Fix bottom nav click handler and add drawer
const oldBottomNav = `      <AIAssistant />
      <div style={{ position:"fixed", bottom:0, left:0, right:0, background:theme.bgSecondary, borderTop:\`1px solid \${theme.border}\`, display:"flex", zIndex:40, paddingBottom:"env(safe-area-inset-bottom)" }}>
        {bottomNav.map(item=>(
          <button key={item.path}
            onClick={()=>navigate(item.path)}`;

const newBottomNav = `      <AIAssistant />

      {showMore&&(
        <>
          <div onClick={()=>setShowMore(false)} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", zIndex:48 }}/>
          <div style={{ position:"fixed", bottom:56, left:0, right:0, background:theme.bgCard, borderTop:"1px solid "+theme.border, borderTopLeftRadius:20, borderTopRightRadius:20, zIndex:49, maxHeight:"75vh", overflowY:"auto", padding:"1rem 1rem 2rem" }}>
            <div style={{ width:40, height:4, background:theme.border, borderRadius:2, margin:"0 auto 1rem" }}/>
            <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:800, color:theme.text, marginBottom:"1rem" }}>All Features</div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8 }}>
              {NAV[role]?.map(item=>(
                <button key={item.path} onClick={()=>{ navigate(item.path); setShowMore(false) }}
                  style={{ background:location.pathname===item.path?activeBg:"transparent", border:"1px solid "+(location.pathname===item.path?activeColor:theme.border), borderRadius:10, padding:"0.75rem 0.5rem", cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
                  <span style={{ fontSize:22 }}>{item.icon}</span>
                  <span style={{ fontSize:9, color:location.pathname===item.path?activeColor:theme.textMuted, textAlign:"center", lineHeight:1.3 }}>{item.label||item.key}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      <div style={{ position:"fixed", bottom:0, left:0, right:0, background:theme.bgSecondary, borderTop:\`1px solid \${theme.border}\`, display:"flex", zIndex:40, paddingBottom:"env(safe-area-inset-bottom)" }}>
        {bottomNav.map(item=>(
          <button key={item.path}
            onClick={item.path==="more"?()=>setShowMore(s=>!s):()=>navigate(item.path)}`;

content = content.replace(oldBottomNav, newBottomNav);

fs.writeFileSync('src/components/shared/Layout.jsx', content, 'utf8');
console.log('done');
