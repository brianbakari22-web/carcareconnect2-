import { useEffect, useState, useRef } from "react"
import { supabase } from "../../lib/supabase"
import { useAuth } from "../../contexts/AuthContext"

export default function CustomerTracking() {
  const { user } = useAuth()
  const [activeBookings, setActiveBookings] = useState([])
  const [selectedBooking, setSelectedBooking] = useState(null)
  const [driverStatus, setDriverStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const markerRef = useRef(null)

  useEffect(() => {
    if (!user) return
    loadBookings()
  }, [user])

  useEffect(() => {
    if (!selectedBooking) return
    loadDriverStatus(selectedBooking.driver_id)
    const sub = supabase.channel("driver-track")
      .on("postgres_changes", { event:"*", schema:"public", table:"driver_status", filter:`driver_id=eq.${selectedBooking.driver_id}` }, payload => {
        setDriverStatus(payload.new)
        updateMapMarker(payload.new)
      }).subscribe()
    return () => supabase.removeChannel(sub)
  }, [selectedBooking])

  useEffect(() => {
    if (selectedBooking && driverStatus) {
      initMap()
    }
  }, [selectedBooking, driverStatus])

  async function loadBookings() {
    const { data } = await supabase.from("bookings")
      .select("*")
      .eq("customer_id", user.id)
      .eq("is_concierge", true)
      .in("status", ["confirmed","in-progress"])
      .not("driver_id", "is", null)
      .order("created_at", { ascending:false })
    setActiveBookings(data||[])
    if (data && data.length > 0) setSelectedBooking(data[0])
    setLoading(false)
  }

  async function loadDriverStatus(driverId) {
    if (!driverId) return
    const { data } = await supabase.from("driver_status").select("*").eq("driver_id", driverId).single()
    setDriverStatus(data)
  }

  function initMap() {
    if (!mapRef.current || mapInstanceRef.current) return
    if (!window.L) return

    const lat = driverStatus?.current_lat || -1.2921
    const lng = driverStatus?.current_lng || 36.8219

    const map = window.L.map(mapRef.current).setView([lat, lng], 14)
    window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "OpenStreetMap"
    }).addTo(map)

    const driverIcon = window.L.divIcon({
      html: `<div style="width:36px;height:36px;background:#e6821e;border:3px solid #fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:18px;box-shadow:0 2px 8px rgba(0,0,0,0.3)">🚗</div>`,
      iconSize: [36, 36],
      iconAnchor: [18, 18],
      className: ""
    })

    const marker = window.L.marker([lat, lng], { icon: driverIcon })
      .addTo(map)
      .bindPopup("Driver location")
    markerRef.current = marker
    mapInstanceRef.current = map
  }

  function updateMapMarker(status) {
    if (!status?.current_lat || !status?.current_lng) return
    if (markerRef.current && mapInstanceRef.current) {
      markerRef.current.setLatLng([status.current_lat, status.current_lng])
      mapInstanceRef.current.setView([status.current_lat, status.current_lng], 14)
    }
  }

  const SC = { confirmed:"#378add", "in-progress":"#8b5cf6" }
  const SB = { confirmed:"#0c1f2e", "in-progress":"#160a2e" }

  return (
    <div>
      <style>{`
        @import url('https://unpkg.com/leaflet@1.9.4/dist/leaflet.css');
        .leaflet-container { border-radius: 10px; }
      `}</style>
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>

      <div style={{ fontFamily:"Syne", fontSize:18, fontWeight:800, color:"#f0ede6", marginBottom:4 }}>
        Driver Tracking
      </div>
      <div style={{ fontSize:12, color:"#555", marginBottom:"1.25rem" }}>
        Real-time location of your concierge driver
      </div>

      {loading && <div style={{ color:"#555", fontSize:13 }}>Loading...</div>}

      {!loading && activeBookings.length === 0 && (
        <div style={{ background:"#111", border:"1px solid #1e1e1e", borderRadius:12, padding:"2rem", textAlign:"center" }}>
          <div style={{ fontSize:32, marginBottom:10 }}>🗺️</div>
          <div style={{ fontSize:14, color:"#555", marginBottom:4 }}>No active concierge bookings</div>
          <div style={{ fontSize:12, color:"#444" }}>Book a service with concierge pickup to track your driver</div>
        </div>
      )}

      {activeBookings.length > 1 && (
        <div style={{ display:"flex", gap:8, marginBottom:"1rem", flexWrap:"wrap" }}>
          {activeBookings.map(b => (
            <button key={b.id} onClick={() => { setSelectedBooking(b); if(mapInstanceRef.current){ mapInstanceRef.current.remove(); mapInstanceRef.current=null; markerRef.current=null } }}
              style={{ padding:"6px 14px", borderRadius:8, border:`1px solid ${selectedBooking?.id===b.id?"#e6821e":"#333"}`, fontSize:12, cursor:"pointer", background:selectedBooking?.id===b.id?"#1a1208":"#111", color:selectedBooking?.id===b.id?"#e6821e":"#666", fontFamily:"'DM Sans',sans-serif" }}>
              {b.service_name}
            </button>
          ))}
        </div>
      )}

      {selectedBooking && (
        <div>
          <div style={{ background:"#111", border:"1px solid #1e1e1e", borderRadius:12, padding:"1rem", marginBottom:"1rem" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
              <div>
                <div style={{ fontSize:14, fontWeight:500, color:"#f0ede6" }}>{selectedBooking.service_name}</div>
                <div style={{ fontSize:11, color:"#555", marginTop:2 }}>#{selectedBooking.booking_number}</div>
              </div>
              <span style={{ fontSize:11, padding:"3px 9px", borderRadius:20, background:SB[selectedBooking.status]||"#111", color:SC[selectedBooking.status]||"#888", border:`1px solid ${SC[selectedBooking.status]||"#888"}40` }}>
                {selectedBooking.status}
              </span>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8 }}>
              <div><div style={{ fontSize:10, color:"#555" }}>DATE</div><div style={{ fontSize:12 }}>{selectedBooking.booking_date}</div></div>
              <div><div style={{ fontSize:10, color:"#555" }}>TIME</div><div style={{ fontSize:12 }}>{selectedBooking.booking_time?.slice(0,5)}</div></div>
              <div>
                <div style={{ fontSize:10, color:"#555" }}>DRIVER</div>
                <div style={{ fontSize:12, color: driverStatus?.is_online?"#1d9e75":"#555" }}>
                  {driverStatus?.is_online ? "● Online" : "○ Offline"}
                </div>
              </div>
            </div>
            {selectedBooking.pickup_address && (
              <div style={{ marginTop:8, fontSize:11, color:"#555" }}>
                Pickup: {selectedBooking.pickup_address}
              </div>
            )}
          </div>

          {driverStatus?.current_lat && driverStatus?.current_lng ? (
            <div>
              <div ref={mapRef} style={{ height:380, borderRadius:10, overflow:"hidden", marginBottom:"1rem", border:"1px solid #1e1e1e" }} />
              <div style={{ background:"#111", border:"1px solid #1e1e1e", borderRadius:10, padding:"0.9rem", display:"flex", gap:16 }}>
                <div>
                  <div style={{ fontSize:10, color:"#555" }}>LAST UPDATE</div>
                  <div style={{ fontSize:12 }}>{driverStatus?.last_location_update ? new Date(driverStatus.last_location_update).toLocaleTimeString() : "Unknown"}</div>
                </div>
                <div>
                  <div style={{ fontSize:10, color:"#555" }}>STATUS</div>
                  <div style={{ fontSize:12, color: driverStatus?.is_online?"#1d9e75":"#555" }}>{driverStatus?.is_online?"Online":"Offline"}</div>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ background:"#111", border:"1px solid #1e1e1e", borderRadius:12, padding:"2rem", textAlign:"center" }}>
              <div style={{ fontSize:28, marginBottom:10 }}>📍</div>
              <div style={{ fontSize:13, color:"#555", marginBottom:4 }}>Waiting for driver location</div>
              <div style={{ fontSize:11, color:"#444" }}>Driver location will appear here once they go online and start moving</div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
