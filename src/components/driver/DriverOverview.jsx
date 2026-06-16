import { useState, useEffect, useRef } from "react"
import { supabase } from "../../lib/supabase"
import { getCurrentPosition } from "../../lib/geolocation"
import { useAuth } from "../../contexts/AuthContext"
import useIsMobile from "../../lib/useIsMobile"
import toast from "react-hot-toast"

const VEHICLE_CONFIG = {
  car:        { icon:"🚗", label:"Concierge Driver",  color:"#1d9e75", desc:"Vehicle pickup and delivery" },
  motorcycle: { icon:"🏍️", label:"Boda Boda Rider",   color:"#e6821e", desc:"Fast parts and accessories delivery" },
  tuktuk:     { icon:"🛺", label:"Tuktuk Driver",      color:"#378add", desc:"Local area parts delivery" },
  van:        { icon:"🚐", label:"Van Driver",          color:"#8b5cf6", desc:"Bulk parts and large item delivery" },
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
    return () => { supabase.removeChannel(sub); if (locationIntervalRef.current) clearInterval(locationIntervalRef.current) }
  }, [user])

  async function load() {
    await Promise.all([loadStatus(), loadActiveJob(), loadStats(), loadPenalties()])
    setLoading(false)
  }

  async function loadStatus() {
    const { data } = await supabase.from("driver_status").select("*").eq("driver_id", user.id).maybeSingle()
    setDriverStatus(data)
    if (data?.is_online) startLocationSharing()
  }

  async function loadActiveJob() {
    const { data } = await supabase.from("bookings").select("*, vehicles(make,model,license_plate)").eq("driver_id", user.id).not("status","in","(completed,cancelled)").maybeSingle()
    setActiveJob(data)
  }

  async function loadStats() {
    const today = new Date().toISOString().split("T")[0]
    const weekAgo = new Date(Date.now()-7*24*60*60*1000).toISOString().split("T")[0]
    const { data: allJobs } = await supabase.from("bookings").select("booking_date,driver_earnings,status").eq("driver_id", user.id).eq("status","completed")
    const todayJobs = (allJobs||[]).filter(j=>j.booking_date===today)
    const weekJobs = (allJobs||[]).filter(j=>j.booking_date>=weekAgo)
    setTodayStats({ jobs:todayJobs.length, earnings:todayJobs.reduce((s,j)=>s+Number(j.driver_earnings||0),0), rating:"—" })
    setWeekStats({ jobs:weekJobs.length, earnings:weekJobs.reduce((s,j)=>s+Number(j.driver_earnings||0),0) })
  }

  async function loadPenalties() {
    const { data } = await supabase.from("driver_penalties").select("*").eq("driver_id", user.id).eq("is_active", true)
    setPenalties(data||[])
  }

  async function updateLocation(lat, lng) {
    try {
      await supabase.from("driver_status").upsert({ driver_id:user.id, current_latitude:lat, current_longitude:lng, last_location_updated:new Date().toISOString(), updated_at:new Date().toISOString() }, { onConflict:"driver_id" })
      await supabase.from("profiles").update({ latitude:lat, longitude:lng }).eq("id", user.id)
    } catch(err) { console.error("Location update failed:", err) }
  }

  function startLocationSharing() {
    if (locationIntervalRef.current) clearInterval(locationIntervalRef.current)
    locationIntervalRef.current = setInterval(() => {
      getCurrentPosition().then(async pos => {
        await supabase.from("driver_status").update({ current_latitude:pos.latitude, current_longitude:pos.longitude, last_seen:new Date().toISOString() }).eq("driver_id", user.id)
      }).catch(err => console.warn("Location update failed:", err.message))
    }, 30000)
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
      await supabase.from("driver_status").upsert({ driver_id:user.id, is_online:newStatus, last_seen:new Date().toISOString() }, { onConflict:"driver_id" })
      setDriverStatus(s=>({...s, is_online:newStatus}))
      if (newStatus) startLocationSharing()
      else if (locationIntervalRef.current) clearInterval(locationIntervalRef.current)
      toast.success(newStatus?"You are now ONLINE 🟢":"You are now OFFLINE 🔴")
    } catch(err) { toast.error(err.message) }
    finally { setToggling(false) }
  }

  const isOnline = driverStatus?.is_online
  const isVerified = profile?.documents_verified
  const isSuspended = driverStatus?.is_suspended
  const noShowCount = driverStatus?.no_show_count||0
  const vehicleType = profile?.driver_vehicle_type || "car"
  const vehicleConfig = VEHICLE_CONFIG[vehicleType] || VEHICLE_CONFIG.car

  if (loading) return <div style={{ color:"#888", fontSize:13, padding:"2rem", textAlign:"center" }}>Loading...</div>

  return (
    <div style={{ margin:"-1rem", fontFamily:"DM Sans,sans-serif" }}>
      {/* Style 1 header */}
      <div style={{ background:isSuspended?"#e24b4a":isOnline?vehicleConfig.color:"#000", padding:"1.25rem 1.25rem 2.5rem", transition:"background 0.3s" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
          <div>
            <div style={{ fontSize:11, color:"rgba(255,255,255,0.7)", marginBottom:2 }}>
              {new Date().toLocaleDateString("en-KE",{weekday:"long",day:"numeric",month:"long"})}
            </div>
            <div style={{ fontFamily:"Syne", fontSize:18, fontWeight:800, color:"#fff" }}>
              {profile?.first_name} {profile?.last_name}
            </div>
            <div style={{ fontSize:11, color:"rgba(255,255,255,0.8)", marginTop:2 }}>
              {vehicleConfig.icon} {vehicleConfig.label}
              {profile?.is_verified&&<span style={{ marginLeft:8, background:"rgba(255,255,255,0.2)", borderRadius:10, padding:"1px 8px", fontSize:10 }}>✓ Verified</span>}
            </div>
          </div>
          <button onClick={toggleOnline} disabled={toggling||!isVerified||isSuspended}
            style={{ background:isOnline?"rgba(255,255,255,0.2)":"#e6821e", border:"none", borderRadius:20, color:"#fff", fontSize:12, fontWeight:700, padding:"8px 16px", cursor:!isVerified||toggling||isSuspended?"not-allowed":"pointer", fontFamily:"Syne,sans-serif", opacity:!isVerified||isSuspended?0.6:1 }}>
            {toggling?"...":(isSuspended?"SUSPENDED":isOnline?"● Go Offline":"○ Go Online")}
          </button>
        </div>
        {isOnline&&(
          <div style={{ marginTop:8, fontSize:10, color:"rgba(255,255,255,0.7)", display:"flex", alignItems:"center", gap:6 }}>
            <div style={{ width:5, height:5, borderRadius:"50%", background:"#fff" }}/>
            Location sharing active · Receiving job requests
          </div>
        )}
      </div>

      {/* Floating stats card */}
      <div style={{ margin:"-1.25rem 1rem 1rem", background:"#fff", borderRadius:16, padding:"1rem", boxShadow:"0 4px 20px rgba(0,0,0,0.08)", border:"1px solid #f0f0f0" }}>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:8 }}>
          {[
            { label:"Today jobs", value:todayStats.jobs, icon:"📅", color:"#378add" },
            { label:"Today earnings", value:`KES ${Number(todayStats.earnings).toLocaleString()}`, icon:"💵", color:"#1d9e75" },
            { label:"Week jobs", value:weekStats.jobs, icon:"📊", color:"#8b5cf6" },
            { label:"Week earnings", value:`KES ${Number(weekStats.earnings).toLocaleString()}`, icon:"💰", color:"#e6821e" },
          ].map(s=>(
            <div key={s.label} style={{ background:"#f8f8f8", borderRadius:10, padding:"0.75rem", display:"flex", alignItems:"center", gap:8 }}>
              <div style={{ fontSize:20 }}>{s.icon}</div>
              <div>
                <div style={{ fontFamily:"Syne", fontSize:15, fontWeight:800, color:s.color }}>{s.value}</div>
                <div style={{ fontSize:10, color:"#888" }}>{s.label}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding:"0 1rem" }}>
        {/* Suspension banner */}
        {isSuspended&&(
          <div style={{ background:"#fff5f5", border:"2px solid #e24b4a", borderRadius:12, padding:"1rem", marginBottom:"1rem" }}>
            <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:800, color:"#e24b4a", marginBottom:4 }}>🚫 Account suspended</div>
            <div style={{ fontSize:12, color:"#555", marginBottom:4 }}>
              {driverStatus?.suspension_expires_at ? `Suspended until: ${new Date(driverStatus.suspension_expires_at).toLocaleString()}` : "You have been permanently suspended."}
            </div>
            <div style={{ fontSize:11, color:"#888" }}>Contact support if you believe this is an error.</div>
          </div>
        )}

        {/* No-show warning */}
        {noShowCount>0&&!isSuspended&&(
          <div style={{ background:"#fff8f0", border:"1px solid #e6821e40", borderRadius:10, padding:"0.85rem", marginBottom:"1rem" }}>
            <div style={{ fontSize:13, color:"#e6821e", fontWeight:600, marginBottom:2 }}>⚠️ No-show warning</div>
            <div style={{ fontSize:11, color:"#666" }}>
              You have {noShowCount} no-show{noShowCount>1?"s":""} recorded.
              {noShowCount===1&&" One more will result in a 72hr suspension."}
              {noShowCount>=2&&" Next no-show will result in permanent ban."}
            </div>
          </div>
        )}

        {/* Docs not verified */}
        {!isVerified&&!isSuspended&&(
          <div style={{ background:"#fff8f0", border:"1px solid #e6821e40", borderRadius:10, padding:"0.85rem", marginBottom:"1rem" }}>
            <div style={{ fontSize:12, color:"#e6821e" }}>⚠️ Documents pending verification — go to Profile → Credentials</div>
          </div>
        )}

        {/* Active job */}
        {activeJob&&(
          <div style={{ background:"#eff6ff", border:"1px solid #378add40", borderRadius:12, padding:"1rem", marginBottom:"1rem" }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
              <div style={{ width:8, height:8, borderRadius:"50%", background:"#378add" }}/>
              <div style={{ fontFamily:"Syne", fontSize:13, fontWeight:700, color:"#378add" }}>Active job</div>
            </div>
            <div style={{ fontSize:13, color:"#000", marginBottom:4 }}>{activeJob.service_name}</div>
            {activeJob.vehicles&&<div style={{ fontSize:11, color:"#888" }}>🚗 {activeJob.vehicles.make} {activeJob.vehicles.model} — {activeJob.vehicles.license_plate}</div>}
            <div style={{ fontSize:11, color:"#888", marginTop:2 }}>Status: {activeJob.concierge_status?.replace("_"," ")||activeJob.status}</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginTop:8 }}>
              <div style={{ background:"#fff", borderRadius:8, padding:"0.6rem", textAlign:"center" }}>
                <div style={{ fontSize:10, color:"#888" }}>Earnings</div>
                <div style={{ fontSize:13, color:"#1d9e75", fontWeight:700 }}>KES {(Number(activeJob.total_amount||0)*0.15).toFixed(0)}</div>
              </div>
              <div style={{ background:"#fff", borderRadius:8, padding:"0.6rem", textAlign:"center" }}>
                <div style={{ fontSize:10, color:"#888" }}>Allowance</div>
                <div style={{ fontSize:13, color:"#e6821e", fontWeight:700 }}>KES {Number(activeJob.transport_allowance||200).toLocaleString()}</div>
              </div>
            </div>
            <div style={{ fontSize:11, color:"#378add", marginTop:8, textAlign:"center" }}>Go to Active Delivery to continue →</div>
          </div>
        )}

        {/* Earnings structure */}
        <div style={{ background:"#f8f8f8", borderRadius:12, padding:"1rem", marginBottom:"1rem" }}>
          <div style={{ fontFamily:"Syne", fontSize:13, fontWeight:700, color:"#1d9e75", marginBottom:10 }}>💰 Your earnings structure</div>
          {[
            { icon:"💵", label:"Commission", desc:"15% of service fee per delivery" },
            { icon:"🚌", label:"Transport allowance", desc:"KES 200 per booking — covers your travel costs" },
            { icon:"⚠️", label:"No-show policy", desc:"Allowance only paid after pickup report filed. No-shows result in penalties." },
            { icon:"🔒", label:"Payment security", desc:"Earnings released only after delivery is completed and confirmed" },
          ].map(item=>(
            <div key={item.label} style={{ display:"flex", gap:10, alignItems:"flex-start", marginBottom:8 }}>
              <span style={{ fontSize:16, flexShrink:0 }}>{item.icon}</span>
              <div>
                <div style={{ fontSize:12, color:"#000", fontWeight:600 }}>{item.label}</div>
                <div style={{ fontSize:11, color:"#888", lineHeight:1.4 }}>{item.desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Active penalties */}
        {penalties.length>0&&(
          <div style={{ background:"#fff5f5", border:"1px solid #e24b4a30", borderRadius:12, padding:"1rem" }}>
            <div style={{ fontFamily:"Syne", fontSize:13, fontWeight:700, color:"#e24b4a", marginBottom:8 }}>Active penalties</div>
            {penalties.map(p=>(
              <div key={p.id} style={{ display:"flex", justifyContent:"space-between", padding:"6px 0", borderBottom:"0.5px solid #fee2e2", fontSize:12 }}>
                <span style={{ color:"#e24b4a" }}>{p.penalty_type?.replace("_"," ")}</span>
                <span style={{ color:"#888" }}>{p.reason}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
