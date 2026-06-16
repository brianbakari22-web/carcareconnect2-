import { useState, useEffect } from "react"
import { supabase } from "../../lib/supabase"
import { getCurrentPosition } from "../../lib/geolocation"
import PhotoManager from "../shared/PhotoManager"
import { useAuth } from "../../contexts/AuthContext"
import useIsMobile from "../../lib/useIsMobile"
import toast from "react-hot-toast"

const EMERGENCY_TYPES = [
  { key:"flat_tire", label:"Flat tire", icon:"🛞" },
  { key:"dead_battery", label:"Dead battery", icon:"🔋" },
  { key:"out_of_fuel", label:"Out of fuel", icon:"⛽" },
  { key:"car_wont_start", label:"Car won't start", icon:"🔑" },
  { key:"overheating", label:"Overheating", icon:"🌡️" },
  { key:"towing", label:"Need towing", icon:"🚚" },
  { key:"other", label:"Other emergency", icon:"🆘" },
]

export default function CustomerGoService() {
  const { user } = useAuth()
  const isMobile = useIsMobile()
  const [step, setStep] = useState("select")
  const [emergencyType, setEmergencyType] = useState("")
  const [location, setLocation] = useState({ lat:null, lng:null, address:"" })
  const [details, setDetails] = useState("")
  const [vehicle, setVehicle] = useState("")
  const [vehicles, setVehicles] = useState([])
  const [locating, setLocating] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [booking, setBooking] = useState(null)
  const [goRequest, setGoRequest] = useState(null)
  const [attemptNumber, setAttemptNumber] = useState(1)
  const [timeLeft, setTimeLeft] = useState(null)
  const [activeGoBookings, setActiveGoBookings] = useState([])
  const [goServices, setGoServices] = useState([])
  const [selectedService, setSelectedService] = useState(null)

  const [showDepositPayment, setShowDepositPayment] = useState(false)
  const [payingCallout, setPayingCallout] = useState(false)
  useEffect(() => {
    if (user) {
      loadVehicles()
      loadActiveGoBookings()
      loadGoServices()
    }
  }, [user])

  useEffect(() => {
    if (!booking) return
    const sub = supabase.channel(`go-booking-${booking.id}`)
      .on("postgres_changes", { event:"UPDATE", schema:"public", table:"bookings", filter:`id=eq.${booking.id}` },
        payload => {
          setBooking(b=>({...b,...payload.new}))
          if (payload.new.status==="confirmed"||payload.new.status==="in-progress") {
            setStep("accepted")
            toast.success("Provider found! Help is on the way 🚨")
          }
        })
      .on("postgres_changes", { event:"INSERT", schema:"public", table:"go_service_requests", filter:`booking_id=eq.${booking.id}` },
        payload => {
          setGoRequest(payload.new)
          setAttemptNumber(payload.new.attempt_number)
          startCountdown(15 * 60)
        })
      .on("postgres_changes", { event:"UPDATE", schema:"public", table:"go_service_requests", filter:`booking_id=eq.${booking.id}` },
        payload => {
          setGoRequest(payload.new)
          if (payload.new.status==="timeout") {
            setAttemptNumber(n=>n+1)
            if (attemptNumber >= 5) {
              setStep("no_providers")
              toast.error("No providers available at this time")
            } else {
              toast("Looking for next provider...", { icon:"🔍" })
              startCountdown(15 * 60)
            }
          }
        })
      .subscribe()
    return () => supabase.removeChannel(sub)
  }, [booking?.id, attemptNumber])

  useEffect(() => {
    if (timeLeft === null) return
    if (timeLeft <= 0) return
    const timer = setTimeout(() => setTimeLeft(t=>t-1), 1000)
    return () => clearTimeout(timer)
  }, [timeLeft])

  function startCountdown(seconds) { setTimeLeft(seconds) }

  async function loadVehicles() {
    const { data } = await supabase.from("vehicles").select("*").eq("user_id", user.id)
    setVehicles(data||[])
  }

  async function loadActiveGoBookings() {
    const { data } = await supabase.from("bookings")
      .select("*")
      .eq("customer_id", user.id)
      .eq("is_emergency", true)
      .not("status", "in", "(completed,cancelled)")
      .order("created_at", { ascending:false })
    setActiveGoBookings(data||[])
    if (data && data.length > 0 && data[0].go_callout_paid) {
      const active = data[0]
      const elapsed = Math.floor((Date.now() - new Date(active.created_at).getTime()) / 1000)
      const remaining = Math.max(0, 15*60 - elapsed)
      if (remaining > 0 && active.status === "pending") {
        setBooking(active)
        setStep("waiting")
        setTimeLeft(remaining)
      }
    }
  }
  function distanceKm(lat1, lon1, lat2, lon2) {
    const R = 6371
    const dLat = (lat2-lat1) * Math.PI/180
    const dLon = (lon2-lon1) * Math.PI/180
    const a = Math.sin(dLat/2)*Math.sin(dLat/2) + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)*Math.sin(dLon/2)
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
  }
  async function loadGoServices() {
    const { data } = await supabase.from("services")
      .select("*, profiles(business_name,first_name,last_name,city,latitude,longitude,go_service_radius_km)")
      .eq("category", "go_service")
      .eq("is_active", true)
    let services = data||[]
    if (location.lat && location.lng) {
      services = services.map(s => {
        const p = s.profiles
        const dist = (p?.latitude && p?.longitude) ? distanceKm(location.lat, location.lng, p.latitude, p.longitude) : null
        return { ...s, _distance: dist }
      }).filter(s => {
        if (s._distance === null) return true
        const radius = s.profiles?.go_service_radius_km || 15
        return s._distance <= radius
      }).sort((a,b) => (a._distance ?? 999) - (b._distance ?? 999))
    }
    setGoServices(services)
  }

  async function detectLocation() {
    setLocating(true)
    try {
      const pos = await getCurrentPosition()
      const lat = pos.latitude
      const lng = pos.longitude
      setLocation(l=>({...l, lat, lng}))
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`)
        const data = await res.json()
        setLocation({ lat, lng, address:data.display_name||`${lat.toFixed(4)}, ${lng.toFixed(4)}` })
      } catch { setLocation(l=>({...l, address:`${lat.toFixed(4)}, ${lng.toFixed(4)}`})) }
    } catch(err) {
      toast.error(err.message || "Could not get location — please enter manually")
    } finally {
      setLocating(false)
    }
  }

  async function checkRateLimit() {
    const today = new Date().toISOString().split("T")[0]
    const { count } = await supabase.from("bookings").select("id",{count:"exact"}).eq("customer_id",user.id).eq("is_emergency",true).gte("created_at",today+"T00:00:00")
    return count||0
  }

  async function initiateCalloutPayment() {
    if (!emergencyType) return toast.error("Please select emergency type")
    if (!location.lat) return toast.error("Please share your location")
    if (!selectedService) return toast.error("Please select a GO service")
    const todayCount = await checkRateLimit()
    if (todayCount >= 2) return toast.error("Maximum 2 emergency requests per day.")
    setShowDepositPayment(true)
  }

  async function payCalloutFee() {
    setPayingCallout(true)
    try {
      const { data: bk, error } = await supabase.from("bookings").insert({
        customer_id: user.id,
        provider_id: selectedService.provider_id,
        service_id: selectedService.id,
        service_name: selectedService.name,
        service_category: "go_service",
        is_emergency: true,
        emergency_type: emergencyType,
        emergency_location_lat: location.lat,
        emergency_location_lng: location.lng,
        emergency_location_address: location.address,
        booking_date: new Date().toISOString().split("T")[0],
        booking_time: new Date().toTimeString().slice(0,5),
        total_amount: selectedService.price,
        go_callout_fee: 500,
        go_callout_paid: false,
        platform_commission: Number(selectedService.price)*0.15,
        provider_earnings: Number(selectedService.price)*0.85,
        platform_commission_rate: 0.15,
        provider_commission_rate: 0.85,
        payment_method: "mpesa",
        payment_status: "pending",
        status: "pending",
        notes: details,
        vehicle_id: vehicle||null,
        go_attempt_number: 1,
      }).select().single()
      if (error) throw error
      const res = await fetch("https://gcnefnqtjxtqbhynyoxe.supabase.co/functions/v1/pesapal-payment",{
        method:"POST",
        headers:{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdjbmVmbnF0anh0cWJoeW55b3hlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2MDg0MzIsImV4cCI6MjA5NTE4NDQzMn0.Ybyce3psBj2I-hdoF95H5UAklr6hsgQi-mciI9uMIgc"},
        body:JSON.stringify({amount:500,bookingId:bk.id,customerEmail:user.email||"",customerPhone:"",customerName:""})
      })
      const order = await res.json()
      if (order.redirect_url) {
        sessionStorage.setItem("go_booking_id", bk.id)
        sessionStorage.setItem("go_provider_id", selectedService.provider_id)
        window.location.href = order.redirect_url
      } else { throw new Error(order.error||"Payment failed") }
    } catch(e) { toast.error(e.message||"Payment failed"); setPayingCallout(false) }
  }
  async function submitEmergency() {
    if (!emergencyType) return toast.error("Please select emergency type")
    if (!location.lat) return toast.error("Please share your location")
    if (!selectedService) return toast.error("Please select a GO service")
    setSubmitting(true)
    try {
      const { data: bk, error } = await supabase.from("bookings").insert({
        customer_id: user.id,
        provider_id: selectedService.provider_id,
        service_id: selectedService.id,
        service_name: selectedService.name,
        service_category: "go_service",
        is_emergency: true,
        emergency_type: emergencyType,
        emergency_location_lat: location.lat,
        emergency_location_lng: location.lng,
        emergency_location_address: location.address,
        booking_date: new Date().toISOString().split("T")[0],
        booking_time: new Date().toTimeString().slice(0,5),
        total_amount: selectedService.price,
        platform_commission: Number(selectedService.price) * 0.15,
        provider_earnings: Number(selectedService.price) * 0.85,
        platform_commission_rate: 0.15,
        provider_commission_rate: 0.85,
        payment_method: "mpesa",
        payment_status: "pending",
        status: "pending",
        notes: details,
        vehicle_id: vehicle||null,
        go_attempt_number: 1,
      }).select().single()
      if (error) throw error
      // Create go_service_request so providers can see it
      await supabase.from("go_service_requests").insert({
        booking_id: bk.id,
        provider_id: selectedService.provider_id,
        status: "pending",
        attempt_number: 1,
      })
      // Notify provider
      await supabase.from("notifications").insert({
        user_id: selectedService.provider_id,
        title: "🚨 Emergency GO Service request!",
        message: "A customer needs emergency help: "+emergencyType.replace(/_/g," ")+" at "+location.address.slice(0,60),
        type: "error"
      })
      setBooking(bk)
      setStep("waiting")
      startCountdown(15 * 60)
      toast.success("Emergency request sent! 🚨")
    } catch(err) {
      toast.error(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function cancelRequest() {
    if (!booking) return
    if (!confirm("Cancel this emergency request?")) return
    await supabase.from("bookings").update({ status:"cancelled" }).eq("id", booking.id)
    setBooking(null)
    setStep("select")
    setTimeLeft(null)
    toast.success("Request cancelled")
  }

  const formatTime = (seconds) => {
    if (!seconds) return "15:00"
    const m = Math.floor(seconds/60)
    const s = seconds%60
    return `${m}:${s.toString().padStart(2,"0")}`
  }

  const emergencyData = EMERGENCY_TYPES.find(e=>e.key===emergencyType)

  if (step==="waiting") return (
    <div>
      <div style={{ background:"#fff5f5", border:"1px solid #fecaca", borderRadius:16, padding:"1.5rem", marginBottom:"1rem", textAlign:"center" }}>
        <div style={{ fontSize:40, marginBottom:10 }}>🚨</div>
        <div style={{ fontFamily:"Syne", fontSize:isMobile?18:22, fontWeight:800, color:"#e24b4a", marginBottom:6 }}>
          Emergency request sent
        </div>
        <div style={{ fontSize:13, color:"#555555", marginBottom:"1.5rem" }}>
          Looking for available providers...
        </div>

        <div style={{ background:"#ffffff", borderRadius:12, padding:"1.25rem", marginBottom:"1.5rem" }}>
          <div style={{ fontFamily:"Syne", fontSize:36, fontWeight:800, color:timeLeft&&timeLeft<60?"#e24b4a":"#e6821e", letterSpacing:2, marginBottom:4 }}>
            {formatTime(timeLeft)}
          </div>
          <div style={{ fontSize:11, color:"#777777" }}>
            Time remaining for provider to accept · Attempt {attemptNumber} of 5
          </div>
          <div style={{ background:"#f5f5f5", borderRadius:8, height:6, marginTop:12, overflow:"hidden" }}>
            <div style={{ background:"#e6821e", height:"100%", width:`${((timeLeft||0)/(15*60))*100}%`, transition:"width 1s linear", borderRadius:8 }}/>
          </div>
        </div>

        <div style={{ background:"#ffffff", borderRadius:10, padding:"1rem", marginBottom:"1.5rem", textAlign:"left" }}>
          <div style={{ fontSize:11, color:"#777777", marginBottom:8 }}>Emergency details</div>
          <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:6 }}>
            <span style={{ fontSize:20 }}>{emergencyData?.icon}</span>
            <span style={{ fontSize:13, color:"#000000" }}>{emergencyData?.label}</span>
          </div>
          <div style={{ fontSize:11, color:"#777777" }}>📍 {location.address||"Location shared"}</div>
          {details&&<div style={{ fontSize:11, color:"#777777", marginTop:4 }}>📝 {details}</div>}
        </div>

        </div>

      {/* Safety checklist */}
      <div style={{ background:"#ffffff", border:"1px solid #e6821e40", borderRadius:16, padding:"1.25rem", marginBottom:"1rem" }}>
        <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:800, color:"#e6821e", marginBottom:12 }}>
          ⚠️ Stay safe while you wait
        </div>
        <div style={{ fontSize:12, color:"#555555", marginBottom:12, lineHeight:1.6 }}>
          Please take the following safety measures immediately while our mechanic is on the way:
        </div>
        {[
          { icon:"🔴", text:"Turn on your hazard lights immediately", priority:"high" },
          { icon:"⚠️", text:"Place warning triangles at least 50 metres behind your vehicle", priority:"high" },
          { icon:"🚗", text:"Move your vehicle to the hard shoulder or road side if possible", priority:"high" },
          { icon:"👥", text:"Keep all passengers away from the road — move to safety barrier side", priority:"high" },
          { icon:"📱", text:"Stay in your vehicle if you are on a highway or fast road", priority:"medium" },
          { icon:"🔦", text:"If at night — use your phone torch to stay visible to other drivers", priority:"medium" },
          { icon:"🚫", text:"Do not attempt to repair the vehicle yourself on a busy road", priority:"medium" },
          { icon:"📞", text:"If blocking traffic — call NTSA: 0800 723 573", priority:"emergency" },
          { icon:"🚔", text:"If you are in danger — call Police: 999", priority:"emergency" },
        ].map(item=>(
          <div key={item.text} style={{ display:"flex", gap:10, alignItems:"flex-start", marginBottom:10, padding:"0.6rem", background:item.priority==="emergency"?"#fff5f5":item.priority==="high"?"#fff8f0":"#f5f5f5", borderRadius:8, border:`1px solid ${item.priority==="emergency"?"#fecaca":item.priority==="high"?"#fed7aa":"#eeeeee"}` }}>
            <span style={{ fontSize:18, flexShrink:0 }}>{item.icon}</span>
            <span style={{ fontSize:12, color:item.priority==="emergency"?"#e24b4a":item.priority==="high"?"#e6821e":"#888", lineHeight:1.5 }}>{item.text}</span>
          </div>
        ))}
        <div style={{ background:"#ffffff", borderRadius:8, padding:"0.75rem", marginTop:4 }}>
          <div style={{ fontSize:11, color:"#777777", lineHeight:1.6 }}>
            🇰🇪 Kenya Road Safety — In case of accident or emergency on a public road, you are required by law to place warning signs and alert other road users. Failure to do so may result in further accidents.
          </div>
        </div>
      </div>

      <div style={{ background:"#fff5f5", border:"1px solid #fecaca", borderRadius:16, padding:"1.5rem", marginBottom:"1rem", textAlign:"center" }}>
        <button onClick={cancelRequest}
          style={{ background:"none", border:"1px solid #e24b4a40", borderRadius:10, color:"#e24b4a", fontSize:13, padding:"10px 24px", cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}>
          Cancel request
        </button>
      </div>
    </div>
  )

  if (step==="accepted") return (
    <div>
      <div style={{ background:"#f0fdf4", border:"1px solid #bbf7d0", borderRadius:16, padding:"1.5rem", marginBottom:"1rem", textAlign:"center" }}>
        <div style={{ fontSize:40, marginBottom:10 }}>✅</div>
        <div style={{ fontFamily:"Syne", fontSize:isMobile?18:22, fontWeight:800, color:"#1d9e75", marginBottom:6 }}>
          Help is on the way!
        </div>
        <div style={{ fontSize:13, color:"#555555", marginBottom:"1.5rem" }}>
          A mechanic has been dispatched to your location
        </div>
        <div style={{ background:"#ffffff", borderRadius:10, padding:"1rem", textAlign:"left", marginBottom:"1rem" }}>
          <div style={{ fontSize:11, color:"#777777", marginBottom:6 }}>Booking reference</div>
          <div style={{ fontSize:13, color:"#000000", fontFamily:"monospace" }}>#{booking?.booking_number}</div>
        </div>
        <button onClick={()=>{ setStep("select"); setBooking(null); loadActiveGoBookings() }}
          style={{ background:"#1d9e75", border:"none", borderRadius:10, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:13, fontWeight:700, padding:"11px 24px", cursor:"pointer" }}>
          Track mechanic →
        </button>
      </div>
    </div>
  )

  if (step==="no_providers") return (
    <div style={{ background:"#fff5f5", border:"1px solid #fecaca", borderRadius:16, padding:"2rem", textAlign:"center" }}>
      <div style={{ fontSize:40, marginBottom:10 }}>😔</div>
      <div style={{ fontFamily:"Syne", fontSize:18, fontWeight:800, color:"#e24b4a", marginBottom:8 }}>No providers available</div>
      <div style={{ fontSize:13, color:"#555555", marginBottom:"1.5rem", lineHeight:1.6 }}>
        We tried 5 providers but none were available right now. Please try again in a few minutes or call emergency services if urgent.
      </div>
      <div style={{ display:"flex", gap:8, justifyContent:"center", flexWrap:"wrap" }}>
        <button onClick={()=>{ setStep("select"); setBooking(null); setAttemptNumber(1); setTimeLeft(null) }}
          style={{ background:"#e6821e", border:"none", borderRadius:10, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:13, fontWeight:700, padding:"11px 24px", cursor:"pointer" }}>
          Try again
        </button>
        <a href="tel:999" style={{ background:"#fff5f5", border:"1px solid #fecaca", borderRadius:10, color:"#e24b4a", fontSize:13, fontWeight:600, padding:"11px 24px", textDecoration:"none", fontFamily:"'DM Sans',sans-serif" }}>
          📞 Call emergency
        </a>
      </div>
    </div>
  )

  return (
    <div>
      {/* Active GO bookings */}
      {activeGoBookings.length>0&&(
        <div style={{ background:"#f0fdf4", border:"1px solid #bbf7d0", borderRadius:12, padding:"1rem", marginBottom:"1.5rem" }}>
          <div style={{ fontFamily:"Syne", fontSize:13, fontWeight:700, color:"#1d9e75", marginBottom:8 }}>Active emergency requests</div>
          {activeGoBookings.map(b=>(
            <div key={b.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 0", borderBottom:"1px solid #eeeeee" }}>
              <div>
                <div style={{ fontSize:12, color:"#000000" }}>{b.service_name}</div>
                <div style={{ fontSize:10, color:"#777777" }}>#{b.booking_number} · {b.status}</div>
              </div>
              <button onClick={()=>{ setBooking(b); setStep("waiting") }}
                style={{ background:"#e6821e", border:"none", borderRadius:7, color:"#fff", fontSize:11, padding:"5px 10px", cursor:"pointer" }}>
                Track
              </button>
            </div>
          ))}
        </div>
      )}

      <div style={{ background:"#fff5f5", border:"1px solid #fecaca", borderRadius:16, padding:"1.25rem", marginBottom:"1.5rem" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:6 }}>
          <span style={{ fontSize:24 }}>🚨</span>
          <div>
            <div style={{ fontFamily:"Syne", fontSize:16, fontWeight:800, color:"#e24b4a" }}>GO Services — Emergency</div>
            <div style={{ fontSize:11, color:"#666" }}>24/7 roadside assistance · Online payment only</div>
          </div>
        </div>
        <div style={{ fontSize:11, color:"#777777", lineHeight:1.6 }}>
          Provider has 15 minutes to accept. We try up to 5 providers before notifying you of unavailability.
        </div>
      </div>

      {/* Step 1 — Emergency type */}
      <div style={{ background:"#ffffff", border:"1px solid #eeeeee", borderRadius:12, padding:"1.25rem", marginBottom:"1rem" }}>
        <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:700, color:"#000000", marginBottom:"1rem" }}>
          1. What is your emergency?
        </div>
        <div style={{ display:"grid", gridTemplateColumns:isMobile?"repeat(2,1fr)":"repeat(4,1fr)", gap:8 }}>
          {EMERGENCY_TYPES.map(e=>(
            <button key={e.key} onClick={()=>setEmergencyType(e.key)}
              style={{ background:emergencyType===e.key?"#fff5f5":"#f5f5f5", border:`1px solid ${emergencyType===e.key?"#e24b4a":"#e5e5e5"}`, borderRadius:10, padding:"0.75rem", cursor:"pointer", textAlign:"center" }}>
              <div style={{ fontSize:24, marginBottom:4 }}>{e.icon}</div>
              <div style={{ fontSize:11, color:emergencyType===e.key?"#e24b4a":"#555555", fontWeight:emergencyType===e.key?600:400 }}>{e.label}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Step 2 — Location */}
      <div style={{ background:"#ffffff", border:"1px solid #eeeeee", borderRadius:12, padding:"1.25rem", marginBottom:"1rem" }}>
        <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:700, color:"#000000", marginBottom:"1rem" }}>
          2. Your location
        </div>
        <button onClick={detectLocation} disabled={locating}
          style={{ background:locating?"#f0f0f0":"#fff5f5", border:"1px solid #fecaca", borderRadius:9, color:locating?"#999":"#e24b4a", fontFamily:"Syne,sans-serif", fontSize:13, fontWeight:700, padding:"11px 20px", cursor:locating?"not-allowed":"pointer", width:"100%", marginBottom:10 }}>
          {locating?"📍 Detecting...":"📍 Use my current location"}
        </button>
        {location.address&&(
          <div style={{ background:"#ffffff", borderRadius:8, padding:"0.75rem", fontSize:12, color:"#555555" }}>
            📍 {location.address}
          </div>
        )}
        {!location.lat&&(
          <div style={{ marginTop:10 }}>
            <input placeholder="Or enter your location manually..." value={location.address} onChange={e=>setLocation(l=>({...l,address:e.target.value}))}
              style={{ width:"100%", background:"#ffffff", border:"1px solid #e5e5e5", borderRadius:8, padding:"11px 12px", color:"#000000", fontSize:13, outline:"none", fontFamily:"'DM Sans',sans-serif" }}/>
          </div>
        )}
      </div>

      {/* Step 3 — Select GO service */}
      <div style={{ background:"#ffffff", border:"1px solid #eeeeee", borderRadius:12, padding:"1.25rem", marginBottom:"1rem" }}>
        <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:700, color:"#000000", marginBottom:"1rem" }}>
          3. Select service
        </div>
        {goServices.length===0&&<div style={{ fontSize:12, color:"#777777" }}>No GO services available in your area right now</div>}
        {goServices.map(s=>(
          <div key={s.id} onClick={()=>setSelectedService(s)}
            style={{ background:selectedService?.id===s.id?"#fff5f5":"#f5f5f5", border:`1px solid ${selectedService?.id===s.id?"#e24b4a":"#eeeeee"}`, borderRadius:10, padding:"0.9rem", cursor:"pointer", marginBottom:8 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div>
                <div style={{ fontSize:13, fontWeight:600, color:"#000000", marginBottom:2 }}>{s.name}</div>
                <div style={{ fontSize:11, color:"#777777" }}>🏪 {s.profiles?.business_name||`${s.profiles?.first_name} ${s.profiles?.last_name}`}{s._distance!=null&&` · ${s._distance.toFixed(1)}km away`}</div>
                {s.description&&<div style={{ fontSize:11, color:"#888888", marginTop:2 }}>{s.description}</div>}
              </div>
              <div style={{ textAlign:"right" }}>
                <div style={{ fontFamily:"Syne", fontSize:15, fontWeight:800, color:"#e6821e" }}>KES {Number(s.price).toLocaleString()}</div>
                {selectedService?.id===s.id&&<div style={{ fontSize:12, color:"#e24b4a", marginTop:2 }}>✓ Selected</div>}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Step 4 — Vehicle + details */}
      <div style={{ background:"#ffffff", border:"1px solid #eeeeee", borderRadius:12, padding:"1.25rem", marginBottom:"1.5rem" }}>
        <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:700, color:"#000000", marginBottom:"1rem" }}>
          4. Vehicle & details
        </div>
        {vehicles.length>0&&(
          <div style={{ marginBottom:12 }}>
            <label style={{ fontSize:11, color:"#666", textTransform:"uppercase", letterSpacing:"0.05em", display:"block", marginBottom:4 }}>Your vehicle</label>
            <select value={vehicle} onChange={e=>setVehicle(e.target.value)}
              style={{ width:"100%", background:"#ffffff", border:"1px solid #e5e5e5", borderRadius:8, padding:"11px 12px", color:"#000000", fontSize:13, outline:"none", fontFamily:"'DM Sans',sans-serif" }}>
              <option value="">Select vehicle</option>
              {vehicles.map(v=><option key={v.id} value={v.id}>{v.make} {v.model} {v.year} — {v.license_plate}</option>)}
            </select>
          </div>
        )}
        <label style={{ fontSize:11, color:"#666", textTransform:"uppercase", letterSpacing:"0.05em", display:"block", marginBottom:4 }}>Additional details</label>
        <textarea value={details} onChange={e=>setDetails(e.target.value)}
          placeholder="Describe your situation, car color, exact location details..."
          style={{ width:"100%", background:"#ffffff", border:"1px solid #e5e5e5", borderRadius:8, padding:"11px 12px", color:"#000000", fontSize:13, outline:"none", fontFamily:"'DM Sans',sans-serif", resize:"vertical", minHeight:80 }}/>
      </div>

      {/* Submit */}
      <button onClick={initiateCalloutPayment} disabled={submitting||!emergencyType||!location.lat||!selectedService}
        style={{ width:"100%", background:submitting||!emergencyType||!location.lat||!selectedService?"#555555":"#e24b4a", border:"none", borderRadius:12, color:submitting||!emergencyType||!location.lat||!selectedService?"#555":"#fff", fontFamily:"Syne,sans-serif", fontSize:15, fontWeight:700, padding:"15px", cursor:submitting||!emergencyType||!location.lat||!selectedService?"not-allowed":"pointer" }}>
        {submitting?"Sending request...":"🚨 Request Emergency Help"}
      </button>
      <div style={{ fontSize:11, color:"#888888", textAlign:"center", marginTop:8 }}>
        Online payment only · Provider has 15 min to accept · Max 5 attempts
      </div>

      {showDepositPayment&&(
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.85)", zIndex:200, display:"flex", alignItems:"center", justifyContent:"center", padding:"1rem" }}>
          <div style={{ width:"100%", maxWidth:400, background:"#ffffff", border:"1px solid #e24b4a40", borderRadius:16, padding:"1.5rem" }}>
            <div style={{ fontFamily:"Syne", fontSize:16, fontWeight:800, color:"#e24b4a", marginBottom:4 }}>🚨 Confirm Emergency Request</div>
            <div style={{ fontSize:12, color:"#555555", marginBottom:16, lineHeight:1.6 }}>A KES 500 mechanic callout fee covers transport costs to your location.</div>
            <div style={{ background:"#ffffff", borderRadius:10, padding:"1rem", marginBottom:16 }}>
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, color:"#555555", marginBottom:6 }}><span>Emergency</span><span style={{ color:"#000000", textTransform:"capitalize" }}>{emergencyType.replace(/_/g," ")}</span></div>
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, color:"#555555", marginBottom:6 }}><span>Provider</span><span style={{ color:"#000000" }}>{selectedService?.profiles?.business_name||selectedService?.profiles?.first_name}</span></div>
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, color:"#555555", marginBottom:6 }}><span>Service fee</span><span style={{ color:"#000000" }}>KES {Number(selectedService?.price||0).toLocaleString()}</span></div>
              <div style={{ height:1, background:"#f0f0f0", margin:"8px 0" }}/>
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:13, color:"#e6821e", fontWeight:700 }}><span>Callout fee (pay now)</span><span>KES 500</span></div>
              <div style={{ fontSize:10, color:"#777777", marginTop:4 }}>Service fee paid after completion</div>
            </div>
            <button onClick={payCalloutFee} disabled={payingCallout} style={{ width:"100%", background:payingCallout?"#555555":"#e24b4a", border:"none", borderRadius:10, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:14, fontWeight:700, padding:"13px", cursor:payingCallout?"not-allowed":"pointer", marginBottom:8 }}>
              {payingCallout?"Connecting to Pesapal...":"Pay KES 500 and Request Help"}
            </button>
            <button onClick={()=>setShowDepositPayment(false)} style={{ width:"100%", background:"none", border:"1px solid #dddddd", borderRadius:10, color:"#666", fontSize:13, padding:"11px", cursor:"pointer" }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {showDepositPayment&&(
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.8)", zIndex:200, display:"flex", alignItems:"center", justifyContent:"center", padding:"1rem" }}>
          <div style={{ width:"100%", maxWidth:400, background:"#ffffff", border:"1px solid #e24b4a40", borderRadius:16, padding:"1.5rem" }}>
            <div style={{ fontFamily:"Syne", fontSize:16, fontWeight:800, color:"#e24b4a", marginBottom:4 }}>🚨 Confirm Emergency Request</div>
            <div style={{ fontSize:12, color:"#555555", marginBottom:16, lineHeight:1.6 }}>
              A KES 500 mechanic callout fee is required to dispatch a mechanic to your location. This covers transport costs.
            </div>
            <div style={{ background:"#ffffff", borderRadius:10, padding:"1rem", marginBottom:16 }}>
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, color:"#555555", marginBottom:6 }}>
                <span>Emergency type</span><span style={{ color:"#000000" }}>{emergencyType.replace(/_/g," ")}</span>
              </div>
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, color:"#555555", marginBottom:6 }}>
                <span>Service provider</span><span style={{ color:"#000000" }}>{selectedService?.profiles?.business_name||selectedService?.profiles?.first_name}</span>
              </div>
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, color:"#555555", marginBottom:6 }}>
                <span>Service fee</span><span style={{ color:"#000000" }}>KES {Number(selectedService?.price||0).toLocaleString()}</span>
              </div>
              <div style={{ height:1, background:"#f0f0f0", margin:"8px 0" }}/>
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:13, color:"#e6821e", fontWeight:700 }}>
                <span>Callout fee (pay now)</span><span>KES 500</span>
              </div>
              <div style={{ fontSize:10, color:"#777777", marginTop:4 }}>Service fee paid after completion</div>
            </div>
            <button onClick={payCalloutFee} disabled={payingCallout}
              style={{ width:"100%", background:payingCallout?"#555555":"#e24b4a", border:"none", borderRadius:10, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:14, fontWeight:700, padding:"13px", cursor:payingCallout?"not-allowed":"pointer", marginBottom:8 }}>
              {payingCallout?"Connecting to Pesapal...":"Pay KES 500 & Request Help →"}
            </button>
            <button onClick={()=>setShowDepositPayment(false)}
              style={{ width:"100%", background:"none", border:"1px solid #dddddd", borderRadius:10, color:"#666", fontSize:13, padding:"11px", cursor:"pointer" }}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

















