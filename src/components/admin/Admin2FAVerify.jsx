import { useState } from "react"
import { supabase } from "../../lib/supabase"
import { useAuth } from "../../contexts/AuthContext"
import { useTheme } from "../../contexts/ThemeContext"
import * as OTPAuth from "otpauth"
import toast from "react-hot-toast"

export default function Admin2FAVerify({ onVerified }) {
  const { user } = useAuth()
  const { theme } = useTheme()
  const [code, setCode] = useState("")
  const [verifying, setVerifying] = useState(false)

  async function verify(e) {
    e.preventDefault()
    if (!code) return
    setVerifying(true)
    try {
      const { data } = await supabase.from("admin_2fa")
        .select("secret,backup_codes,is_enabled")
        .eq("user_id", user.id)
        .maybeSingle()

      if (!data?.is_enabled) { onVerified(); return }

      const totp = new OTPAuth.TOTP({
        issuer: "CarCareConnect",
        label: "Admin",
        algorithm: "SHA1",
        digits: 6,
        period: 30,
        secret: OTPAuth.Secret.fromBase32(data.secret)
      })

      const delta = totp.validate({ token: code, window: 1 })
      const isBackup = data.backup_codes?.includes(code.toUpperCase())

      if (delta !== null || isBackup) {
        if (isBackup) {
          const newCodes = data.backup_codes.filter(c=>c!==code.toUpperCase())
          await supabase.from("admin_2fa").update({ backup_codes:newCodes }).eq("user_id", user.id)
        }
        onVerified()
      } else {
        toast.error("Invalid code — try again")
        setCode("")
      }
    } catch(err) {
      toast.error(err.message)
    } finally {
      setVerifying(false)
    }
  }

  return (
    <div style={{ minHeight:"100vh", background:theme.bg, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'DM Sans',sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@300;400;500&display=swap');`}</style>
      <div style={{ width:"100%", maxWidth:380, padding:"0 1rem" }}>
        <div style={{ textAlign:"center", marginBottom:"2rem" }}>
          <div style={{ width:60, height:60, background:theme.primaryBg, borderRadius:14, display:"flex", alignItems:"center", justifyContent:"center", fontSize:28, margin:"0 auto 1rem", border:`1px solid ${theme.primaryBorder}` }}>🔐</div>
          <div style={{ fontFamily:"Syne", fontSize:22, fontWeight:800, color:theme.text, marginBottom:4 }}>Two-Factor Auth</div>
          <div style={{ fontSize:13, color:theme.textFaint }}>Enter the 6-digit code from your authenticator app</div>
        </div>

        <form onSubmit={verify}>
          <input
            type="text"
            inputMode="numeric"
            maxLength={8}
            placeholder="000000"
            value={code}
            onChange={e=>setCode(e.target.value.replace(/[^0-9A-Z-]/gi,""))}
            autoComplete="one-time-code"
            autoFocus
            style={{ width:"100%", background:theme.bgCard, border:`1px solid ${theme.borderLight}`, borderRadius:10, padding:"16px", color:theme.text, fontSize:24, outline:"none", fontFamily:"monospace", letterSpacing:8, textAlign:"center", marginBottom:12 }}
          />
          <button type="submit" disabled={verifying||!code}
            style={{ width:"100%", background:code?"#8b5cf6":"#e0e0e0", border:"none", borderRadius:10, color:code?"#fff":"#666", fontFamily:"Syne,sans-serif", fontSize:15, fontWeight:700, padding:"14px", cursor:code?"pointer":"not-allowed", transition:"all 0.12s" }}>
            {verifying?"Verifying...":"Verify"}
          </button>
        </form>

        <div style={{ textAlign:"center", marginTop:"1.5rem", fontSize:12, color:theme.textVeryFaint }}>
          Lost your device? Use a backup code instead.
        </div>
      </div>
    </div>
  )
}
