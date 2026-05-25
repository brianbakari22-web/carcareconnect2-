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
    const dots = Array.from({ length: 50 }, () => ({
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
        ctx.fillStyle = "rgba(139,92,246,0.7)"; ctx.fill()
      })
      for (let i = 0; i < dots.length; i++) {
        for (let j = i + 1; j < dots.length; j++) {
          const dx = dots[i].x - dots[j].x
          const dy = dots[i].y - dots[j].y
          const dist = Math.sqrt(dx*dx + dy*dy)
          if (dist < 120) {
            ctx.beginPath(); ctx.moveTo(dots[i].x, dots[i].y); ctx.lineTo(dots[j].x, dots[j].y)
            ctx.strokeStyle = `rgba(139,92,246,${0.15*(1-dist/120)})`; ctx.lineWidth = 0.5; ctx.stroke()
          }
        }
      }
      animId = requestAnimationFrame(draw)
    }
    draw()
    return () => { cancelAnimationFrame(animId); window.removeEventListener("resize", resize) }
  }, [])
  return <canvas ref={canvasRef} style={{ position:"absolute", inset:0, width:"100%", height:"100%", opacity:0.5 }}/>
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

  const inp = { width:"100%", background:"#111", border:"1px solid #2a2a2a", borderRadius:10, padding:"13px 16px", color:"#f0ede6", fontSize:13, outline:"none", fontFamily:"'DM Sans',sans-serif", transition:"border-color 0.15s" }

  const LoginForm = () => (
    <form onSubmit={handleSubmit}>
      <div style={{ marginBottom:16 }}>
        <label style={{ fontSize:11, color:"#666", textTransform:"uppercase", letterSpacing:"0.08em", display:"block", marginBottom:6 }}>Email address</label>
        <input type="email" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} required autoFocus
          placeholder="admin@carcareconnect.com" style={inp}/>
      </div>
      <div style={{ marginBottom:24 }}>
        <label style={{ fontSize:11, color:"#666", textTransform:"uppercase", letterSpacing:"0.08em", display:"block", marginBottom:6 }}>Password</label>
        <div style={{ position:"relative" }}>
          <input type={showPassword?"text":"password"} value={form.password} onChange={e=>setForm(f=>({...f,password:e.target.value}))} required
            placeholder="Enter your password"
            style={{ ...inp, paddingRight:44 }}/>
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
        <div style={{ fontSize:11, color:"#444", lineHeight:1.6 }}>
          Restricted area. Unauthorized access attempts are logged.
        </div>
      </div>
    </form>
  )

  // Mobile layout — full screen animation + bottom sheet
  if (isMobile) return (
    <div style={{ minHeight:"100vh", background:"#0a0a0a", position:"relative", overflow:"hidden", fontFamily:"'DM Sans',sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@300;400;500&display=swap');
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes slideUp { from { transform:translateY(100%) } to { transform:translateY(0) } }
      `}</style>

      {/* Full screen animation background */}
      <NetworkCanvas />

      {/* Center content */}
      <div style={{ position:"relative", zIndex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", minHeight:"100vh", padding:"2rem" }}>
        <div style={{ textAlign:"center", marginBottom:"2rem" }}>
          <div style={{ fontFamily:"Syne", fontSize:28, fontWeight:800, color:"#f0ede6", marginBottom:6 }}>
            Car<span style={{ color:"#e6821e" }}>Care</span> Connect
          </div>
          <div style={{ fontSize:12, color:"#555", marginBottom:"1.5rem" }}>Admin Control Center</div>
          <div style={{ fontFamily:"Syne", fontSize:36, fontWeight:800, color:"#8b5cf6", letterSpacing:2, marginBottom:4 }}>
            {time.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit",second:"2-digit"})}
          </div>
          <div style={{ fontSize:11, color:"#555" }}>
            {time.toLocaleDateString("default",{weekday:"long",day:"numeric",month:"long"})}
          </div>
        </div>

        <div style={{ display:"flex", flexDirection:"column", gap:10, width:"100%", maxWidth:300 }}>
          {[
            { icon:"🔐", text:"Two-factor authentication" },
            { icon:"🛡️", text:"Role-based access control" },
            { icon:"📊", text:"Full platform oversight" },
            { icon:"⚡", text:"Real-time monitoring" },
          ].map(f=>(
            <div key={f.text} style={{ display:"flex", alignItems:"center", gap:10 }}>
              <div style={{ width:32, height:32, borderRadius:8, background:"#160a2e", border:"1px solid #8b5cf630", display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, flexShrink:0 }}>{f.icon}</div>
              <div style={{ fontSize:12, color:"#555" }}>{f.text}</div>
            </div>
          ))}
        </div>

        {/* Sign in button */}
        <button onClick={()=>setSheetOpen(true)}
          style={{ marginTop:"2.5rem", background:"#8b5cf6", border:"none", borderRadius:14, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:15, fontWeight:700, padding:"14px 40px", cursor:"pointer", display:"flex", alignItems:"center", gap:10, boxShadow:"0 8px 30px rgba(139,92,246,0.4)" }}>
          🔐 Admin Sign In
        </button>
      </div>

      {/* Bottom sheet overlay */}
      {sheetOpen&&(
        <div style={{ position:"fixed", inset:0, zIndex:100, display:"flex", flexDirection:"column" }}
          onClick={e=>{ if(e.target===e.currentTarget) setSheetOpen(false) }}>
          <div style={{ flex:1, background:"rgba(0,0,0,0.6)" }} onClick={()=>setSheetOpen(false)}/>
          <div style={{ background:"#0f0f0f", borderRadius:"20px 20px 0 0", padding:"1.5rem", animation:"slideUp 0.3s ease", border:"1px solid #2a2a2a", borderBottom:"none" }}>
            {/* Handle */}
            <div style={{ width:40, height:4, background:"#333", borderRadius:2, margin:"0 auto 1.5rem" }}/>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:"1.5rem" }}>
              <div style={{ width:40, height:40, background:"#160a2e", borderRadius:10, display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, border:"1px solid #8b5cf630" }}>🔐</div>
              <div>
                <div style={{ fontFamily:"Syne", fontSize:16, fontWeight:800, color:"#f0ede6" }}>Admin Access</div>
                <div style={{ fontSize:11, color:"#555" }}>Restricted area</div>
              </div>
            </div>
            <LoginForm />
          </div>
        </div>
      )}
    </div>
  )

  // Desktop layout — unchanged
  return (
    <div style={{ minHeight:"100vh", background:"#0a0a0a", display:"flex", fontFamily:"'DM Sans',sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@300;400;500&display=swap');
        @keyframes fadeUp { from { opacity:0; transform:translateY(20px) } to { opacity:1; transform:translateY(0) } }
        @keyframes spin { to { transform: rotate(360deg) } }
        .admin-inp:focus { border-color: #8b5cf6 !important; }
      `}</style>

      <div style={{ flex:1, position:"relative", background:"#0f0f0f", borderRight:"1px solid #1e1e1e", display:"flex", flexDirection:"column", justifyContent:"space-between", padding:"3rem", overflow:"hidden" }}>
        <NetworkCanvas />
        <div style={{ position:"relative", zIndex:1 }}>
          <div style={{ fontFamily:"Syne", fontSize:22, fontWeight:800, color:"#f0ede6" }}>Car<span style={{ color:"#e6821e" }}>Care</span> Connect</div>
          <div style={{ fontSize:12, color:"#555", marginTop:4 }}>Admin Control Center</div>
        </div>
        <div style={{ position:"relative", zIndex:1 }}>
          <div style={{ fontFamily:"Syne", fontSize:40, fontWeight:800, color:"#8b5cf6", letterSpacing:2, marginBottom:4 }}>
            {time.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit",second:"2-digit"})}
          </div>
          <div style={{ fontSize:12, color:"#555" }}>
            {time.toLocaleDateString("default",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}
          </div>
        </div>
        <div style={{ position:"relative", zIndex:1 }}>
          {[
            { icon:"🔐", text:"Two-factor authentication supported" },
            { icon:"🛡️", text:"Role-based access control" },
            { icon:"📊", text:"Full platform oversight" },
            { icon:"⚡", text:"Real-time monitoring" },
          ].map(f=>(
            <div key={f.text} style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
              <div style={{ width:32, height:32, borderRadius:8, background:"#160a2e", border:"1px solid #8b5cf630", display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, flexShrink:0 }}>{f.icon}</div>
              <div style={{ fontSize:12, color:"#555" }}>{f.text}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ width:440, display:"flex", alignItems:"center", justifyContent:"center", padding:"2rem", animation:"fadeUp 0.5s ease forwards" }}>
        <div style={{ width:"100%" }}>
          <div style={{ marginBottom:"2.5rem" }}>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:"1.5rem" }}>
              <div style={{ width:44, height:44, background:"#160a2e", borderRadius:12, display:"flex", alignItems:"center", justifyContent:"center", fontSize:22, border:"1px solid #8b5cf630" }}>🔐</div>
              <div>
                <div style={{ fontFamily:"Syne", fontSize:18, fontWeight:800, color:"#f0ede6" }}>Admin Access</div>
                <div style={{ fontSize:11, color:"#555" }}>Restricted area</div>
              </div>
            </div>
            <div style={{ height:1, background:"linear-gradient(90deg,#8b5cf640,transparent)" }}/>
          </div>
          <LoginForm />
        </div>
      </div>
    </div>
  )
}
