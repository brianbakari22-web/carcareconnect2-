import useIsMobile from "../../lib/useIsMobile"
import { useState, useEffect } from "react"
import { Capacitor } from "@capacitor/core"

import { ServicesIcon, PartsIcon, MarketplaceIcon, VehicleIcon, PowerIcon, DiscoverIcon, MechanicIcon, GlobeIcon, DeliveryIcon, TripReportIcon, AnalyticsIcon, MotorcycleIcon, TukTukIcon, DriversIcon, ShieldIcon, LockedIcon, PaymentsIcon } from "../../lib/cccIcons"
import { supabase } from "../../lib/supabase"
import { sanitizeName, sanitizeEmail, sanitizePhone, sanitizeFreeText } from "../../lib/sanitize"
import { applyRateLimit, RATE_LIMITS } from "../../lib/rateLimit"
import { useAuth } from "../../contexts/AuthContext"
import { validatePassword } from "../../lib/passwordValidation"
import { useNavigate, useSearchParams } from "react-router-dom"
import toast from "react-hot-toast"

const PROVIDER_TYPES = [
  { key:"garage", label:"Garage/Mechanic", icon:"services", desc:"Car service and repair" },
  { key:"parts_dealer", label:"Parts Dealer", icon:"parts", desc:"Auto parts and spares" },
  { key:"accessories_shop", label:"Accessories Shop", icon:"marketplace", desc:"Car accessories" },
  { key:"tyre_shop", label:"Tyre Shop", icon:"vehicle", desc:"Tyre sales and fitting" },
  { key:"auto_electrician", label:"Auto Electrician", icon:"power", desc:"Electrical specialist" },
  { key:"car_wash", label:"Car Wash", icon:"discover", desc:"Wash and detailing" },
  { key:"panel_beater", label:"Panel Beater", icon:"mechanic", desc:"Body and spray paint" },
  { key:"auto_glass", label:"Auto Glass", icon:"globe", desc:"Windscreen specialist" },
]
const DRIVER_VEHICLE_TYPES = [
  { key:"car", label:"My Car", icon:"vehicle", desc:"Standard delivery", category:"marketplace" },
  { key:"motorcycle", label:"My Bodaboda", icon:"motorcycle", desc:"Fast parts delivery", category:"marketplace" },
  { key:"tuktuk", label:"My Tuktuk", icon:"tuktuk", desc:"Local delivery", category:"marketplace" },
  { key:"van", label:"My Van/Pickup", icon:"delivery", desc:"Large items", category:"marketplace" },
  { key:"none", label:"Concierge Driver", icon:"driver", desc:"No vehicle — pick up & chauffeur customer cars", category:"concierge" },
]
const ROLES = [
  {
    key: "customer",
    label: "Customer",
    icon: "vehicle",
    desc: "Book services, track drivers, earn loyalty points",
    color: "#e6821e",
    bg: "#fff8f0",
    border: "#e6821e40",
    features: ["🔧 Browse verified services", "📍 Live driver tracking", "🎁 Loyalty rewards", "⭐ Rate your experience"]
  },
  {
    key: "provider",
    label: "Service Provider",
    icon: "services",
    desc: "List services, manage bookings, grow your business",
    color: "#378add",
    bg: "#eff6ff",
    border: "#378add40",
    features: ["📊 Analytics dashboard", "💰 Fast payouts", "📅 Booking management", "⭐ Customer reviews"]
  },
  {
    key: "driver",
    label: "Driver",
    icon: "delivery",
    desc: "Earn by delivering vehicles, set your own schedule",
    color: "#1d9e75",
    bg: "#f0fdf4",
    border: "#1d9e7540",
    features: ["📍 GPS navigation", "💵 Competitive earnings", "📈 Earnings dashboard", "✅ Flexible hours"]
  },
  {
    key: "mechanic",
    label: "Mechanic",
    icon: "mechanic",
    desc: "View assigned jobs, navigate to customers, share location",
    color: "#1d9e75",
    bg: "#f0fdf4",
    border: "#1d9e7540",
    features: ["🔧 View assigned jobs", "🗺️ Navigate to customer", "📍 Share live location", "📸 Upload job photos"],
    isSpecial: true,
    specialUrl: "/mechanic-login",
    specialLabel: "Go to Mechanic Login"
  },
]

const STATS = [
  { value: "Fast", label: "Same-day booking" },
  { value: "Verified", label: "All providers checked" },
  { value: "Live", label: "Real-time tracking" },
  { value: "Secure", label: "Safe payments" },
]

