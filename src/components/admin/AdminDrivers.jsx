import { useEffect, useState, useRef } from "react"
import { supabase } from "../../lib/supabase"
import useIsMobile from "../../lib/useIsMobile"
import toast from "react-hot-toast"

export default function AdminDrivers() {
  const isMobile = useIsMobile()
  const [drivers, setDrivers] = useState([])
  const [driverStatuses, setDriverStatuses] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState("all")
  const [selected, setSelected] = useState(null)
  const [search, setSearch] = useState("")
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)

  useEffect(() => {
    load()
    const sub = supabase.channel("admin-drivers-live")
      .on("postgres_changes", { event:"*", schema:"public", table:"driver_status" }, () => loadStatuses())
      .on("postgres_changes", { event:"*", schema:"public", table:"profiles" }, () => loadDrivers())
      .subscribe()
    return () => supabase.removeChannel(sub)
  }, [])

  useEffect(() => {
    if (tab==="map") initMap()
    return () => { if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null } }
  }, [tab, driverStatuses])

  async function load() {
    await Promise.all([loadDrivers(), loadStatuses()])
    setLoading(false)
  }

  async function loadDrivers() {
    const { data } = await supabase.from("profiles")
      .select("*")
      .eq("role", "driver")
      .order("created_at", { ascending:false })
    setDrivers(data||[])
  }

  async function loadStatuses() {
    const { data } = await supabase.from("driver_status").select("*")
    setDriverStatuses(data||[])
  }

  function getStatus(driverId) {
    return driverStatuses.find(s=>s.driver_id===driverId)
  }

  async function verifyDriver(driverId, verified) {
    const { error } = await supabase.from("profiles")
      .update({ documents_verified:verified, is_active:verified })
      .eq("id", driverId)
    if (error) return toast.error(error.message)
    toast.success(verified?"Driver verified ✓":"Driver verification revoked")
    loadDrivers()
  }

  async function suspendDriver(driverId, suspend) {
    const { error } = await supabase.from("profiles").update({ is_active:!suspend }).eq("id", driverId)
    if (error) return toast.error(error.message)
    if (suspend) await supabase.from("driver_status").update({ is_online:false }).eq("driver_id", driverId)
    toast.success(suspend?"Driver suspended":"Driver reactivated")
    loadDrivers()
  }

  async function recordNoShow(driverId, bookingId) {
    if (!confirm("Record a no-show for this driver?")) return
    const { data: status } = await supabase.from("driver_status").select("no_show_count").eq("driver_id", driverId).single()
    const noShowCount = (status?.no_show_count||0) + 1
    let penaltyType = "warning"
    let suspendUntil = null
    if (noShowCount === 2) { penaltyType = "suspension_24h"; suspendUntil = new Date(Date.now()+24*60*60*1000).toISOString() }
    if (noShowCount === 3) { penaltyType = "suspension_72h"; suspendUntil = new Date(Date.now()+72*60*60*1000).toISOString() }
    if (noShowCount >= 4) { penaltyType = "permanent_ban"; suspendUntil = null }

    await Promise.all([
      supabase.from("driver_penalties").insert({ driver_id:driverId, booking_id:bookingId||null, penalty_type:penaltyType, reason:"No-show — failed to complete accepted job", is_active:true, expires_at:suspendUntil }),
      supabase.from("driver_status").update({ no_show_count:noShowCount, is_suspended:noShowCount>=2, suspension_expires_at:suspendUntil, is_online:false }).eq("driver_id", driverId),
      supabase.from("notifications").insert({ user_id:driverId, title:"Penalty recorded ⚠️", message:`A no-show penalty has been recorded on your account. No-show count: ${noShowCount}. ${noShowCount>=2?"Your account has been suspended.":"Please ensure you complete accepted jobs."}`, type:"error" }),
    ])
    toast.success(`No-show recorded — penalty: ${penaltyType.replace("_"," ")}`)
    load()
  }

  async function clearPenalties(driverId) {
    if (!confirm("Clear all penalties for this driver?")) return
    await Promise.all([
      supabase.from("driver_penalties").update({ is_active:false }).eq("driver_id", driverId),
      supabase.from("driver_status").update({ no_show_count:0, is_suspended:false, suspension_expires_at:null }).eq("driver_id", driverId),
    ])
    toast.success("Penalties cleared")
    load()
  }

  function initMap() {
    setTimeout(() => {
      if (!mapRef.current || !window.L) return
      if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null }
      const L = window.L
      const map = L.map(mapRef.current).setView([-1.2921, 36.8219], 11)
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map)
      driverStatuses.filter(s=>s.current_latitude&&s.is_online).forEach(s => {
        const driver = drivers.find(d=>d.id===s.driver_id)
        const icon = L.divIcon({ className:"", html:`<div style="background:#378add;width:34px;height:34px;border-radius:50%;border:3px solid #fff;display:flex;align-items:center;justify-content:center;font-size:16px;box-shadow:0 2px 8px rgba(0,0,0,0.3);">🚗</div>`, iconSize:[34,34], iconAnchor:[17,17] })
        L.marker([s.current_latitude, s.current_longitude], { icon })
          .addTo(map)
          .bindPopup(`<b>${driver?.first_name||""} ${driver?.last_name||""}</b><br>${s.current_booking_id?"On job":"Available"}`)
      })
      mapInstanceRef.current = map
    }, 200)
  }

  const filtered = drivers.filter(d => {
    const matchSearch = `${d.first_name} ${d.last_name} ${d.license_number||""} ${d.id_number||""}`.toLowerCase().includes(search.toLowerCase())
    const status = getStatus(d.id)
    if (tab==="online") return matchSearch && status?.is_online
    if (tab==="verified") return matchSearch && d.documents_verified
    if (tab==="pending") return matchSearch && !d.documents_verified
    if (tab==="suspended") return matchSearch && !d.is_active
    return matchSearch
  })

  const onlineCount = driverStatuses.filter(s=>s.is_online).length
  const verifiedCount = drivers.filter(d=>d.documents_verified).length
  const pendingCount = drivers.filter(d=>!d.documents_verified).length

  const TABS = [
    { k:"all", l:`All (${drivers.length})` },
    { k:"online", l:`Online (${onlineCount})` },
    { k:"verified", l:`Verified (${verifiedCount})` },
    { k:"pending", l:`Pending (${pendingCount})` },
    { k:"map", l:"🗺️ Live map" },
  ]

  return (
    <div>
      <style>{`@import url('https://unpkg.com/leaflet@1.9.4/dist/leaflet.css');`}</style>
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"/>

      {/* Stats */}
      <div style={{ display:"grid", gridTemplateColumns:isMobile?"repeat(2,1fr)":"repeat(4,1fr)", gap:10, marginBottom:"1.5rem" }}>
        {[
          { label:"Total drivers", value:drivers.length, color:"#f0ede6" },
          { label:"Online now", value:onlineCount, color:"#1d9e75" },
          { label:"Verified", value:verifiedCount, color:"#378add" },
          { label:"Pending verification", value:pendingCount, color:"#e6821e" },
        ].map(s=>(
          <div key={s.label} style={{ background:"#111", borderRadius:10, padding:isMobile?"0.75rem":"1rem", border:"1px solid #1e1e1e" }}>
            <div style={{ fontSize:10, color:"#555", textTransform:"uppercase", marginBottom:4 }}>{s.label}</div>
            <div style={{ fontFamily:"Syne", fontSize:isMobile?16:20, fontWeight:800, color:s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display:"flex", gap:6, marginBottom:"1.25rem", flexWrap:"wrap" }}>
        {TABS.map(t=>(
          <button key={t.k} onClick={()=>setTab(t.k)}
            style={{ padding:"8px 16px", borderRadius:8, border:"none", fontSize:12, cursor:"pointer", background:tab===t.k?"#8b5cf6":"#111", color:tab===t.k?"#fff":"#666", fontFamily:"'DM Sans',sans-serif", fontWeight:tab===t.k?700:400 }}>
            {t.l}
          </button>
        ))}
      </div>

      {/* Search */}
      {tab!=="map"&&(
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search drivers..."
          style={{ width:"100%", background:"#111", border:"1px solid #222", borderRadius:8, padding:"9px 12px", color:"#f0ede6", fontSize:13, outline:"none", marginBottom:"1rem", fontFamily:"'DM Sans',sans-serif" }}/>
      )}

      {/* MAP TAB */}
      {tab==="map"&&(
        <div style={{ background:"#111", border:"1px solid #1e1e1e", borderRadius:12, padding:"1rem" }}>
          <div style={{ fontFamily:"Syne", fontSize:13, fontWeight:700, color:"#f0ede6", marginBottom:6 }}>Live driver locations</div>
          <div style={{ fontSize:11, color:"#555", marginBottom:10 }}>{onlineCount} driver{onlineCount!==1?"s":""} online</div>
          <div ref={mapRef} style={{ height:isMobile?300:450, borderRadius:10, overflow:"hidden", background:"#1a1a1a" }}>
            {onlineCount===0&&(
              <div style={{ height:"100%", display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:8 }}>
                <div style={{ fontSize:32 }}>🗺️</div>
                <div style={{ fontSize:12, color:"#555" }}>No drivers online</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* DRIVERS LIST */}
      {tab!=="map"&&(
        <div>
          {loading&&<div style={{ color:"#555", fontSize:13 }}>Loading...</div>}
          {!loading&&filtered.length===0&&<div style={{ color:"#444", fontSize:13, textAlign:"center", padding:"2rem" }}>No drivers found</div>}

          {filtered.map(d=>{
            const status = getStatus(d.id)
            const isOnline = status?.is_online
            const onJob = status?.current_booking_id
            return (
              <div key={d.id} style={{ background:"#111", border:`1px solid ${d.documents_verified?"#378add20":"#e6821e20"}`, borderRadius:12, padding:isMobile?"0.9rem":"1.1rem", marginBottom:10 }}>
                <div style={{ display:"flex", alignItems:"flex-start", gap:12 }}>
                  {/* Avatar */}
                  <div style={{ width:48, height:48, borderRadius:12, background:isOnline?"#071a12":"#1a1a1a", border:`2px solid ${isOnline?"#1d9e7540":"#333"}`, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"Syne", fontSize:16, fontWeight:800, color:isOnline?"#1d9e75":"#555", flexShrink:0 }}>
                    {d.first_name?.[0]}{d.last_name?.[0]}
                  </div>

                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4, flexWrap:"wrap" }}>
                      <div style={{ fontSize:14, fontWeight:600, color:"#f0ede6" }}>{d.first_name} {d.last_name}</div>
                      {d.documents_verified&&<span style={{ fontSize:10, color:"#1d9e75", background:"#071a12", padding:"2px 7px", borderRadius:10, border:"1px solid #1d9e7540" }}>✓ Verified</span>}
                      {!d.documents_verified&&<span style={{ fontSize:10, color:"#e6821e", background:"#1a1208", padding:"2px 7px", borderRadius:10 }}>⏳ Pending</span>}
                      {!d.is_active&&<span style={{ fontSize:10, color:"#e24b4a", background:"#1a0808", padding:"2px 7px", borderRadius:10 }}>Suspended</span>}
                      {isOnline&&<span style={{ fontSize:10, color:"#1d9e75" }}>🟢 Online{onJob?" · On job":""}</span>}
                      {status?.is_suspended&&<span style={{ fontSize:10, color:"#e24b4a", background:"#1a0808", padding:"2px 7px", borderRadius:10 }}>🚫 Suspended</span>}
                      {status?.no_show_count>0&&<span style={{ fontSize:10, color:"#e6821e", background:"#1a1208", padding:"2px 7px", borderRadius:10 }}>⚠️ {status.no_show_count} no-show{status.no_show_count>1?"s":""}</span>}
                    </div>

                    <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"repeat(3,1fr)", gap:6, marginBottom:8 }}>
                      {[
                        { l:"ID Number", v:d.id_number||"—" },
                        { l:"License", v:d.license_number||"—" },
                        { l:"License class", v:d.license_class||"—" },
                        { l:"Expiry", v:d.license_expiry||"—" },
                        { l:"Experience", v:d.years_experience?`${d.years_experience} years`:"—" },
                        { l:"City", v:d.city||"—" },
                      ].map(f=>(
                        <div key={f.l}>
                          <div style={{ fontSize:9, color:"#444", textTransform:"uppercase" }}>{f.l}</div>
                          <div style={{ fontSize:11, color:"#888" }}>{f.v}</div>
                        </div>
                      ))}
                    </div>

                    {(d.emergency_contact_name||d.emergency_contact_phone)&&(
                      <div style={{ fontSize:11, color:"#555", marginBottom:8 }}>
                        Emergency: {d.emergency_contact_name} · {d.emergency_contact_phone}
                      </div>
                    )}

                    {status?.current_latitude&&(
                      <div style={{ fontSize:10, color:"#8b5cf6", marginBottom:6 }}>
                        📍 Last location: {status.current_latitude?.toFixed(4)}, {status.current_longitude?.toFixed(4)}
                        {status.last_seen&&` · ${new Date(status.last_seen).toLocaleTimeString()}`}
                      </div>
                    )}

                    <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                      {!d.documents_verified&&d.is_active&&(
                        <button onClick={()=>verifyDriver(d.id, true)}
                          style={{ background:"#071a12", border:"1px solid #1d9e7540", borderRadius:7, color:"#1d9e75", fontSize:11, padding:"5px 12px", cursor:"pointer", fontWeight:600 }}>
                          ✓ Verify driver
                        </button>
                      )}
                      {d.documents_verified&&(
                        <button onClick={()=>verifyDriver(d.id, false)}
                          style={{ background:"none", border:"1px solid #e6821e30", borderRadius:7, color:"#e6821e", fontSize:11, padding:"5px 12px", cursor:"pointer" }}>
                          Revoke verification
                        </button>
                      )}
                      {d.is_active?(
                        <button onClick={()=>suspendDriver(d.id, true)}
                          style={{ background:"none", border:"1px solid #e24b4a30", borderRadius:7, color:"#e24b4a", fontSize:11, padding:"5px 12px", cursor:"pointer" }}>
                          Suspend
                        </button>
                      ):(
                        <button onClick={()=>suspendDriver(d.id, false)}
                          style={{ background:"#071a12", border:"1px solid #1d9e7540", borderRadius:7, color:"#1d9e75", fontSize:11, padding:"5px 12px", cursor:"pointer" }}>
                          Reactivate
                        </button>
                      )}
                      <button onClick={()=>recordNoShow(d.id, null)}
                        style={{ background:"#1a0808", border:"1px solid #e24b4a30", borderRadius:7, color:"#e24b4a", fontSize:11, padding:"5px 12px", cursor:"pointer" }}>
                        🚫 No-show
                      </button>
                      {(status?.no_show_count>0||status?.is_suspended)&&(
                        <button onClick={()=>clearPenalties(d.id)}
                          style={{ background:"#071a12", border:"1px solid #1d9e7540", borderRadius:7, color:"#1d9e75", fontSize:11, padding:"5px 12px", cursor:"pointer" }}>
                          Clear penalties
                        </button>
                      )}
                      <button onClick={()=>setSelected(selected===d.id?null:d.id)}
                        style={{ background:"#0c1f2e", border:"1px solid #378add40", borderRadius:7, color:"#378add", fontSize:11, padding:"5px 12px", cursor:"pointer" }}>
                        {selected===d.id?"Hide":"View stats"}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Driver stats */}
                {selected===d.id&&<DriverStats driverId={d.id} isMobile={isMobile}/>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function DriverStats({ driverId, isMobile }) {
  const [stats, setStats] = useState(null)

  useEffect(() => {
    async function load() {
      const [{ data: bks }, { data: revs }] = await Promise.all([
        supabase.from("bookings").select("id,status,driver_earnings,booking_date").eq("driver_id", driverId),
        supabase.from("reviews").select("driver_rating").eq("driver_id", driverId).not("driver_rating","is",null),
      ])
      const completed = bks?.filter(b=>b.status==="completed")||[]
      const totalEarnings = completed.reduce((s,b)=>s+Number(b.driver_earnings||0),0)
      const avgRating = revs?.length?(revs.reduce((s,r)=>s+Number(r.driver_rating),0)/revs.length).toFixed(1):"—"
      setStats({ total:bks?.length||0, completed:completed.length, earnings:totalEarnings, rating:avgRating })
    }
    load()
  }, [driverId])

  if (!stats) return <div style={{ fontSize:12, color:"#555", marginTop:10 }}>Loading stats...</div>

  return (
    <div style={{ marginTop:12, paddingTop:12, borderTop:"1px solid #1e1e1e" }}>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8 }}>
        {[
          { label:"Total jobs", value:stats.total, color:"#f0ede6" },
          { label:"Completed", value:stats.completed, color:"#1d9e75" },
          { label:"Rating", value:stats.rating, color:"#e6821e" },
          { label:"Earnings", value:`KES ${Number(stats.earnings).toLocaleString()}`, color:"#8b5cf6" },
        ].map(s=>(
          <div key={s.label} style={{ background:"#0f0f0f", borderRadius:8, padding:"0.6rem", textAlign:"center" }}>
            <div style={{ fontFamily:"Syne", fontSize:isMobile?13:15, fontWeight:800, color:s.color }}>{s.value}</div>
            <div style={{ fontSize:9, color:"#444", marginTop:2 }}>{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}



