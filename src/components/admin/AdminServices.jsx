import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"
import toast from "react-hot-toast"
import useIsMobile from "../../lib/useIsMobile"

export default function AdminServices() {
  const [services, setServices] = useState([])
  const [loading, setLoading] = useState(true)
  const isMobile = useIsMobile()
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("active")
  const [providerFilter, setProviderFilter] = useState("all")
  const [tab, setTab] = useState("services")
  const [bundles, setBundles] = useState([])

  useEffect(() => {
    load()
    const sub = supabase.channel("admin-services")
      .on("postgres_changes", { event:"*", schema:"public", table:"services" }, () => { load(); toast("Services updated", { icon:"🔧" }) })
      .subscribe()
    return () => supabase.removeChannel(sub)
  }, [])

  async function load() {
    const [{ data }, { data: bds }] = await Promise.all([
      supabase.from("services")
        .select("*, profile_public(first_name, last_name, business_name)")
        .order("created_at", { ascending:false }),
      supabase.from("service_bundles")
        .select("*, profile_public:profiles!service_bundles_provider_id_fkey(first_name, last_name, business_name)")
        .order("created_at", { ascending:false })
    ])
    setServices(data || [])
    setBundles(bds || [])
    setLoading(false)
  }
  async function toggleBundleActive(id, is_active) {
    await supabase.from("service_bundles").update({ is_active: !is_active }).eq("id", id)
    toast.success(is_active ? "Bundle hidden" : "Bundle activated")
    load()
  }
  async function deleteBundle(id) {
    if (!confirm("Delete this bundle permanently?")) return
    await supabase.from("service_bundles").delete().eq("id", id)
    toast.success("Bundle deleted")
    load()
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

  const filtered = services.filter(s => {
    const matchSearch = s.name?.toLowerCase().includes(search.toLowerCase()) || s.category?.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter==="all" || (statusFilter==="active" ? s.is_active : !s.is_active)
    return matchSearch && matchStatus
  })

  return (
    <div>
      <div style={{ display:"flex", gap:8, marginBottom:"1rem" }}>
        <button onClick={()=>setTab("services")} style={{ padding:"6px 16px", borderRadius:8, border:"none", fontSize:12, fontWeight:700, cursor:"pointer", background:tab==="services"?"#8b5cf6":"#f8f8f8", color:tab==="services"?"#fff":"#666" }}>
          Services ({services.length})
        </button>
        <button onClick={()=>setTab("bundles")} style={{ padding:"6px 16px", borderRadius:8, border:"none", fontSize:12, fontWeight:700, cursor:"pointer", background:tab==="bundles"?"#e6821e":"#f8f8f8", color:tab==="bundles"?"#fff":"#666" }}>
          Bundles ({bundles.length})
        </button>
      </div>
      {tab==="services"&&(<>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))", gap:10, marginBottom:"1.5rem" }}>
        {[
          { label:"Total", value:services.length, color:"#000" },
          { label:"Active", value:services.filter(s=>s.is_active).length, color:"#1d9e75" },
          { label:"Inactive", value:services.filter(s=>!s.is_active).length, color:"#888" },
          { label:"With photos", value:services.filter(s=>s.photos?.length>0).length, color:"#378add" },
          { label:"Discounted", value:services.filter(s=>s.discounted_price).length, color:"#8b5cf6" },
        ].map(s=>(
          <div key={s.label} style={{ background:"#f8f8f8", borderRadius:10, padding:"0.75rem", border:"1px solid #eee", textAlign:"center" }}>
            <div style={{ fontFamily:"Syne", fontSize:18, fontWeight:800, color:s.color }}>{s.value}</div>
            <div style={{ fontSize:10, color:"#888", marginTop:2 }}>{s.label}</div>
          </div>
        ))}
      </div>
      <div style={{ display:"flex", gap:6, marginBottom:"1rem", flexWrap:"wrap" }}>
        {[{k:"active",l:"Active"},{k:"inactive",l:"Inactive"},{k:"all",l:"All"}].map(t=>(
          <button key={t.k} onClick={()=>setStatusFilter(t.k)} style={{ padding:"6px 14px", borderRadius:6, border:"none", fontSize:12, cursor:"pointer", background:statusFilter===t.k?"#e6821e":"#f0f0f0", color:statusFilter===t.k?"#fff":"#555" }}>{t.l}</button>
        ))}
      </div>
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
              {s.category} · {s.duration}min · KES {Number(s.price).toLocaleString()}
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
      </>)}
      {tab==="bundles"&&(
        <div>
          <div style={{ fontSize:12, color:"#888", marginBottom:10 }}>{bundles.length} bundle{bundles.length!==1?"s":""}</div>
          {loading && <div style={{ color:"#888", fontSize:13 }}>Loading...</div>}
          {bundles.map(b => {
            const savings = Number(b.original_price) - Number(b.bundle_price)
            const savingsPct = Math.round((savings / Number(b.original_price)) * 100)
            return (
              <div key={b.id} style={{ background:"#f8f8f8", border:"1px solid #eeeeee", borderRadius:10, padding:"1rem", marginBottom:8, display:"flex", alignItems:"center", gap:12 }}>
                <div style={{ flex:1 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                    <div style={{ fontSize:14, fontWeight:500, color:"#000000" }}>{b.name}</div>
                    <span style={{ fontSize:10, padding:"2px 8px", borderRadius:20, background:b.is_active?"#f0fdf4":"#f5f5f5", color:b.is_active?"#1d9e75":"#555" }}>
                      {b.is_active?"Active":"Hidden"}
                    </span>
                    <span style={{ fontSize:10, padding:"2px 8px", borderRadius:20, background:"#fff8f0", color:"#e6821e" }}>
                      Save {savingsPct}%
                    </span>
                  </div>
                  <div style={{ fontSize:11, color:"#888" }}>
                    KES {Number(b.bundle_price).toLocaleString()} (was {Number(b.original_price).toLocaleString()}) · {b.service_ids?.length||0} services · {b.platform_commission_rate?(b.platform_commission_rate*100).toFixed(1)+"% commission":""}
                    <span style={{ marginLeft:8 }}>{b.profile_public?.business_name||`${b.profile_public?.first_name||""} ${b.profile_public?.last_name||""}`}</span>
                  </div>
                </div>
                <div style={{ display:"flex", gap:6 }}>
                  <button onClick={()=>toggleBundleActive(b.id,b.is_active)} style={{ background:"none", border:"1px solid #dddddd", borderRadius:7, color:"#888", fontSize:11, padding:"5px 10px", cursor:"pointer" }}>
                    {b.is_active?"Hide":"Show"}
                  </button>
                  <button onClick={()=>deleteBundle(b.id)} style={{ background:"none", border:"1px solid #e24b4a40", borderRadius:7, color:"#e24b4a", fontSize:11, padding:"5px 10px", cursor:"pointer" }}>
                    Delete
                  </button>
                </div>
              </div>
            )
          })}
          {!loading && bundles.length===0 && <div style={{ color:"#888", fontSize:13, textAlign:"center", padding:"2rem" }}>No bundles yet</div>}
        </div>
      )}
    </div>
  )
}
