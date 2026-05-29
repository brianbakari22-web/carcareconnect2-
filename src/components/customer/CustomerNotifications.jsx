import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"
import { useAuth } from "../../contexts/AuthContext"
import { useLanguage } from "../../contexts/LanguageContext"
import useIsMobile from "../../lib/useIsMobile"
import toast from "react-hot-toast"

export default function CustomerNotifications() {
  const { user } = useAuth()
  const { t } = useLanguage()
  const isMobile = useIsMobile()
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    load()
    const sub = supabase.channel("notifs-live")
      .on("postgres_changes", { event:"INSERT", schema:"public", table:"notifications", filter:`user_id=eq.${user.id}` }, payload => {
        setNotifications(prev=>[payload.new,...prev])
        toast(payload.new.title, { icon: payload.new.type==="success"?"✅":payload.new.type==="error"?"❌":payload.new.type==="warning"?"⚠️":"🔔", duration:5000 })
      })
      }).subscribe()
    return () => supabase.removeChannel(sub)
  }, [user])

  async function load() {
    const { data } = await supabase.from("notifications").select("*").eq("user_id",user.id).order("created_at",{ascending:false})
    setNotifications(data||[])
    setLoading(false)
  }

  async function markRead(id) {
    await supabase.from("notifications").update({ is_read:true }).eq("id",id).eq("user_id",user.id)
    setNotifications(n=>n.map(x=>x.id===id?{...x,is_read:true}:x))
  }

  async function markAllRead() {
    await supabase.from("notifications").update({ is_read:true }).eq("user_id",user.id).eq("is_read",false)
    setNotifications(n=>n.map(x=>({...x,is_read:true})))
    toast.success(t("success"))
  }

  async function deleteNotif(id) {
    await supabase.from("notifications").delete().eq("id",id).eq("user_id",user.id)
    setNotifications(n=>n.filter(x=>x.id!==id))
  }

  const unread = notifications.filter(n=>!n.is_read).length
  const typeIcon = { info:"🔔", success:"✅", warning:"⚠️", error:"❌" }
  const typeColor = { info:"#378add", success:"#1d9e75", warning:"#e6821e", error:"#e24b4a" }
  const typeBg = { info:"#0c1f2e", success:"#071a12", warning:"#1a1208", error:"#1a0808" }

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"1.25rem" }}>
        <div>
          <div style={{ fontFamily:"Syne", fontSize:isMobile?16:18, fontWeight:800, color:"#f0ede6" }}>{t("notifications")}</div>
          {unread>0&&<div style={{ fontSize:12, color:"#e6821e", marginTop:2 }}>{unread} {t("unread")}</div>}
        </div>
        {unread>0&&(
          <button onClick={markAllRead} style={{ background:"none", border:"1px solid #333", borderRadius:7, color:"#888", fontSize:11, padding:"6px 12px", cursor:"pointer" }}>
            {t("markAllRead")}
          </button>
        )}
      </div>

      {loading&&<div style={{ color:"#555", fontSize:13 }}>{t("loading")}</div>}
      {!loading&&notifications.length===0&&(
        <div style={{ color:"#444", fontSize:13, textAlign:"center", padding:"3rem" }}>
          <div style={{ fontSize:32, marginBottom:10 }}>🔔</div>
          {t("noNotificationsYet")}
        </div>
      )}

      {notifications.map(n=>(
        <div key={n.id} onClick={()=>!n.is_read&&markRead(n.id)}
          style={{ background:n.is_read?"#111":"#161208", border:`1px solid ${n.is_read?"#1e1e1e":typeColor[n.type]||"#e6821e"}30`, borderRadius:10, padding:isMobile?"0.75rem":"1rem", marginBottom:8, cursor:n.is_read?"default":"pointer", display:"flex", alignItems:"flex-start", gap:10 }}>
          <div style={{ width:36, height:36, borderRadius:9, background:typeBg[n.type]||"#1a1208", display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, flexShrink:0 }}>
            {typeIcon[n.type]||"🔔"}
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:8 }}>
              <div style={{ fontSize:isMobile?12:13, fontWeight:n.is_read?400:600, color:n.is_read?"#aaa":"#f0ede6" }}>{n.title}</div>
              {!n.is_read&&<div style={{ width:8, height:8, borderRadius:"50%", background:"#e6821e", flexShrink:0, marginTop:4 }}/>}
            </div>
            <div style={{ fontSize:11, color:"#666", marginTop:3, lineHeight:1.5 }}>{n.message}</div>
            <div style={{ fontSize:10, color:"#444", marginTop:4 }}>{new Date(n.created_at).toLocaleString()}</div>
          </div>
          <button onClick={e=>{ e.stopPropagation(); deleteNotif(n.id) }} style={{ background:"none", border:"none", color:"#333", cursor:"pointer", fontSize:18, lineHeight:1, flexShrink:0 }}>×</button>
        </div>
      ))}
    </div>
  )
}


