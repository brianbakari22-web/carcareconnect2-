import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"
import toast from "react-hot-toast"

export default function AdminServices() {
  const [services, setServices] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")

  useEffect(() => {
    load()
    const sub = supabase.channel("admin-services")
      .on("postgres_changes", { event:"*", schema:"public", table:"services" }, () => { load(); toast("Services updated", { icon:"🔧" }) })
      .subscribe()
    return () => supabase.removeChannel(sub)
  }, [])

  async function load() {
    const { data } = await supabase.from("services")
      .select("*, profile_public(first_name, last_name, business_name)")
      .order("created_at", { ascending:false })
    setServices(data || [])
    setLoading(false)
  }

  async function toggleActive(id, is_active) {
    await supabase.from("services").update({ is_active: !is_active }).eq("id", id)
    toast.success(is_active ? "Service hidden" : "Service activated")
    load()
  }

  async function deleteService(id) {
    if (!confirm("Delete this service permanently?")) return
    await supabase.from("services").delete().eq("id", id)
    toast.success("Service deleted")
    load()
  }

  const filtered = services.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.category.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search services..."
        style={{ width:"100%", background:"#f8f8f8", border:"1px solid #f0f0f0", borderRadius:8, padding:"10px 12px", color:"#000000", fontSize:13, outline:"none", marginBottom:"1rem", fontFamily:"'DM Sans',sans-serif" }} />
      <div style={{ fontSize:12, color:"#888", marginBottom:10 }}>{filtered.length} service{filtered.length!==1?"s":""}</div>
      {loading && <div style={{ color:"#888", fontSize:13 }}>Loading...</div>}
      {filtered.map(s => (
        <div key={s.id} style={{ background:"#f8f8f8", border:"1px solid #eeeeee", borderRadius:10, padding:"1rem", marginBottom:8, display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ flex:1 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
              <div style={{ fontSize:14, fontWeight:500, color:"#000000" }}>{s.name}</div>
              <span style={{ fontSize:10, padding:"2px 8px", borderRadius:20, background:s.is_active?"#f0fdf4":"#f5f5f5", color:s.is_active?"#1d9e75":"#555" }}>
                {s.is_active?"Active":"Hidden"}
              </span>
            </div>
            <div style={{ fontSize:11, color:"#888" }}>
              {s.category} · {s.duration}min · ${Number(s.price).toFixed(2)}
              <span style={{ marginLeft:8 }}>{s.profile_public?.business_name||`${s.profile_public?.first_name||""} ${s.profile_public?.last_name||""}`}</span>
            </div>
          </div>
          <div style={{ display:"flex", gap:6 }}>
            <button onClick={()=>toggleActive(s.id,s.is_active)} style={{ background:"none", border:"1px solid #dddddd", borderRadius:7, color:"#888", fontSize:11, padding:"5px 10px", cursor:"pointer" }}>
              {s.is_active?"Hide":"Show"}
            </button>
            <button onClick={()=>deleteService(s.id)} style={{ background:"none", border:"1px solid #e24b4a40", borderRadius:7, color:"#e24b4a", fontSize:11, padding:"5px 10px", cursor:"pointer" }}>
              Delete
            </button>
          </div>
        </div>
      ))}
      {!loading && filtered.length===0 && <div style={{ color:"#888", fontSize:13, textAlign:"center", padding:"2rem" }}>No services yet</div>}
    </div>
  )
}
