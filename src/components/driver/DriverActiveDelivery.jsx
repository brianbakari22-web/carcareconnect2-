import useIsMobile from "../../lib/useIsMobile"
import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"
import { useAuth } from "../../contexts/AuthContext"
import { contactViaWhatsApp, contactViaEmail } from "../../lib/contact"
import toast from "react-hot-toast"
import { useLanguage } from "../../contexts/LanguageContext"

const DELIVERY_STEPS = [
  { status:"driver-assigned", label:"Job accepted", icon:"✓", desc:"Head to pickup location" },
  { status:"arrived-for-pickup", label:"Arrived at pickup", icon:"📍", desc:"Pick up the vehicle" },
  { status:"in-progress", label:"Vehicle picked up", icon:"🚗", desc:"Drive to service center" },
  { status:"arrived-at-dropoff", label:"Arrived at dropoff", icon:"📍", desc:"Hand over the vehicle" },
  { status:"completed", label:"Delivered", icon:"✅", desc:"Job complete!" },
]

const STATUS_NEXT = {
  "driver-assigned": { next:"arrived-for-pickup", label:"Mark arrived at pickup", color:"#378add" },
  "arrived-for-pickup": { next:"in-progress", label:"Mark vehicle picked up", color:"#8b5cf6" },
  "in-progress": { next:"arrived-at-dropoff", label:"Mark arrived at dropoff", color:"#e6821e" },
  "arrived-at-dropoff": { next:"completed", label:"Mark delivered", color:"#1d9e75" },
}

