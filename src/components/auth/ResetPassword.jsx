import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"
import { useNavigate } from "react-router-dom"
import toast from "react-hot-toast"

export default function ResetPassword() {
  const navigate = useNavigate()
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) navigate("/auth")
    })
  }, [])

  async function handleReset(e) {
    e.preventDefault()
    if (password.length < 6) return toast.error("Password must be at least 6 characters")
    if (password !== confirm) return toast.error("Passwords do not match")
    setLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      setDone(true)
      toast.success("Password updated!")
      setTimeout(() => navigate("/auth"), 3000)
    } catch(err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  const inp = { width:"100%", background:"#ffffff", border:"1px solid #e5e5e5", borderRadius:8, padding:"11px 12px", color:"#000000", fontSize:13, outline:"none", marginBottom:16 }

  return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"#ffffff", padding:"1rem" }}>
      <div style={{ width:"100%", maxWidth:400, background:"#ffffff", border:"1px solid #eeeeee", borderRadius:16, padding:"2rem" }}>
        <div style={{ textAlign:"center", marginBottom:"1.5rem" }}>
          <div style={{ fontSize:40, marginBottom:8 }}>🔐</div>
          <div style={{ fontFamily:"Syne", fontSize:22, fontWeight:800, color:"#000000", marginBottom:4 }}>
            {done ? "Password updated!" : "Set new password"}
          </div>
          <div style={{ fontSize:12, color:"#777777" }}>
            {done ? "Redirecting to sign in..." : "Choose a strong password"}
          </div>
        </div>

        {done ? (
          <div style={{ background:"#071a12", border:"1px solid #1d9e7540", borderRadius:10, padding:"1.25rem", textAlign:"center" }}>
            <div style={{ fontSize:13, color:"#1d9e75", fontWeight:600 }}>Password updated successfully</div>
          </div>
        ) : (
          <form onSubmit={handleReset}>
            <label style={{ fontSize:11, color:"#666", display:"block", marginBottom:4 }}>New password</label>
            <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Min 6 characters" required style={inp}/>
            <label style={{ fontSize:11, color:"#666", display:"block", marginBottom:4 }}>Confirm password</label>
            <input type="password" value={confirm} onChange={e=>setConfirm(e.target.value)} placeholder="Repeat password" required style={inp}/>
            <button type="submit" disabled={loading}
              style={{ width:"100%", background:loading?"#333":"#e6821e", border:"none", borderRadius:10, color:loading?"#555":"#fff", fontFamily:"Syne,sans-serif", fontSize:14, fontWeight:700, padding:"13px", cursor:loading?"not-allowed":"pointer", marginBottom:12 }}>
              {loading ? "Updating..." : "Update password"}
            </button>
            <button type="button" onClick={()=>navigate("/auth")}
              style={{ width:"100%", background:"none", border:"1px solid #dddddd", borderRadius:10, color:"#666", fontSize:13, padding:"12px", cursor:"pointer" }}>
              Back to sign in
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

