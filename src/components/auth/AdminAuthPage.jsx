import { useState, useEffect, useRef, memo, useMemo } from "react"
import { useAuth } from "../../contexts/AuthContext"
import { useNavigate } from "react-router-dom"
import { supabase } from "../../lib/supabase"
import useIsMobile from "../../lib/useIsMobile"
import toast from "react-hot-toast"

const NetworkCanvas = memo(function NetworkCanvas() {
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
})

const LogoBg = memo(function LogoBg({ isMobile }) {
  return (
    <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", zIndex:1, pointerEvents:"none" }}>
      <svg
        width={isMobile?"95vw":"95vw"}
        height={isMobile?"60vw":"90vh"}
        viewBox="0 0 680 400"
        xmlns="http://www.w3.org/2000/svg"
        style={{ opacity:0.18, maxWidth:"95vw" }}>
        <circle cx="230" cy="200" r="90" fill="none" stroke="#e6821e" strokeWidth="1.5"/>
        <circle cx="230" cy="200" r="82" fill="none" stroke="#e6821e" strokeWidth="0.5" opacity="0.4"/>
        <rect x="170" y="195" width="120" height="36" rx="8" fill="#e6821e"/>
        <path d="M188 195 Q196 172 214 168 L246 168 Q264 172 272 195 Z" fill="#e6821e"/>
        <path d="M193 195 Q199 178 213 175 L235 175 Q249 178 255 195 Z" fill="#ffffff" opacity="0.5"/>
        <line x1="230" y1="175" x2="230" y2="195" stroke="#ffffff" strokeWidth="1" opacity="0.4"/>
        <circle cx="196" cy="231" r="14" fill="#ffffff" stroke="#e6821e" strokeWidth="2"/>
        <circle cx="196" cy="231" r="6" fill="#e6821e"/>
        <circle cx="264" cy="231" r="14" fill="#ffffff" stroke="#e6821e" strokeWidth="2"/>
        <circle cx="264" cy="231" r="6" fill="#e6821e"/>
        <rect x="285" y="204" width="8" height="6" rx="2" fill="#fff" opacity="0.8"/>
        <rect x="167" y="204" width="6" height="6" rx="2" fill="#ff4444" opacity="0.8"/>
        <text x="350" y="175" fontFamily="Arial Black, Arial, sans-serif" fontSize="42" fontWeight="900" fill="#000000" letterSpacing="-1">Car<tspan fill="#e6821e">Care</tspan></text>
        <text x="350" y="225" fontFamily="Arial Black, Arial, sans-serif" fontSize="42" fontWeight="900" fill="#000000" letterSpacing="-1">Connect</text>
        <text x="350" y="258" fontFamily="Arial, sans-serif" fontSize="12" fill="#888" letterSpacing="2">DRIVE CONFIDENTLY · SERVICE SIMPLY</text>
        <line x1="350" y1="272" x2="620" y2="272" stroke="#e6821e" strokeWidth="0.5" opacity="0.4"/>
        <text x="350" y="294" fontFamily="Arial, sans-serif" fontSize="11" fill="#555" letterSpacing="1">Nairobi's trusted auto care network</text>
      </svg>
    </div>
  )
})

const LiveClock = memo(function LiveClock({ isMobile }) {
  const [time, setTime] = useState(new Date())
  useEffect(() => {
    const tick = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(tick)
  }, [])
  return (
    <div style={{ textAlign:"center", marginBottom:"1.5rem" }}>
      <div style={{ fontFamily:"Syne", fontSize:isMobile?32:56, fontWeight:800, color:"#8b5cf6", letterSpacing:isMobile?2:4, marginBottom:6 }}>
        {time.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit",second:"2-digit"})}
      </div>
      <div style={{ fontSize:11, color:"#444" }}>
        {time.toLocaleDateString("default",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}
      </div>
    </div>
  )
})

const LoginSheet = memo(function LoginSheet({ isMobile, onClose }) {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ email:"", password:"" })
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    try {
      await signIn({ email: form.email, password: form.password })
      await new Promise(r => setTimeout(r, 1000))
      let { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        await new Promise(r => setTimeout(r, 1000))
        const retry = await supabase.auth.getUser()
        user = retry.data.user
      }
      if (!user) { toast.error("Session error — try again"); setLoading(false); return }
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
      if (profile?.role !== "admin") {
        await supabase.auth.signOut()
        toast.error("Access denied — not an admin account")
        setLoading(false)
        return
      }
      window.location.href = "/admin-dashboard"
    } catch(err) {
      toast.error(err.message || "Invalid credentials")
    } finally {
      setLoading(false)
    }
  }

  const inp = (extra={}) => ({
    width:"100%", background:"#555555", border:"1px solid #eeeeee", borderRadius:10,
    padding:"13px 16px", color:"#000000", fontSize:13, outline:"none",
    fontFamily:"'DM Sans',sans-serif", ...extra
  })

  return (
    <div
      style={{ position:"fixed", inset:0, zIndex:200, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:isMobile?"flex-end":"center" }}
      onClick={e=>{ if(e.target===e.currentTarget) onClose() }}>
      <div style={{ position:"absolute", inset:0, background:"rgba(0,0,0,0.75)" }} onClick={onClose}/>
      <div style={{
        position:"relative", zIndex:1,
        background:"#ffffff",
        borderRadius: isMobile?"20px 20px 0 0":"16px",
        padding:"2rem",
        width: isMobile?"100%":"420px",
        border:"1px solid #eeeeee",
        borderBottom: isMobile?"none":"1px solid #eeeeee",
      }}>
        {isMobile&&<div style={{ width:40, height:4, background:"#555555", borderRadius:2, margin:"0 auto 1.5rem" }}/>}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"1.5rem" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ width:40, height:40, background:"#faf5ff", borderRadius:10, display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, border:"1px solid #8b5cf630" }}>🔐</div>
            <div>
              <div style={{ fontFamily:"Syne", fontSize:16, fontWeight:800, color:"#000000" }}>Admin Access</div>
              <div style={{ fontSize:11, color:"#555" }}>Restricted area</div>
            </div>
          </div>
          {!isMobile&&(
            <button onClick={onClose} style={{ background:"#ffffff", border:"none", borderRadius:"50%", width:32, height:32, color:"#666", cursor:"pointer", fontSize:18, display:"flex", alignItems:"center", justifyContent:"center" }}>×</button>
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
            style={{ width:"100%", background:loading?"#555555":"#8b5cf6", border:"none", borderRadius:10, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:14, fontWeight:700, padding:"14px", cursor:loading?"not-allowed":"pointer", marginBottom:16 }}>
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
})