export default function DriverActiveDelivery() {
  const isMobile = useIsMobile()
  const { user, profile } = useAuth()
  const { t, language } = useLanguage()
  const [activeJobs, setActiveJobs] = useState([])
  const [customers, setCustomers] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    load()
    const sub = supabase.channel("active-delivery")
      .on("postgres_changes", { event:"UPDATE", schema:"public", table:"bookings", filter:`driver_id=eq.${user.id}` }, () => load())
      .subscribe()
    return () => supabase.removeChannel(sub)
  }, [user])

  async function load() {
    const { data } = await supabase.from("bookings")
      .select("*")
      .eq("driver_id", user.id)
      .not("status", "in", '("completed","cancelled")')
      .order("created_at", { ascending:false })
    setActiveJobs(data||[])
    if (data&&data.length>0) {
      const ids = [...new Set(data.map(b=>b.customer_id))]
      const { data: profs } = await supabase.from("profile_public").select("id,first_name,last_name").in("id", ids)
      const map = {}
      ids.forEach(id=>{ map[id] = profs?.find(p=>p.id===id) })
      setCustomers(map)
    }
    setLoading(false)
  }

  async function updateStatus(bookingId, newStatus) {
    const { error } = await supabase.from("bookings").update({ status:newStatus }).eq("id",bookingId).eq("driver_id",user.id)
    if (error) return toast.error(error.message)
    const booking = activeJobs.find(j=>j.id===bookingId)
    const msgs = {
      "arrived-for-pickup": "Your driver has arrived at the pickup location",
      "in-progress": "Your vehicle has been picked up and is on the way",
      "arrived-at-dropoff": "Your driver has arrived at the service center",
      "completed": "Your vehicle has been delivered successfully! 🎉"
    }
    if (booking&&msgs[newStatus]) {
      await supabase.from("notifications").insert({
        user_id: booking.customer_id,
        title: DELIVERY_STEPS.find(s=>s.status===newStatus)?.label||newStatus,
        message: msgs[newStatus],
        type: newStatus==="completed"?"success":"info"
      })
    }
    toast.success(DELIVERY_STEPS.find(s=>s.status===newStatus)?.label||"Status updated")
    load()
  }

  function openMaps(address) {
    if (!address) return toast.error("No address available")
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`, "_blank")
  }

  function openWaze(address) {
    if (!address) return toast.error("No address available")
    window.open(`https://waze.com/ul?q=${encodeURIComponent(address)}`, "_blank")
  }

  const driverName = profile?.first_name || "Your driver"

  if (loading) return <div style={{ color:"#555", fontSize:13 }}>Loading...</div>

  return (
    <div>
      <div style={{ marginBottom:"1.5rem" }}>
        <div style={{ fontFamily:"Syne", fontSize:18, fontWeight:800, color:"#f0ede6" }}>Active Deliveries</div>
        <div style={{ fontSize:12, color:"#555", marginTop:2 }}>{activeJobs.length} active job{activeJobs.length!==1?"s":""}</div>
      </div>

      {activeJobs.length===0&&(
        <div style={{ background:"#111", border:"1px solid #1e1e1e", borderRadius:12, padding:"2rem", textAlign:"center" }}>
          <div style={{ fontSize:32, marginBottom:10 }}>📭</div>
          <div style={{ fontSize:14, color:"#555", marginBottom:4 }}>No active deliveries</div>
          <div style={{ fontSize:12, color:"#444" }}>Accept a job from Available Jobs to get started</div>
        </div>
      )}

      {activeJobs.map(j=>{
        const customer = customers[j.customer_id]
        const nextStep = STATUS_NEXT[j.status]
        const currentStepIndex = DELIVERY_STEPS.findIndex(s=>s.status===j.status)
        const currentStep = DELIVERY_STEPS[currentStepIndex]
        const customerName = `${customer?.first_name||""} ${customer?.last_name||""}`.trim() || "Customer"

        return (
          <div key={j.id} style={{ background:"#111", border:"1px solid #e6821e30", borderRadius:12, padding:"1.25rem", marginBottom:"1rem" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"1rem" }}>
              <div>
                <div style={{ fontFamily:"Syne", fontSize:15, fontWeight:800, color:"#f0ede6" }}>{j.service_name}</div>
                <div style={{ fontSize:12, color:"#555", marginTop:2 }}>{customerName}</div>
                <div style={{ fontSize:10, color:"#444", marginTop:2 }}>#{j.booking_number}</div>
              </div>
              <div style={{ fontFamily:"Syne", fontSize:16, fontWeight:800, color:"#e6821e" }}>+$15</div>
            </div>

            <div style={{ background:"#0f0f0f", borderRadius:10, padding:"1rem", marginBottom:"1rem" }}>
              <div style={{ fontSize:11, color:"#e6821e", fontWeight:600, marginBottom:4, textTransform:"uppercase", letterSpacing:"0.05em" }}>Current status</div>
              <div style={{ fontSize:14, fontWeight:600, color:"#f0ede6", marginBottom:2 }}>{currentStep?.label||j.status}</div>
              <div style={{ fontSize:12, color:"#555" }}>{currentStep?.desc}</div>
            </div>

            <div style={{ display:"flex", alignItems:"center", gap:4, marginBottom:"1rem", overflowX:"auto", paddingBottom:4 }}>
              {DELIVERY_STEPS.map((step,i)=>(
                <div key={step.status} style={{ display:"flex", alignItems:"center", gap:4, flexShrink:0 }}>
                  <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:2 }}>
                    <div style={{ width:30, height:30, borderRadius:"50%", background:i<currentStepIndex?"#1d9e75":i===currentStepIndex?"#e6821e":"#222", color:i<=currentStepIndex?"#fff":"#555", fontSize:i<currentStepIndex?12:11, fontWeight:700, display:"flex", alignItems:"center", justifyContent:"center", border:i===currentStepIndex?"2px solid #e6821e40":"none" }}>
                      {i<currentStepIndex?"✓":step.icon}
                    </div>
                    <div style={{ fontSize:9, color:i===currentStepIndex?"#e6821e":i<currentStepIndex?"#1d9e75":"#444", textAlign:"center", maxWidth:48, lineHeight:1.2 }}>{step.label}</div>
                  </div>
                  {i<DELIVERY_STEPS.length-1&&<div style={{ width:14, height:2, background:i<currentStepIndex?"#1d9e75":"#222", marginBottom:16, flexShrink:0 }}/>}
                </div>
              ))}
            </div>

            <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:8, marginBottom:"1rem" }}>
              <div style={{ background:"#0f0f0f", borderRadius:8, padding:"0.75rem" }}>
                <div style={{ fontSize:10, color:"#555", marginBottom:3 }}>PICKUP ADDRESS</div>
                <div style={{ fontSize:12, color:"#f0ede6" }}>{j.pickup_address||"Customer location"}</div>
              </div>
              <div style={{ background:"#0f0f0f", borderRadius:8, padding:"0.75rem" }}>
                <div style={{ fontSize:10, color:"#555", marginBottom:3 }}>DATE & TIME</div>
                <div style={{ fontSize:12, color:"#f0ede6" }}>{j.booking_date} · {j.booking_time?.slice(0,5)}</div>
              </div>
            </div>

            {nextStep&&(
              <button onClick={()=>updateStatus(j.id, nextStep.next)}
                style={{ width:"100%", background:nextStep.color, border:"none", borderRadius:9, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:14, fontWeight:700, padding:"13px", cursor:"pointer", marginBottom:10 }}>
                {nextStep.label}
              </button>
            )}

            <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
              <button onClick={()=>openMaps(j.pickup_address)}
                style={{ background:"#071a12", border:"1px solid #1d9e7540", borderRadius:7, color:"#1d9e75", fontSize:11, padding:"6px 12px", cursor:"pointer" }}>
                Google Maps
              </button>
              <button onClick={()=>openWaze(j.pickup_address)}
                style={{ background:"#0c1f2e", border:"1px solid #378add40", borderRadius:7, color:"#378add", fontSize:11, padding:"6px 12px", cursor:"pointer" }}>
                Waze
              </button>
              <button onClick={()=>contactViaWhatsApp(j.id, customerName, j.service_name, driverName)}
                style={{ background:"#071a12", border:"1px solid #1d9e7540", borderRadius:7, color:"#1d9e75", fontSize:11, padding:"6px 12px", cursor:"pointer" }}>
                WhatsApp
              </button>
              <button onClick={()=>contactViaEmail(j.id, customerName, j.service_name, driverName)}
                style={{ background:"#0c1f2e", border:"1px solid #378add40", borderRadius:7, color:"#378add", fontSize:11, padding:"6px 12px", cursor:"pointer" }}>
                Email
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}


