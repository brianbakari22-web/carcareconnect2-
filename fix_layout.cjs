const fs = require('fs');
let content = fs.readFileSync('src/components/shared/Layout.jsx', 'utf8');

// Update BOTTOM_NAV paths
content = content.replace(
  '{ path:"/dashboard/chat", key:"messages", icon:"✉️" },\n    { path:"/dashboard/profile", key:"profile", icon:"⚙️" },\n  ],\n  provider:',
  '{ path:"/dashboard/chat", key:"messages", icon:"✉️" },\n    { path:"more", label:"More", icon:"⋯" },\n  ],\n  provider:'
);
content = content.replace(
  '{ path:"/dashboard/mechanics", label:"Mechanics", icon:"👨‍🔧" },\n    { path:"/dashboard/profile", key:"profile", icon:"⚙️" },\n  ],\n  driver:',
  '{ path:"/dashboard/chat", key:"messages", icon:"✉️" },\n    { path:"more", label:"More", icon:"⋯" },\n  ],\n  driver:'
);
content = content.replace(
  '{ path:"/dashboard/earnings", key:"earnings", icon:"💰" },\n    { path:"/dashboard/profile", key:"profile", icon:"⚙️" },\n  ],\n  admin:',
  '{ path:"/dashboard/earnings", key:"earnings", icon:"💰" },\n    { path:"more", label:"More", icon:"⋯" },\n  ],\n  admin:'
);
content = content.replace(
  '{ path:"/admin-dashboard/support", label:"Support", icon:"🎫" },\n  ],\n}',
  '{ path:"more", label:"More", icon:"⋯" },\n  ],\n}'
);

// Add More drawer and fix onClick
const oldSection = '      <AIAssistant />\n      <div style={{ position:"fixed", bottom:0, left:0, right:0, background:theme.bgSecondary, borderTop:`1px solid ${theme.border}`, display:"flex", zIndex:40, paddingBottom:"env(safe-area-inset-bottom)" }}>\n          {bottomNav.map(item=>(\n            <button key={item.path}';

const newSection = `      <AIAssistant />

      {showMore&&(
        <>
          <div onClick={()=>setShowMore(false)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:48}}/>
          <div style={{position:"fixed",bottom:56,left:0,right:0,background:theme.bgCard,borderTop:"1px solid "+theme.border,borderTopLeftRadius:20,borderTopRightRadius:20,zIndex:49,maxHeight:"75vh",overflowY:"auto",padding:"1rem 1rem 2rem"}}>
            <div style={{width:40,height:4,background:theme.border,borderRadius:2,margin:"0 auto 1rem"}}/>
            <div style={{fontFamily:"Syne",fontSize:14,fontWeight:800,color:theme.text,marginBottom:"1rem"}}>All Features</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
              {NAV[role]?.map(item=>(
                <button key={item.path} onClick={()=>{navigate(item.path);setShowMore(false)}}
                  style={{background:location.pathname===item.path?activeBg:"transparent",border:"1px solid "+(location.pathname===item.path?activeColor:theme.border),borderRadius:10,padding:"0.75rem 0.5rem",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
                  <span style={{fontSize:22}}>{item.icon}</span>
                  <span style={{fontSize:9,color:location.pathname===item.path?activeColor:theme.textMuted,textAlign:"center",lineHeight:1.3}}>{item.label||item.key}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      <div style={{ position:"fixed", bottom:0, left:0, right:0, background:theme.bgSecondary, borderTop:\`1px solid \${theme.border}\`, display:"flex", zIndex:40, paddingBottom:"env(safe-area-inset-bottom)" }}>
          {bottomNav.map(item=>(
            <button key={item.path} onClick={item.path==="more"?()=>setShowMore(s=>!s):()=>navigate(item.path)}`;

content = content.replace(oldSection, newSection);

fs.writeFileSync('src/components/shared/Layout.jsx', content, 'utf8');
console.log('done - length: ' + content.length);
