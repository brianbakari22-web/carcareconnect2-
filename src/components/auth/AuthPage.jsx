import useIsMobile from "../../lib/useIsMobile"
import { useState, useEffect } from "react"

import { supabase } from "../../lib/supabase"
import { useAuth } from "../../contexts/AuthContext"
import { useNavigate } from "react-router-dom"
import toast from "react-hot-toast"

const PROVIDER_TYPES = [
  { key:"garage", label:"Garage/Mechanic", icon:"≡ƒöº", desc:"Car service and repair" },
  { key:"parts_dealer", label:"Parts Dealer", icon:"ΓÜÖ∩╕Å", desc:"Auto parts and spares" },
  { key:"accessories_shop", label:"Accessories Shop", icon:"Γ£¿", desc:"Car accessories" },
  { key:"tyre_shop", label:"Tyre Shop", icon:"≡ƒ¢₧", desc:"Tyre sales and fitting" },
  { key:"auto_electrician", label:"Auto Electrician", icon:"ΓÜí", desc:"Electrical specialist" },
  { key:"car_wash", label:"Car Wash", icon:"≡ƒÜ┐", desc:"Wash and detailing" },
  { key:"panel_beater", label:"Panel Beater", icon:"≡ƒö¿", desc:"Body and spray paint" },
  { key:"auto_glass", label:"Auto Glass", icon:"≡ƒ¬ƒ", desc:"Windscreen specialist" },
]
const DRIVER_VEHICLE_TYPES = [
  { key:"car", label:"Car", icon:"≡ƒÜù", desc:"Standard delivery" },
  { key:"motorcycle", label:"Boda Boda", icon:"≡ƒÅì∩╕Å", desc:"Fast parts delivery" },
  { key:"tuktuk", label:"Tuktuk", icon:"≡ƒ¢║", desc:"Local delivery" },
  { key:"van", label:"Van/Pickup", icon:"≡ƒÜÉ", desc:"Large items" },
]
const ROLES = [
  {
    key: "customer",
    label: "Customer",
    icon: "≡ƒÜù",
    desc: "Book services, track drivers, earn loyalty points",
    color: "#e6821e",
    bg: "#1a1208",
    border: "#e6821e40",
    features: ["≡ƒöº Browse verified services", "≡ƒôì Live driver tracking", "≡ƒÆÄ Loyalty rewards", "Γ¡É Rate your experience"]
  },
  {
    key: "provider",
    label: "Service Provider",
    icon: "≡ƒöº",
    desc: "List services, manage bookings, grow your business",
    color: "#378add",
    bg: "#0c1f2e",
    border: "#378add40",
    features: ["≡ƒôè Analytics dashboard", "≡ƒÆ░ Fast payouts", "≡ƒôà Booking management", "Γ¡É Customer reviews"]
  },
  {
    key: "driver",
    label: "Driver",
    icon: "≡ƒÜÜ",
    desc: "Earn by delivering vehicles, set your own schedule",
    color: "#1d9e75",
    bg: "#071a12",
    border: "#1d9e7540",
    features: ["≡ƒôì GPS navigation", "≡ƒÆ╡ Competitive earnings", "≡ƒôê Earnings dashboard", "Γ£à Flexible hours"]
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
  const [step, setStep] = useState("landing")
  const [selectedRole, setSelectedRole] = useState(null)
  const [mode, setMode] = useState("signin")
  const [resetSent, setResetSent] = useState(false)
  const [form, setForm] = useState({ email:"", password:"", firstName:"", lastName:"", phone:"", businessName:"", providerType:"garage", driverVehicleType:"car" })
  const [loading, setLoading] = useState(false)
  const [refCode, setRefCode] = useState("")
  const [agreed, setAgreed] = useState(false)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    setTimeout(() => setVisible(true), 100)
    const params = new URLSearchParams(window.location.search)
    const ref = params.get("ref")
    if (ref) setRefCode(ref.toUpperCase())
  }, [])

  async function handleAuth(e) {
    e.preventDefault()
    if (mode === "signup" && !agreed) return toast.error("Please agree to the Terms and Privacy Policy")
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
        return // navigation handled above


        checkProfile()
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



        let tries = 0
        const checkProfile = async () => {
          const { data: { user: u } } = await supabase.auth.getUser()
          if (!u) return setTimeout(checkProfile, 300)
          const { data: prof } = await supabase.from("profiles").select("role").eq("id", u.id).single()
          if (prof?.role) {
            navigate("/dashboard")
          } else if (tries++ < 15) {
            setTimeout(checkProfile, 300)
          } else {
            navigate("/dashboard")
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

  const inp = { width:"100%", background:"#111", border:"1px solid #2a2a2a", borderRadius:9, padding:"12px 14px", color:"#f0ede6", fontSize:13, outline:"none", fontFamily:"'DM Sans',sans-serif", marginBottom:12 }
  const lbl = { fontSize:11, color:"#666", textTransform:"uppercase", letterSpacing:"0.05em", display:"block", marginBottom:4 }
  const roleData = ROLES.find(r=>r.key===selectedRole)

  // Forgot password
  if (mode === "forgot") return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"#0a0a0a", padding:"1rem" }}>
      <div style={{ width:"100%", maxWidth:400, background:"#111", border:"1px solid #1e1e1e", borderRadius:16, padding:"2rem" }}>
        <div style={{ textAlign:"center", marginBottom:"1.5rem" }}>
          <div style={{ fontSize:36, marginBottom:8 }}>≡ƒöÉ</div>
          <div style={{ fontFamily:"Syne", fontSize:22, fontWeight:800, color:"#f0ede6", marginBottom:4 }}>Reset password</div>
          <div style={{ fontSize:12, color:"#555" }}>Enter your email to receive a reset link</div>
        </div>
        {resetSent ? (
          <div>
            <div style={{ background:"#071a12", border:"1px solid #1d9e7540", borderRadius:10, padding:"1.25rem", marginBottom:"1.5rem", textAlign:"center" }}>
              <div style={{ fontSize:32, marginBottom:8 }}>≡ƒôº</div>
              <div style={{ fontSize:13, color:"#1d9e75", fontWeight:600, marginBottom:4 }}>Reset link sent!</div>
              <div style={{ fontSize:12, color:"#888", lineHeight:1.6 }}>
                Check your email at <strong style={{ color:"#f0ede6" }}>{form.email}</strong>. Check spam if you dont see it.
              </div>
            </div>
            <button onClick={()=>{ setMode("signin"); setResetSent(false) }}
              style={{ width:"100%", background:"#e6821e", border:"none", borderRadius:10, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:14, fontWeight:700, padding:"13px", cursor:"pointer" }}>
              Back to sign in
            </button>
          </div>
        ) : (
          <form onSubmit={handleAuth}>
            <label style={{ fontSize:11, color:"#666", display:"block", marginBottom:4 }}>Email address</label>
            <input type="email" required value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))}
              placeholder="your@email.com"
              style={{ width:"100%", background:"#0f0f0f", border:"1px solid #222", borderRadius:8, padding:"11px 12px", color:"#f0ede6", fontSize:13, outline:"none", marginBottom:16 }}/>
            <button type="submit" disabled={loading}
              style={{ width:"100%", background:loading?"#333":"#e6821e", border:"none", borderRadius:10, color:loading?"#555":"#fff", fontFamily:"Syne,sans-serif", fontSize:14, fontWeight:700, padding:"13px", cursor:loading?"not-allowed":"pointer", marginBottom:12 }}>
              {loading ? "Sending..." : "Send reset link"}
            </button>
            <button type="button" onClick={()=>setMode("signin")}
              style={{ width:"100%", background:"none", border:"1px solid #333", borderRadius:10, color:"#666", fontSize:13, padding:"12px", cursor:"pointer" }}>
              Back to sign in
            </button>
          </form>
        )}
      </div>
    </div>
  )

  // Auth form
  if (step === "auth") return (
    <div style={{ minHeight:"100vh", background:"#0a0a0a", display:"flex", flexDirection:isMobile?"column":"row", fontFamily:"'DM Sans',sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@300;400;500&display=swap');`}</style>

      <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", padding:isMobile?"1rem":"2rem" }}>
        <div style={{ width:"100%", maxWidth:420 }}>
          <button onClick={()=>setStep("role")} style={{ background:"none", border:"none", color:"#555", cursor:"pointer", fontSize:13, marginBottom:"1.5rem", fontFamily:"'DM Sans',sans-serif", padding:0 }}>
            ΓåÉ Back
          </button>

          <div style={{ marginBottom:"1.5rem" }}>
            <div style={{ fontFamily:"Syne", fontSize:24, fontWeight:800, color:"#f0ede6", marginBottom:4 }}>
              {mode==="signin" ? "Welcome back" : "Create account"}
            </div>
            <div style={{ fontSize:13, color:"#555" }}>
              {mode==="signin" ? "Sign in to your Car Care Connect account" : `Joining as a ${roleData?.label}`}
            </div>
          </div>

          {roleData&&mode==="signup"&&(
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:"1.25rem", padding:"0.9rem 1rem", background:roleData.bg, border:`1px solid ${roleData.border}`, borderRadius:10 }}>
              <span style={{ fontSize:22 }}>{roleData.icon}</span>
              <div>
                <div style={{ fontSize:13, fontWeight:600, color:roleData.color }}>{roleData.label}</div>
                <div style={{ fontSize:11, color:"#666" }}>{roleData.desc}</div>
              </div>
            </div>
          )}

          <div style={{ display:"flex", gap:0, marginBottom:"1.5rem", background:"#111", borderRadius:9, padding:3 }}>
            {[{k:"signin",l:"Sign in"},{k:"signup",l:"Create account"}].map(m=>(
              <button key={m.k} onClick={()=>{ setMode(m.k); setAgreed(false) }}
                style={{ flex:1, padding:"9px", borderRadius:7, border:"none", fontSize:13, cursor:"pointer", fontFamily:"'DM Sans',sans-serif", fontWeight:mode===m.k?600:400, background:mode===m.k?"#1a1a1a":"transparent", color:mode===m.k?"#f0ede6":"#555", transition:"all 0.15s" }}>
                {m.l}
              </button>
            ))}
          </div>

          <form onSubmit={handleAuth}>
            {mode==="signin"&&(
              <button type="button" onClick={()=>{ setMode("forgot"); setResetSent(false) }}
                style={{ background:"none", border:"none", color:"#e6821e", fontSize:11, cursor:"pointer", padding:"0 0 12px", width:"100%", textAlign:"right", display:"block", fontFamily:"DM Sans,sans-serif" }}>
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
                          style={{ background:form.providerType===pt.key?"#0c1f2e":"#0f0f0f", border:"1px solid "+(form.providerType===pt.key?"#378add":"#222"), borderRadius:8, padding:"8px 10px", cursor:"pointer" }}>
                          <div style={{ fontSize:18, marginBottom:2 }}>{pt.icon}</div>
                          <div style={{ fontSize:11, fontWeight:600, color:form.providerType===pt.key?"#378add":"#888" }}>{pt.label}</div>
                          <div style={{ fontSize:10, color:"#444" }}>{pt.desc}</div>
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
                          style={{ background:form.driverVehicleType===vt.key?"#071a12":"#0f0f0f", border:"1px solid "+(form.driverVehicleType===vt.key?"#1d9e75":"#222"), borderRadius:8, padding:"8px 10px", cursor:"pointer" }}>
                          <div style={{ fontSize:18, marginBottom:2 }}>{vt.icon}</div>
                          <div style={{ fontSize:11, fontWeight:600, color:form.driverVehicleType===vt.key?"#1d9e75":"#888" }}>{vt.label}</div>
                          <div style={{ fontSize:10, color:"#444" }}>{vt.desc}</div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
                <label style={lbl}>Phone number</label>
                <input style={inp} placeholder="+254 700 000 000" value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))}/>
              </>
            )}

            <label style={lbl}>Email address</label>
            <input style={inp} type="email" placeholder="you@example.com" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} required autoFocus={mode==="signin"}/>

            <label style={lbl}>Password</label>
            <input style={{ ...inp, marginBottom:mode==="signup"?12:20 }} type="password" placeholder="Min 6 characters" value={form.password} onChange={e=>setForm(f=>({...f,password:e.target.value}))} required/>

            {mode==="signin"&&(
              <button type="button" onClick={()=>{ setMode("forgot"); setResetSent(false) }}
                style={{ background:"none", border:"none", color:"#e6821e", fontSize:11, cursor:"pointer", padding:"0 0 12px", width:"100%", textAlign:"right", display:"block", fontFamily:"DM Sans,sans-serif" }}>
                Forgot password?
              </button>
            )}
            {mode==="signup"&&(
              <>
                <label style={lbl}>Referral code (optional)</label>
                <input style={{ ...inp, marginBottom:16 }} placeholder="Enter referral code" value={refCode} onChange={e=>setRefCode(e.target.value.toUpperCase())}/>

                <label style={{ display:"flex", alignItems:"flex-start", gap:10, cursor:"pointer", marginBottom:20, padding:"0.9rem", background:"#111", border:"1px solid #222", borderRadius:9 }}>
                  <input type="checkbox" checked={agreed} onChange={e=>setAgreed(e.target.checked)}
                    style={{ marginTop:2, width:16, height:16, cursor:"pointer", flexShrink:0, accentColor:"#e6821e" }}/>
                  <span style={{ fontSize:12, color:"#666", lineHeight:1.6 }}>
                    I have read and agree to the{" "}
                    <a href="/terms" target="_blank" style={{ color:"#e6821e", textDecoration:"none", fontWeight:500 }}>Terms of Service</a>
                    {" "}and{" "}
                    <a href="/privacy" target="_blank" style={{ color:"#e6821e", textDecoration:"none", fontWeight:500 }}>Privacy Policy</a>
                  </span>
                </label>
              </>
            )}

            <button type="submit" disabled={loading||(mode==="signup"&&!agreed)}
              style={{ width:"100%", background:loading||(mode==="signup"&&!agreed)?"#333":"#e6821e", border:"none", borderRadius:9, color:loading||(mode==="signup"&&!agreed)?"#666":"#fff", fontFamily:"Syne,sans-serif", fontSize:14, fontWeight:700, padding:"13px", cursor:loading||(mode==="signup"&&!agreed)?"not-allowed":"pointer", transition:"all 0.15s" }}>
              {loading ? "Please wait..." : mode==="signin" ? "Sign in ΓåÆ" : "Create account ΓåÆ"}
            </button>
          </form>

          <div style={{ textAlign:"center", marginTop:"1.25rem", fontSize:12, color:"#444" }}>
            {mode==="signin"&&(
              <>Don't have an account?{" "}
                <button onClick={()=>setMode("signup")} style={{ background:"none", border:"none", color:"#e6821e", cursor:"pointer", fontSize:12, fontFamily:"'DM Sans',sans-serif", padding:0 }}>Create one</button>
              </>
            )}
          </div>
        </div>
      </div>

      <div style={{ width:isMobile?"100%":420, background:"#0f0f0f", borderLeft:"1px solid #1e1e1e", display:"flex", flexDirection:"column", justifyContent:"space-between", padding:"3rem 2.5rem" }}>
        <div>
          <div style={{ fontFamily:"Syne", fontSize:28, fontWeight:800, color:"#f0ede6", marginBottom:8, lineHeight:1.2 }}>
            Car<span style={{ color:"#e6821e" }}>Care</span> Connect
          </div>
          <div style={{ fontSize:13, color:"#555", marginBottom:"2rem", lineHeight:1.6 }}>
            Nairobi's trusted auto care network ΓÇö connecting vehicle owners with verified service providers.
          </div>
          {ROLES.map(r=>(
            <div key={r.key} style={{ display:"flex", alignItems:"flex-start", gap:12, marginBottom:16, padding:"0.9rem", background:selectedRole===r.key?r.bg:"transparent", border:`1px solid ${selectedRole===r.key?r.border:"transparent"}`, borderRadius:10, transition:"all 0.15s" }}>
              <span style={{ fontSize:20, marginTop:2 }}>{r.icon}</span>
              <div>
                <div style={{ fontSize:13, fontWeight:600, color:selectedRole===r.key?r.color:"#888", marginBottom:2 }}>{r.label}</div>
                <div style={{ fontSize:11, color:"#555", lineHeight:1.5 }}>{r.desc}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ paddingTop:"2rem", borderTop:"1px solid #1a1a1a" }}>
          <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:12, marginBottom:"1.5rem" }}>
            {STATS.map(s=>(
              <div key={s.label}>
                <div style={{ fontFamily:"Syne", fontSize:16, fontWeight:800, color:"#e6821e" }}>{s.value}</div>
                <div style={{ fontSize:10, color:"#555", marginTop:2 }}>{s.label}</div>
              </div>
            ))}
          </div>
          <div style={{ display:"flex", gap:12 }}>
            <a href="/terms" target="_blank" style={{ fontSize:11, color:"#444", textDecoration:"none" }}>Terms</a>
            <a href="/privacy" target="_blank" style={{ fontSize:11, color:"#444", textDecoration:"none" }}>Privacy</a>
          </div>
        </div>
      </div>
    </div>
  )

  // Role selection
  if (step === "role") return (
    <div style={{ minHeight:"100vh", background:"#0a0a0a", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'DM Sans',sans-serif", padding:"1rem" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@300;400;500&display=swap');`}</style>
      <div style={{ width:"100%", maxWidth:640 }}>
        <button onClick={()=>setStep("landing")} style={{ background:"none", border:"none", color:"#555", cursor:"pointer", fontSize:13, marginBottom:"1.5rem", fontFamily:"'DM Sans',sans-serif", padding:0 }}>
          ΓåÉ Back
        </button>
        <div style={{ textAlign:"center", marginBottom:"2rem" }}>
          <div style={{ fontFamily:"Syne", fontSize:22, fontWeight:800, color:"#f0ede6", marginBottom:6 }}>Who are you?</div>
          <div style={{ fontSize:13, color:"#555" }}>Choose your role to get started</div>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"repeat(3,1fr)", gap:12, marginBottom:"1.5rem" }}>
          {ROLES.map(r=>(
            <div key={r.key} onClick={()=>setSelectedRole(r.key)}
              style={{ background:selectedRole===r.key?r.bg:"#111", border:`2px solid ${selectedRole===r.key?r.color:"#1e1e1e"}`, borderRadius:14, padding:"1.5rem 1rem", cursor:"pointer", textAlign:"center", transition:"all 0.15s" }}
              onMouseEnter={e=>{ if(selectedRole!==r.key){ e.currentTarget.style.borderColor=r.border; e.currentTarget.style.transform="translateY(-4px)" }}}
              onMouseLeave={e=>{ if(selectedRole!==r.key){ e.currentTarget.style.borderColor="#1e1e1e"; e.currentTarget.style.transform="translateY(0)" }}}>
              <div style={{ fontSize:36, marginBottom:10 }}>{r.icon}</div>
              <div style={{ fontFamily:"Syne", fontSize:15, fontWeight:800, color:selectedRole===r.key?r.color:"#f0ede6", marginBottom:6 }}>{r.label}</div>
              <div style={{ fontSize:11, color:"#666", lineHeight:1.5, marginBottom:12 }}>{r.desc}</div>
              <div style={{ textAlign:"left" }}>
                {r.features.map(f=>(
                  <div key={f} style={{ fontSize:11, color:selectedRole===r.key?r.color:"#555", marginBottom:4 }}>{f}</div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <button onClick={()=>{ if(!selectedRole) return toast.error("Please select a role"); setStep("auth") }}
          disabled={!selectedRole}
          style={{ width:"100%", background:selectedRole?"#e6821e":"#222", border:"none", borderRadius:10, color:selectedRole?"#fff":"#555", fontFamily:"Syne,sans-serif", fontSize:14, fontWeight:700, padding:"14px", cursor:selectedRole?"pointer":"not-allowed", transition:"all 0.15s" }}>
          Continue as {selectedRole ? ROLES.find(r=>r.key===selectedRole)?.label : "..."} ΓåÆ
        </button>
        <div style={{ textAlign:"center", marginTop:16, fontSize:12, color:"#444" }}>
          By continuing you agree to our{" "}
          <a href="/terms" target="_blank" style={{ color:"#666", textDecoration:"none" }}>Terms</a>
          {" "}and{" "}
          <a href="/privacy" target="_blank" style={{ color:"#666", textDecoration:"none" }}>Privacy Policy</a>
        </div>
      </div>
    </div>
  )

  // Landing page - simple role picker
  return (
    <div style={{ minHeight:"100vh", background:"#fff", fontFamily:"DM Sans,sans-serif", display:"flex", flexDirection:"column" }}>
      <nav style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"0 1.25rem", height:56, background:"#000", position:"sticky", top:0, zIndex:10 }}>
        <div style={{ fontSize:18, fontWeight:700, color:"#fff" }}>Car<span style={{ color:"#e6821e" }}>Care</span></div>
        <div style={{ display:"flex", gap:8 }}>
          <button onClick={()=>{ setStep("role"); setMode("signin") }} style={{ background:"none", border:"1px solid #444", borderRadius:500, color:"#fff", fontSize:13, padding:"7px 16px", cursor:"pointer" }}>Sign in</button>
          <button onClick={()=>{ setStep("role"); setMode("signup") }} style={{ background:"#e6821e", border:"none", borderRadius:500, color:"#fff", fontSize:13, fontWeight:700, padding:"8px 18px", cursor:"pointer" }}>Get started</button>
        </div>
      </nav>
      <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"3rem 1.25rem", textAlign:"center" }}>
        <img src="/logo.svg" alt="Car Care Connect" style={{ height:110, marginBottom:"1.75rem" }}/>
        <h1 style={{ fontSize:"clamp(28px,6vw,52px)", fontWeight:800, lineHeight:1.1, letterSpacing:-1, color:"#000", marginBottom:"1rem" }}>One app.<br/><span style={{ color:"#e6821e" }}>Every car need.</span></h1>
        <p style={{ fontSize:15, color:"#666", maxWidth:440, margin:"0 auto 2.5rem", lineHeight:1.7 }}>Nairobi most trusted automotive platform. Book mechanics, order parts, wash your car and more.</p>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))", gap:14, width:"100%", maxWidth:680, marginBottom:"2rem" }}>
          {[
            { key:"customer", icon:"🚗", label:"Customer", desc:"Book services, track drivers, earn rewards", color:"#e6821e" },
            { key:"provider", icon:"🔧", label:"Service Provider", desc:"List your shop, manage bookings, grow revenue", color:"#378add" },
            { key:"driver", icon:"🚚", label:"Driver", desc:"Deliver vehicles and parts, earn per trip", color:"#1d9e75" },
          ].map(r=>(
            <div key={r.key} onClick={()=>{ setSelectedRole(r.key); setStep("auth"); setMode("signup") }}
              style={{ background:"#f5f5f5", borderRadius:20, padding:"2rem", cursor:"pointer", textAlign:"left", border:"2px solid transparent", transition:"all 0.2s" }}
              onMouseEnter={e=>{ e.currentTarget.style.borderColor=r.color; e.currentTarget.style.background="#fff"; e.currentTarget.style.transform="translateY(-4px)" }}
              onMouseLeave={e=>{ e.currentTarget.style.borderColor="transparent"; e.currentTarget.style.background="#f5f5f5"; e.currentTarget.style.transform="translateY(0)" }}>
              <div style={{ fontSize:42, marginBottom:14 }}>{r.icon}</div>
              <div style={{ fontWeight:700, fontSize:17, color:"#000", marginBottom:6 }}>{r.label}</div>
              <div style={{ fontSize:13, color:"#888", lineHeight:1.6, marginBottom:12 }}>{r.desc}</div>
              <div style={{ fontSize:12, fontWeight:600, color:r.color }}>Get started →</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize:13, color:"#888" }}>Already have an account?{" "}
          <button onClick={()=>{ setStep("role"); setMode("signin") }} style={{ background:"none", border:"none", color:"#e6821e", fontWeight:600, cursor:"pointer", fontSize:13 }}>Sign in</button>
        </div>
      </div>
      <div style={{ background:"#111", padding:"1.25rem", textAlign:"center" }}>
        <div style={{ fontSize:11, color:"#444" }}>© 2026 Car Care Connect · Nairobi, Kenya · 0113858966</div>
      </div>
    </div>
  )
}

