import { useState } from "react"
import { supabase } from "../../lib/supabase"
import { useAuth } from "../../contexts/AuthContext"
import toast from "react-hot-toast"

const STEPS = [
  { id:"welcome", title:"Welcome to CCC!" },
  { id:"profile", title:"Your profile" },
  { id:"vehicle", title:"Your vehicle" },
  { id:"done", title:"All set!" },
]

export default function CustomerOnboarding({ onComplete }) {
  const { user, profile } = useAuth()
  const [step, setStep] = useState(0)
  const [form, setForm] = useState({ city:profile?.city||"", phone:"" })
  const [vehicle, setVehicle] = useState({ make:"", model:"", year:"", color:"", license_plate:"" })
  const [saving, setSaving] = useState(false)
  const [savingVehicle, setSavingVehicle] = useState(false)

  const inp = { width:"100%", padding:"12px 14px", borderRadius:10, border:"1px solid #e0e0e0", fontSize:14, outline:"none", marginBottom:12, boxSizing:"border-box", fontFamily:"DM Sans,sans-serif" }

  async function saveProfile() {
    setSaving(true)
    try {
      await supabase.from("profiles").update({ city:form.city }).eq("id", user.id)
      if(form.phone) await supabase.from("profile_sensitive").upsert({ id:user.id, phone:form.phone })
      toast.success("Profile saved!")
      setStep(s=>s+1)
    } catch(e) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  async function saveVehicle() {
    if(!vehicle.make||!vehicle.model) return toast.error("Make and model required")
    setSavingVehicle(true)
    try {
      await supabase.from("vehicles").insert({ customer_id:user.id, ...vehicle, year:Number(vehicle.year)||null })
      await supabase.from("profiles").update({ onboarding_complete:true }).eq("id", user.id)
      toast.success("Vehicle added!")
      setStep(s=>s+1)
    } catch(e) { toast.error(e.message) }
    finally { setSavingVehicle(false) }
  }

  async function skipToEnd() {
    await supabase.from("profiles").update({ onboarding_complete:true }).eq("id", user.id)
    setStep(3)
  }

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:"1rem" }}>
      <div style={{ background:"#fff", borderRadius:20, width:"100%", maxWidth:460, maxHeight:"90vh", overflow:"auto" }}>
        <div style={{ height:4, background:"#f0f0f0", borderRadius:"20px 20px 0 0" }}>
          <div style={{ height:"100%", background:"#e6821e", width:((step/3)*100)+"%", transition:"width 0.3s", borderRadius:20 }}/>
        </div>
        <div style={{ display:"flex", gap:6, padding:"1rem 1.5rem 0" }}>
          {STEPS.map((s,i)=>(
            <div key={s.id} style={{ display:"flex", alignItems:"center", gap:4, flexShrink:0 }}>
              <div style={{ width:26, height:26, borderRadius:"50%", background:i<step?"#e6821e":i===step?"#fff8f0":"#f0f0f0", border:"2px solid "+(i<=step?"#e6821e":"#e0e0e0"), display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:700, color:i<step?"#fff":i===step?"#e6821e":"#aaa" }}>
                {i<step?"v":i+1}
              </div>
              {i<STEPS.length-1&&<div style={{ width:14, height:2, background:i<step?"#e6821e":"#e0e0e0" }}/>}
            </div>
          ))}
        </div>
        <div style={{ padding:"1.25rem 1.5rem 1.5rem" }}>

          {step===0&&(
            <div style={{ textAlign:"center" }}>
              <div style={{ fontSize:56, marginBottom:12 }}>&#127911;</div>
              <div style={{ fontFamily:"Syne", fontSize:20, fontWeight:800, marginBottom:8 }}>Welcome to Car Care Connect!</div>
              <div style={{ fontSize:13, color:"#666", marginBottom:20, lineHeight:1.6 }}>Book trusted mechanics, buy car parts, and get emergency roadside help — all in one app.</div>
              <div style={{ background:"#fff8f0", borderRadius:12, padding:"1rem", marginBottom:20, textAlign:"left" }}>
                {["Book mechanics and garages near you","Emergency GO Service — mechanic comes to you","Buy genuine parts from verified dealers","Track your service history"].map((item,i)=>(
                  <div key={i} style={{ display:"flex", gap:8, fontSize:13, marginBottom:6 }}>
                    <span style={{ color:"#e6821e", fontWeight:700 }}>+</span>
                    <span style={{ color:"#555" }}>{item}</span>
                  </div>
                ))}
              </div>
              <button onClick={()=>setStep(1)} style={{ width:"100%", background:"#e6821e", border:"none", borderRadius:12, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:15, fontWeight:700, padding:"14px", cursor:"pointer" }}>
                Get started
              </button>
            </div>
          )}

          {step===1&&(
            <div>
              <div style={{ fontFamily:"Syne", fontSize:18, fontWeight:800, marginBottom:4 }}>Your profile</div>
              <div style={{ fontSize:13, color:"#888", marginBottom:"1.25rem" }}>Helps us show you relevant services near you.</div>
              <label style={{ fontSize:12, color:"#666", display:"block", marginBottom:4 }}>Your city</label>
              <input style={inp} placeholder="e.g. Nairobi" value={form.city} onChange={e=>setForm(f=>({...f,city:e.target.value}))}/>
              <label style={{ fontSize:12, color:"#666", display:"block", marginBottom:4 }}>Phone number (optional)</label>
              <input style={inp} type="tel" placeholder="07XX XXX XXX" value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))}/>
              <div style={{ display:"flex", gap:8 }}>
                <button onClick={()=>setStep(2)} style={{ flex:1, background:"#f5f5f5", border:"none", borderRadius:10, color:"#555", fontSize:13, padding:"12px", cursor:"pointer" }}>Skip</button>
                <button onClick={saveProfile} disabled={saving} style={{ flex:2, background:"#e6821e", border:"none", borderRadius:10, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:14, fontWeight:700, padding:"12px", cursor:"pointer" }}>
                  {saving?"Saving...":"Save and continue"}
                </button>
              </div>
            </div>
          )}

          {step===2&&(
            <div>
              <div style={{ fontFamily:"Syne", fontSize:18, fontWeight:800, marginBottom:4 }}>Your vehicle</div>
              <div style={{ fontSize:13, color:"#888", marginBottom:"1.25rem" }}>Providers need to know your car to prepare the right parts and tools.</div>
              <input style={inp} placeholder="Make (e.g. Toyota)" value={vehicle.make} onChange={e=>setVehicle(v=>({...v,make:e.target.value}))}/>
              <input style={inp} placeholder="Model (e.g. Fielder)" value={vehicle.model} onChange={e=>setVehicle(v=>({...v,model:e.target.value}))}/>
              <div style={{ display:"flex", gap:8 }}>
                <input style={{...inp, flex:1, marginBottom:0}} placeholder="Year (e.g. 2019)" value={vehicle.year} onChange={e=>setVehicle(v=>({...v,year:e.target.value}))}/>
                <input style={{...inp, flex:1, marginBottom:0}} placeholder="Color" value={vehicle.color} onChange={e=>setVehicle(v=>({...v,color:e.target.value}))}/>
              </div>
              <div style={{ height:12 }}/>
              <input style={inp} placeholder="Number plate (e.g. KDA 123A)" value={vehicle.license_plate} onChange={e=>setVehicle(v=>({...v,license_plate:e.target.value}))}/>
              <div style={{ display:"flex", gap:8 }}>
                <button onClick={skipToEnd} style={{ flex:1, background:"#f5f5f5", border:"none", borderRadius:10, color:"#555", fontSize:13, padding:"12px", cursor:"pointer" }}>Skip</button>
                <button onClick={saveVehicle} disabled={savingVehicle||!vehicle.make||!vehicle.model} style={{ flex:2, background:vehicle.make&&vehicle.model?"#e6821e":"#ccc", border:"none", borderRadius:10, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:14, fontWeight:700, padding:"12px", cursor:vehicle.make&&vehicle.model?"pointer":"not-allowed" }}>
                  {savingVehicle?"Saving...":"Save and continue"}
                </button>
              </div>
            </div>
          )}

          {step===3&&(
            <div style={{ textAlign:"center" }}>
              <div style={{ fontSize:56, marginBottom:12 }}>&#128640;</div>
              <div style={{ fontFamily:"Syne", fontSize:20, fontWeight:800, marginBottom:8 }}>You are ready!</div>
              <div style={{ fontSize:13, color:"#666", marginBottom:20, lineHeight:1.6 }}>Start exploring mechanics, parts and emergency services near you.</div>
              <button onClick={onComplete} style={{ width:"100%", background:"#e6821e", border:"none", borderRadius:12, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:15, fontWeight:700, padding:"14px", cursor:"pointer" }}>
                Explore Car Care Connect
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
