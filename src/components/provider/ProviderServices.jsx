import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"
import { useAuth } from "../../contexts/AuthContext"
import toast from "react-hot-toast"
import { useLanguage } from "../../contexts/LanguageContext"

const CATEGORIES = ["Oil Change","Brake Repair","Tire Service","Engine Repair","AC Repair","Transmission","Detailing","Maintenance","Electrical","Body Repair"]

const EMPTY_FORM = { name:"", description:"", category:"Oil Change", price:"", discounted_price:"", duration:60, is_active:true, tags:"", requirements:"", inclusions:"" }

export default function ProviderServices() {
  const { user } = useAuth()
  const { t } = useLanguage()
  const [services, setServices] = useState([])
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(null)

  useEffect(() => { if (user) load() }, [user])

  async function load() {
    const { data } = await supabase.from("services").select("*").eq("provider_id", user.id).order("created_at",{ascending:false})
    setServices(data||[])
    setLoading(false)
  }

  async function save(e) {
    e.preventDefault()
    const payload = {
      name: form.name,
      description: form.description,
      category: form.category,
      price: Number(form.price),
      discounted_price: form.discounted_price ? Number(form.discounted_price) : null,
      duration: Number(form.duration),
      is_active: form.is_active,
      tags: form.tags ? form.tags.split(",").map(t=>t.trim()).filter(Boolean) : [],
      requirements: form.requirements ? form.requirements.split("\n").map(r=>r.trim()).filter(Boolean) : [],
      inclusions: form.inclusions ? form.inclusions.split("\n").map(r=>r.trim()).filter(Boolean) : [],
    }
    if (editing) {
      const { error } = await supabase.from("services").update(payload).eq("id",editing).eq("provider_id",user.id)
      if (error) return toast.error(error.message)
      toast.success("Service updated")
      setEditing(null)
    } else {
      const { error } = await supabase.from("services").insert({ ...payload, provider_id:user.id })
      if (error) return toast.error(error.message)
      toast.success("Service created")
    }
    setForm(EMPTY_FORM)
    load()
  }

  async function toggle(id, is_active) {
    await supabase.from("services").update({ is_active:!is_active }).eq("id",id)
    load()
  }

  async function remove(id) {
    if (!confirm("Delete this service?")) return
    await supabase.from("services").delete().eq("id",id).eq("provider_id",user.id)
    toast.success("Service deleted")
    load()
  }

  function startEdit(s) {
    setEditing(s.id)
    setForm({
      name:s.name, description:s.description||"", category:s.category,
      price:String(s.price), discounted_price:s.discounted_price?String(s.discounted_price):"",
      duration:s.duration, is_active:s.is_active,
      tags: Array.isArray(s.tags) ? s.tags.join(", ") : "",
      requirements: Array.isArray(s.requirements) ? s.requirements.join("\n") : "",
      inclusions: Array.isArray(s.inclusions) ? s.inclusions.join("\n") : "",
    })
    window.scrollTo({ top: document.body.scrollHeight, behavior:"smooth" })
  }

  const inp = { width:"100%", background:"#0f0f0f", border:"1px solid #222", borderRadius:8, padding:"10px 12px", color:"#f0ede6", fontSize:13, outline:"none", marginBottom:10, fontFamily:"'DM Sans',sans-serif" }
  const lbl = { fontSize:11, color:"#666", textTransform:"uppercase", letterSpacing:"0.05em", display:"block", marginBottom:4 }

  return (
    <div>
      {loading&&<div style={{ color:"#555", fontSize:13 }}>Loading...</div>}
      {!loading&&services.length===0&&<div style={{ color:"#444", fontSize:13, textAlign:"center", padding:"1.5rem" }}>No services yet. Add your first service below.</div>}

      {services.map(s=>(
        <div key={s.id} style={{ background:"#111", border:"1px solid #1e1e1e", borderRadius:10, padding:"1rem", marginBottom:10 }}>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <div style={{ flex:1 }}>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                <div style={{ fontSize:14, fontWeight:500, color:"#f0ede6" }}>{s.name}</div>
                <span style={{ fontSize:10, padding:"2px 8px", borderRadius:20, background:s.is_active?"#071a12":"#1a1a1a", color:s.is_active?"#1d9e75":"#555" }}>
                  {s.is_active?"Active":"Inactive"}
                </span>
              </div>
              <div style={{ fontSize:11, color:"#555" }}>{s.category} · {s.duration}min · ${Number(s.discounted_price||s.price).toFixed(2)}</div>
            </div>
            <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
              <button onClick={()=>setExpanded(expanded===s.id?null:s.id)} style={{ background:"none", border:"1px solid #333", borderRadius:7, color:"#888", fontSize:11, padding:"5px 10px", cursor:"pointer" }}>
                {expanded===s.id?"Less":"Details"}
              </button>
              <button onClick={()=>startEdit(s)} style={{ background:"none", border:"1px solid #333", borderRadius:7, color:"#888", fontSize:11, padding:"5px 10px", cursor:"pointer" }}>Edit</button>
              <button onClick={()=>toggle(s.id,s.is_active)} style={{ background:"none", border:"1px solid #333", borderRadius:7, color:"#888", fontSize:11, padding:"5px 10px", cursor:"pointer" }}>
                {s.is_active?"Deactivate":"Activate"}
              </button>
              <button onClick={()=>remove(s.id)} style={{ background:"none", border:"1px solid #e24b4a40", borderRadius:7, color:"#e24b4a", fontSize:11, padding:"5px 10px", cursor:"pointer" }}>Delete</button>
            </div>
          </div>

          {expanded===s.id&&(
            <div style={{ marginTop:12, paddingTop:12, borderTop:"1px solid #1e1e1e" }}>
              {s.description&&<div style={{ fontSize:12, color:"#888", lineHeight:1.6, marginBottom:8 }}>{s.description}</div>}
              {Array.isArray(s.tags)&&s.tags.length>0&&(
                <div style={{ marginBottom:8 }}>
                  <div style={{ fontSize:10, color:"#555", textTransform:"uppercase", marginBottom:6 }}>Tags</div>
                  <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                    {s.tags.map(t=><span key={t} style={{ fontSize:10, padding:"3px 8px", borderRadius:6, background:"#1a1a1a", color:"#888", border:"1px solid #222" }}>{t}</span>)}
                  </div>
                </div>
              )}
              {Array.isArray(s.inclusions)&&s.inclusions.length>0&&(
                <div style={{ marginBottom:8 }}>
                  <div style={{ fontSize:10, color:"#555", textTransform:"uppercase", marginBottom:6 }}>What's included</div>
                  {s.inclusions.map((inc,i)=><div key={i} style={{ fontSize:12, color:"#888", marginBottom:2 }}>✓ {inc}</div>)}
                </div>
              )}
              {Array.isArray(s.requirements)&&s.requirements.length>0&&(
                <div>
                  <div style={{ fontSize:10, color:"#555", textTransform:"uppercase", marginBottom:6 }}>Requirements</div>
                  {s.requirements.map((req,i)=><div key={i} style={{ fontSize:12, color:"#888", marginBottom:2 }}>• {req}</div>)}
                </div>
              )}
            </div>
          )}
        </div>
      ))}

      <div style={{ background:"#111", border:"1px solid #1e1e1e", borderRadius:10, padding:"1.25rem", marginTop:"1rem" }}>
        <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:700, marginBottom:"1rem" }}>{editing?t("editService"):"Add a service"}</div>
        <form onSubmit={save}>
          <label style={lbl}>Service name</label>
          <input style={inp} placeholder="e.g. Full Oil Change" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} required/>
          <label style={lbl}>Description</label>
          <textarea style={{...inp,resize:"vertical"}} rows={3} placeholder="Describe what is included..." value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))}/>
          <label style={lbl}>Category</label>
          <select style={inp} value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))}>
            {CATEGORIES.map(c=><option key={c}>{c}</option>)}
          </select>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10 }}>
            <div><label style={lbl}>Price ($)</label><input style={inp} type="number" step="0.01" min="0" placeholder="50.00" value={form.price} onChange={e=>setForm(f=>({...f,price:e.target.value}))} required/></div>
            <div><label style={lbl}>Discounted ($)</label><input style={inp} type="number" step="0.01" min="0" placeholder="Optional" value={form.discounted_price} onChange={e=>setForm(f=>({...f,discounted_price:e.target.value}))}/></div>
            <div><label style={lbl}>Duration (min)</label><input style={inp} type="number" min="15" step="15" value={form.duration} onChange={e=>setForm(f=>({...f,duration:e.target.value}))} required/></div>
          </div>
          <label style={lbl}>Tags (comma separated)</label>
          <input style={inp} placeholder="e.g. synthetic, quick service, walk-in" value={form.tags} onChange={e=>setForm(f=>({...f,tags:e.target.value}))}/>
          <label style={lbl}>What is included (one per line)</label>
          <textarea style={{...inp,resize:"vertical"}} rows={3} placeholder={"Oil filter replacement\nEngine oil top up\n5 point inspection"} value={form.inclusions} onChange={e=>setForm(f=>({...f,inclusions:e.target.value}))}/>
          <label style={lbl}>Customer requirements (one per line)</label>
          <textarea style={{...inp,resize:"vertical"}} rows={3} placeholder={"Vehicle must be driveable\nBring service log book"} value={form.requirements} onChange={e=>setForm(f=>({...f,requirements:e.target.value}))}/>
          <div style={{ display:"flex", gap:8, marginTop:4 }}>
            <button type="submit" style={{ background:"#378add", border:"none", borderRadius:8, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:13, fontWeight:700, padding:"10px 20px", cursor:"pointer" }}>
              {editing?"Update service":t("addService")}
            </button>
            {editing&&<button type="button" onClick={()=>{ setEditing(null); setForm(EMPTY_FORM) }} style={{ background:"none", border:"1px solid #333", borderRadius:8, color:"#888", fontSize:13, padding:"10px 20px", cursor:"pointer" }}>Cancel</button>}
          </div>
        </form>
      </div>
    </div>
  )
}
