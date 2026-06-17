import { useState, useEffect } from "react"
import { useMechanicAuth } from "../../contexts/MechanicAuthContext"
import { supabase } from "../../lib/supabase"
import { getCurrentPosition } from "../../lib/geolocation"
import { openExternal } from "../../lib/openExternal"
import toast from "react-hot-toast"
import AIAssistant from "../shared/AIAssistant"

export default function MechanicDashboard() {
  const { mechanic, logoutMechanic } = useMechanicAuth()
  const [tab, setTab] = useState("jobs")
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeJob, setActiveJob] = useState(null)
  const [sharing, setSharing] = useState(false)
  const [available, setAvailable] = useState(mechanic?.is_available ?? true)
  const [locationInterval, setLocationInterval] = useState(null)
  const [history, setHistory] = useState([])
  const [uploadingPhoto, setUploadingPhoto] = useState(null)
  const [sosLoading, setSosLoading] = useState(false)
  const [jobNotes, setJobNotes] = useState({})
  const [savingNotes, setSavingNotes] = useState(null)
  const [partsRequest, setPartsRequest] = useState(null)
  const [partForm, setPartForm] = useState({ part_name:"", quantity:1, urgency:"normal", notes:"" })
  const [jobTimers, setJobTimers] = useState({})
  const [timerInterval, setTimerInterval] = useState(null)
  const [chatJob, setChatJob] = useState(null)
  const [earnings, setEarnings] = useState({ today:0, week:0, month:0, total_jobs:0 })

  useEffect(() => {
    if (mechanic) {
      load()
      loadHistory()
      loadEarnings()
      const sub = supabase.channel("mechanic-jobs-" + mechanic.mechanic_id)
        .on("postgres_changes", { event:"*", schema:"public", table:"bookings",
          filter:"assigned_mechanic_id=eq." + mechanic.mechanic_id }, () => load())
        .subscribe()
      return () => { supabase.removeChannel(sub); stopSharing() }
    }
  }, [mechanic])

  async function loadHistory() {
    const { data } = await supabase.from("bookings")
      .select("*, services(name), profiles!bookings_customer_id_fkey(first_name,last_name)")
      .eq("assigned_mechanic_id", mechanic.mechanic_id)
      .in("status", ["completed","cancelled"])
      .order("updated_at", { ascending: false })
      .limit(20)
    setHistory(data||[])
  }

  async function uploadJobPhoto(jobId, type) {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = "image/*"
    input.onchange = async(e) => {
      const file = e.target.files[0]
      if (!file) return
      setUploadingPhoto(jobId + type)
      try {
        const ext = file.name.split(".").pop()
        const path = "job-photos/" + mechanic.mechanic_id + "/" + jobId + "-" + type + "-" + Date.now() + "." + ext
        const { error } = await supabase.storage.from("marketplace").upload(path, file, { upsert:true })
        if (error) throw error
        const { data } = supabase.storage.from("marketplace").getPublicUrl(path)
        await supabase.from("bookings").update({ 
          [type === "before" ? "pickup_photo_url" : "dropoff_photo_url"]: data.publicUrl 
        }).eq("id", jobId)
        toast.success(type + " photo uploaded!")
      } catch(err) { toast.error("Upload failed: " + err.message) }
      finally { setUploadingPhoto(null) }
    }
    input.click()
  }

  async function sendSOS() {
    setSosLoading(true)
    try {
      const pos = await getCurrentPosition().catch(() => null)
      await supabase.from("emergency_alerts").insert({
        user_id: null,
        user_name: mechanic.mechanic_name,
        user_role: "mechanic",
        latitude: pos?.latitude || null,
        longitude: pos?.longitude || null,
        status: "active",
        message: "MECHANIC SOS: " + mechanic.mechanic_name + " from " + mechanic.business_name
      })
      toast.success("SOS alert sent to admin!")
    } catch(err) { toast.error("SOS failed: " + err.message) }
    finally { setSosLoading(false) }
  }

  async function saveJobNotes(jobId) {
    setSavingNotes(jobId)
    try {
      await supabase.from("bookings").update({ mechanic_notes: jobNotes[jobId] }).eq("id", jobId)
      toast.success("Notes saved!")
    } catch(e) { toast.error("Failed to save notes") }
    finally { setSavingNotes(null) }
  }

  async function submitPartsRequest(job) {
    if (!partForm.part_name.trim()) return toast.error("Enter part name")
    try {
      await supabase.from("mechanic_parts_requests").insert({
        booking_id: job.id,
        mechanic_id: mechanic.mechanic_id,
        provider_id: mechanic.provider_id,
        part_name: partForm.part_name,
        quantity: partForm.quantity,
        urgency: partForm.urgency,
        notes: partForm.notes
      })
      // Notify garage owner
      await supabase.from("notifications").insert({
        user_id: mechanic.provider_id,
        title: "Parts request from mechanic",
        message: mechanic.mechanic_name + " needs " + partForm.quantity + "x " + partForm.part_name + " for booking #" + job.id.slice(0,8) + " (Urgency: " + partForm.urgency + ")",
        type: "info"
      })
      toast.success("Parts request sent to garage!")
      setPartsRequest(null)
      setPartForm({ part_name:"", quantity:1, urgency:"normal", notes:"" })
    } catch(e) { toast.error("Failed: " + e.message) }
  }

  async function loadEarnings() {
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
    const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()-7).toISOString()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    const { data } = await supabase.from("bookings")
      .select("provider_earnings, created_at, status")
      .eq("assigned_mechanic_id", mechanic.mechanic_id)
      .eq("status", "completed")
    if (data) {
      const all = data
      const today = all.filter(b => b.created_at >= todayStart)
      const week = all.filter(b => b.created_at >= weekStart)
      const month = all.filter(b => b.created_at >= monthStart)
      // Mechanic gets 15% of provider earnings if commission-based
      setEarnings({
        today: today.reduce((s,b) => s + Number(b.provider_earnings||0)*0.15, 0),
        week: week.reduce((s,b) => s + Number(b.provider_earnings||0)*0.15, 0),
        month: month.reduce((s,b) => s + Number(b.provider_earnings||0)*0.15, 0),
        total_jobs: all.length
      })
    }
  }

  function startJobTimer(jobId, startedAt) {
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000)
      setJobTimers(prev => ({ ...prev, [jobId]: elapsed }))
    }, 1000)
    setTimerInterval(interval)
  }

  function formatTimer(seconds) {
    if (!seconds) return "00:00"
    const h = Math.floor(seconds/3600)
    const m = Math.floor((seconds%3600)/60)
    const s = seconds%60
    if (h > 0) return h + "h " + String(m).padStart(2,"0") + "m"
    return String(m).padStart(2,"0") + ":" + String(s).padStart(2,"0")
  }

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
      const startedAt = new Date().toISOString()
      await supabase.from("bookings").update({ mechanic_started_at: startedAt }).eq("id", jobId)
      setActiveJob(jobs.find(j=>j.id===jobId))
      startSharing()
      startJobTimer(jobId, startedAt)
    }
    if (status === "completed") {
      await supabase.from("bookings").update({ mechanic_completed_at: new Date().toISOString() }).eq("id", jobId)
      setActiveJob(null)
      stopSharing()
      if (timerInterval) { clearInterval(timerInterval); setTimerInterval(null) }
      loadEarnings()
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
        // Update mechanic current location
        await supabase.from("mechanics").update({
          current_latitude: pos.latitude,
          current_longitude: pos.longitude,
          last_seen: new Date().toISOString()
        }).eq("id", mechanic.mechanic_id)
        // Insert into location history for real-time customer tracking
        if (activeJob) {
          await supabase.from("mechanic_location_history").insert({
            mechanic_id: mechanic.mechanic_id,
            booking_id: activeJob.id,
            latitude: pos.latitude,
            longitude: pos.longitude,
          })
        }
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
        {[{k:"jobs",l:"My Jobs"},{k:"earnings",l:"💰 Earnings"},{k:"history",l:"History"},{k:"sos",l:"🆘 SOS"}].map(t=>(
          <button key={t.k} onClick={()=>setTab(t.k)}
            style={{ flex:1, background:"none", border:"none", borderBottom:tab===t.k?"2px solid #1d9e75":"2px solid transparent", color:tab===t.k?"#1d9e75":"#888", fontFamily:"Syne,sans-serif", fontSize:13, fontWeight:700, padding:"12px", cursor:"pointer" }}>
            {t.l}
          </button>
        ))}
      </div>

      {/* Earnings Tab */}
      {tab==="earnings"&&(
        <div style={{ padding:"1rem" }}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:"1rem" }}>
            {[
              { label:"Today", value:earnings.today, color:"#1d9e75" },
              { label:"This week", value:earnings.week, color:"#378add" },
              { label:"This month", value:earnings.month, color:"#8b5cf6" },
              { label:"Total jobs", value:earnings.total_jobs, color:"#e6821e", isCount:true },
            ].map(stat=>(
              <div key={stat.label} style={{ background:"#ffffff", border:"1px solid #eeeeee", borderRadius:12, padding:"1rem", textAlign:"center" }}>
                <div style={{ fontSize:11, color:"#888", marginBottom:4 }}>{stat.label}</div>
                <div style={{ fontFamily:"Syne", fontSize:18, fontWeight:800, color:stat.color }}>
                  {stat.isCount ? stat.value : "KES " + Math.round(stat.value).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
          <div style={{ background:"#fff8f0", border:"1px solid #e6821e30", borderRadius:10, padding:"1rem", fontSize:12, color:"#555" }}>
            💡 Earnings shown are estimated (15% of completed job value). Actual payout depends on your agreement with your garage manager.
          </div>
        </div>
      )}

      {/* SOS Tab */}
      {tab==="sos"&&(
        <div style={{ padding:"1rem" }}>
          <div style={{ background:"#fff5f5", border:"1px solid #e24b4a30", borderRadius:12, padding:"1.5rem", textAlign:"center", marginBottom:"1rem" }}>
            <div style={{ fontSize:40, marginBottom:12 }}>🆘</div>
            <div style={{ fontFamily:"Syne", fontSize:16, fontWeight:800, color:"#e24b4a", marginBottom:8 }}>Emergency SOS</div>
            <div style={{ fontSize:12, color:"#555", marginBottom:16, lineHeight:1.6 }}>
              Use this if you are in danger or need immediate assistance. Admin will be notified with your location.
            </div>
            <button onClick={sendSOS} disabled={sosLoading}
              style={{ background:sosLoading?"#555":"#e24b4a", border:"none", borderRadius:12, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:16, fontWeight:800, padding:"16px 32px", cursor:sosLoading?"not-allowed":"pointer", width:"100%" }}>
              {sosLoading?"Sending SOS...":"🆘 SEND SOS ALERT"}
            </button>
          </div>
          <div style={{ background:"#f8f8f8", borderRadius:10, padding:"1rem", fontSize:12, color:"#555", lineHeight:1.8 }}>
            <div style={{ fontWeight:700, marginBottom:6 }}>Emergency contacts:</div>
            <div>Police: <a href="tel:999" style={{ color:"#e24b4a" }}>999</a></div>
            <div>NTSA: <a href="tel:0800723573" style={{ color:"#e24b4a" }}>0800 723 573</a></div>
            <div>CCC Admin: <a href="tel:0113858966" style={{ color:"#1d9e75" }}>0113 858 966</a></div>
          </div>
        </div>
      )}

      {/* Jobs list extras - notes, timer, parts */}
      {tab==="jobs"&&jobs.map(job=>(
        <div key={job.id+"extras"} style={{ marginTop:-2, padding:"0 1rem 1rem" }}>
          {/* Job timer */}
          {job.status==="in_progress"&&jobTimers[job.id]&&(
            <div style={{ background:"#f5f3ff", borderRadius:8, padding:"8px 12px", display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
              <span>⏱️</span>
              <span style={{ fontFamily:"Syne", fontSize:14, fontWeight:800, color:"#8b5cf6" }}>{formatTimer(jobTimers[job.id])}</span>
              <span style={{ fontSize:11, color:"#888" }}>on this job</span>
            </div>
          )}
          {/* Job notes */}
          <textarea value={jobNotes[job.id]||job.mechanic_notes||""}
            onChange={e=>setJobNotes(prev=>({...prev,[job.id]:e.target.value}))}
            placeholder="Add notes about this job..." rows={2}
            style={{ width:"100%", background:"#f8f8f8", border:"1px solid #eeeeee", borderRadius:8, padding:"8px 10px", fontSize:11, color:"#000", outline:"none", resize:"none", boxSizing:"border-box" }}/>
          <button onClick={()=>saveJobNotes(job.id)} disabled={savingNotes===job.id}
            style={{ marginTop:4, background:savingNotes===job.id?"#555":"#378add", border:"none", borderRadius:6, color:"#fff", fontSize:10, fontWeight:700, padding:"4px 12px", cursor:"pointer" }}>
            {savingNotes===job.id?"Saving...":"💾 Save notes"}
          </button>
          {/* Parts request */}
          {partsRequest===job.id&&(
            <div style={{ marginTop:8, background:"#fff8f0", border:"1px solid #e6821e30", borderRadius:8, padding:"0.75rem" }}>
              <div style={{ fontSize:12, fontWeight:700, color:"#e6821e", marginBottom:8 }}>🔩 Request Parts</div>
              <input value={partForm.part_name} onChange={e=>setPartForm(f=>({...f,part_name:e.target.value}))}
                placeholder="Part name (e.g. Oil filter, Brake pad)"
                style={{ width:"100%", background:"#fff", border:"1px solid #eeeeee", borderRadius:6, padding:"7px 10px", fontSize:12, color:"#000", outline:"none", marginBottom:6, boxSizing:"border-box" }}/>
              <div style={{ display:"flex", gap:6, marginBottom:6 }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:10, color:"#888", marginBottom:2 }}>Qty</div>
                  <input type="number" min="1" value={partForm.quantity} onChange={e=>setPartForm(f=>({...f,quantity:Number(e.target.value)}))}
                    style={{ width:"100%", background:"#fff", border:"1px solid #eeeeee", borderRadius:6, padding:"7px 10px", fontSize:12, color:"#000", outline:"none", boxSizing:"border-box" }}/>
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:10, color:"#888", marginBottom:2 }}>Urgency</div>
                  <select value={partForm.urgency} onChange={e=>setPartForm(f=>({...f,urgency:e.target.value}))}
                    style={{ width:"100%", background:"#fff", border:"1px solid #eeeeee", borderRadius:6, padding:"7px 10px", fontSize:12, color:"#000", outline:"none", boxSizing:"border-box" }}>
                    <option value="normal">Normal</option>
                    <option value="urgent">Urgent</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
              </div>
              <div style={{ display:"flex", gap:6 }}>
                <button onClick={()=>submitPartsRequest(job)}
                  style={{ flex:1, background:"#e6821e", border:"none", borderRadius:7, color:"#fff", fontSize:11, fontWeight:700, padding:"8px", cursor:"pointer" }}>
                  📤 Send Request
                </button>
                <button onClick={()=>setPartsRequest(null)}
                  style={{ background:"none", border:"1px solid #dddddd", borderRadius:7, color:"#888", fontSize:11, padding:"8px 12px", cursor:"pointer" }}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      ))}

      {/* History Tab */}
      {tab==="history"&&(
        <div style={{ padding:"1rem" }}>
          {history.length===0&&(
            <div style={{ textAlign:"center", padding:"3rem 1rem", color:"#888" }}>
              <div style={{ fontSize:40, marginBottom:12 }}>📋</div>
              <div style={{ fontSize:14, fontWeight:600 }}>No completed jobs yet</div>
            </div>
          )}
          {history.map(job=>(
            <div key={job.id} style={{ background:"#ffffff", border:"1px solid #eeeeee", borderRadius:12, padding:"1rem", marginBottom:10 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:6 }}>
                <div>
                  <div style={{ fontSize:13, fontWeight:700, color:"#000" }}>{job.services?.name||job.service_name}</div>
                  <div style={{ fontSize:11, color:"#555" }}>{job.profiles?.first_name} {job.profiles?.last_name}</div>
                  <div style={{ fontSize:10, color:"#888", marginTop:2 }}>{job.booking_date}</div>
                </div>
                <span style={{ fontSize:10, padding:"3px 8px", borderRadius:10, background:job.status==="completed"?"#f0fdf4":"#fff5f5", color:job.status==="completed"?"#1d9e75":"#e24b4a", fontWeight:700 }}>
                  {job.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

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
                  <button onClick={()=>uploadJobPhoto(job.id,"before")} disabled={uploadingPhoto===job.id+"before"}
                    style={{ background:"#555", border:"none", borderRadius:7, color:"#fff", fontSize:11, fontWeight:700, padding:"6px 12px", cursor:"pointer" }}>
                    {uploadingPhoto===job.id+"before"?"Uploading...":"📷 Before"}
                  </button>
                  <button onClick={()=>uploadJobPhoto(job.id,"after")} disabled={uploadingPhoto===job.id+"after"}
                    style={{ background:"#555", border:"none", borderRadius:7, color:"#fff", fontSize:11, fontWeight:700, padding:"6px 12px", cursor:"pointer" }}>
                    {uploadingPhoto===job.id+"after"?"Uploading...":"📷 After"}
                  </button>
                  <button onClick={()=>updateJobStatus(job.id,"completed")}
                    style={{ background:"#1d9e75", border:"none", borderRadius:7, color:"#fff", fontSize:11, fontWeight:700, padding:"6px 12px", cursor:"pointer" }}>
                    ✓ Complete
                  </button>
                  <button onClick={()=>setPartsRequest(partsRequest===job.id?null:job.id)}
                    style={{ background:"#fff8f0", border:"1px solid #e6821e40", borderRadius:7, color:"#e6821e", fontSize:11, fontWeight:700, padding:"6px 12px", cursor:"pointer" }}>
                    🔩 Parts
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
      {/* AI Assistant */}
      <AIAssistant role="mechanic" color="#1d9e75"/>
    </div>
  )
}
