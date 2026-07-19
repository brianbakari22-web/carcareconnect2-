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
  const [arrivedJob, setArrivedJob] = useState(null)
  const [otpInput, setOtpInput] = useState({})
  const [otpVerifying, setOtpVerifying] = useState(null)
  const [showCCCParts, setShowCCCParts] = useState(null)
  const [cccInventory, setCCCInventory] = useState([])
  const [cccSelectedPart, setCCCSelectedPart] = useState(null)
  const [cccPartQty, setCCCPartQty] = useState(1)
  const [requestingCCCPart, setRequestingCCCPart] = useState(false)
  const [partForm, setPartForm] = useState({ part_name:"", quantity:1, urgency:"normal", notes:"" })
  const [jobTimers, setJobTimers] = useState({})
  const [timerRef, setTimerRef] = useState(null)
  const [earnings, setEarnings] = useState({ today:0, week:0, month:0, total_jobs:0 })
  const [expandedJob, setExpandedJob] = useState(null)
  const [photos, setPhotos] = useState([])
  const [partsRequests, setPartsRequests] = useState([])
  const [photoFilter, setPhotoFilter] = useState("all")
  const [viewPhoto, setViewPhoto] = useState(null)
  const [docs, setDocs] = useState([])
  const [uploadingDoc, setUploadingDoc] = useState(null)
  const [chatJob, setChatJob] = useState(null)
  const [showGarageChat, setShowGarageChat] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [perfStats, setPerfStats] = useState({ avg_rating:0, total_ratings:0, avg_response_mins:0, completion_rate:0 })

  useEffect(() => {
    if (!mechanic) return
    load()
    loadPartsRequests()
    loadHistory()
    loadEarnings()
    loadPerfStats()
    loadDocs()
    loadPhotos()
    const sub = supabase.channel("mechanic-jobs-" + mechanic.mechanic_id)
      .on("postgres_changes", { event:"INSERT", schema:"public", table:"bookings",
        filter:"assigned_mechanic_id=eq." + mechanic.mechanic_id }, payload => {
        load()
        toast.success("New job assigned: " + (payload.new.service_name||"Service") + " 🔧", { duration:10000 })
      })
      .on("postgres_changes", { event:"UPDATE", schema:"public", table:"bookings",
        filter:"assigned_mechanic_id=eq." + mechanic.mechanic_id }, payload => { load(); if(payload.new.status==="confirmed"&&payload.new.assigned_mechanic_id) toast.success("🚨 GO Service job assigned! Check your jobs.", { duration:10000 }) })
      .subscribe()
    return () => { supabase.removeChannel(sub); stopSharing() }
  }, [mechanic])

  async function generateArrivalOTP(jobId) {
    try {
      await supabase.functions.invoke("go-generate-otp", { body: { booking_id: jobId } })
      setArrivedJob(jobId)
      toast.success("OTP sent to customer! Ask them for the code.")
    } catch(e) { toast.error(e.message) }
  }
  async function verifyArrivalOTP(job) {
    const entered = otpInput[job.id]
    if(!entered||entered.length!==4) return toast.error("Enter 4-digit OTP")
    setOtpVerifying(job.id)
    try {
      const { data, error } = await supabase.rpc("verify_mechanic_arrival_otp", { p_booking_id: job.id, p_otp: entered })
      if(error) throw error
      if(!data?.success) throw new Error(data?.error||"Verification failed")
      await supabase.functions.invoke("go-release-escrow", { body: { booking_id: job.id } })
      await updateJobStatus(job.id, "in-progress")
      setArrivedJob(null)
      setOtpInput(prev=>({...prev,[job.id]:""}))
      toast.success("OTP verified! Job started. 🚀")
    } catch(e) { toast.error(e.message) }
    finally { setOtpVerifying(null) }
  }
  async function loadCCCInventory(lat, lng) {
    const { data } = await supabase.from("inventory").select("*, profiles!inventory_provider_id_fkey(first_name,last_name,business_name,latitude,longitude)").eq("is_active",true).gt("stock_quantity",0)
    if(lat && lng && data) {
      data.forEach(i=>{ const p=i.profiles; if(p?.latitude&&p?.longitude){const dLat=(p.latitude-lat)*Math.PI/180;const dLng=(p.longitude-lng)*Math.PI/180;const a=Math.sin(dLat/2)**2+Math.cos(lat*Math.PI/180)*Math.cos(p.latitude*Math.PI/180)*Math.sin(dLng/2)**2;i._distance=6371*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a))}else{i._distance=999}})
      data.sort((a,b)=>a._distance-b._distance)
    }
    setCCCInventory(data||[])
  }
  async function requestCCCPart(job) {
    if(!cccSelectedPart) return toast.error("Select a part")
    setRequestingCCCPart(true)
    try {
      const part = cccInventory.find(i=>i.id===cccSelectedPart)
      if(!part) throw new Error("Part not found")
      const total = part.price * cccPartQty
      await supabase.from("go_parts_requests").insert({
        booking_id: job.id, mechanic_id: mechanic.id, inventory_id: part.id,
        provider_id: part.provider_id, quantity: cccPartQty, unit_price: part.price,
        total_amount: total, customer_id: job.customer_id,
        delivery_location_address: job.emergency_location_address,
        delivery_location_lat: job.emergency_location_lat, delivery_location_lng: job.emergency_location_lng, status: "pending"
      })
      await supabase.from("notifications").insert([
        { user_id: part.provider_id, title: "Part request!", message: "Mechanic needs "+part.name+" x"+cccPartQty+" at "+job.emergency_location_address, type: "info" },
        { user_id: job.customer_id, title: "Mechanic needs a part", message: "Your mechanic needs "+part.name+" — KES "+total, type: "info" }
      ])
      toast.success("Part request sent!")
      setShowCCCParts(null); setCCCSelectedPart(null); setCCCPartQty(1)
    } catch(e) { toast.error(e.message) }
    finally { setRequestingCCCPart(false) }
  }
  async function load() {
    setLoading(true)
    const { data } = await supabase.rpc("get_mechanic_jobs", { p_mechanic_id: mechanic.mechanic_id })
    // RPC bypasses RLS since mechanics use PIN auth not Supabase auth



    setJobs(data||[])
    const active = (data||[]).find(j=>j.status==="in-progress")
    if (active) { setActiveJob(active); if (!timerRef) startJobTimer(active.id, active.mechanic_started_at||active.updated_at) }
    setLoading(false)
  }

  async function loadHistory() {
    const { data } = await supabase.rpc("get_mechanic_history", { p_mechanic_id: mechanic.mechanic_id })
    setHistory(data||[])
  }

  async function loadPhotos() {
    const { data, error: photoErr } = await supabase.from("bookings")
      .select("id, service_name, booking_date, before_photo_url, after_photo_url")
      .eq("assigned_mechanic_id", mechanic.mechanic_id)
      .not("before_photo_url", "is", null)
      .order("created_at", { ascending: false })
      .limit(50)
    if (photoErr) console.error("loadPhotos error:", photoErr.message, photoErr.details, photoErr.hint)
    const { data: data2 } = await supabase.from("bookings")
      .select("id, service_name, booking_date, before_photo_url, after_photo_url")
      .eq("assigned_mechanic_id", mechanic.mechanic_id)
      .not("after_photo_url", "is", null)
      .order("created_at", { ascending: false })
      .limit(50)
    const allPhotos = []
    ;(data||[]).forEach(b => allPhotos.push({ url:b.before_photo_url, type:"Before", job:b }))
    ;(data2||[]).forEach(b => allPhotos.push({ url:b.after_photo_url, type:"After", job:b }))
    setPhotos(allPhotos)
  }

  async function loadPartsRequests() {
    const { data } = await supabase.from("mechanic_parts_requests")
      .select("*")
      .eq("mechanic_id", mechanic.mechanic_id)
      .order("created_at", { ascending: false })
      .limit(20)
    setPartsRequests(data||[])
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
        const { data } = supabase.storage.from("provider-photos").getPublicUrl(path)
        // Upsert document record
        await supabase.from("driver_documents").upsert({
          driver_id: mechanic.mechanic_id,
          type: docType,
          document_url: data.publicUrl,
          status: "pending",
          file_name: file.name
        }, { onConflict: "driver_id,type" })
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
      today: data.filter(b=>b.created_at>=todayStart).reduce((s,b)=>s+(mechanic.commission_type==="fixed" ? Number(mechanic.commission_rate||0) : Number(b.provider_earnings||0)*(mechanic.commission_rate||0.15)),0),
      week: data.filter(b=>b.created_at>=weekStart).reduce((s,b)=>s+(mechanic.commission_type==="fixed" ? Number(mechanic.commission_rate||0) : Number(b.provider_earnings||0)*(mechanic.commission_rate||0.15)),0),
      month: data.filter(b=>b.created_at>=monthStart).reduce((s,b)=>s+(mechanic.commission_type==="fixed" ? Number(mechanic.commission_rate||0) : Number(b.provider_earnings||0)*(mechanic.commission_rate||0.15)),0),
      total_jobs: data.length
    })
  }

  async function updateJobStatus(jobId, status) {
    await supabase.rpc("mechanic_update_job_status", { p_booking_id: jobId, p_status: status, p_mechanic_id: mechanic.mechanic_id })
    if (status === "in-progress") {
      const startedAt = new Date().toISOString()
      setActiveJob(jobs.find(j=>j.id===jobId))
      startSharing()
      startJobTimer(jobId, startedAt)
    }
    if (status === "completed") {
      const job = jobs.find(j=>j.id===jobId)
      if(job?.customer_id) {
        if(job.service_category==="go_service") {
          await supabase.functions.invoke("go-request-service-payment", { body: { booking_id: jobId } })
        } else {
          await supabase.from("notifications").insert({
            user_id: job.customer_id,
            title: "Service complete! Pay now 💳",
            message: `Your ${job.service_name} is complete. Please pay KES ${Number(job.total_amount||0).toLocaleString()} service fee in the app.`,
            type: "success"
          })
        }
      }
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
          [type === "before" ? "before_photo_url" : "after_photo_url"]: data.publicUrl
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
      <div style={{ background:"#ffffff", borderBottom:"1px solid #eeeeee", position:"sticky", top: activeJob ? 220 : 160, zIndex:99, padding:"0.6rem 1rem", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <button onClick={()=>setMenuOpen(true)}
          style={{ background:"#f0fdf4", border:"1px solid #1d9e7530", borderRadius:8, color:"#1d9e75", fontWeight:700, padding:"8px 14px", cursor:"pointer", fontFamily:"DM Sans,sans-serif", fontSize:13, display:"flex", alignItems:"center", gap:8 }}>
          <span style={{ fontSize:16 }}>{TABS.find(t=>t.k===tab)?.icon}</span>
          {TABS.find(t=>t.k===tab)?.l}
          <span style={{ fontSize:11, marginLeft:2 }}>☰</span>
        </button>
      </div>

      {menuOpen&&(
        <div onClick={()=>setMenuOpen(false)} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", zIndex:200, display:"flex" }}>
          <div onClick={e=>e.stopPropagation()} style={{ background:"#ffffff", width:260, maxWidth:"80vw", height:"100%", display:"flex", flexDirection:"column", overflowY:"auto", boxShadow:"2px 0 12px rgba(0,0,0,0.15)" }}>
            <div style={{ padding:"1rem", borderBottom:"1px solid #eeeeee", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div style={{ fontFamily:"Syne", fontSize:15, fontWeight:800, color:"#000" }}>Menu</div>
              <button onClick={()=>setMenuOpen(false)} style={{ background:"none", border:"none", fontSize:20, color:"#888", cursor:"pointer" }}>×</button>
            </div>
            {TABS.map(t=>(
              <button key={t.k} onClick={()=>{ setTab(t.k); setMenuOpen(false) }}
                style={{ background:tab===t.k?"#f0fdf4":"none", border:"none", borderLeft:tab===t.k?"3px solid #1d9e75":"3px solid transparent", color:tab===t.k?"#1d9e75":"#444", fontWeight:tab===t.k?700:500, padding:"14px 16px", cursor:"pointer", fontFamily:"DM Sans,sans-serif", fontSize:14, display:"flex", alignItems:"center", gap:12, textAlign:"left", width:"100%" }}>
                <span style={{ fontSize:18 }}>{t.icon}</span>
                {t.l}
              </button>
            ))}
          </div>
        </div>
      )}

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
                    {job.problem_description&&<div style={{ fontSize:11, color:"#555", marginTop:2, background:"#f8f8f8", borderRadius:6, padding:"3px 8px" }}>💬 {job.problem_description.substring(0,80)}{job.problem_description.length>80?"...":""}</div>}
                    {job.parts_needed&&<div style={{ fontSize:10, color:"#e6821e", marginTop:2 }}>🔩 Customer indicated parts needed</div>}
                    {job.notes&&<div style={{ fontSize:11, color:"#666", marginTop:2 }}>📝 {job.notes.substring(0,60)}{job.notes.length>60?"...":""}</div>}
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
                          {job.service_category==="go_service"&&job.emergency_location_lat&&(
                            <a href={`https://www.google.com/maps/dir/?api=1&destination=${job.emergency_location_lat},${job.emergency_location_lng}`} target="_blank" rel="noopener noreferrer" style={{ display:"inline-flex", alignItems:"center", gap:6, background:"#4285f4", border:"none", borderRadius:8, color:"#fff", fontSize:11, fontWeight:700, padding:"7px 12px", textDecoration:"none" }}>
                              🗺️ Navigate to customer
                            </a>
                          )}
                          {job.service_category==="go_service"&&job.emergency_location_address&&(
                            <div style={{ width:"100%", fontSize:11, color:"#e6821e", background:"#fff8f0", borderRadius:8, padding:"6px 10px", marginBottom:4 }}>📍 {job.emergency_location_address}</div>
                          )}
                          <button onClick={()=>uploadJobPhoto(job.id,"before")} disabled={uploadingPhoto===job.id+"before"}
                            style={{ background:"#f8f8f8", border:"1px solid #dddddd", borderRadius:8, color:"#555", fontSize:11, fontWeight:600, padding:"7px 12px", cursor:"pointer" }}>
                            {uploadingPhoto===job.id+"before"?"⏳":"📷 Before photo"}
                          </button>
                          {job.service_category==="go_service" ? (
                            arrivedJob===job.id ? (
                              <div style={{display:"flex",gap:6,alignItems:"center"}}>
                                <input value={otpInput[job.id]||""} onChange={e=>setOtpInput(p=>({...p,[job.id]:e.target.value}))} maxLength={4} placeholder="OTP" style={{width:80,padding:"6px 8px",borderRadius:8,border:"1px solid #ddd",fontSize:14,textAlign:"center",letterSpacing:4}}/>
                                <button onClick={()=>verifyArrivalOTP(job)} disabled={otpVerifying===job.id} style={{background:"#1d9e75",border:"none",borderRadius:8,color:"#fff",fontSize:11,fontWeight:700,padding:"7px 12px",cursor:"pointer"}}>{otpVerifying===job.id?"...":"Verify OTP"}</button>
                              </div>
                            ) : (
                              <button onClick={()=>generateArrivalOTP(job.id)} style={{background:"#e6821e",border:"none",borderRadius:8,color:"#fff",fontSize:11,fontWeight:700,padding:"7px 14px",cursor:"pointer"}}>📍 I have Arrived</button>
                            )
                          ) : (
                            <button onClick={()=>updateJobStatus(job.id,"in-progress")} style={{background:"#8b5cf6",border:"none",borderRadius:8,color:"#fff",fontSize:11,fontWeight:700,padding:"7px 14px",cursor:"pointer"}}>🔧 Start job</button>
                          )}
                        </>
                      )}
                      {job.status==="in-progress"&&(
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
                          {job.category==="go_service"&&<button onClick={()=>{ setShowCCCParts(job.id); loadCCCInventory(job.emergency_location_lat, job.emergency_location_lng) }} style={{ background:"#f3f0ff", border:"1px solid #8b5cf640", borderRadius:8, color:"#8b5cf6", fontSize:11, fontWeight:700, padding:"7px 12px", cursor:"pointer" }}>🔧 CCC Parts</button>}
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
            <div style={{ background:"#f8f8f8", borderRadius:10, padding:"1rem", fontSize:12, color:"#555", lineHeight:1.8, marginBottom:"1rem" }}>
              <div style={{ fontWeight:700, marginBottom:4, color:"#000" }}>💡 About your earnings</div>
              {mechanic?.commission_rate ? (mechanic?.commission_type==="fixed" ? `Fixed KES ${Number(mechanic?.commission_rate).toLocaleString()} per job — agreed with ${mechanic?.business_name||"your garage"}.` : `${Math.round(Number(mechanic?.commission_rate)*100)}% of job value — agreed with ${mechanic?.business_name||"your garage"}.`) : "Pay rate not set yet. Contact your garage manager."}
            </div>
            {history.filter(j=>j.status==="completed").length>0&&(
              <div>
                <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:700, color:"#000", marginBottom:8 }}>Recent Completed Jobs</div>
                {history.filter(j=>j.status==="completed").slice(0,10).map(job=>(
                  <div key={job.id} style={{ background:"#fff", border:"1px solid #eeeeee", borderRadius:10, padding:"0.75rem", marginBottom:8, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <div>
                      <div style={{ fontSize:12, fontWeight:600, color:"#000" }}>{job.services?.name||job.service_name}</div>
                      <div style={{ fontSize:10, color:"#888", marginTop:2 }}>📅 {job.booking_date} · {job.profiles?.first_name} {job.profiles?.last_name}</div>
                    </div>
                    <div style={{ textAlign:"right" }}>
                      <div style={{ fontFamily:"Syne", fontSize:13, fontWeight:800, color:"#1d9e75" }}>KES {Math.round(mechanic.commission_type==="fixed" ? Number(mechanic.commission_rate||0) : Number(job.provider_earnings||0)*(Number(mechanic.commission_rate||15)/100)).toLocaleString()}</div>
                    <div style={{ fontSize:9, color:"#aaa" }}>{mechanic?.commission_type==="fixed"?"Fixed rate":Math.round((mechanic?.commission_rate||0.15)*100)+"% of KES "+Number(job.provider_earnings||0).toLocaleString()}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
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
                  <div style={{ textAlign:"right" }}>
                    {job.status==="completed"&&<div style={{ fontFamily:"Syne", fontSize:12, fontWeight:800, color:"#1d9e75" }}>KES {Math.round(mechanic.commission_type==="fixed" ? Number(mechanic.commission_rate||0) : Number(job.provider_earnings||0)*(Number(mechanic.commission_rate||15)/100)).toLocaleString()}</div>}
                    <span style={{ fontSize:10, padding:"3px 8px", borderRadius:10, background:job.status==="completed"?"#f0fdf4":"#fff5f5", color:job.status==="completed"?"#1d9e75":"#e24b4a", fontWeight:700, display:"block", marginTop:4 }}>
                      {job.status}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* PHOTOS TAB */}
        {tab==="photos"&&(
          <div>
            <div style={{ fontFamily:"Syne", fontSize:16, fontWeight:800, color:"#000", marginBottom:4 }}>📸 Job Photos</div>
            <div style={{ fontSize:12, color:"#888", marginBottom:"0.75rem" }}>{photos.length} photo{photos.length!==1?"s":""} from your jobs</div>
            {/* Filter buttons */}
            <div style={{ display:"flex", gap:6, marginBottom:"1rem" }}>
              {["all","Before","After"].map(f=>(
                <button key={f} onClick={()=>setPhotoFilter(f)}
                  style={{ padding:"6px 14px", borderRadius:8, border:"none", fontSize:11, cursor:"pointer", background:photoFilter===f?"#1d9e75":"#f0f0f0", color:photoFilter===f?"#fff":"#666", fontWeight:photoFilter===f?700:400 }}>
                  {f==="all"?"All":f+" photos"}
                </button>
              ))}
            </div>
            {photos.length===0&&(
              <div style={{ textAlign:"center", padding:"3rem 1rem", color:"#888" }}>
                <div style={{ fontSize:40, marginBottom:12 }}>📷</div>
                <div style={{ fontSize:14, fontWeight:600, color:"#000" }}>No photos yet</div>
                <div style={{ fontSize:12, marginTop:4 }}>Photos uploaded during jobs will appear here</div>
              </div>
            )}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:8 }}>
              {photos.filter(p=>photoFilter==="all"||p.type===photoFilter).map((p,i)=>(
                <div key={i} style={{ position:"relative", borderRadius:10, overflow:"hidden" }}>
                  <img src={p.url} alt={p.type} style={{ width:"100%", aspectRatio:"1", objectFit:"cover", display:"block", cursor:"pointer" }}
                    onClick={()=>setViewPhoto(p.url)}/>
                  <div style={{ position:"absolute", top:6, left:6, background:p.type==="Before"?"#e6821e":"#1d9e75", borderRadius:6, padding:"2px 8px", fontSize:9, color:"#fff", fontWeight:700 }}>{p.type}</div>
                  <div style={{ position:"absolute", bottom:0, left:0, right:0, background:"linear-gradient(transparent,rgba(0,0,0,0.7))", padding:"8px 6px 6px" }}>
                    <div style={{ fontSize:9, color:"#fff", fontWeight:600 }}>{p.job?.services?.name||p.job?.service_name}</div>
                    <div style={{ fontSize:8, color:"rgba(255,255,255,0.7)" }}>{p.job?.booking_date}</div>
                  </div>
                  <button onClick={()=>{ const a=document.createElement("a"); a.href=p.url; a.download="CCC-photo.jpg"; a.target="_blank"; a.click() }}
                    style={{ position:"absolute", top:6, right:6, background:"rgba(0,0,0,0.5)", border:"none", borderRadius:6, color:"#fff", fontSize:11, padding:"3px 6px", cursor:"pointer" }}>
                    ⬇
                  </button>
                </div>
              ))}
            </div>
            {/* Full screen viewer */}
            {viewPhoto&&(
              <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.95)", zIndex:999, display:"flex", alignItems:"center", justifyContent:"center" }} onClick={()=>setViewPhoto(null)}>
                <img src={viewPhoto} alt="" style={{ maxWidth:"95vw", maxHeight:"90vh", objectFit:"contain", borderRadius:8 }}/>
                <button onClick={()=>setViewPhoto(null)} style={{ position:"absolute", top:16, right:16, background:"rgba(255,255,255,0.2)", border:"none", borderRadius:"50%", width:36, height:36, color:"#fff", fontSize:18, cursor:"pointer" }}>x</button>
              </div>
            )}
          </div>
            )}

        </div>
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
            {/* My Parts Requests */}
            {partsRequests.length>0&&(
              <div style={{ marginBottom:"1.25rem" }}>
                <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:700, color:"#000", marginBottom:8 }}>📤 My Requests ({partsRequests.length})</div>
                {partsRequests.map(req=>(
                  <div key={req.id} style={{ background:"#ffffff", border:"1px solid #eeeeee", borderRadius:10, padding:"0.75rem", marginBottom:8 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                      <div>
                        <div style={{ fontSize:13, fontWeight:600, color:"#000" }}>🔩 {req.part_name}</div>
                        <div style={{ fontSize:11, color:"#888", marginTop:2 }}>Qty: {req.quantity} · {req.urgency} priority</div>
                        {req.notes&&<div style={{ fontSize:10, color:"#666", marginTop:2 }}>Note: {req.notes}</div>}
                        <div style={{ fontSize:10, color:"#aaa", marginTop:2 }}>{new Date(req.created_at).toLocaleDateString()}</div>
                      </div>
                      <span style={{ fontSize:10, padding:"3px 8px", borderRadius:10, fontWeight:700,
                        background:req.status==="approved"?"#f0fdf4":req.status==="rejected"?"#fff5f5":"#fff8f0",
                        color:req.status==="approved"?"#1d9e75":req.status==="rejected"?"#e24b4a":"#e6821e" }}>
                        {req.status==="approved"?"✓ Approved":req.status==="rejected"?"✗ Rejected":"⏳ Pending"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
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
              const existing = docs.find(d=>d.type===doc.type)
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

      {showCCCParts&&(
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", zIndex:300, display:"flex", flexDirection:"column", justifyContent:"flex-end" }} onClick={()=>setShowCCCParts(null)}>
          <div style={{ background:"#fff", borderRadius:"20px 20px 0 0", padding:"1.5rem", maxHeight:"80vh", overflowY:"auto" }} onClick={e=>e.stopPropagation()}>
            <div style={{ fontFamily:"Syne", fontSize:16, fontWeight:800, marginBottom:4 }}>🔧 Request Part from CCC</div>
            <div style={{ fontSize:12, color:"#888", marginBottom:"1rem" }}>Select from nearby suppliers</div>
            {cccInventory.length===0&&<div style={{ fontSize:12, color:"#888", textAlign:"center", padding:"1rem" }}>No parts available nearby</div>}
            {cccInventory.map(item=>(
              <div key={item.id} onClick={()=>setCCCSelectedPart(item.id)} style={{ background:cccSelectedPart===item.id?"#f3f0ff":"#f8f8f8", border:"1px solid "+(cccSelectedPart===item.id?"#8b5cf6":"#eee"), borderRadius:10, padding:"0.75rem", marginBottom:8, cursor:"pointer" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <div><div style={{ fontSize:13, fontWeight:600 }}>{item.name}</div><div style={{ fontSize:11, color:"#888" }}>{item.profiles?.business_name||item.profiles?.first_name}{item._distance<999?" · "+item._distance.toFixed(1)+"km":""}</div><div style={{ fontSize:11, color:"#555" }}>Stock: {item.stock_quantity}</div></div>
                  <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:800, color:"#8b5cf6" }}>KES {Number(item.price).toLocaleString()}</div>
                </div>
              </div>
            ))}
            {cccSelectedPart&&(
              <div style={{ marginTop:12 }}>
                <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:12 }}>
                  <button onClick={()=>setCCCPartQty(q=>Math.max(1,q-1))} style={{ width:36, height:36, borderRadius:8, border:"1px solid #ddd", background:"#f5f5f5", fontSize:18, cursor:"pointer" }}>-</button>
                  <span style={{ fontFamily:"Syne", fontSize:18, fontWeight:800, minWidth:30, textAlign:"center" }}>{cccPartQty}</span>
                  <button onClick={()=>setCCCPartQty(q=>q+1)} style={{ width:36, height:36, borderRadius:8, border:"1px solid #ddd", background:"#f5f5f5", fontSize:18, cursor:"pointer" }}>+</button>
                  <span style={{ fontSize:12, color:"#888" }}>KES {((cccInventory.find(i=>i.id===cccSelectedPart)?.price||0)*cccPartQty).toLocaleString()}</span>
                </div>
                <button onClick={()=>{ const job=jobs.find(j=>j.id===showCCCParts); if(job) requestCCCPart(job) }} disabled={requestingCCCPart} style={{ width:"100%", background:requestingCCCPart?"#ccc":"#8b5cf6", border:"none", borderRadius:10, color:"#fff", fontFamily:"Syne", fontSize:14, fontWeight:700, padding:"13px", cursor:requestingCCCPart?"not-allowed":"pointer" }}>{requestingCCCPart?"Sending...":"Send Part Request"}</button>
              </div>
            )}
            <button onClick={()=>setShowCCCParts(null)} style={{ width:"100%", background:"none", border:"1px solid #ddd", borderRadius:10, color:"#666", fontSize:13, padding:"11px", cursor:"pointer", marginTop:8 }}>Cancel</button>
          </div>
        </div>
      )}
      <AIAssistant forcedRole="mechanic" bottomOffset={140}/>
    </div>
  )
}
