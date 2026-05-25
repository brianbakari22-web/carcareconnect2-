import useIsMobile from "../../lib/useIsMobile"
import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"
import toast from "react-hot-toast"

const DEFAULT_CATEGORIES = [
  { name:"Oil Change", icon:"🛢️", description:"Engine oil and filter replacement" },
  { name:"Brake Repair", icon:"🔧", description:"Brake pads, rotors and brake fluid" },
  { name:"Tire Service", icon:"🔄", description:"Rotation, balancing and replacement" },
  { name:"Engine Repair", icon:"⚙️", description:"Diagnostics and engine servicing" },
  { name:"AC Repair", icon:"❄️", description:"Air conditioning service and regas" },
  { name:"Transmission", icon:"🔩", description:"Gearbox and transmission repair" },
  { name:"Detailing", icon:"✨", description:"Interior and exterior detailing" },
  { name:"Maintenance", icon:"📋", description:"General servicing and checkups" },
  { name:"Electrical", icon:"⚡", description:"Electrical diagnostics and repair" },
  { name:"Body Repair", icon:"🚗", description:"Dents, scratches and panel work" },
]

export default function AdminCategories() {
  const isMobile = useIsMobile()
  const [categories, setCategories] = useState([])
  const [form, setForm] = useState({ name:"", icon:"🔧", description:"" })
  const [editing, setEditing] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase.from("service_categories").select("*").order("name")
    if (data && data.length > 0) {
      setCategories(data)
    } else {
      setCategories(DEFAULT_CATEGORIES.map((c,i) => ({ ...c, id:i+1, is_active:true, service_count:0 })))
    }
    setLoading(false)
  }

  async function save(e) {
    e.preventDefault()
    setSaving(true)
    try {
      if (editing) {
        const { error } = await supabase.from("service_categories")
          .update({ name:form.name, icon:form.icon, description:form.description })
          .eq("id", editing)
        if (error) throw error
        toast.success("Category updated")
        setEditing(null)
      } else {
        const { error } = await supabase.from("service_categories")
          .insert({ name:form.name, icon:form.icon, description:form.description, is_active:true })
        if (error) throw error
        toast.success("Category added")
      }
      setForm({ name:"", icon:"🔧", description:"" })
      load()
    } catch(err) {
      toast.error(err.message)
    } finally { setSaving(false) }
  }

  async function toggleActive(id, is_active) {
    await supabase.from("service_categories").update({ is_active:!is_active }).eq("id", id)
    toast.success(is_active ? "Category hidden" : "Category visible")
    load()
  }

  async function deleteCategory(id, name) {
    if (!confirm(`Delete category "${name}"? Services using this category will be unaffected.`)) return
    await supabase.from("service_categories").delete().eq("id", id)
    toast.success("Category deleted")
    load()
  }

  function startEdit(c) {
    setEditing(c.id)
    setForm({ name:c.name, icon:c.icon||"🔧", description:c.description||"" })
    window.scrollTo({ top:document.body.scrollHeight, behavior:"smooth" })
  }

  const inp = { width:"100%", background:"#0f0f0f", border:"1px solid #222", borderRadius:8, padding:"10px 12px", color:"#f0ede6", fontSize:13, outline:"none", fontFamily:"'DM Sans',sans-serif", marginBottom:10 }
  const lbl = { fontSize:11, color:"#666", textTransform:"uppercase", letterSpacing:"0.05em", display:"block", marginBottom:4 }

  return (
    <div>
      <div style={{ display:"grid", gridTemplateColumns:isMobile?"repeat(2,1fr)":"repeat(3,1fr)", gap:10, marginBottom:"1.5rem" }}>
        {[
          { label:"Total categories", value:categories.length },
          { label:"Active", value:categories.filter(c=>c.is_active!==false).length, color:"#1d9e75" },
          { label:"Hidden", value:categories.filter(c=>c.is_active===false).length },
        ].map(s=>(
          <div key={s.label} style={{ background:"#111", borderRadius:10, padding:"1rem", border:"1px solid #1e1e1e" }}>
            <div style={{ fontSize:11, color:"#555", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:6 }}>{s.label}</div>
            <div style={{ fontFamily:"Syne", fontSize:22, fontWeight:800, color:s.color||"#f0ede6" }}>{s.value}</div>
          </div>
        ))}
      </div>

      {loading&&<div style={{ color:"#555", fontSize:13 }}>Loading...</div>}

      <div style={{ display:"grid", gap:8, marginBottom:"1.5rem" }}>
        {categories.map(c=>(
          <div key={c.id} style={{ background:"#111", border:`1px solid ${c.is_active===false?"#e24b4a20":"#1e1e1e"}`, borderRadius:10, padding:"1rem", display:"flex", alignItems:"center", gap:12 }}>
            <div style={{ width:44, height:44, borderRadius:10, background:"#1a1a1a", display:"flex", alignItems:"center", justifyContent:"center", fontSize:22, flexShrink:0 }}>
              {c.icon||"🔧"}
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:2 }}>
                <div style={{ fontSize:13, fontWeight:600, color:c.is_active===false?"#555":"#f0ede6" }}>{c.name}</div>
                {c.is_active===false&&<span style={{ fontSize:10, color:"#e24b4a", background:"#1a0808", padding:"1px 6px", borderRadius:10 }}>Hidden</span>}
              </div>
              {c.description&&<div style={{ fontSize:11, color:"#555" }}>{c.description}</div>}
            </div>
            <div style={{ display:"flex", gap:6, flexShrink:0 }}>
              <button onClick={()=>startEdit(c)}
                style={{ background:"none", border:"1px solid #333", borderRadius:7, color:"#888", fontSize:11, padding:"5px 10px", cursor:"pointer" }}>
                Edit
              </button>
              {typeof c.is_active !== "undefined" && (
                <button onClick={()=>toggleActive(c.id, c.is_active)}
                  style={{ background:"none", border:`1px solid ${c.is_active===false?"#1d9e7540":"#e24b4a40"}`, borderRadius:7, color:c.is_active===false?"#1d9e75":"#e24b4a", fontSize:11, padding:"5px 10px", cursor:"pointer" }}>
                  {c.is_active===false?"Show":"Hide"}
                </button>
              )}
              <button onClick={()=>deleteCategory(c.id, c.name)}
                style={{ background:"none", border:"1px solid #e24b4a40", borderRadius:7, color:"#e24b4a", fontSize:11, padding:"5px 10px", cursor:"pointer" }}>
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      <div style={{ background:"#111", border:"1px solid #1e1e1e", borderRadius:12, padding:"1.25rem" }}>
        <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:700, marginBottom:"1rem", color:"#f0ede6" }}>
          {editing ? "Edit category" : "Add new category"}
        </div>
        <form onSubmit={save}>
          <div style={{ display:"grid", gridTemplateColumns:"80px 1fr", gap:10 }}>
            <div>
              <label style={lbl}>Icon</label>
              <input style={inp} placeholder="🔧" value={form.icon} onChange={e=>setForm(f=>({...f,icon:e.target.value}))} maxLength={4}/>
            </div>
            <div>
              <label style={lbl}>Category name</label>
              <input style={inp} placeholder="e.g. Suspension Repair" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} required/>
            </div>
          </div>
          <label style={lbl}>Description</label>
          <input style={inp} placeholder="Brief description of this category" value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))}/>
          <div style={{ display:"flex", gap:8 }}>
            <button type="submit" disabled={saving}
              style={{ background:saving?"#333":"#8b5cf6", border:"none", borderRadius:8, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:13, fontWeight:700, padding:"10px 20px", cursor:saving?"not-allowed":"pointer" }}>
              {saving?"Saving...":editing?"Update category":"Add category"}
            </button>
            {editing&&(
              <button type="button" onClick={()=>{ setEditing(null); setForm({ name:"", icon:"🔧", description:"" }) }}
                style={{ background:"none", border:"1px solid #333", borderRadius:8, color:"#888", fontSize:13, padding:"10px 20px", cursor:"pointer" }}>
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}