export default function AdminAuthPage() {
  const isMobile = useIsMobile()
  const [sheetOpen, setSheetOpen] = useState(false)

  const bg = useMemo(() => (
    <>
      <NetworkCanvas />
      <LogoBg isMobile={isMobile} />
    </>
  ), [isMobile])

  const features = [
    {icon:"🔐", text:"Two-factor authentication"},
    {icon:"🛡️", text:"Role-based access control"},
    {icon:"📊", text:"Full platform oversight"},
    {icon:"⚡", text:"Real-time monitoring"},
  ]

  return (
    <div style={{ minHeight:"100vh", background:"#ffffff", position:"relative", overflow:"hidden", fontFamily:"'DM Sans',sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@300;400;500&display=swap'); @keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {bg}

      <div style={{ position:"relative", zIndex:2, minHeight:"100vh", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"flex-end", paddingBottom:"3rem", padding:"2rem" }}>

        <div style={{ position:"absolute", top:"1.5rem", left:"1.5rem" }}>
          <div style={{ fontFamily:"Syne", fontSize:isMobile?15:20, fontWeight:800, color:"#000000" }}>
            Car<span style={{ color:"#e6821e" }}>Care</span> Connect
          </div>
          <div style={{ fontSize:10, color:"#555", marginTop:2 }}>Admin Control Center</div>
        </div>

        <div style={{ position:"absolute", top:"1.5rem", right:"1.5rem", textAlign:"right" }}>
          <div style={{ display:"flex", alignItems:"center", gap:5, justifyContent:"flex-end" }}>
            <div style={{ width:6, height:6, borderRadius:"50%", background:"#1d9e75" }}/>
            <span style={{ fontSize:10, color:"#1d9e75", fontWeight:600 }}>Platform live</span>
          </div>
        </div>

        <div style={{ textAlign:"center", width:"100%", maxWidth:isMobile?340:500 }}>
          <LiveClock isMobile={isMobile} />

          <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr 1fr":"repeat(4,1fr)", gap:8, marginBottom:"2rem" }}>
            {features.map(f=>(
              <div key={f.text} style={{ background:"rgba(22,10,46,0.85)", border:"1px solid #8b5cf620", borderRadius:10, padding:isMobile?"0.6rem":"0.75rem", textAlign:"center" }}>
                <div style={{ fontSize:isMobile?18:20, marginBottom:4 }}>{f.icon}</div>
                <div style={{ fontSize:isMobile?9:10, color:"#666", lineHeight:1.4 }}>{f.text}</div>
              </div>
            ))}
          </div>

          <button onClick={()=>setSheetOpen(true)}
            style={{ background:"#8b5cf6", border:"none", borderRadius:14, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:isMobile?14:16, fontWeight:700, padding:isMobile?"12px 32px":"16px 48px", cursor:"pointer", display:"inline-flex", alignItems:"center", gap:10 }}>
            🔐 Admin Sign In
          </button>

          <div style={{ marginTop:12, fontSize:10, color:"#555555" }}>
            Authorized personnel only · Access is logged
          </div>
        </div>
      </div>

      {sheetOpen&&<LoginSheet isMobile={isMobile} onClose={()=>setSheetOpen(false)} />}
    </div>
  )
}



