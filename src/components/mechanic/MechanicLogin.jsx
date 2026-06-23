import { useState } from "react"
import { useMechanicAuth } from "../../contexts/MechanicAuthContext"
import { useNavigate } from "react-router-dom"
import toast from "react-hot-toast"

export default function MechanicLogin() {
  const { loginMechanic } = useMechanicAuth()
  const navigate = useNavigate()
  const [phone, setPhone] = useState("")
  const [pin, setPin] = useState("")
  const [loading, setLoading] = useState(false)
  const [showPin, setShowPin] = useState(false)

  async function handleLogin(e) {
    e.preventDefault()
    if (!phone.trim()) return toast.error("Enter your phone number")
    if (pin.length < 4) return toast.error("PIN must be at least 4 digits")
    setLoading(true)
    try {
      await loginMechanic(phone.trim(), pin.trim())
      toast.success("Welcome back!")
      navigate("/mechanic-dashboard")
    } catch(err) {
      toast.error(err.message || "Invalid phone or PIN")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight:"100vh", background:"linear-gradient(160deg,#0d7a5a 0%,#1d9e75 40%,#f0fdf4 100%)", display:"flex", alignItems:"center", justifyContent:"center", padding:"1rem", fontFamily:"DM Sans,sans-serif" }}>
      <div style={{ width:"100%", maxWidth:380 }}>

        {/* Logo area */}
        <div style={{ textAlign:"center", marginBottom:"2rem" }}>
          <div style={{ width:72, height:72, borderRadius:"50%", background:"rgba(255,255,255,0.2)", border:"2px solid rgba(255,255,255,0.4)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:36, margin:"0 auto 12px" }}>
            👨‍🔧
          </div>
          <div style={{ fontFamily:"Syne", fontSize:22, fontWeight:800, color:"#fff", marginBottom:4 }}>Mechanic Portal</div>
          <div style={{ fontSize:13, color:"rgba(255,255,255,0.75)" }}>Car Care Connect · Nairobi</div>
        </div>

        {/* Login card */}
        <div style={{ background:"#ffffff", borderRadius:20, padding:"1.75rem", boxShadow:"0 20px 60px rgba(0,0,0,0.15)" }}>
          <div style={{ fontFamily:"Syne", fontSize:18, fontWeight:800, color:"#000", marginBottom:4 }}>Sign in</div>
          <div style={{ fontSize:12, color:"#888", marginBottom:"1.5rem" }}>Enter your phone number and PIN to access your jobs</div>

          <form onSubmit={handleLogin}>
            {/* Phone */}
            <div style={{ marginBottom:16 }}>
              <label style={{ fontSize:11, color:"#555", fontWeight:700, display:"block", marginBottom:6, textTransform:"uppercase", letterSpacing:"0.05em" }}>Phone Number</label>
              <div style={{ position:"relative" }}>
                <span style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)", fontSize:16 }}>📱</span>
                <input
                  type="tel"
                  value={phone}
                  onChange={e=>setPhone(e.target.value)}
                  placeholder="0712 345 678"
                  style={{ width:"100%", background:"#f8f8f8", border:"1px solid #eeeeee", borderRadius:10, padding:"12px 12px 12px 40px", fontSize:14, color:"#000", outline:"none", boxSizing:"border-box", transition:"border 0.2s" }}
                  onFocus={e=>e.target.style.borderColor="#1d9e75"}
                  onBlur={e=>e.target.style.borderColor="#eeeeee"}
                />
              </div>
            </div>

            {/* PIN */}
            <div style={{ marginBottom:24 }}>
              <label style={{ fontSize:11, color:"#555", fontWeight:700, display:"block", marginBottom:6, textTransform:"uppercase", letterSpacing:"0.05em" }}>PIN</label>
              <div style={{ position:"relative" }}>
                <span style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)", fontSize:16 }}>🔑</span>
                <input
                  type={showPin?"text":"password"}
                  value={pin}
                  onChange={e=>setPin(e.target.value.replace(/D/g,"").slice(0,6))}
                  placeholder="• • • •"
                  maxLength={6}
                  style={{ width:"100%", background:"#f8f8f8", border:"1px solid #eeeeee", borderRadius:10, padding:"12px 44px 12px 40px", fontSize:22, letterSpacing:10, color:"#000", outline:"none", boxSizing:"border-box", transition:"border 0.2s" }}
                  onFocus={e=>e.target.style.borderColor="#1d9e75"}
                  onBlur={e=>e.target.style.borderColor="#eeeeee"}
                />
                <button type="button" onClick={()=>setShowPin(!showPin)}
                  style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", color:"#888", cursor:"pointer", fontSize:14 }}>
                  {showPin?"Hide":"Show"}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading||!phone.trim()||pin.length<4}
              style={{ width:"100%", background:loading||!phone.trim()||pin.length<4?"#ccc":"#1d9e75", border:"none", borderRadius:12, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:15, fontWeight:800, padding:"15px", cursor:loading||!phone.trim()||pin.length<4?"not-allowed":"pointer", transition:"all 0.2s", boxShadow:loading?"none":"0 4px 16px #1d9e7540" }}>
              {loading?"⏳ Verifying...":"🔓 Sign In to Portal"}
            </button>
          </form>

          <div style={{ marginTop:"1.5rem", padding:"1rem", background:"#f0fdf4", borderRadius:10, fontSize:11, color:"#555", lineHeight:1.7 }}>
            <div style={{ fontWeight:700, color:"#1d9e75", marginBottom:4 }}>Don&apos;t have a PIN?</div>
            Ask your garage manager to set a PIN for you in the Provider Dashboard under Mechanics.
          </div>
        </div>

        <div style={{ textAlign:"center", marginTop:"1.5rem" }}>
          <a href="/auth" style={{ fontSize:12, color:"rgba(255,255,255,0.75)", textDecoration:"none" }}>← Back to main app</a>
        </div>
      </div>
    </div>
  )
}
