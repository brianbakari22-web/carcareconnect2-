import { useState, useEffect, useRef } from "react"
import { useAuth } from "../../contexts/AuthContext"
import { useNavigate } from "react-router-dom"
import { supabase } from "../../lib/supabase"
import { useTheme } from "../../contexts/ThemeContext"
import useIsMobile from "../../lib/useIsMobile"
import toast from "react-hot-toast"

function NetworkCanvas() {
  const canvasRef = useRef(null)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    let animId
    const resize = () => { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight }
    resize()
    window.addEventListener("resize", resize)
    const dots = Array.from({ length: 60 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      r: Math.random() * 1.5 + 0.5,
    }))
    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      dots.forEach(d => {
        d.x += d.vx; d.y += d.vy
        if (d.x < 0 || d.x > canvas.width) d.vx *= -1
        if (d.y < 0 || d.y > canvas.height) d.vy *= -1
        ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2)
        ctx.fillStyle = "rgba(139,92,246,0.8)"; ctx.fill()
      })
      for (let i = 0; i < dots.length; i++) {
        for (let j = i + 1; j < dots.length; j++) {
          const dx = dots[i].x - dots[j].x
          const dy = dots[i].y - dots[j].y
          const dist = Math.sqrt(dx*dx + dy*dy)
          if (dist < 100) {
            ctx.beginPath(); ctx.moveTo(dots[i].x, dots[i].y); ctx.lineTo(dots[j].x, dots[j].y)
            ctx.strokeStyle = `rgba(139,92,246,${0.2*(1-dist/100)})`; ctx.lineWidth = 0.5; ctx.stroke()
          }
        }
      }
      animId = requestAnimationFrame(draw)
    }
    draw()
    return () => { cancelAnimationFrame(animId); window.removeEventListener("resize", resize) }
  }, [])
  return <canvas ref={canvasRef} style={{ position:"absolute", inset:0, width:"100%", height:"100%" }}/>
}

function LogoBg({ opacity=0.18 }) {
  return (
    <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", zIndex:1, pointerEvents:"none" }}>
      <svg width="520" height="320" viewBox="0 0 680 400" xmlns="http://www.w3.org/2000/svg" style={{ opacity }}>
        <circle cx="230" cy="200" r="90" fill="none" stroke="#e6821e" strokeWidth="1.5"/>
        <circle cx="230" cy="200" r="82" fill="none" stroke="#e6821e" strokeWidth="0.5" opacity="0.4"/>
        <rect x="170" y="195" width="120" height="36" rx="8" fill="#e6821e"/>
        <path d="M188 195 Q196 172 214 168 L246 168 Q264 172 272 195 Z" fill="#e6821e"/>
        <path d="M193 195 Q199 178 213 175 L235 175 Q249 178 255 195 Z" fill="#0a0a0a" opacity="0.5"/>
        <line x1="230" y1="175" x2="230" y2="195" stroke="#0a0a0a" strokeWidth="1" opacity="0.4"/>
        <circle cx="196" cy="231" r="14" fill="#1a1a1a" stroke="#e6821e" strokeWidth="2"/>
        <circle cx="196" cy="231" r="6" fill="#e6821e"/>
        <circle cx="264" cy="231" r="14" fill="#1a1a1a" stroke="#e6821e" strokeWidth="2"/>
        <circle cx="264" cy="231" r="6" fill="#e6821e"/>
        <rect x="285" y="204" width="8" height="6" rx="2" fill="#fff" opacity="0.8"/>
        <rect x="167" y="204" width="6" height="6" rx="2" fill="#ff4444" opacity="0.8"/>
        <text x="350" y="175" fontFamily="Arial Black, Arial, sans-serif" fontSize="42" fontWeight="900" fill="#f0ede6" letterSpacing="-1">Car<tspan fill="#e6821e">Care</tspan></text>
        <text x="350" y="225" fontFamily="Arial Black, Arial, sans-serif" fontSize="42" fontWeight="900" fill="#f0ede6" letterSpacing="-1">Connect</text>
        <text x="350" y="258" fontFamily="Arial, sans-serif" fontSize="12" fill="#888" letterSpacing="2">DRIVE CONFIDENTLY · SERVICE SIMPLY</text>
        <line x1="350" y1="272" x2="620" y2="272" stroke="#e6821e" strokeWidth="0.5" opacity="0.4"/>
        <text x="350" y="294" fontFamily="Arial, sans-serif" fontSize="11" fill="#555" letterSpacing="1">Nairobi's trusted auto care network</text>
      </svg>
    </div>
  )
}

