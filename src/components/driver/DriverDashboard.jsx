import { useState, useEffect, useRef } from "react"
import { supabase } from "../../lib/supabase"
import { useAuth } from "../../contexts/AuthContext"
import toast from "react-hot-toast"

const DELIVERY_STEPS = [
  { status:"driver-assigned", label:"Accepted", icon:"✓" },
  { status:"arrived-for-pickup", label:"Arrived for pickup", icon:"📍" },
  { status:"in-progress", label:"Vehicle picked up", icon:"🚗" },
  { status:"arrived-at-dropoff", label:"Arrived at dropoff", icon:"📍" },
  { status:"completed", label:"Delivered", icon:"✅" },
]
const STATUS_NEXT = {
  "driver-assigned": { next:"arrived-for-pickup", label:"Mark arrived at pickup", color:"#378add" },
  "arrived-for-pickup": { next:"in-progress", label:"Mark vehicle picked up", color:"#8b5cf6" },
  "in-progress": { next:"arrived-at-dropoff", label:"Mark arrived at dropoff", color:"#e6821e" },
  "arrived-at-dropoff": { next:"completed", label:"Mark delivered", color:"#1d9e75" },
}

export default function DriverDashboard() {
  const { user, profile } = useAuth()
  const [isOnline, setIsOnline] = useState(false)
  const [jobs, setJobs] = useState([])
  const [myJobs, setMyJobs] = useState([])
  const [customers, setCustomers] = useState({})
  const [stats, setStats] = useState({ today:0, total:0, deliveries:0, hoursOnline:0 })
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState("available")
  const [declining, setDeclining] = useState(null)
  const [declineReason, setDeclineReason] = useState("")
  const [shiftStart, setShiftStart] = useState(null)
  const watchRef = useRef(null)
  const inactivityRef = useRef(null)
  const onlineStartRef = useRef(null)

  useEffect(() => {
    if (!user) return
    initDriverStatus()
    load()
    const sub = supabase.channel("driver-jobs")
      .on("postgres_changes", { event:"*", schema:"public", table:"bookings" }, () => load())
      .subscribe()
    return () => {
      supabase.removeChannel(sub)
      if (watchRef.current) navigator.geolocation.clearWatch(watchRef.current)
      if (inactivityRef.current) clearTimeout(inactivityRef.current)
    }
  }, [user])

  async function initDriverStatus() {
    const { data } = await supabase.from("driver_status").select("*").eq("driver_id", user.id).single()
    if (data) { setIsOnline(data.is_online); if (data.is_online) startLocationTracking() }
    else { await supabase.from("driver_status").insert({ driver_id:user.id, is_online:false }) }
  }

  async function load() {
    const [{ data: available }, { data: mine }] = await Promise.all([
      supabase.from("bookings").select("*").eq("is_concierge",true).in("status",["confirmed"]).is("driver_id",null).order("booking_date",{ascending:true}),
      supabase.from("bookings").select("*").eq("driver_id",user.id).order("created_at",{ascending:false})
    ])
    setJobs(available||[]); setMyJobs(mine||[])
    const allBookings = [...(available||[]),...(mine||[])]
    if (allBookings.length > 0) {
      const ids = [...new Set(allBookings.map(b=>b.customer_id))]
      const [{ data:sens },{ data:profs }] = await Promise.all([
        supabase.from("profile_sensitive").select("id,phone,email").in("id",ids),
        supabase.from("profile_public").select("id,first_name,last_name").in("id",ids)
      ])
      const map = {}
      ids.forEach(id=>{ map[id]={...sens?.find(p=>p.id===id),...profs?.find(p=>p.id===id)} })
      setCustomers(map)
    }
    const today = new Date().toISOString().split("T")[0]
    const completed = (mine||[]).filter(d=>d.status==="completed")
    setStats({ deliveries:completed.length, total:completed.reduce((s,d)=>s+Number(d.driver_earnings||15),0), today:completed.filter(d=>d.booking_date===today).reduce((s,d)=>s+Number(d.driver_earnings||15),0), hoursOnline:shiftStart?Math.floor((Date.now()-shiftStart)/3600000):0 })
    setLoading(false)
  }

  function startLocationTracking() {
    if (!navigator.geolocation) return
    watchRef.current = navigator.geolocation.watchPosition(async (pos) => {
      await supabase.from("driver_status").upsert({ driver_id:user.id, is_online:true, current_lat:pos.coords.latitude, current_lng:pos.coords.longitude, last_location_update:new Date().toISOString(), updated_at:new Date().toISOString() })
      resetInactivityTimer()
    }, null, { enableHighAccuracy:true, maximumAge:10000, timeout:5000 })
  }

  function resetInactivityTimer() {
    if (inactivityRef.current) clearTimeout(inactivityRef.current)
    inactivityRef.current = setTimeout(async () => { await goOffline(); toast("You were set offline due to inactivity", { icon:"⏰" }) }, 30*60*1000)
  }

  async function goOffline() {
    if (watchRef.current) navigator.geolocation.clearWatch(watchRef.current)
    await supabase.from("driver_status").upsert({ driver_id:user.id, is_online:false, updated_at:new Date().toISOString() })
    setIsOnline(false)
  }

  async function toggleOnline() {
    const next = !isOnline
    const { error } = await supabase.from("driver_status").upsert({ driver_id:user.id, is_online:next, updated_at:new Date().toISOString() })
    if (error) return toast.error(error.message)
    setIsOnline(next)
    if (next) { startLocationTracking(); onlineStartRef.current = Date.now(); setShiftStart(Date.now()); toast.success("You are now online") }
    else { if (watchRef.current) navigator.geolocation.clearWatch(watchRef.current); if (inactivityRef.current) clearTimeout(inactivityRef.current); setShiftStart(null); toast.success("You are now offline") }
  }

  async function acceptJob(bookingId) {
    const { error } = await supabase.from("bookings").update({ driver_id:user.id, status:"driver-assigned" }).eq("id",bookingId).is("driver_id",null)
    if (error) return toast.error(error.message)
    const booking = jobs.find(j=>j.id===bookingId)
    if (booking) await supabase.from("notifications").insert({ user_id:booking.customer_id, title:"Driver assigned", message:`A driver is on their way for ${booking.service_name}`, type:"success" })
    toast.success("Job accepted!"); setTab("myjobs"); load()
  }

  async function updateDeliveryStatus(bookingId, newStatus) {
    const { error } = await supabase.from("bookings").update({ status:newStatus }).eq("id",bookingId).eq("driver_id",user.id)
    if (error) return toast.error(error.message)
    const booking = myJobs.find(j=>j.id===bookingId)
    const msgs = { "arrived-for-pickup":"Your driver has arrived at pickup location","in-progress":"Your vehicle has been picked up and is on the way","arrived-at-dropoff":"Your driver has arrived at the service center","completed":"Your vehicle has been delivered successfully" }
    if (booking && msgs[newStatus]) await supabase.from("notifications").insert({ user_id:booking.customer_id, title:DELIVERY_STEPS.find(s=>s.status===newStatus)?.label||newStatus, message:msgs[newStatus], type:"info" })
    toast.success(`Status updated: ${DELIVERY_STEPS.find(s=>s.status===newStatus)?.label||newStatus}`); load()
  }

  async function declineJob(bookingId) {
    if (!declineReason.trim()) return toast.error("Please provide a reason")
    await supabase.from("bookings").update({ driver_id:null }).eq("id",bookingId).eq("driver_id",user.id)
    toast.success("Job declined"); setDeclining(null); setDeclineReason(""); load()
  }

  function openNavigation(address) {
    if (!address) return toast.error("No address available")
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`, "_blank")
  }

  function openWhatsApp(phone, name, serviceName) {
    if (!phone) return toast.error("Customer phone not available")
    const msg = encodeURIComponent(`Hi ${name||"there"}, I am your driver for the ${serviceName} booking.`)
    window.open(`https://wa.me/${phone.replace(/\D/g,"")}?text=${msg}`, "_blank")
  }

  function calculateETA(bookingDate, bookingTime) {
    if (!bookingDate || !bookingTime) return "Unknown"
    const diff = new Date(`${bookingDate}T${bookingTime}`) - new Date()
    if (diff < 0) return "Now"
    const h = Math.floor(diff/3600000); const m = Math.floor((diff%3600000)/60000)
    return h > 0 ? `${h}h ${m}m` : `${m}m`
  }

  const activeJobs = myJobs.filter(j=>!["completed","cancelled"].includes(j.status))
  const completedJobs = myJobs.filter(j=>j.status==="completed")
  const SC = { "driver-assigned":"#378add","arrived-for-pickup":"#8b5cf6","in-progress":"#e6821e","arrived-at-dropoff":"#e6821e","completed":"#1d9e75","cancelled":"#e24b4a" }
  const shiftDuration = shiftStart ? `${Math.floor((Date.now()-shiftStart)/3600000)}h ${Math.floor(((Date.now()-shiftStart)%3600000)/60000)}m` : "0h 0m"

  return (
    <div style={{ margin:"-1rem", fontFamily:"DM Sans,sans-serif" }}>
      {/* Green/dark header */}
      <div style={{ background:isOnline?"#1d9e75":"#000", padding:"1.25rem 1.25rem 2.5rem", transition:"background 0.3s" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
          <div>
            <div style={{ fontSize:11, color:"rgba(255,255,255,0.7)", marginBottom:2 }}>
              {new Date().toLocaleDateString("en-KE",{weekday:"long",day:"numeric",month:"long"})}
            </div>
            <div style={{ fontFamily:"Syne", fontSize:18, fontWeight:800, color:"#fff" }}>
              {profile?.first_name} {profile?.last_name}
            </div>
            <div style={{ fontSize:11, color:"rgba(255,255,255,0.8)", marginTop:2 }}>
              🚗 {profile?.driver_vehicle_type==="motorcycle"?"Boda Boda":"Car"} Driver
            </div>
          </div>
          {/* Online toggle */}
          <button onClick={toggleOnline}
            style={{ background:isOnline?"rgba(255,255,255,0.2)":"#e6821e", border:"none", borderRadius:20, color:"#fff", fontSize:12, fontWeight:700, padding:"8px 16px", cursor:"pointer", fontFamily:"Syne,sans-serif" }}>
            {isOnline ? "● Online" : "○ Go Online"}
          </button>
        </div>
        {isOnline&&(
          <div style={{ marginTop:8, fontSize:10, color:"rgba(255,255,255,0.7)" }}>
            Shift: {shiftDuration} · GPS active
          </div>
        )}
      </div>

      {/* Floating stats card */}
      <div style={{ margin:"-1.25rem 1rem 1rem", background:"#fff", borderRadius:16, padding:"1rem", boxShadow:"0 4px 20px rgba(0,0,0,0.08)", border:"1px solid #f0f0f0" }}>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:8 }}>
          {[
            { label:"Today earnings", value:`KES ${stats.today.toFixed(0)}`, icon:"💵", color:"#e6821e" },
            { label:"Total earned", value:`KES ${stats.total.toFixed(0)}`, icon:"💰", color:"#1d9e75" },
            { label:"Deliveries", value:stats.deliveries, icon:"🚗", color:"#378add" },
            { label:"Active jobs", value:activeJobs.length, icon:"📦", color:activeJobs.length>0?"#8b5cf6":"#888" },
          ].map(s=>(
            <div key={s.label} style={{ background:"#f8f8f8", borderRadius:10, padding:"0.75rem", display:"flex", alignItems:"center", gap:8 }}>
              <div style={{ fontSize:20 }}>{s.icon}</div>
              <div>
                <div style={{ fontFamily:"Syne", fontSize:16, fontWeight:800, color:s.color }}>{s.value}</div>
                <div style={{ fontSize:10, color:"#888" }}>{s.label}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding:"0 1rem" }}>
        {/* Tabs */}
        <div style={{ display:"flex", gap:6, marginBottom:"1rem" }}>
          {[
            { k:"available", l:`Available (${jobs.length})` },
            { k:"myjobs", l:`Active (${activeJobs.length})` },
            { k:"history", l:`History (${completedJobs.length})` },
          ].map(t=>(
            <button key={t.k} onClick={()=>setTab(t.k)}
              style={{ padding:"7px 14px", borderRadius:20, border:"none", fontSize:11, cursor:"pointer", background:tab===t.k?"#1d9e75":"#f0f0f0", color:tab===t.k?"#fff":"#555", fontFamily:"DM Sans,sans-serif", fontWeight:tab===t.k?700:400 }}>
              {t.l}
            </button>
          ))}
        </div>

        {/* AVAILABLE JOBS */}
        {tab==="available"&&(
          <div>
            {!isOnline&&(
              <div style={{ textAlign:"center", padding:"2rem", background:"#f8f8f8", borderRadius:12 }}>
                <div style={{ fontSize:36, marginBottom:8 }}>🚗</div>
                <div style={{ fontSize:14, color:"#555", marginBottom:12 }}>You are offline</div>
                <button onClick={toggleOnline} style={{ background:"#1d9e75", border:"none", borderRadius:20, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:13, fontWeight:700, padding:"10px 24px", cursor:"pointer" }}>
                  Go Online
                </button>
              </div>
            )}
            {loading&&<div style={{ color:"#888", fontSize:13 }}>Loading...</div>}
            {isOnline&&!loading&&jobs.length===0&&(
              <div style={{ color:"#888", fontSize:13, textAlign:"center", padding:"2rem", background:"#f8f8f8", borderRadius:12 }}>
                <div style={{ fontSize:36, marginBottom:8 }}>📭</div>
                No available jobs right now
              </div>
            )}
            {isOnline&&jobs.map(j=>{
              const customer = customers[j.customer_id]
              return (
                <div key={j.id} style={{ background:"#fff", border:"0.5px solid #eee", borderRadius:12, padding:"1rem", marginBottom:10 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
                    <div>
                      <div style={{ fontSize:14, fontWeight:500, color:"#000" }}>{j.service_name}</div>
                      <div style={{ fontSize:11, color:"#888", marginTop:2 }}>{customer?.first_name} {customer?.last_name}</div>
                    </div>
                    <div style={{ textAlign:"right" }}>
                      <div style={{ fontFamily:"Syne", fontSize:16, fontWeight:800, color:"#1d9e75" }}>+KES 200</div>
                      <div style={{ fontSize:10, color:"#888" }}>ETA: {calculateETA(j.booking_date, j.booking_time)}</div>
                    </div>
                  </div>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:10 }}>
                    <div style={{ background:"#f8f8f8", borderRadius:8, padding:"6px 8px" }}>
                      <div style={{ fontSize:9, color:"#888", marginBottom:2 }}>PICKUP</div>
                      <div style={{ fontSize:11, color:"#000" }}>{j.pickup_address||"Customer address"}</div>
                    </div>
                    <div style={{ background:"#f8f8f8", borderRadius:8, padding:"6px 8px" }}>
                      <div style={{ fontSize:9, color:"#888", marginBottom:2 }}>DATE & TIME</div>
                      <div style={{ fontSize:11, color:"#000" }}>{j.booking_date} {j.booking_time?.slice(0,5)}</div>
                    </div>
                  </div>
                  <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                    <button onClick={()=>acceptJob(j.id)} style={{ background:"#1d9e75", border:"none", borderRadius:8, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:13, fontWeight:700, padding:"9px 20px", cursor:"pointer" }}>Accept</button>
                    <button onClick={()=>openNavigation(j.pickup_address)} style={{ background:"#f0fdf4", border:"1px solid #1d9e7540", borderRadius:7, color:"#1d9e75", fontSize:11, padding:"5px 10px", cursor:"pointer" }}>Maps</button>
                    <button onClick={()=>openWhatsApp(customer?.phone, customer?.first_name, j.service_name)} style={{ background:"#f0fdf4", border:"1px solid #1d9e7540", borderRadius:7, color:"#1d9e75", fontSize:11, padding:"5px 10px", cursor:"pointer" }}>WhatsApp</button>
                    <button onClick={()=>setDeclining(j.id)} style={{ background:"none", border:"1px solid #e24b4a40", borderRadius:7, color:"#e24b4a", fontSize:11, padding:"5px 10px", cursor:"pointer" }}>Decline</button>
                  </div>
                  {declining===j.id&&(
                    <div style={{ marginTop:10 }}>
                      <input placeholder="Reason for declining..." value={declineReason} onChange={e=>setDeclineReason(e.target.value)}
                        style={{ width:"100%", background:"#f8f8f8", border:"1px solid #eee", borderRadius:7, padding:"8px 10px", color:"#000", fontSize:12, outline:"none", marginBottom:8 }}/>
                      <div style={{ display:"flex", gap:8 }}>
                        <button onClick={()=>declineJob(j.id)} style={{ background:"#fff5f5", border:"1px solid #e24b4a40", borderRadius:7, color:"#e24b4a", fontSize:12, padding:"6px 14px", cursor:"pointer" }}>Confirm decline</button>
                        <button onClick={()=>{ setDeclining(null); setDeclineReason("") }} style={{ background:"none", border:"1px solid #ddd", borderRadius:7, color:"#666", fontSize:12, padding:"6px 14px", cursor:"pointer" }}>Cancel</button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* MY JOBS */}
        {tab==="myjobs"&&(
          <div>
            {activeJobs.length===0&&(
              <div style={{ color:"#888", fontSize:13, textAlign:"center", padding:"2rem", background:"#f8f8f8", borderRadius:12 }}>
                <div style={{ fontSize:36, marginBottom:8 }}>📭</div>
                No active jobs
              </div>
            )}
            {activeJobs.map(j=>{
              const customer = customers[j.customer_id]
              const nextStep = STATUS_NEXT[j.status]
              const currentStepIndex = DELIVERY_STEPS.findIndex(s=>s.status===j.status)
              return (
                <div key={j.id} style={{ background:"#fff", border:`1px solid ${SC[j.status]||"#eee"}30`, borderRadius:12, padding:"1rem", marginBottom:10 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:12 }}>
                    <div>
                      <div style={{ fontSize:14, fontWeight:500, color:"#000" }}>{j.service_name}</div>
                      <div style={{ fontSize:11, color:"#888", marginTop:2 }}>{customer?.first_name} {customer?.last_name}</div>
                      <div style={{ fontSize:10, color:"#aaa" }}>{j.booking_date} · {j.booking_time?.slice(0,5)}</div>
                    </div>
                    <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:700, color:"#1d9e75" }}>+KES 200</div>
                  </div>
                  {/* Progress steps */}
                  <div style={{ display:"flex", gap:4, marginBottom:12, overflowX:"auto" }}>
                    {DELIVERY_STEPS.map((step,i)=>(
                      <div key={step.status} style={{ display:"flex", alignItems:"center", gap:4, flexShrink:0 }}>
                        <div style={{ width:28, height:28, borderRadius:"50%", background:i<=currentStepIndex?"#1d9e75":"#f0f0f0", color:i<=currentStepIndex?"#fff":"#aaa", fontSize:11, fontWeight:700, display:"flex", alignItems:"center", justifyContent:"center" }}>
                          {i<currentStepIndex?"✓":i===currentStepIndex?step.icon:i+1}
                        </div>
                        {i<DELIVERY_STEPS.length-1&&<div style={{ width:20, height:2, background:i<currentStepIndex?"#1d9e75":"#f0f0f0" }}/>}
                      </div>
                    ))}
                  </div>
                  <div style={{ fontSize:11, color:"#1d9e75", fontWeight:600, marginBottom:10 }}>
                    {DELIVERY_STEPS[currentStepIndex]?.label||j.status}
                  </div>
                  {j.pickup_address&&<div style={{ fontSize:11, color:"#888", marginBottom:8 }}>📍 {j.pickup_address}</div>}
                  <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                    {nextStep&&(
                      <button onClick={()=>updateDeliveryStatus(j.id, nextStep.next)}
                        style={{ background:nextStep.color+"15", border:`1px solid ${nextStep.color}40`, borderRadius:7, color:nextStep.color, fontSize:12, padding:"7px 14px", cursor:"pointer", fontWeight:600 }}>
                        {nextStep.label}
                      </button>
                    )}
                    <button onClick={()=>openNavigation(j.pickup_address||"")} style={{ background:"#f0fdf4", border:"1px solid #1d9e7540", borderRadius:7, color:"#1d9e75", fontSize:11, padding:"5px 10px", cursor:"pointer" }}>Google Maps</button>
                    <button onClick={()=>window.open(`https://waze.com/ul?q=${encodeURIComponent(j.pickup_address||"")}`, "_blank")} style={{ background:"#eff6ff", border:"1px solid #378add40", borderRadius:7, color:"#378add", fontSize:11, padding:"5px 10px", cursor:"pointer" }}>Waze</button>
                    <button onClick={()=>openWhatsApp(customer?.phone, customer?.first_name, j.service_name)} style={{ background:"#f0fdf4", border:"1px solid #1d9e7540", borderRadius:7, color:"#1d9e75", fontSize:11, padding:"5px 10px", cursor:"pointer" }}>WhatsApp</button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* HISTORY */}
        {tab==="history"&&(
          <div>
            {completedJobs.length===0&&(
              <div style={{ color:"#888", fontSize:13, textAlign:"center", padding:"2rem", background:"#f8f8f8", borderRadius:12 }}>
                <div style={{ fontSize:36, marginBottom:8 }}>📭</div>
                No completed deliveries yet
              </div>
            )}
            {completedJobs.map(j=>(
              <div key={j.id} style={{ background:"#fff", border:"0.5px solid #eee", borderRadius:12, padding:"0.85rem", marginBottom:8, display:"flex", alignItems:"center", gap:12 }}>
                <div style={{ width:36, height:36, background:"#f0fdf4", borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16 }}>✅</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, fontWeight:500, color:"#000" }}>{j.service_name}</div>
                  <div style={{ fontSize:11, color:"#888", marginTop:2 }}>{j.booking_date} · #{j.booking_number}</div>
                </div>
                <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:700, color:"#1d9e75" }}>+KES {Number(j.driver_earnings||200).toFixed(0)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}


