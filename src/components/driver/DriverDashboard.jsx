import { useEffect, useState, useRef } from "react"
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
    if (data) {
      setIsOnline(data.is_online)
      if (data.is_online) startLocationTracking()
    } else {
      await supabase.from("driver_status").insert({ driver_id:user.id, is_online:false })
    }
  }

  async function load() {
    const [{ data: available }, { data: mine }] = await Promise.all([
      supabase.from("bookings").select("*").eq("is_concierge",true).in("status",["confirmed"]).is("driver_id",null).order("booking_date",{ascending:true}),
      supabase.from("bookings").select("*").eq("driver_id",user.id).order("created_at",{ascending:false})
    ])
    setJobs(available||[])
    setMyJobs(mine||[])

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
    setStats({
      deliveries: completed.length,
      total: completed.reduce((s,d)=>s+Number(d.driver_earnings||15),0),
      today: completed.filter(d=>d.booking_date===today).reduce((s,d)=>s+Number(d.driver_earnings||15),0),
      hoursOnline: shiftStart ? Math.floor((Date.now()-shiftStart)/3600000) : 0,
    })
    setLoading(false)
  }

  function startLocationTracking() {
    if (!navigator.geolocation) return
    watchRef.current = navigator.geolocation.watchPosition(async (pos) => {
      await supabase.from("driver_status").upsert({
        driver_id: user.id,
        is_online: true,
        current_lat: pos.coords.latitude,
        current_lng: pos.coords.longitude,
        last_location_update: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      resetInactivityTimer()
    }, null, { enableHighAccuracy:true, maximumAge:10000, timeout:5000 })
  }

  function resetInactivityTimer() {
    if (inactivityRef.current) clearTimeout(inactivityRef.current)
    inactivityRef.current = setTimeout(async () => {
      await goOffline()
      toast("You were set offline due to inactivity", { icon:"⏰" })
    }, 30 * 60 * 1000) // 30 minutes
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
    if (next) {
      startLocationTracking()
      onlineStartRef.current = Date.now()
      setShiftStart(Date.now())
      toast.success("You are now online")
    } else {
      if (watchRef.current) navigator.geolocation.clearWatch(watchRef.current)
      if (inactivityRef.current) clearTimeout(inactivityRef.current)
      setShiftStart(null)
      toast.success("You are now offline")
    }
  }

  async function acceptJob(bookingId) {
    const { error } = await supabase.from("bookings")
      .update({ driver_id:user.id, status:"driver-assigned" })
      .eq("id",bookingId).is("driver_id",null)
    if (error) return toast.error(error.message)
    const booking = jobs.find(j=>j.id===bookingId)
    if (booking) {
      await supabase.from("notifications").insert({
        user_id:booking.customer_id,
        title:"Driver assigned",
        message:`A driver is on their way for ${booking.service_name}`,
        type:"success"
      })
    }
    toast.success("Job accepted!")
    setTab("myjobs")
    load()
  }

  async function updateDeliveryStatus(bookingId, newStatus) {
    const { error } = await supabase.from("bookings").update({ status:newStatus }).eq("id",bookingId).eq("driver_id",user.id)
    if (error) return toast.error(error.message)
    const booking = myJobs.find(j=>j.id===bookingId)
    const msgs = {
      "arrived-for-pickup": "Your driver has arrived at pickup location",
      "in-progress": "Your vehicle has been picked up and is on the way",
      "arrived-at-dropoff": "Your driver has arrived at the service center",
      "completed": "Your vehicle has been delivered successfully"
    }
    if (booking && msgs[newStatus]) {
      await supabase.from("notifications").insert({ user_id:booking.customer_id, title:DELIVERY_STEPS.find(s=>s.status===newStatus)?.label||newStatus, message:msgs[newStatus], type:"info" })
    }
    toast.success(`Status updated: ${DELIVERY_STEPS.find(s=>s.status===newStatus)?.label||newStatus}`)
    load()
  }

  async function declineJob(bookingId) {
    if (!declineReason.trim()) return toast.error("Please provide a reason")
    await supabase.from("bookings").update({ driver_id:null }).eq("id",bookingId).eq("driver_id",user.id)
    toast.success("Job declined")
    setDeclining(null)
    setDeclineReason("")
    load()
  }

  function openNavigation(address, type) {
    if (!address) return toast.error("No address available")
    const encoded = encodeURIComponent(address)
    const url = `https://www.google.com/maps/dir/?api=1&destination=${encoded}`
    window.open(url, "_blank")
  }

  function calculateETA(bookingDate, bookingTime) {
    if (!bookingDate || !bookingTime) return "Unknown"
    const bookingDateTime = new Date(`${bookingDate}T${bookingTime}`)
    const now = new Date()
    const diff = bookingDateTime - now
    if (diff < 0) return "Now"
    const hours = Math.floor(diff / 3600000)
    const mins = Math.floor((diff % 3600000) / 60000)
    if (hours > 0) return `${hours}h ${mins}m`
    return `${mins}m`
  }

  const activeJobs = myJobs.filter(j=>!["completed","cancelled"].includes(j.status))
  const completedJobs = myJobs.filter(j=>j.status==="completed")
  const SC = { "driver-assigned":"#378add","arrived-for-pickup":"#8b5cf6","in-progress":"#e6821e","arrived-at-dropoff":"#e6821e","completed":"#1d9e75","cancelled":"#e24b4a" }

  return (
    <div>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"1.5rem" }}>
        <div>
          <div style={{ fontFamily:"Syne", fontSize:20, fontWeight:800 }}>Driver Hub</div>
          <div style={{ fontSize:12, color:"#555", marginTop:2 }}>
            {isOnline ? `● Online${shiftStart ? ` · ${Math.floor((Date.now()-shiftStart)/3600000)}h ${Math.floor(((Date.now()-shiftStart)%3600000)/60000)}m shift` : ""}` : "○ Offline"}
          </div>
        </div>
        <button onClick={toggleOnline}
          style={{ background:isOnline?"#071a12":"#1a0a08", border:`1px solid ${isOnline?"#1d9e75":"#e6821e"}`, borderRadius:20, color:isOnline?"#1d9e75":"#e6821e", fontSize:13, fontWeight:500, padding:"8px 18px", cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}>
          {isOnline?"● Go Offline":"○ Go Online"}
        </button>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:"1.5rem" }}>
        {[
          { label:"Today", value:`KES \${stats.today.toFixed(2)}`, color:"#e6821e" },
          { label:"Total earned", value:`KES \${stats.total.toFixed(2)}` },
          { label:"Deliveries", value:stats.deliveries },
          { label:"Active jobs", value:activeJobs.length, color:activeJobs.length>0?"#8b5cf6":undefined },
        ].map(s=>(
          <div key={s.label} style={{ background:"#111", borderRadius:10, padding:"1rem", border:"1px solid #1e1e1e" }}>
            <div style={{ fontSize:11, color:"#555", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:6 }}>{s.label}</div>
            <div style={{ fontFamily:"Syne", fontSize:20, fontWeight:800, color:s.color||"#f0ede6" }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display:"flex", gap:6, marginBottom:"1rem" }}>
        {[
          { k:"available", l:`Available (${jobs.length})` },
          { k:"myjobs", l:`Active (${activeJobs.length})` },
          { k:"history", l:`History (${completedJobs.length})` },
        ].map(t=>(
          <button key={t.k} onClick={()=>setTab(t.k)}
            style={{ padding:"8px 16px", borderRadius:8, border:"none", fontSize:12, cursor:"pointer", background:tab===t.k?"#e6821e":"#111", color:tab===t.k?"#fff":"#666", fontFamily:"'DM Sans',sans-serif", fontWeight:tab===t.k?700:400 }}>
            {t.l}
          </button>
        ))}
      </div>

      {tab==="available"&&(
        <div>
          {!isOnline&&<div style={{ color:"#555", fontSize:13, padding:"1rem", background:"#111", borderRadius:10, border:"1px solid #1e1e1e", marginBottom:10 }}>Go online to see available jobs</div>}
          {loading&&<div style={{ color:"#555", fontSize:13 }}>Loading...</div>}
          {isOnline&&!loading&&jobs.length===0&&<div style={{ color:"#444", fontSize:13, textAlign:"center", padding:"1.5rem" }}>No available jobs right now</div>}
          {isOnline&&jobs.map(j=>{
            const customer = customers[j.customer_id]
            const eta = calculateETA(j.booking_date, j.booking_time)
            return (
              <div key={j.id} style={{ background:"#111", border:"1px solid #1e1e1e", borderRadius:10, padding:"1rem", marginBottom:10 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
                  <div>
                    <div style={{ fontSize:14, fontWeight:500 }}>{j.service_name}</div>
                    <div style={{ fontSize:11, color:"#555", marginTop:2 }}>{customer?.first_name} {customer?.last_name}</div>
                  </div>
                  <div style={{ textAlign:"right" }}>
                    <div style={{ fontFamily:"Syne", fontSize:16, fontWeight:800, color:"#e6821e" }}>+$15</div>
                    <div style={{ fontSize:10, color:"#555" }}>ETA: {eta}</div>
                  </div>
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:10 }}>
                  <div><div style={{ fontSize:10, color:"#555" }}>PICKUP</div><div style={{ fontSize:12 }}>{j.pickup_address||"Customer address"}</div></div>
                  <div><div style={{ fontSize:10, color:"#555" }}>DATE & TIME</div><div style={{ fontSize:12 }}>{j.booking_date} {j.booking_time?.slice(0,5)}</div></div>
                </div>
                <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                  <button onClick={()=>acceptJob(j.id)}
                    style={{ background:"#e6821e", border:"none", borderRadius:8, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:13, fontWeight:700, padding:"9px 20px", cursor:"pointer" }}>
                    Accept
                  </button>
                  <button onClick={()=>openNavigation(j.pickup_address, "pickup")}
                    style={{ background:"#071a12", border:"1px solid #1d9e7540", borderRadius:7, color:"#1d9e75", fontSize:11, padding:"5px 10px", cursor:"pointer" }}>
                    Maps
                  </button>
                  <button onClick={()=>{ openWhatsApp(customer?.phone, customer?.first_name, j.service_name) }}
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
      )}

      {tab==="myjobs"&&(
        <div>
          {activeJobs.length===0&&<div style={{ color:"#444", fontSize:13, textAlign:"center", padding:"1.5rem" }}>No active jobs</div>}
          {activeJobs.map(j=>{
            const customer = customers[j.customer_id]
            const nextStep = STATUS_NEXT[j.status]
            const currentStepIndex = DELIVERY_STEPS.findIndex(s=>s.status===j.status)
            return (
              <div key={j.id} style={{ background:"#111", border:`1px solid ${SC[j.status]||"#1e1e1e"}30`, borderRadius:10, padding:"1rem", marginBottom:10 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:12 }}>
                  <div>
                    <div style={{ fontSize:14, fontWeight:500 }}>{j.service_name}</div>
                    <div style={{ fontSize:11, color:"#555", marginTop:2 }}>{customer?.first_name} {customer?.last_name}</div>
                    <div style={{ fontSize:10, color:"#444" }}>{j.booking_date} · {j.booking_time?.slice(0,5)}</div>
                  </div>
                  <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:700, color:"#e6821e" }}>+$15</div>
                </div>

                <div style={{ display:"flex", gap:4, marginBottom:12, overflowX:"auto" }}>
                  {DELIVERY_STEPS.map((step,i)=>(
                    <div key={step.status} style={{ display:"flex", alignItems:"center", gap:4, flexShrink:0 }}>
                      <div style={{ width:28, height:28, borderRadius:"50%", background:i<=currentStepIndex?"#e6821e":"#222", color:i<=currentStepIndex?"#fff":"#555", fontSize:11, fontWeight:700, display:"flex", alignItems:"center", justifyContent:"center" }}>
                        {i<currentStepIndex?"✓":i===currentStepIndex?step.icon:i+1}
                      </div>
                      {i<DELIVERY_STEPS.length-1&&<div style={{ width:20, height:2, background:i<currentStepIndex?"#e6821e":"#222" }}/>}
                    </div>
                  ))}
                </div>
                <div style={{ fontSize:11, color:"#e6821e", marginBottom:10 }}>
                  {DELIVERY_STEPS[currentStepIndex]?.label||j.status}
                </div>

                {j.pickup_address&&<div style={{ fontSize:11, color:"#555", marginBottom:8 }}>📍 {j.pickup_address}</div>}

                <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                  {nextStep&&(
                    <button onClick={()=>updateDeliveryStatus(j.id, nextStep.next)}
                      style={{ background:nextStep.color+"20", border:`1px solid ${nextStep.color}40`, borderRadius:7, color:nextStep.color, fontSize:12, padding:"7px 14px", cursor:"pointer", fontWeight:600 }}>
                      {nextStep.label}
                    </button>
                  )}
                  <button onClick={()=>openNavigation(j.pickup_address||"", "pickup")}
                    style={{ background:"#071a12", border:"1px solid #1d9e7540", borderRadius:7, color:"#1d9e75", fontSize:11, padding:"5px 10px", cursor:"pointer" }}>
                    Google Maps
                  </button>
                  <button onClick={()=>window.open(`https://waze.com/ul?q=${encodeURIComponent(j.pickup_address||"")}`, "_blank")}
                    style={{ background:"#0c1f2e", border:"1px solid #378add40", borderRadius:7, color:"#378add", fontSize:11, padding:"5px 10px", cursor:"pointer" }}>
                    Waze
                  </button>
                  <button onClick={()=>openWhatsApp(customer?.phone, customer?.first_name, j.service_name)}
                    style={{ background:"#071a12", border:"1px solid #1d9e7540", borderRadius:7, color:"#1d9e75", fontSize:11, padding:"5px 10px", cursor:"pointer" }}>
                    WhatsApp
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {tab==="history"&&(
        <div>
          {completedJobs.length===0&&<div style={{ color:"#444", fontSize:13, textAlign:"center", padding:"1.5rem" }}>No completed deliveries yet</div>}
          {completedJobs.map(j=>(
            <div key={j.id} style={{ background:"#111", border:"1px solid #1e1e1e", borderRadius:10, padding:"0.9rem", marginBottom:8, display:"flex", alignItems:"center", gap:12 }}>
              <div style={{ width:36, height:36, background:"#071a12", borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16 }}>✅</div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:500 }}>{j.service_name}</div>
                <div style={{ fontSize:11, color:"#555", marginTop:2 }}>{j.booking_date} · #{j.booking_number}</div>
              </div>
              <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:700, color:"#e6821e" }}>+${Number(j.driver_earnings||15).toFixed(2)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  function openWhatsApp(phone, name, serviceName) {
    if (!phone) return toast.error("Customer phone not available")
    const msg = encodeURIComponent(`Hi ${name||"there"}, I am your driver for the ${serviceName} booking.`)
    window.open(`https://wa.me/${phone.replace(/\D/g,"")}?text=${msg}`, "_blank")
  }
}

