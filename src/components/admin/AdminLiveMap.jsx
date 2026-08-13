import { GOServiceIcon, VehicleIcon, LocationIcon, AnalyticsIcon, TripReportIcon, MechanicIcon, CheckIcon, PhoneCallIcon, StarIcon, RefreshIcon } from "../../lib/cccIcons"
import { useEffect, useState, useRef } from "react"
import { useAuth } from "../../contexts/AuthContext"
import { supabase } from "../../lib/supabase"

export default function AdminLiveMap() {
  const { user, profile } = useAuth()
  if (!user || profile?.role !== "admin") return null
  const [drivers, setDrivers] = useState([])
  const [goRequests, setGoRequests] = useState([])
  const [sosAlerts, setSosAlerts] = useState([])
  const [mechanics, setMechanics] = useState([])
  const [tab, setTab] = useState("map")
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [filter, setFilter] = useState("all")
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const markersRef = useRef({})
  const sosMarkersRef = useRef({})

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
      Object.keys(sosMarkersRef.current).forEach(id => {
        sosMarkersRef.current[id].setMap(null)
      })
      sosMarkersRef.current = {}
    }
  }, [])

  useEffect(() => {
    if (!loading) initMap()
  }, [drivers, sosAlerts, loading])

  useEffect(() => {
    if (!selected?.current_lat) return
    // Wait for DOM to render the street view div
    setTimeout(() => {
      const svDiv = document.getElementById("admin-street-view")
      if (!svDiv || !window.google?.maps?.StreetViewPanorama) return
      try {
        const sv = new window.google.maps.StreetViewService()
        sv.getPanorama({ location:{ lat:selected.current_lat, lng:selected.current_lng }, radius:100 }, (data, status) => {
          if (status === "OK") {
            const panorama = new window.google.maps.StreetViewPanorama(svDiv, {
              position: { lat: selected.current_lat, lng: selected.current_lng },
              pov: { heading: 34, pitch: 10 },
              zoom: 1,
              addressControl: false,
              showRoadLabels: true,
              motionTracking: false,
            })
            window.google.maps.event.trigger(panorama, "resize")
            setTimeout(() => window.google.maps.event.trigger(panorama, "resize"), 300)
          } else {
            svDiv.innerHTML = "<div style=\"display:flex;align-items:center;justify-content:center;height:100%;color:#888;font-size:12px;flex-direction:column;gap:8px\">Street View not available at this location</div>"
          }
        })
      } catch(e) { svDiv.innerHTML = "<div style=\"display:flex;align-items:center;justify-content:center;height:100%;color:#888;font-size:12px;\">Street View unavailable</div>" }
    }, 300)
  }, [selected?.driver_id])

  if (!user || profile?.role !== "admin") return null

  async function load() {
    const { data } = await supabase.from("driver_status")
      .select("*, driver:profiles!driver_status_driver_id_fkey(first_name,last_name,driver_vehicle_type,driver_category,documents_verified)")
      .not("current_lat","is",null)
    setDrivers(data||[])
    const { data: go } = await supabase.from("go_service_requests").select("*, booking:bookings!go_service_requests_booking_id_fkey(id,service_name,customer_id), provider:profiles!go_service_requests_provider_id_fkey(first_name,last_name,business_name)").in("status",["pending","accepted","en_route"]).order("created_at",{ascending:false})
    setGoRequests(go||[])
    const { data: sos } = await supabase.from("emergency_alerts").select("*, user:profiles!emergency_alerts_user_id_fkey(first_name,last_name)").eq("status","active").order("created_at",{ascending:false})
    let sosWithPhones = sos||[]
    if (sosWithPhones.length > 0) {
      const userIds = sosWithPhones.map(s=>s.user_id).filter(Boolean)
      const { data: sensRows } = await supabase.from("profile_sensitive").select("id,phone").in("id", userIds)
      const phoneMap = Object.fromEntries((sensRows||[]).map(r=>[r.id, r.phone]))
      sosWithPhones = sosWithPhones.map(s=>({ ...s, phone: phoneMap[s.user_id]||null }))
    }
    setSosAlerts(sosWithPhones)
    const { data: mechs } = await supabase.from("mechanics").select("*, profile:profiles!mechanics_user_id_fkey(first_name,last_name)").eq("is_active",true)
    setMechanics(mechs||[])
    setLoading(false)
  }
  async function resolveSOS(id) {
    await supabase.from("emergency_alerts").update({ status:"resolved", resolved_at:new Date().toISOString() }).eq("id", id)
    setSosAlerts(prev => prev.filter(s => s.id !== id))
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
        const color = d.is_online&&!isStale(d)?"#1d9e75":"#888888"
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
      // Plot SOS emergency alert markers
      const activeSosWithLoc = sosAlerts.filter(s=>s.latitude&&s.longitude)
      Object.keys(sosMarkersRef.current).forEach(id => {
        if (!activeSosWithLoc.find(s=>s.id===id)) {
          sosMarkersRef.current[id].setMap(null)
          delete sosMarkersRef.current[id]
        }
      })
      activeSosWithLoc.forEach(s => {
        const sosSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="52" height="52" viewBox="0 0 52 52"><circle cx="26" cy="26" r="24" fill="#e24b4a" stroke="white" stroke-width="3"/><text x="26" y="34" font-size="22" text-anchor="middle">🆘</text></svg>`
        const sosIcon = { url:"data:image/svg+xml;charset=UTF-8,"+encodeURIComponent(sosSvg), scaledSize:new window.google.maps.Size(52,52), anchor:new window.google.maps.Point(26,26) }
        if (sosMarkersRef.current[s.id]) {
          sosMarkersRef.current[s.id].setPosition({ lat:Number(s.latitude), lng:Number(s.longitude) })
        } else {
          const sosMarker = new window.google.maps.Marker({ position:{ lat:Number(s.latitude), lng:Number(s.longitude) }, map:mapInstanceRef.current, title:`SOS: ${s.user_name||"Unknown"}`, icon:sosIcon, zIndex:999 })
          sosMarker.addListener("click", () => {
            mapInstanceRef.current.panTo({ lat:Number(s.latitude), lng:Number(s.longitude) })
            mapInstanceRef.current.setZoom(16)
          })
          sosMarkersRef.current[s.id] = sosMarker
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

  function isStale(d) {
    if (!d.updated_at) return true
    return (Date.now() - new Date(d.updated_at).getTime()) > 10*60*1000
  }
  function timeAgo(dateStr) {
    if (!dateStr) return "never"
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff/60000)
    if (mins < 1) return "just now"
    if (mins < 60) return mins+"m ago"
    const hrs = Math.floor(mins/60)
    if (hrs < 24) return hrs+"h ago"
    return Math.floor(hrs/24)+"d ago"
  }
  const onlineCount = drivers.filter(d=>d.is_online && !isStale(d)).length
  const conciergeCount = drivers.filter(d=>d.driver?.driver_category==="concierge").length
  const marketplaceCount = drivers.filter(d=>d.driver?.driver_category==="marketplace").length
  const activeGoRequests = goRequests.filter(g=>g.status==="pending"||g.status==="accepted").length
  const activeSOS = sosAlerts.length

  return (
    <div>
      <div style={{ fontFamily:"Syne", fontSize:18, fontWeight:800, color:"#000", marginBottom:"1rem", display:"flex", alignItems:"center", gap:8 }}><TripReportIcon size={20} color="#e6821e"/> Live Driver Map</div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:6, marginBottom:"1rem" }}>
        {[
          { label:"Total drivers", value:drivers.length, color:"#000" },
          { label:"Online now", value:onlineCount, color:"#1d9e75" },
          { label:"Concierge", value:conciergeCount, color:"#8b5cf6" },
          { label:"Marketplace", value:marketplaceCount, color:"#e6821e" },
          { label:"GO Requests", value:activeGoRequests, color:activeGoRequests>0?"#e24b4a":"#888" },
          { label:"SOS Active", value:activeSOS, color:activeSOS>0?"#e24b4a":"#888" },
          { label:"Mechanics", value:mechanics.length, color:"#378add" },
        ].map(s=>(
          <div key={s.label} style={{ background:"#f8f8f8", borderRadius:10, padding:"0.75rem", border:"1px solid #eee", textAlign:"center" }}>
            <div style={{ fontFamily:"Syne", fontSize:18, fontWeight:800, color:s.color }}>{s.value}</div>
            <div style={{ fontSize:10, color:"#888", marginTop:2 }}>{s.label}</div>
          </div>
        ))}
      </div>
      {/* Tab buttons */}
      <div style={{ display:"flex", gap:4, marginBottom:"1rem", overflowX:"auto", paddingBottom:4, WebkitOverflowScrolling:"touch" }}>
        {[
          {k:"map",l:"Live Map"},
          {k:"go",l:"GO ("+goRequests.length+")"},
          {k:"sos",l:"SOS ("+sosAlerts.length+")"},
          {k:"mechanics",l:"Mechanics ("+mechanics.length+")"},
        ].map(t=>(
          <button key={t.k} onClick={()=>setTab(t.k)} style={{ padding:"7px 14px", borderRadius:8, border:"none", fontSize:12, cursor:"pointer", background:tab===t.k?"#e6821e":"#f0f0f0", color:tab===t.k?"#fff":"#555", fontWeight:tab===t.k?700:400, whiteSpace:"nowrap" }}>{t.l}</button>
        ))}
        <button onClick={load} style={{ marginLeft:"auto", padding:"6px 14px", borderRadius:7, border:"1px solid #eee", fontSize:12, cursor:"pointer", background:"#fff", color:"#555", display:"flex", alignItems:"center", gap:4 }}><RefreshIcon size={12} color="#555"/> Refresh</button>
      </div>
      {/* Map Tab */}
      {tab==="map"&&(
        <>
          <div style={{ display:"flex", gap:4, marginBottom:"0.75rem", overflowX:"auto", paddingBottom:2 }}>
            {[["all","All"],["online","Online"],["concierge","Concierge"],["marketplace","Marketplace"]].map(([k,l])=>(
              <button key={k} onClick={()=>setFilter(k)} style={{ padding:"6px 14px", borderRadius:7, border:"none", fontSize:12, cursor:"pointer", background:filter===k?"#e6821e":"#f8f8f8", color:filter===k?"#fff":"#666" }}>{l}</button>
            ))}
          </div>
          <div ref={mapRef} style={{ width:"100%", height:"calc(100vh - 380px)", minHeight:300, borderRadius:12, overflow:"hidden", background:"#f0f0f0", marginBottom:"1rem", border:"1px solid #eee" }}>
            {loading&&<div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100%", color:"#888", fontSize:13 }}>Loading map...</div>}
            {!loading&&drivers.filter(d=>d.current_lat).length===0&&(
              <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100%", color:"#888", fontSize:13, flexDirection:"column", gap:8 }}>
                <div style={{ display:"flex", justifyContent:"center", marginBottom:8 }}><TripReportIcon size={32} color="#ccc"/></div>No drivers with GPS location found
              </div>
            )}
          </div>
          {selected&&(
            <div style={{ background:"#fff", border:"1px solid #e6821e40", borderRadius:12, padding:"1rem", marginBottom:"1rem" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                <div>
                  <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:800, marginBottom:4 }}>{selected.driver?.first_name} {selected.driver?.last_name}</div>
                  <div style={{ fontSize:12, color:"#888" }}>{selected.driver?.driver_category==="concierge"?"Concierge":`${selected.driver?.driver_vehicle_type||"Car"}`}</div>
                  <div style={{ fontSize:11, color:selected.is_online?"#1d9e75":"#888", marginTop:2 }}>{selected.is_online?"Online":"Offline"}</div>
                  <div style={{ fontSize:11, color:"#888", marginTop:4 }}>{selected.current_lat?.toFixed(5)}, {selected.current_lng?.toFixed(5)}</div>
                  {selected.current_lat&&selected.current_lng&&(
                    <a href={`https://www.google.com/maps/dir/?api=1&destination=${selected.current_lat},${selected.current_lng}`} target="_blank" rel="noreferrer"
                      style={{ fontSize:11, color:"#378add", textDecoration:"none", display:"flex", alignItems:"center", gap:4, marginTop:4 }}>
                      <LocationIcon size={11} color="#378add"/> View location
                    </a>
                  )}
                  {selected.updated_at&&<div style={{ fontSize:11, color:"#aaa", marginTop:2 }}>Last seen: {new Date(selected.updated_at).toLocaleTimeString()}</div>}
                  {selected.current_lat&&(
                    <div style={{ marginTop:10 }}>
                      <div style={{ fontSize:11, fontWeight:600, color:"#000", marginBottom:6 }}>Street View</div>
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
              style={{ background:"#f8f8f8", border:`1px solid ${d.is_online&&!isStale(d)?"#1d9e7530":"#eee"}`, borderRadius:10, padding:"0.75rem", marginBottom:6, cursor:"pointer", display:"flex", alignItems:"center", gap:10, opacity:isStale(d)?0.6:1 }}>
              <div style={{ width:8, height:8, borderRadius:"50%", background:d.is_online&&!isStale(d)?"#1d9e75":"#ccc", flexShrink:0 }}/>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:600 }}>{d.driver?.first_name} {d.driver?.last_name}</div>
                <div style={{ fontSize:11, color:"#888" }}>{d.driver?.driver_category==="concierge"?"Concierge":`${d.driver?.driver_vehicle_type||"Car"}`}{d.current_booking_id&&" · On job"}</div>
                <div style={{ fontSize:10, color:isStale(d)?"#e6821e":"#aaa" }}>Last seen: {timeAgo(d.updated_at)}</div>
              </div>
              <div style={{ fontSize:11, color:d.is_online&&!isStale(d)?"#1d9e75":"#888" }}>{isStale(d)?"Stale":d.is_online?"Online":"Offline"}</div>
            </div>))}
        </>
      )}
      {/* GO Requests Tab */}
      {tab==="go"&&(
        <div>
          {goRequests.length===0&&<div style={{ color:"#888", textAlign:"center", padding:"2rem" }}>No active GO requests</div>}
          {goRequests.map(g=>(
            <div key={g.id} style={{ background:"#fff", border:"1px solid #e24b4a30", borderRadius:10, padding:"1rem", marginBottom:8 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                <div>
                  <div style={{ fontFamily:"Syne", fontSize:13, fontWeight:700 }}>{g.issue_type||"GO Request"}</div>
                  <div style={{ fontSize:11, color:"#888" }}>{g.customer?.first_name} {g.customer?.last_name}</div>
                  <div style={{ fontSize:11, color:"#888" }}>{g.location_address||"No location set"}</div>
                  <div style={{ fontSize:10, color:"#aaa" }}>{new Date(g.created_at).toLocaleString()}</div>
                </div>
                <span style={{ fontSize:11, padding:"3px 10px", borderRadius:10, background:g.status==="pending"?"#fff5f5":"#f0fdf4", color:g.status==="pending"?"#e24b4a":"#1d9e75", fontWeight:600 }}>{g.status}</span>
              <button onClick={async()=>{
                const { data: latest } = await supabase.from("booking_location_logs").select("lat,lng").eq("booking_id",g.booking_id).eq("source","customer").order("recorded_at",{ascending:false}).limit(1).maybeSingle()
                if(!latest){ alert("Customer has not shared live location for this request."); return }
                window.open(`https://www.google.com/maps?q=${latest.lat},${latest.lng}`, "_blank")
              }} style={{ marginTop:8, background:"#eff6ff", border:"1px solid #378add40", borderRadius:7, color:"#378add", fontSize:11, padding:"6px 12px", cursor:"pointer" }}>
                View live location
              </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {/* SOS Tab */}
      {tab==="sos"&&(
        <div>
          {sosAlerts.length===0&&<div style={{ color:"#888", textAlign:"center", padding:"2rem" }}>No active SOS alerts</div>}
          {sosAlerts.map(s=>(
            <div key={s.id} style={{ background:"#fff5f5", border:"1px solid #e24b4a40", borderRadius:10, padding:"1rem", marginBottom:8 }}>
              <div style={{ fontFamily:"Syne", fontSize:13, fontWeight:700, color:"#e24b4a", marginBottom:4, display:"flex", alignItems:"center", gap:4 }}><GOServiceIcon size={13} color="#e24b4a"/> {s.user?.first_name} {s.user?.last_name}</div>
              <div style={{ fontSize:12, color:"#555" }}>{s.message||"Emergency alert triggered"}</div>
              <div style={{ fontSize:11, color:"#aaa", marginTop:4 }}>{new Date(s.created_at).toLocaleString()}</div>
              <div style={{ display:"flex", gap:8, marginTop:8, alignItems:"center" }}>
                {s.phone&&(
                  <a href={`tel:${s.phone}`}
                    style={{ fontSize:11, color:"#1d9e75", textDecoration:"none", display:"flex", alignItems:"center", gap:4 }}>
                    <PhoneCallIcon size={11} color="#1d9e75"/> {s.phone}
                  </a>
                )}
                {s.latitude&&s.longitude&&(
                  <a href={`https://www.google.com/maps/dir/?api=1&destination=${s.latitude},${s.longitude}`} target="_blank" rel="noreferrer"
                    style={{ fontSize:11, color:"#378add", textDecoration:"none", display:"flex", alignItems:"center", gap:4 }}>
                    <LocationIcon size={11} color="#378add"/> View location
                  </a>
                )}
                <button onClick={()=>resolveSOS(s.id)}
                  style={{ background:"#1d9e75", border:"none", borderRadius:6, color:"#fff", fontSize:11, fontWeight:700, padding:"4px 10px", cursor:"pointer", display:"flex", alignItems:"center", gap:4, marginLeft:"auto" }}>
                  <CheckIcon size={11} color="#fff"/> Mark Resolved
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {/* Mechanics Tab */}
      {tab==="mechanics"&&(
        <div>
          {mechanics.length===0&&<div style={{ color:"#888", textAlign:"center", padding:"2rem" }}>No active mechanics</div>}
          {mechanics.map(m=>(
            <div key={m.id} style={{ background:"#fff", border:"1px solid #eee", borderRadius:10, padding:"1rem", marginBottom:8, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div>
                <div style={{ fontFamily:"Syne", fontSize:13, fontWeight:700, display:"flex", alignItems:"center", gap:4 }}><MechanicIcon size={13} color="#378add"/> {m.profile?.first_name} {m.profile?.last_name}</div>
                <div style={{ fontSize:11, color:"#888" }}>{m.specialization||"General mechanic"}</div>
                <div style={{ fontSize:11, color:m.is_available?"#1d9e75":"#888" }}>{m.is_available?"Available":"Busy"}</div>
              </div>
              <div style={{ textAlign:"right", fontSize:11, color:"#888" }}>
                <div>Jobs: {m.jobs_completed||0}</div>
                <div>{m.average_rating?Number(m.average_rating).toFixed(1)+" ⭐":"N/A"}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}



