import { useEffect, useState, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { supabase } from "../../lib/supabase"
import { useAuth } from "../../contexts/AuthContext"
import useIsMobile from "../../lib/useIsMobile"
import toast from "react-hot-toast"

export default function DriverAvailableJobs() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [accepting, setAccepting] = useState(null)
  const [driverStatus, setDriverStatus] = useState(null)
  const [countdowns, setCountdowns] = useState({})
  const timerRef = useRef(null)

  // Countdown timer for job offers
  useEffect(() => {
    timerRef.current = setInterval(() => {
      const now = Date.now()
      const newCountdowns = {}
      jobs.forEach(job => {
        if (job.concierge_attempt_expires_at) {
          const remaining = Math.max(0, new Date(job.concierge_attempt_expires_at).getTime() - now)
          newCountdowns[job.id] = remaining
        }
      })
      setCountdowns(newCountdowns)
    }, 1000)
    return () => clearInterval(timerRef.current)
  }, [jobs])

  useEffect(() => {
    if (!user) return
    // Gate: only approved drivers can see jobs
    if (profile && profile.vetting_status && profile.vetting_status !== "approved") {
      navigate("/dashboard/application")
      return
    }
    load()
    const sub = supabase.channel("available-jobs-live")
      .on("postgres_changes", { event:"*", schema:"public", table:"bookings" }, () => load())
      .subscribe()
    return () => supabase.removeChannel(sub)
  }, [user, profile?.vetting_status])

  async function declineJob(job) {
    try {
      // Add this driver to declined list and trigger next attempt
      const currentDeclined = job.concierge_declined_drivers || []
      await supabase.from("bookings").update({
        concierge_declined_drivers: [...currentDeclined, user.id],
        concierge_current_driver_id: null,
        concierge_attempt_expires_at: null,
      }).eq("id", job.id)

      // Trigger next driver assignment
      fetch("https://gcnefnqtjxtqbhynyoxe.supabase.co/functions/v1/assign-concierge-driver", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdjbmVmbnF0anh0cWJoeW55b3hlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2MDg0MzIsImV4cCI6MjA5NTE4NDQzMn0.Ybyce3psBj2I-hdoF95H5UAklr6hsgQi-mciI9uMIgc"
        },
        body: JSON.stringify({ booking_id: job.id })
      }).catch(e => console.warn("Next driver assignment error:", e.message))

      toast.success("Job declined — next driver will be notified")
      load()
    } catch(e) { toast.error(e.message) }
  }

    async function load() {
    const [{ data: jobs }, { data: status }] = await Promise.all([
      supabase.from("bookings")
        .select("*, vehicles(make,model,year,license_plate,color), profiles!bookings_customer_id_fkey(first_name,last_name,city), concierge_current_driver_id, concierge_attempt, concierge_attempt_expires_at")
        .eq("is_concierge", true)
        .eq("status", "confirmed")
        .is("driver_id", null)
        .order("created_at", { ascending:false }),
      supabase.from("driver_status").select("*").eq("driver_id", user.id).maybeSingle(),
    ])
    setJobs(jobs||[])
    setDriverStatus(status)
    setLoading(false)
  }

  async function acceptJob(job) {
    if (!driverStatus?.is_online) return toast.error("You must be online to accept jobs. Go to Overview and toggle online.")
    if (!profile?.documents_verified) return toast.error("Your documents must be verified before accepting jobs.")
    setAccepting(job.id)
    try {
      const { data: check } = await supabase.from("bookings").select("driver_id").eq("id", job.id).single()
      if (check?.driver_id) {
        toast.error("This job was just taken by another driver")
        load()
        return
      }
      // Fetch concierge surcharge rate from app_settings
      const { data: surchargeRow } = await supabase.from("app_settings").select("value").eq("key","concierge_surcharge_rate").maybeSingle()
      const surchargeRate = surchargeRow ? Number(surchargeRow.value)/100 : 0.15
      const driverEarnings = Number(job.total_amount||0) * surchargeRate

      const { error } = await supabase.from("bookings").update({
        driver_id: user.id,
        driver_accepted_at: new Date().toISOString(),
        concierge_status: "accepted",
        status: "driver-assigned",
        driver_earnings: driverEarnings,
      }).eq("id", job.id).is("driver_id", null)
      if (error) throw error

      await supabase.from("driver_status").update({ current_booking_id:job.id }).eq("driver_id", user.id)

      await supabase.from("notifications").insert([
        {
          user_id: job.customer_id,
          title: "Driver assigned! 🚗",
          message: `A driver has been assigned to your booking: ${job.service_name}. They will contact you shortly.`,
          type: "success",
        },
        {
          user_id: job.provider_id,
          title: "Driver accepted concierge 🚗",
          message: `A driver has accepted the concierge request for booking ${job.booking_number}.`,
          type: "info",
        }
      ])

      toast.success("Job accepted! Customer notified 🚗")
      load()
    } catch(err) {
      toast.error(err.message)
    } finally {
      setAccepting(null)
    }
  }

  function formatCountdown(ms) {
    if (!ms || ms <= 0) return "Expired"
    const mins = Math.floor(ms / 60000)
    const secs = Math.floor((ms % 60000) / 1000)
    return `${mins}:${secs.toString().padStart(2,"0")}`
  }

  const isOnline = driverStatus?.is_online
  const isVerified = profile?.documents_verified

  return (
    <div>
      {/* Status banner */}
      {!isOnline&&(
        <div style={{ background:"#fff5f5", border:"1px solid #e24b4a30", borderRadius:10, padding:"0.9rem", marginBottom:"1.25rem" }}>
          <div style={{ fontSize:13, color:"#e24b4a", fontWeight:600, marginBottom:2 }}>🔴 You are offline</div>
          <div style={{ fontSize:11, color:"#666" }}>Go to Overview and toggle online to accept jobs.</div>
        </div>
      )}

      {!isVerified&&(
        <div style={{ background:"#fff8f0", border:"1px solid #e6821e30", borderRadius:10, padding:"0.9rem", marginBottom:"1.25rem" }}>
          <div style={{ fontSize:13, color:"#e6821e", fontWeight:600, marginBottom:2 }}>⚠️ Documents not verified</div>
          <div style={{ fontSize:11, color:"#666" }}>Complete your credentials in Profile and wait for admin verification.</div>
        </div>
      )}

      {isOnline&&isVerified&&(
        <div style={{ background:"#f0fdf4", border:"1px solid #1d9e7530", borderRadius:10, padding:"0.9rem", marginBottom:"1.25rem" }}>
          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
            <div style={{ width:7, height:7, borderRadius:"50%", background:"#1d9e75", boxShadow:"0 0 6px #1d9e75" }}/>
            <div style={{ fontSize:13, color:"#1d9e75", fontWeight:600 }}>Online — {jobs.length} job{jobs.length!==1?"s":""} available</div>
          </div>
        </div>
      )}

      <div style={{ fontFamily:"Syne", fontSize:isMobile?16:18, fontWeight:800, color:"#000000", marginBottom:4 }}>Available Jobs</div>
      <div style={{ fontSize:12, color:"#777777", marginBottom:"1.25rem" }}>Concierge pickup and delivery requests</div>

      {loading&&<div style={{ color:"#777777", fontSize:13 }}>Loading...</div>}
      {!loading&&jobs.length===0&&(
        <div style={{ color:"#888888", fontSize:13, textAlign:"center", padding:"3rem" }}>
          <div style={{ fontSize:32, marginBottom:10 }}>🚗</div>
          <div style={{ marginBottom:6 }}>No available jobs right now</div>
          <div style={{ fontSize:11, color:"#555555" }}>New concierge requests will appear here automatically</div>
        </div>
      )}

      {jobs.map(job=>{
        const vehicle = job.vehicles
        const customer = job.profiles
        const earnings = Number(job.total_amount||0) * 0.15
        return (
          <div key={job.id} style={{ background:"#ffffff", border:"1px solid #1d9e7520", borderRadius:12, padding:isMobile?"1rem":"1.25rem", marginBottom:12 }}>
            {/* Header */}
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:12 }}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                  <span style={{ fontSize:18 }}>🚗</span>
                  <div style={{ fontFamily:"Syne", fontSize:isMobile?14:15, fontWeight:800, color:"#000000" }}>{job.service_name}</div>
                </div>
                <div style={{ fontSize:11, color:"#777777" }}>#{job.booking_number} · {job.booking_date} · {job.booking_time?.slice(0,5)}</div>
              </div>
              <div style={{ textAlign:"right", flexShrink:0 }}>
                <div style={{ fontFamily:"Syne", fontSize:16, fontWeight:800, color:"#1d9e75" }}>KES {earnings.toFixed(0)}</div>
                <div style={{ fontSize:10, color:"#777777" }}>your earnings (15%)</div>
              </div>
            </div>

            {/* Vehicle info */}
            {vehicle&&(
              <div style={{ background:"#ffffff", borderRadius:10, padding:"0.9rem", marginBottom:10, border:"1px solid #eeeeee" }}>
                <div style={{ fontSize:10, color:"#777777", textTransform:"uppercase", marginBottom:6 }}>Vehicle to transport</div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                  <div>
                    <div style={{ fontSize:12, color:"#000000", fontWeight:600 }}>{vehicle.make} {vehicle.model} {vehicle.year}</div>
                    <div style={{ fontSize:11, color:"#777777", marginTop:2 }}>Plate: {vehicle.license_plate}</div>
                  </div>
                  <div>
                    {vehicle.color&&<div style={{ fontSize:11, color:"#777777" }}>Color: {vehicle.color}</div>}
                  </div>
                </div>
              </div>
            )}

            {/* Customer & location info */}
            <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:8, marginBottom:12 }}>
              <div style={{ background:"#ffffff", borderRadius:8, padding:"0.75rem", border:"1px solid #eeeeee" }}>
                <div style={{ fontSize:10, color:"#777777", marginBottom:4 }}>Customer</div>
                <div style={{ fontSize:12, color:"#000000" }}>{customer?.first_name} {customer?.last_name}</div>
                {customer?.city&&<div style={{ fontSize:11, color:"#777777", marginTop:2 }}>📍 {customer.city}</div>}
              </div>
              <div style={{ background:"#ffffff", borderRadius:8, padding:"0.75rem", border:"1px solid #eeeeee" }}>
                <div style={{ fontSize:10, color:"#777777", marginBottom:4 }}>Service total</div>
                <div style={{ fontSize:12, color:"#e6821e", fontWeight:600 }}>KES {Number(job.total_amount||0).toLocaleString()}</div>
                <div style={{ fontSize:10, color:"#777777", marginTop:2 }}>Payment: {job.payment_method||"—"}</div>
              </div>
            </div>

            {/* Problem description */}
            {job.problem_description&&(
              <div style={{ background:"#ffffff", borderRadius:8, padding:"0.75rem", marginBottom:10, border:"1px solid #eeeeee" }}>
                <div style={{ fontSize:10, color:"#777777", marginBottom:4 }}>Problem description</div>
                <div style={{ fontSize:12, color:"#555555", fontStyle:"italic" }}>"{job.problem_description}"</div>
              </div>
            )}

            {/* Notes */}
            {job.notes&&(
              <div style={{ fontSize:11, color:"#666", fontStyle:"italic", marginBottom:10 }}>Note: "{job.notes}"</div>
            )}

            {/* Priority indicator - show when this driver is the current target */}
            {job.concierge_current_driver_id===user?.id&&(
              <div style={{ background:"#fff8f0", border:"1px solid #e6821e40", borderRadius:8, padding:"0.6rem 0.75rem", marginBottom:10, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <span style={{ fontSize:14 }}>⏰</span>
                  <div>
                    <div style={{ fontSize:12, color:"#e6821e", fontWeight:600 }}>You have been selected!</div>
                    <div style={{ fontSize:10, color:"#888" }}>Accept or decline within the time limit</div>
                  </div>
                </div>
                <div style={{ textAlign:"center", background:"#e6821e", borderRadius:8, padding:"6px 10px", minWidth:52 }}>
                  <div style={{ fontFamily:"Syne", fontSize:16, fontWeight:800, color:"#fff" }}>{formatCountdown(countdowns[job.id])}</div>
                  <div style={{ fontSize:8, color:"rgba(255,255,255,0.8)", textTransform:"uppercase" }}>remaining</div>
                </div>
              </div>
            )}

            {/* Accept/Decline buttons */}
            <div style={{ display:"flex", gap:8 }}>
              <button
                onClick={()=>acceptJob(job)}
                disabled={accepting===job.id||!isOnline||!isVerified}
                style={{
                  flex:2,
                  background:accepting===job.id||!isOnline||!isVerified?"#ffffff":"#1d9e75",
                  border:`1px solid ${accepting===job.id||!isOnline||!isVerified?"#555555":"#1d9e75"}`,
                  borderRadius:10, color:accepting===job.id||!isOnline||!isVerified?"#444":"#fff",
                  fontFamily:"Syne,sans-serif", fontSize:14, fontWeight:700,
                  padding:"13px", cursor:accepting===job.id||!isOnline||!isVerified?"not-allowed":"pointer",
                  transition:"all 0.15s",
                }}>
                {accepting===job.id?"Accepting...":"✓ Accept this job"}
              </button>
              {job.concierge_current_driver_id===user?.id&&(
                <button
                  onClick={()=>declineJob(job)}
                  style={{
                    flex:1, background:"none",
                    border:"1px solid #e24b4a40", borderRadius:10,
                    color:"#e24b4a", fontSize:13, fontWeight:600,
                    padding:"13px", cursor:"pointer"
                  }}>
                  ✗ Decline
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}


