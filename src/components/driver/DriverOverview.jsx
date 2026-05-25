import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"
import { useAuth } from "../../contexts/AuthContext"
import { useLanguage } from "../../contexts/LanguageContext"
import useIsMobile from "../../lib/useIsMobile"
import toast from "react-hot-toast"

export default function DriverOverview() {
  const { user, profile } = useAuth()
  const { t, language } = useLanguage()
  const isMobile = useIsMobile()
  const [stats, setStats] = useState({ today:0, total:0, deliveries:0, active:0 })
  const [recentJobs, setRecentJobs] = useState([])
  const [isOnline, setIsOnline] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    load()
    const sub = supabase.channel("driver-overview")
      .on("postgres_changes", { event:"*", schema:"public", table:"bookings", filter:`driver_id=eq.${user.id}` }, () => load())
      .subscribe()
    return () => supabase.removeChannel(sub)
  }, [user])

  async function load() {
    const [{ data: bookings }, { data: status }] = await Promise.all([
      supabase.from("bookings").select("*").eq("driver_id", user.id).order("created_at",{ascending:false}).limit(10),
      supabase.from("driver_status").select("is_online").eq("driver_id", user.id).maybeSingle()
    ])
    const bks = bookings||[]
    const today = new Date().toISOString().split("T")[0]
    const todayBks = bks.filter(b=>b.status==="completed"&&b.booking_date===today)
    setStats({
      today: todayBks.reduce((s,b)=>s+Number(b.driver_earnings||15),0),
      total: bks.filter(b=>b.status==="completed").reduce((s,b)=>s+Number(b.driver_earnings||15),0),
      deliveries: bks.filter(b=>b.status==="completed").length,
      active: bks.filter(b=>!["completed","cancelled"].includes(b.status)).length,
    })
    setRecentJobs(bks.slice(0,5))
    setIsOnline(status?.is_online||false)
    setLoading(false)
  }

  async function toggleOnline() {
    const newStatus = !isOnline
    const { error } = await supabase.from("driver_status").upsert({ driver_id:user.id, is_online:newStatus, last_seen:new Date().toISOString() }, { onConflict:"driver_id" })
    if (error) return toast.error(error.message)
    setIsOnline(newStatus)
    toast.success(newStatus?(language==="sw"?"Uko mtandaoni":"You are online"):(language==="sw"?"Uko nje ya mtandao":"You are offline"))
  }

  const SC = { pending:"#e6821e", confirmed:"#378add", "in-progress":"#8b5cf6", completed:"#1d9e75", cancelled:"#e24b4a" }

  return (
    <div>
      <div style={{ marginBottom:"1.25rem", display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap", gap:10 }}>
        <div>
          <div style={{ fontFamily:"Syne", fontSize:isMobile?18:22, fontWeight:800, color:"#f0ede6" }}>
            {language==="sw"?"Habari":"Good day"}, <span style={{ color:"#1d9e75" }}>{profile?.first_name}</span>
          </div>
          <div style={{ fontSize:12, color:"#555", marginTop:2 }}>{new Date().toLocaleDateString("default",{weekday:"long",month:"long",day:"numeric"})}</div>
        </div>
        <button onClick={toggleOnline}
          style={{ background:isOnline?"#071a12":"#1a1a1a", border:`1px solid ${isOnline?"#1d9e75":"#333"}`, borderRadius:20, color:isOnline?"#1d9e75":"#666", fontSize:12, fontWeight:600, padding:"8px 16px", cursor:"pointer", display:"flex", alignItems:"center", gap:6 }}>
          <div style={{ width:8, height:8, borderRadius:"50%", background:isOnline?"#1d9e75":"#555" }}/>
          {isOnline?(language==="sw"?"Mtandaoni":"Online"):(language==="sw"?"Nje ya mtandao":"Offline")}
        </button>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:isMobile?"repeat(2,1fr)":"repeat(4,1fr)", gap:isMobile?8:10, marginBottom:"1.25rem" }}>
        {[
          { label:language==="sw"?"Mapato ya leo":"Today's earnings", value:`$${stats.today.toFixed(2)}`, color:"#e6821e" },
          { label:language==="sw"?"Jumla ya mapato":"Total earnings", value:`$${stats.total.toFixed(2)}` },
          { label:language==="sw"?"Jumla ya usafirishaji":"Total deliveries", value:stats.deliveries },
          { label:language==="sw"?"Kazi zinazoendelea":"Active jobs", value:stats.active, color:stats.active>0?"#8b5cf6":undefined },
        ].map(s=>(
          <div key={s.label} style={{ background:"#111", borderRadius:10, padding:isMobile?"0.75rem":"1rem", border:"1px solid #1e1e1e" }}>
            <div style={{ fontSize:10, color:"#555", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:4 }}>{s.label}</div>
            <div style={{ fontFamily:"Syne", fontSize:isMobile?16:20, fontWeight:800, color:s.color||"#f0ede6" }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:700, marginBottom:10, color:"#f0ede6" }}>
        {language==="sw"?"Shughuli za hivi karibuni":"Recent activity"}
      </div>
      {loading&&<div style={{ color:"#555", fontSize:13 }}>{t("loading")}</div>}
      {!loading&&recentJobs.length===0&&<div style={{ color:"#444", fontSize:13, textAlign:"center", padding:"2rem" }}>{t("noDataYet")}</div>}
      {recentJobs.map(b=>(
        <div key={b.id} style={{ background:"#111", border:"1px solid #1e1e1e", borderRadius:10, padding:isMobile?"0.75rem":"0.9rem", marginBottom:8, display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:36, height:36, borderRadius:8, background:"#071a12", display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, flexShrink:0 }}>🚗</div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:13, fontWeight:500, color:"#f0ede6", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{b.service_name}</div>
            <div style={{ fontSize:11, color:"#555", marginTop:2 }}>{b.booking_date}</div>
          </div>
          <div style={{ textAlign:"right", flexShrink:0 }}>
            <span style={{ fontSize:10, padding:"2px 8px", borderRadius:20, background:`${SC[b.status]||"#888"}20`, color:SC[b.status]||"#888" }}>{b.status}</span>
            <div style={{ fontFamily:"Syne", fontSize:12, fontWeight:700, color:"#1d9e75", marginTop:4 }}>${Number(b.driver_earnings||15).toFixed(2)}</div>
          </div>
        </div>
      ))}
    </div>
  )
}
