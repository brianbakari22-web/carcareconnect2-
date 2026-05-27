import { useEffect, useState, useRef } from "react"
import { supabase } from "../../lib/supabase"
import useIsMobile from "../../lib/useIsMobile"
import toast from "react-hot-toast"

export default function AdminMechanics() {
  const isMobile = useIsMobile()
  const [mechanics, setMechanics] = useState([])
  const [providers, setProviders] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState("all")
  const [tab, setTab] = useState("mechanics")
  const [services, setServices] = useState([])
  const [bookings, setBookings] = useState([])
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [goRequests, setGoRequests] = useState([])
  
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)

  useEffect(() => {
    load()
    loadGoRequests()
    const sub = supabase.channel("admin-mechanics-live")
      .on("postgres_changes", { event:"*", schema:"public", table:"mechanics" }, () => load())
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
    const [{ data: mechs }, { data: provs }, { data: svcs }] = await Promise.all([
      supabase.from("mechanics").select("*").order("created_at", { ascending:false }),
      supabase.from("profiles").select("id,first_name,last_name,business_name,city").eq("role","provider"),
      supabase.from("services").select("*").order("created_at", { ascending:false }),
    ])
    setMechanics(mechs||[])
    setProviders(provs||[])
    setServices(svcs||[])
    setLoading(false)
    loadBookings()
    loadGoRequests()
  }

  async function loadGoRequests() {
    const { data } = await supabase.from("go_service_requests").select("*, bookings(*), profiles(first_name,last_name,business_name)").order("sent_at", { ascending:false }).limit(50)
    setGoRequests(data||[])
  }

  async function loadBookings()
    loadGoRequests() {
    const { data } = await supabase.from("bookings").select("*").order("created_at", { ascending:false }).limit(100)
    setBookings(data||[])
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
          .bindPopup(`<b>${m.first_name} ${m.last_name}</b><br>${m.specialization}<br>${provider?.business_name||"Unknown provider"}<br>Status: ${m.is_available?"Available":"On job"}`)
      })
      mapInstanceRef.current = map
    }, 200)
  }

  function getProvider(id) {
    const p = providers.find(p=>p.id===id)
    return p ? (p.business_name||`${p.first_name} ${p.last_name}`) : "Unknown"
  }

  const CATEGORIES = {
    shop_standard: { label:"Shop Standard", icon:"🏪", color:"#378add", bg:"#0c1f2e" },
    shop_premium: { label:"Shop Premium", icon:"🏡", color:"#8b5cf6", bg:"#160a2e" },
    go_service: { label:"GO Service", icon:"🚨", color:"#e24b4a", bg:"#1a0808" },
  }

  const filteredMechanics = mechanics.filter(m => {
    const matchSearch = `${m.first_name} ${m.last_name} ${m.specialization||""} ${m.phone||""}`.toLowerCase().includes(search.toLowerCase())
    const matchFilter = filter==="all" || (filter==="available"&&m.is_available&&m.is_active) || (filter==="on_job"&&!m.is_available&&m.is_active) || (filter==="inactive"&&!m.is_active)
    return matchSearch && matchFilter
  })

  const filteredServices = categoryFilter==="all" ? services : services.filter(s=>s.category===categoryFilter)
  const filteredBookings = categoryFilter==="all" ? bookings : bookings.filter(b=>b.service_category===categoryFilter)

  const available = mechanics.filter(m=>m.is_available&&m.is_active).length
  const onJob = mechanics.filter(m=>!m.is_available&&m.is_active).length
  const liveCount = mechanics.filter(m=>m.current_latitude).length

  const SC = { pending:"#e6821e", confirmed:"#378add", "in-progress":"#8b5cf6", completed:"#1d9e75", cancelled:"#e24b4a" }

  return (
    <div>
      <style>{`@import url('https://unpkg.com/leaflet@1.9.4/dist/leaflet.css');`}</style>
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"/>

      {/* Overview stats */}
      <div style={{ display:"grid", gridTemplateColumns:isMobile?"repeat(2,1fr)":"repeat(4,1fr)", gap:10, marginBottom:"1.5rem" }}>
        {[
          { label:"Total mechanics", value:mechanics.length, color:"#f0ede6" },
          { label:"Available now", value:available, color:"#1d9e75" },
          { label:"On job", value:onJob, color:"#e6821e" },
          { label:"Live tracking", value:liveCount, color:"#8b5cf6" },
        ].map(s=>(
          <div key={s.label} style={{ background:"#111", borderRadius:10, padding:isMobile?"0.75rem":"1rem", border:"1px solid #1e1e1e" }}>
            <div style={{ fontSize:10, color:"#555", textTransform:"uppercase", marginBottom:4 }}>{s.label}</div>
            <div style={{ fontFamily:"Syne", fontSize:isMobile?16:20, fontWeight:800, color:s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Service category stats */}
      <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"repeat(3,1fr)", gap:10, marginBottom:"1.5rem" }}>
        {Object.entries(CATEGORIES).map(([key, cat])=>(
          <div key={key} style={{ background:cat.bg, border:`1px solid ${cat.color}30`, borderRadius:12, padding:"1rem" }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
              <span style={{ fontSize:20 }}>{cat.icon}</span>
              <div style={{ fontFamily:"Syne", fontSize:13, fontWeight:800, color:cat.color }}>{cat.label}</div>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
              <div>
                <div style={{ fontSize:10, color:"#555", marginBottom:2 }}>Services</div>
                <div style={{ fontFamily:"Syne", fontSize:18, fontWeight:800, color:cat.color }}>{services.filter(s=>s.category===key).length}</div>
              </div>
              <div>
                <div style={{ fontSize:10, color:"#555", marginBottom:2 }}>Bookings</div>
                <div style={{ fontFamily:"Syne", fontSize:18, fontWeight:800, color:cat.color }}>{bookings.filter(b=>b.service_category===key).length}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display:"flex", gap:6, marginBottom:"1.25rem", flexWrap:"wrap" }}>
        {[
          { k:"mechanics", l:"👨‍🔧 Mechanics" },
          { k:"services", l:"🔧 Services by category" },
          { k:"bookings", l:"📅 Bookings by category" },
          { k:"map", l:"🗺️ Live map" },
          { k:"go", l:"🚨 GO Requests" },
          { k:"go", l:"🚨 GO Requests" },
        ].map(t=>(
          <button key={t.k} onClick={()=>setTab(t.k)}
            style={{ padding:"8px 16px", borderRadius:8, border:"none", fontSize:12, cursor:"pointer", background:tab===t.k?"#8b5cf6":"#111", color:tab===t.k?"#fff":"#666", fontFamily:"'DM Sans',sans-serif", fontWeight:tab===t.k?700:400 }}>
            {t.l}
          </button>
        ))}
      </div>

      {/* MECHANICS TAB */}
      {tab==="mechanics"&&(
        <div>
          <div style={{ display:"flex", gap:8, marginBottom:"1rem", flexWrap:"wrap" }}>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search mechanics..."
              style={{ flex:1, minWidth:180, background:"#111", border:"1px solid #222", borderRadius:8, padding:"9px 12px", color:"#f0ede6", fontSize:13, outline:"none" }}/>
            {["all","available","on_job","inactive"].map(f=>(
              <button key={f} onClick={()=>setFilter(f)}
                style={{ padding:"8px 14px", borderRadius:7, border:"none", fontSize:12, cursor:"pointer", background:filter===f?"#8b5cf6":"#111", color:filter===f?"#fff":"#666", fontFamily:"'DM Sans',sans-serif" }}>
                {f==="all"?"All":f==="on_job"?"On job":f.charAt(0).toUpperCase()+f.slice(1)}
              </button>
            ))}
          </div>

          {loading&&<div style={{ color:"#555", fontSize:13 }}>Loading...</div>}
          {!loading&&filteredMechanics.length===0&&<div style={{ color:"#444", fontSize:13, textAlign:"center", padding:"2rem" }}>No mechanics found</div>}

          {filteredMechanics.map(m=>(
            <div key={m.id} style={{ background:"#111", border:`1px solid ${m.is_active?m.is_available?"#1d9e7530":"#e6821e30":"#1e1e1e"}`, borderRadius:10, padding:isMobile?"0.75rem":"1rem", marginBottom:8, opacity:m.is_active?1:0.6 }}>
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
                    {m.current_latitude&&<span style={{ fontSize:10, color:"#8b5cf6" }}>📍 Live</span>}
                  </div>
                  <div style={{ fontSize:11, color:"#555", marginBottom:2 }}>🔧 {m.specialization}</div>
                  {m.phone&&<div style={{ fontSize:11, color:"#555", marginBottom:2 }}>📞 {m.phone}</div>}
                  <div style={{ fontSize:11, color:"#378add" }}>🏪 {getProvider(m.provider_id)}</div>
                  {m.last_location_update&&<div style={{ fontSize:10, color:"#444", marginTop:2 }}>Last seen: {new Date(m.last_location_update).toLocaleString()}</div>}
                </div>
                {m.current_latitude&&(
                  <div style={{ textAlign:"right", flexShrink:0 }}>
                    <div style={{ fontSize:10, color:"#555", marginBottom:2 }}>Location</div>
                    <div style={{ fontSize:10, color:"#8b5cf6", fontFamily:"monospace" }}>{m.current_latitude?.toFixed(4)}</div>
                    <div style={{ fontSize:10, color:"#8b5cf6", fontFamily:"monospace" }}>{m.current_longitude?.toFixed(4)}</div>
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
                style={{ padding:"7px 14px", borderRadius:7, border:"none", fontSize:12, cursor:"pointer", background:categoryFilter===k?"#8b5cf6":"#111", color:categoryFilter===k?"#fff":"#666", fontFamily:"'DM Sans',sans-serif" }}>
                {k==="all"?"All":CATEGORIES[k]?.label}
              </button>
            ))}
          </div>
          <div style={{ fontSize:12, color:"#555", marginBottom:10 }}>{filteredServices.length} service{filteredServices.length!==1?"s":""}</div>
          {filteredServices.map(s=>{
            const cat = CATEGORIES[s.category]||CATEGORIES.shop_standard
            const provider = providers.find(p=>p.id===s.provider_id)
            return (
              <div key={s.id} style={{ background:"#111", border:`1px solid ${cat.color}20`, borderRadius:10, padding:"0.9rem", marginBottom:8, opacity:s.is_active?1:0.5 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:10 }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4, flexWrap:"wrap" }}>
                      <span>{cat.icon}</span>
                      <div style={{ fontSize:13, fontWeight:600, color:"#f0ede6" }}>{s.name}</div>
                      <span style={{ fontSize:10, padding:"1px 7px", borderRadius:10, background:cat.bg, color:cat.color }}>{cat.label}</span>
                      {!s.is_active&&<span style={{ fontSize:10, color:"#555" }}>Inactive</span>}
                    </div>
                    <div style={{ fontSize:11, color:"#555", marginBottom:2 }}>🏪 {provider?.business_name||`${provider?.first_name} ${provider?.last_name}`}</div>
                    {s.description&&<div style={{ fontSize:11, color:"#444", marginBottom:2 }}>{s.description}</div>}
                  </div>
                  <div style={{ textAlign:"right", flexShrink:0 }}>
                    <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:800, color:"#e6821e" }}>KES {Number(s.price).toLocaleString()}</div>
                    <div style={{ fontSize:10, color:cat.color, marginTop:2 }}>{Math.round((s.platform_commission_rate||0.1)*100)}% platform fee</div>
                    <div style={{ fontSize:10, color:"#555" }}>⏱ {s.duration_minutes||60} min</div>
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
                style={{ padding:"7px 14px", borderRadius:7, border:"none", fontSize:12, cursor:"pointer", background:categoryFilter===k?"#8b5cf6":"#111", color:categoryFilter===k?"#fff":"#666", fontFamily:"'DM Sans',sans-serif" }}>
                {k==="all"?"All":CATEGORIES[k]?.label}
              </button>
            ))}
          </div>
          <div style={{ fontSize:12, color:"#555", marginBottom:10 }}>{filteredBookings.length} booking{filteredBookings.length!==1?"s":""}</div>
          {filteredBookings.slice(0,50).map(b=>{
            const cat = CATEGORIES[b.service_category]||CATEGORIES.shop_standard
            return (
              <div key={b.id} style={{ background:"#111", border:`1px solid ${cat.color}15`, borderRadius:10, padding:"0.9rem", marginBottom:8 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:10 }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:4, flexWrap:"wrap" }}>
                      <span>{cat.icon}</span>
                      <div style={{ fontSize:13, fontWeight:600, color:"#f0ede6" }}>{b.service_name}</div>
                      <span style={{ fontSize:10, padding:"1px 7px", borderRadius:10, background:cat.bg, color:cat.color }}>{cat.label}</span>
                      <span style={{ fontSize:10, padding:"1px 7px", borderRadius:10, background:`${SC[b.status]||"#888"}20`, color:SC[b.status]||"#888" }}>{b.status}</span>
                    </div>
                    <div style={{ fontSize:11, color:"#555" }}>#{b.booking_number} · {b.booking_date}</div>
                    {b.assigned_mechanic_id&&<div style={{ fontSize:11, color:"#1d9e75", marginTop:2 }}>👨‍🔧 Mechanic assigned</div>}
                  </div>
                  <div style={{ textAlign:"right", flexShrink:0 }}>
                    <div style={{ fontFamily:"Syne", fontSize:13, fontWeight:800, color:"#e6821e" }}>KES {Number(b.total_amount).toLocaleString()}</div>
                    <div style={{ fontSize:10, color:"#555", marginTop:2 }}>{b.payment_status}</div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {tab==="go"&&(
        <div>
          <div style={{ display:"grid", gridTemplateColumns:isMobile?"repeat(2,1fr)":"repeat(4,1fr)", gap:10, marginBottom:"1.25rem" }}>
            {[
              { label:"Total", value:goRequests.length, color:"#e24b4a" },
              { label:"Pending", value:goRequests.filter(r=>r.status==="pending").length, color:"#e6821e" },
              { label:"Accepted", value:goRequests.filter(r=>r.status==="accepted").length, color:"#1d9e75" },
              { label:"Timed out", value:goRequests.filter(r=>r.status==="timeout").length, color:"#555" },
            ].map(s=>(
              <div key={s.label} style={{ background:"#111", borderRadius:10, padding:"0.9rem", border:"1px solid #1e1e1e" }}>
                <div style={{ fontSize:10, color:"#555", textTransform:"uppercase", marginBottom:4 }}>{s.label}</div>
                <div style={{ fontFamily:"Syne", fontSize:18, fontWeight:800, color:s.color }}>{s.value}</div>
              </div>
            ))}
          </div>
          {goRequests.length===0&&<div style={{ color:"#444", fontSize:13, textAlign:"center", padding:"2rem" }}>No GO requests yet</div>}
          {goRequests.map(r=>{
            const EICONS = { flat_tire:"🛞", dead_battery:"🔋", out_of_fuel:"⛽", car_wont_start:"🔑", overheating:"🌡️", towing:"🚚", other:"🆘" }
            const SC = { pending:"#e6821e", accepted:"#1d9e75", declined:"#e24b4a", timeout:"#555" }
            return (
              <div key={r.id} style={{ background:"#111", border:`1px solid ${SC[r.status]||"#1e1e1e"}30`, borderRadius:10, padding:"0.9rem", marginBottom:8 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:10 }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4, flexWrap:"wrap" }}>
                      <span style={{ fontSize:18 }}>{EICONS[r.bookings?.emergency_type]||"🆘"}</span>
                      <div style={{ fontSize:13, fontWeight:600, color:"#f0ede6" }}>{r.bookings?.emergency_type?.replace(/_/g," ")}</div>
                      <span style={{ fontSize:10, padding:"2px 8px", borderRadius:10, background:`${SC[r.status]||"#888"}20`, color:SC[r.status]||"#888" }}>{r.status}</span>
                      <span style={{ fontSize:10, color:"#555" }}>Attempt {r.attempt_number} of 5</span>
                    </div>
                    <div style={{ fontSize:11, color:"#555", marginBottom:2 }}>📍 {r.bookings?.emergency_location_address}</div>
                    <div style={{ fontSize:11, color:"#378add" }}>🏪 {r.profiles?.business_name||`${r.profiles?.first_name} ${r.profiles?.last_name}`}</div>
                    <div style={{ fontSize:10, color:"#444", marginTop:2 }}>{new Date(r.sent_at).toLocaleString()}</div>
                  </div>
                  <div style={{ textAlign:"right", flexShrink:0 }}>
                    <div style={{ fontFamily:"Syne", fontSize:13, fontWeight:800, color:"#e6821e" }}>KES {Number(r.bookings?.total_amount||0).toLocaleString()}</div>
                    {r.responded_at&&<div style={{ fontSize:10, color:"#444", marginTop:2 }}>Responded: {new Date(r.responded_at).toLocaleTimeString()}</div>}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* MAP TAB */}
      {tab==="map"&&(
        <div>
          <div style={{ background:"#111", border:"1px solid #1e1e1e", borderRadius:12, padding:"1rem", marginBottom:"1rem" }}>
            <div style={{ fontFamily:"Syne", fontSize:13, fontWeight:700, color:"#f0ede6", marginBottom:6 }}>Live mechanic map</div>
            <div style={{ display:"flex", gap:12, marginBottom:10, flexWrap:"wrap" }}>
              <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                <div style={{ width:12, height:12, borderRadius:"50%", background:"#1d9e75" }}/>
                <span style={{ fontSize:11, color:"#555" }}>Available ({available})</span>
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                <div style={{ width:12, height:12, borderRadius:"50%", background:"#e6821e" }}/>
                <span style={{ fontSize:11, color:"#555" }}>On job ({onJob})</span>
              </div>
              <div style={{ fontSize:11, color:"#444" }}>
                {liveCount} mechanic{liveCount!==1?"s":""} sharing live location
              </div>
            </div>
            <div ref={mapRef} style={{ height:isMobile?300:450, borderRadius:10, overflow:"hidden", background:"#1a1a1a" }}>
              {liveCount===0&&(
                <div style={{ height:"100%", display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:8 }}>
                  <div style={{ fontSize:32 }}>🗺️</div>
                  <div style={{ fontSize:12, color:"#555" }}>No mechanics sharing location currently</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}






