import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"
import { useAuth } from "../../contexts/AuthContext"
import useIsMobile from "../../lib/useIsMobile"
import toast from "react-hot-toast"

const TYPE_COLORS = {
  success: { color:"#1d9e75", bg:"#071a12", border:"#1d9e7530" },
  warning: { color:"#e6821e", bg:"#1a1208", border:"#e6821e30" },
  error: { color:"#e24b4a", bg:"#1a0808", border:"#e24b4a30" },
  info: { color:"#378add", bg:"#0c1f2e", border:"#378add30" },
}

const PRIORITY = {
  "🚨": 1, "⚠️": 2, "💰": 2, "🎫": 3, "👤": 4, "📋": 5, "🚗": 2
}

export default function AdminNotifications() {
  const { user } = useAuth()
  const isMobile = useIsMobile()
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState("all")
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    if (!user) return
    load()
    const sub = supabase.channel("admin-notifs-live")
      .on("postgres_changes", { event:"INSERT", schema:"public", table:"notifications", filter:`user_id=eq.${user.id}` },
        payload => {
          setNotifications(prev => [payload.new, ...prev])
          setUnreadCount(c => c + 1)
          toast(payload.new.title, { icon: payload.new.type==="warning"?"⚠️":payload.new.type==="error"?"🚨":"📢", duration:5000 })
        })
      .subscribe()
    return () => supabase.removeChannel(sub)
  }, [user])

  async function load() {
    const { data } = await supabase.from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending:false })
      .limit(100)
    setNotifications(data||[])
    setUnreadCount(data?.filter(n=>!n.is_read).length||0)
    setLoading(false)
  }

  async function markRead(id) {
    await supabase.from("notifications").update({ is_read:true }).eq("id",id)
    setNotifications(prev => prev.map(n => n.id===id ? {...n,is_read:true} : n))
    setUnreadCount(c => Math.max(0,c-1))
  }

  async function markAllRead() {
    await supabase.from("notifications").update({ is_read:true }).eq("user_id",user.id).eq("is_read",false)
    setNotifications(prev => prev.map(n => ({...n,is_read:true})))
    setUnreadCount(0)
    toast.success("All marked as read")
  }

  async function deleteNotification(id) {
    await supabase.from("notifications").delete().eq("id",id)
    setNotifications(prev => prev.filter(n=>n.id!==id))
  }

  async function clearAll() {
    if (!confirm("Clear all notifications?")) return
    await supabase.from("notifications").delete().eq("user_id",user.id)
    setNotifications([])
    setUnreadCount(0)
    toast.success("All notifications cleared")
  }

  const filtered = notifications.filter(n => {
    if (filter==="unread") return !n.is_read
    if (filter==="warning") return n.type==="warning"||n.type==="error"
    if (filter==="info") return n.type==="info"||n.type==="success"
    return true
  })

  const grouped = {
    urgent: filtered.filter(n=>n.title?.includes("🚨")||n.title?.includes("dispute")||n.title?.includes("Dispute")||n.type==="error"),
    warning: filtered.filter(n=>(n.title?.includes("⚠️")||n.title?.includes("💰")||n.title?.includes("Mileage")||n.title?.includes("Payout"))&&n.type==="warning"),
    info: filtered.filter(n=>n.type==="info"||n.type==="success"),
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"1.5rem", flexWrap:"wrap", gap:10 }}>
        <div>
          <div style={{ fontFamily:"Syne", fontSize:isMobile?16:20, fontWeight:800, color:"#000000" }}>
            Notifications
            {unreadCount>0&&<span style={{ marginLeft:8, background:"#e24b4a", color:"#fff", borderRadius:20, fontSize:11, padding:"2px 8px", fontFamily:"'DM Sans',sans-serif" }}>{unreadCount} new</span>}
          </div>
          <div style={{ fontSize:12, color:"#888", marginTop:2 }}>Real-time platform activity</div>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          {unreadCount>0&&(
            <button onClick={markAllRead}
              style={{ background:"#f0fdf4", border:"1px solid #1d9e7540", borderRadius:8, color:"#1d9e75", fontSize:12, padding:"8px 14px", cursor:"pointer" }}>
              ✓ Mark all read
            </button>
          )}
          <button onClick={clearAll}
            style={{ background:"none", border:"1px solid #333", borderRadius:8, color:"#888", fontSize:12, padding:"8px 14px", cursor:"pointer" }}>
            Clear all
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display:"grid", gridTemplateColumns:isMobile?"repeat(2,1fr)":"repeat(4,1fr)", gap:10, marginBottom:"1.5rem" }}>
        {[
          { label:"Total", value:notifications.length, color:"#000000" },
          { label:"Unread", value:unreadCount, color:"#e24b4a" },
          { label:"Urgent", value:grouped.urgent.length, color:"#e6821e" },
          { label:"Today", value:notifications.filter(n=>n.created_at?.startsWith(new Date().toISOString().split("T")[0])).length, color:"#378add" },
        ].map(s=>(
          <div key={s.label} style={{ background:"#f8f8f8", borderRadius:10, padding:isMobile?"0.75rem":"1rem", border:"1px solid #eeeeee" }}>
            <div style={{ fontSize:10, color:"#888", textTransform:"uppercase", marginBottom:4 }}>{s.label}</div>
            <div style={{ fontFamily:"Syne", fontSize:isMobile?16:20, fontWeight:800, color:s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display:"flex", gap:6, marginBottom:"1.25rem", flexWrap:"wrap" }}>
        {[
          { k:"all", l:"All" },
          { k:"unread", l:`Unread (${unreadCount})` },
          { k:"warning", l:"Urgent & warnings" },
          { k:"info", l:"Info" },
        ].map(f=>(
          <button key={f.k} onClick={()=>setFilter(f.k)}
            style={{ padding:"7px 14px", borderRadius:8, border:"none", fontSize:12, cursor:"pointer", background:filter===f.k?"#8b5cf6":"#f8f8f8", color:filter===f.k?"#fff":"#666", fontFamily:"'DM Sans',sans-serif", fontWeight:filter===f.k?700:400 }}>
            {f.l}
          </button>
        ))}
      </div>

      {loading&&<div style={{ color:"#888", fontSize:13 }}>Loading...</div>}
      {!loading&&filtered.length===0&&(
        <div style={{ color:"#888", fontSize:13, textAlign:"center", padding:"3rem" }}>
          <div style={{ fontSize:32, marginBottom:10 }}>🔔</div>
          No notifications
        </div>
      )}

      {/* Urgent section */}
      {filter==="all"&&grouped.urgent.length>0&&(
        <div style={{ marginBottom:"1.5rem" }}>
          <div style={{ fontSize:11, color:"#e24b4a", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:8 }}>🚨 Urgent</div>
          {grouped.urgent.map(n=><NotifCard key={n.id} n={n} onRead={markRead} onDelete={deleteNotification}/>)}
        </div>
      )}

      {/* Warning section */}
      {filter==="all"&&grouped.warning.length>0&&(
        <div style={{ marginBottom:"1.5rem" }}>
          <div style={{ fontSize:11, color:"#e6821e", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:8 }}>⚠️ Needs attention</div>
          {grouped.warning.map(n=><NotifCard key={n.id} n={n} onRead={markRead} onDelete={deleteNotification}/>)}
        </div>
      )}

      {/* Info section */}
      {filter==="all"&&grouped.info.length>0&&(
        <div style={{ marginBottom:"1.5rem" }}>
          <div style={{ fontSize:11, color:"#378add", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:8 }}>📢 Activity</div>
          {grouped.info.map(n=><NotifCard key={n.id} n={n} onRead={markRead} onDelete={deleteNotification}/>)}
        </div>
      )}

      {/* Filtered list */}
      {filter!=="all"&&filtered.map(n=><NotifCard key={n.id} n={n} onRead={markRead} onDelete={deleteNotification}/>)}
    </div>
  )
}

function NotifCard({ n, onRead, onDelete }) {
  const c = TYPE_COLORS[n.type]||TYPE_COLORS.info
  const timeAgo = (date) => {
    const diff = Date.now() - new Date(date).getTime()
    const mins = Math.floor(diff/60000)
    const hrs = Math.floor(mins/60)
    const days = Math.floor(hrs/24)
    if (days>0) return `${days}d ago`
    if (hrs>0) return `${hrs}h ago`
    if (mins>0) return `${mins}m ago`
    return "Just now"
  }

  return (
    <div style={{ background:n.is_read?"#f8f8f8":c.bg, border:`1px solid ${n.is_read?"#eeeeee":c.border}`, borderRadius:10, padding:"0.9rem", marginBottom:8, opacity:n.is_read?0.7:1, transition:"all 0.2s" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:10 }}>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
            {!n.is_read&&<div style={{ width:7, height:7, borderRadius:"50%", background:c.color, boxShadow:`0 0 6px ${c.color}`, flexShrink:0 }}/>}
            <div style={{ fontFamily:"Syne", fontSize:13, fontWeight:700, color:n.is_read?"#666":c.color }}>{n.title}</div>
          </div>
          <div style={{ fontSize:12, color:"#888", lineHeight:1.5, marginBottom:4 }}>{n.message}</div>
          <div style={{ fontSize:10, color:"#888" }}>{timeAgo(n.created_at)}</div>
        </div>
        <div style={{ display:"flex", gap:6, flexShrink:0 }}>
          {!n.is_read&&(
            <button onClick={()=>onRead(n.id)}
              style={{ background:"none", border:`1px solid ${c.color}30`, borderRadius:6, color:c.color, fontSize:10, padding:"3px 8px", cursor:"pointer" }}>
              Mark read
            </button>
          )}
          <button onClick={()=>onDelete(n.id)}
            style={{ background:"none", border:"1px solid #333", borderRadius:6, color:"#888", fontSize:10, padding:"3px 8px", cursor:"pointer" }}>
            ×
          </button>
        </div>
      </div>
    </div>
  )
}
