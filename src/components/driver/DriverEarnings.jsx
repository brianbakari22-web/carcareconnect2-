import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"
import { useAuth } from "../../contexts/AuthContext"
import useIsMobile from "../../lib/useIsMobile"

export default function DriverEarnings() {
  const { user } = useAuth()
  const isMobile = useIsMobile()
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState("week")

  useEffect(() => { if (user) load() }, [user])

  async function load() {
    const { data } = await supabase.from("bookings")
      .select("*, vehicles(make,model,license_plate)")
      .eq("driver_id", user.id)
      .eq("status", "completed")
      .order("created_at", { ascending:false })
    setBookings(data||[])
    setLoading(false)
  }

  function filterByPeriod(bks) {
    const now = new Date()
    if (period==="today") {
      const today = now.toISOString().split("T")[0]
      return bks.filter(b=>b.booking_date===today)
    }
    if (period==="week") {
      const weekAgo = new Date(now-7*24*60*60*1000)
      return bks.filter(b=>new Date(b.booking_date)>=weekAgo)
    }
    if (period==="month") {
      const monthAgo = new Date(now-30*24*60*60*1000)
      return bks.filter(b=>new Date(b.booking_date)>=monthAgo)
    }
    return bks
  }

  const filtered = filterByPeriod(bookings)
  const totalEarnings = filtered.reduce((s,b)=>s+Number(b.driver_earnings||0),0)
  const totalJobs = filtered.length
  const avgPerJob = totalJobs ? (totalEarnings/totalJobs).toFixed(0) : 0

  return (
    <div>
      <div style={{ fontFamily:"Syne", fontSize:isMobile?16:18, fontWeight:800, color:"#f0ede6", marginBottom:"1.25rem" }}>Earnings & History</div>

      {/* Period filter */}
      <div style={{ display:"flex", gap:6, marginBottom:"1.25rem" }}>
        {["today","week","month","all"].map(p=>(
          <button key={p} onClick={()=>setPeriod(p)}
            style={{ padding:"7px 16px", borderRadius:8, border:"none", fontSize:12, cursor:"pointer", background:period===p?"#1d9e75":"#111", color:period===p?"#fff":"#666", fontFamily:"'DM Sans',sans-serif", fontWeight:period===p?700:400 }}>
            {p==="today"?"Today":p==="week"?"This week":p==="month"?"This month":"All time"}
          </button>
        ))}
      </div>

      {/* Stats */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10, marginBottom:"1.5rem" }}>
        {[
          { label:"Total earned", value:`KES ${Number(totalEarnings).toLocaleString()}`, color:"#1d9e75" },
          { label:"Jobs done", value:totalJobs, color:"#378add" },
          { label:"Avg per job", value:`KES ${Number(avgPerJob).toLocaleString()}`, color:"#e6821e" },
        ].map(s=>(
          <div key={s.label} style={{ background:"#111", borderRadius:10, padding:isMobile?"0.75rem":"1rem", border:"1px solid #1e1e1e", textAlign:"center" }}>
            <div style={{ fontFamily:"Syne", fontSize:isMobile?14:18, fontWeight:800, color:s.color }}>{s.value}</div>
            <div style={{ fontSize:10, color:"#555", marginTop:2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* History list */}
      {loading&&<div style={{ color:"#555", fontSize:13 }}>Loading...</div>}
      {!loading&&filtered.length===0&&(
        <div style={{ color:"#444", fontSize:13, textAlign:"center", padding:"2rem" }}>
          <div style={{ fontSize:32, marginBottom:10 }}>💰</div>
          No completed jobs for this period
        </div>
      )}

      {filtered.map(b=>(
        <div key={b.id} style={{ background:"#111", border:"1px solid #1e1e1e", borderRadius:10, padding:isMobile?"0.75rem":"1rem", marginBottom:8 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:13, fontWeight:600, color:"#f0ede6", marginBottom:2 }}>{b.service_name}</div>
              <div style={{ fontSize:11, color:"#555", marginBottom:2 }}>#{b.booking_number} · {b.booking_date}</div>
              {b.vehicles&&<div style={{ fontSize:11, color:"#378add" }}>🚗 {b.vehicles.make} {b.vehicles.model} — {b.vehicles.license_plate}</div>}
            </div>
            <div style={{ textAlign:"right", flexShrink:0 }}>
              <div style={{ fontFamily:"Syne", fontSize:15, fontWeight:800, color:"#1d9e75" }}>KES {Number(b.driver_earnings||0).toLocaleString()}</div>
              <div style={{ fontSize:10, color:b.payment_status==="paid"?"#1d9e75":"#e6821e", marginTop:2 }}>{b.payment_status}</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
