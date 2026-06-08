import { useEffect, useState, useRef } from "react"
import { supabase } from "../../lib/supabase"
import { useAuth } from "../../contexts/AuthContext"
import useIsMobile from "../../lib/useIsMobile"
import toast from "react-hot-toast"

const VEHICLE_CONFIG = {
  car: { icon:"🚗", label:"Concierge Driver", color:"#1d9e75", desc:"Vehicle pickup and delivery", jobs:"Concierge jobs" },
  motorcycle: { icon:"🏍️", label:"Boda Boda Rider", color:"#e6821e", desc:"Fast parts and accessories delivery", jobs:"Delivery jobs" },
  tuktuk: { icon:"🛺", label:"Tuktuk Driver", color:"#378add", desc:"Local area parts delivery", jobs:"Delivery jobs" },
  van: { icon:"🚐", label:"Van Driver", color:"#8b5cf6", desc:"Bulk parts and large item delivery", jobs:"Delivery jobs" },
}

export default function DriverOverview() {
  const { user, profile } = useAuth()
  const isMobile = useIsMobile()
  const [driverStatus, setDriverStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState(false)
  const [activeJob, setActiveJob] = useState(null)
  const [todayStats, setTodayStats] = useState({ jobs:0, earnings:0, rating:"—" })
  const [weekStats, setWeekStats] = useState({ jobs:0, earnings:0 })
  const [penalties, setPenalties] = useState([])
  const locationIntervalRef = useRef(null)

  useEffect(() => {
    if (!user) return
    load()
    const sub = supabase.channel("driver-overview-live")
      .on("postgres_changes", { event:"*", schema:"public", table:"driver_status", filter:`driver_id=eq.${user.id}` }, () => loadStatus())
      .on("postgres_changes", { event:"*", schema:"public", table:"bookings", filter:`driver_id=eq.${user.id}` }, () => loadActiveJob())
      .subscribe()
    return () => {
      supabase.removeChannel(sub)
      if (locationIntervalRef.current) clearInterval(locationIntervalRef.current)
    }
  }, [user])

  useEffect(() => {
    if (driverStatus?.is_online) startLocationSharing()
    else if (locationIntervalRef.current) clearInterval(locationIntervalRef.current)
  }, [driverStatus?.is_online])

  async function load() {
    await Promise.all([loadStatus(), loadActiveJob(), loadStats(), loadPenalties()])
    setLoading(false)
  }

  async function loadStatus() {
    const { data } = await supabase.from("driver_status").select("*").eq("driver_id", user.id).maybeSingle()
    if (!data) {
      await supabase.from("driver_status").insert({ driver_id:user.id, is_online:false, no_show_count:0 })
      setDriverStatus({ is_online:false, no_show_count:0 })
    } else {
      // Check if suspension expired
      if (data.is_suspended && data.suspension_expires_at && new Date(data.suspension_expires_at) < new Date()) {
        await supabase.from("driver_status").update({ is_suspended:false, suspension_expires_at:null }).eq("driver_id", user.id)
        data.is_suspended = false
      }
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
      supabase.from("bookings").select("driver_earnings,transport_allowance").eq("driver_id",user.id).eq("status","completed").eq("booking_date",today),
      supabase.from("bookings").select("driver_earnings,transport_allowance").eq("driver_id",user.id).eq("status","completed").gte("booking_date",weekAgo),
      supabase.from("reviews").select("driver_rating").eq("driver_id",user.id).not("driver_rating","is",null),
    ])
    const todayEarnings = todayBks?.reduce((s,b)=>s+Number(b.driver_earnings||0)+Number(b.transport_allowance||0),0)||0
    const weekEarnings = weekBks?.reduce((s,b)=>s+Number(b.driver_earnings||0)+Number(b.transport_allowance||0),0)||0
    const avgRating = revs?.length?(revs.reduce((s,r)=>s+Number(r.driver_rating),0)/revs.length).toFixed(1):"—"
    setTodayStats({ jobs:todayBks?.length||0, earnings:todayEarnings, rating:avgRating })
    setWeekStats({ jobs:weekBks?.length||0, earnings:weekEarnings })
  }

  async function loadPenalties() {
    const { data } = await supabase.from("driver_penalties")
      .select("*").eq("driver_id", user.id).eq("is_active", true)
      .order("created_at", { ascending:false })
    setPenalties(data||[])
  }

  async function toggleOnline() {
    if (!profile?.documents_verified) return toast.error("Your documents must be verified before going online")
    if (driverStatus?.is_suspended) {
      const expires = driverStatus.suspension_expires_at ? new Date(driverStatus.suspension_expires_at).toLocaleString() : "permanently"
      return toast.error(`You are suspended until ${expires}`)
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
      toast.success(newStatus?"You are now ONLINE 🟢":"You are now OFFLINE 🔴")
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
  const isSuspended = driverStatus?.is_suspended
  const noShowCount = driverStatus?.no_show_count||0
  const vehicleType = profile?.driver_vehicle_type || "car"
  const vehicleConfig = VEHICLE_CONFIG[vehicleType] || VEHICLE_CONFIG.car
  const isDeliveryDriver = ["motorcycle","tuktuk","van"].includes(vehicleType)

  if (loading) return <div style={{ color:"#777777", fontSize:13 }}>Loading...</div>

  return (
    <div>
      {/* DRIVER IDENTITY HEADER */}
      <div style={{ background:`linear-gradient(135deg,#071a12,#111)`, border:`1px solid ${vehicleConfig.color}30`, borderRadius:16, padding:"1.25rem", marginBottom:"1.5rem", display:"flex", alignItems:"center", gap:16 }}>
        <div style={{ width:60, height:60, borderRadius:14, background:"#ffffff", border:`2px solid ${vehicleConfig.color}60`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:28, flexShrink:0 }}>
          {vehicleConfig.icon}
        </div>
        <div style={{ flex:1 }}>
          <div style={{ fontFamily:"Syne", fontSize:isMobile?15:18, fontWeight:800, color:"#000000", marginBottom:2 }}>
            {profile?.first_name} {profile?.last_name}
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
            <span style={{ fontSize:12, padding:"3px 10px", borderRadius:20, background:"#ffffff", color:vehicleConfig.color, border:`1px solid ${vehicleConfig.color}40`, fontWeight:600 }}>
              {vehicleConfig.icon} {vehicleConfig.label}
            </span>
            {profile?.is_verified&&<span style={{ fontSize:10, color:"#1d9e75", background:"#071a12", padding:"2px 8px", borderRadius:10 }}>✓ Verified</span>}
          </div>
          <div style={{ fontSize:11, color:"#777777", marginTop:4 }}>{vehicleConfig.desc}</div>
        </div>
      </div>

      {/* Suspension banner */}
      {isSuspended&&(
        <div style={{ background:"#1a0808", border:"2px solid #e24b4a", borderRadius:12, padding:"1rem", marginBottom:"1.5rem" }}>
          <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:800, color:"#e24b4a", marginBottom:4 }}>🚫 Account suspended</div>
          <div style={{ fontSize:12, color:"#555555", marginBottom:4 }}>
            {driverStatus?.suspension_expires_at
              ? `Suspended until: ${new Date(driverStatus.suspension_expires_at).toLocaleString()}`
              : "You have been permanently suspended."}
          </div>
          <div style={{ fontSize:11, color:"#777777" }}>Contact support if you believe this is an error.</div>
        </div>
      )}

      {/* Penalties warning */}
      {noShowCount>0&&!isSuspended&&(
        <div style={{ background:"#1a1208", border:"1px solid #e6821e40", borderRadius:10, padding:"0.9rem", marginBottom:"1.25rem" }}>
          <div style={{ fontSize:13, color:"#e6821e", fontWeight:600, marginBottom:2 }}>⚠️ No-show warning</div>
          <div style={{ fontSize:11, color:"#666" }}>
            You have {noShowCount} no-show{noShowCount>1?"s":""} recorded.
            {noShowCount===1&&" One more will result in a 72hr suspension."}
            {noShowCount>=2&&" Next no-show will result in permanent ban."}
          </div>
        </div>
      )}

      {/* Online/Offline toggle */}
      <div style={{ background:isOnline?"#071a12":isSuspended?"#1a0808":"#111", border:`2px solid ${isOnline?"#1d9e75":isSuspended?"#e24b4a":"#333"}`, borderRadius:16, padding:"1.5rem", marginBottom:"1.5rem", textAlign:"center", transition:"all 0.3s" }}>
        <div style={{ fontSize:isMobile?32:48, marginBottom:8 }}>{isSuspended?"🚫":isOnline?"🟢":"🔴"}</div>
        <div style={{ fontFamily:"Syne", fontSize:isMobile?20:26, fontWeight:800, color:isSuspended?"#e24b4a":isOnline?"#1d9e75":"#555", marginBottom:4 }}>
          {isSuspended?"SUSPENDED":isOnline?"You are ONLINE":"You are OFFLINE"}
        </div>
        <div style={{ fontSize:12, color:"#777777", marginBottom:"1.5rem" }}>
          {isSuspended?"Contact support to appeal your suspension":isOnline?"Visible to customers · Receiving job requests":isDeliveryDriver?"Toggle on to start receiving delivery jobs":"Toggle on to start receiving concierge jobs"}
        </div>

        {!isVerified&&!isSuspended&&(
          <div style={{ background:"#1a1208", border:"1px solid #e6821e40", borderRadius:10, padding:"0.75rem", marginBottom:"1.25rem" }}>
            <div style={{ fontSize:12, color:"#e6821e" }}>⚠️ Documents pending verification — go to Profile → Credentials</div>
          </div>
        )}

        <button onClick={toggleOnline} disabled={toggling||!isVerified||isSuspended}
          style={{
            background:isSuspended?"#1a0808":!isVerified?"#1a1a1a":isOnline?"#1a0808":"#071a12",
            border:`2px solid ${isSuspended?"#e24b4a":!isVerified?"#333":isOnline?"#e24b4a":"#1d9e75"}`,
            borderRadius:50, color:isSuspended?"#e24b4a":!isVerified?"#333":isOnline?"#e24b4a":"#1d9e75",
            fontFamily:"Syne,sans-serif", fontSize:isMobile?16:18, fontWeight:800,
            padding:isMobile?"14px 40px":"16px 56px", cursor:!isVerified||toggling||isSuspended?"not-allowed":"pointer",
            transition:"all 0.2s", letterSpacing:1,
          }}>
          {toggling?"...":(isSuspended?"SUSPENDED":isOnline?"GO OFFLINE":"GO ONLINE")}
        </button>

        {isOnline&&(
          <div style={{ fontSize:11, color:"#1d9e75", marginTop:12, display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
            <div style={{ width:6, height:6, borderRadius:"50%", background:"#1d9e75", boxShadow:"0 0 6px #1d9e75" }}/>
            Location sharing active
          </div>
        )}
      </div>

      {/* Active job */}
      {activeJob&&(
        <div style={{ background:"#0c1f2e", border:"1px solid #378add40", borderRadius:12, padding:"1rem", marginBottom:"1.5rem" }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
            <div style={{ width:8, height:8, borderRadius:"50%", background:"#378add", boxShadow:"0 0 6px #378add" }}/>
            <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:700, color:"#378add" }}>Active job</div>
          </div>
          <div style={{ fontSize:13, color:"#000000", marginBottom:4 }}>{activeJob.service_name}</div>
          {activeJob.vehicles&&<div style={{ fontSize:11, color:"#777777" }}>🚗 {activeJob.vehicles.make} {activeJob.vehicles.model} — {activeJob.vehicles.license_plate}</div>}
          <div style={{ fontSize:11, color:"#777777", marginTop:2 }}>Status: {activeJob.concierge_status?.replace("_"," ")||activeJob.status}</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginTop:8 }}>
            <div style={{ background:"#ffffff", borderRadius:8, padding:"0.6rem", textAlign:"center" }}>
              <div style={{ fontSize:10, color:"#777777" }}>Earnings</div>
              <div style={{ fontSize:13, color:"#1d9e75", fontWeight:700 }}>KES {(Number(activeJob.total_amount||0)*0.15).toFixed(0)}</div>
            </div>
            <div style={{ background:"#ffffff", borderRadius:8, padding:"0.6rem", textAlign:"center" }}>
              <div style={{ fontSize:10, color:"#777777" }}>Allowance</div>
              <div style={{ fontSize:13, color:"#e6821e", fontWeight:700 }}>KES {Number(activeJob.transport_allowance||200).toLocaleString()}</div>
            </div>
          </div>
          <div style={{ fontSize:11, color:"#378add", marginTop:8, textAlign:"center" }}>Go to Active Delivery to continue →</div>
        </div>
      )}

      {/* Transport allowance info */}
      <div style={{ background:"#ffffff", border:"1px solid #1d9e7520", borderRadius:12, padding:"1rem", marginBottom:"1.5rem" }}>
        <div style={{ fontFamily:"Syne", fontSize:13, fontWeight:700, color:"#1d9e75", marginBottom:8 }}>💰 Your earnings structure</div>
        {[
          { icon:"💵", label:"Commission", desc:"15% of service fee per delivery" },
          { icon:"🚌", label:"Transport allowance", desc:"KES 200 per booking — covers your travel costs" },
          { icon:"⚠️", label:"No-show policy", desc:"Allowance only paid after pickup report filed. No-shows result in penalties." },
          { icon:"🔒", label:"Payment security", desc:"Earnings released only after delivery is completed and confirmed" },
        ].map(item=>(
          <div key={item.label} style={{ display:"flex", gap:10, alignItems:"flex-start", marginBottom:8 }}>
            <span style={{ fontSize:16, flexShrink:0 }}>{item.icon}</span>
            <div>
              <div style={{ fontSize:12, color:"#000000", fontWeight:600 }}>{item.label}</div>
              <div style={{ fontSize:11, color:"#777777", lineHeight:1.4 }}>{item.desc}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Stats */}
      <div style={{ fontFamily:"Syne", fontSize:12, fontWeight:700, color:"#777777", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:8 }}>Today</div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10, marginBottom:"1.5rem" }}>
        {[
          { label:"Jobs", value:todayStats.jobs, color:"#378add" },
          { label:"Total earned", value:`KES ${Number(todayStats.earnings).toLocaleString()}`, color:"#1d9e75" },
          { label:"Rating", value:todayStats.rating, color:"#e6821e" },
        ].map(s=>(
          <div key={s.label} style={{ background:"#ffffff", borderRadius:10, padding:"0.9rem", border:"1px solid #eeeeee", textAlign:"center" }}>
            <div style={{ fontFamily:"Syne", fontSize:isMobile?14:18, fontWeight:800, color:s.color }}>{s.value}</div>
            <div style={{ fontSize:10, color:"#777777", marginTop:2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ fontFamily:"Syne", fontSize:12, fontWeight:700, color:"#777777", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:8 }}>This week</div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:"1.5rem" }}>
        {[
          { label:"Jobs", value:weekStats.jobs, color:"#8b5cf6" },
          { label:"Total earned", value:`KES ${Number(weekStats.earnings).toLocaleString()}`, color:"#1d9e75" },
        ].map(s=>(
          <div key={s.label} style={{ background:"#ffffff", borderRadius:10, padding:"0.9rem", border:"1px solid #eeeeee", textAlign:"center" }}>
            <div style={{ fontFamily:"Syne", fontSize:isMobile?14:18, fontWeight:800, color:s.color }}>{s.value}</div>
            <div style={{ fontSize:10, color:"#777777", marginTop:2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Active penalties */}
      {penalties.length>0&&(
        <div style={{ background:"#1a0808", border:"1px solid #e24b4a30", borderRadius:12, padding:"1rem" }}>
          <div style={{ fontFamily:"Syne", fontSize:13, fontWeight:700, color:"#e24b4a", marginBottom:8 }}>Active penalties</div>
          {penalties.map(p=>(
            <div key={p.id} style={{ display:"flex", justifyContent:"space-between", padding:"6px 0", borderBottom:"1px solid #2a1a1a", fontSize:12 }}>
              <span style={{ color:"#555555" }}>{p.penalty_type?.replace("_"," ")}</span>
              <span style={{ color:"#777777" }}>{p.reason}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}



