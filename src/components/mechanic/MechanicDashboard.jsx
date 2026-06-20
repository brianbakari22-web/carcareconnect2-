import { useState, useEffect, useRef } from "react"
import { useMechanicAuth } from "../../contexts/MechanicAuthContext"
import { supabase } from "../../lib/supabase"
import { getCurrentPosition } from "../../lib/geolocation"
import { openExternal } from "../../lib/openExternal"
import toast from "react-hot-toast"
import AIAssistant from "../shared/AIAssistant"
import ChatWindow from "../shared/ChatWindow"

const STATUS_COLOR = {
  pending: "#e6821e",
  confirmed: "#378add",
  in_progress: "#8b5cf6",
  completed: "#1d9e75",
  cancelled: "#e24b4a"
}

const URGENCY_COLOR = { normal:"#888", urgent:"#e6821e", critical:"#e24b4a" }

export default function MechanicDashboard() {
  const { mechanic, logoutMechanic } = useMechanicAuth()
  const [tab, setTab] = useState("jobs")
  const [jobs, setJobs] = useState([])
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeJob, setActiveJob] = useState(null)
  const [sharing, setSharing] = useState(false)
  const [available, setAvailable] = useState(mechanic?.is_available ?? true)
  const [locationInterval, setLocationInterval] = useState(null)
  const [uploadingPhoto, setUploadingPhoto] = useState(null)
  const [sosLoading, setSosLoading] = useState(false)
  const [jobNotes, setJobNotes] = useState({})
  const [savingNotes, setSavingNotes] = useState(null)
  const [partsRequest, setPartsRequest] = useState(null)
  const [partForm, setPartForm] = useState({ part_name:"", quantity:1, urgency:"normal", notes:"" })
  const [jobTimers, setJobTimers] = useState({})
  const [timerRef, setTimerRef] = useState(null)
  const [earnings, setEarnings] = useState({ today:0, week:0, month:0, total_jobs:0 })
  const [expandedJob, setExpandedJob] = useState(null)
  const [photos, setPhotos] = useState([])
  const [viewPhoto, setViewPhoto] = useState(null)
  const [docs, setDocs] = useState([])
  const [uploadingDoc, setUploadingDoc] = useState(null)
  const [chatJob, setChatJob] = useState(null)
  const [showGarageChat, setShowGarageChat] = useState(false)
  const [perfStats, setPerfStats] = useState({ avg_rating:0, total_ratings:0, avg_response_mins:0, completion_rate:0 })

  useEffect(() => {
    if (!mechanic) return
    load()
    loadHistory()
    loadEarnings()
    loadPerfStats()
    loadDocs()
    loadPhotos()
    const sub = supabase.channel("mechanic-jobs-" + mechanic.mechanic_id)
      .on("postgres_changes", { event:"*", schema:"public", table:"bookings",
        filter:"assigned_mechanic_id=eq." + mechanic.mechanic_id }, () => load())
      .subscribe()
    return () => { supabase.removeChannel(sub); stopSharing() }
  }, [mechanic])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from("bookings")
      .select("*, services(name), profiles!bookings_customer_id_fkey(first_name,last_name), profile_sensitive!bookings_customer_id_fkey(phone)")
      .eq("assigned_mechanic_id", mechanic.mechanic_id)
      .in("status", ["confirmed","in_progress","pending"])
      .order("booking_date", { ascending: true })
    setJobs(data||[])
    const active = (data||[]).find(j=>j.status==="in_progress")
    if (active) { setActiveJob(active); if (!timerRef) startJobTimer(active.id, active.mechanic_started_at||active.updated_at) }
    setLoading(false)
  }

  async function loadHistory() {
    const { data } = await supabase.from("bookings")
      .select("*, services(name), profiles!bookings_customer_id_fkey(first_name,last_name)")
      .eq("assigned_mechanic_id", mechanic.mechanic_id)
      .in("status", ["completed","cancelled"])
      .order("updated_at", { ascending: false })
      .limit(30)
    setHistory(data||[])
  }

  async function loadPhotos() {
    const { data } = await supabase.from("bookings")
      .select("id, service_name, services(name), booking_date, pickup_photo_url, dropoff_photo_url, profiles!bookings_customer_id_fkey(first_name,last_name)")
      .eq("assigned_mechanic_id", mechanic.mechanic_id)
      .or("pickup_photo_url.not.is.null,dropoff_photo_url.not.is.null")
      .order("created_at", { ascending: false })
      .limit(50)
    const allPhotos = []
    ;(data||[]).forEach(b => {
      if (b.pickup_photo_url) allPhotos.push({ url:b.pickup_photo_url, type:"Before", job:b })
      if (b.dropoff_photo_url) allPhotos.push({ url:b.dropoff_photo_url, type:"After", job:b })
    })
    setPhotos(allPhotos)
  }

  async function loadDocs() {
    const { data } = await supabase.from("driver_documents")
      .select("*")
      .eq("driver_id", mechanic.mechanic_id)
    setDocs(data||[])
  }

  async function uploadDoc(docType, label) {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = "image/*,.pdf"
    input.onchange = async(e) => {
      const file = e.target.files[0]
      if (!file) return
      if (file.size > 5*1024*1024) return toast.error("File must be under 5MB")
      setUploadingDoc(docType)
      try {
        const ext = file.name.split(".").pop()
        const path = "mechanic-docs/" + mechanic.mechanic_id + "/" + docType + "-" + Date.now() + "." + ext
        // Try upload with public bucket
        const { error } = await supabase.storage.from("provider-photos").upload(path, file, { upsert:true, contentType: file.type })
        if (error) throw error
        const { data } = supabase.storage.from("marketplace").getPublicUrl(path)
        // Upsert document record
        await supabase.from("driver_documents").upsert({
          driver_id: mechanic.mechanic_id,
          document_type: docType,
          document_url: data.publicUrl,
          status: "pending",
          uploaded_at: new Date().toISOString()
        }, { onConflict: "driver_id,document_type" })
        toast.success(label + " uploaded! Pending verification.")
        loadDocs()
      } catch(err) { toast.error("Upload failed: " + err.message) }
      finally { setUploadingDoc(null) }
    }
    input.click()
  }

  async function loadPerfStats() {
    try {
      const { data } = await supabase.from("bookings")
        .select("mechanic_rating, mechanic_started_at, created_at, status")
        .eq("assigned_mechanic_id", mechanic.mechanic_id)
      if (!data) return
      const rated = data.filter(b=>b.mechanic_rating>0)
      const completed = data.filter(b=>b.status==="completed")
      const avgRating = rated.length ? rated.reduce((s,b)=>s+b.mechanic_rating,0)/rated.length : 0
      const completionRate = data.length ? (completed.length/data.length)*100 : 0
      setPerfStats({
        avg_rating: Math.round(avgRating*10)/10,
        total_ratings: rated.length,
        completion_rate: Math.round(completionRate),
      })
    } catch(e) { console.warn("Perf stats error:", e.message) }
  }

  async function loadEarnings() {
    const { data } = await supabase.from("bookings")
      .select("provider_earnings, created_at")
      .eq("assigned_mechanic_id", mechanic.mechanic_id)
      .eq("status", "completed")
    if (!data) return
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
    const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()-7).toISOString()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    setEarnings({
      today: data.filter(b=>b.created_at>=todayStart).reduce((s,b)=>s+Number(b.provider_earnings||0)*0.15,0),
      week: data.filter(b=>b.created_at>=weekStart).reduce((s,b)=>s+Number(b.provider_earnings||0)*0.15,0),
      month: data.filter(b=>b.created_at>=monthStart).reduce((s,b)=>s+Number(b.provider_earnings||0)*0.15,0),
      total_jobs: data.length
    })
  }

  async function updateJobStatus(jobId, status) {
    await supabase.from("bookings").update({ status, updated_at: new Date().toISOString() }).eq("id", jobId)
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
      if (timerRef) { clearInterval(timerRef); setTimerRef(null) }
      loadEarnings()
      loadHistory()
    }
    toast.success("Job " + status.replace("_"," "))
    load()
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
        if (activeJob) {
          await supabase.from("mechanic_location_history").insert({
            mechanic_id: mechanic.mechanic_id,
            booking_id: activeJob.id,
            latitude: pos.latitude,
            longitude: pos.longitude,
          })
        }
      } catch(e) { console.warn("Location:", e.message) }
    }, 15000)
    setLocationInterval(interval)
  }

  function stopSharing() {
    if (locationInterval) { clearInterval(locationInterval); setLocationInterval(null) }
    setSharing(false)
  }

  function startJobTimer(jobId, startedAt) {
    if (timerRef) clearInterval(timerRef)
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000)
      setJobTimers(prev => ({ ...prev, [jobId]: elapsed }))
    }, 1000)
    setTimerRef(interval)
  }

  function formatTimer(seconds) {
    if (!seconds) return "00:00"
    const h = Math.floor(seconds/3600)
    const m = Math.floor((seconds%3600)/60)
    const s = seconds%60
    if (h > 0) return h + "h " + String(m).padStart(2,"0") + "m"
    return String(m).padStart(2,"0") + ":" + String(s).padStart(2,"0")
  }

  function navigateToCustomer(job) {
    if (job.emergency_location_lat && job.emergency_location_lng)
      openExternal("https://www.google.com/maps/dir/?api=1&destination=" + job.emergency_location_lat + "," + job.emergency_location_lng)
    else toast.error("Customer location not available")
  }

  function callCustomer(job) {
    const phone = job.profile_sensitive?.phone
    if (phone) openExternal("tel:" + phone)
    else toast.error("Customer phone not available")
  }

  async function saveJobNotes(jobId) {
    setSavingNotes(jobId)
    try {
      await supabase.from("bookings").update({ mechanic_notes: jobNotes[jobId] }).eq("id", jobId)
      toast.success("Notes saved!")
    } catch(e) { toast.error("Failed") }
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
      await supabase.from("notifications").insert({
        user_id: mechanic.provider_id,
        title: "Parts request 🔩",
        message: mechanic.mechanic_name + " needs " + partForm.quantity + "x " + partForm.part_name + " (Urgency: " + partForm.urgency + ")",
        type: "info"
      })
      toast.success("Parts request sent!")
      setPartsRequest(null)
      setPartForm({ part_name:"", quantity:1, urgency:"normal", notes:"" })
    } catch(e) { toast.error("Failed: " + e.message) }
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
        const { error } = await supabase.storage.from("provider-photos").upload(path, file, { upsert:true, contentType: file.type })
        if (error) throw error
        const { data } = supabase.storage.from("provider-photos").getPublicUrl(path)
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
        status: "active"
      })
      toast.success("SOS alert sent to admin!")
    } catch(err) { toast.error("SOS failed") }
    finally { setSosLoading(false) }
  }

  const TABS = [
    { k:"jobs", l:"Jobs", icon:"🔧" },
    { k:"earnings", l:"Earnings", icon:"💰" },
    { k:"stats", l:"Stats", icon:"⭐" },
    { k:"history", l:"History", icon:"📋" },
    { k:"photos", l:"Photos", icon:"📸" },
    { k:"manual", l:"Manual", icon:"📖" },
    { k:"parts", l:"Parts", icon:"🔩" },
    { k:"docs", l:"Docs", icon:"📄" },
    { k:"sos", l:"SOS", icon:"🆘" },
  ]

  if (loading && jobs.length === 0) return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"#f8f8f8", fontFamily:"DM Sans,sans-serif" }}>
      <div style={{ textAlign:"center" }}>
        <div style={{ fontSize:48, marginBottom:12 }}>👨‍🔧</div>
        <div style={{ fontSize:14, color:"#888" }}>Loading your jobs...</div>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight:"100vh", background:"#f8f8f8", fontFamily:"DM Sans,sans-serif", maxWidth:500, margin:"0 auto" }}>

      {/* Header */}
      <div style={{ background:"linear-gradient(135deg,#1d9e75,#0d7a5a)", padding:"1.25rem 1rem 1rem", position:"sticky", top:0, zIndex:100 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
          <div>
            <div style={{ fontFamily:"Syne", fontSize:16, fontWeight:800, color:"#fff" }}>👨‍🔧 {mechanic?.mechanic_name}</div>
            <div style={{ fontSize:11, color:"rgba(255,255,255,0.75)", marginTop:2 }}>{mechanic?.business_name}</div>
            <div style={{ fontSize:10, color:"rgba(255,255,255,0.6)", marginTop:1 }}>{mechanic?.specialization} · {mechanic?.mechanic_code}</div>
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:6, alignItems:"flex-end" }}>
            <button onClick={toggleAvailability}
              style={{ background:available?"rgba(255,255,255,0.2)":"rgba(0,0,0,0.3)", border:"1px solid rgba(255,255,255,0.3)", borderRadius:20, color:"#fff", fontSize:11, fontWeight:700, padding:"4px 12px", cursor:"pointer" }}>
              {available?"🟢 Available":"🔴 Unavailable"}
            </button>
            <button onClick={()=>setShowGarageChat(!showGarageChat)}
              style={{ background:"rgba(255,255,255,0.15)", border:"1px solid rgba(255,255,255,0.3)", borderRadius:8, color:"#fff", fontSize:10, fontWeight:700, padding:"3px 10px", cursor:"pointer" }}>
              💬 Garage
            </button>
            <button onClick={()=>{ logoutMechanic(); window.location.href="/" }}
              style={{ background:"none", border:"1px solid rgba(255,255,255,0.2)", borderRadius:8, color:"rgba(255,255,255,0.7)", fontSize:10, padding:"3px 10px", cursor:"pointer" }}>
              Sign out
            </button>
          </div>
        </div>

        {/* Stats row */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8 }}>
          {[
            { label:"Today's jobs", value:jobs.filter(j=>j.booking_date===new Date().toISOString().split("T")[0]).length },
            { label:"Total jobs", value:earnings.total_jobs },
            { label:"This month", value:"KES " + Math.round(earnings.month).toLocaleString() },
          ].map(s=>(
            <div key={s.label} style={{ background:"rgba(255,255,255,0.12)", borderRadius:8, padding:"8px 10px", textAlign:"center" }}>
              <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:800, color:"#fff" }}>{s.value}</div>
              <div style={{ fontSize:9, color:"rgba(255,255,255,0.65)", marginTop:2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Location sharing banner */}
        {sharing&&(
          <div style={{ marginTop:8, background:"rgba(255,255,255,0.12)", borderRadius:8, padding:"6px 10px", display:"flex", alignItems:"center", gap:6, fontSize:11, color:"#fff" }}>
            <span style={{ width:8, height:8, borderRadius:"50%", background:"#4ade80", display:"inline-block", boxShadow:"0 0 6px #4ade80" }}/>
            Sharing live location with customer
          </div>
        )}
      </div>

      {/* Active job banner */}
      {activeJob&&(
        <div style={{ background:"#7c3aed", padding:"0.75rem 1rem" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
            <div>
              <div style={{ fontSize:12, fontWeight:700, color:"#fff" }}>🔧 Active: {activeJob.services?.name||activeJob.service_name}</div>
              <div style={{ fontSize:10, color:"rgba(255,255,255,0.75)" }}>{activeJob.profiles?.first_name} {activeJob.profiles?.last_name}</div>
            </div>
            {jobTimers[activeJob.id]&&(
              <div style={{ fontFamily:"Syne", fontSize:18, fontWeight:800, color:"#c4b5fd" }}>
                {formatTimer(jobTimers[activeJob.id])}
              </div>
            )}
          </div>
          <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
            <button onClick={()=>navigateToCustomer(activeJob)}
              style={{ background:"rgba(255,255,255,0.15)", border:"1px solid rgba(255,255,255,0.2)", borderRadius:8, color:"#fff", fontSize:11, fontWeight:700, padding:"6px 12px", cursor:"pointer" }}>
              🗺️ Navigate
            </button>
            <button onClick={()=>callCustomer(activeJob)}
              style={{ background:"rgba(255,255,255,0.15)", border:"1px solid rgba(255,255,255,0.2)", borderRadius:8, color:"#fff", fontSize:11, fontWeight:700, padding:"6px 12px", cursor:"pointer" }}>
              📞 Call
            </button>
            <button onClick={()=>uploadJobPhoto(activeJob.id,"after")} disabled={uploadingPhoto===activeJob.id+"after"}
              style={{ background:"rgba(255,255,255,0.15)", border:"1px solid rgba(255,255,255,0.2)", borderRadius:8, color:"#fff", fontSize:11, fontWeight:700, padding:"6px 12px", cursor:"pointer" }}>
              {uploadingPhoto===activeJob.id+"after"?"⏳":"📸 After photo"}
            </button>
            <button onClick={()=>updateJobStatus(activeJob.id,"completed")}
              style={{ background:"#4ade80", border:"none", borderRadius:8, color:"#000", fontSize:11, fontWeight:800, padding:"6px 14px", cursor:"pointer" }}>
              ✓ Complete
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ background:"#ffffff", borderBottom:"1px solid #eeeeee", position:"sticky", top: activeJob ? 220 : 160, zIndex:99, overflowX:"auto", WebkitOverflowScrolling:"touch" }}>
        <div style={{ display:"flex", minWidth:"max-content", padding:"0 4px" }}>
          {TABS.map(t=>(
            <button key={t.k} onClick={()=>setTab(t.k)}
              style={{ background:"none", border:"none", borderBottom:tab===t.k?"2px solid #1d9e75":"2px solid transparent", color:tab===t.k?"#1d9e75":"#888", fontWeight:700, padding:"8px 12px", cursor:"pointer", fontFamily:"DM Sans,sans-serif", whiteSpace:"nowrap", minWidth:56 }}>
              <div style={{ fontSize:16 }}>{t.icon}</div>
              <div style={{ fontSize:9, marginTop:2 }}>{t.l}</div>
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding:"1rem" }}>

        {/* JOBS TAB */}
        {tab==="jobs"&&(
          <div>
            {jobs.length===0&&!loading&&(
              <div style={{ textAlign:"center", padding:"3rem 1rem" }}>
                <div style={{ fontSize:48, marginBottom:12 }}>🔧</div>
                <div style={{ fontSize:15, fontWeight:700, color:"#000", marginBottom:4 }}>No jobs assigned</div>
                <div style={{ fontSize:12, color:"#888" }}>Your garage manager will assign jobs to you here</div>
              </div>
            )}
            {jobs.map(job=>(
              <div key={job.id} style={{ background:"#ffffff", border:"1px solid " + (STATUS_COLOR[job.status]||"#eeeeee") + "40", borderRadius:14, marginBottom:12, overflow:"hidden", boxShadow:"0 1px 8px rgba(0,0,0,0.04)" }}>
                {/* Job header */}
                <div style={{ padding:"1rem", display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}
                  onClick={()=>setExpandedJob(expandedJob===job.id?null:job.id)}>
                  <div style={{ flex:1 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                      <span style={{ fontSize:10, padding:"2px 8px", borderRadius:10, background:(STATUS_COLOR[job.status]||"#888")+"20", color:STATUS_COLOR[job.status]||"#888", fontWeight:700 }}>
                        {job.status.replace("_"," ")}
                      </span>
                      {job.category==="go_service"&&<span style={{ fontSize:10, background:"#fff5f5", color:"#e24b4a", padding:"2px 6px", borderRadius:8, fontWeight:700 }}>🚨 Emergency</span>}
                    </div>
                    <div style={{ fontFamily:"Syne", fontSize:15, fontWeight:800, color:"#000", marginBottom:2 }}>{job.services?.name||job.service_name||"Service"}</div>
                    <div style={{ fontSize:12, color:"#555" }}>{job.profiles?.first_name} {job.profiles?.last_name}</div>
                    <div style={{ fontSize:11, color:"#888", marginTop:2 }}>📅 {job.booking_date} · {job.booking_time}</div>
                    {job.emergency_location_address&&<div style={{ fontSize:11, color:"#e6821e", marginTop:2 }}>📍 {job.emergency_location_address}</div>}
                  </div>
                  <div style={{ fontSize:16, color:"#888" }}>{expandedJob===job.id?"▲":"▼"}</div>
                </div>

                {/* Expanded content */}
                {expandedJob===job.id&&(
                  <div style={{ borderTop:"1px solid #f5f5f5", padding:"0.75rem 1rem" }}>
                    {/* Action buttons */}
                    <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:12 }}>
                      {job.status==="confirmed"&&(
                        <>
                          <button onClick={()=>uploadJobPhoto(job.id,"before")} disabled={uploadingPhoto===job.id+"before"}
                            style={{ background:"#f8f8f8", border:"1px solid #dddddd", borderRadius:8, color:"#555", fontSize:11, fontWeight:600, padding:"7px 12px", cursor:"pointer" }}>
                            {uploadingPhoto===job.id+"before"?"⏳":"📷 Before photo"}
                          </button>
                          <button onClick={()=>updateJobStatus(job.id,"in_progress")}
                            style={{ background:"#8b5cf6", border:"none", borderRadius:8, color:"#fff", fontSize:11, fontWeight:700, padding:"7px 14px", cursor:"pointer" }}>
                            🔧 Start job
                          </button>
                        </>
                      )}
                      {job.status==="in_progress"&&(
                        <>
                          <button onClick={()=>navigateToCustomer(job)}
                            style={{ background:"#eff6ff", border:"1px solid #378add40", borderRadius:8, color:"#378add", fontSize:11, fontWeight:700, padding:"7px 12px", cursor:"pointer" }}>
                            🗺️ Navigate
                          </button>
                          <button onClick={()=>callCustomer(job)}
                            style={{ background:"#f0fdf4", border:"1px solid #1d9e7540", borderRadius:8, color:"#1d9e75", fontSize:11, fontWeight:700, padding:"7px 12px", cursor:"pointer" }}>
                            📞 Call
                          </button>
                          <button onClick={()=>uploadJobPhoto(job.id,"before")} disabled={uploadingPhoto===job.id+"before"}
                            style={{ background:"#f8f8f8", border:"1px solid #dddddd", borderRadius:8, color:"#555", fontSize:11, fontWeight:600, padding:"7px 12px", cursor:"pointer" }}>
                            {uploadingPhoto===job.id+"before"?"⏳":"📷 Before"}
                          </button>
                          <button onClick={()=>uploadJobPhoto(job.id,"after")} disabled={uploadingPhoto===job.id+"after"}
                            style={{ background:"#f8f8f8", border:"1px solid #dddddd", borderRadius:8, color:"#555", fontSize:11, fontWeight:600, padding:"7px 12px", cursor:"pointer" }}>
                            {uploadingPhoto===job.id+"after"?"⏳":"📷 After"}
                          </button>
                          <button onClick={()=>setPartsRequest(partsRequest===job.id?null:job.id)}
                            style={{ background:"#fff8f0", border:"1px solid #e6821e40", borderRadius:8, color:"#e6821e", fontSize:11, fontWeight:700, padding:"7px 12px", cursor:"pointer" }}>
                            🔩 Parts
                          </button>
                          <button onClick={()=>setChatJob(chatJob===job.id?null:job.id)}
                            style={{ background:"#faf5ff", border:"1px solid #8b5cf640", borderRadius:8, color:"#8b5cf6", fontSize:11, fontWeight:700, padding:"7px 12px", cursor:"pointer" }}>
                            💬 {chatJob===job.id?"Close chat":"Chat"}
                          </button>
                          <button onClick={()=>updateJobStatus(job.id,"completed")}
                            style={{ background:"#1d9e75", border:"none", borderRadius:8, color:"#fff", fontSize:11, fontWeight:800, padding:"7px 14px", cursor:"pointer" }}>
                            ✓ Complete
                          </button>
                        </>
                      )}
                    </div>

                    {/* Parts request form */}
                    {partsRequest===job.id&&(
                      <div style={{ background:"#fff8f0", border:"1px solid #e6821e20", borderRadius:10, padding:"0.75rem", marginBottom:12 }}>
                        <div style={{ fontSize:12, fontWeight:700, color:"#e6821e", marginBottom:8 }}>🔩 Request Parts from Garage</div>
                        <input value={partForm.part_name} onChange={e=>setPartForm(f=>({...f,part_name:e.target.value}))}
                          placeholder="Part name (e.g. Oil filter, Brake pad)"
                          style={{ width:"100%", background:"#fff", border:"1px solid #eeeeee", borderRadius:7, padding:"8px 10px", fontSize:12, color:"#000", outline:"none", marginBottom:6, boxSizing:"border-box" }}/>
                        <div style={{ display:"flex", gap:6, marginBottom:6 }}>
                          <div style={{ flex:1 }}>
                            <div style={{ fontSize:10, color:"#888", marginBottom:2 }}>Qty</div>
                            <input type="number" min="1" value={partForm.quantity} onChange={e=>setPartForm(f=>({...f,quantity:Number(e.target.value)}))}
                              style={{ width:"100%", background:"#fff", border:"1px solid #eeeeee", borderRadius:7, padding:"8px 10px", fontSize:12, color:"#000", outline:"none", boxSizing:"border-box" }}/>
                          </div>
                          <div style={{ flex:1 }}>
                            <div style={{ fontSize:10, color:"#888", marginBottom:2 }}>Urgency</div>
                            <select value={partForm.urgency} onChange={e=>setPartForm(f=>({...f,urgency:e.target.value}))}
                              style={{ width:"100%", background:"#fff", border:"1px solid #eeeeee", borderRadius:7, padding:"8px 10px", fontSize:12, color:"#000", outline:"none", boxSizing:"border-box" }}>
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

                    {/* Chat with customer */}
                    {chatJob===job.id&&(
                      <div style={{ marginBottom:12 }}>
                        <div style={{ fontSize:11, color:"#8b5cf6", fontWeight:700, marginBottom:6 }}>💬 Chat with Customer</div>
                        <div style={{ height:300, borderRadius:10, overflow:"hidden", border:"1px solid #8b5cf620" }}>
                          <ChatWindow
                            bookingId={job.id}
                            otherUserId={job.customer_id}
                            overrideUserId={mechanic.user_id}
                            otherUserName={(job.profiles?.first_name||"") + " " + (job.profiles?.last_name||"")}
                            onClose={()=>setChatJob(null)}
                          />
                        </div>
                      </div>
                    )}

                    {/* Job notes */}
                    <div>
                      <div style={{ fontSize:11, color:"#888", marginBottom:4, fontWeight:600 }}>📝 Job Notes</div>
                      <textarea value={jobNotes[job.id]||job.mechanic_notes||""}
                        onChange={e=>setJobNotes(prev=>({...prev,[job.id]:e.target.value}))}
                        placeholder="Add notes about this job..."
                        rows={2}
                        style={{ width:"100%", background:"#f8f8f8", border:"1px solid #eeeeee", borderRadius:8, padding:"8px 10px", fontSize:11, color:"#000", outline:"none", resize:"none", boxSizing:"border-box", fontFamily:"DM Sans,sans-serif" }}/>
                      <button onClick={()=>saveJobNotes(job.id)} disabled={savingNotes===job.id}
                        style={{ marginTop:4, background:savingNotes===job.id?"#888":"#378add", border:"none", borderRadius:6, color:"#fff", fontSize:10, fontWeight:700, padding:"5px 14px", cursor:"pointer" }}>
                        {savingNotes===job.id?"Saving...":"💾 Save notes"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* EARNINGS TAB */}
        {tab==="earnings"&&(
          <div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:"1rem" }}>
              {[
                { label:"Today", value:"KES " + Math.round(earnings.today).toLocaleString(), color:"#1d9e75", bg:"#f0fdf4" },
                { label:"This week", value:"KES " + Math.round(earnings.week).toLocaleString(), color:"#378add", bg:"#eff6ff" },
                { label:"This month", value:"KES " + Math.round(earnings.month).toLocaleString(), color:"#8b5cf6", bg:"#faf5ff" },
                { label:"Total jobs", value:earnings.total_jobs + " jobs", color:"#e6821e", bg:"#fff8f0" },
              ].map(s=>(
                <div key={s.label} style={{ background:s.bg, border:"1px solid " + s.color + "20", borderRadius:12, padding:"1rem", textAlign:"center" }}>
                  <div style={{ fontSize:10, color:"#888", marginBottom:4, textTransform:"uppercase", letterSpacing:"0.05em" }}>{s.label}</div>
                  <div style={{ fontFamily:"Syne", fontSize:16, fontWeight:800, color:s.color }}>{s.value}</div>
                </div>
              ))}
            </div>
            <div style={{ background:"#f8f8f8", borderRadius:10, padding:"1rem", fontSize:12, color:"#555", lineHeight:1.8 }}>
              <div style={{ fontWeight:700, marginBottom:4, color:"#000" }}>💡 About your earnings</div>
              Earnings shown are estimated at 15% of completed job value. Actual payout depends on your agreement with {mechanic?.business_name||"your garage"}.
            </div>
          </div>
        )}

        {/* HISTORY TAB */}
        {tab==="history"&&(
          <div>
            {history.length===0&&(
              <div style={{ textAlign:"center", padding:"3rem 1rem", color:"#888" }}>
                <div style={{ fontSize:40, marginBottom:12 }}>📋</div>
                <div style={{ fontSize:14, fontWeight:600, color:"#000" }}>No completed jobs yet</div>
                <div style={{ fontSize:12, marginTop:4 }}>Your job history will appear here</div>
              </div>
            )}
            {history.map(job=>(
              <div key={job.id} style={{ background:"#ffffff", border:"1px solid #eeeeee", borderRadius:12, padding:"1rem", marginBottom:8 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                  <div>
                    <div style={{ fontFamily:"Syne", fontSize:13, fontWeight:700, color:"#000" }}>{job.services?.name||job.service_name}</div>
                    <div style={{ fontSize:11, color:"#555", marginTop:2 }}>{job.profiles?.first_name} {job.profiles?.last_name}</div>
                    <div style={{ fontSize:10, color:"#888", marginTop:2 }}>📅 {job.booking_date}</div>
                    {job.mechanic_notes&&<div style={{ fontSize:10, color:"#666", marginTop:4, background:"#f8f8f8", borderRadius:6, padding:"4px 8px" }}>📝 {job.mechanic_notes}</div>}
                  </div>
                  <span style={{ fontSize:10, padding:"3px 8px", borderRadius:10, background:job.status==="completed"?"#f0fdf4":"#fff5f5", color:job.status==="completed"?"#1d9e75":"#e24b4a", fontWeight:700 }}>
                    {job.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* PHOTOS TAB */}
        {tab==="photos"&&(
          <div>
            <div style={{ fontFamily:"Syne", fontSize:16, fontWeight:800, color:"#000", marginBottom:4 }}>📸 Job Photos</div>
            <div style={{ fontSize:12, color:"#888", marginBottom:"1rem" }}>{photos.length} photo{photos.length!==1?"s":""} from your jobs</div>
            {photos.length===0&&(
              <div style={{ textAlign:"center", padding:"3rem 1rem", background:"#fff", borderRadius:12, border:"1px solid #eee" }}>
                <div style={{ fontSize:40, marginBottom:8 }}>📷</div>
                <div style={{ fontSize:13, color:"#888" }}>No photos yet. Upload before/after photos on your jobs.</div>
              </div>
            )}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
              {photos.map((p,i)=>(
                <div key={i} onClick={()=>setViewPhoto(p)}
                  style={{ borderRadius:10, overflow:"hidden", cursor:"pointer", position:"relative", aspectRatio:"1", background:"#f5f5f5" }}>
                  <img src={p.url} alt={p.type} style={{ width:"100%", height:"100%", objectFit:"cover" }}/>
                  <div style={{ position:"absolute", bottom:0, left:0, right:0, background:"linear-gradient(transparent,rgba(0,0,0,0.7))", padding:"8px 6px 4px" }}>
                    <div style={{ fontSize:10, color:"#fff", fontWeight:700 }}>{p.type}</div>
                    <div style={{ fontSize:9, color:"rgba(255,255,255,0.8)" }}>{p.job.services?.name||p.job.service_name}</div>
                  </div>
                </div>
              ))}
            </div>
            {/* Photo lightbox */}
            {viewPhoto&&(
              <div onClick={()=>setViewPhoto(null)} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.9)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:"1rem" }}>
                <div style={{ maxWidth:"100%", maxHeight:"80vh", position:"relative" }}>
                  <img src={viewPhoto.url} alt="Job photo" style={{ maxWidth:"100%", maxHeight:"80vh", borderRadius:12, objectFit:"contain" }}/>
                  <div style={{ textAlign:"center", marginTop:12 }}>
                    <div style={{ fontSize:14, fontWeight:700, color:"#fff" }}>{viewPhoto.type} photo</div>
                    <div style={{ fontSize:12, color:"rgba(255,255,255,0.7)" }}>{viewPhoto.job.services?.name} · {viewPhoto.job.booking_date}</div>
                    <div style={{ fontSize:11, color:"rgba(255,255,255,0.6)" }}>{viewPhoto.job.profiles?.first_name} {viewPhoto.job.profiles?.last_name}</div>
                  </div>
                  <button onClick={()=>setViewPhoto(null)}
                    style={{ position:"absolute", top:-12, right:-12, background:"#fff", border:"none", borderRadius:"50%", width:28, height:28, fontSize:14, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
                    x
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* SERVICE MANUAL TAB */}
        {tab==="manual"&&(
          <div>
            <div style={{ fontFamily:"Syne", fontSize:16, fontWeight:800, color:"#000", marginBottom:4 }}>📖 Service Manual</div>
            <div style={{ fontSize:12, color:"#888", marginBottom:"1rem" }}>Quick reference guides for common repairs</div>
            {[
              { title:"Oil Change", icon:"🛢️", steps:["Warm up engine for 2 mins","Drain old oil from drain plug","Replace oil filter","Add new oil (check spec)","Run engine, check for leaks","Reset oil life indicator"] },
              { title:"Brake Pad Replacement", icon:"🔴", steps:["Loosen wheel nuts, jack up car","Remove wheel and caliper","Slide out old brake pads","Compress caliper piston","Install new pads","Reassemble and pump brakes"] },
              { title:"Tyre Change", icon:"🛞", steps:["Apply parking brake","Loosen nuts before jacking","Jack under correct lift point","Remove flat tyre","Mount spare and hand-tighten nuts","Lower car and torque nuts to spec"] },
              { title:"Battery Replacement", icon:"🔋", steps:["Turn off engine","Disconnect negative (-) first","Disconnect positive (+)","Remove hold-down clamp","Install new battery","Connect positive (+) first, then negative"] },
              { title:"Air Filter Replacement", icon:"💨", steps:["Locate air filter housing","Unclip housing cover","Remove old filter","Check housing for debris","Insert new filter","Secure cover clips"] },
              { title:"Spark Plug Replacement", icon:"⚡", steps:["Allow engine to cool","Remove ignition coil/wire","Use spark plug socket to remove","Check gap on new plug","Hand-thread new plug","Torque to spec, reattach coil"] },
            ].map((item,i)=>(
              <div key={i} style={{ background:"#ffffff", border:"1px solid #eeeeee", borderRadius:12, marginBottom:10, overflow:"hidden" }}>
                <div onClick={()=>setExpandedJob(expandedJob===("manual"+i)?null:"manual"+i)}
                  style={{ padding:"0.875rem 1rem", display:"flex", justifyContent:"space-between", alignItems:"center", cursor:"pointer" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                    <span style={{ fontSize:22 }}>{item.icon}</span>
                    <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:700, color:"#000" }}>{item.title}</div>
                  </div>
                  <div style={{ fontSize:12, color:"#888" }}>{expandedJob==="manual"+i?"▲":"▼"}</div>
                </div>
                {expandedJob==="manual"+i&&(
                  <div style={{ borderTop:"1px solid #f5f5f5", padding:"0.75rem 1rem" }}>
                    {item.steps.map((step,j)=>(
                      <div key={j} style={{ display:"flex", gap:10, marginBottom:8, alignItems:"flex-start" }}>
                        <div style={{ width:22, height:22, borderRadius:"50%", background:"#1d9e75", color:"#fff", fontSize:11, fontWeight:800, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, marginTop:1 }}>{j+1}</div>
                        <div style={{ fontSize:12, color:"#333", lineHeight:1.5 }}>{step}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* PARTS PRICE LIST TAB */}
        {tab==="parts"&&(
          <div>
            <div style={{ fontFamily:"Syne", fontSize:16, fontWeight:800, color:"#000", marginBottom:4 }}>🔩 Parts Price Guide</div>
            <div style={{ fontSize:12, color:"#888", marginBottom:"1rem" }}>Nairobi market prices (approximate, KES)</div>
            {[
              { category:"Engine", icon:"⚙️", parts:[
                { name:"Engine Oil (4L)", min:800, max:2500 },
                { name:"Oil Filter", min:300, max:800 },
                { name:"Air Filter", min:400, max:1200 },
                { name:"Spark Plugs (set of 4)", min:800, max:3000 },
                { name:"Timing Belt", min:1500, max:5000 },
              ]},
              { category:"Brakes", icon:"🔴", parts:[
                { name:"Brake Pads (front pair)", min:1200, max:4000 },
                { name:"Brake Discs (each)", min:2000, max:6000 },
                { name:"Brake Fluid (500ml)", min:400, max:800 },
                { name:"Brake Caliper", min:3000, max:8000 },
              ]},
              { category:"Suspension", icon:"🚗", parts:[
                { name:"Shock Absorber (each)", min:2500, max:8000 },
                { name:"Ball Joint", min:1500, max:4000 },
                { name:"Tie Rod End", min:1200, max:3500 },
                { name:"Bush Kit", min:800, max:2500 },
              ]},
              { category:"Electrical", icon:"⚡", parts:[
                { name:"Car Battery (40-60Ah)", min:6000, max:12000 },
                { name:"Alternator", min:5000, max:15000 },
                { name:"Starter Motor", min:4000, max:12000 },
                { name:"Fuse Box", min:1500, max:5000 },
              ]},
              { category:"Tyres", icon:"🛞", parts:[
                { name:"Budget Tyre (175/65R14)", min:3500, max:5000 },
                { name:"Mid-range Tyre (185/65R15)", min:5000, max:8000 },
                { name:"Premium Tyre (205/55R16)", min:8000, max:15000 },
              ]},
            ].map((cat,i)=>(
              <div key={i} style={{ background:"#ffffff", border:"1px solid #eeeeee", borderRadius:12, marginBottom:10, overflow:"hidden" }}>
                <div onClick={()=>setExpandedJob(expandedJob===("parts"+i)?null:"parts"+i)}
                  style={{ padding:"0.875rem 1rem", display:"flex", justifyContent:"space-between", alignItems:"center", cursor:"pointer" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                    <span style={{ fontSize:22 }}>{cat.icon}</span>
                    <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:700, color:"#000" }}>{cat.category}</div>
                  </div>
                  <div style={{ fontSize:12, color:"#888" }}>{expandedJob==="parts"+i?"▲":"▼"}</div>
                </div>
                {expandedJob==="parts"+i&&(
                  <div style={{ borderTop:"1px solid #f5f5f5", padding:"0.5rem 0" }}>
                    {cat.parts.map((p,j)=>(
                      <div key={j} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 1rem", borderBottom:j<cat.parts.length-1?"1px solid #f8f8f8":"none" }}>
                        <div style={{ fontSize:12, color:"#333" }}>{p.name}</div>
                        <div style={{ fontSize:12, fontWeight:700, color:"#1d9e75" }}>KES {p.min.toLocaleString()} - {p.max.toLocaleString()}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
            <div style={{ background:"#f8f8f8", borderRadius:10, padding:"0.75rem", fontSize:11, color:"#555", lineHeight:1.7 }}>
              ⚠️ Prices are approximate Nairobi market rates. Always confirm with your supplier before quoting a customer.
            </div>
          </div>
        )}

        {/* DOCS TAB */}
        {tab==="docs"&&(
          <div>
            <div style={{ fontFamily:"Syne", fontSize:16, fontWeight:800, color:"#000", marginBottom:4 }}>📄 My Documents</div>
            <div style={{ fontSize:12, color:"#888", marginBottom:"1rem" }}>Upload your documents for verification. All documents are reviewed by admin.</div>
            {[
              { type:"national_id_front", label:"National ID (Front)", icon:"🪪" },
              { type:"national_id_back", label:"National ID (Back)", icon:"🪪" },
              { type:"driving_license", label:"Driver License", icon:"🚗" },
              { type:"good_conduct", label:"Certificate of Good Conduct", icon:"📋" },
              { type:"medical_certificate", label:"Medical Certificate", icon:"🏥" },
            ].map(doc => {
              const existing = docs.find(d=>d.document_type===doc.type)
              return (
                <div key={doc.type} style={{ background:"#ffffff", border:"1px solid #eeeeee", borderRadius:12, padding:"1rem", marginBottom:10 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                      <div style={{ fontSize:24 }}>{doc.icon}</div>
                      <div>
                        <div style={{ fontSize:13, fontWeight:700, color:"#000" }}>{doc.label}</div>
                        <div style={{ fontSize:10, marginTop:2 }}>
                          {existing ? (
                            <span style={{ color:existing.status==="approved"?"#1d9e75":existing.status==="rejected"?"#e24b4a":"#e6821e", fontWeight:700 }}>
                              {existing.status==="approved"?"✓ Verified":existing.status==="rejected"?"✗ Rejected":"⏳ Pending review"}
                            </span>
                          ) : (
                            <span style={{ color:"#888" }}>Not uploaded</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <button onClick={()=>uploadDoc(doc.type, doc.label)} disabled={uploadingDoc===doc.type}
                      style={{ background:existing?"#f8f8f8":"#1d9e75", border:existing?"1px solid #dddddd":"none", borderRadius:8, color:existing?"#555":"#fff", fontSize:11, fontWeight:700, padding:"7px 14px", cursor:"pointer" }}>
                      {uploadingDoc===doc.type?"⏳":existing?"🔄 Replace":"📤 Upload"}
                    </button>
                  </div>
                  {existing?.document_url&&(
                    <a href={existing.document_url} target="_blank" rel="noopener noreferrer"
                      style={{ display:"block", marginTop:8, fontSize:11, color:"#378add", textDecoration:"none" }}>
                      👁️ View uploaded document
                    </a>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* SOS TAB */}
        {tab==="sos"&&(
          <div>
            <div style={{ background:"linear-gradient(135deg,#fff5f5,#fff)", border:"1px solid #e24b4a20", borderRadius:14, padding:"1.5rem", textAlign:"center", marginBottom:"1rem" }}>
              <div style={{ fontSize:56, marginBottom:12 }}>🆘</div>
              <div style={{ fontFamily:"Syne", fontSize:18, fontWeight:800, color:"#e24b4a", marginBottom:8 }}>Emergency SOS</div>
              <div style={{ fontSize:12, color:"#555", marginBottom:20, lineHeight:1.6 }}>
                Use this only in genuine emergencies. Admin will be notified immediately with your GPS location.
              </div>
              <button onClick={sendSOS} disabled={sosLoading}
                style={{ width:"100%", background:sosLoading?"#555":"#e24b4a", border:"none", borderRadius:14, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:16, fontWeight:800, padding:"18px", cursor:sosLoading?"not-allowed":"pointer", boxShadow:"0 4px 20px #e24b4a40" }}>
                {sosLoading?"⏳ Sending SOS Alert...":"🆘 SEND SOS ALERT"}
              </button>
            </div>
            <div style={{ background:"#ffffff", border:"1px solid #eeeeee", borderRadius:12, padding:"1rem" }}>
              <div style={{ fontSize:12, fontWeight:700, color:"#000", marginBottom:10 }}>📞 Emergency Contacts</div>
              {[
                { label:"Police", number:"999", color:"#e24b4a" },
                { label:"NTSA Emergency", number:"0800 723 573", color:"#e6821e" },
                { label:"CCC Admin", number:"0113858966", color:"#1d9e75" },
              ].map(c=>(
                <div key={c.label} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 0", borderBottom:"1px solid #f5f5f5" }}>
                  <div style={{ fontSize:12, color:"#555" }}>{c.label}</div>
                  <a href={"tel:"+c.number.replace(/s/g,"")} style={{ fontSize:13, fontWeight:700, color:c.color, textDecoration:"none" }}>{c.number}</a>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

        {/* Stats Tab */}
        {tab==="stats"&&(
          <div>
            <div style={{ fontFamily:"Syne", fontSize:16, fontWeight:800, color:"#000", marginBottom:"1rem" }}>⭐ Performance</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:"1rem" }}>
              {[
                { label:"Avg Rating", value:perfStats.avg_rating>0?perfStats.avg_rating.toFixed(1)+" ⭐":"No ratings", color:"#e6821e", bg:"#fff8f0" },
                { label:"Total Ratings", value:perfStats.total_ratings, color:"#378add", bg:"#eff6ff" },
                { label:"Completion Rate", value:perfStats.completion_rate+"%", color:"#1d9e75", bg:"#f0fdf4" },
                { label:"Total Jobs", value:earnings.total_jobs, color:"#8b5cf6", bg:"#faf5ff" },
              ].map(s=>(
                <div key={s.label} style={{ background:s.bg, border:"1px solid "+s.color+"20", borderRadius:12, padding:"1rem", textAlign:"center" }}>
                  <div style={{ fontSize:10, color:"#888", marginBottom:4, textTransform:"uppercase", letterSpacing:"0.05em" }}>{s.label}</div>
                  <div style={{ fontFamily:"Syne", fontSize:18, fontWeight:800, color:s.color }}>{s.value}</div>
                </div>
              ))}
            </div>
            <div style={{ background:"#f8f8f8", borderRadius:10, padding:"1rem", fontSize:12, color:"#555", lineHeight:1.7 }}>
              <div style={{ fontWeight:700, color:"#000", marginBottom:4 }}>💡 How ratings work</div>
              Customers rate you after each completed job. Your rating is visible to garage managers and helps determine future job assignments.
            </div>
          </div>
        )}

      

    

    {/* Garage chat overlay */}
      {showGarageChat&&(
        <div style={{ position:"fixed", bottom:80, right:16, left:16, height:400, background:"#fff", borderRadius:16, boxShadow:"0 8px 40px rgba(0,0,0,0.2)", zIndex:200, overflow:"hidden", display:"flex", flexDirection:"column" }}>
          <div style={{ background:"#1d9e75", padding:"0.75rem 1rem", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <div style={{ fontSize:13, fontWeight:700, color:"#fff" }}>💬 Chat with Garage Manager</div>
            <button onClick={()=>setShowGarageChat(false)} style={{ background:"none", border:"none", color:"#fff", fontSize:18, cursor:"pointer" }}>&#215;</button>
          </div>
          <div style={{ flex:1, overflow:"hidden" }}>
            <ChatWindow
              bookingId={null}
              mechanicId={mechanic?.user_id}
              otherUserId={mechanic?.provider_id}
              overrideUserId={mechanic?.user_id}
              otherUserName={mechanic?.business_name||"Garage Manager"}
              onClose={()=>setShowGarageChat(false)}
            />
          </div>
        </div>
      )}

      <AIAssistant forcedRole="mechanic" bottomOffset={140}/>
    </div>
  )
}
