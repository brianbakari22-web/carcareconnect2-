import { useEffect, useState } from "react"
import { useAuth } from "../../contexts/AuthContext"
import { supabase } from "../../lib/supabase"

export default function AdminTripReports() {
  const { user, profile } = useAuth()
  if (!user || profile?.role !== "admin") return null
  const [bookings, setBookings] = useState([])
  const [selected, setSelected] = useState(null)
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingLogs, setLoadingLogs] = useState(false)
  const [search, setSearch] = useState("")

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase.from("bookings")
      .select("*, customer:profiles!bookings_customer_id_fkey(first_name,last_name), driver:profiles!bookings_driver_id_fkey(first_name,last_name,driver_vehicle_type,driver_category), vehicles(make,model,license_plate)")
      .not("driver_id","is",null)
      .order("created_at",{ascending:false})
      .limit(50)
    setBookings(data||[])
    setLoading(false)
  }

  async function loadLogs(booking) {
    setSelected(booking)
    setLoadingLogs(true)
    const { data } = await supabase.from("booking_location_logs")
      .select("*").eq("booking_id", booking.id)
      .order("recorded_at",{ascending:true})
    setLogs(data||[])
    setLoadingLogs(false)
  }

  function calcDistance(logs) {
    if (logs.length < 2) return 0
    let total = 0
    for (let i=1;i<logs.length;i++) {
      const R=6371,dLat=(logs[i].lat-logs[i-1].lat)*Math.PI/180,dLng=(logs[i].lng-logs[i-1].lng)*Math.PI/180
      const a=Math.sin(dLat/2)**2+Math.cos(logs[i-1].lat*Math.PI/180)*Math.cos(logs[i].lat*Math.PI/180)*Math.sin(dLng/2)**2
      total+=R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a))
    }
    return total.toFixed(1)
  }

  function calcDuration(logs) {
    if (logs.length<2) return "—"
    const mins=Math.round((new Date(logs[logs.length-1].recorded_at)-new Date(logs[0].recorded_at))/60000)
    return mins<60?mins+"min":Math.floor(mins/60)+"h "+(mins%60)+"min"
  }

  const filtered = bookings.filter(b=>`${b.customer?.first_name} ${b.customer?.last_name} ${b.driver?.first_name} ${b.driver?.last_name} ${b.booking_number} ${b.service_name}`.toLowerCase().includes(search.toLowerCase()))
  const SC = { pending:"#e6821e", confirmed:"#378add", "in-progress":"#8b5cf6", completed:"#1d9e75", cancelled:"#e24b4a" }

  return (
    <div>
      <div style={{ fontFamily:"Syne", fontSize:18, fontWeight:800, color:"#000", marginBottom:"1rem" }}>📍 Admin Trip Reports</div>
      {selected ? (
        <div>
          <button onClick={()=>{ setSelected(null); setLogs([]) }} style={{ background:"none", border:"none", color:"#e6821e", cursor:"pointer", fontSize:13, marginBottom:"1rem", padding:0 }}>← Back</button>
          <div style={{ background:"#f8f8f8", borderRadius:12, padding:"1rem", marginBottom:"1rem" }}>
            <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:800 }}>{selected.service_name}</div>
            <div style={{ fontSize:11, color:"#888" }}>#{selected.booking_number} · {selected.booking_date}</div>
            <div style={{ fontSize:11, color:"#888" }}>Customer: {selected.customer?.first_name} {selected.customer?.last_name}</div>
            <div style={{ fontSize:11, color:"#378add" }}>Driver: {selected.driver?.first_name} {selected.driver?.last_name} · {selected.driver?.driver_category==="concierge"?"🧑‍✈️":"🚗"}</div>
            {selected.vehicles&&<div style={{ fontSize:11, color:"#888" }}>🚗 {selected.vehicles.make} {selected.vehicles.model} · {selected.vehicles.license_plate}</div>}
          </div>
          {loadingLogs?(
            <div style={{ color:"#888", fontSize:13, padding:"2rem", textAlign:"center" }}>Loading GPS data...</div>
          ):logs.length===0?(
            <div style={{ color:"#888", fontSize:13, padding:"2rem", textAlign:"center" }}>📍 No GPS data for this booking</div>
          ):(
            <div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8, marginBottom:"1rem" }}>
                {[{label:"Distance",value:calcDistance(logs)+" km"},{label:"Duration",value:calcDuration(logs)},{label:"GPS points",value:logs.length}].map(s=>(
                  <div key={s.label} style={{ background:"#fff", border:"1px solid #eee", borderRadius:10, padding:"0.75rem", textAlign:"center" }}>
                    <div style={{ fontFamily:"Syne", fontSize:18, fontWeight:800, color:"#e6821e" }}>{s.value}</div>
                    <div style={{ fontSize:10, color:"#888", marginTop:2 }}>{s.label}</div>
                  </div>
                ))}
              </div>
              <div style={{ background:"#f8f8f8", borderRadius:10, padding:"0.75rem", marginBottom:"1rem", fontSize:12, color:"#666" }}>
                <div>🟢 Start: {new Date(logs[0].recorded_at).toLocaleTimeString()} · {logs[0].lat?.toFixed(5)}, {logs[0].lng?.toFixed(5)}</div>
                <div>🔴 End: {new Date(logs[logs.length-1].recorded_at).toLocaleTimeString()} · {logs[logs.length-1].lat?.toFixed(5)}, {logs[logs.length-1].lng?.toFixed(5)}</div>
              </div>
              <div style={{ fontFamily:"Syne", fontSize:13, fontWeight:700, marginBottom:8 }}>📍 GPS Timeline</div>
              <div style={{ maxHeight:300, overflowY:"auto", background:"#f8f8f8", borderRadius:10, padding:"0.5rem" }}>
                {logs.map((log,i)=>(
                  <div key={log.id} style={{ display:"flex", gap:8, alignItems:"center", padding:"5px 8px", borderBottom:"1px solid #eee", fontSize:11, color:"#666" }}>
                    <span style={{ color:"#e6821e", minWidth:24, fontWeight:700 }}>{i+1}</span>
                    <span style={{ minWidth:65 }}>{new Date(log.recorded_at).toLocaleTimeString()}</span>
                    <span style={{ flex:1, color:"#888" }}>{log.lat?.toFixed(5)}, {log.lng?.toFixed(5)}</span>
                    <span style={{ background:log.source==="tracker"?"#e8f5e9":"#eff6ff", color:log.source==="tracker"?"#1d9e75":"#378add", borderRadius:4, padding:"1px 6px", fontSize:10 }}>
                      {log.source==="tracker"?"📡 Tracker":"🚗 Driver"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search booking, customer, driver..."
            style={{ width:"100%", background:"#f8f8f8", border:"1px solid #eee", borderRadius:8, padding:"9px 12px", fontSize:13, outline:"none", marginBottom:"1rem", boxSizing:"border-box" }}/>
          {loading&&<div style={{ color:"#888", fontSize:13 }}>Loading...</div>}
          {filtered.map(b=>(
            <div key={b.id} onClick={()=>loadLogs(b)}
              style={{ background:"#f8f8f8", border:"1px solid #eee", borderRadius:10, padding:"1rem", marginBottom:8, cursor:"pointer" }}
              onMouseEnter={e=>e.currentTarget.style.background="#f0f0f0"}
              onMouseLeave={e=>e.currentTarget.style.background="#f8f8f8"}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                <div>
                  <div style={{ fontFamily:"Syne", fontSize:13, fontWeight:700, marginBottom:2 }}>{b.service_name}</div>
                  <div style={{ fontSize:11, color:"#888" }}>#{b.booking_number} · {b.booking_date}</div>
                  <div style={{ fontSize:11, color:"#555", marginTop:2 }}>👤 {b.customer?.first_name} {b.customer?.last_name}</div>
                  <div style={{ fontSize:11, color:"#378add" }}>🚗 {b.driver?.first_name} {b.driver?.last_name}</div>
                </div>
                <div style={{ textAlign:"right" }}>
                  <span style={{ fontSize:10, padding:"2px 8px", borderRadius:10, background:`${SC[b.status]||"#888"}20`, color:SC[b.status]||"#888" }}>{b.status}</span>
                  <div style={{ fontSize:11, color:"#e6821e", marginTop:6 }}>View GPS →</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}