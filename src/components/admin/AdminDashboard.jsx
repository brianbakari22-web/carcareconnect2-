import useIsMobile from "../../lib/useIsMobile"
import { useEffect, useState, useRef } from "react"
import { supabase } from "../../lib/supabase"
import toast from "react-hot-toast"

function NetworkCanvas() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    let animId

    const resize = () => {
      canvas.width = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
    }
    resize()
    window.addEventListener("resize", resize)

    const DOTS = 60
    const dots = Array.from({ length: DOTS }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      r: Math.random() * 2 + 1,
    }))

    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      dots.forEach(d => {
        d.x += d.vx
        d.y += d.vy
        if (d.x < 0 || d.x > canvas.width) d.vx *= -1
        if (d.y < 0 || d.y > canvas.height) d.vy *= -1

        ctx.beginPath()
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2)
        ctx.fillStyle = "rgba(230,130,30,0.6)"
        ctx.fill()
      })

      for (let i = 0; i < dots.length; i++) {
        for (let j = i + 1; j < dots.length; j++) {
          const dx = dots[i].x - dots[j].x
          const dy = dots[i].y - dots[j].y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < 100) {
            ctx.beginPath()
            ctx.moveTo(dots[i].x, dots[i].y)
            ctx.lineTo(dots[j].x, dots[j].y)
            ctx.strokeStyle = `rgba(230,130,30,${0.15 * (1 - dist / 100)})`
            ctx.lineWidth = 0.5
            ctx.stroke()
          }
        }
      }
      animId = requestAnimationFrame(draw)
    }
    draw()
    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener("resize", resize)
    }
  }, [])

  return (
    <canvas ref={canvasRef} style={{ position:"absolute", inset:0, width:"100%", height:"100%", opacity:0.4 }}/>
  )
}