export default function AdminAuthPage() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const { theme } = useTheme()
  const isMobile = useIsMobile()
  const [form, setForm] = useState({ email:"", password:"" })
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [time, setTime] = useState(new Date())
  const [sheetOpen, setSheetOpen] = useState(false)

  useEffect(() => {
    const tick = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(tick)
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    try {
      await signIn({ email: form.email, password: form.password })
      await new Promise(r => setTimeout(r, 500))
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { toast.error("Session error — try again"); setLoading(false); return }
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
      if (profile?.role !== "admin") {
        await supabase.auth.signOut()
        toast.error("Access denied — not an admin account")
        setLoading(false)
        return
      }
      navigate("/admin-dashboard")
    } catch(err) {
      toast.error(err.message || "Invalid credentials")
    } finally {
      setLoading(false)
    }
  }

  const inp = (extra={}) => ({
    width:"100%", background:"#111", border:"1px solid #2a2a2a", borderRadius:10,
    padding:"13px 16px", color:"#f0ede6", fontSize:13, outline:"none",
    fontFamily:"'DM Sans',sans-serif", transition:"border-color 0.15s", ...extra
  })

  const features = [
    {icon:"🔐", text:"Two-factor authentication"},
    {icon:"🛡️", text:"Role-based access control"},
    {icon:"📊", text:"Full platform oversight"},
    {icon:"⚡", text:"Real-time monitoring"},
  ]

  const LoginSheet = () => (
    <div style={{ position:"fixed", inset:0, zIndex:200, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:isMobile?"flex-end":"center" }}
      onClick={e=>{ if(e.target===e.currentTarget) setSheetOpen(false) }}>
      <div style={{ position:"absolute", inset:0, background:"rgba(0,0,0,0.7)" }} onClick={()=>setSheetOpen(false)}/>
      <div style={{
        position:"relative", zIndex:1,
        background:"#0f0f0f",
        borderRadius: isMobile?"20px 20px 0 0":"16px",
        padding:"2rem",
        width: isMobile?"100%":"420px",
        border:"1px solid #2a2a2a",
        borderBottom: isMobile?"none":"1px solid #2a2a2a",
        animation:"slideUp 0.3s ease",
      }}>
        {isMobile&&<div style={{ width:40, height:4, background:"#333", borderRadius:2, margin:"0 auto 1.5rem" }}/>}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"1.5rem" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ width:40, height:40, background:"#160a2e", borderRadius:10, display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, border:"1px solid #8b5cf630" }}>🔐</div>
            <div>
              <div style={{ fontFamily:"Syne", fontSize:16, fontWeight:800, color:"#f0ede6" }}>Admin Access</div>
              <div style={{ fontSize:11, color:"#555" }}>Restricted area</div>
            </div>
          </div>
          {!isMobile&&(
            <button onClick={()=>setSheetOpen(false)}
              style={{ background:"#1a1a1a", border:"none", borderRadius:"50%", width:32, height:32, color:"#666", cursor:"pointer", fontSize:18, display:"flex", alignItems:"center", justifyContent:"center" }}>
              ×
            </button>
          )}
        </div>

        <div style={{ height:1, background:"linear-gradient(90deg,#8b5cf640,transparent)", marginBottom:"1.5rem" }}/>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom:16 }}>
            <label style={{ fontSize:11, color:"#666", textTransform:"uppercase", letterSpacing:"0.08em", display:"block", marginBottom:6 }}>Email address</label>
            <input type="email" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} required autoFocus placeholder="admin@carcareconnect.com" style={inp()}/>
          </div>
          <div style={{ marginBottom:24 }}>
            <label style={{ fontSize:11, color:"#666", textTransform:"uppercase", letterSpacing:"0.08em", display:"block", marginBottom:6 }}>Password</label>
            <div style={{ position:"relative" }}>
              <input type={showPassword?"text":"password"} value={form.password} onChange={e=>setForm(f=>({...f,password:e.target.value}))} required placeholder="Enter your password" style={inp({ paddingRight:44 })}/>
              <button type="button" onClick={()=>setShowPassword(s=>!s)}
                style={{ position:"absolute", right:14, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", color:"#555", cursor:"pointer", fontSize:16 }}>
                {showPassword?"🙈":"👁️"}
              </button>
            </div>
          </div>
          <button type="submit" disabled={loading}
            style={{ width:"100%", background:loading?"#333":"#8b5cf6", border:"none", borderRadius:10, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:14, fontWeight:700, padding:"14px", cursor:loading?"not-allowed":"pointer", transition:"all 0.15s", marginBottom:16 }}>
            {loading?(
              <span style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
                <span style={{ width:14, height:14, border:"2px solid #fff", borderTopColor:"transparent", borderRadius:"50%", display:"inline-block", animation:"spin 0.8s linear infinite" }}/>
                Signing in...
              </span>
            ):"Sign in →"}
          </button>
          <div style={{ display:"flex", gap:8, alignItems:"flex-start" }}>
            <span style={{ fontSize:14 }}>⚠️</span>
            <div style={{ fontSize:11, color:"#444", lineHeight:1.6 }}>Restricted area. Unauthorized access attempts are logged.</div>
          </div>
        </form>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight:"100vh", background:"#0a0a0a", position:"relative", overflow:"hidden", fontFamily:"'DM Sans',sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@300;400;500&display=swap');
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes slideUp { from { transform:translateY(40px); opacity:0 } to { transform:translateY(0); opacity:1 } }
        @keyframes fadeIn { from { opacity:0 } to { opacity:1 } }
      `}</style>

      {/* Full screen background */}
      <NetworkCanvas />
      <LogoBg opacity={0.18} />

      {/* Content overlay */}
      <div style={{ position:"relative", zIndex:2, minHeight:"100vh", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"2rem" }}>

        {/* Brand top */}
        <div style={{ position:"absolute", top:"2rem", left:"2rem" }}>
          <div style={{ fontFamily:"Syne", fontSize:isMobile?16:20, fontWeight:800, color:"#f0ede6" }}>
            Car<span style={{ color:"#e6821e" }}>Care</span> Connect
          </div>
          <div style={{ fontSize:11, color:"#555", marginTop:2 }}>Admin Control Center</div>
        </div>

        {/* Live status top right */}
        <div style={{ position:"absolute", top:"2rem", right:"2rem", textAlign:"right" }}>
          <div style={{ display:"flex", alignItems:"center", gap:6, justifyContent:"flex-end", marginBottom:4 }}>
            <div style={{ width:6, height:6, borderRadius:"50%", background:"#1d9e75", boxShadow:"0 0 6px #1d9e75" }}/>
            <span style={{ fontSize:10, color:"#1d9e75", fontWeight:600 }}>Platform live</span>
          </div>
          <div style={{ fontSize:10, color:"#444" }}>
            {time.toLocaleDateString("default",{weekday:"short",day:"numeric",month:"short"})}
          </div>
        </div>

        {/* Center — clock + features + button */}
        <div style={{ textAlign:"center", maxWidth:480 }}>
          <div style={{ fontFamily:"Syne", fontSize:isMobile?36:56, fontWeight:800, color:"#8b5cf6", letterSpacing:isMobile?2:4, marginBottom:8 }}>
            {time.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit",second:"2-digit"})}
          </div>
          <div style={{ fontSize:12, color:"#444", marginBottom:"2.5rem" }}>
            {time.toLocaleDateString("default",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}
          </div>

          <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr 1fr":"repeat(4,1fr)", gap:10, marginBottom:"2.5rem" }}>
            {features.map(f=>(
              <div key={f.text} style={{ background:"rgba(22,10,46,0.8)", border:"1px solid #8b5cf620", borderRadius:10, padding:"0.75rem", textAlign:"center", backdropFilter:"blur(4px)" }}>
                <div style={{ fontSize:20, marginBottom:4 }}>{f.icon}</div>
                <div style={{ fontSize:10, color:"#666", lineHeight:1.4 }}>{f.text}</div>
              </div>
            ))}
          </div>

          <button onClick={()=>setSheetOpen(true)}
            style={{ background:"#8b5cf6", border:"none", borderRadius:14, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:isMobile?15:16, fontWeight:700, padding:isMobile?"14px 36px":"16px 48px", cursor:"pointer", display:"inline-flex", alignItems:"center", gap:10 }}>
            🔐 Admin Sign In
          </button>

          <div style={{ marginTop:16, fontSize:11, color:"#333" }}>
            Authorized personnel only · Access is logged
          </div>
        </div>
      </div>

      {sheetOpen&&<LoginSheet />}
    </div>
  )
}
