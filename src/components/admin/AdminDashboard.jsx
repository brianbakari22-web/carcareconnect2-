import useIsMobile from "../../lib/useIsMobile"
import AdminAIMonitor from "./AdminAIMonitor"
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
    const resize = () => { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight }
    resize()
    window.addEventListener("resize", resize)
    const dots = Array.from({ length: 40 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      r: Math.random() * 2 + 1,
    }))
    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      dots.forEach(d => {
        d.x += d.vx; d.y += d.vy
        if (d.x < 0 || d.x > canvas.width) d.vx *= -1
        if (d.y < 0 || d.y > canvas.height) d.vy *= -1
        ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2)
        ctx.fillStyle = "rgba(230,130,30,0.6)"; ctx.fill()
      })
      for (let i = 0; i < dots.length; i++) {
        for (let j = i + 1; j < dots.length; j++) {
          const dx = dots[i].x - dots[j].x
          const dy = dots[i].y - dots[j].y
          const dist = Math.sqrt(dx*dx + dy*dy)
          if (dist < 100) {
            ctx.beginPath(); ctx.moveTo(dots[i].x, dots[i].y); ctx.lineTo(dots[j].x, dots[j].y)
            ctx.strokeStyle = `rgba(230,130,30,${0.15*(1-dist/100)})`; ctx.lineWidth = 0.5; ctx.stroke()
          }
        }
      }
      animId = requestAnimationFrame(draw)
    }
    draw()
    return () => { cancelAnimationFrame(animId); window.removeEventListener("resize", resize) }
  }, [])
  return <canvas ref={canvasRef} style={{ position:"absolute", inset:0, width:"100%", height:"100%", opacity:0.4 }}/>
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
    { data: recentOrders },
      { data: inventoryItems },
      { data: commissionRates },
    ] = await Promise.all([
      supabase.from("profiles").select("role,created_at,is_active"),
      supabase.from("bookings").select("status,total_amount,created_at,booking_date,service_name,customer_id"),
      supabase.from("driver_status").select("is_online").eq("is_online", true),
      supabase.from("bookings").select("id,service_name,status,total_amount,created_at").order("created_at",{ascending:false}).limit(8),
      supabase.from("profiles").select("id,first_name,last_name,role,created_at").order("created_at",{ascending:false}).limit(5),
      supabase.from("orders").select("id,status,subtotal,created_at").order("created_at",{ascending:false}).limit(5),
      supabase.from("inventory").select("id,is_active,stock_quantity").eq("is_active",true),
      supabase.from("commission_rates").select("provider_type,platform_rate"),
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
      revenue: completed.reduce((s,b)=>{
        const rateRow = (commissionRates||[]).find(r=>r.provider_type===(b.provider_type||"garage"))
        const rate = rateRow ? rateRow.platform_rate : 0.10
        return s+Number(b.total_amount)*rate
      },0),
      pending: bks.filter(b=>b.status==="pending").length,
      completed: completed.length,
    })
    setOnlineDrivers(driverStatus?.length||0)
    const pendingOrders = (recentOrders||[]).filter(o=>o.status==="pending").length
    const lowStock = (inventoryItems||[]).filter(i=>i.stock_quantity<=5).length
    setStats(s=>({...s, pendingOrders, lowStock, inventoryItems:(inventoryItems||[]).length }))

    const feed = [
      ...(recentBookings||[]).map(b=>({ type:"booking", text:`Booking: ${b.service_name}`, sub:b.status, time:b.created_at, tag:b.status==="completed"?"Completed":b.status==="cancelled"?"Cancelled":"Pending", icon:"📅" })),
      ...(recentUsers||[]).map(u=>({ type:"user", text:`New ${u.role}: ${u.first_name} ${u.last_name}`, sub:"registered", time:u.created_at, tag:u.role, icon:"👤" })),
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
  function shortMonth(m) { return new Date(m+"-01").toLocaleString("default",{month:"short",year:"2-digit"}) }

  return (
    <div>
      {/* QUICK ACTIONS */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))", gap:8, marginBottom:"1.25rem" }}>
        {[
          { icon:"👥", label:"Users", path:"/admin-dashboard/users", color:"#378add", value:stats.users },
          { icon:"📅", label:"Bookings", path:"/admin-dashboard/bookings", color:"#e6821e", value:stats.bookings },
          { icon:"🛒", label:"Orders", path:"/admin-dashboard/orders", color:"#8b5cf6", value:stats.pendingOrders||0 },
          { icon:"📦", label:"Inventory", path:"/admin-dashboard/inventory", color:"#1d9e75", value:stats.inventoryItems||0 },
          { icon:"💰", label:"Revenue", path:"/admin-dashboard/revenue", color:"#e6821e", value:"KES "+(stats.revenue||0).toLocaleString() },
          { icon:"🔬", label:"Diagnostics", path:"/admin-dashboard/diagnostics", color:"#e24b4a", value:"Check" },
        ].map(a=>(
          <a key={a.path} href={a.path} style={{ background:"#f8f8f8", border:`1px solid ${a.color}30`, borderRadius:10, padding:"0.75rem", textDecoration:"none", textAlign:"center", display:"block" }}>
            <div style={{ fontSize:22, marginBottom:4 }}>{a.icon}</div>
            <div style={{ fontFamily:"Syne", fontSize:13, fontWeight:800, color:a.color }}>{a.value}</div>
            <div style={{ fontSize:10, color:"#888", marginTop:2 }}>{a.label}</div>
          </a>
        ))}
      </div>

      {/* Hero Banner */}
      <div style={{ position:"relative", background:"#e6821e", border:"0.5px solid #eee", borderRadius:isMobile?10:16, overflow:"hidden", marginBottom:"1rem" }}>
        <NetworkCanvas />
        <div style={{ position:"relative", zIndex:1, padding:isMobile?"1rem":"2rem 1.5rem", display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:10 }}>
          <div>
            <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:4 }}>
              <div style={{ width:7, height:7, borderRadius:"50%", background:"#1d9e75", boxShadow:"0 0 8px #1d9e75" }}/>
              <span style={{ fontSize:10, color:"#1d9e75", fontWeight:600, letterSpacing:"0.08em", textTransform:"uppercase" }}>Platform live</span>
            </div>
            <div style={{ fontFamily:"Syne", fontSize:isMobile?18:26, fontWeight:800, color:"#000000", marginBottom:2 }}>
              Car<span style={{ color:"#e6821e" }}>Care</span> Connect
            </div>
            <div style={{ fontSize:11, color:"#888" }}>Admin Control Center · Nairobi</div>
          </div>
          <div style={{ textAlign:"right" }}>
            <div style={{ fontFamily:"Syne", fontSize:isMobile?20:28, fontWeight:800, color:"#e6821e", letterSpacing:2 }}>
              {time.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit",second:"2-digit"})}
            </div>
            <div style={{ fontSize:10, color:"#888", marginTop:2 }}>
              {time.toLocaleDateString("default",{weekday:"short",day:"numeric",month:"short"})}
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:4, justifyContent:"flex-end", marginTop:4 }}>
              <div style={{ width:5, height:5, borderRadius:"50%", background:onlineDrivers>0?"#1d9e75":"#555" }}/>
              <span style={{ fontSize:10, color:onlineDrivers>0?"#1d9e75":"#555" }}>{onlineDrivers} driver{onlineDrivers!==1?"s":""} online</span>
            </div>
          </div>
        </div>

        {/* Stat strip */}
        <div style={{ position:"relative", zIndex:1, display:"grid", gridTemplateColumns:"repeat(2,1fr)", borderTop:"1px solid #1e1e1e" }}>
          {[
            { label:"Platform revenue", value:`KES ${stats.revenue.toFixed(2)}`, color:"#e6821e" },
            { label:"Total bookings", value:stats.bookings, color:"#000000" },
            { label:"Pending now", value:stats.pending, color:stats.pending>0?"#e6821e":"#f0ede6" },
            { label:"Total users", value:stats.users, color:"#000000" },
          ].map((s,i)=>(
            <div key={s.label} style={{ padding:isMobile?"0.6rem 0.9rem":"0.9rem 1.25rem", borderRight:i%2===0?"1px solid rgba(255,255,255,0.2)":"none", borderBottom:i<2?"1px solid rgba(255,255,255,0.2)":"none" }}>
              <div style={{ fontSize:9, color:"#888", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:3 }}>{s.label}</div>
              <div style={{ fontFamily:"Syne", fontSize:isMobile?15:18, fontWeight:800, color:s.color }}>{s.value}</div>
            </div>
          ))}
        </div>
      </div>
      <AdminAIMonitor />

      {/* Secondary stats */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:8, marginBottom:"1rem" }}>
        {[
          { label:"Customers", value:stats.customers, color:"#e6821e" },
          { label:"Providers", value:stats.providers, color:"#378add" },
          { label:"Drivers", value:stats.drivers, color:"#1d9e75" },
          { label:"Completed", value:stats.completed, color:"#1d9e75" },
        ].map(s=>(
          <div key={s.label} style={{ background:"#f8f8f8", borderRadius:10, padding:isMobile?"0.7rem":"1rem", border:"0.5px solid #eee" }}>
            <div style={{ fontSize:9, color:"#888", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:3 }}>{s.label}</div>
            <div style={{ fontFamily:"Syne", fontSize:isMobile?16:20, fontWeight:800, color:s.color||"#ffffff" }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:8, marginBottom:"1rem" }}>
        <div style={{ background:"#f8f8f8", border:"0.5px solid #eee", borderRadius:12, padding:"1rem" }}>
          <div style={{ fontFamily:"Syne", fontSize:13, fontWeight:700, marginBottom:2, color:"#000000" }}>Booking trend</div>
          <div style={{ fontSize:10, color:"#888", marginBottom:"0.75rem" }}>Per month</div>
          {bookingTrend.length===0&&<div style={{ color:"#aaa", fontSize:12 }}>No data yet</div>}
          <div style={{ display:"flex", gap:6, alignItems:"flex-end" }}>
            {bookingTrend.map(m=>(
              <div key={m.month} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:2 }}>
                <div style={{ fontSize:8, color:"#666", fontWeight:600 }}>{m.total}</div>
                <div style={{ width:"100%", display:"flex", flexDirection:"column", gap:1 }}>
                  <div style={{ width:"100%", background:"#1d9e75", borderRadius:"2px 2px 0 0", height:`${Math.max(2,(m.completed/maxBookings)*50)}px` }}/>
                  <div style={{ width:"100%", background:"#e6821e", height:`${Math.max(2,(m.pending/maxBookings)*50)}px` }}/>
                  <div style={{ width:"100%", background:"#e24b4a", height:`${Math.max(m.cancelled>0?2:0,(m.cancelled/maxBookings)*50)}px` }}/>
                </div>
                <div style={{ fontSize:7, color:"#888", textAlign:"center" }}>{shortMonth(m.month)}</div>
              </div>
            ))}
          </div>
          <div style={{ display:"flex", gap:8, marginTop:8, flexWrap:"wrap" }}>
            {[{label:"Done",bg:"#1d9e75"},{label:"Pending",bg:"#e6821e"},{label:"Cancelled",bg:"#e24b4a"}].map(l=>(
              <div key={l.label} style={{ display:"flex", alignItems:"center", gap:3 }}>
                <div style={{ width:8, height:8, background:l.bg, borderRadius:2 }}/>
                <span style={{ fontSize:9, color:"#888" }}>{l.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ background:"#f8f8f8", border:"0.5px solid #eee", borderRadius:12, padding:"1rem" }}>
          <div style={{ fontFamily:"Syne", fontSize:13, fontWeight:700, marginBottom:2, color:"#000000" }}>User growth</div>
          <div style={{ fontSize:10, color:"#888", marginBottom:"0.75rem" }}>Per month</div>
          {userGrowth.length===0&&<div style={{ color:"#aaa", fontSize:12 }}>No data yet</div>}
          <div style={{ display:"flex", gap:6, alignItems:"flex-end" }}>
            {userGrowth.map(m=>(
              <div key={m.month} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:2 }}>
                <div style={{ fontSize:8, color:"#666", fontWeight:600 }}>{m.total}</div>
                <div style={{ width:"100%", display:"flex", flexDirection:"column", gap:1 }}>
                  <div style={{ width:"100%", background:"#1d9e75", borderRadius:"2px 2px 0 0", height:`${Math.max(2,(m.customers/maxUsers)*50)}px` }}/>
                  <div style={{ width:"100%", background:"#378add", height:`${Math.max(2,(m.providers/maxUsers)*50)}px` }}/>
                  <div style={{ width:"100%", background:"#1d9e75", height:`${Math.max(m.drivers>0?2:0,(m.drivers/maxUsers)*50)}px` }}/>
                </div>
                <div style={{ fontSize:7, color:"#888", textAlign:"center" }}>{shortMonth(m.month)}</div>
              </div>
            ))}
          </div>
          <div style={{ display:"flex", gap:8, marginTop:8, flexWrap:"wrap" }}>
            {[{label:"Customers",bg:"#e6821e"},{label:"Providers",bg:"#378add"},{label:"Drivers",bg:"#1d9e75"}].map(l=>(
              <div key={l.label} style={{ display:"flex", alignItems:"center", gap:3 }}>
                <div style={{ width:8, height:8, background:l.bg, borderRadius:2 }}/>
                <span style={{ fontSize:9, color:"#888" }}>{l.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Activity feed */}
      <div style={{ background:"#f8f8f8", border:"0.5px solid #eee", borderRadius:12, padding:"1rem" }}>
        <div style={{ fontFamily:"Syne", fontSize:13, fontWeight:700, marginBottom:"0.75rem", color:"#000000", display:"flex", alignItems:"center", gap:6 }}>
          <div style={{ width:7, height:7, borderRadius:"50%", background:"#e6821e" }}/>
          Live activity
        </div>
        {loading&&<div style={{ color:"#888", fontSize:12 }}>Loading...</div>}
        {!loading&&activity.length===0&&<div style={{ color:"#aaa", fontSize:12 }}>No activity yet</div>}
        {activity.map((a,i)=>(
          <div key={i} style={{ display:"flex", alignItems:"center", gap:10, padding:"7px 0", borderBottom:"1px solid #1a1a1a" }}>
            <div style={{ width:28, height:28, borderRadius:7, background:"#f5f5f5", display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, flexShrink:0 }}>{a.icon}</div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:11, color:"#000000", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{a.text}</div>
              <div style={{ fontSize:9, color:"#888", marginTop:1 }}>{a.sub}</div>
            </div>
            <div style={{ flexShrink:0, textAlign:"right" }}>
              <div style={{ fontSize:9, padding:"2px 6px", borderRadius:8, background:"#f5f5f5", color:"#888", marginBottom:2 }}>{a.tag}</div>
              <div style={{ fontSize:9, color:"#aaa" }}>{new Date(a.time).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}









