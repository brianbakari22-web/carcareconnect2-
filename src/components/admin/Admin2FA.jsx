import { useEffect, useState } from "react"
import { useTheme } from "../../contexts/ThemeContext"
import { supabase } from "../../lib/supabase"
import { useAuth } from "../../contexts/AuthContext"
import toast from "react-hot-toast"
import * as OTPAuth from "otpauth"
import QRCode from "qrcode"

export default function Admin2FA() {
  const { user, profile } = useAuth()
  const { theme } = useTheme()
  const [status, setStatus] = useState(null)
  const [step, setStep] = useState("loading")
  const [secret, setSecret] = useState("")
  const [qrUrl, setQrUrl] = useState("")
  const [code, setCode] = useState("")
  const [backupCodes, setBackupCodes] = useState([])
  const [verifying, setVerifying] = useState(false)
  const [disableCode, setDisableCode] = useState("")
  const [disabling, setDisabling] = useState(false)
  const [showBackup, setShowBackup] = useState(false)

  useEffect(() => { if (user) load() }, [user])

  async function load() {
    const { data } = await supabase.from("admin_2fa").select("*").eq("user_id", user.id).maybeSingle()
    setStatus(data||null)
    setStep(data?.is_enabled ? "enabled" : "setup")
  }

  async function generateSecret() {
    const totp = new OTPAuth.TOTP({
      issuer: "CarCareConnect",
      label: profile?.email || user.email || "Admin",
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      secret: new OTPAuth.Secret()
    })
    const secretStr = totp.secret.base32
    setSecret(secretStr)
    const uri = totp.toString()
    const qr = await QRCode.toDataURL(uri)
    setQrUrl(qr)
    setStep("scan")
  }

  function generateBackupCodes() {
    const codes = []
    for (let i = 0; i < 8; i++) {
      const code = Math.random().toString(36).substring(2,6).toUpperCase() + "-" + Math.random().toString(36).substring(2,6).toUpperCase()
      codes.push(code)
    }
    return codes
  }

  function verifyCode(inputCode, secretStr) {
    try {
      const totp = new OTPAuth.TOTP({
        issuer: "CarCareConnect",
        label: "Admin",
        algorithm: "SHA1",
        digits: 6,
        period: 30,
        secret: OTPAuth.Secret.fromBase32(secretStr)
      })
      const delta = totp.validate({ token: inputCode, window: 1 })
      return delta !== null
    } catch { return false }
  }

  async function enable2FA(e) {
    e.preventDefault()
    if (code.length !== 6) return toast.error("Enter a 6-digit code")
    setVerifying(true)
    try {
      const valid = verifyCode(code, secret)
      if (!valid) { toast.error("Invalid code — check your authenticator app"); setVerifying(false); return }
      const backup = generateBackupCodes()
      const { error } = await supabase.from("admin_2fa").upsert({
        user_id: user.id,
        secret,
        is_enabled: true,
        backup_codes: backup,
        updated_at: new Date().toISOString()
      }, { onConflict:"user_id" })
      if (error) throw error
      setBackupCodes(backup)
      setStep("backup")
      toast.success("2FA enabled successfully!")
    } catch(err) { toast.error(err.message) }
    finally { setVerifying(false) }
  }

  async function disable2FA(e) {
    e.preventDefault()
    if (!status?.secret) return
    setDisabling(true)
    try {
      const valid = verifyCode(disableCode, status.secret) ||
        status.backup_codes?.includes(disableCode.toUpperCase())
      if (!valid) { toast.error("Invalid code"); setDisabling(false); return }
      const { error } = await supabase.from("admin_2fa").update({
        is_enabled: false,
        secret: "",
        backup_codes: [],
        updated_at: new Date().toISOString()
      }).eq("user_id", user.id)
      if (error) throw error
      toast.success("2FA disabled")
      setDisableCode("")
      load()
    } catch(err) { toast.error(err.message) }
    finally { setDisabling(false) }
  }

  const inp = { width:"100%", background:"#ffffff", border:`1px solid ${"#eeeeee"Light}`, borderRadius:8, padding:"12px 14px", color:"#000000", fontSize:14, outline:"none", fontFamily:"'DM Sans',sans-serif", letterSpacing:4, textAlign:"center", marginBottom:12 }

  if (step==="loading") return <div style={{ color:"#000000"Faint, fontSize:13 }}>Loading...</div>

  return (
    <div style={{ maxWidth:480 }}>
      <div style={{ marginBottom:"1.5rem" }}>
        <div style={{ fontFamily:"Syne", fontSize:20, fontWeight:800, color:"#000000" }}>Two-Factor Authentication</div>
        <div style={{ fontSize:12, color:"#000000"Faint, marginTop:4 }}>Add an extra layer of security to your admin account</div>
      </div>

      <div style={{ background:"#ffffff"Card, border:`1px solid ${status?.is_enabled?"#1d9e7540":"#eeeeee"}`, borderRadius:12, padding:"1.25rem", marginBottom:"1.5rem", display:"flex", alignItems:"center", gap:12 }}>
        <div style={{ width:44, height:44, borderRadius:10, background:status?.is_enabled?"#f0fdf4":"#f5f5f5", display:"flex", alignItems:"center", justifyContent:"center", fontSize:22, flexShrink:0 }}>
          {status?.is_enabled?"🔒":"🔓"}
        </div>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:14, fontWeight:600, color:status?.is_enabled?"#1d9e75":"#000000" }}>
            2FA is {status?.is_enabled?"enabled":"disabled"}
          </div>
          <div style={{ fontSize:11, color:"#000000"Faint, marginTop:2 }}>
            {status?.is_enabled
              ? "Your account is protected with an authenticator app"
              : "Enable 2FA to secure your admin account"}
          </div>
        </div>
        {status?.is_enabled&&(
          <span style={{ fontSize:10, padding:"3px 10px", borderRadius:20, background:"#f0fdf4", color:"#1d9e75", border:"1px solid #1d9e7540" }}>Active</span>
        )}
      </div>

      {step==="setup"&&(
        <div style={{ background:"#ffffff"Card, border:`1px solid ${"#eeeeee"}`, borderRadius:12, padding:"1.25rem" }}>
          <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:700, marginBottom:8, color:"#000000" }}>Setup authenticator</div>
          <div style={{ fontSize:12, color:"#000000"Muted, marginBottom:"1.5rem", lineHeight:1.6 }}>
            Use an authenticator app like <strong style={{ color:"#000000" }}>Google Authenticator</strong> or <strong style={{ color:"#000000" }}>Authy</strong> to generate time-based codes for login verification.
          </div>
          {[
            { step:"1", text:"Download Google Authenticator or Authy on your phone" },
            { step:"2", text:"Click the button below to generate your QR code" },
            { step:"3", text:"Scan the QR code with your authenticator app" },
            { step:"4", text:"Enter the 6-digit code to verify and enable 2FA" },
          ].map(s=>(
            <div key={s.step} style={{ display:"flex", gap:12, marginBottom:10 }}>
              <div style={{ width:28, height:28, borderRadius:"50%", background:"#fff8f0", border:"1px solid #e6821e30", display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:700, color:"#e6821e", flexShrink:0 }}>{s.step}</div>
              <div style={{ fontSize:13, color:"#888", paddingTop:5, lineHeight:1.5 }}>{s.text}</div>
            </div>
          ))}
          <button onClick={generateSecret}
            style={{ width:"100%", marginTop:8, background:"#8b5cf6", border:"none", borderRadius:9, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:14, fontWeight:700, padding:"13px", cursor:"pointer" }}>
            Generate QR code
          </button>
        </div>
      )}

      {step==="scan"&&(
        <div>
          <div style={{ background:"#ffffff"Card, border:`1px solid ${"#eeeeee"}`, borderRadius:12, padding:"1.25rem", marginBottom:"1rem" }}>
            <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:700, marginBottom:"1rem", color:"#000000" }}>Scan QR code</div>
            <div style={{ display:"flex", justifyContent:"center", marginBottom:"1rem" }}>
              {qrUrl&&<img src={qrUrl} alt="QR Code" style={{ width:180, height:180, borderRadius:10, border:"4px solid #fff" }}/>}
            </div>
            <div style={{ fontSize:11, color:"#000000"Faint, textAlign:"center", marginBottom:"1rem" }}>
              Can't scan? Enter this code manually:
            </div>
            <div style={{ background:"#ffffff", border:`1px solid ${"#eeeeee"Light}`, borderRadius:8, padding:"0.75rem", fontFamily:"monospace", fontSize:13, color:"#e6821e", letterSpacing:3, textAlign:"center", wordBreak:"break-all", marginBottom:"1rem" }}>
              {secret}
            </div>
          </div>

          <div style={{ background:"#ffffff"Card, border:`1px solid ${"#eeeeee"}`, borderRadius:12, padding:"1.25rem" }}>
            <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:700, marginBottom:4, color:"#000000" }}>Verify code</div>
            <div style={{ fontSize:12, color:"#000000"Muted, marginBottom:"1rem" }}>Enter the 6-digit code from your authenticator app</div>
            <form onSubmit={enable2FA}>
              <input
                style={inp}
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                value={code}
                onChange={e=>setCode(e.target.value.replace(/\D/g,""))}
                autoComplete="one-time-code"
              />
              <div style={{ display:"flex", gap:8 }}>
                <button type="submit" disabled={verifying||code.length!==6}
                  style={{ flex:1, background:code.length===6?"#8b5cf6":"#e0e0e0", border:"none", borderRadius:9, color:code.length===6?"#fff":"#666", fontFamily:"Syne,sans-serif", fontSize:13, fontWeight:700, padding:"12px", cursor:code.length===6?"pointer":"not-allowed" }}>
                  {verifying?"Verifying...":"Enable 2FA"}
                </button>
                <button type="button" onClick={()=>setStep("setup")}
                  style={{ background:"none", border:"1px solid #dddddd", borderRadius:9, color:"#888", fontSize:13, padding:"12px 18px", cursor:"pointer" }}>
                  Back
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {step==="backup"&&(
        <div style={{ background:"#ffffff"Card, border:"1px solid #1d9e7540", borderRadius:12, padding:"1.25rem" }}>
          <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:700, marginBottom:4, color:"#1d9e75" }}>✓ 2FA enabled!</div>
          <div style={{ fontSize:12, color:"#000000"Muted, marginBottom:"1.25rem", lineHeight:1.6 }}>
            Save these backup codes in a safe place. Each can be used once to access your account if you lose your authenticator.
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6, marginBottom:"1.25rem" }}>
            {backupCodes.map((code,i)=>(
              <div key={i} style={{ background:"#ffffff", border:`1px solid ${"#eeeeee"Light}`, borderRadius:7, padding:"8px 12px", fontFamily:"monospace", fontSize:13, color:"#000000", textAlign:"center", letterSpacing:2 }}>
                {code}
              </div>
            ))}
          </div>
          <button onClick={()=>{ navigator.clipboard.writeText(backupCodes.join("\n")); toast.success("Backup codes copied!") }}
            style={{ width:"100%", background:"#eff6ff", border:"1px solid #378add40", borderRadius:9, color:"#378add", fontFamily:"Syne,sans-serif", fontSize:13, fontWeight:700, padding:"11px", cursor:"pointer", marginBottom:8 }}>
            Copy backup codes
          </button>
          <button onClick={()=>{ setStep("enabled"); load() }}
            style={{ width:"100%", background:"#8b5cf6", border:"none", borderRadius:9, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:13, fontWeight:700, padding:"11px", cursor:"pointer" }}>
            Done — I've saved my backup codes
          </button>
        </div>
      )}

      {step==="enabled"&&(
        <div>
          <div style={{ background:"#ffffff"Card, border:`1px solid ${"#eeeeee"}`, borderRadius:12, padding:"1.25rem", marginBottom:"1rem" }}>
            <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:700, marginBottom:"1rem", color:"#000000" }}>Backup codes</div>
            <div style={{ fontSize:12, color:"#000000"Muted, marginBottom:10 }}>
              You have {status?.backup_codes?.length||0} backup codes remaining.
            </div>
            <button onClick={()=>setShowBackup(s=>!s)}
              style={{ background:"#ffffff"Card, border:"1px solid #dddddd", borderRadius:8, color:"#888", fontSize:12, padding:"8px 14px", cursor:"pointer" }}>
              {showBackup?"Hide":"View"} backup codes
            </button>
            {showBackup&&(
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6, marginTop:10 }}>
                {(status?.backup_codes||[]).map((code,i)=>(
                  <div key={i} style={{ background:"#ffffff", border:`1px solid ${"#eeeeee"Light}`, borderRadius:7, padding:"8px 12px", fontFamily:"monospace", fontSize:13, color:"#000000", textAlign:"center", letterSpacing:2 }}>
                    {code}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ background:"#ffffff"Card, border:"1px solid #e24b4a20", borderRadius:12, padding:"1.25rem" }}>
            <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:700, marginBottom:4, color:"#e24b4a" }}>Disable 2FA</div>
            <div style={{ fontSize:12, color:"#000000"Muted, marginBottom:"1rem" }}>
              Enter your current authenticator code or a backup code to disable 2FA.
            </div>
            <form onSubmit={disable2FA}>
              <input
                style={{ ...inp, letterSpacing:2 }}
                type="text"
                placeholder="000000 or XXXX-XXXX"
                value={disableCode}
                onChange={e=>setDisableCode(e.target.value)}
              />
              <button type="submit" disabled={disabling||!disableCode}
                style={{ width:"100%", background:disableCode?"#fff5f5":"#f5f5f5", border:`1px solid ${disableCode?"#e24b4a40":"#e0e0e0"}`, borderRadius:9, color:disableCode?"#e24b4a":"#555", fontFamily:"Syne,sans-serif", fontSize:13, fontWeight:700, padding:"12px", cursor:disableCode?"pointer":"not-allowed" }}>
                {disabling?"Disabling...":"Disable 2FA"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}