export default function AdminDashboard() {
  const isMobile = useIsMobile()
  const [stats, setStats] = useState({ users:0, providers:0, drivers:0, customers:0, bookings:0, revenue:0, pending:0, completed:0 })
  const [onlineDrivers, setOnlineDrivers] = useState(0)
  const [activity, setActivity] = useState([])
  const [bookingTrend, setBookingTrend] = useState([])
  const [userGrowth, setUserGrowth] = useState([])
  const [loading, setLoading] = useState(true)
  const [time, setTime] = useState(new Date())

  useEffect(() => {
    load()
    const tick = setInterval(() => setTime(new Date()), 1000)
    const sub = supabase.channel("admin-live")
      .on("postgres_changes", { event:"*", schema:"public", table:"bookings" }, () => load())
      .on("postgres_changes", { event:"*", schema:"public", table:"profiles" }, () => load())
      .on("postgres_changes", { event:"*", schema:"public", table:"driver_status" }, () => loadOnlineDrivers())
      .subscribe()
    return () => { supabase.removeChannel(sub); clearInterval(tick) }
  }, [])

  async function loadOnlineDrivers() {
    const { count } = await supabase.from("driver_status").select("*", { count:"exact", head:true }).eq("is_online", true)
    setOnlineDrivers(count||0)
  }

  async function load() {
    const [
      { data: profiles },
      { data: bookings },
      { data: driverStatus },
      { data: recentBookings },
      { data: recentUsers },
    ] = await Promise.all([
      supabase.from("profiles").select("role,created_at,is_active"),
      supabase.from("bookings").select("status,total_amount,created_at,booking_date,service_name,customer_id"),
      supabase.from("driver_status").select("is_online").eq("is_online", true),
      supabase.from("bookings").select("id,service_name,status,total_amount,created_at").order("created_at",{ascending:false}).limit(8),
      supabase.from("profiles").select("id,first_name,last_name,role,created_at").order("created_at",{ascending:false}).limit(5),
    ])

    const ps = profiles||[]
    const bks = bookings||[]
    const completed = bks.filter(b=>b.status==="completed")

    setStats({
      users: ps.length,
      customers: ps.filter(p=>p.role==="customer").length,
      providers: ps.filter(p=>p.role==="provider").length,
      drivers: ps.filter(p=>p.role==="driver").length,
      bookings: bks.length,
      revenue: completed.reduce((s,b)=>s+Number(b.total_amount)*0.15,0),
      pending: bks.filter(b=>b.status==="pending").length,
      completed: completed.length,
    })

    setOnlineDrivers(driverStatus?.length||0)

    const feed = [
      ...(recentBookings||[]).map(b=>({
        type:"booking",
        text:`Booking: ${b.service_name}`,
        sub: b.status,
        time: b.created_at,
        tag: b.status==="completed"?"Completed":b.status==="cancelled"?"Cancelled":"Pending",
        icon:"📅"
      })),
      ...(recentUsers||[]).map(u=>({
        type:"user",
        text:`New ${u.role}: ${u.first_name} ${u.last_name}`,
        sub:"registered",
        time: u.created_at,
        tag: u.role,
        icon:"👤"
      })),
    ].sort((a,b)=>new Date(b.time)-new Date(a.time)).slice(0,10)
    setActivity(feed)

    const byMonth = bks.reduce((acc,b) => {
      const m = b.created_at?.slice(0,7)
      if (!m) return acc
      if (!acc[m]) acc[m] = { month:m, total:0, completed:0, cancelled:0, pending:0 }
      acc[m].total++
      if (b.status==="completed") acc[m].completed++
      else if (b.status==="cancelled") acc[m].cancelled++
      else acc[m].pending++
      return acc
    }, {})
    setBookingTrend(Object.values(byMonth).sort((a,b)=>a.month.localeCompare(b.month)).slice(-6))

    const byUserMonth = ps.reduce((acc,p) => {
      const m = p.created_at?.slice(0,7)
      if (!m) return acc
      if (!acc[m]) acc[m] = { month:m, total:0, customers:0, providers:0, drivers:0 }
      acc[m].total++
      if (p.role==="customer") acc[m].customers++
      else if (p.role==="provider") acc[m].providers++
      else if (p.role==="driver") acc[m].drivers++
      return acc
    }, {})
    setUserGrowth(Object.values(byUserMonth).sort((a,b)=>a.month.localeCompare(b.month)).slice(-6))

    setLoading(false)
  }

  const maxBookings = Math.max(...bookingTrend.map(m=>m.total), 1)
  const maxUsers = Math.max(...userGrowth.map(m=>m.total), 1)

  function shortMonth(monthStr) {
    return new Date(monthStr+"-01").toLocaleString("default",{month:"short",year:"2-digit"})
  }

  return (
    <div>
      {/* Hero Banner with Network Animation */}
      <div style={{ position:"relative", background:"#0f0f0f", border:"1px solid #1e1e1e", borderRadius:16, overflow:"hidden", marginBottom:"1.5rem", minHeight:160 }}>
        <NetworkCanvas />
        <div style={{ position:"relative", zIndex:1, padding:"2rem 1.5rem", display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:16 }}>
          <div>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
              <div style={{ width:8, height:8, borderRadius:"50%", background:"#1d9e75", boxShadow:"0 0 8px #1d9e75" }}/>
              <span style={{ fontSize:11, color:"#1d9e75", fontWeight:600, letterSpacing:"0.08em", textTransform:"uppercase" }}>Platform live</span>
            </div>
            <div style={{ fontFamily:"Syne", fontSize:26, fontWeight:800, color:"#f0ede6", marginBottom:4 }}>
              Car<span style={{ color:"#e6821e" }}>Care</span> Connect
            </div>
            <div style={{ fontSize:12, color:"#555" }}>Admin Control Center · Nairobi, Kenya</div>
          </div>
          <div style={{ textAlign:"right" }}>
            <div style={{ fontFamily:"Syne", fontSize:28, fontWeight:800, color:"#e6821e", letterSpacing:2 }}>
              {time.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit",second:"2-digit"})}
            </div>
            <div style={{ fontSize:11, color:"#555", marginTop:2 }}>
              {time.toLocaleDateString("default",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:6, justifyContent:"flex-end", marginTop:6 }}>
              <div style={{ width:6, height:6, borderRadius:"50%", background:onlineDrivers>0?"#1d9e75":"#555" }}/>
              <span style={{ fontSize:11, color:onlineDrivers>0?"#1d9e75":"#555" }}>
                {onlineDrivers} driver{onlineDrivers!==1?"s":""} online
              </span>
            </div>
          </div>
        </div>

        {/* Live stat strip */}
        <div style={{ position:"relative", zIndex:1, display:"grid", gridTemplateColumns:isMobile?"repeat(2,1fr)":"repeat(4,1fr)", borderTop:"1px solid #1e1e1e" }}>
          {[
            { label:"Platform revenue", value:`$${stats.revenue.toFixed(2)}`, color:"#e6821e" },
            { label:"Total bookings", value:stats.bookings, color:"#f0ede6" },
            { label:"Pending now", value:stats.pending, color:stats.pending>0?"#e6821e":"#f0ede6" },
            { label:"Total users", value:stats.users, color:"#f0ede6" },
          ].map((s,i)=>(
            <div key={s.label} style={{ padding:"0.9rem 1.25rem", borderRight:i<3?"1px solid #1e1e1e":"none" }}>
              <div style={{ fontSize:10, color:"#555", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:4 }}>{s.label}</div>
              <div style={{ fontFamily:"Syne", fontSize:18, fontWeight:800, color:s.color }}>{s.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Secondary stats */}
      <div style={{ display:"grid", gridTemplateColumns:isMobile?"repeat(2,1fr)":"repeat(4,1fr)", gap:10, marginBottom:"1.5rem" }}>
        {[
          { label:"Customers", value:stats.customers, color:"#e6821e" },
          { label:"Providers", value:stats.providers, color:"#378add" },
          { label:"Drivers", value:stats.drivers, color:"#1d9e75" },
          { label:"Completed", value:stats.completed, color:"#1d9e75" },
        ].map(s=>(
          <div key={s.label} style={{ background:"#111", borderRadius:10, padding:"1rem", border:"1px solid #1e1e1e" }}>
            <div style={{ fontSize:10, color:"#555", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:4 }}>{s.label}</div>
            <div style={{ fontFamily:"Syne", fontSize:20, fontWeight:800, color:s.color||"#f0ede6" }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:10, marginBottom:"1.5rem" }}>
        <div style={{ background:"#111", border:"1px solid #1e1e1e", borderRadius:12, padding:"1.25rem" }}>
          <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:700, marginBottom:4, color:"#f0ede6" }}>Booking trend</div>
          <div style={{ fontSize:11, color:"#555", marginBottom:"1rem" }}>Total · Completed · Cancelled per month</div>
          {bookingTrend.length===0&&<div style={{ color:"#444", fontSize:12 }}>No data yet</div>}
          <div style={{ display:"flex", gap:8, alignItems:"flex-end" }}>
            {bookingTrend.map(m=>(
              <div key={m.month} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:3 }}>
                <div style={{ fontSize:9, color:"#666", fontWeight:600 }}>{m.total}</div>
                <div style={{ width:"100%", display:"flex", flexDirection:"column", gap:1 }}>
                  <div style={{ width:"100%", background:"#f0ede6", borderRadius:"2px 2px 0 0", height:`${Math.max(2,(m.completed/maxBookings)*60)}px`, transition:"height 0.5s" }}/>
                  <div style={{ width:"100%", background:"#555", height:`${Math.max(2,(m.pending/maxBookings)*60)}px`, transition:"height 0.5s" }}/>
                  <div style={{ width:"100%", background:"#333", height:`${Math.max(m.cancelled>0?2:0,(m.cancelled/maxBookings)*60)}px`, transition:"height 0.5s" }}/>
                </div>
                <div style={{ fontSize:8, color:"#555", textAlign:"center" }}>{shortMonth(m.month)}</div>
              </div>
            ))}
          </div>
          <div style={{ display:"flex", gap:12, marginTop:10 }}>
            {[{label:"Completed",bg:"#f0ede6"},{label:"Pending",bg:"#555"},{label:"Cancelled",bg:"#333"}].map(l=>(
              <div key={l.label} style={{ display:"flex", alignItems:"center", gap:4 }}>
                <div style={{ width:10, height:10, background:l.bg, borderRadius:2 }}/>
                <span style={{ fontSize:10, color:"#555" }}>{l.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ background:"#111", border:"1px solid #1e1e1e", borderRadius:12, padding:"1.25rem" }}>
          <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:700, marginBottom:4, color:"#f0ede6" }}>User growth</div>
          <div style={{ fontSize:11, color:"#555", marginBottom:"1rem" }}>Customers · Providers · Drivers per month</div>
          {userGrowth.length===0&&<div style={{ color:"#444", fontSize:12 }}>No data yet</div>}
          <div style={{ display:"flex", gap:8, alignItems:"flex-end" }}>
            {userGrowth.map(m=>(
              <div key={m.month} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:3 }}>
                <div style={{ fontSize:9, color:"#666", fontWeight:600 }}>{m.total}</div>
                <div style={{ width:"100%", display:"flex", flexDirection:"column", gap:1 }}>
                  <div style={{ width:"100%", background:"#f0ede6", borderRadius:"2px 2px 0 0", height:`${Math.max(2,(m.customers/maxUsers)*60)}px`, transition:"height 0.5s" }}/>
                  <div style={{ width:"100%", background:"#888", height:`${Math.max(2,(m.providers/maxUsers)*60)}px`, transition:"height 0.5s" }}/>
                  <div style={{ width:"100%", background:"#444", height:`${Math.max(m.drivers>0?2:0,(m.drivers/maxUsers)*60)}px`, transition:"height 0.5s" }}/>
                </div>
                <div style={{ fontSize:8, color:"#555", textAlign:"center" }}>{shortMonth(m.month)}</div>
              </div>
            ))}
          </div>
          <div style={{ display:"flex", gap:12, marginTop:10 }}>
            {[{label:"Customers",bg:"#f0ede6"},{label:"Providers",bg:"#888"},{label:"Drivers",bg:"#444"}].map(l=>(
              <div key={l.label} style={{ display:"flex", alignItems:"center", gap:4 }}>
                <div style={{ width:10, height:10, background:l.bg, borderRadius:2 }}/>
                <span style={{ fontSize:10, color:"#555" }}>{l.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Activity feed */}
      <div style={{ background:"#111", border:"1px solid #1e1e1e", borderRadius:12, padding:"1.25rem" }}>
        <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:700, marginBottom:"1rem", color:"#f0ede6", display:"flex", alignItems:"center", gap:8 }}>
          <div style={{ width:8, height:8, borderRadius:"50%", background:"#e6821e", boxShadow:"0 0 6px #e6821e" }}/>
          Live activity feed
        </div>
        {loading&&<div style={{ color:"#555", fontSize:13 }}>Loading...</div>}
        {!loading&&activity.length===0&&<div style={{ color:"#444", fontSize:13 }}>No activity yet</div>}
        {activity.map((a,i)=>(
          <div key={i} style={{ display:"flex", alignItems:"center", gap:12, padding:"8px 0", borderBottom:"1px solid #1a1a1a" }}>
            <div style={{ width:32, height:32, borderRadius:8, background:"#1a1a1a", display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, flexShrink:0 }}>
              {a.icon}
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:12, color:"#f0ede6", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{a.text}</div>
              <div style={{ fontSize:10, color:"#555", marginTop:1 }}>{a.sub}</div>
            </div>
            <div style={{ flexShrink:0, textAlign:"right" }}>
              <div style={{ fontSize:10, padding:"2px 8px", borderRadius:10, background:"#1a1a1a", color:"#888", border:"1px solid #2a2a2a", marginBottom:2 }}>{a.tag}</div>
              <div style={{ fontSize:10, color:"#444" }}>{new Date(a.time).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

