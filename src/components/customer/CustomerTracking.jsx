import { useEffect, useState, useRef } from "react"
import { supabase } from "../../lib/supabase"
import { useAuth } from "../../contexts/AuthContext"
import useIsMobile from "../../lib/useIsMobile"

export default function CustomerTracking() {
  const { user } = useAuth()
  const isMobile = useIsMobile()
  const [activeBookings, setActiveBookings] = useState([])
  const [selected, setSelected] = useState(null)
  const [mechanic, setMechanic] = useState(null)
  const [loading, setLoading] = useState(true)
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const mechanicMarkerRef = useRef(null)
  const customerMarkerRef = useRef(null)

  useEffect(() => {
    if (!user) return
    load()
  }, [user])

  useEffect(() => {
    if (!selected) return
    loadMechanic(selected)
    const sub = supabase.channel(`tracking-${selected.id}`)
      .on("postgres_changes", { event:"INSERT", schema:"public", table:"mechanic_location_history", filter:`booking_id=eq.${selected.id}` },
        payload => {
          const { latitude, longitude } = payload.new
          setMechanic(m => m ? { ...m, current_latitude:latitude, current_longitude:longitude } : m)
          if (mechanicMarkerRef.current) mechanicMarkerRef.current.setLatLng([latitude, longitude])
          if (mapInstanceRef.current) mapInstanceRef.current.panTo([latitude, longitude])
        })
      .on("postgres_changes", { event:"UPDATE", schema:"public", table:"bookings", filter:`id=eq.${selected.id}` },
        payload => setSelected(s => ({ ...s, ...payload.new })))
      .subscribe()
    return () => supabase.removeChannel(sub)
  }, [selected?.id])

  useEffect(() => {
    if (!selected || !mechanic || !mapRef.current) return
    if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null }
    const lat = mechanic.current_latitude || -1.2921
    const lng = mechanic.current_longitude || 36.8219
    setTimeout(() => {
      if (!mapRef.current || !window.L) return
      const L = window.L
      const map = L.map(mapRef.current).setView([lat, lng], 13)
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map)
      const mechanicIcon = L.divIcon({ className:"", html:`<div style="background:#1d9e75;width:36px;height:36px;border-radius:50%;border:3px solid #fff;display:flex;align-items:center;justify-content:center;font-size:18px;">👨‍🔧</div>`, iconSize:[36,36], iconAnchor:[18,18] })
      const customerIcon = L.divIcon({ className:"", html:`<div style="background:#e6821e;width:36px;height:36px;border-radius:50%;border:3px solid #fff;display:flex;align-items:center;justify-content:center;font-size:18px;">🚗</div>`, iconSize:[36,36], iconAnchor:[18,18] })
      mechanicMarkerRef.current = L.marker([lat, lng], { icon:mechanicIcon }).addTo(map).bindPopup(`Mechanic: ${mechanic.first_name} ${mechanic.last_name}`)
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(pos => {
          customerMarkerRef.current = L.marker([pos.coords.latitude, pos.coords.longitude], { icon:customerIcon }).addTo(map).bindPopup("Your location")
        })
      }
      mapInstanceRef.current = map
    }, 100)
    return () => { if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null } }
  }, [mechanic?.id, selected?.id])

  async function load() {
    const { data } = await supabase.from("bookings").select("*")
      .eq("customer_id", user.id)
      .in("status", ["confirmed","in-progress","driver-assigned","arrived-for-pickup","arrived-at-dropoff"])
      .order("created_at", { ascending:false })
    setActiveBookings(data||[])
    setLoading(false)
  }

  async function loadMechanic(booking) {
    if (!booking.assigned_mechanic_id) { setMechanic(null); return }
    const { data } = await supabase.from("mechanics").select("*").eq("id", booking.assigned_mechanic_id).single()
    setMechanic(data)
  }

  const SC = { confirmed:"#378add", "in-progress":"#8b5cf6", "driver-assigned":"#1d9e75", "arrived-for-pickup":"#e6821e", "arrived-at-dropoff":"#e6821e" }

  if (selected) return (
    <div>
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"/>

      <button onClick={()=>{ setSelected(null); setMechanic(null); if(mapInstanceRef.current){mapInstanceRef.current.remove();mapInstanceRef.current=null} }}
        style={{ background:"none", border:"none", color:"#e6821e", cursor:"pointer", fontSize:13, marginBottom:"1rem", fontFamily:"'DM Sans',sans-serif", padding:0 }}>
        ← Back to bookings
      </button>

      <div style={{ background:"#111", border:"1px solid #1e1e1e", borderRadius:12, padding:"1rem", marginBottom:"1rem" }}>
        <div style={{ fontFamily:"Syne", fontSize:15, fontWeight:800, color:"#f0ede6", marginBottom:4 }}>{selected.service_name}</div>
        <div style={{ display:"flex", gap:10, flexWrap:"wrap", marginBottom:8 }}>
          <span style={{ fontSize:11, padding:"2px 8px", borderRadius:10, background:`${SC[selected.status]||"#888"}20`, color:SC[selected.status]||"#888" }}>{selected.status}</span>
          <span style={{ fontSize:11, color:"#555" }}>#{selected.booking_number}</span>
          <span style={{ fontSize:11, color:"#555" }}>{selected.booking_date}</span>
        </div>

        {mechanic?(
          <div style={{ background:"#0f0f0f", borderRadius:10, padding:"0.9rem", marginBottom:10 }}>
            <div style={{ fontSize:11, color:"#555", marginBottom:6 }}>Your mechanic</div>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <div style={{ width:40, height:40, borderRadius:"50%", background:"#071a12", border:"2px solid #1d9e7540", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"Syne", fontSize:14, fontWeight:800, color:"#1d9e75", flexShrink:0 }}>
                {mechanic.first_name[0]}{mechanic.last_name[0]}
              </div>
              <div>
                <div style={{ fontSize:13, fontWeight:600, color:"#f0ede6" }}>{mechanic.first_name} {mechanic.last_name}</div>
                <div style={{ fontSize:11, color:"#555" }}>🔧 {mechanic.specialization}</div>
                {mechanic.phone&&<div style={{ fontSize:11, color:"#555" }}>📞 {mechanic.phone}</div>}
              </div>
              <div style={{ marginLeft:"auto", textAlign:"right" }}>
                <div style={{ display:"flex", alignItems:"center", gap:5, justifyContent:"flex-end" }}>
                  <div style={{ width:7, height:7, borderRadius:"50%", background:mechanic.current_latitude?"#1d9e75":"#555", boxShadow:mechanic.current_latitude?"0 0 6px #1d9e75":"none" }}/>
                  <span style={{ fontSize:10, color:mechanic.current_latitude?"#1d9e75":"#555" }}>
                    {mechanic.current_latitude?"Live tracking":"Awaiting location"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ):(
          <div style={{ background:"#0f0f0f", borderRadius:10, padding:"0.9rem", marginBottom:10, fontSize:12, color:"#555", textAlign:"center" }}>
            No mechanic assigned yet. Provider will assign one shortly.
          </div>
        )}

        <div ref={mapRef} style={{ height:isMobile?250:350, borderRadius:10, overflow:"hidden", background:"#1a1a1a" }}>
          {!mechanic?.current_latitude&&(
            <div style={{ height:"100%", display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:8 }}>
              <div style={{ fontSize:32 }}>🗺️</div>
              <div style={{ fontSize:12, color:"#555" }}>Waiting for mechanic location...</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )

  return (
    <div>
      <div style={{ fontFamily:"Syne", fontSize:isMobile?16:18, fontWeight:800, color:"#f0ede6", marginBottom:4 }}>Track your service</div>
      <div style={{ fontSize:12, color:"#555", marginBottom:"1.25rem" }}>Live mechanic tracking for active bookings</div>

      {loading&&<div style={{ color:"#555", fontSize:13 }}>Loading...</div>}
      {!loading&&activeBookings.length===0&&(
        <div style={{ color:"#444", fontSize:13, textAlign:"center", padding:"3rem" }}>
          <div style={{ fontSize:32, marginBottom:10 }}>📍</div>
          No active bookings to track right now
        </div>
      )}

      {activeBookings.map(b=>(
        <div key={b.id} onClick={()=>setSelected(b)}
          style={{ background:"#111", border:`1px solid ${SC[b.status]||"#1e1e1e"}30`, borderRadius:12, padding:isMobile?"0.9rem":"1.1rem", marginBottom:10, cursor:"pointer" }}
          onMouseEnter={e=>e.currentTarget.style.background="#161616"}
          onMouseLeave={e=>e.currentTarget.style.background="#111"}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
            <div>
              <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:700, color:"#f0ede6", marginBottom:4 }}>{b.service_name}</div>
              <div style={{ fontSize:11, color:"#555", marginBottom:4 }}>#{b.booking_number} · {b.booking_date}</div>
              <span style={{ fontSize:10, padding:"2px 8px", borderRadius:10, background:`${SC[b.status]||"#888"}20`, color:SC[b.status]||"#888" }}>{b.status}</span>
            </div>
            <div style={{ textAlign:"right" }}>
              <div style={{ fontSize:12, color:"#e6821e", marginBottom:4 }}>KES {Number(b.total_amount).toLocaleString()}</div>
              <div style={{ fontSize:11, color:"#555" }}>
                {b.assigned_mechanic_id?"👨‍🔧 Mechanic assigned":"⏳ Awaiting mechanic"}
              </div>
              <div style={{ fontSize:11, color:"#378add", marginTop:4 }}>Track →</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
