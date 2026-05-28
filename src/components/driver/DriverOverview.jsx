import { useEffect, useState, useRef } from "react"
import { supabase } from "../../lib/supabase"
import { useAuth } from "../../contexts/AuthContext"
import useIsMobile from "../../lib/useIsMobile"
import toast from "react-hot-toast"

export default function DriverOverview() {
  const { user, profile } = useAuth()
  const isMobile = useIsMobile()
  const [driverStatus, setDriverStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState(false)
  const [activeJob, setActiveJob] = useState(null)
  const [todayStats, setTodayStats] = useState({ jobs:0, earnings:0, rating:0 })
  const [weekStats, setWeekStats] = useState({ jobs:0, earnings:0 })
  const locationIntervalRef = useRef(null)

  useEffect(() => {
    if (!user) return
    load()
    const sub = supabase.channel("driver-overview-live")
      .on("postgres_changes", { event:"*", schema:"public", table:"driver_status", filter:`driver_id=eq.${user.id}` }, () => load())
      .on("postgres_changes", { event:"*", schema:"public", table:"bookings", filter:`driver_id=eq.${user.id}` }, () => loadActiveJob())
      .subscribe()
    return () => {
      supabase.removeChannel(sub)
      if (locationIntervalRef.current) clearInterval(locationIntervalRef.current)
    }
  }, [user])

  useEffect(() => {
    if (driverStatus?.is_online) {
      startLocationSharing()
    } else {
      if (locationIntervalRef.current) clearInterval(locationIntervalRef.current)
    }
  }, [driverStatus?.is_online])

  async function load() {
    await Promise.all([loadStatus(), loadActiveJob(), loadStats()])
    setLoading(false)
  }

  async function loadStatus() {
    const { data } = await supabase.from("driver_status").select("*").eq("driver_id", user.id).maybeSingle()
    if (!data) {
      await supabase.from("driver_status").insert({ driver_id:user.id, is_online:false })
      setDriverStatus({ is_online:false })
    } else {
      setDriverStatus(data)
    }
  }

  async function loadActiveJob() {
    const { data } = await supabase.from("bookings")
      .select("*, vehicles(make,model,year,license_plate,color)")
      .eq("driver_id", user.id)
      .not("status", "in", '("completed","cancelled")')
      .order("created_at", { ascending:false })
      .limit(1)
      .maybeSingle()
    setActiveJob(data)
  }

  async function loadStats() {
    const today = new Date().toISOString().split("T")[0]
    const weekAgo = new Date(Date.now()-7*24*60*60*1000).toISOString().split("T")[0]
    const [{ data: todayBks }, { data: weekBks }, { data: revs }] = await Promise.all([
      supabase.from("bookings").select("driver_earnings").eq("driver_id",user.id).eq("status","completed").eq("booking_date",today),
      supabase.from("bookings").select("driver_earnings").eq("driver_id",user.id).eq("status","completed").gte("booking_date",weekAgo),
      supabase.from("reviews").select("driver_rating").eq("driver_id",user.id).not("driver_rating","is",null),
    ])
    const todayEarnings = todayBks?.reduce((s,b)=>s+Number(b.driver_earnings||0),0)||0
    const weekEarnings = weekBks?.reduce((s,b)=>s+Number(b.driver_earnings||0),0)||0
    const avgRating = revs?.length ? (revs.reduce((s,r)=>s+Number(r.driver_rating),0)/revs.length).toFixed(1) : "—"
    setTodayStats({ jobs:todayBks?.length||0, earnings:todayEarnings, rating:avgRating })
    setWeekStats({ jobs:weekBks?.length||0, earnings:weekEarnings })
  }

  async function toggleOnline() {
    if (!profile?.documents_verified) {
      toast.error("Your documents must be verified by admin before you can go online")
      return
    }
    setToggling(true)
    try {
      const newStatus = !driverStatus?.is_online
      await supabase.from("driver_status").upsert({
        driver_id: user.id,
        is_online: newStatus,
        last_seen: new Date().toISOString(),
      }, { onConflict:"driver_id" })
      setDriverStatus(s=>({...s, is_online:newStatus}))
      toast.success(newStatus?"You are now online — ready for jobs 🟢":"You are now offline 🔴")
    } catch(err) { toast.error(err.message) }
    finally { setToggling(false) }
  }

  function startLocationSharing() {
    if (locationIntervalRef.current) clearInterval(locationIntervalRef.current)
    locationIntervalRef.current = setInterval(() => {
      navigator.geolocation.getCurrentPosition(async pos => {
        await supabase.from("driver_status").update({
          current_latitude: pos.coords.latitude,
          current_longitude: pos.coords.longitude,
          last_seen: new Date().toISOString(),
        }).eq("driver_id", user.id)
      })
    }, 30000)
  }

  const isOnline = driverStatus?.is_online
  const isVerified = profile?.documents_verified

  if (loading) return <div style={{ color:"#555", fontSize:13 }}>Loading...</div>

  return (
    <div>
      {/* Online/Offline toggle */}
      <div style={{ background:isOnline?"#071a12":"#111", border:`2px solid ${isOnline?"#1d9e75":"#333"}`, borderRadius:16, padding:"1.5rem", marginBottom:"1.5rem", textAlign:"center", transition:"all 0.3s" }}>
        <div style={{ fontSize:isMobile?32:48, marginBottom:8 }}>{isOnline?"🟢":"🔴"}</div>
        <div style={{ fontFamily:"Syne", fontSize:isMobile?20:26, fontWeight:800, color:isOnline?"#1d9e75":"#555", marginBottom:4 }}>
          {isOnline?"You are ONLINE":"You are OFFLINE"}
        </div>
        <div style={{ fontSize:12, color:"#555", marginBottom:"1.5rem" }}>
          {isOnline?"You are visible to customers and will receive job requests":"Toggle on to start receiving concierge job requests"}
        </div>

        {!isVerified&&(
          <div style={{ background:"#1a1208", border:"1px solid #e6821e40", borderRadius:10, padding:"0.75rem", marginBottom:"1.25rem" }}>
            <div style={{ fontSize:12, color:"#e6821e" }}>⚠️ Your documents are pending admin verification. You cannot go online until verified.</div>
            <div style={{ fontSize:11, color:"#555", marginTop:4 }}>Go to Profile → Credentials to submit your details.</div>
          </div>
        )}

        <button onClick={toggleOnline} disabled={toggling||!isVerified}
          style={{
            background:!isVerified?"#1a1a1a":isOnline?"#1a0808":"#071a12",
            border:`2px solid ${!isVerified?"#333":isOnline?"#e24b4a":"#1d9e75"}`,
            borderRadius:50, color:!isVerified?"#333":isOnline?"#e24b4a":"#1d9e75",
            fontFamily:"Syne,sans-serif", fontSize:isMobile?16:18, fontWeight:800,
            padding:isMobile?"14px 40px":"16px 56px", cursor:!isVerified||toggling?"not-allowed":"pointer",
            transition:"all 0.2s", letterSpacing:1,
          }}>
          {toggling?"...":(isOnline?"GO OFFLINE":"GO ONLINE")}
        </button>

        {isOnline&&(
          <div style={{ fontSize:11, color:"#1d9e75", marginTop:12, display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
            <div style={{ width:6, height:6, borderRadius:"50%", background:"#1d9e75", boxShadow:"0 0 6px #1d9e75" }}/>
            Location sharing active · Updates every 30 seconds
          </div>
        )}
      </div>

      {/* Active job banner */}
      {activeJob&&(
        <div style={{ background:"#0c1f2e", border:"1px solid #378add40", borderRadius:12, padding:"1rem", marginBottom:"1.5rem" }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
            <div style={{ width:8, height:8, borderRadius:"50%", background:"#378add", boxShadow:"0 0 6px #378add" }}/>
            <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:700, color:"#378add" }}>Active job</div>
          </div>
          <div style={{ fontSize:13, color:"#f0ede6", marginBottom:4 }}>{activeJob.service_name}</div>
          {activeJob.vehicles&&<div style={{ fontSize:11, color:"#555" }}>🚗 {activeJob.vehicles.make} {activeJob.vehicles.model} — {activeJob.vehicles.license_plate}</div>}
          <div style={{ fontSize:11, color:"#555", marginTop:2 }}>Status: {activeJob.concierge_status||activeJob.status}</div>
          <div style={{ fontSize:11, color:"#1d9e75", marginTop:6 }}>Go to Active Delivery to continue →</div>
        </div>
      )}

      {/* Today stats */}
      <div style={{ fontFamily:"Syne", fontSize:13, fontWeight:700, color:"#555", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:8 }}>Today</div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10, marginBottom:"1.5rem" }}>
        {[
          { label:"Jobs", value:todayStats.jobs, color:"#378add" },
          { label:"Earnings", value:`KES ${Number(todayStats.earnings).toLocaleString()}`, color:"#1d9e75" },
          { label:"Rating", value:todayStats.rating, color:"#e6821e" },
        ].map(s=>(
          <div key={s.label} style={{ background:"#111", borderRadius:10, padding:"1rem", border:"1px solid #1e1e1e", textAlign:"center" }}>
            <div style={{ fontFamily:"Syne", fontSize:isMobile?16:20, fontWeight:800, color:s.color }}>{s.value}</div>
            <div style={{ fontSize:10, color:"#555", marginTop:2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* This week stats */}
      <div style={{ fontFamily:"Syne", fontSize:13, fontWeight:700, color:"#555", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:8 }}>This week</div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:"1.5rem" }}>
        {[
          { label:"Total jobs", value:weekStats.jobs, color:"#8b5cf6" },
          { label:"Total earnings", value:`KES ${Number(weekStats.earnings).toLocaleString()}`, color:"#1d9e75" },
        ].map(s=>(
          <div key={s.label} style={{ background:"#111", borderRadius:10, padding:"1rem", border:"1px solid #1e1e1e", textAlign:"center" }}>
            <div style={{ fontFamily:"Syne", fontSize:isMobile?16:20, fontWeight:800, color:s.color }}>{s.value}</div>
            <div style={{ fontSize:10, color:"#555", marginTop:2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Quick tips */}
      <div style={{ background:"#111", border:"1px solid #1e1e1e", borderRadius:12, padding:"1rem" }}>
        <div style={{ fontFamily:"Syne", fontSize:13, fontWeight:700, color:"#f0ede6", marginBottom:10 }}>Quick reminders</div>
        {[
          { icon:"📋", text:"Always complete pickup and dropoff condition reports" },
          { icon:"📍", text:"Share your location when on an active job" },
          { icon:"🚗", text:"Never use customer vehicles for personal errands" },
          { icon:"⭐", text:"Professional conduct earns better ratings and more jobs" },
        ].map(tip=>(
          <div key={tip.text} style={{ display:"flex", gap:10, alignItems:"flex-start", marginBottom:8 }}>
            <span style={{ fontSize:14, flexShrink:0 }}>{tip.icon}</span>
            <span style={{ fontSize:12, color:"#666", lineHeight:1.5 }}>{tip.text}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
