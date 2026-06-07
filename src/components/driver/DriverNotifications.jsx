import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"
import { useAuth } from "../../contexts/AuthContext"
import { useLanguage } from "../../contexts/LanguageContext"
import toast from "react-hot-toast"

export default function DriverNotifications() {
  const { user } = useAuth()
  const { t } = useLanguage()
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    load()
    const sub = supabase.channel("driver-notifs")
      .on("postgres_changes", { event:"INSERT", schema:"public", table:"notifications", filter:`user_id=eq.${user.id}` }, payload => {
        setNotifications(prev=>[payload.new,...prev])
        toast(payload.new.title, { icon: payload.new.type==="success"?"✅":payload.new.type==="error"?"❌":payload.new.type==="warning"?"⚠️":"🔔", duration:5000 })
      })
      .subscribe()
    return () => supabase.removeChannel(sub)
  }, [user])

  async function load() {
    const { data } = await supabase.from("notifications")
      .select("*").eq("user_id", user.id).order("created_at", { ascending:false })
    setNotifications(data||[])
    setLoading(false)
  }

  async function markRead(id) {
    await supabase.from("notifications").update({ is_read:true }).eq("id", id).eq("user_id", user.id)
    setNotifications(n => n.map(x => x.id===id ? {...x, is_read:true} : x))
  }

  async function deleteNotif(id) {
    await supabase.from("notifications").delete().eq("id", id).eq("user_id", user.id)
    setNotifications(n => n.filter(x => x.id!==id))
  }
  async function clearAll() {
    if (!confirm("Clear all notifications?")) return
    await supabase.from("notifications").delete().eq("user_id", user.id)
    setNotifications([])
    toast.success("All cleared")
  }
  async function markAllRead() {
    await supabase.from("notifications").update({ is_read:true }).eq("user_id", user.id).eq("is_read", false)
    setNotifications(n => n.map(x => ({...x, is_read:true})))
    toast.success("All marked as read")
  }

  async function deleteNotif(id) {
    await supabase.from("notifications").delete().eq("id", id).eq("user_id", user.id)
    setNotifications(n => n.filter(x => x.id!==id))
  }

  const unread = notifications.filter(n=>!n.is_read).length
  const typeIcon = { info:"🔔", success:"✅", warning:"⚠️", error:"❌" }
  const typeColor = { info:"#378add", success:"#1d9e75", warning:"#e6821e", error:"#e24b4a" }
  const typeBg = { info:"#0c1f2e", success:"#071a12", warning:"#1a1208", error:"#1a0808" }

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"1.25rem" }}>
        <div>
          <div style={{ fontFamily:"Syne", fontSize:18, fontWeight:800, color:"#000000" }}>{t("notifications")}</div>
          {unread>0&&<div style={{ fontSize:12, color:"#1d9e75", marginTop:2 }}>{unread} unread</div>}
        </div>
        <div style={{ display:"flex", gap:6 }}>
          {unread>0&&<button onClick={markAllRead} style={{ background:"none", border:"1px solid #dddddd", borderRadius:7, color:"#555555", fontSize:12, padding:"6px 12px", cursor:"pointer" }}>Mark all read</button>}
          {notifications.length>0&&<button onClick={clearAll} style={{ background:"none", border:"1px solid #e24b4a30", borderRadius:7, color:"#e24b4a", fontSize:12, padding:"6px 12px", cursor:"pointer" }}>Clear all</button>}
        </div>
      </div>
      {loading&&<div style={{ color:"#777777", fontSize:13 }}>Loading...</div>}
      {!loading&&notifications.length===0&&(
        <div style={{ color:"#888888", fontSize:13, textAlign:"center", padding:"3rem" }}>
          <div style={{ fontSize:32, marginBottom:10 }}>🔔</div>
          No notifications yet
        </div>
      )}
      {notifications.map(n=>(
        <div key={n.id} onClick={()=>!n.is_read&&markRead(n.id)}
          style={{ background:n.is_read?"#111":"#071a12", border:`1px solid ${n.is_read?"#1e1e1e":typeColor[n.type]||"#1d9e75"}30`, borderRadius:10, padding:"1rem", marginBottom:8, cursor:n.is_read?"default":"pointer", display:"flex", alignItems:"flex-start", gap:12 }}>
          <div style={{ width:38, height:38, borderRadius:9, background:typeBg[n.type]||"#071a12", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0 }}>
            {typeIcon[n.type]||"🔔"}
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:8 }}>
              <div style={{ fontSize:13, fontWeight:n.is_read?400:600, color:n.is_read?"#aaa":"#f0ede6" }}>{n.title}</div>
              {!n.is_read&&<div style={{ width:8, height:8, borderRadius:"50%", background:"#1d9e75", flexShrink:0, marginTop:4 }}/>}
            </div>
            <div style={{ fontSize:12, color:"#666", marginTop:3, lineHeight:1.5 }}>{n.message}</div>
            <div style={{ fontSize:10, color:"#888888", marginTop:5 }}>{new Date(n.created_at).toLocaleString()}</div>
          </div>
          <button onClick={e=>{ e.stopPropagation(); deleteNotif(n.id) }} style={{ background:"none", border:"none", color:"#333", cursor:"pointer", fontSize:16, lineHeight:1, flexShrink:0 }}>×</button>
        </div>
      ))}
    </div>
  )
}



