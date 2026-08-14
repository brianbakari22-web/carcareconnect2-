import { useState } from "react"
import { supabase } from "../../lib/supabase"
import { useAuth } from "../../contexts/AuthContext"
import toast from "react-hot-toast"

const STEPS = [
  { id:"welcome", title:"Welcome to CCC!", icon:"welcome" },
  { id:"profile", title:"Complete your profile", icon:"profile" },
  { id:"location", title:"Set your location", icon:"location" },
  { id:"mpesa", title:"Add M-Pesa number", icon:"mpesa" },
  { id:"done", title:"You are ready!", icon:"done" },
]

export default function ProviderOnboarding({ onComplete }) {
  const { user, profile } = useAuth()
  const [step, setStep] = useState(0)
  const [form, setForm] = useState({ business_name:profile?.business_name||"", city:profile?.city||"", address:"", mpesa_number:"", latitude:null, longitude:null })
  const [saving, setSaving] = useState(false)


  const inp = { width:"100%", padding:"12px 14px", borderRadius:10, border:"1px solid #e0e0e0", fontSize:14, outline:"none", marginBottom:12, boxSizing:"border-box", fontFamily:"DM Sans,sans-serif" }

  async function saveProfile() {
    setSaving(true)
    try {
      await supabase.from("profiles").update({ business_name:form.business_name, city:form.city }).eq("id", user.id)
      toast.success("Profile saved!")
      setStep(s=>s+1)
    } catch(e) { toast.error(e.message) }
    finally { setSaving(false) }
  }



  async function saveLocation() {
    setSaving(true)
    try {
      await supabase.from("profiles").update({ city:form.city, latitude:form.latitude, longitude:form.longitude }).eq("id", user.id)
      toast.success("Location saved!")
      setStep(s=>s+1)
    } catch(e) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  async function detectLocation() {
    if(!navigator.geolocation) return toast.error("Location not supported")
    navigator.geolocation.getCurrentPosition(pos => {
      setForm(f=>({...f, latitude:pos.coords.latitude, longitude:pos.coords.longitude}))
      toast.success("Location detected!")
    }, ()=>toast.error("Could not detect location"))
  }

  async function saveMpesa() {
    setSaving(true)
    try {
      await supabase.from("profile_sensitive").upsert({ id:user.id, mpesa_number:form.mpesa_number })
      await supabase.from("profiles").update({ onboarding_complete:true }).eq("id", user.id)
      toast.success("M-Pesa number saved!")
      setStep(s=>s+1)
    } catch(e) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:"1rem" }}>
      <div style={{ background:"#fff", borderRadius:20, width:"100%", maxWidth:480, maxHeight:"90vh", overflow:"auto" }}>
        
        {/* Progress bar */}
        <div style={{ height:4, background:"#f0f0f0", borderRadius:"20px 20px 0 0", overflow:"hidden" }}>
          <div style={{ height:"100%", background:"#e6821e", width:((step/4)*100)+"%", transition:"width 0.3s" }}/>
        </div>

        {/* Step indicator */}
        <div style={{ display:"flex", gap:6, padding:"1rem 1.5rem 0", overflowX:"auto" }}>
          {STEPS.map((s,i)=>(
            <div key={s.id} style={{ display:"flex", alignItems:"center", gap:4, flexShrink:0 }}>
              <div style={{ width:28, height:28, borderRadius:"50%", background:i<step?"#e6821e":i===step?"#fff8f0":"#f0f0f0", border:"2px solid "+(i<=step?"#e6821e":"#e0e0e0"), display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:700, color:i<step?"#fff":i===step?"#e6821e":"#aaa" }}>
                {i < step ? "v" : i+1}
              </div>
              {i < STEPS.length-1 && <div style={{ width:16, height:2, background:i<step?"#e6821e":"#e0e0e0" }}/>}
            </div>
          ))}
        </div>

        <div style={{ padding:"1.25rem 1.5rem 1.5rem" }}>

          {step===0&&(
            <div style={{ textAlign:"center" }}>
              <div style={{ fontSize:56, marginBottom:12 }}>&#127881;</div>
              <div style={{ fontFamily:"Syne", fontSize:20, fontWeight:800, marginBottom:8 }}>Welcome to Car Care Connect!</div>
              <div style={{ fontSize:13, color:"#666", marginBottom:20, lineHeight:1.6 }}>Join Kenya fastest growing automotive platform. Setup takes just 2 minutes.</div>
              <div style={{ background:"#fff8f0", borderRadius:12, padding:"1rem", marginBottom:20, textAlign:"left" }}>
                {["Add your services and pricing","Set your location so customers find you","Add M-Pesa number to receive payments","Start receiving bookings from day one"].map((item,i)=>(
                  <div key={i} style={{ display:"flex", gap:8, fontSize:13, marginBottom:6 }}>
                    <span style={{ color:"#e6821e", fontWeight:700 }}>+</span>
                    <span style={{ color:"#555" }}>{item}</span>
                  </div>
                ))}
              </div>
              <button onClick={()=>setStep(1)} style={{ width:"100%", background:"#e6821e", border:"none", borderRadius:12, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:15, fontWeight:700, padding:"14px", cursor:"pointer" }}>
                Get started now
              </button>
            </div>
          )}

          {step===1&&(
            <div>
              <div style={{ fontFamily:"Syne", fontSize:18, fontWeight:800, marginBottom:4 }}>Your business profile</div>
              <div style={{ fontSize:13, color:"#888", marginBottom:"1.25rem" }}>Customers see this when they find your business.</div>
              <label style={{ fontSize:12, color:"#666", display:"block", marginBottom:4 }}>Business name</label>
              <input style={inp} placeholder="e.g. Nairobi Auto Care" value={form.business_name} onChange={e=>setForm(f=>({...f,business_name:e.target.value}))}/>
              <label style={{ fontSize:12, color:"#666", display:"block", marginBottom:4 }}>City</label>
              <input style={inp} placeholder="e.g. Nairobi" value={form.city} onChange={e=>setForm(f=>({...f,city:e.target.value}))}/>
              <div style={{ display:"flex", gap:8 }}>
                <button onClick={()=>setStep(2)} style={{ flex:1, background:"#f5f5f5", border:"none", borderRadius:10, color:"#555", fontSize:13, padding:"12px", cursor:"pointer" }}>Skip</button>
                <button onClick={saveProfile} disabled={saving||!form.business_name} style={{ flex:2, background:form.business_name?"#e6821e":"#ccc", border:"none", borderRadius:10, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:14, fontWeight:700, padding:"12px", cursor:form.business_name?"pointer":"not-allowed" }}>
                  {saving?"Saving...":"Save and continue"}
                </button>
              </div>
            </div>
          )}

          {step===2&&(
            <div>
              <div style={{ fontFamily:"Syne", fontSize:18, fontWeight:800, marginBottom:4 }}>Your location</div>
              <div style={{ fontSize:13, color:"#888", marginBottom:"1.25rem" }}>Help customers find your garage on the map.</div>
              <button onClick={detectLocation} style={{ width:"100%", background:"#eff6ff", border:"1px solid #378add40", borderRadius:10, color:"#378add", fontSize:14, fontWeight:600, padding:"11px", cursor:"pointer", marginBottom:12 }}>
                Detect my location automatically
              </button>
              {form.latitude&&<div style={{ fontSize:12, color:"#1d9e75", marginBottom:8 }}>Location detected: {form.latitude.toFixed(4)}, {form.longitude.toFixed(4)}</div>}
              <input style={inp} placeholder="Or enter address: e.g. Westlands, Nairobi" value={form.address} onChange={e=>setForm(f=>({...f,address:e.target.value}))}/>
              <div style={{ display:"flex", gap:8 }}>
                <button onClick={()=>setStep(3)} style={{ flex:1, background:"#f5f5f5", border:"none", borderRadius:10, color:"#555", fontSize:13, padding:"12px", cursor:"pointer" }}>Skip</button>
                <button onClick={saveLocation} disabled={saving} style={{ flex:2, background:"#e6821e", border:"none", borderRadius:10, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:14, fontWeight:700, padding:"12px", cursor:"pointer" }}>
                  {saving?"Saving...":"Save and continue"}
                </button>
              </div>
            </div>
          )}

          {step===3&&(
            <div>
              <div style={{ fontFamily:"Syne", fontSize:18, fontWeight:800, marginBottom:4 }}>M-Pesa number</div>
              <div style={{ fontSize:13, color:"#888", marginBottom:"1.25rem" }}>Where you receive payments from bookings.</div>
              <div style={{ background:"#fff8f0", border:"1px solid #e6821e30", borderRadius:10, padding:"1rem", marginBottom:"1rem", fontSize:13, color:"#555", lineHeight:1.6 }}>
                CCC automatically sends your share to this number when a customer completes payment. No manual withdrawal needed.
              </div>
              <input style={inp} type="tel" placeholder="07XX XXX XXX" value={form.mpesa_number} onChange={e=>setForm(f=>({...f,mpesa_number:e.target.value}))}/>
              <div style={{ display:"flex", gap:8 }}>
                
                <button onClick={saveMpesa} disabled={saving||!form.mpesa_number} style={{ flex:1, background:form.mpesa_number?"#e6821e":"#ccc", border:"none", borderRadius:10, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:14, fontWeight:700, padding:"12px", cursor:form.mpesa_number?"pointer":"not-allowed" }}>
                  {saving?"Saving...":"Save and continue"}
                </button>
              </div>
            </div>
          )}

          {step===4&&(
            <div style={{ textAlign:"center" }}>
              <div style={{ fontSize:56, marginBottom:12 }}>&#128640;</div>
              <div style={{ fontFamily:"Syne", fontSize:20, fontWeight:800, marginBottom:8 }}>You are all set!</div>
              <div style={{ fontSize:13, color:"#666", marginBottom:20, lineHeight:1.6 }}>Your business is now live. Customers in Nairobi can find and book your services.</div>
              <div style={{ background:"#f0fdf4", borderRadius:12, padding:"1rem", marginBottom:20, textAlign:"left" }}>
                {[
                  "Add your services from the Services section in your dashboard (requires admin approval)",
                  form.business_name ? "Business profile complete" : "Complete your profile for more visibility",
                  form.mpesa_number ? "M-Pesa number set" : "Add M-Pesa number to receive payments",
                  form.latitude ? "Location set" : "Set location to appear on map",
                ].map((item,i)=>(
                  <div key={i} style={{ fontSize:13, color:"#555", marginBottom:6 }}>{item}</div>
                ))}
              </div>
              <button onClick={onComplete} style={{ width:"100%", background:"#e6821e", border:"none", borderRadius:12, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:15, fontWeight:700, padding:"14px", cursor:"pointer" }}>
                Go to my dashboard
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
