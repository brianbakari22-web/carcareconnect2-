import { useEffect, useState, useRef } from "react"
import { supabase } from "../../lib/supabase"
import useIsMobile from "../../lib/useIsMobile"

const CATEGORIES = {
  shop_standard: { label:"Shop Standard", icon:"🏪", color:"#378add", bg:"#eff6ff" },
  shop_premium: { label:"Shop Premium", icon:"🏡", color:"#8b5cf6", bg:"#f5f3ff" },
  go_service: { label:"GO Service", icon:"🚨", color:"#e24b4a", bg:"#fff5f5" },
}

const EICONS = { flat_tire:"🛞", dead_battery:"🔋", out_of_fuel:"⛽", car_wont_start:"🔑", overheating:"🌡️", towing:"🚚", other:"🆘" }
const SC = { pending:"#e6821e", confirmed:"#378add", "in-progress":"#8b5cf6", completed:"#1d9e75", cancelled:"#e24b4a" }
const GC = { pending:"#e6821e", accepted:"#1d9e75", declined:"#e24b4a", timeout:"#555" }

export default function AdminMechanics() {
  const isMobile = useIsMobile()
  const [mechanics, setMechanics] = useState([])
  const [providers, setProviders] = useState([])
  const [services, setServices] = useState([])
  const [bookings, setBookings] = useState([])
  const [goRequests, setGoRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState("all")
  const [tab, setTab] = useState("mechanics")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)

  useEffect(() => {
    load()
    const sub = supabase.channel("admin-mechanics-live")
      .on("postgres_changes", { event:"*", schema:"public", table:"mechanics" }, () => loadMechanics())
      .on("postgres_changes", { event:"*", schema:"public", table:"bookings" }, () => loadBookings())
      .on("postgres_changes", { event:"*", schema:"public", table:"go_service_requests" }, () => loadGoRequests())
      .subscribe()
    return () => supabase.removeChannel(sub)
  }, [])

  useEffect(() => {
    if (tab==="map" && mapRef.current) initMap()
    return () => { if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null } }
  }, [tab])

  async function load() {
    await Promise.all([loadMechanics(), loadProviders(), loadServices(), loadBookings(), loadGoRequests()])
    setLoading(false)
  }

  async function loadMechanics() {
    const { data } = await supabase.from("mechanics").select("*, profiles!mechanics_provider_id_fkey(business_name,first_name,last_name,city)").order("created_at", { ascending:false })
    setMechanics(data||[])
  }

  async function loadMechanicDocs(mechanicId) {
    const { data } = await supabase.from("driver_documents")
      .select("*").eq("driver_id", mechanicId)
    setMechanicDocs(prev => ({...prev, [mechanicId]: data||[]}))
    setShowDocs(showDocs===mechanicId?null:mechanicId)
  }

  async function verifyDoc(docId, mechanicId, status) {
    await supabase.from("driver_documents").update({ status, verified_at: new Date().toISOString() }).eq("id", docId)
    toast.success("Document " + status)
    loadMechanicDocs(mechanicId)
  }

  async function adminResetPin(mechanicId, mechanicName) {
    const newPin = window.prompt("Set new PIN for " + mechanicName + " (4-6 digits):")
    if (!newPin) return
    if (!/^\d{4,6}$/.test(newPin)) return alert("PIN must be 4-6 digits")
    try {
      await supabase.rpc("set_mechanic_pin", { p_mechanic_id: mechanicId, p_pin: newPin })
      alert("PIN set! " + mechanicName + " can login at carcareconnect.care/mechanic-login with their phone + " + newPin)
      load()
    } catch(e) { alert("Error: " + e.message) }
  }

  async function loadProviders() {
    const { data } = await supabase.from("profiles").select("id,first_name,last_name,business_name,city").eq("role","provider")
    setProviders(data||[])
  }

  async function loadServices() {
    const { data } = await supabase.from("services").select("*").order("created_at", { ascending:false })
    setServices(data||[])
  }

  async function loadBookings() {
    const { data } = await supabase.from("bookings").select("*").order("created_at", { ascending:false }).limit(100)
    setBookings(data||[])
  }

  async function loadGoRequests() {
    const { data } = await supabase.from("go_service_requests")
      .select("*, bookings(emergency_type,emergency_location_address,total_amount,service_name), profiles(first_name,last_name,business_name)")
      .order("sent_at", { ascending:false }).limit(50)
    setGoRequests(data||[])
  }

  function initMap() {
    setTimeout(() => {
      if (!mapRef.current || !window.L) return
      if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null }
      const L = window.L
      const map = L.map(mapRef.current).setView([-1.2921, 36.8219], 11)
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map)
      mechanics.filter(m=>m.current_latitude).forEach(m => {
        const provider = providers.find(p=>p.id===m.provider_id)
        const icon = L.divIcon({ className:"", html:`<div style="background:${m.is_available?"#1d9e75":"#e6821e"};width:32px;height:32px;border-radius:50%;border:3px solid #fff;display:flex;align-items:center;justify-content:center;font-size:14px;">👨‍🔧</div>`, iconSize:[32,32], iconAnchor:[16,16] })
        L.marker([m.current_latitude, m.current_longitude], { icon })
          .addTo(map)
          .bindPopup(`<b>${m.first_name} ${m.last_name}</b><br>${m.specialization}<br>${provider?.business_name||"Unknown"}<br>${m.is_available?"Available":"On job"}`)
      })
      mapInstanceRef.current = map
    }, 200)
  }

  function getProvider(id) {
    const p = providers.find(p=>p.id===id)
    return p ? (p.business_name||`${p.first_name} ${p.last_name}`) : "Unknown"
  }

  const filteredMechanics = mechanics.filter(m => {
    const matchSearch = `${m.first_name} ${m.last_name} ${m.specialization||""} ${m.phone||""}`.toLowerCase().includes(search.toLowerCase())
    const matchFilter = filter==="all"||(filter==="available"&&m.is_available&&m.is_active)||(filter==="on_job"&&!m.is_available&&m.is_active)||(filter==="inactive"&&!m.is_active)
    return matchSearch && matchFilter
  })

  const filteredServices = categoryFilter==="all" ? services : services.filter(s=>s.category===categoryFilter)
  const filteredBookings = categoryFilter==="all" ? bookings : bookings.filter(b=>b.service_category===categoryFilter)

  const available = mechanics.filter(m=>m.is_available&&m.is_active).length
  const onJob = mechanics.filter(m=>!m.is_available&&m.is_active).length
  const liveCount = mechanics.filter(m=>m.current_latitude).length

  const TABS = [
    { k:"mechanics", l:"👨‍🔧 Mechanics" },
    { k:"services", l:"🔧 Services" },
    { k:"bookings", l:"📅 Bookings" },
    { k:"go", l:"🚨 GO Requests" },
    { k:"map", l:"🗺️ Live map" },
  ]

  return (
    <div>
      <style>{`@import url('https://unpkg.com/leaflet@1.9.4/dist/leaflet.css');`}</style>
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"/>

      {/* Overview stats */}
      <div style={{ display:"grid", gridTemplateColumns:isMobile?"repeat(2,1fr)":"repeat(4,1fr)", gap:10, marginBottom:"1.5rem" }}>
        {[
          { label:"Total mechanics", value:mechanics.length, color:"#000000" },
          { label:"Available", value:available, color:"#1d9e75" },
          { label:"On job", value:onJob, color:"#e6821e" },
          { label:"Live tracking", value:liveCount, color:"#8b5cf6" },
        ].map(s=>(
          <div key={s.label} style={{ background:"#f8f8f8", borderRadius:10, padding:isMobile?"0.75rem":"1rem", border:"1px solid #eeeeee" }}>
            <div style={{ fontSize:10, color:"#888", textTransform:"uppercase", marginBottom:4 }}>{s.label}</div>
            <div style={{ fontFamily:"Syne", fontSize:isMobile?16:20, fontWeight:800, color:s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Category stats */}
      <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"repeat(3,1fr)", gap:10, marginBottom:"1.5rem" }}>
        {Object.entries(CATEGORIES).map(([key, cat])=>(
          <div key={key} style={{ background:cat.bg, border:`1px solid ${cat.color}30`, borderRadius:12, padding:"1rem" }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
              <span style={{ fontSize:20 }}>{cat.icon}</span>
              <div style={{ fontFamily:"Syne", fontSize:13, fontWeight:800, color:cat.color }}>{cat.label}</div>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
              <div>
                <div style={{ fontSize:10, color:"#888", marginBottom:2 }}>Services</div>
                <div style={{ fontFamily:"Syne", fontSize:18, fontWeight:800, color:cat.color }}>{services.filter(s=>s.category===key).length}</div>
              </div>
              <div>
                <div style={{ fontSize:10, color:"#888", marginBottom:2 }}>Bookings</div>
                <div style={{ fontFamily:"Syne", fontSize:18, fontWeight:800, color:cat.color }}>{bookings.filter(b=>b.service_category===key).length}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display:"flex", gap:6, marginBottom:"1.25rem", flexWrap:"wrap" }}>
        {TABS.map(t=>(
          <button key={t.k} onClick={()=>setTab(t.k)}
            style={{ padding:"8px 16px", borderRadius:8, border:"none", fontSize:12, cursor:"pointer", background:tab===t.k?"#8b5cf6":"#f8f8f8", color:tab===t.k?"#fff":"#666", fontFamily:"'DM Sans',sans-serif", fontWeight:tab===t.k?700:400 }}>
            {t.l}
          </button>
        ))}
      </div>

      {/* MECHANICS TAB */}
      {tab==="mechanics"&&(
        <div>
          <div style={{ display:"flex", gap:8, marginBottom:"1rem", flexWrap:"wrap" }}>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search mechanics..."
              style={{ flex:1, minWidth:180, background:"#f8f8f8", border:"1px solid #f0f0f0", borderRadius:8, padding:"9px 12px", color:"#000000", fontSize:13, outline:"none" }}/>
            {["all","available","on_job","inactive"].map(f=>(
              <button key={f} onClick={()=>setFilter(f)}
                style={{ padding:"8px 14px", borderRadius:7, border:"none", fontSize:12, cursor:"pointer", background:filter===f?"#8b5cf6":"#f8f8f8", color:filter===f?"#fff":"#666", fontFamily:"'DM Sans',sans-serif" }}>
                {f==="all"?"All":f==="on_job"?"On job":f.charAt(0).toUpperCase()+f.slice(1)}
              </button>
            ))}
          </div>
          {loading&&<div style={{ color:"#888", fontSize:13 }}>Loading...</div>}
          {!loading&&filteredMechanics.length===0&&<div style={{ color:"#888", fontSize:13, textAlign:"center", padding:"2rem" }}>No mechanics found</div>}
          {filteredMechanics.map(m=>(
            <div key={m.id} style={{ background:"#f8f8f8", border:`1px solid ${m.is_active?m.is_available?"#1d9e7530":"#e6821e30":"#eeeeee"}`, borderRadius:10, padding:isMobile?"0.75rem":"1rem", marginBottom:8, opacity:m.is_active?1:0.6 }}>
              <div style={{ display:"flex", alignItems:"flex-start", gap:12 }}>
                <div style={{ width:44, height:44, borderRadius:"50%", background:m.is_available&&m.is_active?"#f0fdf4":"#f5f5f5", border:`1px solid ${m.is_available&&m.is_active?"#1d9e7540":"#e0e0e0"}`, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"Syne", fontSize:14, fontWeight:800, color:m.is_available&&m.is_active?"#1d9e75":"#555", flexShrink:0 }}>
                  {m.first_name[0]}{m.last_name[0]}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4, flexWrap:"wrap" }}>
                    <div style={{ fontSize:13, fontWeight:600, color:"#000000" }}>{m.first_name} {m.last_name}</div>
                    <span style={{ fontSize:10, padding:"2px 8px", borderRadius:10, background:m.is_available&&m.is_active?"#f0fdf4":"#f5f5f5", color:m.is_available&&m.is_active?"#1d9e75":"#555" }}>
                      {m.is_active?(m.is_available?"Available":"On job"):"Inactive"}
                    </span>
                    {m.current_latitude&&<span style={{ fontSize:10, color:"#8b5cf6" }}>📍 Live</span>}
                  </div>
                  <div style={{ fontSize:11, color:"#888", marginBottom:2 }}>🔧 {m.specialization}</div>
                  {m.phone&&<div style={{ fontSize:11, color:"#888", marginBottom:2 }}>📞 {m.phone}</div>}
                  <div style={{ fontSize:11, color:"#378add" }}>🏪 {getProvider(m.provider_id)}</div>
                  {m.last_location_update&&<div style={{ fontSize:10, color:"#888", marginTop:2 }}>Last seen: {new Date(m.last_location_update).toLocaleString()}</div>}
                  <div style={{ display:"flex", gap:6, marginTop:6, flexWrap:"wrap" }}>
                    {m.mechanic_code?(
                      <span style={{ fontSize:10, background:"#f0fdf4", color:"#1d9e75", padding:"2px 8px", borderRadius:8, fontWeight:700 }}>
                        ✓ Portal: {m.mechanic_code}
                      </span>
                    ):(
                      <span style={{ fontSize:10, background:"#fff8f0", color:"#e6821e", padding:"2px 8px", borderRadius:8 }}>
                        No PIN set
                      </span>
                    )}
                    <button onClick={()=>adminResetPin(m.id, m.first_name + " " + m.last_name)}
                      style={{ fontSize:10, background:"#eff6ff", border:"1px solid #378add30", borderRadius:6, color:"#378add", padding:"2px 8px", cursor:"pointer", fontWeight:700 }}>
                      🔑 {m.mechanic_code?"Reset PIN":"Set PIN"}
                    </button>
                    <button onClick={()=>loadMechanicDocs(m.id)}
                      style={{ fontSize:10, background:"#f0fdf4", border:"1px solid #1d9e7530", borderRadius:6, color:"#1d9e75", padding:"2px 8px", cursor:"pointer", fontWeight:700 }}>
                      📄 {showDocs===m.id?"Hide":"View Docs"}
                    </button>
                  </div>
                </div>
                {m.current_latitude&&(
                  <div style={{ textAlign:"right", flexShrink:0 }}>
                    <div style={{ fontSize:10, color:"#888", marginBottom:2 }}>Location</div>
                    <div style={{ fontSize:10, color:"#8b5cf6", fontFamily:"monospace" }}>{m.current_latitude?.toFixed(4)}, {m.current_longitude?.toFixed(4)}</div>
                  </div>
                )}
                {/* Document verification */}
                {showDocs===m.id&&(
                  <div style={{ marginTop:8, background:"#f8f8f8", borderRadius:10, padding:"0.75rem" }}>
                    <div style={{ fontSize:12, fontWeight:700, color:"#555", marginBottom:8 }}>📄 Documents</div>
                    {(!mechanicDocs[m.id]||mechanicDocs[m.id].length===0)&&(
                      <div style={{ fontSize:11, color:"#888" }}>No documents uploaded yet</div>
                    )}
                    {(mechanicDocs[m.id]||[]).map(doc=>(
                      <div key={doc.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6, background:"#fff", borderRadius:7, padding:"6px 10px" }}>
                        <div>
                          <div style={{ fontSize:11, fontWeight:600, color:"#000" }}>{doc.document_type.replace(/_/g," ")}</div>
                          <span style={{ fontSize:10, color:doc.status==="approved"?"#1d9e75":doc.status==="rejected"?"#e24b4a":"#e6821e", fontWeight:700 }}>
                            {doc.status}
                          </span>
                        </div>
                        <div style={{ display:"flex", gap:4, alignItems:"center" }}>
                          <a href={doc.document_url} target="_blank" rel="noopener noreferrer"
                            style={{ fontSize:10, color:"#378add", textDecoration:"none" }}>View</a>
                          {doc.status!=="approved"&&(
                            <button onClick={()=>verifyDoc(doc.id, m.id, "approved")}
                              style={{ background:"#f0fdf4", border:"1px solid #1d9e7530", borderRadius:5, color:"#1d9e75", fontSize:9, fontWeight:700, padding:"2px 6px", cursor:"pointer" }}>
                              ✓
                            </button>
                          )}
                          {doc.status!=="rejected"&&(
                            <button onClick={()=>verifyDoc(doc.id, m.id, "rejected")}
                              style={{ background:"#fff5f5", border:"1px solid #e24b4a30", borderRadius:5, color:"#e24b4a", fontSize:9, fontWeight:700, padding:"2px 6px", cursor:"pointer" }}>
                              ✗
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* SERVICES TAB */}
      {tab==="services"&&(
        <div>
          <div style={{ display:"flex", gap:6, marginBottom:"1rem", flexWrap:"wrap" }}>
            {["all","shop_standard","shop_premium","go_service"].map(k=>(
              <button key={k} onClick={()=>setCategoryFilter(k)}
                style={{ padding:"7px 14px", borderRadius:7, border:"none", fontSize:12, cursor:"pointer", background:categoryFilter===k?"#8b5cf6":"#f8f8f8", color:categoryFilter===k?"#fff":"#666", fontFamily:"'DM Sans',sans-serif" }}>
                {k==="all"?"All":CATEGORIES[k]?.label}
              </button>
            ))}
          </div>
          <div style={{ fontSize:12, color:"#888", marginBottom:10 }}>{filteredServices.length} service{filteredServices.length!==1?"s":""}</div>
          {filteredServices.map(s=>{
            const cat = CATEGORIES[s.category]||CATEGORIES.shop_standard
            const provider = providers.find(p=>p.id===s.provider_id)
            return (
              <div key={s.id} style={{ background:"#f8f8f8", border:`1px solid ${cat.color}20`, borderRadius:10, padding:"0.9rem", marginBottom:8, opacity:s.is_active?1:0.5 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:10 }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4, flexWrap:"wrap" }}>
                      <span>{cat.icon}</span>
                      <div style={{ fontSize:13, fontWeight:600, color:"#000000" }}>{s.name}</div>
                      <span style={{ fontSize:10, padding:"1px 7px", borderRadius:10, background:cat.bg, color:cat.color }}>{cat.label}</span>
                      {!s.is_active&&<span style={{ fontSize:10, color:"#888" }}>Inactive</span>}
                    </div>
                    <div style={{ fontSize:11, color:"#888", marginBottom:2 }}>🏪 {provider?.business_name||`${provider?.first_name} ${provider?.last_name}`}</div>
                    {s.description&&<div style={{ fontSize:11, color:"#888" }}>{s.description}</div>}
                  </div>
                  <div style={{ textAlign:"right", flexShrink:0 }}>
                    <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:800, color:"#e6821e" }}>KES {Number(s.price).toLocaleString()}</div>
                    <div style={{ fontSize:10, color:cat.color, marginTop:2 }}>{Math.round((s.platform_commission_rate||0.1)*100)}% platform</div>
                    <div style={{ fontSize:10, color:"#888" }}>⏱ {s.duration_minutes||60} min</div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* BOOKINGS TAB */}
      {tab==="bookings"&&(
        <div>
          <div style={{ display:"flex", gap:6, marginBottom:"1rem", flexWrap:"wrap" }}>
            {["all","shop_standard","shop_premium","go_service"].map(k=>(
              <button key={k} onClick={()=>setCategoryFilter(k)}
                style={{ padding:"7px 14px", borderRadius:7, border:"none", fontSize:12, cursor:"pointer", background:categoryFilter===k?"#8b5cf6":"#f8f8f8", color:categoryFilter===k?"#fff":"#666", fontFamily:"'DM Sans',sans-serif" }}>
                {k==="all"?"All":CATEGORIES[k]?.label}
              </button>
            ))}
          </div>
          <div style={{ fontSize:12, color:"#888", marginBottom:10 }}>{filteredBookings.length} booking{filteredBookings.length!==1?"s":""}</div>
          {filteredBookings.slice(0,50).map(b=>{
            const cat = CATEGORIES[b.service_category]||CATEGORIES.shop_standard
            return (
              <div key={b.id} style={{ background:"#f8f8f8", border:`1px solid ${cat.color}15`, borderRadius:10, padding:"0.9rem", marginBottom:8 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:10 }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:4, flexWrap:"wrap" }}>
                      <span>{cat.icon}</span>
                      <div style={{ fontSize:13, fontWeight:600, color:"#000000" }}>{b.service_name}</div>
                      <span style={{ fontSize:10, padding:"1px 7px", borderRadius:10, background:cat.bg, color:cat.color }}>{cat.label}</span>
                      <span style={{ fontSize:10, padding:"1px 7px", borderRadius:10, background:`${SC[b.status]||"#888"}20`, color:SC[b.status]||"#888" }}>{b.status}</span>
                    </div>
                    <div style={{ fontSize:11, color:"#888" }}>#{b.booking_number} · {b.booking_date}</div>
                    {b.assigned_mechanic_id&&<div style={{ fontSize:11, color:"#1d9e75", marginTop:2 }}>👨‍🔧 Mechanic assigned</div>}
                    {b.is_emergency&&<div style={{ fontSize:11, color:"#e24b4a", marginTop:2 }}>🚨 Emergency</div>}
                  </div>
                  <div style={{ textAlign:"right", flexShrink:0 }}>
                    <div style={{ fontFamily:"Syne", fontSize:13, fontWeight:800, color:"#e6821e" }}>KES {Number(b.total_amount).toLocaleString()}</div>
                    <div style={{ fontSize:10, color:"#888", marginTop:2 }}>{b.payment_status}</div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* GO REQUESTS TAB */}
      {tab==="go"&&(
        <div>
          <div style={{ display:"grid", gridTemplateColumns:isMobile?"repeat(2,1fr)":"repeat(4,1fr)", gap:10, marginBottom:"1.25rem" }}>
            {[
              { label:"Total", value:goRequests.length, color:"#e24b4a" },
              { label:"Pending", value:goRequests.filter(r=>r.status==="pending").length, color:"#e6821e" },
              { label:"Accepted", value:goRequests.filter(r=>r.status==="accepted").length, color:"#1d9e75" },
              { label:"Timed out", value:goRequests.filter(r=>r.status==="timeout").length, color:"#888" },
            ].map(s=>(
              <div key={s.label} style={{ background:"#f8f8f8", borderRadius:10, padding:"0.9rem", border:"1px solid #eeeeee" }}>
                <div style={{ fontSize:10, color:"#888", textTransform:"uppercase", marginBottom:4 }}>{s.label}</div>
                <div style={{ fontFamily:"Syne", fontSize:18, fontWeight:800, color:s.color }}>{s.value}</div>
              </div>
            ))}
          </div>
          {goRequests.length===0&&<div style={{ color:"#888", fontSize:13, textAlign:"center", padding:"2rem" }}>No GO requests yet</div>}
          {goRequests.map(r=>(
            <div key={r.id} style={{ background:"#f8f8f8", border:`1px solid ${GC[r.status]||"#eeeeee"}30`, borderRadius:10, padding:"0.9rem", marginBottom:8 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:10 }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4, flexWrap:"wrap" }}>
                    <span style={{ fontSize:18 }}>{EICONS[r.bookings?.emergency_type]||"🆘"}</span>
                    <div style={{ fontSize:13, fontWeight:600, color:"#000000" }}>{r.bookings?.emergency_type?.replace(/_/g," ")||r.bookings?.service_name}</div>
                    <span style={{ fontSize:10, padding:"2px 8px", borderRadius:10, background:`${GC[r.status]||"#888"}20`, color:GC[r.status]||"#888" }}>{r.status}</span>
                    <span style={{ fontSize:10, color:"#888" }}>Attempt {r.attempt_number}/5</span>
                  </div>
                  <div style={{ fontSize:11, color:"#888", marginBottom:2 }}>📍 {r.bookings?.emergency_location_address||"—"}</div>
                  <div style={{ fontSize:11, color:"#378add" }}>🏪 {r.profiles?.business_name||`${r.profiles?.first_name||""} ${r.profiles?.last_name||""}`}</div>
                  <div style={{ fontSize:10, color:"#888", marginTop:2 }}>{new Date(r.sent_at).toLocaleString()}</div>
                </div>
                <div style={{ textAlign:"right", flexShrink:0 }}>
                  <div style={{ fontFamily:"Syne", fontSize:13, fontWeight:800, color:"#e6821e" }}>KES {Number(r.bookings?.total_amount||0).toLocaleString()}</div>
                  {r.responded_at&&<div style={{ fontSize:10, color:"#888", marginTop:2 }}>{new Date(r.responded_at).toLocaleTimeString()}</div>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MAP TAB */}
      {tab==="map"&&(
        <div>
          <div style={{ background:"#f8f8f8", border:"1px solid #eeeeee", borderRadius:12, padding:"1rem", marginBottom:"1rem" }}>
            <div style={{ fontFamily:"Syne", fontSize:13, fontWeight:700, color:"#000000", marginBottom:6 }}>Live mechanic map</div>
            <div style={{ display:"flex", gap:12, marginBottom:10, flexWrap:"wrap" }}>
              <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                <div style={{ width:12, height:12, borderRadius:"50%", background:"#1d9e75" }}/>
                <span style={{ fontSize:11, color:"#888" }}>Available ({available})</span>
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                <div style={{ width:12, height:12, borderRadius:"50%", background:"#e6821e" }}/>
                <span style={{ fontSize:11, color:"#888" }}>On job ({onJob})</span>
              </div>
              <div style={{ fontSize:11, color:"#888" }}>{liveCount} live location{liveCount!==1?"s":""}</div>
            </div>
            <div ref={mapRef} style={{ height:isMobile?300:450, borderRadius:10, overflow:"hidden", background:"#f5f5f5" }}>
              {liveCount===0&&(
                <div style={{ height:"100%", display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:8 }}>
                  <div style={{ fontSize:32 }}>🗺️</div>
                  <div style={{ fontSize:12, color:"#888" }}>No mechanics sharing location</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
