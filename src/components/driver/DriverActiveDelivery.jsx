import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"
import { getCurrentPosition } from "../../lib/geolocation"
import { useAuth } from "../../contexts/AuthContext"
import { useLanguage } from "../../contexts/LanguageContext"
import useIsMobile from "../../lib/useIsMobile"
import VehicleConditionReport from "../shared/VehicleConditionReport"
import toast from "react-hot-toast"

export default function DriverActiveDelivery() {
  const { user } = useAuth()
  const { t, language } = useLanguage()
  const isMobile = useIsMobile()
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [tracking, setTracking] = useState(false)
  const [trackingInterval, setTrackingInterval] = useState(null)
  const [panicLoading, setPanicLoading] = useState(false)
  const [expanded, setExpanded] = useState(null)
  const [showReport, setShowReport] = useState(null)
  const [reportType, setReportType] = useState("pickup")
  const [existingReports, setExistingReports] = useState({})

  async function startTracking(jobId) {
    setTracking(true)
    const interval = setInterval(async() => {
      try {
        const pos = await getCurrentPosition()
        // Update driver current location
        await supabase.from("driver_status").upsert({
          driver_id: user.id,
          current_lat: pos.latitude,
          current_lng: pos.longitude,
          is_online: true,
          updated_at: new Date().toISOString()
        }, { onConflict: "driver_id" })
        // Insert into location history for customer tracking
        await supabase.from("driver_location_history").insert({
          driver_id: user.id,
          booking_id: jobId,
          lat: pos.latitude,
          lng: pos.longitude,
        })
      } catch(e) { console.warn("GPS error:", e.message) }
    }, 10000)
    setTrackingInterval(interval)
  }

  function stopTracking() {
    if (trackingInterval) { clearInterval(trackingInterval); setTrackingInterval(null) }
    setTracking(false)
    supabase.from("driver_status").update({ is_online: false }).eq("driver_id", user.id)
  }

  async function sendPanic(job) {
    setPanicLoading(true)
    try {
      const pos = await getCurrentPosition().catch(()=>null)
      await supabase.from("emergency_alerts").insert({
        user_id: user.id,
        user_name: "Driver",
        user_role: "driver",
        latitude: pos?.latitude||null,
        longitude: pos?.longitude||null,
        status: "active",
        message: "DRIVER PANIC: Active delivery booking #" + job.id.slice(0,8)
      })
      toast.success("🚨 Panic alert sent to admin!")
    } catch(e) { toast.error("Failed to send panic alert") }
    finally { setPanicLoading(false) }
  }

  useEffect(() => {
    if (!user) return
    load()
    return () => stopTracking()
  }, [user])

  useEffect(() => {
    const activeJob = jobs.find(j=>j.delivery_status==="picked_up"||j.delivery_status==="in_transit")
    if (activeJob && !tracking) startTracking(activeJob.id)
    else if (!activeJob && tracking) stopTracking()
  }, [jobs])

  useEffect(() => {
    if (!user) return
    const sub = supabase.channel("driver-active")
      .on("postgres_changes", { event:"*", schema:"public", table:"bookings", filter:`driver_id=eq.${user.id}` }, () => load())
      .subscribe()
    return () => supabase.removeChannel(sub)
  }, [user])

  async function load() {
    const { data } = await supabase.from("bookings")
      .select("*, vehicles(make,model,year,license_plate,color)")
      .eq("driver_id", user.id)
      .not("status", "in", '("completed","cancelled")')
      .order("created_at", { ascending:false })
    setJobs(data||[])

    if (data?.length) {
      const bookingIds = data.map(b=>b.id)
      const { data: reports } = await supabase.from("vehicle_condition_reports")
        .select("booking_id,report_type").in("booking_id", bookingIds)
      const reportMap = {}
      reports?.forEach(r => {
        if (!reportMap[r.booking_id]) reportMap[r.booking_id] = {}
        reportMap[r.booking_id][r.report_type] = true
      })
      setExistingReports(reportMap)
    }
    setLoading(false)
  }

  async function updateStatus(id, status) {
    await supabase.from("bookings").update({ status }).eq("id",id).eq("driver_id",user.id)
    toast.success(`Status updated to ${status}`)
    load()
  }

  async function shareLocation(bookingId) {
    getCurrentPosition().then(async pos => { pos = { coords: { latitude: pos.latitude, longitude: pos.longitude } };
      const { data: booking } = await supabase.from("bookings").select("assigned_mechanic_id").eq("id",bookingId).single()
      if (booking?.assigned_mechanic_id) {
        await supabase.from("mechanic_location_history").insert({
          mechanic_id: booking.assigned_mechanic_id,
          booking_id: bookingId,
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        })
        await supabase.from("mechanics").update({
          current_latitude: pos.coords.latitude,
          current_longitude: pos.coords.longitude,
          last_location_update: new Date().toISOString(),
        }).eq("id", booking.assigned_mechanic_id)
      }
      toast.success("Location shared")
    }, () => toast.error("Could not get location"))
  }

  const SC = { pending:"#e6821e", confirmed:"#378add", "in-progress":"#8b5cf6", "driver-assigned":"#1d9e75", "arrived-for-pickup":"#e6821e", "arrived-at-dropoff":"#8b5cf6" }

  if (showReport) return (
    <div>
      <button onClick={()=>setShowReport(null)} style={{ background:"none", border:"none", color:"#1d9e75", cursor:"pointer", fontSize:13, marginBottom:"1rem", fontFamily:"'DM Sans',sans-serif", padding:0 }}>
        ← Back to active jobs
      </button>
      <VehicleConditionReport
        bookingId={showReport}
        reportType={reportType}
        vehicleInfo={jobs.find(j=>j.id===showReport)?.vehicles ? `${jobs.find(j=>j.id===showReport).vehicles.make} ${jobs.find(j=>j.id===showReport).vehicles.model} — ${jobs.find(j=>j.id===showReport).vehicles.license_plate}` : ""}
        onComplete={()=>{ setShowReport(null); load() }}
      />
    </div>
  )

  return (
    <div>
      <div style={{ fontFamily:"Syne", fontSize:isMobile?16:18, fontWeight:800, color:"#000000", marginBottom:4 }}>
        {language==="sw"?"Usafirishaji Unaoendelea":"Active Deliveries"}
      </div>
      <div style={{ fontSize:12, color:"#777777", marginBottom:"1.25rem" }}>
        {jobs.length} active job{jobs.length!==1?"s":""}
      </div>

      {/* GPS Tracking Banner */}
      {tracking&&(
        <div style={{ background:"#f0fdf4", border:"1px solid #1d9e7530", borderRadius:10, padding:"8px 12px", marginBottom:"1rem", display:"flex", alignItems:"center", gap:8 }}>
          <span style={{ width:8, height:8, borderRadius:"50%", background:"#1d9e75", display:"inline-block", boxShadow:"0 0 6px #1d9e75" }}/>
          <span style={{ fontSize:12, color:"#1d9e75", fontWeight:600 }}>Live location sharing — customer can track you</span>
        </div>
      )}

      {loading&&<div style={{ color:"#777777", fontSize:13 }}>Loading...</div>}
      {!loading&&jobs.length===0&&(
        <div style={{ color:"#888888", fontSize:13, textAlign:"center", padding:"3rem" }}>
          <div style={{ fontSize:32, marginBottom:10 }}>🚗</div>
          No active deliveries
        </div>
      )}

      {jobs.map(job=>{
        const reports = existingReports[job.id]||{}
        const hasPickup = reports.pickup
        const hasDropoff = reports.dropoff
        const vehicle = job.vehicles
        return (
          <div key={job.id} style={{ background:"#ffffff", border:`1px solid ${SC[job.status]||"#eeeeee"}30`, borderRadius:12, padding:isMobile?"0.9rem":"1.1rem", marginBottom:10 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:isMobile?14:15, fontWeight:600, color:"#000000", marginBottom:4 }}>{job.service_name}</div>
                <div style={{ fontSize:11, color:"#777777", marginBottom:4 }}>#{job.booking_number} · {job.booking_date}</div>
                {vehicle&&(
                  <div style={{ fontSize:11, color:"#378add", marginBottom:4 }}>
                    🚗 {vehicle.make} {vehicle.model} {vehicle.year} — {vehicle.license_plate}
                    {vehicle.color&&` · ${vehicle.color}`}
                  </div>
                )}
                <span style={{ fontSize:10, padding:"2px 8px", borderRadius:10, background:`${SC[job.status]||"#888"}20`, color:SC[job.status]||"#888" }}>{job.status}</span>
              </div>
              <div style={{ fontFamily:"Syne", fontSize:13, fontWeight:700, color:"#1d9e75", flexShrink:0 }}>
                KES {Number(job.driver_earnings||0).toLocaleString()}
              </div>
            </div>

            {/* Condition report status */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:10 }}>
              <div style={{ background:hasPickup?"#f0fdf4":"#ffffff", border:`1px solid ${hasPickup?"#1d9e7540":"#f5f5f5"}`, borderRadius:8, padding:"0.6rem", textAlign:"center" }}>
                <div style={{ fontSize:10, color:hasPickup?"#1d9e75":"#555" }}>Pickup report</div>
                <div style={{ fontSize:12, fontWeight:600, color:hasPickup?"#1d9e75":"#444" }}>{hasPickup?"✓ Done":"Pending"}</div>
              </div>
              <div style={{ background:hasDropoff?"#f0fdf4":"#ffffff", border:`1px solid ${hasDropoff?"#1d9e7540":"#f5f5f5"}`, borderRadius:8, padding:"0.6rem", textAlign:"center" }}>
                <div style={{ fontSize:10, color:hasDropoff?"#1d9e75":"#555" }}>Dropoff report</div>
                <div style={{ fontSize:12, fontWeight:600, color:hasDropoff?"#1d9e75":"#444" }}>{hasDropoff?"✓ Done":"Pending"}</div>
              </div>
            </div>

            <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
              {!hasPickup&&(
                <button onClick={()=>{ setShowReport(job.id); setReportType("pickup") }}
                  style={{ background:"#eff6ff", border:"1px solid #378add40", borderRadius:7, color:"#378add", fontSize:11, padding:"6px 12px", cursor:"pointer" }}>
                  📋 Pickup report
                </button>
              )}
              {hasPickup&&!hasDropoff&&(
                <button onClick={()=>{ setShowReport(job.id); setReportType("dropoff") }}
                  style={{ background:"#f0fdf4", border:"1px solid #1d9e7540", borderRadius:7, color:"#1d9e75", fontSize:11, padding:"6px 12px", cursor:"pointer" }}>
                  📋 Dropoff report
                </button>
              )}
              <button onClick={()=>shareLocation(job.id)}
                style={{ background:"#faf5ff", border:"1px solid #8b5cf640", borderRadius:7, color:"#8b5cf6", fontSize:11, padding:"6px 12px", cursor:"pointer" }}>
                📍 Share location
              </button>
              {job.status==="driver-assigned"&&(
                <button onClick={()=>updateStatus(job.id,"arrived-for-pickup")}
                  style={{ background:"#fff8f0", border:"1px solid #e6821e40", borderRadius:7, color:"#e6821e", fontSize:11, padding:"6px 12px", cursor:"pointer" }}>
                  Arrived for pickup
                </button>
              )}
              {job.status==="arrived-for-pickup"&&hasPickup&&(
                <button onClick={()=>updateStatus(job.id,"in-progress")}
                  style={{ background:"#f0fdf4", border:"1px solid #1d9e7540", borderRadius:7, color:"#1d9e75", fontSize:11, padding:"6px 12px", cursor:"pointer" }}>
                  Start delivery
                </button>
              )}
              {job.status==="in-progress"&&(
                <button onClick={()=>updateStatus(job.id,"arrived-at-dropoff")}
                  style={{ background:"#faf5ff", border:"1px solid #8b5cf640", borderRadius:7, color:"#8b5cf6", fontSize:11, padding:"6px 12px", cursor:"pointer" }}>
                  Arrived at dropoff
                </button>
              )}
              {job.status==="arrived-at-dropoff"&&hasDropoff&&(
                <button onClick={()=>updateStatus(job.id,"completed")}
                  style={{ background:"#f0fdf4", border:"1px solid #1d9e7540", borderRadius:7, color:"#1d9e75", fontSize:11, padding:"6px 12px", cursor:"pointer" }}>
                  ✓ Complete delivery
                </button>
              )}
            </div>

            {!hasPickup&&job.status!=="pending"&&(
              <div style={{ marginTop:8, padding:"6px 10px", background:"#fff8f0", borderRadius:7, fontSize:11, color:"#e6821e" }}>
                ⚠️ Please complete pickup condition report before starting delivery
              </div>
            )}
            {hasPickup&&!hasDropoff&&job.status==="arrived-at-dropoff"&&(
              <div style={{ marginTop:8, padding:"6px 10px", background:"#eff6ff", borderRadius:7, fontSize:11, color:"#378add" }}>
                📋 Please complete dropoff condition report to finish delivery
              </div>
            )}
          </div>
        )
      })}

      {/* Panic button for active jobs */}
      {jobs.filter(j=>j.delivery_status==="picked_up"||j.delivery_status==="in_transit").map(job=>(
        <div key={job.id+"panic"} style={{ marginBottom:10 }}>
          <button onClick={()=>sendPanic(job)} disabled={panicLoading}
            style={{ width:"100%", background:panicLoading?"#888":"#e24b4a", border:"none", borderRadius:10, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:13, fontWeight:800, padding:"12px", cursor:panicLoading?"not-allowed":"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
            <span style={{ fontSize:18 }}>🚨</span>
            {panicLoading?"Sending alert...":"PANIC — Send Emergency Alert"}
          </button>
        </div>
      ))}
    </div>
  )
}





