import { useEffect, useState, useRef } from "react"
import { supabase } from "../../lib/supabase"
import { useAuth } from "../../contexts/AuthContext"
import useIsMobile from "../../lib/useIsMobile"
import toast from "react-hot-toast"

const SPECIALIZATIONS = [
  "General Mechanic","Engine Specialist","Electrical Systems","Brake Specialist",
  "Transmission Specialist","Tire & Wheel Specialist","Body & Paint",
  "AC & Cooling Systems","Suspension & Steering","Diagnostics Specialist",
  "Emergency Roadside","Mobile Mechanic",
]

const EMPTY = { first_name:"", last_name:"", phone:"", specialization:"General Mechanic", notes:"" }

export default function ProviderMechanics() {
  const { user } = useAuth()
  const isMobile = useIsMobile()
  const [mechanics, setMechanics] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [trackingMechanic, setTrackingMechanic] = useState(null)
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const markerRef = useRef(null)

  useEffect(() => {
    if (!user) return
    load()
    const sub = supabase.channel("mechanics-live")
      .on("postgres_changes", { event:"*", schema:"public", table:"mechanics", filter:`provider_id=eq.${user.id}` }, () => load())
      .subscribe()
    return () => supabase.removeChannel(sub)
  }, [user])

  useEffect(() => {
    if (!trackingMechanic) return
    const sub = supabase.channel(`mechanic-location-${trackingMechanic.id}`)
      .on("postgres_changes", { event:"INSERT", schema:"public", table:"mechanic_location_history", filter:`mechanic_id=eq.${trackingMechanic.id}` },
        payload => {
          const { latitude, longitude } = payload.new
          setTrackingMechanic(m => ({ ...m, current_latitude:latitude, current_longitude:longitude }))
          if (markerRef.current && mapInstanceRef.current) {
            markerRef.current.setLatLng([latitude, longitude])
            mapInstanceRef.current.panTo([latitude, longitude])
          }
        })
      .subscribe()
    return () => supabase.removeChannel(sub)
  }, [trackingMechanic?.id])

  useEffect(() => {
    if (!trackingMechanic || !mapRef.current) return
    if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null }
    const lat = trackingMechanic.current_latitude || -1.2921
    const lng = trackingMechanic.current_longitude || 36.8219
    setTimeout(() => {
      if (!mapRef.current) return
      const L = window.L
      if (!L) return
      const map = L.map(mapRef.current).setView([lat, lng], 14)
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map)
      const icon = L.divIcon({ className:"", html:`<div style="background:#1d9e75;width:32px;height:32px;border-radius:50%;border:3px solid #fff;display:flex;align-items:center;justify-content:center;font-size:16px;">👨‍🔧</div>`, iconSize:[32,32], iconAnchor:[16,16] })
      markerRef.current = L.marker([lat, lng], { icon }).addTo(map).bindPopup(`${trackingMechanic.first_name} ${trackingMechanic.last_name}`)
      mapInstanceRef.current = map
    }, 100)
    return () => { if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null } }
  }, [trackingMechanic?.id])

  async function load() {
    const { data } = await supabase.from("mechanics").select("*").eq("provider_id", user.id).order("created_at", { ascending:false })
    setMechanics(data||[])
    setLoading(false)
  }

  async function save(e) {
    e.preventDefault()
    if (!form.first_name||!form.last_name) return toast.error("Name required")
    setSaving(true)
    try {
      if (editing) {
        const { error } = await supabase.from("mechanics").update({
          first_name:form.first_name, last_name:form.last_name, phone:form.phone,
          specialization:form.specialization, notes:form.notes,
        }).eq("id", editing).eq("provider_id", user.id)
        if (error) throw error
        toast.success("Mechanic updated")
      } else {
        const { error } = await supabase.from("mechanics").insert({
          provider_id:user.id, first_name:form.first_name, last_name:form.last_name,
          phone:form.phone, specialization:form.specialization, notes:form.notes,
          is_available:true, is_active:true,
        })
        if (error) throw error
        toast.success("Mechanic added")
      }
      setForm(EMPTY); setShowForm(false); setEditing(null); load()
    } catch(err) { toast.error(err.message) }
    finally { setSaving(false) }
  }

  async function toggleAvailable(id, is_available) {
    await supabase.from("mechanics").update({ is_available:!is_available }).eq("id",id).eq("provider_id",user.id)
    toast.success(is_available?"Marked as unavailable":"Marked as available")
    load()
  }

  async function toggleActive(id, is_active) {
    await supabase.from("mechanics").update({ is_active:!is_active }).eq("id",id).eq("provider_id",user.id)
    toast.success(is_active?"Mechanic deactivated":"Mechanic activated")
    load()
  }

  async function deleteMechanic(id, name) {
    if (!confirm(`Remove ${name} from your team?`)) return
    await supabase.from("mechanics").delete().eq("id",id).eq("provider_id",user.id)
    toast.success("Mechanic removed"); load()
  }

  function startEdit(m) {
    setEditing(m.id)
    setForm({ first_name:m.first_name, last_name:m.last_name, phone:m.phone||"", specialization:m.specialization||"General Mechanic", notes:m.notes||"" })
    setShowForm(true)
  }

  function openTracking(m) {
    setTrackingMechanic(m)
  }

  const available = mechanics.filter(m=>m.is_available&&m.is_active).length
  const onJob = mechanics.filter(m=>!m.is_available&&m.is_active).length
  const inp = { width:"100%", background:"#ffffff", border:"1px solid #e5e5e5", borderRadius:8, padding:"11px 12px", color:"#000000", fontSize:13, outline:"none", fontFamily:"'DM Sans',sans-serif", marginBottom:12 }
  const lbl = { fontSize:11, color:"#666", textTransform:"uppercase", letterSpacing:"0.05em", display:"block", marginBottom:4 }

  if (trackingMechanic) return (
    <div>
      <button onClick={()=>{ setTrackingMechanic(null); if(mapInstanceRef.current){mapInstanceRef.current.remove();mapInstanceRef.current=null} }}
        style={{ background:"none", border:"none", color:"#378add", cursor:"pointer", fontSize:13, marginBottom:"1rem", fontFamily:"'DM Sans',sans-serif", padding:0 }}>
        ← Back to mechanics
      </button>
      <div style={{ background:"#ffffff", border:"1px solid #eeeeee", borderRadius:12, padding:"1rem", marginBottom:"1rem" }}>
        <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:12 }}>
          <div style={{ width:48, height:48, borderRadius:"50%", background:"#071a12", border:"2px solid #1d9e7540", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"Syne", fontSize:16, fontWeight:800, color:"#1d9e75", flexShrink:0 }}>
            {trackingMechanic.first_name[0]}{trackingMechanic.last_name[0]}
          </div>
          <div>
            <div style={{ fontFamily:"Syne", fontSize:16, fontWeight:800, color:"#000000" }}>{trackingMechanic.first_name} {trackingMechanic.last_name}</div>
            <div style={{ fontSize:12, color:"#777777" }}>🔧 {trackingMechanic.specialization}</div>
            {trackingMechanic.phone&&<div style={{ fontSize:12, color:"#777777" }}>📞 {trackingMechanic.phone}</div>}
          </div>
          <div style={{ marginLeft:"auto" }}>
            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
              <div style={{ width:8, height:8, borderRadius:"50%", background:trackingMechanic.current_latitude?"#1d9e75":"#555", boxShadow:trackingMechanic.current_latitude?"0 0 6px #1d9e75":"none" }}/>
              <span style={{ fontSize:11, color:trackingMechanic.current_latitude?"#1d9e75":"#555" }}>
                {trackingMechanic.current_latitude?"Live location":"No location yet"}
              </span>
            </div>
          </div>
        </div>

        {trackingMechanic.current_latitude?(
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:12 }}>
            <div style={{ background:"#ffffff", borderRadius:8, padding:"0.75rem" }}>
              <div style={{ fontSize:10, color:"#777777", marginBottom:2 }}>Latitude</div>
              <div style={{ fontSize:13, color:"#1d9e75", fontFamily:"monospace" }}>{trackingMechanic.current_latitude?.toFixed(6)}</div>
            </div>
            <div style={{ background:"#ffffff", borderRadius:8, padding:"0.75rem" }}>
              <div style={{ fontSize:10, color:"#777777", marginBottom:2 }}>Longitude</div>
              <div style={{ fontSize:13, color:"#1d9e75", fontFamily:"monospace" }}>{trackingMechanic.current_longitude?.toFixed(6)}</div>
            </div>
          </div>
        ):(
          <div style={{ background:"#ffffff", borderRadius:8, padding:"0.75rem", marginBottom:12, fontSize:12, color:"#888888", textAlign:"center" }}>
            Waiting for mechanic to share location...
          </div>
        )}

        <div ref={mapRef} style={{ height:300, borderRadius:10, overflow:"hidden", background:"#f5f5f5" }}>
          {!trackingMechanic.current_latitude&&(
            <div style={{ height:"100%", display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:8 }}>
              <div style={{ fontSize:28 }}>📍</div>
              <div style={{ fontSize:12, color:"#777777" }}>No location shared yet</div>
            </div>
          )}
        </div>
      </div>

      <div style={{ background:"#ffffff", border:"1px solid #eeeeee", borderRadius:12, padding:"1rem" }}>
        <div style={{ fontFamily:"Syne", fontSize:13, fontWeight:700, marginBottom:"0.75rem", color:"#000000" }}>Location history</div>
        <LocationHistory mechanicId={trackingMechanic.id} />
      </div>
    </div>
  )

  return (
    <div>
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"/>

      <div style={{ display:"grid", gridTemplateColumns:isMobile?"repeat(2,1fr)":"repeat(4,1fr)", gap:10, marginBottom:"1.5rem" }}>
        {[
          { label:"Total mechanics", value:mechanics.length, color:"#000000" },
          { label:"Available now", value:available, color:"#1d9e75" },
          { label:"On job", value:onJob, color:"#e6821e" },
          { label:"Inactive", value:mechanics.filter(m=>!m.is_active).length, color:"#777777" },
        ].map(s=>(
          <div key={s.label} style={{ background:"#ffffff", borderRadius:10, padding:"1rem", border:"1px solid #eeeeee" }}>
            <div style={{ fontSize:10, color:"#777777", textTransform:"uppercase", marginBottom:4 }}>{s.label}</div>
            <div style={{ fontFamily:"Syne", fontSize:20, fontWeight:800, color:s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"1rem" }}>
        <div style={{ fontFamily:"Syne", fontSize:16, fontWeight:800, color:"#000000" }}>Your mechanics team</div>
        <button onClick={()=>{ setShowForm(true); setEditing(null); setForm(EMPTY) }}
          style={{ background:"#378add", border:"none", borderRadius:9, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:13, fontWeight:700, padding:"9px 18px", cursor:"pointer" }}>
          + Add mechanic
        </button>
      </div>

      {showForm&&(
        <div style={{ background:"#ffffff", border:"1px solid #eeeeee", borderRadius:12, padding:"1.25rem", marginBottom:"1.5rem" }}>
          <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:700, marginBottom:"1rem", color:"#000000" }}>
            {editing?"Edit mechanic":"Add new mechanic"}
          </div>
          <form onSubmit={save}>
            <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:10 }}>
              <div><label style={lbl}>First name</label><input style={inp} placeholder="John" value={form.first_name} onChange={e=>setForm(f=>({...f,first_name:e.target.value}))} required/></div>
              <div><label style={lbl}>Last name</label><input style={inp} placeholder="Doe" value={form.last_name} onChange={e=>setForm(f=>({...f,last_name:e.target.value}))} required/></div>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:10 }}>
              <div><label style={lbl}>Phone number</label><input style={inp} placeholder="+254 700 000 000" value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))}/></div>
              <div>
                <label style={lbl}>Specialization</label>
                <select style={inp} value={form.specialization} onChange={e=>setForm(f=>({...f,specialization:e.target.value}))}>
                  {SPECIALIZATIONS.map(s=><option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <label style={lbl}>Notes (optional)</label>
            <textarea style={{ ...inp, resize:"vertical", minHeight:60 }} placeholder="Any additional notes..." value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))}/>
            <div style={{ display:"flex", gap:8 }}>
              <button type="submit" disabled={saving}
                style={{ background:saving?"#333":"#378add", border:"none", borderRadius:9, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:13, fontWeight:700, padding:"10px 24px", cursor:saving?"not-allowed":"pointer" }}>
                {saving?"Saving...":editing?"Update":"Add mechanic"}
              </button>
              <button type="button" onClick={()=>{ setShowForm(false); setEditing(null); setForm(EMPTY) }}
                style={{ background:"none", border:"1px solid #dddddd", borderRadius:9, color:"#666", fontSize:13, padding:"10px 18px", cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {loading&&<div style={{ color:"#777777", fontSize:13 }}>Loading...</div>}
      {!loading&&mechanics.length===0&&(
        <div style={{ color:"#888888", fontSize:13, textAlign:"center", padding:"3rem" }}>
          <div style={{ fontSize:32, marginBottom:10 }}>👨‍🔧</div>
          No mechanics added yet.
        </div>
      )}

      {mechanics.map(m=>(
        <div key={m.id} style={{ background:"#ffffff", border:`1px solid ${m.is_active?m.is_available?"#1d9e7530":"#e6821e30":"#1e1e1e"}`, borderRadius:10, padding:isMobile?"0.75rem":"1rem", marginBottom:8, opacity:m.is_active?1:0.5 }}>
          <div style={{ display:"flex", alignItems:"flex-start", gap:10, flexWrap:isMobile?"wrap":"nowrap" }}>
            <div style={{ width:44, height:44, borderRadius:"50%", background:m.is_available&&m.is_active?"#071a12":"#1a1a1a", border:`1px solid ${m.is_available&&m.is_active?"#1d9e7540":"#333"}`, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"Syne", fontSize:14, fontWeight:800, color:m.is_available&&m.is_active?"#1d9e75":"#555", flexShrink:0 }}>
              {m.first_name[0]}{m.last_name[0]}
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4, flexWrap:"wrap" }}>
                <div style={{ fontSize:13, fontWeight:600, color:"#000000" }}>{m.first_name} {m.last_name}</div>
                <span style={{ fontSize:10, padding:"2px 8px", borderRadius:10, background:m.is_available&&m.is_active?"#071a12":"#1a1a1a", color:m.is_available&&m.is_active?"#1d9e75":"#555" }}>
                  {m.is_active?(m.is_available?"Available":"On job"):"Inactive"}
                </span>
                {m.current_latitude&&<span style={{ fontSize:10, color:"#1d9e75" }}>📍 Live</span>}
              </div>
              <div style={{ fontSize:11, color:"#777777", marginBottom:2 }}>🔧 {m.specialization}</div>
              {m.phone&&<div style={{ fontSize:11, color:"#777777", marginBottom:2 }}>📞 {m.phone}</div>}
              {m.last_location_update&&<div style={{ fontSize:10, color:"#888888" }}>Last seen: {new Date(m.last_location_update).toLocaleTimeString()}</div>}
            </div>
            <div style={{ display:"flex", gap:6, flexShrink:0, flexWrap:"wrap", justifyContent:"flex-end", marginTop:isMobile?8:0 }}>
              <button onClick={()=>openTracking(m)}
                style={{ background:"#071a12", border:"1px solid #1d9e7540", borderRadius:7, color:"#1d9e75", fontSize:11, padding:"5px 10px", cursor:"pointer" }}>
                📍 Track
              </button>
              <button onClick={()=>startEdit(m)}
                style={{ background:"#0c1f2e", border:"1px solid #378add40", borderRadius:7, color:"#378add", fontSize:11, padding:"5px 10px", cursor:"pointer" }}>
                Edit
              </button>
              {m.is_active&&(
                <button onClick={()=>toggleAvailable(m.id, m.is_available)}
                  style={{ background:m.is_available?"#1a1208":"#071a12", border:`1px solid ${m.is_available?"#e6821e40":"#1d9e7540"}`, borderRadius:7, color:m.is_available?"#e6821e":"#1d9e75", fontSize:11, padding:"5px 10px", cursor:"pointer" }}>
                  {m.is_available?"Set on job":"Set available"}
                </button>
              )}
              <button onClick={()=>toggleActive(m.id, m.is_active)}
                style={{ background:"none", border:`1px solid ${m.is_active?"#e24b4a20":"#1d9e7520"}`, borderRadius:7, color:m.is_active?"#e24b4a":"#1d9e75", fontSize:11, padding:"5px 10px", cursor:"pointer" }}>
                {m.is_active?"Deactivate":"Activate"}
              </button>
              <button onClick={()=>deleteMechanic(m.id, `${m.first_name} ${m.last_name}`)}
                style={{ background:"none", border:"1px solid #e24b4a20", borderRadius:7, color:"#e24b4a", fontSize:11, padding:"5px 10px", cursor:"pointer" }}>
                Remove
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function LocationHistory({ mechanicId }) {
  const [history, setHistory] = useState([])
  useEffect(() => {
    supabase.from("mechanic_location_history").select("*").eq("mechanic_id", mechanicId).order("recorded_at", { ascending:false }).limit(10).then(({ data }) => setHistory(data||[]))
  }, [mechanicId])
  if (!history.length) return <div style={{ fontSize:12, color:"#888888" }}>No location history</div>
  return history.map((h,i)=>(
    <div key={h.id} style={{ display:"flex", justifyContent:"space-between", padding:"6px 0", borderBottom:"1px solid #eeeeee", fontSize:11 }}>
      <span style={{ color:"#777777", fontFamily:"monospace" }}>{h.latitude.toFixed(5)}, {h.longitude.toFixed(5)}</span>
      <span style={{ color:"#888888" }}>{new Date(h.recorded_at).toLocaleTimeString()}</span>
    </div>
  ))
}