export default function AuthPage() {
  const isMobile = useIsMobile()

  const { signIn, signUp, profile, user } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const redirectTo = searchParams.get("redirect") || "/dashboard"
  const [step, setStep] = useState("landing")
  const [selectedRole, setSelectedRole] = useState(null)
  const [mode, setMode] = useState("signin")
  const [resetSent, setResetSent] = useState(false)
  const [form, setForm] = useState({ email:"", password:"", firstName:"", lastName:"", phone:"", businessName:"", providerType:"garage", driverVehicleType:"car" })
  const [loading, setLoading] = useState(false)
  const [logoUrl, setLogoUrl] = useState(localStorage.getItem("ccc_logo_url")||"/logo_c.svg")

  useEffect(() => {
    supabase.from("platform_settings").select("value").eq("key","logo_url").single()
      .then(({ data }) => {
        if (data?.value) {
          setLogoUrl(data.value)
          localStorage.setItem("ccc_logo_url", data.value)
        }
      })
  }, [])
  const [refCode, setRefCode] = useState("")
  const [agreed, setAgreed] = useState(false)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    setTimeout(() => setVisible(true), 100)
    const params = new URLSearchParams(window.location.search)
    const ref = params.get("ref")
    if (ref) setRefCode(ref.toUpperCase())
  }, [])

  async function signInWithGoogle() {
    const { Capacitor } = await import("@capacitor/core")
    if (Capacitor.isNativePlatform()) {
      const { Browser } = await import("@capacitor/browser")
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: "care.carcareconnect.app://auth-callback", skipBrowserRedirect: true }
      })
      if (error) return toast.error(error.message)
      if (data?.url) await Browser.open({ url: data.url })
    } else {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/dashboard` }
      })
      if (error) toast.error(error.message)
    }
  }
  async function handleAuth(e) {
    e.preventDefault()
    if (mode === "signup" && !agreed) return toast.error("Please agree to the Terms and Privacy Policy")
    if (mode === "signup") { const pwError = validatePassword(form.password); if (pwError) return toast.error(pwError) }
    setLoading(true)
    try {
      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(form.email, {
          redirectTo: window.location.origin + "/reset-password"
        })
        if (error) throw error
        setResetSent(true)
        return
      }
      if (mode === "signin") {
        const { data, error } = await supabase.auth.signInWithPassword({ email: form.email, password: form.password })
        if (error) throw error
        // Navigate after successful signin
        setLoading(false)
        toast.success("Signed in successfully!")
        const { data: prof } = await supabase.from("profiles").select("role").eq("id", data.user.id).maybeSingle()
        if (prof?.role === "admin") {
          window.location.href = "/ccc-admin-x7k9m2p4q8"
        } else {
          window.location.href = "/dashboard"
        }
        return
      } else {
        await signUp({
          email: form.email,
          password: form.password,
          firstName: form.firstName,
          lastName: form.lastName,
          phone: form.phone,
          role: selectedRole,
          businessName: form.businessName,
          providerType: form.providerType,
          driverVehicleType: form.driverVehicleType,
        }, refCode)



                // Always show verify email screen after signup
        setStep("verify_email")
        return
        let tries = 0
        const checkProfile = async () => {
          const { data: { user: u } } = await supabase.auth.getUser()
          if (!u) return setTimeout(checkProfile, 300)
          const { data: prof } = await supabase.from("profiles").select("role").eq("id", u.id).single()
          if (prof?.role) {
            navigate(redirectTo)
          } else if (tries++ < 15) {
            setTimeout(checkProfile, 300)
          } else {
            navigate(redirectTo)
          }
        }
        checkProfile()
      }
    } catch(err) {
      toast.error(err.message || "Something went wrong")
      // Log to error tracker
      if (window.__ccc_errors !== undefined) {
        window.__ccc_errors.unshift({ time:new Date().toLocaleTimeString(), msg:"Auth error: "+err.message, src:"AuthPage", line:0, col:0 })
      }
      console.error("AUTH ERROR:", err)
    } finally {
      setLoading(false)
    }
  }

  const inp = { width:"100%", background:"#f5f5f5", border:"1px solid #e0e0e0", borderRadius:9, padding:"12px 14px", color:"#000000", fontSize:15, outline:"none", fontFamily:"DM Sans,sans-serif", marginBottom:12 }
  const lbl = { fontSize:13, color:"#666666", textTransform:"uppercase", letterSpacing:"0.05em", display:"block", marginBottom:4 }
  const roleData = ROLES.find(r=>r.key===selectedRole)

  // Forgot password
  if (mode === "forgot") return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"#fff", padding:"1rem" }}>
      <div style={{ width:"100%", maxWidth:400, background:"#ffffff", border:"1px solid #eeeeee", borderRadius:16, padding:"2rem" }}>
        <div style={{ textAlign:"center", marginBottom:"1.5rem" }}>
          <div style={{ fontSize:36, marginBottom:8 }}>🔐</div>
          <div style={{ fontFamily:"Syne", fontSize:22, fontWeight:800, color:"#000000", marginBottom:4 }}>Reset password</div>
          <div style={{ fontSize:12, color:"#666" }}>Enter your email to receive a reset link</div>
        </div>
        {resetSent ? (
          <div>
            <div style={{ background:"#f0fdf4", border:"1px solid #1d9e7540", borderRadius:10, padding:"1.25rem", marginBottom:"1.5rem", textAlign:"center" }}>
              <div style={{ fontSize:32, marginBottom:8 }}>✉️</div>
              <div style={{ fontSize:13, color:"#1d9e75", fontWeight:600, marginBottom:4 }}>Reset link sent!</div>
              <div style={{ fontSize:12, color:"#555", lineHeight:1.6 }}>
                Check your email at <strong style={{ color:"#000" }}>{form.email}</strong>. Check spam if you dont see it.
              </div>
            </div>
            <button onClick={()=>{ setMode("signin"); setResetSent(false) }}
              style={{ width:"100%", background:"#e6821e", border:"none", borderRadius:10, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:16, fontWeight:700, padding:"15px", cursor:"pointer" }}>
              Back to sign in
            </button>
          </div>
        ) : (
          <form onSubmit={handleAuth}>
            <label style={{ fontSize:13, color:"#666666", display:"block", marginBottom:4 }}>Email address</label>
            <input type="email" required value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))}
              placeholder="your@email.com"
              style={{ width:"100%", background:"#f5f5f5", border:"1px solid #e0e0e0", borderRadius:8, padding:"11px 12px", color:"#000", fontSize:15, outline:"none", marginBottom:16 }}/>
            <button type="submit" disabled={loading}
              style={{ width:"100%", background:loading?"#ccc":"#e6821e", border:"none", borderRadius:10, color:loading?"#999":"#fff", fontFamily:"Syne,sans-serif", fontSize:16, fontWeight:700, padding:"15px", cursor:loading?"not-allowed":"pointer", marginBottom:12 }}>
              {loading ? "Sending..." : "Send reset link"}
            </button>
            <button type="button" onClick={()=>setMode("signin")}
              style={{ width:"100%", background:"none", border:"1px solid #ddd", borderRadius:10, color:"#555555", fontSize:13, padding:"12px", cursor:"pointer" }}>
              Back to sign in
            </button>
          </form>
        )}
      </div>
    </div>
  )

  // Email verification step
  if (step === "verify_email") return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", padding:"2rem", background:"#f8f8f8", fontFamily:"'DM Sans',sans-serif" }}>
      <div style={{ background:"#fff", borderRadius:16, padding:"2rem", maxWidth:400, width:"100%", textAlign:"center", boxShadow:"0 4px 24px rgba(0,0,0,0.08)" }}>
        <div style={{ fontSize:48, marginBottom:16 }}>📧</div>
        <div style={{ fontFamily:"Syne", fontSize:22, fontWeight:800, marginBottom:8, color:"#000" }}>Check your email</div>
        <div style={{ fontSize:14, color:"#666", lineHeight:1.6, marginBottom:24 }}>We sent a verification link to <strong>{form.email}</strong>. Click the link to activate your CCC account.</div>
        <div style={{ background:"#f0fdf4", border:"1px solid #1d9e7530", borderRadius:10, padding:"1rem", marginBottom:16, fontSize:13, color:"#1d9e75" }}>✅ Check spam folder if you don't see it in 2 minutes</div>
        <div style={{ background:"#eff6ff", border:"1px solid #378add30", borderRadius:10, padding:"1rem", marginBottom:20, fontSize:13, color:"#378add" }}>After verifying, come back and sign in.</div>
        <button onClick={()=>setStep("role")} style={{ background:"#e6821e", border:"none", borderRadius:8, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:13, fontWeight:700, padding:"10px 24px", cursor:"pointer" }}>← Back to login</button>
      </div>
    </div>
  )

  // Auth form
  if (step === "auth") return (
    <div style={{ minHeight:"100vh", background:"#fff", display:"flex", flexDirection:isMobile?"column":"row", fontFamily:"'DM Sans',sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@300;400;500&display=swap');`}</style>

      <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", padding:isMobile?"1rem":"2rem" }}>
        <div style={{ width:"100%", maxWidth:420 }}>
          <button onClick={()=>setStep("role")} style={{ background:"none", border:"none", color:"#555555", cursor:"pointer", fontSize:13, marginBottom:"1.5rem", fontFamily:"'DM Sans',sans-serif", padding:0 }}>
            ← Back
          </button>

          <div style={{ marginBottom:"1.5rem" }}>
            <div style={{ fontFamily:"Syne", fontSize:30, fontWeight:800, color:"#000000", marginBottom:4 }}>
              {mode==="signin" ? "Welcome back" : "Create account"}
            </div>
            <div style={{ fontSize:15, color:"#555555" }}>
              {mode==="signin" ? "Sign in to your Car Care Connect account" : `Joining as a ${roleData?.label}`}
            </div>
          </div>

          {roleData&&mode==="signup"&&(
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:"1.25rem", padding:"0.9rem 1rem", background:roleData.bg, border:`1px solid ${roleData.border}`, borderRadius:10 }}>
              <span style={{display:"flex",alignItems:"center"}}>
              {roleData.icon==="vehicle"?<VehicleIcon size={22} color={roleData.color}/>:
               roleData.icon==="services"?<ServicesIcon size={22} color={roleData.color}/>:
               roleData.icon==="delivery"?<DeliveryIcon size={22} color={roleData.color}/>:
               roleData.icon==="mechanic"?<MechanicIcon size={22} color={roleData.color}/>:
               <ServicesIcon size={22} color={roleData.color}/>}
            </span>
              <div>
                <div style={{ fontSize:15, fontWeight:600, color:roleData.color }}>{roleData.label}</div>
                <div style={{ fontSize:13, color:"#666666" }}>{roleData.desc}</div>
              </div>
            </div>
          )}

          <div style={{ display:"flex", gap:0, marginBottom:"1.5rem", background:"#f0f0f0", borderRadius:9, padding:3 }}>
            {[{k:"signin",l:"Sign in"},{k:"signup",l:"Create account"}].map(m=>(
              <button key={m.k} onClick={()=>{ setMode(m.k); setAgreed(false) }}
                style={{ flex:1, padding:"9px", borderRadius:7, border:"none", fontSize:13, cursor:"pointer", fontFamily:"'DM Sans',sans-serif", fontWeight:mode===m.k?600:400, background:mode===m.k?"#ffffff":"transparent", color:mode===m.k?"#000000":"#888", transition:"all 0.15s" }}>
                {m.l}
              </button>
            ))}
          </div>

          <form onSubmit={handleAuth}>
            {mode==="signin"&&(
              <button type="button" onClick={()=>{ setMode("forgot"); setResetSent(false) }}
                style={{ background:"none", border:"none", color:"#e6821e", fontSize:13, cursor:"pointer", padding:"0 0 12px", width:"100%", textAlign:"right", display:"block", fontFamily:"DM Sans,sans-serif" }}>
                Forgot password?
              </button>
            )}
            {mode==="signup"&&(
              <>
                <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:10 }}>
                  <div>
                    <label style={lbl}>First name</label>
                    <input style={inp} placeholder="John" value={form.firstName} onChange={e=>setForm(f=>({...f,firstName:e.target.value}))} required/>
                  </div>
                  <div>
                    <label style={lbl}>Last name</label>
                    <input style={inp} placeholder="Doe" value={form.lastName} onChange={e=>setForm(f=>({...f,lastName:e.target.value}))} required/>
                  </div>
                </div>
                {selectedRole==="provider"&&(
                  <>
                    <label style={lbl}>Business name</label>
                    <input style={inp} placeholder="e.g. Nairobi Auto Care" value={form.businessName} onChange={e=>setForm(f=>({...f,businessName:e.target.value}))}/>
                    <label style={lbl}>Business type</label>
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:10 }}>
                      {PROVIDER_TYPES.map(pt=>(
                        <div key={pt.key} onClick={()=>setForm(f=>({...f,providerType:pt.key}))}
                          style={{ background:form.providerType===pt.key?"#eff6ff":"#f5f5f5", border:"1px solid "+(form.providerType===pt.key?"#378add":"#e0e0e0"), borderRadius:8, padding:"8px 10px", cursor:"pointer" }}>
                          <div style={{ marginBottom:2, display:"flex" }}>
                          {pt.icon==="services"?<ServicesIcon size={18} color={form.providerType===pt.key?"#378add":"#64748B"}/>:
                           pt.icon==="parts"?<PartsIcon size={18} color={form.providerType===pt.key?"#378add":"#64748B"}/>:
                           pt.icon==="marketplace"?<MarketplaceIcon size={18} color={form.providerType===pt.key?"#378add":"#64748B"}/>:
                           pt.icon==="vehicle"?<VehicleIcon size={18} color={form.providerType===pt.key?"#378add":"#64748B"}/>:
                           pt.icon==="power"?<PowerIcon size={18} color={form.providerType===pt.key?"#378add":"#64748B"}/>:
                           pt.icon==="discover"?<DiscoverIcon size={18} color={form.providerType===pt.key?"#378add":"#64748B"}/>:
                           pt.icon==="mechanic"?<MechanicIcon size={18} color={form.providerType===pt.key?"#378add":"#64748B"}/>:
                           <GlobeIcon size={18} color={form.providerType===pt.key?"#378add":"#64748B"}/>}
                        </div>
                          <div style={{ fontSize:13, fontWeight:600, color:form.providerType===pt.key?"#378add":"#555" }}>{pt.label}</div>
                          <div style={{ fontSize:12, color:"#999" }}>{pt.desc}</div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
                {selectedRole==="driver"&&(
                  <>
                    <label style={lbl}>Vehicle type</label>
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:10 }}>
                      {DRIVER_VEHICLE_TYPES.map(vt=>(
                        <div key={vt.key} onClick={()=>setForm(f=>({...f,driverVehicleType:vt.key}))}
                          style={{ background:form.driverVehicleType===vt.key?"#f0fdf4":"#f5f5f5", border:"1px solid "+(form.driverVehicleType===vt.key?"#1d9e75":"#e0e0e0"), borderRadius:8, padding:"8px 10px", cursor:"pointer" }}>
                          <div style={{ marginBottom:2, display:"flex" }}>{vt.icon==="vehicle"?<VehicleIcon size={18} color={form.driverVehicleType===vt.key?"#1d9e75":"#64748B"}/>:vt.icon==="motorcycle"?<MotorcycleIcon size={18} color={form.driverVehicleType===vt.key?"#1d9e75":"#64748B"}/>:vt.icon==="tuktuk"?<TukTukIcon size={18} color={form.driverVehicleType===vt.key?"#1d9e75":"#64748B"}/>:vt.icon==="delivery"?<DeliveryIcon size={18} color={form.driverVehicleType===vt.key?"#1d9e75":"#64748B"}/>:<DriversIcon size={18} color={form.driverVehicleType===vt.key?"#1d9e75":"#64748B"}/>}</div>
                          <div style={{ fontSize:13, fontWeight:600, color:form.driverVehicleType===vt.key?"#1d9e75":"#555" }}>{vt.label}</div>
                          <div style={{ fontSize:12, color:"#999" }}>{vt.desc}</div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
                <label style={lbl}>Phone number</label>
                <input style={inp} placeholder="+254 700 000 000" value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))} required/>
              </>
            )}

            <label style={lbl}>Email address</label>
            <input style={inp} type="email" placeholder="you@example.com" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} required autoFocus={mode==="signin"}/>

            <label style={lbl}>Password</label>
            <input style={{ ...inp, marginBottom:mode==="signup"?12:20 }} type="password" placeholder="Min 8 characters, 1 number" value={form.password} onChange={e=>setForm(f=>({...f,password:e.target.value}))} required/>

            {mode==="signin"&&(
              <button type="button" onClick={()=>{ setMode("forgot"); setResetSent(false) }}
                style={{ background:"none", border:"none", color:"#e6821e", fontSize:13, cursor:"pointer", padding:"0 0 12px", width:"100%", textAlign:"right", display:"block", fontFamily:"DM Sans,sans-serif" }}>
                Forgot password?
              </button>
            )}
            {mode==="signup"&&(
              <>
                <label style={lbl}>Referral code (optional)</label>
                <input style={{ ...inp, marginBottom:16 }} placeholder="Enter referral code" value={refCode} onChange={e=>setRefCode(e.target.value.toUpperCase())}/>

                {/* CCC Promise Card */}
                <div style={{ marginBottom:16 }}>
                  <div style={{ background:"linear-gradient(135deg,#1a1a1a 0%,#2d1810 50%,#1a1a1a 100%)", border:"1.5px solid #e6821e", borderRadius:16, padding:"1.25rem", marginBottom:10, overflow:"hidden" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
                      <div style={{ fontSize:28 }}>🛡️</div>
                      <div>
                        <div style={{ fontFamily:"Syne", fontSize:15, fontWeight:800, color:"#e6821e" }}>Your protection matters to us</div>
                        <div style={{ fontSize:11, color:"#888", marginTop:1 }}>Before you join — our promise to you</div>
                      </div>
                    </div>
                    <div style={{ marginBottom:14 }}>
                      {[
                        { icon:"🔒", text:"Keep your personal data private and secure" },
                        { icon:"💳", text:"Protect every payment through verified channels" },
                        { icon:"🛡️", text:"Back every service with our Service Guarantee" },
                        { icon:"⚖️", text:"Resolve disputes fairly and transparently" },
                      ].map((p,i)=>(
                        <div key={i} style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
                          <span style={{ fontSize:13, flexShrink:0 }}>{p.icon}</span>
                          <span style={{ fontSize:12, color:"#cccccc", lineHeight:1.5 }}>{p.text}</span>
                        </div>
                      ))}
                    </div>
                    <div style={{ height:1, background:"linear-gradient(90deg,transparent,#e6821e,transparent)", marginBottom:12 }}/>
                    <div style={{ fontSize:11, color:"#888", marginBottom:8, textAlign:"center" }}>👇 Tap to read before agreeing</div>
                    <div style={{ display:"flex", gap:8 }}>
                      <a href="/terms" target="_blank" rel="noreferrer" style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:6, background:"linear-gradient(135deg,#e6821e,#f09840)", borderRadius:10, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:12, fontWeight:700, padding:"10px 8px", textDecoration:"none" }}>
                        📄 Terms of Service
                      </a>
                      <a href="/privacy" target="_blank" rel="noreferrer" style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:6, background:"transparent", border:"1.5px solid #e6821e", borderRadius:10, color:"#e6821e", fontFamily:"Syne,sans-serif", fontSize:12, fontWeight:700, padding:"10px 8px", textDecoration:"none" }}>
                        🔒 Privacy Policy
                      </a>
                    </div>
                  </div>
                  <label style={{ display:"flex", alignItems:"center", gap:12, cursor:"pointer", padding:"0.85rem 1rem", background:agreed?"#0d2b1f":"#111111", border:"1.5px solid " + (agreed?"#1d9e75":"#333333"), borderRadius:12, transition:"all 0.3s" }}>
                    <div style={{ width:24, height:24, borderRadius:6, border:"2px solid " + (agreed?"#1d9e75":"#555"), background:agreed?"#1d9e75":"transparent", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, transition:"all 0.2s" }}>
                      {agreed&&<span style={{ color:"#fff", fontSize:14, fontWeight:800 }}>✓</span>}
                      <input type="checkbox" checked={agreed} onChange={e=>setAgreed(e.target.checked)} style={{ position:"absolute", opacity:0, width:0, height:0 }}/>
                    </div>
                    <span style={{ fontSize:13, color:agreed?"#1d9e75":"#aaaaaa", fontWeight:agreed?700:400, lineHeight:1.5 }}>
                      {agreed ? "I have read and I am in! Let us go 🚗" : "I have read the Terms & Privacy Policy and I agree"}
                    </span>
                  </label>
                </div>
              </>
            )}

            <button type="submit" disabled={loading||(mode==="signup"&&!agreed)}
              style={{ width:"100%", background:loading||(mode==="signup"&&!agreed)?"#555555":"#e6821e", border:"none", borderRadius:9, color:loading||(mode==="signup"&&!agreed)?"#666":"#fff", fontFamily:"Syne,sans-serif", fontSize:16, fontWeight:700, padding:"15px", cursor:loading||(mode==="signup"&&!agreed)?"not-allowed":"pointer", transition:"all 0.15s" }}>
              {loading ? "Please wait..." : mode==="signin" ? "Sign in →" : "Create account →"}
            </button>
          </form>

          <div style={{ display:"flex", alignItems:"center", gap:10, margin:"1.25rem 0" }}>
            <div style={{ flex:1, height:1, background:"#eeeeee" }}/>
            <div style={{ fontSize:11, color:"#999" }}>OR</div>
            <div style={{ flex:1, height:1, background:"#eeeeee" }}/>
          </div>

          <button type="button" onClick={signInWithGoogle}
            style={{ width:"100%", display:"flex", alignItems:"center", justifyContent:"center", gap:10, background:"#ffffff", border:"1px solid #dddddd", borderRadius:9, color:"#555555", fontFamily:"'DM Sans',sans-serif", fontSize:14, fontWeight:600, padding:"13px", cursor:"pointer" }}>
            <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"/><path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"/><path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"/><path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"/></svg>
            Continue with Google
          </button>

          <div style={{ textAlign:"center", marginTop:"1.25rem", fontSize:12, color:"#999" }}>
            {mode==="signin"&&(
              <>Don&apos;t have an account?{" "}
                <button onClick={()=>setMode("signup")} style={{ background:"none", border:"none", color:"#e6821e", cursor:"pointer", fontSize:12, fontFamily:"'DM Sans',sans-serif", padding:0 }}>Create one</button>
              </>
            )}
          </div>
        </div>
      </div>

      <div style={{ width:isMobile?"100%":420, background:"#ffffff", borderLeft:"1px solid #eeeeee", display:"flex", flexDirection:"column", justifyContent:"space-between", padding:"3rem 2.5rem" }}>
        <div>
          <div style={{ fontFamily:"Syne", fontSize:28, fontWeight:800, color:"#ffffff", marginBottom:8, lineHeight:1.2 }}>
            Car<span style={{ color:"#e6821e" }}>Care</span> Connect
          </div>
          <div style={{ fontSize:15, color:"#555555", marginBottom:"2rem", lineHeight:1.6 }}>
            Nairobi&apos;s trusted auto care network — connecting vehicle owners with verified service providers.
          </div>
          {ROLES.map(r=>(
            <div key={r.key} style={{ display:"flex", alignItems:"flex-start", gap:12, marginBottom:16, padding:"0.9rem", background:selectedRole===r.key?r.bg:"transparent", border:`1px solid ${selectedRole===r.key?r.border:"transparent"}`, borderRadius:10, transition:"all 0.15s" }}>
              <span style={{display:"flex",alignItems:"center",marginTop:2}}>
              {r.icon==="vehicle"?<VehicleIcon size={20} color={selectedRole===r.key?r.color:"#888"}/>:
               r.icon==="services"?<ServicesIcon size={20} color={selectedRole===r.key?r.color:"#888"}/>:
               r.icon==="delivery"?<DeliveryIcon size={20} color={selectedRole===r.key?r.color:"#888"}/>:
               <MechanicIcon size={20} color={selectedRole===r.key?r.color:"#888"}/>}
            </span>
              <div>
                <div style={{ fontSize:15, fontWeight:600, color:selectedRole===r.key?r.color:"#fff", marginBottom:2 }}>{r.label}</div>
                <div style={{ fontSize:13, color:"#666666", lineHeight:1.5 }}>{r.desc}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ paddingTop:"2rem", borderTop:"1px solid #ffffff" }}>
          <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:12, marginBottom:"1.5rem" }}>
            {STATS.map(s=>(
              <div key={s.label}>
                <div style={{ fontFamily:"Syne", fontSize:16, fontWeight:800, color:"#e6821e" }}>{s.value}</div>
                <div style={{ fontSize:12, color:"#fff", marginTop:2 }}>{s.label}</div>
              </div>
            ))}
          </div>
          <div style={{ display:"flex", gap:12 }}>
            <a href="/terms" target="_blank" style={{ fontSize:13, color:"#999", textDecoration:"none" }}>Terms</a>
            <a href="/privacy" target="_blank" style={{ fontSize:13, color:"#999", textDecoration:"none" }}>Privacy</a>
          </div>
        </div>
      </div>
    </div>
  )

  // Role selection
  if (step === "role") return (
    <div style={{ minHeight:"100vh", background:"#f8f8f8", fontFamily:"DM Sans,sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@300;400;500&display=swap');`}</style>
      <div style={{ background:"#fff", padding:"1rem 1.25rem", borderBottom:"1px solid #eee", display:"flex", alignItems:"center", gap:12, position:"sticky", top:0, zIndex:10 }}>
        <button onClick={()=>setStep("landing")} style={{ background:"none", border:"none", color:"#555555", cursor:"pointer", fontSize:13, padding:0 }}>
          ← Back
        </button>
        <div style={{ fontFamily:"Syne", fontSize:15, fontWeight:800 }}>Car<span style={{ color:"#e6821e" }}>Care</span> Connect</div>
      </div>
      <div style={{ padding:"1.5rem 1.25rem 0.5rem" }}>
        <div style={{ fontFamily:"Syne", fontSize:26, fontWeight:800, color:"#000", marginBottom:4 }}>Who are you?</div>
        <div style={{ fontSize:14, color:"#888" }}>Choose your role to get started</div>
        <div style={{ width:40, height:3, background:"#e6821e", borderRadius:2, marginTop:10 }}/>
      </div>
      <div style={{ padding:"1rem 1.25rem", display:"flex", flexDirection:"column", gap:16 }}>
        {ROLES.map(r=>(
          <div key={r.key}
            style={{ background:"#fff", borderRadius:20, border:`2px solid ${selectedRole===r.key?r.color:"#f0f0f0"}`, overflow:"hidden", boxShadow:"0 2px 12px rgba(0,0,0,0.06)", transition:"all 0.2s", cursor:"pointer" }}
            onClick={()=>{ if(r.isSpecial){window.location.href=r.specialUrl}else{setSelectedRole(r.key)} }}>
            <div style={{ padding:"1.25rem 1.25rem 1rem", background:selectedRole===r.key?r.bg:"#fff" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
                <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <div style={{ width:48, height:48, borderRadius:12, background:selectedRole===r.key?r.color+"20":"#f5f5f5", display:"flex", alignItems:"center", justifyContent:"center" }}>
                    {r.icon==="vehicle"?<VehicleIcon size={26} color={selectedRole===r.key?r.color:"#888"}/>:
                     r.icon==="services"?<ServicesIcon size={26} color={selectedRole===r.key?r.color:"#888"}/>:
                     r.icon==="delivery"?<DeliveryIcon size={26} color={selectedRole===r.key?r.color:"#888"}/>:
                     <MechanicIcon size={26} color={selectedRole===r.key?r.color:"#888"}/>}
                  </div>
                  <div>
                    <div style={{ fontFamily:"Syne", fontSize:18, fontWeight:800, color:selectedRole===r.key?r.color:"#000" }}>{r.label}</div>
                    <div style={{ fontSize:12, color:"#888", marginTop:1 }}>{r.desc}</div>
                  </div>
                </div>
                <div style={{display:"flex",justifyContent:"center"}}>{r.key==="customer"?<TripReportIcon size={32} color={r.color}/>:r.key==="provider"?<AnalyticsIcon size={32} color={r.color}/>:<VehicleIcon size={32} color={r.color}/>}</div>
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:6, background:selectedRole===r.key?r.color+"10":"#f8f8f8", borderRadius:12, padding:"0.75rem" }}>
                {r.features.map(f=>(
                  <div key={f} style={{ display:"flex", alignItems:"center", gap:8, fontSize:13, color:selectedRole===r.key?r.color:"#444" }}>
                    <span style={{ fontSize:14 }}>{f.split(" ")[0]}</span>
                    <span>{f.split(" ").slice(1).join(" ")}</span>
                  </div>
                ))}
              </div>
            </div>
            <button
              onClick={e=>{ e.stopPropagation(); if(r.isSpecial){window.location.href=r.specialUrl}else{setSelectedRole(r.key); setStep("auth")} }}
              style={{ width:"100%", background:selectedRole===r.key||r.isSpecial?r.color:"#f0f0f0", border:"none", color:selectedRole===r.key||r.isSpecial?"#fff":"#555", fontFamily:"Syne,sans-serif", fontSize:14, fontWeight:700, padding:"14px", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:8, transition:"all 0.2s" }}>
              Continue as {r.label} →
            </button>
          </div>
        ))}
      </div>
      <div style={{ padding:"1rem 1.25rem 2rem" }}>
        <div style={{ background:"#fff", borderRadius:14, padding:"0.85rem 1rem", display:"flex", alignItems:"center", gap:10, border:"1px solid #f0f0f0" }}>
          <div style={{ width:32, height:32, borderRadius:8, background:"#fff8f0", display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, flexShrink:0 }}>🛡️</div>
          <div>
            <div style={{ fontSize:12, fontWeight:600, color:"#000" }}>Safe and Secure</div>
            <div style={{ fontSize:11, color:"#888" }}>Your data is protected and secure with us.</div>
          </div>
        </div>
        <div style={{ textAlign:"center", marginTop:12, fontSize:12, color:"#aaa" }}>
          By continuing you agree to our <a href="/terms" target="_blank" style={{ color:"#e6821e", textDecoration:"none" }}>Terms</a> and <a href="/privacy" target="_blank" style={{ color:"#e6821e", textDecoration:"none" }}>Privacy Policy</a>
        </div>
      </div>
    </div>
  )

    // Landing page - redesigned
  return (
    <div style={{ minHeight:"100vh", background:"#fff", fontFamily:"DM Sans,sans-serif", display:"flex", flexDirection:"column", overflowX:"hidden" }}>
      <style>{`
        @keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
        .au{animation:fadeUp 0.5s ease forwards;}
        .au2{animation:fadeUp 0.5s 0.1s ease both;}
        .au3{animation:fadeUp 0.5s 0.2s ease both;}
        .au4{animation:fadeUp 0.5s 0.3s ease both;}
        .role-pill:active{transform:scale(0.97);}
      `}</style>

      <nav style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"0 1.25rem", height:58, background:"#fff", borderBottom:"1px solid #f0f0f0", position:"sticky", top:0, zIndex:10 }}>
        <div style={{ fontFamily:"Syne,sans-serif", fontSize:19, fontWeight:800, letterSpacing:"-0.5px" }}>Car<span style={{ color:"#e6821e" }}>Care</span> Connect</div>
        <div style={{ display:"flex", gap:8 }}>
          <button onClick={()=>{ setStep("role"); setMode("signin") }} style={{ background:"none", border:"1.5px solid #e0e0e0", borderRadius:100, color:"#000", fontSize:13, fontWeight:600, padding:"7px 16px", cursor:"pointer", fontFamily:"DM Sans,sans-serif" }}>Sign in</button>
          <button onClick={()=>{ setStep("role"); setMode("signup") }} style={{ background:"#e6821e", border:"none", borderRadius:100, color:"#fff", fontSize:13, fontWeight:700, padding:"8px 18px", cursor:"pointer", fontFamily:"DM Sans,sans-serif" }}>Get started</button>
        </div>
      </nav>

      <div style={{ flex:1, display:"flex", flexDirection:"column" }}>
        <div style={{ position:"relative", height:260, overflow:"hidden" }}>
          <img src="https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=800&q=85" alt="Car Care" style={{ width:"100%", height:"100%", objectFit:"cover", objectPosition:"center 30%", display:"block" }}/>
          <div style={{ position:"absolute", inset:0, background:"linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.65) 100%)" }}/>
          <div style={{ position:"absolute", bottom:"1.25rem", left:"1.25rem" }}>
            <div style={{ display:"inline-flex", alignItems:"center", gap:6, background:"rgba(255,255,255,0.12)", border:"1px solid rgba(255,255,255,0.25)", backdropFilter:"blur(8px)", borderRadius:100, padding:"5px 14px" }}>
              <span style={{ width:6, height:6, borderRadius:"50%", background:"#4ade80", display:"inline-block" }}/>
              <span style={{ fontSize:11, fontWeight:700, color:"#fff", textTransform:"uppercase", letterSpacing:"0.08em" }}>Kenya Automotive Marketplace</span>
            </div>
          </div>
        </div>

        <div style={{ padding:"1.5rem 1.25rem", flex:1 }}>
          <div className="au" style={{ marginBottom:"1.5rem" }}>
            <h1 style={{ fontFamily:"Syne,sans-serif", fontSize:"clamp(30px,7vw,42px)", fontWeight:800, lineHeight:1.08, letterSpacing:"-1.5px", color:"#000", marginBottom:"0.75rem" }}>
              One app.<br/><em style={{ color:"#e6821e", fontStyle:"normal" }}>Every car need.</em>
            </h1>
            <p style={{ fontSize:14, color:"#64748b", lineHeight:1.7 }}>
              Kenya most trusted automotive marketplace. Book verified mechanics, order genuine parts, get 24/7 emergency help and more.
            </p>
          </div>

          <div className="au2" style={{ marginBottom:"1.5rem" }}>
            <div style={{ fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.1em", color:"#aaa", marginBottom:"0.75rem" }}>I am a...</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
              {[
                { key:"customer", emoji:"car", label:"Vehicle Owner", desc:"Book services and parts", color:"#e6821e", bg:"#fff8f0", border:"#e6821e25" },
                { key:"provider", emoji:"wrench", label:"Garage or Shop", desc:"List and earn more", color:"#378add", bg:"#eff6ff", border:"#378add25" },
                { key:"mechanic", emoji:"gear", label:"Mechanic", desc:"Get jobs assigned", color:"#1d9e75", bg:"#f0fdf4", border:"#1d9e7525" },
                { key:"driver", emoji:"truck", label:"Driver", desc:"Deliver and earn", color:"#8b5cf6", bg:"#faf5ff", border:"#8b5cf625" },
              ].map(r=>(
                <div key={r.key} className="role-pill"
                  onClick={()=>{ setSelectedRole(r.key); setStep("role"); setMode("signup") }}
                  style={{ background:r.bg, border:"1.5px solid "+r.border, borderRadius:16, padding:"1rem", cursor:"pointer", transition:"all 0.18s" }}>
                  <div style={{ marginBottom:8, display:"flex", justifyContent:"center" }}>
                  {r.emoji==="car"?<VehicleIcon size={28} color={r.color}/>:
                   r.emoji==="wrench"?<ServicesIcon size={28} color={r.color}/>:
                   r.emoji==="gear"?<MechanicIcon size={28} color={r.color}/>:
                   <DeliveryIcon size={28} color={r.color}/>}
                </div>
                  <div style={{ fontFamily:"Syne,sans-serif", fontSize:13, fontWeight:700, color:"#000", marginBottom:3 }}>{r.label}</div>
                  <div style={{ fontSize:11, color:"#888", lineHeight:1.4 }}>{r.desc}</div>
                  <div style={{ marginTop:8, fontSize:11, fontWeight:700, color:r.color }}>Join free</div>
                </div>
              ))}
            </div>
          </div>

          <div className="au3"
            onClick={()=>{ setSelectedRole("parts_dealer"); setStep("role"); setMode("signup") }}
            style={{ background:"#fefce8", border:"1.5px solid #f59e0b25", borderRadius:14, padding:"0.875rem 1rem", display:"flex", alignItems:"center", gap:12, cursor:"pointer", marginBottom:"1.5rem" }}>
            <div style={{ flexShrink:0, display:"flex", alignItems:"center" }}><MarketplaceIcon size={28} color="#f59e0b"/></div>
            <div style={{ flex:1 }}>
              <div style={{ fontFamily:"Syne,sans-serif", fontSize:13, fontWeight:700, color:"#000" }}>Parts Dealer</div>
              <div style={{ fontSize:11, color:"#888", marginTop:2 }}>Sell genuine and aftermarket parts online. Keep up to 95%.</div>
            </div>
            <div style={{ fontSize:13, fontWeight:700, color:"#f59e0b", flexShrink:0 }}>Join</div>
          </div>

          <div className="au4" style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:"1.5rem" }}>
            <button onClick={()=>setStep("role")}
              style={{ width:"100%", background:"#e6821e", border:"none", borderRadius:14, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:16, fontWeight:800, padding:"16px", cursor:"pointer", boxShadow:"0 4px 20px rgba(230,130,30,0.35)" }}>
              Get started free
            </button>
            <button onClick={()=>{ setStep("role"); setMode("signin") }}
              style={{ width:"100%", background:"#fff", border:"2px solid #e0e0e0", borderRadius:14, color:"#000", fontFamily:"DM Sans,sans-serif", fontSize:14, fontWeight:600, padding:"13px", cursor:"pointer" }}>
              Already have an account? Sign in
            </button>
          </div>

          <div style={{ display:"flex", gap:16, justifyContent:"center", flexWrap:"wrap", marginBottom:"1.5rem" }}>
            {[["ok","Free to join"],["ok","M-Pesa payments"],["ok","Verified providers"]].map(([c,l])=>(
              <div key={l} style={{ display:"flex", alignItems:"center", gap:5, fontSize:12, color:"#888" }}>
                <span style={{ color:"#16a34a", fontWeight:700 }}>ok</span>{l}
              </div>
            ))}
          </div>

          <div onClick={()=>setStep("role")}
            style={{ background:"#fff5f5", border:"1.5px solid #e24b4a20", borderRadius:14, padding:"0.875rem 1rem", display:"flex", alignItems:"center", gap:12, cursor:"pointer", marginBottom:"1rem" }}>
            <div style={{ width:42, height:42, borderRadius:12, background:"#e24b4a", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
              <span style={{ fontFamily:"Syne,sans-serif", fontSize:13, fontWeight:800, color:"#fff" }}>GO</span>
            </div>
            <div>
              <div style={{ fontFamily:"Syne,sans-serif", fontSize:13, fontWeight:700, color:"#000" }}>GO Service 24/7 Emergency</div>
              <div style={{ fontSize:11, color:"#888", marginTop:2 }}>Broke down? Mechanic to your GPS in under 15 min. KES 500 callout.</div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ background:"#0a0a0a", padding:"1rem 1.25rem", textAlign:"center" }}>
        <div style={{ fontFamily:"Syne,sans-serif", fontSize:14, fontWeight:800, color:"#fff", marginBottom:4 }}>Car<span style={{ color:"#e6821e" }}>Care</span> Connect</div>
        <div style={{ fontSize:11, color:"#444" }}>2026 Kenya · Payments via M-Pesa · CBK Regulated</div>
      </div>
    </div>
  )
}

