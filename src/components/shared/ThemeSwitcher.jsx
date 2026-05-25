import { useState } from "react"
import { useTheme, THEMES } from "../../contexts/ThemeContext"

export default function ThemeSwitcher({ collapsed }) {
  const { themeName, setThemeName, theme } = useTheme()
  const [open, setOpen] = useState(false)

  return (
    <div style={{ position:"relative" }}>
      <button onClick={()=>setOpen(o=>!o)}
        title="Change theme"
        style={{ background:"none", border:`1px solid ${theme.border}`, borderRadius:6, color:theme.textFaint, cursor:"pointer", fontSize:11, width:"100%", textAlign:"center", fontFamily:"'DM Sans',sans-serif", padding:"5px 0", marginBottom:4, display:"flex", alignItems:"center", justifyContent:"center", gap:6, transition:"all 0.12s" }}>
        <span style={{ fontSize:14 }}>{THEMES[themeName]?.icon}</span>
        {!collapsed&&<span>{THEMES[themeName]?.name}</span>}
      </button>

      {open&&(
        <div style={{ position:"absolute", bottom:"100%", left:0, right:0, background:theme.bgCard, border:`1px solid ${theme.border}`, borderRadius:10, padding:6, marginBottom:4, zIndex:100, minWidth:160 }}>
          <div style={{ fontSize:10, color:theme.textFaint, textTransform:"uppercase", letterSpacing:"0.08em", padding:"4px 8px", marginBottom:4 }}>Choose theme</div>
          {Object.entries(THEMES).map(([key, t])=>(
            <button key={key} onClick={()=>{ setThemeName(key); setOpen(false) }}
              style={{ display:"flex", alignItems:"center", gap:10, width:"100%", padding:"8px 10px", background:themeName===key?theme.primaryBg:"transparent", border:`1px solid ${themeName===key?theme.primaryBorder:"transparent"}`, borderRadius:8, cursor:"pointer", marginBottom:2, transition:"all 0.12s" }}>
              <span style={{ fontSize:16 }}>{t.icon}</span>
              <div style={{ textAlign:"left" }}>
                <div style={{ fontSize:12, fontWeight:themeName===key?600:400, color:themeName===key?theme.primary:theme.textMuted }}>{t.name}</div>
              </div>
              <div style={{ marginLeft:"auto", display:"flex", gap:3 }}>
                {[t.bg, t.bgCard, t.primary].map((c,i)=>(
                  <div key={i} style={{ width:10, height:10, borderRadius:"50%", background:c, border:"1px solid rgba(255,255,255,0.1)" }}/>
                ))}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
