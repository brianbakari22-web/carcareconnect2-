import { useEffect, useState, useRef } from "react"
import { supabase } from "../../lib/supabase"
import { useAuth } from "../../contexts/AuthContext"
import useIsMobile from "../../lib/useIsMobile"
import toast from "react-hot-toast"

export default function ProviderGoRequests() {
  const locationWatchRef = useRef(null)
  const { user } = useAuth()
  const isMobile = useIsMobile()
  const [requests, setRequests] = useState([])
  const [mechanics, setMechanics] = useState([])
  const [loading, setLoading] = useState(true)
  const [assigning, setAssigning] = useState(null)
  const [selectedMechanic, setSelectedMechanic] = useState("")
  const [timers, setTimers] = useState({})

  useEffect(() => {
    if (!user) return
    load()
    requestPushPermission()
    const sub = supabase.channel("provider-go-requests")
      .on("postgres_changes", { event:"INSERT", schema:"public", table:"go_service_requests", filter:`provider_id=eq.${user.id}` },
        payload => {
          playAlarm()
          sendPushNotification("🚨 EMERGENCY GO REQUEST!", "Customer needs help urgently. Open CCC now!")
          toast("🚨 NEW EMERGENCY — Customer needs help NOW!", { duration:30000, icon:"🚨", style:{ background:"#e24b4a", color:"#fff", fontWeight:800, fontSize:13 } })
          load()
          let count = 0
          const interval = setInterval(() => {
            count++
            if (count >= 4) { clearInterval(interval); return }
            playAlarm()
          }, 30000)
        })
      .on("postgres_changes", { event:"UPDATE", schema:"public", table:"go_service_requests", filter:`provider_id=eq.${user.id}` },
        () => load())
      .subscribe()
    return () => supabase.removeChannel(sub)
  }, [user])

  useEffect(() => {
    const interval = setInterval(() => {
      setTimers(prev => {
        const updated = { ...prev }
        requests.forEach(r => {
          if (r.status==="pending") {
            const sent = new Date(r.sent_at).getTime()
            const now = Date.now()
            const elapsed = Math.floor((now - sent) / 1000)
            const remaining = Math.max(0, 15*60 - elapsed)
            updated[r.id] = remaining
            if (remaining === 0) handleTimeout(r)
          }
        })
        return updated
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [requests])

  function requestPushPermission() {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission()
    }
  }

  function playAlarm() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      const freqs = [880, 660, 880, 660, 1100]
      freqs.forEach((freq, i) => {
        const o = ctx.createOscillator()
        const g = ctx.createGain()
        o.connect(g); g.connect(ctx.destination)
        o.frequency.value = freq
        o.type = "square"
        g.gain.setValueAtTime(0.4, ctx.currentTime + i*0.25)
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i*0.25 + 0.2)
        o.start(ctx.currentTime + i*0.25)
        o.stop(ctx.currentTime + i*0.25 + 0.2)
      })
    } catch(e) {}
  }

  function sendPushNotification(title, body) {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(title, { body, requireInteraction:true, tag:"go-emergency" })
    }
  }

  function requestPushPermission() {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission()
    }
  }

  function playAlarm() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      const freqs = [880, 660, 880, 660, 1100]
      freqs.forEach((freq, i) => {
        const o = ctx.createOscillator()
        const g = ctx.createGain()
        o.connect(g); g.connect(ctx.destination)
        o.frequency.value = freq
        o.type = "square"
        g.gain.setValueAtTime(0.4, ctx.currentTime + i*0.25)
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i*0.25 + 0.2)
        o.start(ctx.currentTime + i*0.25)
        o.stop(ctx.currentTime + i*0.25 + 0.2)
      })
    } catch(e) {}
  }

  function sendPushNotification(title, body) {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(title, { body, requireInteraction:true, tag:"go-emergency" })
    }
  }

  function startMechanicTracking(bookingId) {
    if (!navigator.geolocation) return
    if (locationWatchRef.current) navigator.geolocation.clearWatch(locationWatchRef.current)
    locationWatchRef.current = navigator.geolocation.watchPosition(
      async pos => {
        const { latitude, longitude } = pos.coords
        try {
          await supabase.from("mechanic_location_history").insert({
            mechanic_id: user.id,
            booking_id: bookingId,
            latitude,
            longitude,
            recorded_at: new Date().toISOString(),
          })
        } catch(err) { console.error("Mechanic location error:", err) }
      },
      err => console.error("GPS error:", err),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    )
  }

  function stopMechanicTracking() {
    if (locationWatchRef.current) {
      navigator.geolocation.clearWatch(locationWatchRef.current)
      locationWatchRef.current = null
    }
  }

  async function load() {
    const [{ data: reqs }, { data: mechs }] = await Promise.all([
      supabase.from("go_service_requests").select("*, bookings(*)").eq("provider_id", user.id).order("sent_at", { ascending:false }).limit(20),
      supabase.from("mechanics").select("*").eq("provider_id", user.id).eq("is_active", true).eq("is_available", true),
    ])
    setRequests(reqs||[])
    setMechanics(mechs||[])
    setLoading(false)
  }

  async function handleTimeout(request) {
    if (request.status !== "pending") return
    await supabase.from("go_service_requests").update({ status:"timeout", responded_at:new Date().toISOString() }).eq("id", request.id)
    load()
  }

  async function acceptRequest(request) {
    if (!selectedMechanic && mechanics.length > 0) return toast.error("Please select a mechanic to dispatch")
    try {
      await supabase.from("go_service_requests").update({ status:"accepted", responded_at:new Date().toISOString() }).eq("id", request.id)
      await supabase.from("bookings").update({
        status: "confirmed",
        provider_accepted_at: new Date().toISOString(),
        assigned_mechanic_id: selectedMechanic||null,
      }).eq("id", request.booking_id)
      if (selectedMechanic) {
        await supabase.from("mechanics").update({ is_available:false, current_booking_id:request.booking_id }).eq("id", selectedMechanic)
      }
      toast.success("Emergency accepted — mechanic dispatched! 🚨")
      // Start GPS tracking for this booking
      startMechanicTracking(request.booking_id)
      const mechanic = mechanics.find(m=>m.id===selectedMechanic)
      const mName = mechanic ? mechanic.first_name+" "+mechanic.last_name : "Our mechanic"
      const mPhone = mechanic?.phone || "Check notifications"
      const mSpec = mechanic?.specialization || "General Mechanic"
      const { data: bkData } = await supabase.from("bookings").select("customer_id").eq("id", request.booking_id).single()
      if (bkData?.customer_id) {
        await supabase.from("notifications").insert({
          user_id: bkData.customer_id,
          title: "🚨 Mechanic dispatched — help is on the way!",
          message: "Mechanic: "+mName+" | "+mSpec+" | Phone: "+mPhone+" | They are heading to your location now. Please stay safe.",
          type: "success"
        })
      }
      setAssigning(null)
      setSelectedMechanic("")
      load()
    } catch(err) {
      toast.error(err.message)
    }
  }

  async function declineRequest(request) {
    if (!confirm("Decline this emergency request?")) return
    await supabase.from("go_service_requests").update({ status:"declined", responded_at:new Date().toISOString() }).eq("id", request.id)
    toast.success("Request declined")
    load()
  }

  function formatTime(seconds) {
    if (!seconds && seconds !== 0) return "15:00"
    const m = Math.floor(seconds/60)
    const s = seconds%60
    return `${m}:${s.toString().padStart(2,"0")}`
  }

  const pending = requests.filter(r=>r.status==="pending")
  const recent = requests.filter(r=>r.status!=="pending")

  const EMERGENCY_ICONS = { flat_tire:"🛞", dead_battery:"🔋", out_of_fuel:"⛽", car_wont_start:"🔑", overheating:"🌡️", towing:"🚚", other:"🆘" }

  return (
    <div>
      {pending.length > 0 && (
        <div style={{ background:"#fff5f5", border:"2px solid #e24b4a", borderRadius:12, padding:"1rem", marginBottom:"1.5rem" }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
            <div style={{ width:10, height:10, borderRadius:"50%", background:"#e24b4a", boxShadow:"0 0 8px #e24b4a" }}/>
            <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:800, color:"#e24b4a" }}>
              🚨 {pending.length} Emergency request{pending.length!==1?"s":""} pending
            </div>
          </div>
          {pending.map(r=>(
            <div key={r.id} style={{ background:"#ffffff", borderRadius:10, padding:"1rem", marginBottom:10 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
                <div>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                    <span style={{ fontSize:20 }}>{EMERGENCY_ICONS[r.bookings?.emergency_type]||"🆘"}</span>
                    <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:700, color:"#e24b4a" }}>
                      {r.bookings?.emergency_type?.replace(/_/g," ").toUpperCase()}
                    </div>
                  </div>
                  <div style={{ fontSize:12, color:"#555555", marginBottom:2 }}>📍 {r.bookings?.emergency_location_address}</div>
                  {r.bookings?.notes&&<div style={{ fontSize:11, color:"#666" }}>📝 {r.bookings.notes}</div>}
                  <div style={{ fontSize:11, color:"#e6821e", marginTop:4 }}>
                    💰 KES {Number(r.bookings?.total_amount||0).toLocaleString()} · Your earnings: KES {(Number(r.bookings?.total_amount||0)*0.85).toFixed(0)}
                  </div>
                  <div style={{ fontSize:11, color:"#777777", marginTop:2 }}>Attempt {r.attempt_number} of 5</div>
                </div>
                <div style={{ textAlign:"center", flexShrink:0 }}>
                  <div style={{ fontFamily:"Syne", fontSize:24, fontWeight:800, color:timers[r.id]<60?"#e24b4a":"#e6821e" }}>
                    {formatTime(timers[r.id])}
                  </div>
                  <div style={{ fontSize:9, color:"#777777" }}>time left</div>
                </div>
              </div>

              {assigning===r.id&&mechanics.length>0&&(
                <div style={{ background:"#faf5ff", border:"1px solid #8b5cf630", borderRadius:8, padding:"0.75rem", marginBottom:10 }}>
                  <div style={{ fontSize:11, color:"#8b5cf6", marginBottom:8, fontWeight:600 }}>Select mechanic to dispatch:</div>
                  {mechanics.map(m=>(
                    <div key={m.id} onClick={()=>setSelectedMechanic(m.id)}
                      style={{ display:"flex", alignItems:"center", gap:8, padding:"6px", borderRadius:7, cursor:"pointer", background:selectedMechanic===m.id?"#1e0a3e":"transparent", marginBottom:4 }}>
                      <div style={{ width:28, height:28, borderRadius:"50%", background:"#f0fdf4", border:"1px solid #1d9e7540", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:800, color:"#1d9e75" }}>
                        {m.first_name[0]}{m.last_name[0]}
                      </div>
                      <div>
                        <div style={{ fontSize:12, color:"#000000" }}>{m.first_name} {m.last_name}</div>
                        <div style={{ fontSize:10, color:"#777777" }}>{m.specialization}</div>
                      </div>
                      {selectedMechanic===m.id&&<div style={{ marginLeft:"auto", color:"#8b5cf6", fontSize:14 }}>✓</div>}
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                <button onClick={()=>{ setAssigning(assigning===r.id?null:r.id); setSelectedMechanic("") }}
                  style={{ background:"#e24b4a", border:"none", borderRadius:8, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:12, fontWeight:700, padding:"9px 18px", cursor:"pointer" }}>
                  {assigning===r.id?"Cancel":"🚨 Accept & dispatch"}
                </button>
                {assigning===r.id&&(
                  <button onClick={()=>acceptRequest(r)} disabled={mechanics.length>0&&!selectedMechanic}
                    style={{ background:mechanics.length>0&&!selectedMechanic?"#333":"#1d9e75", border:"none", borderRadius:8, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:12, fontWeight:700, padding:"9px 18px", cursor:"pointer" }}>
                    Confirm dispatch
                  </button>
                )}
                <button onClick={()=>declineRequest(r)}
                  style={{ background:"none", border:"1px solid #e24b4a40", borderRadius:8, color:"#e24b4a", fontSize:12, padding:"9px 14px", cursor:"pointer" }}>
                  Decline
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:700, color:"#000000", marginBottom:"1rem" }}>
        Recent GO requests
      </div>

      {loading&&<div style={{ color:"#777777", fontSize:13 }}>Loading...</div>}
      {!loading&&recent.length===0&&pending.length===0&&(
        <div style={{ color:"#888888", fontSize:13, textAlign:"center", padding:"2rem" }}>
          <div style={{ fontSize:32, marginBottom:10 }}>🚨</div>
          No GO service requests yet
        </div>
      )}

      {recent.map(r=>(
        <div key={r.id} style={{ background:"#ffffff", border:"1px solid #eeeeee", borderRadius:10, padding:"0.9rem", marginBottom:8 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <div>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                <span>{EMERGENCY_ICONS[r.bookings?.emergency_type]||"🆘"}</span>
                <span style={{ fontSize:13, color:"#000000" }}>{r.bookings?.emergency_type?.replace(/_/g," ")}</span>
                <span style={{ fontSize:10, padding:"2px 8px", borderRadius:10, background:r.status==="accepted"?"#071a12":r.status==="declined"?"#1a0808":"#1a1a1a", color:r.status==="accepted"?"#1d9e75":r.status==="declined"?"#e24b4a":"#888" }}>{r.status}</span>
              </div>
              <div style={{ fontSize:11, color:"#777777" }}>📍 {r.bookings?.emergency_location_address}</div>
              <div style={{ fontSize:10, color:"#888888", marginTop:2 }}>{new Date(r.sent_at).toLocaleString()}</div>
            </div>
            <div style={{ fontFamily:"Syne", fontSize:13, fontWeight:700, color:"#e6821e" }}>
              KES {Number(r.bookings?.total_amount||0).toLocaleString()}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}






