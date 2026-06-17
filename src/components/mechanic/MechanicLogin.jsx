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
    if (!pin.trim()) return toast.error("Enter your PIN")
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
    <div style={{ minHeight:"100vh", background:"linear-gradient(135deg,#1d9e75,#0d7a5a)", display:"flex", alignItems:"center", justifyContent:"center", padding:"1rem" }}>
      <div style={{ background:"#ffffff", borderRadius:20, padding:"2rem", width:"100%", maxWidth:380, boxShadow:"0 20px 60px rgba(0,0,0,0.2)" }}>
        <div style={{ textAlign:"center", marginBottom:"2rem" }}>
          <div style={{ fontSize:48, marginBottom:8 }}>👨‍🔧</div>
          <div style={{ fontFamily:"Syne", fontSize:24, fontWeight:800, color:"#000" }}>Mechanic Portal</div>
          <div style={{ fontSize:13, color:"#888", marginTop:4 }}>Car Care Connect</div>
        </div>
        <form onSubmit={handleLogin}>
          <div style={{ marginBottom:16 }}>
            <label style={{ fontSize:12, color:"#555", fontWeight:600, display:"block", marginBottom:6 }}>Phone Number</label>
            <input type="tel" value={phone} onChange={e=>setPhone(e.target.value)}
              placeholder="e.g. 0712345678"
              style={{ width:"100%", background:"#f8f8f8", border:"1px solid #eeeeee", borderRadius:10, padding:"12px 14px", fontSize:14, color:"#000", outline:"none", boxSizing:"border-box" }}/>
          </div>
          <div style={{ marginBottom:24 }}>
            <label style={{ fontSize:12, color:"#555", fontWeight:600, display:"block", marginBottom:6 }}>PIN</label>
            <div style={{ position:"relative" }}>
              <input type={showPin?"text":"password"} value={pin}
                onChange={e=>setPin(e.target.value.replace(/\D/g,"").slice(0,6))}
                placeholder="Enter your PIN" maxLength={6}
                style={{ width:"100%", background:"#f8f8f8", border:"1px solid #eeeeee", borderRadius:10, padding:"12px 44px 12px 14px", fontSize:18, letterSpacing:8, color:"#000", outline:"none", boxSizing:"border-box" }}/>
              <button type="button" onClick={()=>setShowPin(!showPin)}
                style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", color:"#888", cursor:"pointer", fontSize:16 }}>
                {showPin?"Hide":"Show"}
              </button>
            </div>
          </div>
          <button type="submit" disabled={loading}
            style={{ width:"100%", background:loading?"#555":"#1d9e75", border:"none", borderRadius:12, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:15, fontWeight:700, padding:"14px", cursor:loading?"not-allowed":"pointer" }}>
            {loading?"Verifying...":"Sign In"}
          </button>
        </form>
        <div style={{ textAlign:"center", marginTop:"1.5rem", fontSize:12, color:"#888" }}>
          Don't have a PIN? Ask your garage manager to set one for you.
        </div>
        <div style={{ textAlign:"center", marginTop:16 }}>
          <a href="/" style={{ fontSize:12, color:"#1d9e75", textDecoration:"none" }}>Back to main app</a>
        </div>
      </div>
    </div>
  )
}
