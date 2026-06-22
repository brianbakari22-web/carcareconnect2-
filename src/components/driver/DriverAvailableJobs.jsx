import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"
import { useAuth } from "../../contexts/AuthContext"
import useIsMobile from "../../lib/useIsMobile"
import toast from "react-hot-toast"

export default function DriverAvailableJobs() {
  const { user, profile } = useAuth()
  const isMobile = useIsMobile()
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [accepting, setAccepting] = useState(null)
  const [driverStatus, setDriverStatus] = useState(null)

  useEffect(() => {
    if (!user) return
    load()
    const sub = supabase.channel("available-jobs-live")
      .on("postgres_changes", { event:"*", schema:"public", table:"bookings" }, () => load())
      .subscribe()
    return () => supabase.removeChannel(sub)
  }, [user])

  async function load() {
    const [{ data: jobs }, { data: status }] = await Promise.all([
      supabase.from("bookings")
        .select("*, vehicles(make,model,year,license_plate,color), profiles!bookings_customer_id_fkey(first_name,last_name,city)")
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

            {/* Accept button */}
            <button
              onClick={()=>acceptJob(job)}
              disabled={accepting===job.id||!isOnline||!isVerified}
              style={{
                width:"100%",
                background:accepting===job.id||!isOnline||!isVerified?"#ffffff":"#1d9e75",
                border:`1px solid ${accepting===job.id||!isOnline||!isVerified?"#555555":"#1d9e75"}`,
                borderRadius:10, color:accepting===job.id||!isOnline||!isVerified?"#444":"#fff",
                fontFamily:"Syne,sans-serif", fontSize:14, fontWeight:700,
                padding:"13px", cursor:accepting===job.id||!isOnline||!isVerified?"not-allowed":"pointer",
                transition:"all 0.15s",
              }}>
              {accepting===job.id?"Accepting...":"✓ Accept this job"}
            </button>
          </div>
        )
      })}
    </div>
  )
}


