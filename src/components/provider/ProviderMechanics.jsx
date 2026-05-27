import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"
import { useAuth } from "../../contexts/AuthContext"
import useIsMobile from "../../lib/useIsMobile"
import toast from "react-hot-toast"

const SPECIALIZATIONS = [
  "General Mechanic",
  "Engine Specialist",
  "Electrical Systems",
  "Brake Specialist",
  "Transmission Specialist",
  "Tire & Wheel Specialist",
  "Body & Paint",
  "AC & Cooling Systems",
  "Suspension & Steering",
  "Diagnostics Specialist",
  "Emergency Roadside",
  "Mobile Mechanic",
]

const EMPTY = { first_name:"", last_name:"", phone:"", specialization:"General Mechanic", notes:"" }

export default function ProviderMechanics() {
  const { user } = useAuth()
  const isMobile = useIsMobile()
  const [mechanics, setMechanics] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)

  useEffect(() => { if (user) load() }, [user])

  async function load() {
    const { data } = await supabase.from("mechanics")
      .select("*").eq("provider_id", user.id).order("created_at", { ascending:false })
    setMechanics(data||[])
    setLoading(false)
  }

  async function save(e) {
    e.preventDefault()
    if (!form.first_name||!form.last_name) return toast.error("Name required")
    setSaving(true)
    try {
      if (editing) {
        const { error } = await supabase.from("mechanics").update({
          first_name: form.first_name,
          last_name: form.last_name,
          phone: form.phone,
          specialization: form.specialization,
          notes: form.notes,
        }).eq("id", editing).eq("provider_id", user.id)
        if (error) throw error
        toast.success("Mechanic updated")
      } else {
        const { error } = await supabase.from("mechanics").insert({
          provider_id: user.id,
          first_name: form.first_name,
          last_name: form.last_name,
          phone: form.phone,
          specialization: form.specialization,
          notes: form.notes,
          is_available: true,
          is_active: true,
        })
        if (error) throw error
        toast.success("Mechanic added")
      }
      setForm(EMPTY)
      setShowForm(false)
      setEditing(null)
      load()
    } catch(err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function toggleAvailable(id, is_available) {
    await supabase.from("mechanics").update({ is_available:!is_available }).eq("id",id).eq("provider_id",user.id)
    toast.success(is_available?"Marked as unavailable":"Marked as available")
    load()
  }

  async function toggleActive(id, is_active) {
    await supabase.from("mechanics").update({ is_active:!is_active }).eq("id",id).eq("provider_id",user.id)
    toast.success(is_active?"Mechanic deactivated":"Mechanic activated")
    load()
  }

  async function deleteMechanic(id, name) {
    if (!confirm(`Remove ${name} from your team?`)) return
    await supabase.from("mechanics").delete().eq("id",id).eq("provider_id",user.id)
    toast.success("Mechanic removed")
    load()
  }

  function startEdit(m) {
    setEditing(m.id)
    setForm({ first_name:m.first_name, last_name:m.last_name, phone:m.phone||"", specialization:m.specialization||"General Mechanic", notes:m.notes||"" })
    setShowForm(true)
  }

  const available = mechanics.filter(m=>m.is_available&&m.is_active).length
  const onJob = mechanics.filter(m=>!m.is_available&&m.is_active).length

  const inp = { width:"100%", background:"#111", border:"1px solid #222", borderRadius:8, padding:"11px 12px", color:"#f0ede6", fontSize:13, outline:"none", fontFamily:"'DM Sans',sans-serif", marginBottom:12 }
  const lbl = { fontSize:11, color:"#666", textTransform:"uppercase", letterSpacing:"0.05em", display:"block", marginBottom:4 }

  return (
    <div>
      {/* Stats */}
      <div style={{ display:"grid", gridTemplateColumns:isMobile?"repeat(2,1fr)":"repeat(4,1fr)", gap:10, marginBottom:"1.5rem" }}>
        {[
          { label:"Total mechanics", value:mechanics.length, color:"#f0ede6" },
          { label:"Available now", value:available, color:"#1d9e75" },
          { label:"On job", value:onJob, color:"#e6821e" },
          { label:"Inactive", value:mechanics.filter(m=>!m.is_active).length, color:"#555" },
        ].map(s=>(
          <div key={s.label} style={{ background:"#111", borderRadius:10, padding:"1rem", border:"1px solid #1e1e1e" }}>
            <div style={{ fontSize:10, color:"#555", textTransform:"uppercase", marginBottom:4 }}>{s.label}</div>
            <div style={{ fontFamily:"Syne", fontSize:20, fontWeight:800, color:s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"1rem" }}>
        <div style={{ fontFamily:"Syne", fontSize:16, fontWeight:800, color:"#f0ede6" }}>
          Your mechanics team
        </div>
        <button onClick={()=>{ setShowForm(true); setEditing(null); setForm(EMPTY) }}
          style={{ background:"#378add", border:"none", borderRadius:9, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:13, fontWeight:700, padding:"9px 18px", cursor:"pointer" }}>
          + Add mechanic
        </button>
      </div>

      {/* Form */}
      {showForm&&(
        <div style={{ background:"#111", border:"1px solid #1e1e1e", borderRadius:12, padding:"1.25rem", marginBottom:"1.5rem" }}>
          <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:700, marginBottom:"1rem", color:"#f0ede6" }}>
            {editing?"Edit mechanic":"Add new mechanic"}
          </div>
          <form onSubmit={save}>
            <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:10 }}>
              <div>
                <label style={lbl}>First name</label>
                <input style={inp} placeholder="John" value={form.first_name} onChange={e=>setForm(f=>({...f,first_name:e.target.value}))} required/>
              </div>
              <div>
                <label style={lbl}>Last name</label>
                <input style={inp} placeholder="Doe" value={form.last_name} onChange={e=>setForm(f=>({...f,last_name:e.target.value}))} required/>
              </div>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:10 }}>
              <div>
                <label style={lbl}>Phone number</label>
                <input style={inp} placeholder="+254 700 000 000" value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))}/>
              </div>
              <div>
                <label style={lbl}>Specialization</label>
                <select style={inp} value={form.specialization} onChange={e=>setForm(f=>({...f,specialization:e.target.value}))}>
                  {SPECIALIZATIONS.map(s=><option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <label style={lbl}>Notes (optional)</label>
            <textarea style={{ ...inp, resize:"vertical", minHeight:60 }} placeholder="Any additional notes about this mechanic..." value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))}/>
            <div style={{ display:"flex", gap:8 }}>
              <button type="submit" disabled={saving}
                style={{ background:saving?"#333":"#378add", border:"none", borderRadius:9, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:13, fontWeight:700, padding:"10px 24px", cursor:saving?"not-allowed":"pointer" }}>
                {saving?"Saving...":editing?"Update":"Add mechanic"}
              </button>
              <button type="button" onClick={()=>{ setShowForm(false); setEditing(null); setForm(EMPTY) }}
                style={{ background:"none", border:"1px solid #333", borderRadius:9, color:"#666", fontSize:13, padding:"10px 18px", cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Mechanics list */}
      {loading&&<div style={{ color:"#555", fontSize:13 }}>Loading...</div>}
      {!loading&&mechanics.length===0&&(
        <div style={{ color:"#444", fontSize:13, textAlign:"center", padding:"3rem" }}>
          <div style={{ fontSize:32, marginBottom:10 }}>👨‍🔧</div>
          No mechanics added yet. Add your first mechanic above.
        </div>
      )}

      {mechanics.map(m=>(
        <div key={m.id} style={{ background:"#111", border:`1px solid ${m.is_active?m.is_available?"#1d9e7530":"#e6821e30":"#1e1e1e"}`, borderRadius:10, padding:isMobile?"0.75rem":"1rem", marginBottom:8, opacity:m.is_active?1:0.5 }}>
          <div style={{ display:"flex", alignItems:"flex-start", gap:12 }}>
            <div style={{ width:44, height:44, borderRadius:"50%", background:m.is_available&&m.is_active?"#071a12":"#1a1a1a", border:`1px solid ${m.is_available&&m.is_active?"#1d9e7540":"#333"}`, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"Syne", fontSize:14, fontWeight:800, color:m.is_available&&m.is_active?"#1d9e75":"#555", flexShrink:0 }}>
              {m.first_name[0]}{m.last_name[0]}
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4, flexWrap:"wrap" }}>
                <div style={{ fontSize:13, fontWeight:600, color:"#f0ede6" }}>{m.first_name} {m.last_name}</div>
                <span style={{ fontSize:10, padding:"2px 8px", borderRadius:10, background:m.is_available&&m.is_active?"#071a12":"#1a1a1a", color:m.is_available&&m.is_active?"#1d9e75":"#555" }}>
                  {m.is_active?(m.is_available?"Available":"On job"):"Inactive"}
                </span>
              </div>
              <div style={{ fontSize:11, color:"#555", marginBottom:2 }}>🔧 {m.specialization}</div>
              {m.phone&&<div style={{ fontSize:11, color:"#555", marginBottom:2 }}>📞 {m.phone}</div>}
              {m.notes&&<div style={{ fontSize:11, color:"#444", fontStyle:"italic" }}>"{m.notes}"</div>}
            </div>
            <div style={{ display:"flex", gap:6, flexShrink:0, flexWrap:"wrap", justifyContent:"flex-end" }}>
              <button onClick={()=>startEdit(m)}
                style={{ background:"#0c1f2e", border:"1px solid #378add40", borderRadius:7, color:"#378add", fontSize:11, padding:"5px 10px", cursor:"pointer" }}>
                Edit
              </button>
              {m.is_active&&(
                <button onClick={()=>toggleAvailable(m.id, m.is_available)}
                  style={{ background:m.is_available?"#1a1208":"#071a12", border:`1px solid ${m.is_available?"#e6821e40":"#1d9e7540"}`, borderRadius:7, color:m.is_available?"#e6821e":"#1d9e75", fontSize:11, padding:"5px 10px", cursor:"pointer" }}>
                  {m.is_available?"Set on job":"Set available"}
                </button>
              )}
              <button onClick={()=>toggleActive(m.id, m.is_active)}
                style={{ background:"none", border:`1px solid ${m.is_active?"#e24b4a20":"#1d9e7520"}`, borderRadius:7, color:m.is_active?"#e24b4a":"#1d9e75", fontSize:11, padding:"5px 10px", cursor:"pointer" }}>
                {m.is_active?"Deactivate":"Activate"}
              </button>
              <button onClick={()=>deleteMechanic(m.id, `${m.first_name} ${m.last_name}`)}
                style={{ background:"none", border:"1px solid #e24b4a20", borderRadius:7, color:"#e24b4a", fontSize:11, padding:"5px 10px", cursor:"pointer" }}>
                Remove
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
