import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"
import { useAuth } from "../../contexts/AuthContext"
import toast from "react-hot-toast"
import { validateFile } from "../../lib/uploadValidation"
import ChatWindow from "../shared/ChatWindow"

const SPECIALIZATIONS = [
  "General Mechanic","Engine Specialist","Electrical Systems","Brake Specialist",
  "Transmission Specialist","Tire & Wheel Specialist","Body & Paint",
  "AC & Cooling Systems","Suspension & Steering","Diagnostics Specialist",
  "Emergency Roadside","Mobile Mechanic","Diagnostics & Tuning","Fuel Systems"
]

export default function ProviderMechanics() {
  const { user } = useAuth()
  const [mechanics, setMechanics] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [expanded, setExpanded] = useState(null)
  const [pinPanel, setPinPanel] = useState(null)
  const [docsPanel, setDocsPanel] = useState(null)
  const [chatPanel, setChatPanel] = useState(null)
  const [commPanel, setCommPanel] = useState(null)
  const [commForm, setCommForm] = useState({ rate:"15", type:"percentage" })
  const [mechanicDocs, setMechanicDocs] = useState({})
  const [pin, setPin] = useState("")
  const [settingPin, setSettingPin] = useState(false)
  const [form, setForm] = useState({ first_name:"", last_name:"", phone:"", email:"", specialization:"General Mechanic", commission_rate:"15", commission_type:"percentage" })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => { if (user) load() }, [user])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from("mechanics")
      .select("*, profiles!mechanics_provider_id_fkey(business_name)")
      .eq("provider_id", user.id)
      .order("created_at", { ascending: false })
    setMechanics(data||[])
    setLoading(false)
  }

  async function loadDocs(mechanicId) {
    const { data } = await supabase.from("driver_documents")
      .select("*").eq("driver_id", mechanicId)
    setMechanicDocs(prev => ({...prev, [mechanicId]: data||[]}))
    setDocsPanel(docsPanel===mechanicId?null:mechanicId)
  }

  async function addMechanic() {
    if (!form.first_name.trim()||!form.phone.trim()) return toast.error("Name and phone required")
    setSubmitting(true)
    try {
      // Create real auth account + profile via Edge Function (profiles.id requires a genuine auth.users row)
      const accountRes = await fetch("https://gcnefnqtjxtqbhynyoxe.supabase.co/functions/v1/create-mechanic-account", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdjbmVmbnF0anh0cWJoeW55b3hlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2MDg0MzIsImV4cCI6MjA5NTE4NDQzMn0.Ybyce3psBj2I-hdoF95H5UAklr6hsgQi-mciI9uMIgc" },
        body: JSON.stringify({
          first_name: form.first_name,
          last_name: form.last_name,
          phone: form.phone,
          email: form.email||null,
          provider_id: user.id,
        })
      })
      const accountData = await accountRes.json()
      if (!accountData.success) throw new Error(accountData.error || "Failed to create mechanic account")

      // Create mechanic record, linked to the real profile via user_id
      const { error: mechError } = await supabase.from("mechanics").insert({
        provider_id: user.id,
        user_id: accountData.user_id,
        first_name: form.first_name,
        last_name: form.last_name,
        phone: form.phone,
        specialization: form.specialization,
        commission_rate: form.commission_type==="percentage" ? (parseFloat(form.commission_rate)||15)/100 : parseFloat(form.commission_rate)||500,
        commission_type: form.commission_type||"percentage",
        is_active: true,
        is_available: true,
      })
      if (mechError) throw mechError

      toast.success("Mechanic added! Set their PIN so they can login.")
      setForm({ first_name:"", last_name:"", phone:"", email:"", specialization:"General Mechanic", commission_rate:"15", commission_type:"percentage" })
      setShowAdd(false)
      load()
    } catch(err) { toast.error(err.message) }
    finally { setSubmitting(false) }
  }

  async function toggleActive(m) {
    await supabase.from("mechanics").update({ is_active: !m.is_active }).eq("id", m.id)
    toast.success(m.is_active?"Mechanic deactivated":"Mechanic activated")
    load()
  }

  async function toggleAvailable(m) {
    await supabase.from("mechanics").update({ is_available: !m.is_available }).eq("id", m.id)
    load()
  }

  async function updateCommission(mechanicId) {
    const { error } = await supabase.from("mechanics").update({
      commission_rate: commForm.type==="percentage" ? (parseFloat(commForm.rate)||15)/100 : parseFloat(commForm.rate)||500,
      commission_type: commForm.type
    }).eq("id", mechanicId)
    if (error) return toast.error(error.message)
    toast.success("Pay structure updated!")
    setCommPanel(null)
    load()
  }

  async function setMechanicPin(mechanicId) {
    if (!pin||pin.length<4) return toast.error("PIN must be at least 4 digits")
    setSettingPin(true)
    try {
      const { error } = await supabase.rpc("set_mechanic_pin", { p_mechanic_id: mechanicId, p_pin: pin })
      if (error) throw error
      toast.success("PIN set! Mechanic can now login at carcareconnect.care/mechanic-login")
      setPinPanel(null)
      setPin("")
      load()
    } catch(err) { toast.error(err.message) }
    finally { setSettingPin(false) }
  }

  const DOC_TYPES = [
    { type:"national_id_front", label:"National ID (Front)" },
    { type:"national_id_back", label:"National ID (Back)" },
    { type:"driving_license", label:"Driver License" },
    { type:"good_conduct", label:"Good Conduct" },
    { type:"medical_certificate", label:"Medical Certificate" },
  ]

  if (loading) return (
    <div style={{ textAlign:"center", padding:"3rem", color:"#888", fontFamily:"DM Sans,sans-serif" }}>
      Loading mechanics...
    </div>
  )

  return (
    <div style={{ fontFamily:"DM Sans,sans-serif", maxWidth:600, margin:"0 auto", padding:"1rem" }}>

      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"1rem" }}>
        <div>
          <div style={{ fontFamily:"Syne", fontSize:18, fontWeight:800, color:"#000" }}>👨‍🔧 Mechanics</div>
          <div style={{ fontSize:12, color:"#888" }}>{mechanics.length} mechanic{mechanics.length!==1?"s":""} in your garage</div>
        </div>
        <button onClick={()=>setShowAdd(!showAdd)}
          style={{ background:"#1d9e75", border:"none", borderRadius:10, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:13, fontWeight:700, padding:"8px 16px", cursor:"pointer" }}>
          {showAdd?"Cancel":"+ Add Mechanic"}
        </button>
      </div>

      {/* Add mechanic form */}
      {showAdd&&(
        <div style={{ background:"#ffffff", border:"1px solid #1d9e7520", borderRadius:14, padding:"1.25rem", marginBottom:"1rem" }}>
          <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:800, color:"#1d9e75", marginBottom:"1rem" }}>New Mechanic</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:10 }}>
            <div>
              <div style={{ fontSize:11, color:"#555", marginBottom:4, fontWeight:600 }}>First name *</div>
              <input value={form.first_name} onChange={e=>setForm(f=>({...f,first_name:e.target.value}))}
                placeholder="John" style={{ width:"100%", background:"#f8f8f8", border:"1px solid #eeeeee", borderRadius:8, padding:"9px 12px", fontSize:13, color:"#000", outline:"none", boxSizing:"border-box" }}/>
            </div>
            <div>
              <div style={{ fontSize:11, color:"#555", marginBottom:4, fontWeight:600 }}>Last name</div>
              <input value={form.last_name} onChange={e=>setForm(f=>({...f,last_name:e.target.value}))}
                placeholder="Doe" style={{ width:"100%", background:"#f8f8f8", border:"1px solid #eeeeee", borderRadius:8, padding:"9px 12px", fontSize:13, color:"#000", outline:"none", boxSizing:"border-box" }}/>
            </div>
          </div>
          <div style={{ marginBottom:10 }}>
            <div style={{ fontSize:11, color:"#555", marginBottom:4, fontWeight:600 }}>Phone number *</div>
            <input value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))}
              placeholder="0712 345 678" style={{ width:"100%", background:"#f8f8f8", border:"1px solid #eeeeee", borderRadius:8, padding:"9px 12px", fontSize:13, color:"#000", outline:"none", boxSizing:"border-box" }}/>
          </div>
          <div style={{ marginBottom:10 }}>
            <div style={{ fontSize:11, color:"#555", marginBottom:4, fontWeight:600 }}>Specialization</div>
            <select value={form.specialization} onChange={e=>setForm(f=>({...f,specialization:e.target.value}))}
              style={{ width:"100%", background:"#f8f8f8", border:"1px solid #eeeeee", borderRadius:8, padding:"9px 12px", fontSize:13, color:"#000", outline:"none", boxSizing:"border-box" }}>
              {SPECIALIZATIONS.map(s=><option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div style={{ marginBottom:"1rem" }}>
            <div style={{ fontSize:11, color:"#555", marginBottom:6, fontWeight:600 }}>Pay structure (your agreement with mechanic)</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
              <div>
                <div style={{ fontSize:10, color:"#888", marginBottom:3 }}>Commission type</div>
                <select value={form.commission_type} onChange={e=>setForm(f=>({...f,commission_type:e.target.value}))}
                  style={{ width:"100%", background:"#f8f8f8", border:"1px solid #eeeeee", borderRadius:8, padding:"9px 12px", fontSize:12, color:"#000", outline:"none" }}>
                  <option value="percentage">% of job value</option>
                  <option value="fixed">Fixed per job (KES)</option>
                </select>
              </div>
              <div>
                <div style={{ fontSize:10, color:"#888", marginBottom:3 }}>{form.commission_type==="percentage"?"Percentage (%)":"Amount (KES)"}</div>
                <input type="number" value={form.commission_rate} onChange={e=>setForm(f=>({...f,commission_rate:e.target.value}))}
                  placeholder={form.commission_type==="percentage"?"e.g. 15":"e.g. 500"}
                  style={{ width:"100%", background:"#f8f8f8", border:"1px solid #eeeeee", borderRadius:8, padding:"9px 12px", fontSize:12, color:"#000", outline:"none" }}/>
              </div>
            </div>
            <div style={{ fontSize:10, color:"#888", marginTop:4 }}>
              {form.commission_type==="percentage"
                ? "Mechanic earns "+form.commission_rate+"% of each completed job value"
                : "Mechanic earns KES "+form.commission_rate+" per completed job"}
            </div>
          </div>
          <button onClick={addMechanic} disabled={submitting}
            style={{ width:"100%", background:submitting?"#888":"#1d9e75", border:"none", borderRadius:10, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:14, fontWeight:700, padding:"12px", cursor:"pointer" }}>
            {submitting?"Adding...":"Add Mechanic →"}
          </button>
        </div>
      )}

      {/* Mechanics list */}
      {mechanics.length===0&&!showAdd&&(
        <div style={{ textAlign:"center", padding:"3rem 1rem", background:"#ffffff", borderRadius:14, border:"1px solid #eeeeee" }}>
          <div style={{ fontSize:48, marginBottom:12 }}>👨‍🔧</div>
          <div style={{ fontFamily:"Syne", fontSize:16, fontWeight:700, color:"#000", marginBottom:4 }}>No mechanics yet</div>
          <div style={{ fontSize:13, color:"#888" }}>Add mechanics to assign them to jobs</div>
        </div>
      )}

      {mechanics.map(m=>(
        <div key={m.id} style={{ background:"#ffffff", border:"1px solid " + (m.is_active?m.is_available?"#1d9e7520":"#e6821e20":"#eeeeee"), borderRadius:14, marginBottom:10, overflow:"hidden" }}>

          {/* Mechanic header - always visible */}
          <div style={{ padding:"1rem", display:"flex", gap:12, alignItems:"flex-start" }}
            onClick={()=>setExpanded(expanded===m.id?null:m.id)}>
            {/* Avatar */}
            <div style={{ width:44, height:44, borderRadius:"50%", background:m.is_active&&m.is_available?"#f0fdf4":"#f5f5f5", border:"2px solid " + (m.is_active&&m.is_available?"#1d9e75":"#ddd"), display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, flexShrink:0 }}>
              👨‍🔧
            </div>
            {/* Info */}
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontFamily:"Syne", fontSize:15, fontWeight:800, color:"#000", marginBottom:2 }}>{m.first_name} {m.last_name}</div>
              <div style={{ fontSize:11, color:"#555", marginBottom:4 }}>{m.specialization}</div>
              <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                <span style={{ fontSize:10, padding:"2px 8px", borderRadius:10, fontWeight:700,
                  background:m.is_active?m.is_available?"#f0fdf4":"#fff8f0":"#f5f5f5",
                  color:m.is_active?m.is_available?"#1d9e75":"#e6821e":"#888" }}>
                  {m.is_active?m.is_available?"🟢 Available":"🟡 Busy":"⚫ Inactive"}
                </span>
                {m.mechanic_code&&<span style={{ fontSize:10, color:"#888", padding:"2px 8px", background:"#f5f5f5", borderRadius:10 }}>{m.mechanic_code}</span>}
                {m.rating&&<span style={{ fontSize:10, color:"#e6821e", fontWeight:700 }}>⭐ {m.rating}</span>}
              </div>
            </div>
            <div style={{ fontSize:14, color:"#888", flexShrink:0 }}>{expanded===m.id?"▲":"▼"}</div>
          </div>

          {/* Expanded panel */}
          {expanded===m.id&&(
            <div style={{ borderTop:"1px solid #f5f5f5", padding:"0.75rem 1rem" }}>

              {/* Contact info */}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:12 }}>
                {m.phone&&<div style={{ background:"#f8f8f8", borderRadius:8, padding:"8px 10px" }}>
                  <div style={{ fontSize:10, color:"#888", marginBottom:2 }}>Phone</div>
                  <div style={{ fontSize:12, fontWeight:600, color:"#000" }}>{m.phone}</div>
                </div>}
              {m.commission_rate>0&&<div style={{ background:"#f0fdf4", borderRadius:8, padding:"8px 10px" }}>
                <div style={{ fontSize:10, color:"#888", marginBottom:2 }}>Pay structure</div>
                <div style={{ fontSize:12, fontWeight:600, color:"#1d9e75" }}>
                  {m.commission_type==="fixed"
                    ? "KES "+Number(m.commission_rate).toLocaleString()+" per job"
                    : Math.round(m.commission_rate*100)+"% of job value"}
                </div>
              </div>}
              </div>

              {/* Action buttons */}
              <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:12 }}>
                <button onClick={()=>toggleAvailable(m)}
                  style={{ background:m.is_available?"#fff8f0":"#f0fdf4", border:"1px solid " + (m.is_available?"#e6821e40":"#1d9e7540"), borderRadius:8, color:m.is_available?"#e6821e":"#1d9e75", fontSize:11, fontWeight:700, padding:"6px 12px", cursor:"pointer" }}>
                  {m.is_available?"Set Unavailable":"Set Available"}
                </button>
                <button onClick={()=>toggleActive(m)}
                  style={{ background:m.is_active?"#fff5f5":"#f0fdf4", border:"1px solid " + (m.is_active?"#e24b4a40":"#1d9e7540"), borderRadius:8, color:m.is_active?"#e24b4a":"#1d9e75", fontSize:11, fontWeight:700, padding:"6px 12px", cursor:"pointer" }}>
                  {m.is_active?"Deactivate":"Activate"}
                </button>
                <button onClick={()=>{ setPinPanel(pinPanel===m.id?null:m.id); setPin("") }}
                  style={{ background:"#eff6ff", border:"1px solid #378add40", borderRadius:8, color:"#378add", fontSize:11, fontWeight:700, padding:"6px 12px", cursor:"pointer" }}>
                  🔑 {m.mechanic_code?"Reset PIN":"Set PIN"}
                </button>
                <button onClick={()=>loadDocs(m.id)}
                  style={{ background:"#f5f3ff", border:"1px solid #8b5cf640", borderRadius:8, color:"#8b5cf6", fontSize:11, fontWeight:700, padding:"6px 12px", cursor:"pointer" }}>
                  📄 {docsPanel===m.id?"Hide Docs":"View Docs"}
                </button>
                {m.user_id&&(
                  <>
                    <button onClick={()=>setChatPanel(chatPanel===m.id?null:m.id)}
                      style={{ background:"#f0fdf4", border:"1px solid #1d9e7540", borderRadius:8, color:"#1d9e75", fontSize:12, fontWeight:700, padding:"7px 12px", cursor:"pointer" }}>
                      💬 Chat
                    </button>
                    <button onClick={()=>{ setCommPanel(commPanel===m.id?null:m.id); setCommForm({ rate:m.commission_type==="percentage"?String(Math.round((m.commission_rate||0.15)*100)):String(m.commission_rate||500), type:m.commission_type||"percentage" }) }}
                      style={{ background:"#fff8f0", border:"1px solid #e6821e40", borderRadius:8, color:"#e6821e", fontSize:12, fontWeight:700, padding:"7px 12px", cursor:"pointer" }}>
                      💰 Pay
                    </button>
                  </>
                )}
              </div>

                {/* Commission edit panel */}
                {commPanel===m.id&&(
                  <div style={{ background:"#fff8f0", borderRadius:10, padding:"0.75rem", marginBottom:10, border:"1px solid #e6821e20" }}>
                    <div style={{ fontSize:12, fontWeight:700, color:"#e6821e", marginBottom:8 }}>💰 Update Pay Structure</div>
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:8 }}>
                      <select value={commForm.type} onChange={e=>setCommForm(f=>({...f,type:e.target.value}))}
                        style={{ background:"#fff", border:"1px solid #eeeeee", borderRadius:8, padding:"8px 10px", fontSize:12, outline:"none" }}>
                        <option value="percentage">% of job value</option>
                        <option value="fixed">Fixed per job (KES)</option>
                      </select>
                      <input type="number" value={commForm.rate} onChange={e=>setCommForm(f=>({...f,rate:e.target.value}))}
                        placeholder={commForm.type==="percentage"?"e.g. 15":"e.g. 500"}
                        style={{ background:"#fff", border:"1px solid #eeeeee", borderRadius:8, padding:"8px 10px", fontSize:12, outline:"none" }}/>
                    </div>
                    <div style={{ display:"flex", gap:6 }}>
                      <button onClick={()=>updateCommission(m.id)}
                        style={{ flex:1, background:"#e6821e", border:"none", borderRadius:7, color:"#fff", fontSize:11, fontWeight:700, padding:"8px", cursor:"pointer" }}>
                        Save
                      </button>
                      <button onClick={()=>setCommPanel(null)}
                        style={{ background:"none", border:"1px solid #ddd", borderRadius:7, color:"#888", fontSize:11, padding:"8px 12px", cursor:"pointer" }}>
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

              {/* PIN setup panel */}
              {pinPanel===m.id&&(
                <div style={{ background:"#eff6ff", borderRadius:10, padding:"0.75rem", marginBottom:10 }}>
                  <div style={{ fontSize:12, fontWeight:700, color:"#378add", marginBottom:8 }}>🔑 {m.mechanic_code?"Reset":"Set"} PIN for {m.first_name}</div>
                  <div style={{ display:"flex", gap:8 }}>
                    <input type="password" value={pin} onChange={e=>setPin(e.target.value.replace(/D/g,"").slice(0,6))}
                      placeholder="Enter 4-6 digit PIN" maxLength={6}
                      style={{ flex:1, background:"#fff", border:"1px solid #378add40", borderRadius:8, padding:"8px 12px", fontSize:14, letterSpacing:4, color:"#000", outline:"none" }}/>
                    <button onClick={()=>setMechanicPin(m.id)} disabled={settingPin||pin.length<4}
                      style={{ background:pin.length>=4?"#378add":"#ccc", border:"none", borderRadius:8, color:"#fff", fontSize:12, fontWeight:700, padding:"8px 16px", cursor:"pointer" }}>
                      {settingPin?"...":"Save"}
                    </button>
                  </div>
                  <div style={{ fontSize:10, color:"#666", marginTop:6 }}>
                    Login URL: carcareconnect.care/mechanic-login
                  </div>
                </div>
              )}

              {/* Documents panel */}
              {docsPanel===m.id&&(
                <div style={{ background:"#faf5ff", borderRadius:10, padding:"0.75rem" }}>
                  <div style={{ fontSize:12, fontWeight:700, color:"#8b5cf6", marginBottom:8 }}>📄 {m.first_name}&apos;s Documents</div>
                  {(!mechanicDocs[m.id]||mechanicDocs[m.id].length===0)&&(
                    <div style={{ fontSize:11, color:"#888", padding:"0.5rem 0" }}>No documents uploaded yet. Mechanic needs to upload from their portal.</div>
                  )}
                  {(mechanicDocs[m.id]||[]).map(doc=>(
                    <div key={doc.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", background:"#fff", borderRadius:8, padding:"8px 10px", marginBottom:6 }}>
                      <div>
                        <div style={{ fontSize:11, fontWeight:600, color:"#000" }}>{doc.type?.replace(/_/g," ")||"Document"}</div>
                        <span style={{ fontSize:10, fontWeight:700, color:doc.status==="approved"?"#1d9e75":doc.status==="rejected"?"#e24b4a":"#e6821e" }}>
                          {doc.status==="approved"?"✓ Verified":doc.status==="rejected"?"✗ Rejected":"⏳ Pending"}
                        </span>
                      </div>
                      <a href={doc.document_url} target="_blank" rel="noopener noreferrer"
                        style={{ fontSize:11, color:"#378add", textDecoration:"none", fontWeight:600 }}>View →</a>
                    </div>
                  ))}
                  {mechanicDocs[m.id]?.length===0&&(
                    <div style={{ fontSize:10, color:"#888", marginTop:4 }}>
                      Tell {m.first_name} to upload documents from the mechanic portal under the 📄 Docs tab.
                    </div>
                  )}
                </div>
                )}
              {chatPanel===m.id&&m.user_id&&(
                <div style={{ height:400, marginTop:8 }}>
                  <ChatWindow
                    mechanicId={m.user_id}
                    otherUserId={m.user_id}
                    overrideUserId={user.id}
                    otherUserName={m.first_name + " " + (m.last_name||"")}
                    onClose={()=>setChatPanel(null)}
                  />
                </div>
              )}

            </div>
          )}
        </div>
      ))}
    </div>
  )
}
