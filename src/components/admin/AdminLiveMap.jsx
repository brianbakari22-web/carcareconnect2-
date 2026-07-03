import { useEffect, useState, useRef } from "react"
import { supabase } from "../../lib/supabase"

export default function AdminLiveMap() {
  const [drivers, setDrivers] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [filter, setFilter] = useState("all")
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const markersRef = useRef({})

  useEffect(() => {
    load()
    const sub = supabase.channel("admin-live-map")
      .on("postgres_changes", { event:"*", schema:"public", table:"driver_status" }, () => load())
      .subscribe()
    const interval = setInterval(load, 30000)
    return () => { 
      supabase.removeChannel(sub)
      clearInterval(interval)
      // Cleanup map on unmount
      if (mapInstanceRef.current) {
        mapInstanceRef.current = null
      }
      Object.keys(markersRef.current).forEach(id => {
        markersRef.current[id].setMap(null)
      })
      markersRef.current = {}
    }
  }, [])

  useEffect(() => {
    if (!loading) initMap()
  }, [drivers, loading])

  useEffect(() => {
    if (!selected?.current_lat) return
    // Wait for DOM to render the street view div
    setTimeout(() => {
      const svDiv = document.getElementById("admin-street-view")
      if (!svDiv || !window.google?.maps?.StreetViewPanorama) return
      try {
        new window.google.maps.StreetViewPanorama(svDiv, {
          position: { lat: selected.current_lat, lng: selected.current_lng },
          pov: { heading: 34, pitch: 10 },
          zoom: 1,
          addressControl: false,
          showRoadLabels: true,
          motionTracking: false,
        })
      } catch(e) { console.log("Street view not available:", e.message) }
    }, 300)
  }, [selected?.driver_id])

  async function load() {
    const { data } = await supabase.from("driver_status")
      .select("*, driver:profiles!driver_status_driver_id_fkey(first_name,last_name,driver_vehicle_type,driver_category,documents_verified)")
      .not("current_lat","is",null)
    setDrivers(data||[])
    setLoading(false)
  }

  function initMap() {
    if (!mapRef.current) return
    function buildMap() {
      if (!window.google?.maps?.Map) return
      const online = drivers.filter(d=>d.current_lat&&d.current_lng)
      if (!online.length) return
      const center = { lat: online[0].current_lat, lng: online[0].current_lng }
      if (!mapInstanceRef.current) {
        mapInstanceRef.current = new window.google.maps.Map(mapRef.current, {
          center, zoom:12, mapTypeControl:false, streetViewControl:false,
          fullscreenControl:true, zoomControl:true, gestureHandling:"greedy"
        })
      }
      online.forEach(d => {
        const icon = d.driver?.driver_category==="concierge"?"\u{1F9D1}\u{200D}\u{2708}\u{FE0F}":
          d.driver?.driver_vehicle_type==="motorcycle"?"\u{1F3CD}\u{FE0F}":
          d.driver?.driver_vehicle_type==="tuktuk"?"\u{1F6FA}":
          d.driver?.driver_vehicle_type==="van"?"\u{1F690}":"\u{1F697}"
        const color = d.is_online?"#1d9e75":"#888888"
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><circle cx="24" cy="24" r="22" fill="${color}" stroke="white" stroke-width="3"/><text x="24" y="32" font-size="20" text-anchor="middle">${icon}</text></svg>`
        const markerIcon = { url:"data:image/svg+xml;charset=UTF-8,"+encodeURIComponent(svg), scaledSize:new window.google.maps.Size(48,48), anchor:new window.google.maps.Point(24,24) }
        if (markersRef.current[d.driver_id]) {
          markersRef.current[d.driver_id].setPosition({lat:d.current_lat,lng:d.current_lng})
          markersRef.current[d.driver_id].setIcon(markerIcon)
        } else {
          const marker = new window.google.maps.Marker({ position:{lat:d.current_lat,lng:d.current_lng}, map:mapInstanceRef.current, title:`${d.driver?.first_name} ${d.driver?.last_name}`, icon:markerIcon })
          marker.addListener("click", () => setSelected(d))
          markersRef.current[d.driver_id] = marker
        }
      })
    }
    if (window.google?.maps?.Map) {
      buildMap()
    } else {
      // Use existing SDK script or load new one
      const existingScript = document.getElementById("google-maps-sdk") || document.getElementById("google-maps-admin")
      if (existingScript) {
        // Script already loading - wait for it
        existingScript.addEventListener("load", buildMap)
      } else {
        const s = document.createElement("script")
        s.id = "google-maps-admin"
        s.src = `https://maps.googleapis.com/maps/api/js?key=${import.meta.env.VITE_GOOGLE_MAPS_KEY}&libraries=marker,places&loading=async`
        s.onload = () => { setTimeout(buildMap, 100) }
        document.head.appendChild(s)
      }
    }
  }

  const filtered = drivers.filter(d => {
    if (filter==="online") return d.is_online
    if (filter==="concierge") return d.driver?.driver_category==="concierge"
    if (filter==="marketplace") return d.driver?.driver_category==="marketplace"
    return true
  })

  const onlineCount = drivers.filter(d=>d.is_online).length
  const conciergeCount = drivers.filter(d=>d.driver?.driver_category==="concierge").length
  const marketplaceCount = drivers.filter(d=>d.driver?.driver_category==="marketplace").length

  return (
    <div>
      <div style={{ fontFamily:"Syne", fontSize:18, fontWeight:800, color:"#000", marginBottom:"1rem" }}>🗺️ Live Driver Map</div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8, marginBottom:"1rem" }}>
        {[
          { label:"Total drivers", value:drivers.length, color:"#000" },
          { label:"Online now", value:onlineCount, color:"#1d9e75" },
          { label:"Concierge", value:conciergeCount, color:"#8b5cf6" },
          { label:"Marketplace", value:marketplaceCount, color:"#e6821e" },
        ].map(s=>(
          <div key={s.label} style={{ background:"#f8f8f8", borderRadius:10, padding:"0.75rem", border:"1px solid #eee", textAlign:"center" }}>
            <div style={{ fontFamily:"Syne", fontSize:20, fontWeight:800, color:s.color }}>{s.value}</div>
            <div style={{ fontSize:10, color:"#888", marginTop:2 }}>{s.label}</div>
          </div>
        ))}
      </div>
      <div style={{ display:"flex", gap:6, marginBottom:"1rem", flexWrap:"wrap" }}>
        {[["all","All"],["online","🟢 Online"],["concierge","🧑‍✈️ Concierge"],["marketplace","🚗 Marketplace"]].map(([k,l])=>(
          <button key={k} onClick={()=>setFilter(k)} style={{ padding:"6px 14px", borderRadius:7, border:"none", fontSize:12, cursor:"pointer", background:filter===k?"#e6821e":"#f8f8f8", color:filter===k?"#fff":"#666" }}>{l}</button>
        ))}
        <button onClick={load} style={{ marginLeft:"auto", padding:"6px 14px", borderRadius:7, border:"1px solid #eee", fontSize:12, cursor:"pointer", background:"#fff", color:"#555" }}>🔄 Refresh</button>
      </div>
      <div ref={mapRef} style={{ width:"100%", height:"calc(100vh - 320px)", minHeight:300, borderRadius:12, overflow:"hidden", background:"#f0f0f0", marginBottom:"1rem", border:"1px solid #eee" }}>
        {loading&&<div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100%", color:"#888", fontSize:13 }}>Loading map...</div>}
        {!loading&&drivers.filter(d=>d.current_lat).length===0&&(
          <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100%", color:"#888", fontSize:13, flexDirection:"column", gap:8 }}>
            <div style={{ fontSize:32 }}>🗺️</div>No drivers with GPS location found
          </div>
        )}
      </div>
      {selected&&(
        <div style={{ background:"#fff", border:"1px solid #e6821e40", borderRadius:12, padding:"1rem", marginBottom:"1rem" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
            <div>
              <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:800, marginBottom:4 }}>{selected.driver?.first_name} {selected.driver?.last_name}</div>
              <div style={{ fontSize:12, color:"#888" }}>{selected.driver?.driver_category==="concierge"?"🧑‍✈️ Concierge":`🚗 ${selected.driver?.driver_vehicle_type||"Car"}`}</div>
              <div style={{ fontSize:11, color:selected.is_online?"#1d9e75":"#888", marginTop:2 }}>{selected.is_online?"🟢 Online":"⚫ Offline"}</div>
              <div style={{ fontSize:11, color:"#888", marginTop:4 }}>📍 {selected.current_lat?.toFixed(5)}, {selected.current_lng?.toFixed(5)}</div>
              {selected.updated_at&&<div style={{ fontSize:11, color:"#aaa", marginTop:2 }}>Last seen: {new Date(selected.updated_at).toLocaleTimeString()}</div>}
            {selected.current_lat&&(
              <div style={{ marginTop:10 }}>
                <div style={{ fontSize:11, fontWeight:600, color:"#000", marginBottom:6 }}>🏙️ Street View</div>
                <div id="admin-street-view" style={{ width:"100%", height:200, borderRadius:8, overflow:"hidden", background:"#f0f0f0" }}/>
              </div>
            )}
            </div>
            <button onClick={()=>setSelected(null)} style={{ background:"#f5f5f5", border:"none", borderRadius:"50%", width:28, height:28, cursor:"pointer", fontSize:16 }}>×</button>
          </div>
        </div>
      )}
      <div style={{ fontFamily:"Syne", fontSize:13, fontWeight:700, marginBottom:8 }}>Driver List ({filtered.length})</div>
      {filtered.map(d=>(
        <div key={d.driver_id} onClick={()=>{ setSelected(d); if(mapInstanceRef.current&&d.current_lat) mapInstanceRef.current.panTo({lat:d.current_lat,lng:d.current_lng}) }}
          style={{ background:"#f8f8f8", border:`1px solid ${d.is_online?"#1d9e7530":"#eee"}`, borderRadius:10, padding:"0.75rem", marginBottom:6, cursor:"pointer", display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:8, height:8, borderRadius:"50%", background:d.is_online?"#1d9e75":"#ccc", flexShrink:0 }}/>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:13, fontWeight:600 }}>{d.driver?.first_name} {d.driver?.last_name}</div>
            <div style={{ fontSize:11, color:"#888" }}>{d.driver?.driver_category==="concierge"?"🧑‍✈️ Concierge":`🚗 ${d.driver?.driver_vehicle_type||"Car"}`}{d.current_booking_id&&" · 📅 On job"}</div>
          </div>
          <div style={{ fontSize:11, color:d.is_online?"#1d9e75":"#888" }}>{d.is_online?"Online":"Offline"}</div>
        </div>
      ))}
    </div>
  )
}