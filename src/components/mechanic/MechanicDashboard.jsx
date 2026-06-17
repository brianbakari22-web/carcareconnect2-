import { useState, useEffect } from "react"
import { useMechanicAuth } from "../../contexts/MechanicAuthContext"
import { supabase } from "../../lib/supabase"
import { getCurrentPosition } from "../../lib/geolocation"
import { openExternal } from "../../lib/openExternal"
import toast from "react-hot-toast"

export default function MechanicDashboard() {
  const { mechanic, logoutMechanic } = useMechanicAuth()
  const [tab, setTab] = useState("jobs")
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeJob, setActiveJob] = useState(null)
  const [sharing, setSharing] = useState(false)
  const [available, setAvailable] = useState(mechanic?.is_available ?? true)
  const [locationInterval, setLocationInterval] = useState(null)

  useEffect(() => {
    if (mechanic) {
      load()
      const sub = supabase.channel("mechanic-jobs-" + mechanic.mechanic_id)
        .on("postgres_changes", { event:"*", schema:"public", table:"bookings",
          filter:"assigned_mechanic_id=eq." + mechanic.mechanic_id }, () => load())
        .subscribe()
      return () => { supabase.removeChannel(sub); stopSharing() }
    }
  }, [mechanic])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from("bookings")
      .select("*, services(name), profiles!bookings_customer_id_fkey(first_name,last_name), profile_sensitive!bookings_customer_id_fkey(phone)")
      .eq("assigned_mechanic_id", mechanic.mechanic_id)
      .in("status", ["confirmed","in_progress","pending"])
      .order("booking_date", { ascending: true })
    setJobs(data||[])
    // Find active job
    const active = (data||[]).find(j=>j.status==="in_progress")
    if (active) setActiveJob(active)
    setLoading(false)
  }

  async function updateJobStatus(jobId, status) {
    await supabase.from("bookings").update({ status, updated_at: new Date().toISOString() }).eq("id", jobId)
    toast.success("Job status updated to " + status)
    load()
    if (status === "in_progress") {
      setActiveJob(jobs.find(j=>j.id===jobId))
      startSharing()
    }
    if (status === "completed") {
      setActiveJob(null)
      stopSharing()
    }
  }

  async function toggleAvailability() {
    const newVal = !available
    await supabase.from("mechanics").update({ is_available: newVal }).eq("id", mechanic.mechanic_id)
    setAvailable(newVal)
    toast.success(newVal ? "You are now available" : "You are now unavailable")
  }

  async function startSharing() {
    setSharing(true)
    const interval = setInterval(async() => {
      try {
        const pos = await getCurrentPosition()
        await supabase.from("mechanics").update({
          current_latitude: pos.latitude,
          current_longitude: pos.longitude,
          last_seen: new Date().toISOString()
        }).eq("id", mechanic.mechanic_id)
      } catch(e) { console.warn("Location error:", e.message) }
    }, 15000)
    setLocationInterval(interval)
  }

  function stopSharing() {
    if (locationInterval) { clearInterval(locationInterval); setLocationInterval(null) }
    setSharing(false)
  }

  function navigateToCustomer(job) {
    if (job.emergency_location_lat && job.emergency_location_lng) {
      openExternal("https://www.google.com/maps/dir/?api=1&destination=" + job.emergency_location_lat + "," + job.emergency_location_lng)
    } else {
      toast.error("Customer location not available")
    }
  }

  function callCustomer(job) {
    const phone = job.profile_sensitive?.phone
    if (phone) openExternal("tel:" + phone)
    else toast.error("Customer phone not available")
  }

  const STATUS_COLOR = { pending:"#e6821e", confirmed:"#378add", in_progress:"#8b5cf6", completed:"#1d9e75", cancelled:"#e24b4a" }

  if (loading) return <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"DM Sans,sans-serif" }}>Loading...</div>

  return (
    <div style={{ minHeight:"100vh", background:"#f8f8f8", fontFamily:"DM Sans,sans-serif", maxWidth:480, margin:"0 auto" }}>
      {/* Header */}
      <div style={{ background:"linear-gradient(135deg,#1d9e75,#0d7a5a)", padding:"1.25rem 1rem", color:"#fff" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <div style={{ fontFamily:"Syne", fontSize:18, fontWeight:800 }}>👨‍🔧 {mechanic?.mechanic_name}</div>
            <div style={{ fontSize:12, opacity:0.8, marginTop:2 }}>{mechanic?.business_name} · {mechanic?.specialization}</div>
          </div>
          <div style={{ display:"flex", gap:8, alignItems:"center" }}>
            <button onClick={toggleAvailability}
              style={{ background:available?"rgba(255,255,255,0.2)":"rgba(0,0,0,0.2)", border:"1px solid rgba(255,255,255,0.3)", borderRadius:20, color:"#fff", fontSize:11, fontWeight:700, padding:"4px 10px", cursor:"pointer" }}>
              {available?"🟢 Available":"🔴 Unavailable"}
            </button>
            <button onClick={()=>{ logoutMechanic(); window.location.href="/" }}
              style={{ background:"none", border:"1px solid rgba(255,255,255,0.3)", borderRadius:8, color:"#fff", fontSize:11, padding:"4px 10px", cursor:"pointer" }}>
              Sign out
            </button>
          </div>
        </div>
        {sharing&&(
          <div style={{ marginTop:8, background:"rgba(255,255,255,0.15)", borderRadius:8, padding:"6px 10px", fontSize:11 }}>
            📍 Sharing location with customer...
          </div>
        )}
      </div>

      {/* Active job banner */}
      {activeJob&&(
        <div style={{ background:"#8b5cf6", padding:"0.75rem 1rem", color:"#fff" }}>
          <div style={{ fontSize:12, fontWeight:700, marginBottom:4 }}>🔧 Active job: {activeJob.services?.name||activeJob.service_name}</div>
          <div style={{ display:"flex", gap:8 }}>
            <button onClick={()=>navigateToCustomer(activeJob)}
              style={{ background:"rgba(255,255,255,0.2)", border:"none", borderRadius:7, color:"#fff", fontSize:11, fontWeight:700, padding:"5px 12px", cursor:"pointer" }}>
              🗺️ Navigate
            </button>
            <button onClick={()=>callCustomer(activeJob)}
              style={{ background:"rgba(255,255,255,0.2)", border:"none", borderRadius:7, color:"#fff", fontSize:11, fontWeight:700, padding:"5px 12px", cursor:"pointer" }}>
              📞 Call customer
            </button>
            <button onClick={()=>updateJobStatus(activeJob.id,"completed")}
              style={{ background:"#1d9e75", border:"none", borderRadius:7, color:"#fff", fontSize:11, fontWeight:700, padding:"5px 12px", cursor:"pointer" }}>
              ✓ Complete job
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display:"flex", gap:0, background:"#ffffff", borderBottom:"1px solid #eeeeee" }}>
        {[{k:"jobs",l:"My Jobs"},{k:"history",l:"History"}].map(t=>(
          <button key={t.k} onClick={()=>setTab(t.k)}
            style={{ flex:1, background:"none", border:"none", borderBottom:tab===t.k?"2px solid #1d9e75":"2px solid transparent", color:tab===t.k?"#1d9e75":"#888", fontFamily:"Syne,sans-serif", fontSize:13, fontWeight:700, padding:"12px", cursor:"pointer" }}>
            {t.l}
          </button>
        ))}
      </div>

      {/* Jobs list */}
      <div style={{ padding:"1rem" }}>
        {jobs.length===0&&(
          <div style={{ textAlign:"center", padding:"3rem 1rem", color:"#888" }}>
            <div style={{ fontSize:40, marginBottom:12 }}>🔧</div>
            <div style={{ fontSize:14, fontWeight:600 }}>No assigned jobs yet</div>
            <div style={{ fontSize:12, marginTop:4 }}>Your garage manager will assign jobs to you</div>
          </div>
        )}
        {jobs.map(job=>(
          <div key={job.id} style={{ background:"#ffffff", border:"1px solid #eeeeee", borderRadius:12, padding:"1rem", marginBottom:10 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
              <div>
                <div style={{ fontSize:14, fontWeight:700, color:"#000" }}>{job.services?.name||job.service_name||"Service"}</div>
                <div style={{ fontSize:12, color:"#555", marginTop:2 }}>{job.profiles?.first_name} {job.profiles?.last_name}</div>
                <div style={{ fontSize:11, color:"#888", marginTop:2 }}>{job.booking_date} · {job.booking_time}</div>
              </div>
              <span style={{ fontSize:10, padding:"3px 8px", borderRadius:10, background:(STATUS_COLOR[job.status]||"#888")+"20", color:STATUS_COLOR[job.status]||"#888", fontWeight:700 }}>
                {job.status}
              </span>
            </div>
            {job.notes&&<div style={{ fontSize:11, color:"#666", background:"#f8f8f8", borderRadius:6, padding:"6px 8px", marginBottom:8 }}>📝 {job.notes}</div>}
            <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
              {job.status==="confirmed"&&(
                <button onClick={()=>updateJobStatus(job.id,"in_progress")}
                  style={{ background:"#8b5cf6", border:"none", borderRadius:7, color:"#fff", fontSize:11, fontWeight:700, padding:"6px 12px", cursor:"pointer" }}>
                  🔧 Start job
                </button>
              )}
              {job.status==="in_progress"&&(
                <>
                  <button onClick={()=>navigateToCustomer(job)}
                    style={{ background:"#378add", border:"none", borderRadius:7, color:"#fff", fontSize:11, fontWeight:700, padding:"6px 12px", cursor:"pointer" }}>
                    🗺️ Navigate
                  </button>
                  <button onClick={()=>callCustomer(job)}
                    style={{ background:"#1d9e75", border:"none", borderRadius:7, color:"#fff", fontSize:11, fontWeight:700, padding:"6px 12px", cursor:"pointer" }}>
                    📞 Call
                  </button>
                  <button onClick={()=>updateJobStatus(job.id,"completed")}
                    style={{ background:"#1d9e75", border:"none", borderRadius:7, color:"#fff", fontSize:11, fontWeight:700, padding:"6px 12px", cursor:"pointer" }}>
                    ✓ Complete
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
