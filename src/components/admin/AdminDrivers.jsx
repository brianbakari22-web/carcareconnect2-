import useIsMobile from "../../lib/useIsMobile"
import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"
import toast from "react-hot-toast"

export default function AdminDrivers() {
  const isMobile = useIsMobile()
  const [drivers, setDrivers] = useState([])
  const [driverStatus, setDriverStatus] = useState({})
  const [earnings, setEarnings] = useState({})
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [search, setSearch] = useState("")

  useEffect(() => {
    load()
    const sub = supabase.channel("admin-drivers")
      .on("postgres_changes", { event:"*", schema:"public", table:"driver_status" }, () => loadStatus())
      .subscribe()
    return () => supabase.removeChannel(sub)
  }, [])

  async function loadStatus() {
    const { data } = await supabase.from("driver_status").select("*")
    const map = {}
    ;(data||[]).forEach(s=>{ map[s.driver_id]=s })
    setDriverStatus(map)
  }

  async function load() {
    const [{ data: ds }, { data: bks }] = await Promise.all([
      supabase.from("profiles").select("*").eq("role","driver").order("created_at",{ascending:false}),
      supabase.from("bookings").select("driver_id,driver_earnings,status")
    ])
    setDrivers(ds||[])
    const earnMap = {}
    ;(bks||[]).filter(b=>b.status==="completed"&&b.driver_id).forEach(b=>{ earnMap[b.driver_id]=(earnMap[b.driver_id]||0)+Number(b.driver_earnings||15) })
    setEarnings(earnMap)
    await loadStatus()
    setLoading(false)
  }

  async function toggleVerified(id, is_verified) {
    await supabase.from("profiles").update({ is_verified:!is_verified }).eq("id",id)
    toast.success(is_verified?"Verification removed":"Driver verified ✓")
    load()
  }

  async function toggleActive(id, is_active) {
    await supabase.from("profiles").update({ is_active:!is_active }).eq("id",id)
    toast.success(is_active?"Driver suspended":"Driver activated")
    load()
  }

  const filtered = drivers.filter(d=>
    `${d.first_name} ${d.last_name} ${d.city||""}`.toLowerCase().includes(search.toLowerCase())
  )
  const onlineCount = filtered.filter(d=>driverStatus[d.id]?.is_online).length

  return (
    <div>
      <div style={{ display:"grid", gridTemplateColumns:isMobile?"repeat(2,1fr)":"repeat(4,1fr)", gap:10, marginBottom:"1.5rem" }}>
        {[
          { label:"Total drivers", value:drivers.length },
          { label:"Online now", value:onlineCount, color:onlineCount>0?"#1d9e75":undefined },
          { label:"Verified", value:drivers.filter(d=>d.is_verified).length, color:"#1d9e75" },
          { label:"Suspended", value:drivers.filter(d=>!d.is_active).length, color:drivers.filter(d=>!d.is_active).length>0?"#e24b4a":undefined },
        ].map(s=>(
          <div key={s.label} style={{ background:"#111", borderRadius:10, padding:"1rem", border:"1px solid #1e1e1e" }}>
            <div style={{ fontSize:11, color:"#555", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:6 }}>{s.label}</div>
            <div style={{ fontFamily:"Syne", fontSize:20, fontWeight:800, color:s.color||"#f0ede6" }}>{s.value}</div>
          </div>
        ))}
      </div>

      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search drivers..."
        style={{ width:"100%", background:"#111", border:"1px solid #222", borderRadius:8, padding:"9px 12px", color:"#f0ede6", fontSize:13, outline:"none", fontFamily:"'DM Sans',sans-serif", marginBottom:"1rem" }}/>

      {loading&&<div style={{ color:"#555", fontSize:13 }}>Loading...</div>}
      {filtered.map(d=>{
        const status = driverStatus[d.id]
        const isOnline = status?.is_online
        return (
          <div key={d.id} style={{ background:"#111", border:`1px solid ${isOnline?"#1d9e7520":!d.is_active?"#e24b4a20":"#1e1e1e"}`, borderRadius:10, padding:"1rem", marginBottom:8 }}>
            <div style={{ display:"flex", alignItems:"center", gap:12 }}>
              <div style={{ width:44, height:44, borderRadius:"50%", background:isOnline?"#071a12":"#1a1a1a", border:`1px solid ${isOnline?"#1d9e7540":"#333"}`, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"Syne", fontSize:15, fontWeight:800, color:isOnline?"#1d9e75":"#555", flexShrink:0 }}>
                {d.first_name?.[0]}{d.last_name?.[0]}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap", marginBottom:2 }}>
                  <div style={{ fontSize:13, fontWeight:500, color:d.is_active?"#f0ede6":"#555" }}>{d.first_name} {d.last_name}</div>
                  {d.is_verified&&<span style={{ fontSize:10, color:"#1d9e75", background:"#071a12", padding:"1px 6px", borderRadius:10 }}>✓</span>}
                  {!d.is_active&&<span style={{ fontSize:10, color:"#e24b4a", background:"#1a0808", padding:"1px 6px", borderRadius:10 }}>Suspended</span>}
                  <span style={{ fontSize:10, padding:"1px 6px", borderRadius:10, background:isOnline?"#071a12":"#1a1a1a", color:isOnline?"#1d9e75":"#555" }}>
                    {isOnline?"● Online":"○ Offline"}
                  </span>
                </div>
                <div style={{ fontSize:11, color:"#555" }}>
                  {d.city&&`${d.city} · `}
                  ${(earnings[d.id]||0).toFixed(2)} earned
                  {status?.current_lat&&status?.current_lng&&<span style={{ marginLeft:6, color:"#378add" }}>📍 Location active</span>}
                </div>
              </div>
              <button onClick={()=>setSelected(selected===d.id?null:d.id)}
                style={{ background:"none", border:"1px solid #333", borderRadius:7, color:"#666", fontSize:11, padding:"5px 10px", cursor:"pointer", flexShrink:0 }}>
                {selected===d.id?"Close":"Manage"}
              </button>
            </div>
            {selected===d.id&&(
              <div style={{ marginTop:10, paddingTop:10, borderTop:"1px solid #1e1e1e", display:"flex", gap:8, flexWrap:"wrap" }}>
                <button onClick={()=>toggleVerified(d.id,d.is_verified)} style={{ background:"#071a12", border:"1px solid #1d9e7540", borderRadius:7, color:"#1d9e75", fontSize:12, padding:"6px 12px", cursor:"pointer" }}>
                  {d.is_verified?"Remove verification":"✓ Verify driver"}
                </button>
                <button onClick={()=>toggleActive(d.id,d.is_active)} style={{ background:d.is_active?"#1a0808":"#071a12", border:`1px solid ${d.is_active?"#e24b4a40":"#1d9e7540"}`, borderRadius:7, color:d.is_active?"#e24b4a":"#1d9e75", fontSize:12, padding:"6px 12px", cursor:"pointer" }}>
                  {d.is_active?"Suspend":"Activate"}
                </button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

