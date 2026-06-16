import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"
import { useAuth } from "../../contexts/AuthContext"
import useIsMobile from "../../lib/useIsMobile"

export default function DriverPerformance() {
  const { user, profile } = useAuth()
  const isMobile = useIsMobile()
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [recentJobs, setRecentJobs] = useState([])

  useEffect(() => { if (user) load() }, [user])

  async function load() {
    const [{ data: bks }, { data: revs }, { data: status }] = await Promise.all([
      supabase.from("bookings").select("status,total_amount,created_at,service_name").eq("driver_id", user.id),
      supabase.from("reviews").select("driver_rating,driver_review,created_at").eq("driver_id", user.id).order("created_at",{ascending:false}),
      supabase.from("driver_status").select("*").eq("driver_id", user.id).single(),
    ])
    const all = bks||[]
    const completed = all.filter(b=>b.status==="completed")
    const cancelled = all.filter(b=>b.status==="cancelled")
    const avgRating = revs?.length ? (revs.reduce((s,r)=>s+Number(r.driver_rating||0),0)/revs.length).toFixed(1) : "—"
    const acceptanceRate = all.length ? Math.round((completed.length/all.length)*100) : 0
    const completionRate = all.length ? Math.round(((all.length-cancelled.length)/all.length)*100) : 0
    setStats({
      total: all.length,
      completed: completed.length,
      cancelled: cancelled.length,
      avgRating,
      acceptanceRate,
      completionRate,
      noShows: status?.no_show_count||0,
      totalEarnings: completed.reduce((s,b)=>s+Number(b.driver_earnings||0),0),
      onlineHours: 0,
    })
    setRecentJobs(all.slice(0,10))
    setLoading(false)
  }

  const vehicleConfig = {
    car: { icon:"🚗", label:"Car Driver" },
    motorcycle: { icon:"🏍️", label:"Boda Boda" },
    tuktuk: { icon:"🛺", label:"Tuktuk" },
    van: { icon:"🚐", label:"Van Driver" },
  }
  const vc = vehicleConfig[profile?.driver_vehicle_type||"car"]

  if (loading) return <div style={{ color:"#777777", fontSize:13 }}>Loading...</div>

  return (
    <div>
      <div style={{ fontFamily:"Syne", fontSize:isMobile?16:20, fontWeight:800, color:"#000000", marginBottom:4 }}>Performance</div>
      <div style={{ fontSize:12, color:"#777777", marginBottom:"1.5rem" }}>Your driving stats and ratings</div>

      {/* Rating highlight */}
      <div style={{ background:"#fff8f0", border:"1px solid #e6821e30", borderRadius:16, padding:"1.5rem", marginBottom:"1.5rem", textAlign:"center" }}>
        <div style={{ fontFamily:"Syne", fontSize:48, fontWeight:800, color:"#e6821e" }}>{stats.avgRating}</div>
        <div style={{ fontSize:13, color:"#555555", marginBottom:4 }}>Average rating</div>
        <div style={{ fontSize:12, color:"#777777" }}>{vc.icon} {vc.label}</div>
      </div>

      {/* Stats grid */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:10, marginBottom:"1.5rem" }}>
        {[
          { label:"Total jobs", value:stats.total, color:"#000000" },
          { label:"Completed", value:stats.completed, color:"#1d9e75" },
          { label:"Acceptance rate", value:stats.acceptanceRate+"%", color:stats.acceptanceRate>=80?"#1d9e75":"#e6821e" },
          { label:"Completion rate", value:stats.completionRate+"%", color:stats.completionRate>=90?"#1d9e75":"#e6821e" },
          { label:"No-shows", value:stats.noShows, color:stats.noShows>0?"#e24b4a":"#555" },
          { label:"Total earned", value:"KES "+stats.totalEarnings.toLocaleString(), color:"#8b5cf6" },
        ].map(s=>(
          <div key={s.label} style={{ background:"#ffffff", borderRadius:12, padding:"1rem", border:"1px solid #eeeeee", textAlign:"center" }}>
            <div style={{ fontFamily:"Syne", fontSize:isMobile?18:22, fontWeight:800, color:s.color }}>{s.value}</div>
            <div style={{ fontSize:11, color:"#777777", marginTop:4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Performance indicators */}
      <div style={{ background:"#ffffff", borderRadius:12, padding:"1rem", marginBottom:"1.5rem", border:"1px solid #eeeeee" }}>
        <div style={{ fontFamily:"Syne", fontSize:13, fontWeight:700, color:"#000000", marginBottom:12 }}>Performance indicators</div>
        {[
          { label:"Rating", value:parseFloat(stats.avgRating)||0, max:5, good:4.0, color:"#e6821e" },
          { label:"Acceptance rate", value:stats.acceptanceRate, max:100, good:80, color:"#1d9e75" },
          { label:"Completion rate", value:stats.completionRate, max:100, good:90, color:"#378add" },
        ].map(ind=>(
          <div key={ind.label} style={{ marginBottom:12 }}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
              <span style={{ fontSize:12, color:"#555555" }}>{ind.label}</span>
              <span style={{ fontSize:12, color:ind.value>=ind.good?ind.color:"#e24b4a", fontWeight:600 }}>{ind.label==="Rating"?ind.value+"/5":ind.value+"%"}</span>
            </div>
            <div style={{ background:"#f0f0f0", borderRadius:4, height:6, overflow:"hidden" }}>
              <div style={{ width:(ind.value/ind.max*100)+"%", height:"100%", background:ind.value>=ind.good?ind.color:"#e24b4a", borderRadius:4, transition:"width 0.5s" }}/>
            </div>
          </div>
        ))}
      </div>

      {/* Recent jobs */}
      <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:700, color:"#000000", marginBottom:10 }}>Recent jobs</div>
      {recentJobs.length===0&&<div style={{ color:"#888888", fontSize:13, textAlign:"center", padding:"2rem" }}>No jobs yet</div>}
      {recentJobs.map((job,i)=>(
        <div key={i} style={{ background:"#ffffff", borderRadius:10, padding:"0.75rem", marginBottom:8, display:"flex", justifyContent:"space-between", alignItems:"center", border:"1px solid #eeeeee" }}>
          <div>
            <div style={{ fontSize:13, color:"#000000", marginBottom:2 }}>{job.service_name||"Delivery job"}</div>
            <div style={{ fontSize:11, color:"#777777" }}>{new Date(job.created_at).toLocaleDateString()}</div>
          </div>
          <span style={{ fontSize:11, padding:"3px 10px", borderRadius:20, background:job.status==="completed"?"#f0fdf4":job.status==="cancelled"?"#fff5f5":"#fff8f0", color:job.status==="completed"?"#1d9e75":job.status==="cancelled"?"#e24b4a":"#e6821e" }}>
            {job.status}
          </span>
        </div>
      ))}
    </div>
  )
}

