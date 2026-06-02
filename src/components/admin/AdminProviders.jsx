import useIsMobile from "../../lib/useIsMobile"
import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"
import toast from "react-hot-toast"

export default function AdminProviders() {
  const isMobile = useIsMobile()
  const [providers, setProviders] = useState([])
  const [services, setServices] = useState({})
  const [earnings, setEarnings] = useState({})
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState("all")

  useEffect(() => { load() }, [])

  async function load() {
    const [{ data: ps }, { data: svcs }, { data: bks }] = await Promise.all([
      supabase.from("profiles").select("*").eq("role","provider").order("created_at",{ascending:false}),
      supabase.from("services").select("provider_id,id,is_active"),
      supabase.from("bookings").select("provider_id,provider_earnings,status")
    ])
    setProviders(ps||[])
    const svcMap = {}
    ;(svcs||[]).forEach(s=>{ if (!svcMap[s.provider_id]) svcMap[s.provider_id]={total:0,active:0}; svcMap[s.provider_id].total++; if(s.is_active) svcMap[s.provider_id].active++ })
    setServices(svcMap)
    const earnMap = {}
    ;(bks||[]).filter(b=>b.status==="completed").forEach(b=>{ earnMap[b.provider_id]=(earnMap[b.provider_id]||0)+Number(b.provider_earnings||0) })
    setEarnings(earnMap)
    setLoading(false)
  }

  async function toggleVerified(id, is_verified) {
    await supabase.from("profiles").update({ is_verified:!is_verified }).eq("id",id)
    toast.success(is_verified?"Verification removed":"Provider verified ✓")
    load()
  }

  async function toggleActive(id, is_active) {
    await supabase.from("profiles").update({ is_active:!is_active }).eq("id",id)
    toast.success(is_active?"Provider suspended":"Provider activated")
    load()
  }

  const filtered = providers.filter(p=>
    (typeFilter==="all"||p.provider_type===typeFilter) &&
    `${p.first_name} ${p.last_name} ${p.business_name||""} ${p.city||""}`.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <div style={{ display:"grid", gridTemplateColumns:isMobile?"repeat(2,1fr)":"repeat(3,1fr)", gap:10, marginBottom:"1.5rem" }}>
        {[
          { label:"Total providers", value:providers.length },
          { label:"Verified", value:providers.filter(p=>p.is_verified).length, color:"#1d9e75" },
          { label:"Suspended", value:providers.filter(p=>!p.is_active).length, color:providers.filter(p=>!p.is_active).length>0?"#e24b4a":undefined },
        ].map(s=>(
          <div key={s.label} style={{ background:"#111", borderRadius:10, padding:"1rem", border:"1px solid #1e1e1e" }}>
            <div style={{ fontSize:11, color:"#555", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:6 }}>{s.label}</div>
            <div style={{ fontFamily:"Syne", fontSize:22, fontWeight:800, color:s.color||"#f0ede6" }}>{s.value}</div>
          </div>
        ))}
      </div>

      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search providers..."
        style={{ width:"100%", background:"#111", border:"1px solid #222", borderRadius:8, padding:"9px 12px", color:"#f0ede6", fontSize:13, outline:"none", fontFamily:"'DM Sans',sans-serif", marginBottom:"1rem" }}/>

      <div style={{ display:"flex", gap:6, marginBottom:"1rem", flexWrap:"wrap" }}>
        {["all","garage","parts_dealer","accessories_shop","tyre_shop","auto_electrician","car_wash","panel_beater","auto_glass"].map(t=>(
          <button key={t} onClick={()=>setTypeFilter(t)}
            style={{ padding:"5px 12px", borderRadius:7, border:"none", fontSize:11, cursor:"pointer", background:typeFilter===t?"#8b5cf6":"#111", color:typeFilter===t?"#fff":"#666" }}>
            {t==="all"?"All types":t.replace(/_/g," ")}
          </button>
        ))}
      </div>
      {loading&&<div style={{ color:"#555", fontSize:13 }}>Loading...</div>}
      {filtered.map(p=>(
        <div key={p.id} style={{ background:"#111", border:`1px solid ${!p.is_active?"#e24b4a20":"#1e1e1e"}`, borderRadius:10, padding:"1rem", marginBottom:8 }}>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <div style={{ width:44, height:44, borderRadius:10, background:"#0c1f2e", border:"1px solid #378add30", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"Syne", fontSize:16, fontWeight:800, color:"#378add", flexShrink:0 }}>
              {(p.business_name||p.first_name||"?")[0].toUpperCase()}
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap", marginBottom:2 }}>
                <div style={{ fontSize:13, fontWeight:600, color:p.is_active?"#f0ede6":"#555" }}>{p.business_name||`${p.first_name} ${p.last_name}`}</div>
                {p.is_verified&&<span style={{ fontSize:10, color:"#1d9e75", background:"#071a12", padding:"1px 6px", borderRadius:10 }}>✓ Verified</span>}
                {!p.is_active&&<span style={{ fontSize:10, color:"#e24b4a", background:"#1a0808", padding:"1px 6px", borderRadius:10 }}>Suspended</span>}
                {p.provider_type&&<span style={{ fontSize:10, color:"#8b5cf6", background:"#160a2e", padding:"1px 6px", borderRadius:10 }}>{p.provider_type.replace(/_/g," ")}</span>}
              </div>
              <div style={{ fontSize:11, color:"#555" }}>
                {p.business_name&&`${p.first_name} ${p.last_name} · `}
                {p.city&&`${p.city} · `}
                {services[p.id]?.active||0} services · KES ${Number(earnings[p.id]||0).toLocaleString()} earned
              </div>
            </div>
            <button onClick={()=>setSelected(selected===p.id?null:p.id)}
              style={{ background:"none", border:"1px solid #333", borderRadius:7, color:"#666", fontSize:11, padding:"5px 10px", cursor:"pointer", flexShrink:0 }}>
              {selected===p.id?"Close":"Manage"}
            </button>
          </div>
          {selected===p.id&&(
            <div style={{ marginTop:10, paddingTop:10, borderTop:"1px solid #1e1e1e", display:"flex", gap:8, flexWrap:"wrap" }}>
              <button onClick={()=>toggleVerified(p.id,p.is_verified)} style={{ background:"#071a12", border:"1px solid #1d9e7540", borderRadius:7, color:"#1d9e75", fontSize:12, padding:"6px 12px", cursor:"pointer" }}>
                {p.is_verified?"Remove verification":"✓ Verify provider"}
              </button>
              <button onClick={()=>toggleActive(p.id,p.is_active)} style={{ background:p.is_active?"#1a0808":"#071a12", border:`1px solid ${p.is_active?"#e24b4a40":"#1d9e7540"}`, borderRadius:7, color:p.is_active?"#e24b4a":"#1d9e75", fontSize:12, padding:"6px 12px", cursor:"pointer" }}>
                {p.is_active?"Suspend":"Activate"}
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}




