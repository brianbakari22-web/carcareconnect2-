import { useState } from "react"
import { supabase } from "../../lib/supabase"
import { useAuth } from "../../contexts/AuthContext"
import toast from "react-hot-toast"

const STEPS = [
  { id:"welcome", title:"Welcome!" },
  { id:"profile", title:"Your profile" },
  { id:"vehicle", title:"Your vehicle" },
  { id:"documents", title:"Documents" },
  { id:"mpesa", title:"M-Pesa" },
  { id:"done", title:"All set!" },
]

export default function DriverOnboarding({ onComplete }) {
  const { user, profile } = useAuth()
  const isConcierge = profile?.driver_category === "concierge"
  
  // For concierge drivers skip vehicle step
  const steps = isConcierge 
    ? STEPS.filter(s => s.id !== "vehicle")
    : STEPS
  
  const [step, setStep] = useState(0)
  const [form, setForm] = useState({ city:profile?.city||"", phone:"", id_number:"", license_number:"", mpesa_number:"" })
  const [vehicle, setVehicle] = useState({ make:"", model:"", year:"", color:"", license_plate:"" })
  const [saving, setSaving] = useState(false)

  const inp = { width:"100%", padding:"12px 14px", borderRadius:10, border:"1px solid #e0e0e0", fontSize:14, outline:"none", marginBottom:12, boxSizing:"border-box", fontFamily:"DM Sans,sans-serif" }
  const totalSteps = steps.length - 1

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
    setSaving(true)
    try {
      await supabase.from("driver_vehicles").upsert({ driver_id:user.id, ...vehicle, year:Number(vehicle.year)||null })
      toast.success("Vehicle saved!")
      setStep(s=>s+1)
    } catch(e) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  async function saveDocuments() {
    setSaving(true)
    try {
      await supabase.from("profile_sensitive").upsert({ id:user.id, id_number:form.id_number, drivers_license:form.license_number })
      toast.success("Documents saved!")
      setStep(s=>s+1)
    } catch(e) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  async function saveMpesa() {
    setSaving(true)
    try {
      await supabase.from("profile_sensitive").upsert({ id:user.id, mpesa_number:form.mpesa_number })
      await supabase.from("profiles").update({ onboarding_complete:true }).eq("id", user.id)
      toast.success("M-Pesa saved!")
      setStep(s=>s+1)
    } catch(e) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  // Get current step id
  const currentStepId = steps[step]?.id

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:"1rem" }}>
      <div style={{ background:"#fff", borderRadius:20, width:"100%", maxWidth:460, maxHeight:"90vh", overflow:"auto" }}>
        <div style={{ height:4, background:"#f0f0f0", borderRadius:"20px 20px 0 0" }}>
          <div style={{ height:"100%", background:"#1d9e75", width:((step/totalSteps)*100)+"%", transition:"width 0.3s", borderRadius:20 }}/>
        </div>
        <div style={{ display:"flex", gap:6, padding:"1rem 1.5rem 0" }}>
          {steps.map((s,i)=>(
            <div key={s.id} style={{ display:"flex", alignItems:"center", gap:4, flexShrink:0 }}>
              <div style={{ width:26, height:26, borderRadius:"50%", background:i<step?"#1d9e75":i===step?"#f0fdf4":"#f0f0f0", border:"2px solid "+(i<=step?"#1d9e75":"#e0e0e0"), display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:700, color:i<step?"#fff":i===step?"#1d9e75":"#aaa" }}>
                {i<step?"v":i+1}
              </div>
              {i<steps.length-1&&<div style={{ width:14, height:2, background:i<step?"#1d9e75":"#e0e0e0" }}/>}
            </div>
          ))}
        </div>
        <div style={{ padding:"1.25rem 1.5rem 1.5rem" }}>

          {currentStepId==="welcome"&&(
            <div style={{ textAlign:"center" }}>
              <div style={{ fontSize:56, marginBottom:12 }}>&#128663;</div>
              <div style={{ fontFamily:"Syne", fontSize:20, fontWeight:800, marginBottom:8 }}>Welcome, {isConcierge?"Concierge Driver":"Driver"}!</div>
              <div style={{ fontSize:13, color:"#666", marginBottom:20, lineHeight:1.6 }}>
                {isConcierge 
                  ? "You will be driving customers cars to garages and back. No vehicle of your own needed."
                  : "Earn by delivering vehicles and parts across Nairobi. Set your own schedule."}
              </div>
              <div style={{ background:"#f0fdf4", borderRadius:12, padding:"1rem", marginBottom:20, textAlign:"left" }}>
                {(isConcierge 
                  ? ["Pick up customer cars and deliver to garages","Earn per trip — paid directly to M-Pesa","Flexible hours — work when you want","Track all your trips and earnings"]
                  : ["Deliver vehicles and parts across Nairobi","Earn per delivery — paid directly to M-Pesa","Flexible hours — work when you want","Track all your trips and earnings"]
                ).map((item,i)=>(
                  <div key={i} style={{ display:"flex", gap:8, fontSize:13, marginBottom:6 }}>
                    <span style={{ color:"#1d9e75", fontWeight:700 }}>+</span>
                    <span style={{ color:"#555" }}>{item}</span>
                  </div>
                ))}
              </div>
              <button onClick={()=>setStep(1)} style={{ width:"100%", background:"#1d9e75", border:"none", borderRadius:12, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:15, fontWeight:700, padding:"14px", cursor:"pointer" }}>
                Get started
              </button>
            </div>
          )}

          {currentStepId==="profile"&&(
            <div>
              <div style={{ fontFamily:"Syne", fontSize:18, fontWeight:800, marginBottom:4 }}>Your profile</div>
              <div style={{ fontSize:13, color:"#888", marginBottom:"1.25rem" }}>Basic info to get you started.</div>
              <label style={{ fontSize:12, color:"#666", display:"block", marginBottom:4 }}>Your city</label>
              <input style={inp} placeholder="e.g. Nairobi" value={form.city} onChange={e=>setForm(f=>({...f,city:e.target.value}))}/>
              <label style={{ fontSize:12, color:"#666", display:"block", marginBottom:4 }}>Phone number</label>
              <input style={inp} type="tel" placeholder="07XX XXX XXX" value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))}/>
              <div style={{ display:"flex", gap:8 }}>
                <button onClick={()=>setStep(s=>s+1)} style={{ flex:1, background:"#f5f5f5", border:"none", borderRadius:10, color:"#555", fontSize:13, padding:"12px", cursor:"pointer" }}>Skip</button>
                <button onClick={saveProfile} disabled={saving} style={{ flex:2, background:"#1d9e75", border:"none", borderRadius:10, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:14, fontWeight:700, padding:"12px", cursor:"pointer" }}>
                  {saving?"Saving...":"Save and continue"}
                </button>
              </div>
            </div>
          )}

          {currentStepId==="vehicle"&&(
            <div>
              <div style={{ fontFamily:"Syne", fontSize:18, fontWeight:800, marginBottom:4 }}>Your vehicle</div>
              <div style={{ fontSize:13, color:"#888", marginBottom:"1.25rem" }}>The vehicle you use for deliveries.</div>
              <input style={inp} placeholder="Make (e.g. Toyota)" value={vehicle.make} onChange={e=>setVehicle(v=>({...v,make:e.target.value}))}/>
              <input style={inp} placeholder="Model (e.g. Fielder)" value={vehicle.model} onChange={e=>setVehicle(v=>({...v,model:e.target.value}))}/>
              <div style={{ display:"flex", gap:8 }}>
                <input style={{...inp,flex:1,marginBottom:0}} placeholder="Year" value={vehicle.year} onChange={e=>setVehicle(v=>({...v,year:e.target.value}))}/>
                <input style={{...inp,flex:1,marginBottom:0}} placeholder="Color" value={vehicle.color} onChange={e=>setVehicle(v=>({...v,color:e.target.value}))}/>
              </div>
              <div style={{ height:12 }}/>
              <input style={inp} placeholder="Number plate (e.g. KDA 123A)" value={vehicle.license_plate} onChange={e=>setVehicle(v=>({...v,license_plate:e.target.value}))}/>
              <div style={{ display:"flex", gap:8 }}>
                <button onClick={()=>setStep(s=>s+1)} style={{ flex:1, background:"#f5f5f5", border:"none", borderRadius:10, color:"#555", fontSize:13, padding:"12px", cursor:"pointer" }}>Skip</button>
                <button onClick={saveVehicle} disabled={saving} style={{ flex:2, background:"#1d9e75", border:"none", borderRadius:10, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:14, fontWeight:700, padding:"12px", cursor:"pointer" }}>
                  {saving?"Saving...":"Save and continue"}
                </button>
              </div>
            </div>
          )}

          {currentStepId==="documents"&&(
            <div>
              <div style={{ fontFamily:"Syne", fontSize:18, fontWeight:800, marginBottom:4 }}>Your documents</div>
              <div style={{ fontSize:13, color:"#888", marginBottom:"1.25rem" }}>Required for verification. Your info is kept private and secure.</div>
              <label style={{ fontSize:12, color:"#666", display:"block", marginBottom:4 }}>National ID number</label>
              <input style={inp} placeholder="e.g. 12345678" value={form.id_number} onChange={e=>setForm(f=>({...f,id_number:e.target.value}))}/>
              <label style={{ fontSize:12, color:"#666", display:"block", marginBottom:4 }}>Driver license number</label>
              <input style={inp} placeholder="e.g. DL123456" value={form.license_number} onChange={e=>setForm(f=>({...f,license_number:e.target.value}))}/>
              <div style={{ background:"#eff6ff", borderRadius:10, padding:"10px 12px", fontSize:12, color:"#378add", marginBottom:12 }}>
                Your documents are encrypted and only used for identity verification by CCC admin.
              </div>
              <div style={{ display:"flex", gap:8 }}>
                <button onClick={()=>setStep(s=>s+1)} style={{ flex:1, background:"#f5f5f5", border:"none", borderRadius:10, color:"#555", fontSize:13, padding:"12px", cursor:"pointer" }}>Skip</button>
                <button onClick={saveDocuments} disabled={saving} style={{ flex:2, background:"#1d9e75", border:"none", borderRadius:10, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:14, fontWeight:700, padding:"12px", cursor:"pointer" }}>
                  {saving?"Saving...":"Save and continue"}
                </button>
              </div>
            </div>
          )}

          {currentStepId==="mpesa"&&(
            <div>
              <div style={{ fontFamily:"Syne", fontSize:18, fontWeight:800, marginBottom:4 }}>M-Pesa number</div>
              <div style={{ fontSize:13, color:"#888", marginBottom:"1.25rem" }}>Where you receive your trip earnings.</div>
              <div style={{ background:"#f0fdf4", border:"1px solid #1d9e7530", borderRadius:10, padding:"1rem", marginBottom:"1rem", fontSize:13, color:"#555", lineHeight:1.6 }}>
                CCC sends your earnings directly to this M-Pesa number after each completed trip.
              </div>
              <input style={inp} type="tel" placeholder="07XX XXX XXX" value={form.mpesa_number} onChange={e=>setForm(f=>({...f,mpesa_number:e.target.value}))}/>
              <div style={{ display:"flex", gap:8 }}>
                <button onClick={()=>setStep(s=>s+1)} style={{ flex:1, background:"#f5f5f5", border:"none", borderRadius:10, color:"#555", fontSize:13, padding:"12px", cursor:"pointer" }}>Skip</button>
                <button onClick={saveMpesa} disabled={saving||!form.mpesa_number} style={{ flex:2, background:form.mpesa_number?"#1d9e75":"#ccc", border:"none", borderRadius:10, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:14, fontWeight:700, padding:"12px", cursor:form.mpesa_number?"pointer":"not-allowed" }}>
                  {saving?"Saving...":"Save and continue"}
                </button>
              </div>
            </div>
          )}

          {currentStepId==="done"&&(
            <div style={{ textAlign:"center" }}>
              <div style={{ fontSize:56, marginBottom:12 }}>&#9989;</div>
              <div style={{ fontFamily:"Syne", fontSize:20, fontWeight:800, marginBottom:8 }}>You are all set!</div>
              <div style={{ fontSize:13, color:"#666", marginBottom:20, lineHeight:1.6 }}>
                Your profile is complete. An admin will verify your account before you can start receiving trips.
              </div>
              <div style={{ background:"#f0fdf4", borderRadius:12, padding:"1rem", marginBottom:20, fontSize:13, color:"#555", textAlign:"left" }}>
                <div style={{ marginBottom:6 }}>What happens next:</div>
                <div style={{ display:"flex", gap:8, marginBottom:4 }}><span style={{ color:"#1d9e75" }}>1.</span> Admin reviews your documents</div>
                <div style={{ display:"flex", gap:8, marginBottom:4 }}><span style={{ color:"#1d9e75" }}>2.</span> You receive approval notification</div>
                <div style={{ display:"flex", gap:8 }}><span style={{ color:"#1d9e75" }}>3.</span> Start receiving trip requests</div>
              </div>
              <button onClick={onComplete} style={{ width:"100%", background:"#1d9e75", border:"none", borderRadius:12, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:15, fontWeight:700, padding:"14px", cursor:"pointer" }}>
                Go to my dashboard
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
