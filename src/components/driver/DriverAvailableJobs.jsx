import useIsMobile from "../../lib/useIsMobile"
import { useEffect, useState, useRef } from "react"
import { supabase } from "../../lib/supabase"
import { useAuth } from "../../contexts/AuthContext"
import { contactViaWhatsApp } from "../../lib/contact"
import { useNavigate } from "react-router-dom"
import toast from "react-hot-toast"
import { useLanguage } from "../../contexts/LanguageContext"

export default function DriverAvailableJobs() {
  const isMobile = useIsMobile()
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const { t, language } = useLanguage()
  const [isOnline, setIsOnline] = useState(false)
  const [jobs, setJobs] = useState([])
  const [customers, setCustomers] = useState({})
  const [loading, setLoading] = useState(true)
  const [declining, setDeclining] = useState(null)
  const [declineReason, setDeclineReason] = useState("")
  const watchRef = useRef(null)
  const inactivityRef = useRef(null)

  useEffect(() => {
    if (!user) return
    initStatus()
    load()
    const sub = supabase.channel("avail-jobs")
      .on("postgres_changes", { event:"INSERT", schema:"public", table:"bookings" }, () => load())
      .on("postgres_changes", { event:"UPDATE", schema:"public", table:"bookings" }, () => load())
      .subscribe()
    return () => {
      supabase.removeChannel(sub)
      if (watchRef.current) navigator.geolocation.clearWatch(watchRef.current)
      if (inactivityRef.current) clearTimeout(inactivityRef.current)
    }
  }, [user])

  async function initStatus() {
    const { data } = await supabase.from("driver_status").select("is_online").eq("driver_id", user.id).single()
    if (data) { setIsOnline(data.is_online); if (data.is_online) startTracking() }
    else { await supabase.from("driver_status").insert({ driver_id:user.id, is_online:false }) }
  }

  async function load() {
    const { data } = await supabase.from("bookings")
      .select("*").eq("is_concierge",true).eq("status","confirmed").is("driver_id",null)
      .order("booking_date",{ascending:true})
    setJobs(data||[])
    if (data&&data.length>0) {
      const ids = [...new Set(data.map(b=>b.customer_id))]
      const { data: profs } = await supabase.from("profile_public").select("id,first_name,last_name").in("id", ids)
      const map = {}
      ids.forEach(id=>{ map[id] = profs?.find(p=>p.id===id) })
      setCustomers(map)
    }
    setLoading(false)
  }

  function startTracking() {
    if (!navigator.geolocation) return
    watchRef.current = navigator.geolocation.watchPosition(async (pos) => {
      await supabase.from("driver_status").upsert({ driver_id:user.id, is_online:true, current_lat:pos.coords.latitude, current_lng:pos.coords.longitude, last_location_update:new Date().toISOString(), updated_at:new Date().toISOString() })
      resetInactivity()
    }, null, { enableHighAccuracy:true, maximumAge:10000, timeout:5000 })
  }

  function resetInactivity() {
    if (inactivityRef.current) clearTimeout(inactivityRef.current)
    inactivityRef.current = setTimeout(async () => {
      await supabase.from("driver_status").upsert({ driver_id:user.id, is_online:false, updated_at:new Date().toISOString() })
      setIsOnline(false)
      if (watchRef.current) navigator.geolocation.clearWatch(watchRef.current)
      toast("You were set offline due to inactivity", { icon:"⏰" })
    }, 30*60*1000)
  }

  async function toggleOnline() {
    const next = !isOnline
    await supabase.from("driver_status").upsert({ driver_id:user.id, is_online:next, updated_at:new Date().toISOString() })
    setIsOnline(next)
    if (next) { startTracking(); toast.success("You are now online") }
    else {
      if (watchRef.current) navigator.geolocation.clearWatch(watchRef.current)
      if (inactivityRef.current) clearTimeout(inactivityRef.current)
      toast.success("You are now offline")
    }
  }

  async function acceptJob(bookingId) {
    const { error } = await supabase.from("bookings").update({ driver_id:user.id, status:"driver-assigned" }).eq("id",bookingId).is("driver_id",null)
    if (error) return toast.error(error.message)
    const booking = jobs.find(j=>j.id===bookingId)
    if (booking) await supabase.from("notifications").insert({ user_id:booking.customer_id, title:"Driver assigned", message:`A driver is on their way for ${booking.service_name}`, type:"success" })
    toast.success("Job accepted!")
    setTimeout(() => navigate("/dashboard/active"), 800)
    load()
  }

  async function declineJob(bookingId) {
    if (!declineReason.trim()) return toast.error("Please provide a reason")
    toast.success("Job declined")
    setDeclining(null); setDeclineReason(""); load()
  }

  function calculateETA(date, time) {
    if (!date||!time) return "Unknown"
    const dt = new Date(`${date}T${time}`)
    const diff = dt - new Date()
    if (diff<0) return "Now"
    const h = Math.floor(diff/3600000)
    const m = Math.floor((diff%3600000)/60000)
    return h>0?`${h}h ${m}m`:`${m}m`
  }

  function openMaps(address) {
    if (!address) return toast.error("No address available")
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`, "_blank")
  }

  const driverName = profile?.first_name || "Your driver"

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"1.5rem" }}>
        <div>
          <div style={{ fontFamily:"Syne", fontSize:18, fontWeight:800, color:"#f0ede6" }}>Available Jobs</div>
          <div style={{ fontSize:12, color:"#555", marginTop:2 }}>{jobs.length} job{jobs.length!==1?"s":""} waiting</div>
        </div>
        <button onClick={toggleOnline}
          style={{ background:isOnline?"#071a12":"#1a0a08", border:`1px solid ${isOnline?"#1d9e75":"#e6821e"}`, borderRadius:20, color:isOnline?"#1d9e75":"#e6821e", fontSize:13, fontWeight:500, padding:"8px 18px", cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}>
          {isOnline?language==="sw"?"● Mtandaoni":"● Online":language==="sw"?"○ Nje ya mtandao":"○ Offline"}
        </button>
      </div>

      {!isOnline&&(
        <div style={{ background:"#111", border:"1px solid #1e1e1e", borderRadius:10, padding:"2rem", textAlign:"center", marginBottom:10 }}>
          <div style={{ fontSize:28, marginBottom:8 }}>📦</div>
          <div style={{ fontSize:14, color:"#555", marginBottom:4 }}>You are offline</div>
          <div style={{ fontSize:12, color:"#444" }}>Go online to see and accept delivery jobs</div>
        </div>
      )}

      {loading&&<div style={{ color:"#555", fontSize:13 }}>Loading...</div>}
      {isOnline&&!loading&&jobs.length===0&&(
        <div style={{ background:"#111", border:"1px solid #1e1e1e", borderRadius:10, padding:"2rem", textAlign:"center" }}>
          <div style={{ fontSize:28, marginBottom:8 }}>🎉</div>
          <div style={{ fontSize:14, color:"#555" }}>No jobs available right now</div>
          <div style={{ fontSize:12, color:"#444", marginTop:4 }}>New jobs will appear here automatically</div>
        </div>
      )}

      {isOnline&&jobs.map(j=>{
        const customer = customers[j.customer_id]
        const eta = calculateETA(j.booking_date, j.booking_time)
        const customerName = `${customer?.first_name||""} ${customer?.last_name||""}`.trim() || "Customer"
        return (
          <div key={j.id} style={{ background:"#111", border:"1px solid #1e1e1e", borderRadius:10, padding:"1rem", marginBottom:10 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
              <div>
                <div style={{ fontSize:14, fontWeight:500, color:"#f0ede6" }}>{j.service_name}</div>
                <div style={{ fontSize:11, color:"#555", marginTop:2 }}>{customerName}</div>
              </div>
              <div style={{ textAlign:"right" }}>
                <div style={{ fontFamily:"Syne", fontSize:16, fontWeight:800, color:"#e6821e" }}>+$15</div>
                <div style={{ fontSize:10, color:"#555" }}>ETA: {eta}</div>
              </div>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:8, marginBottom:12 }}>
              <div><div style={{ fontSize:10, color:"#555" }}>PICKUP</div><div style={{ fontSize:12, color:"#f0ede6" }}>{j.pickup_address||"Customer location"}</div></div>
              <div><div style={{ fontSize:10, color:"#555" }}>DATE & TIME</div><div style={{ fontSize:12, color:"#f0ede6" }}>{j.booking_date} · {j.booking_time?.slice(0,5)}</div></div>
            </div>
            <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
              <button onClick={()=>acceptJob(j.id)}
                style={{ background:"#e6821e", border:"none", borderRadius:8, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:13, fontWeight:700, padding:"9px 20px", cursor:"pointer" }}>
                Accept Job
              </button>
              <button onClick={()=>openMaps(j.pickup_address)}
                style={{ background:"#071a12", border:"1px solid #1d9e7540", borderRadius:7, color:"#1d9e75", fontSize:11, padding:"5px 10px", cursor:"pointer" }}>
                Maps
              </button>
              <button onClick={()=>contactViaWhatsApp(j.id, customerName, j.service_name, driverName)}
                style={{ background:"#071a12", border:"1px solid #1d9e7540", borderRadius:7, color:"#1d9e75", fontSize:11, padding:"5px 10px", cursor:"pointer" }}>
                WhatsApp
              </button>
              <button onClick={()=>setDeclining(j.id)}
                style={{ background:"none", border:"1px solid #e24b4a40", borderRadius:7, color:"#e24b4a", fontSize:11, padding:"5px 10px", cursor:"pointer" }}>
                Decline
              </button>
            </div>
            {declining===j.id&&(
              <div style={{ marginTop:10 }}>
                <input placeholder="Reason for declining..." value={declineReason} onChange={e=>setDeclineReason(e.target.value)}
                  style={{ width:"100%", background:"#0f0f0f", border:"1px solid #222", borderRadius:7, padding:"8px 10px", color:"#f0ede6", fontSize:12, outline:"none", fontFamily:"'DM Sans',sans-serif", marginBottom:8 }}/>
                <div style={{ display:"flex", gap:8 }}>
                  <button onClick={()=>declineJob(j.id)} style={{ background:"#1a0808", border:"1px solid #e24b4a40", borderRadius:7, color:"#e24b4a", fontSize:12, padding:"6px 14px", cursor:"pointer" }}>Confirm decline</button>
                  <button onClick={()=>{ setDeclining(null); setDeclineReason("") }} style={{ background:"none", border:"1px solid #333", borderRadius:7, color:"#666", fontSize:12, padding:"6px 14px", cursor:"pointer" }}>Cancel</button>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}


