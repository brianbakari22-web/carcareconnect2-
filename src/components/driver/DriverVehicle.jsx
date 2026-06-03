import useIsMobile from "../../lib/useIsMobile"
import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"
import { useAuth } from "../../contexts/AuthContext"
import toast from "react-hot-toast"

export default function DriverVehicle() {
  const isMobile = useIsMobile()
  const { user, profile, updateProfile } = useAuth()
  const [docs, setDocs] = useState([])
  const [form, setForm] = useState({ vehicle_model:"", vehicle_color:"", vehicle_plate:"", vehicle_year:"" })
  const [saving, setSaving] = useState(false)
  const [docForm, setDocForm] = useState({ type:"license", expiry_date:"" })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (profile) setForm({ vehicle_model:profile.vehicle_model||"", vehicle_color:profile.vehicle_color||"", vehicle_plate:profile.vehicle_plate||"", vehicle_year:profile.vehicle_year||"" })
    if (user) loadDocs()
  }, [profile, user])

  async function loadDocs() {
    const { data } = await supabase.from("driver_documents").select("*").eq("driver_id", user.id).order("created_at",{ascending:false})
    setDocs(data||[])
    setLoading(false)
  }

  async function saveVehicle(e) {
    e.preventDefault()
    setSaving(true)
    try {
      await updateProfile({ vehicle_model:form.vehicle_model, vehicle_color:form.vehicle_color, vehicle_plate:form.vehicle_plate, vehicle_year:parseInt(form.vehicle_year)||null })
      toast.success("Vehicle info updated")
    } catch(err) { toast.error(err.message) }
    finally { setSaving(false) }
  }

  async function addDocument(e) {
    e.preventDefault()
    const { error } = await supabase.from("driver_documents").insert({ driver_id:user.id, type:docForm.type, expiry_date:docForm.expiry_date||null })
    if (error) return toast.error(error.message)
    toast.success("Document added")
    setDocForm({ type:"license", expiry_date:"" })
    loadDocs()
  }

  async function deleteDoc(id) {
    if (!confirm("Remove this document?")) return
    await supabase.from("driver_documents").delete().eq("id",id).eq("driver_id",user.id)
    toast.success("Document removed")
    loadDocs()
  }

  const inp = { width:"100%", background:"#111", border:"1px solid #222", borderRadius:8, padding:"10px 12px", color:"#f0ede6", fontSize:13, outline:"none", fontFamily:"'DM Sans',sans-serif", marginBottom:10 }
  const lbl = { fontSize:11, color:"#666", textTransform:"uppercase", letterSpacing:"0.05em", display:"block", marginBottom:4 }
  const docTypeColor = { license:"#e6821e", insurance:"#1d9e75", registration:"#378add", other:"#888" }

  const isExpiringSoon = (date) => {
    if (!date) return false
    const diff = new Date(date) - new Date()
    return diff > 0 && diff < 30*24*60*60*1000
  }

  const isExpired = (date) => {
    if (!date) return false
    return new Date(date) < new Date()
  }

  return (
    <div>
      <div style={{ background:"#111", border:"1px solid #1e1e1e", borderRadius:12, padding:"1.25rem", marginBottom:"1.5rem" }}>
        <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:700, marginBottom:"1rem", color:"#f0ede6" }}>Vehicle information</div>
        <form onSubmit={saveVehicle}>
          <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:10 }}>
            <div><label style={lbl}>Model</label><input style={inp} placeholder="e.g. Toyota Fielder" value={form.vehicle_model} onChange={e=>setForm(f=>({...f,vehicle_model:e.target.value}))}/></div>
            <div><label style={lbl}>Color</label><input style={inp} placeholder="e.g. White" value={form.vehicle_color} onChange={e=>setForm(f=>({...f,vehicle_color:e.target.value}))}/></div>
            <div><label style={lbl}>License plate</label><input style={inp} placeholder="e.g. KDA 123A" value={form.vehicle_plate} onChange={e=>setForm(f=>({...f,vehicle_plate:e.target.value}))}/></div>
            <div><label style={lbl}>Year</label><input style={inp} type="number" min="1990" max="2026" placeholder="2020" value={form.vehicle_year} onChange={e=>setForm(f=>({...f,vehicle_year:e.target.value}))}/></div>
          </div>
          <button type="submit" disabled={saving}
            style={{ background:saving?"#333":"#e6821e", border:"none", borderRadius:8, color:saving?"#666":"#fff", fontFamily:"Syne,sans-serif", fontSize:13, fontWeight:700, padding:"10px 20px", cursor:saving?"not-allowed":"pointer" }}>
            {saving?"Saving...":"Save vehicle info"}
          </button>
        </form>
      </div>

      <div style={{ background:"#111", border:"1px solid #1e1e1e", borderRadius:12, padding:"1.25rem" }}>
        <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:700, marginBottom:"1rem", color:"#f0ede6" }}>Documents</div>
        {loading&&<div style={{ color:"#555", fontSize:13 }}>Loading...</div>}
        {docs.map(d=>(
          <div key={d.id} style={{ display:"flex", alignItems:"center", gap:12, padding:"0.75rem", background:"#0f0f0f", borderRadius:8, marginBottom:8, border:`1px solid ${isExpired(d.expiry_date)?"#e24b4a40":isExpiringSoon(d.expiry_date)?"#e6821e40":"#222"}` }}>
            <div style={{ width:36, height:36, background:`${docTypeColor[d.type]}20`, borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0 }}>
              {d.type==="license"?"🪪":d.type==="insurance"?"🛡️":d.type==="registration"?"📄":"📎"}
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:13, fontWeight:500, color:"#f0ede6", textTransform:"capitalize" }}>{d.type}</div>
              {d.expiry_date&&(
                <div style={{ fontSize:11, color:isExpired(d.expiry_date)?"#e24b4a":isExpiringSoon(d.expiry_date)?"#e6821e":"#555", marginTop:2 }}>
                  {isExpired(d.expiry_date)?"Expired":"Expires"}: {new Date(d.expiry_date).toLocaleDateString()}
                  {isExpiringSoon(d.expiry_date)&&" ⚠️"}
                </div>
              )}
              {d.is_verified&&<div style={{ fontSize:10, color:"#1d9e75", marginTop:2 }}>✓ Verified</div>}
            </div>
            <button onClick={()=>deleteDoc(d.id)} style={{ background:"none", border:"1px solid #e24b4a40", borderRadius:6, color:"#e24b4a", fontSize:11, padding:"4px 8px", cursor:"pointer" }}>Remove</button>
          </div>
        ))}

        <div style={{ marginTop:"1rem", paddingTop:"1rem", borderTop:"1px solid #1e1e1e" }}>
          <div style={{ fontFamily:"Syne", fontSize:13, fontWeight:700, marginBottom:"0.75rem", color:"#f0ede6" }}>Add document</div>
          <form onSubmit={addDocument}>
            <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:10 }}>
              <div>
                <label style={lbl}>Document type</label>
                <select style={inp} value={docForm.type} onChange={e=>setDocForm(f=>({...f,type:e.target.value}))}>
                  <option value="license">Driver license</option>
                  <option value="insurance">Insurance</option>
                  <option value="registration">Vehicle registration</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label style={lbl}>Expiry date</label>
                <input style={inp} type="date" value={docForm.expiry_date} onChange={e=>setDocForm(f=>({...f,expiry_date:e.target.value}))}/>
              </div>
            </div>
            <button type="submit"
              style={{ background:"#e6821e", border:"none", borderRadius:8, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:13, fontWeight:700, padding:"10px 20px", cursor:"pointer" }}>
              Add document
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}



