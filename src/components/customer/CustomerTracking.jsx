import { useEffect, useState, useRef } from "react"
import { supabase } from "../../lib/supabase"
import { useAuth } from "../../contexts/AuthContext"
import useIsMobile from "../../lib/useIsMobile"

const CONCIERGE_STEPS = [
  { key:"accepted", label:"Driver assigned", color:"#378add" },
  { key:"pickup", label:"Driver at pickup", color:"#e6821e" },
  { key:"in_transit", label:"En route to provider", color:"#8b5cf6" },
  { key:"at_provider", label:"At service provider", color:"#1d9e75" },
  { key:"return_transit", label:"Returning your car", color:"#8b5cf6" },
  { key:"dropoff", label:"Driver at dropoff", color:"#e6821e" },
  { key:"completed", label:"Delivered", color:"#1d9e75" },
]

export default function CustomerTracking() {
  const { user } = useAuth()
  const isMobile = useIsMobile()
  const [activeBookings, setActiveBookings] = useState([])
  const [selected, setSelected] = useState(null)
  const [driver, setDriver] = useState(null)
  const [mechanic, setMechanic] = useState(null)
  const [loading, setLoading] = useState(true)
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const driverMarkerRef = useRef(null)
  const mechanicMarkerRef = useRef(null)

  useEffect(() => {
    if (!user) return
    load()
    // Realtime order delivery updates
    const sub = supabase.channel("customer-delivery-updates")
      .on("postgres_changes", { event:"UPDATE", schema:"public", table:"orders", filter:`customer_id=eq.${user.id}` },
        payload => {
          const status = payload.new.delivery_status
          if (status==="picked_up") toast("📦 Driver picked up your order!", { icon:"🚚", duration:8000 })
          if (status==="delivered") toast.success("✅ Order delivered! Please confirm receipt.")
          load()
        })
      .subscribe()
    return () => supabase.removeChannel(sub)
  }, [user])

  useEffect(() => {
    if (!selected) return
    if (selected.driver_id) loadDriver(selected)
    if (selected.assigned_mechanic_id) loadMechanic(selected)
    // Live update every 10 seconds
    const interval = setInterval(() => {
      if (selected.driver_id) loadDriver(selected)
      if (selected.assigned_mechanic_id) loadMechanic(selected)
    }, 10000)

    const sub = supabase.channel(`tracking-${selected.id}`)
      .on("postgres_changes", { event:"INSERT", schema:"public", table:"driver_location_history", filter:`booking_id=eq.${selected.id}` },
        payload => {
          const lat = payload.new.lat || payload.new.latitude
          const lng = payload.new.lng || payload.new.longitude
          setDriver(d=>d?{...d,current_lat:lat,current_lng:lng}:d)
          // Smoothly move marker
          if (driverMarkerRef.current) {
            driverMarkerRef.current.setLatLng([lat, lng])
            if (mapInstanceRef.current) mapInstanceRef.current.panTo([lat, lng], {animate:true, duration:1})
          }
        })
      .on("postgres_changes", { event:"INSERT", schema:"public", table:"mechanic_location_history", filter:`booking_id=eq.${selected.id}` },
        payload => {
          const { latitude, longitude } = payload.new
          setMechanic(m=>m?{...m,current_latitude:latitude,current_longitude:longitude}:m)
          if (mechanicMarkerRef.current) mechanicMarkerRef.current.setLatLng([latitude, longitude])
        })
      .on("postgres_changes", { event:"UPDATE", schema:"public", table:"bookings", filter:`id=eq.${selected.id}` },
        payload => setSelected(s=>({...s,...payload.new})))
      .subscribe()
    return () => { supabase.removeChannel(sub); clearInterval(interval) }
  }, [selected?.id])

  useEffect(() => {
    if (!selected || !mapRef.current) return
    if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null }

    setTimeout(() => {
      if (!mapRef.current || !window.L) return
      const L = window.L
      const lat = driver?.current_lat || mechanic?.current_latitude || -1.2921
      const lng = driver?.current_lng || mechanic?.current_longitude || 36.8219
      const map = L.map(mapRef.current, { zoomControl:true, attributionControl:false }).setView([lat, lng], 14)
      // Better looking map tiles
      L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
        maxZoom:19,
        subdomains:"abcd"
      }).addTo(map)

      if (driver?.current_lat) {
        const driverIcon = L.divIcon({ className:"", html:`<div style="position:relative"><div style="position:absolute;inset:-8px;border-radius:50%;border:2px solid #378add;animation:ping 1.5s ease-out infinite;opacity:0.6"></div><div style="background:#378add;width:42px;height:42px;border-radius:50%;border:3px solid #fff;display:flex;align-items:center;justify-content:center;font-size:20px;box-shadow:0 4px 12px rgba(55,138,221,0.5);">🚗</div></div>`, iconSize:[42,42], iconAnchor:[21,21] })
        driverMarkerRef.current = L.marker([driver.current_lat, driver.current_lng], { icon:driverIcon }).addTo(map).bindPopup(`Driver: ${driver.first_name} ${driver.last_name}`)
      }

      if (mechanic?.current_latitude) {
        const mechanicIcon = L.divIcon({ className:"", html:`<div style="position:relative"><div style="position:absolute;inset:-8px;border-radius:50%;border:2px solid #1d9e75;animation:ping 1.5s ease-out infinite;opacity:0.6"></div><div style="background:#1d9e75;width:42px;height:42px;border-radius:50%;border:3px solid #fff;display:flex;align-items:center;justify-content:center;font-size:20px;box-shadow:0 4px 12px rgba(29,158,117,0.5);">👨‍🔧</div></div>`, iconSize:[42,42], iconAnchor:[21,21] })
        mechanicMarkerRef.current = L.marker([mechanic.current_latitude, mechanic.current_longitude], { icon:mechanicIcon }).addTo(map).bindPopup(`Mechanic: ${mechanic.first_name} ${mechanic.last_name}`)
      }

      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(pos => {
          const customerIcon = L.divIcon({ className:"", html:`<div style="background:#e6821e;width:38px;height:38px;border-radius:50%;border:3px solid #fff;display:flex;align-items:center;justify-content:center;font-size:18px;box-shadow:0 2px 8px rgba(0,0,0,0.3);">👤</div>`, iconSize:[38,38], iconAnchor:[19,19] })
          L.marker([pos.coords.latitude, pos.coords.longitude], { icon:customerIcon }).addTo(map).bindPopup("Your location")
        })
      }
      mapInstanceRef.current = map
    }, 150)

    return () => { if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null } }
  }, [selected?.id, driver?.current_lat, mechanic?.current_latitude])

  async function load() {
    const { data } = await supabase.from("bookings").select("*")
      .eq("customer_id", user.id)
      .not("status", "in", '("completed","cancelled")')
      .order("created_at", { ascending:false })
    setActiveBookings(data||[])
    setLoading(false)
  }

  async function loadDriver(booking) {
    if (!booking.driver_id) return
    const [{ data: prof }, { data: status }] = await Promise.all([
      supabase.from("profiles").select("first_name,last_name").eq("id", booking.driver_id).single(),
      supabase.from("driver_status").select("current_latitude,current_longitude,is_online").eq("driver_id", booking.driver_id).maybeSingle(),
    ])
    setDriver({ ...prof, current_lat:status?.current_latitude, current_lng:status?.current_longitude, is_online:status?.is_online })
  }

  async function loadMechanic(booking) {
    if (!booking.assigned_mechanic_id) return
    const { data } = await supabase.from("mechanics").select("*").eq("id", booking.assigned_mechanic_id).single()
    setMechanic(data)
  }

  const SC = { pending:"#e6821e", confirmed:"#378add", "in-progress":"#8b5cf6", completed:"#1d9e75", "driver-assigned":"#1d9e75" }

  if (selected) return (
    <div>
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"/>
      <style>{`
        @keyframes ping { 0%{transform:scale(1);opacity:0.6} 100%{transform:scale(2.5);opacity:0} }
        .leaflet-container { background:#1a1a1a !important; }
      `}</style>

      <button onClick={()=>{ setSelected(null); setDriver(null); setMechanic(null); if(mapInstanceRef.current){mapInstanceRef.current.remove();mapInstanceRef.current=null} }}
        style={{ background:"none", border:"none", color:"#e6821e", cursor:"pointer", fontSize:13, marginBottom:"1rem", fontFamily:"'DM Sans',sans-serif", padding:0 }}>
        ← Back to bookings
      </button>

      <div style={{ background:"#ffffff", border:"1px solid #eeeeee", borderRadius:12, padding:"1rem", marginBottom:"1rem" }}>
        <div style={{ fontFamily:"Syne", fontSize:15, fontWeight:800, color:"#000000", marginBottom:4 }}>{selected.service_name}</div>
        <div style={{ display:"flex", gap:10, flexWrap:"wrap", marginBottom:10 }}>
          <span style={{ fontSize:11, padding:"2px 8px", borderRadius:10, background:`${SC[selected.status]||"#888"}20`, color:SC[selected.status]||"#888" }}>{selected.status}</span>
          {selected.concierge_status&&<span style={{ fontSize:11, padding:"2px 8px", borderRadius:10, background:"#160a2e", color:"#8b5cf6" }}>{selected.concierge_status?.replace("_"," ")}</span>}
          <span style={{ fontSize:11, color:"#777777" }}>#{selected.booking_number}</span>
        </div>

        {/* Concierge progress */}
        {(driver?.current_lat||mechanic?.current_latitude)&&(
          <div style={{ background:"#071a12", border:"1px solid #1d9e7540", borderRadius:8, padding:"0.75rem", marginBottom:10, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <div style={{ width:8, height:8, borderRadius:"50%", background:"#1d9e75", boxShadow:"0 0 6px #1d9e75", animation:"ping 1.5s ease-out infinite" }}/>
              <span style={{ fontSize:12, color:"#1d9e75", fontWeight:600 }}>Live tracking active</span>
            </div>
            <span style={{ fontSize:11, color:"#777777" }}>Updates every 10s</span>
          </div>
        )}
        {selected.is_concierge&&selected.concierge_status&&(
          <div style={{ marginBottom:12 }}>
            <div style={{ fontSize:11, color:"#777777", marginBottom:6 }}>Delivery progress</div>
            <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
              {CONCIERGE_STEPS.map((step,i)=>{
                const currentIdx = CONCIERGE_STEPS.findIndex(s=>s.key===selected.concierge_status)
                const isDone = i <= currentIdx
                return (
                  <div key={step.key} style={{ fontSize:9, padding:"2px 6px", borderRadius:6, background:isDone?`${step.color}20`:"#1a1a1a", color:isDone?step.color:"#333", border:`1px solid ${isDone?step.color+"30":"#222"}` }}>
                    {step.label}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Driver info */}
        {driver&&(
          <div style={{ background:"#ffffff", borderRadius:10, padding:"0.9rem", marginBottom:10 }}>
            <div style={{ fontSize:11, color:"#777777", marginBottom:6 }}>Your driver</div>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <div style={{ width:40, height:40, borderRadius:"50%", background:"#0c1f2e", border:"2px solid #378add40", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"Syne", fontSize:14, fontWeight:800, color:"#378add", flexShrink:0 }}>
                {driver.first_name?.[0]}{driver.last_name?.[0]}
              </div>
              <div>
                <div style={{ fontSize:13, fontWeight:600, color:"#000000" }}>{driver.first_name} {driver.last_name}</div>
                <div style={{ fontSize:11, color:"#777777" }}>Concierge Driver</div>
              </div>
              <div style={{ marginLeft:"auto" }}>
                <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                  <div style={{ width:7, height:7, borderRadius:"50%", background:driver.current_lat?"#378add":"#555", boxShadow:driver.current_lat?"0 0 6px #378add":"none" }}/>
                  <span style={{ fontSize:10, color:driver.current_lat?"#378add":"#555" }}>
                    {driver.current_lat?"Live":"No location"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Mechanic info */}
        {mechanic&&(
          <div style={{ background:"#ffffff", borderRadius:10, padding:"0.9rem", marginBottom:10 }}>
            <div style={{ fontSize:11, color:"#777777", marginBottom:6 }}>Your mechanic</div>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <div style={{ width:40, height:40, borderRadius:"50%", background:"#071a12", border:"2px solid #1d9e7540", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"Syne", fontSize:14, fontWeight:800, color:"#1d9e75", flexShrink:0 }}>
                {mechanic.first_name?.[0]}{mechanic.last_name?.[0]}
              </div>
              <div>
                <div style={{ fontSize:13, fontWeight:600, color:"#000000" }}>{mechanic.first_name} {mechanic.last_name}</div>
                <div style={{ fontSize:11, color:"#777777" }}>🔧 {mechanic.specialization}</div>
                {mechanic.phone&&<div style={{ fontSize:11, color:"#777777" }}>📞 {mechanic.phone}</div>}
              </div>
              <div style={{ marginLeft:"auto" }}>
                <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                  <div style={{ width:7, height:7, borderRadius:"50%", background:mechanic.current_latitude?"#1d9e75":"#555", boxShadow:mechanic.current_latitude?"0 0 6px #1d9e75":"none" }}/>
                  <span style={{ fontSize:10, color:mechanic.current_latitude?"#1d9e75":"#555" }}>
                    {mechanic.current_latitude?"Live":"No location"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Map */}
        <div ref={mapRef} style={{ height:isMobile?260:350, borderRadius:10, overflow:"hidden", background:"#f5f5f5" }}>
          {!driver?.current_lat&&!mechanic?.current_latitude&&(
            <div style={{ height:"100%", display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:8 }}>
              <div style={{ fontSize:32 }}>🗺️</div>
              <div style={{ fontSize:12, color:"#777777" }}>Waiting for location...</div>
            </div>
          )}
        </div>

        {/* Map legend */}
        <div style={{ display:"flex", gap:12, marginTop:8, flexWrap:"wrap" }}>
          {driver&&<div style={{ display:"flex", alignItems:"center", gap:5 }}><span style={{ fontSize:14 }}>🚗</span><span style={{ fontSize:10, color:"#777777" }}>Driver</span></div>}
          {mechanic&&<div style={{ display:"flex", alignItems:"center", gap:5 }}><span style={{ fontSize:14 }}>👨‍🔧</span><span style={{ fontSize:10, color:"#777777" }}>Mechanic</span></div>}
          <div style={{ display:"flex", alignItems:"center", gap:5 }}><span style={{ fontSize:14 }}>👤</span><span style={{ fontSize:10, color:"#777777" }}>You</span></div>
        </div>
      </div>
    </div>
  )

  return (
    <div>
      <div style={{ fontFamily:"Syne", fontSize:isMobile?16:18, fontWeight:800, color:"#000000", marginBottom:4 }}>Track your service</div>
      <div style={{ fontSize:12, color:"#777777", marginBottom:"1.25rem" }}>Live tracking for active bookings</div>

      {loading&&<div style={{ color:"#777777", fontSize:13 }}>Loading...</div>}
      {!loading&&activeBookings.length===0&&(
        <div style={{ color:"#888888", fontSize:13, textAlign:"center", padding:"3rem" }}>
          <div style={{ fontSize:32, marginBottom:10 }}>📍</div>
          No active bookings to track
        </div>
      )}

      {activeBookings.map(b=>(
        <div key={b.id} onClick={()=>{ setSelected(b); setDriver(null); setMechanic(null) }}
          style={{ background:"#ffffff", border:`1px solid ${SC[b.status]||"#1e1e1e"}30`, borderRadius:12, padding:isMobile?"0.9rem":"1.1rem", marginBottom:10, cursor:"pointer" }}
          onMouseEnter={e=>e.currentTarget.style.background="#161616"}
          onMouseLeave={e=>e.currentTarget.style.background="#111"}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
            <div>
              <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:700, color:"#000000", marginBottom:4 }}>{b.service_name}</div>
              <div style={{ fontSize:11, color:"#777777", marginBottom:4 }}>#{b.booking_number} · {b.booking_date}</div>
              <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                <span style={{ fontSize:10, padding:"2px 8px", borderRadius:10, background:`${SC[b.status]||"#888"}20`, color:SC[b.status]||"#888" }}>{b.status}</span>
                {b.is_concierge&&<span style={{ fontSize:10, padding:"2px 8px", borderRadius:10, background:"#0c1f2e", color:"#378add" }}>Concierge</span>}
                {b.is_emergency&&<span style={{ fontSize:10, padding:"2px 8px", borderRadius:10, background:"#1a0808", color:"#e24b4a" }}>🚨 Emergency</span>}
              </div>
            </div>
            <div style={{ textAlign:"right" }}>
              <div style={{ fontSize:12, color:"#e6821e", marginBottom:4 }}>KES {Number(b.total_amount).toLocaleString()}</div>
              <div style={{ fontSize:11, color:"#777777" }}>
                {b.driver_id?"🚗 Driver assigned":b.assigned_mechanic_id?"👨‍🔧 Mechanic assigned":"⏳ Pending"}
              </div>
              <div style={{ fontSize:11, color:"#378add", marginTop:4 }}>Track →</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}









