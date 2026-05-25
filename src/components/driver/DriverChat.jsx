import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"
import { useAuth } from "../../contexts/AuthContext"
import useIsMobile from "../../lib/useIsMobile"
import ChatWindow from "../shared/ChatWindow"

export default function DriverChat() {
  const { user } = useAuth()
  const isMobile = useIsMobile()
  const [conversations, setConversations] = useState([])
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    load()
    const sub = supabase.channel("driver-chat-list")
      .on("postgres_changes", { event:"INSERT", schema:"public", table:"chat_messages", filter:`receiver_id=eq.${user.id}` }, () => load())
      .subscribe()
    return () => supabase.removeChannel(sub)
  }, [user])

  async function load() {
    const { data: bookings } = await supabase.from("bookings")
      .select("id,service_name,customer_id,status,booking_date")
      .eq("driver_id", user.id)
      .not("status", "in", '("completed","cancelled")')
      .order("created_at", { ascending:false })

    if (!bookings||bookings.length===0) { setConversations([]); setLoading(false); return }

    const customerIds = [...new Set(bookings.map(b=>b.customer_id))]
    const { data: profs } = await supabase.from("profiles")
      .select("id,first_name,last_name").in("id", customerIds)

    const { data: lastMessages } = await supabase.from("chat_messages")
      .select("booking_id,message,created_at,sender_id,is_read,receiver_id")
      .in("booking_id", bookings.map(b=>b.id))
      .order("created_at", { ascending:false })

    const convs = bookings.map(b => {
      const customer = profs?.find(p=>p.id===b.customer_id)
      const msgs = lastMessages?.filter(m=>m.booking_id===b.id)||[]
      const last = msgs[0]
      const unread = msgs.filter(m=>m.receiver_id===user.id&&!m.is_read).length
      return {
        bookingId: b.id, serviceName: b.service_name, bookingDate: b.booking_date,
        status: b.status, otherUserId: b.customer_id,
        otherUserName: `${customer?.first_name||""} ${customer?.last_name||""}`.trim()||"Customer",
        lastMessage: last?.message||"No messages yet", lastTime: last?.created_at, unread,
      }
    })
    setConversations(convs)
    setLoading(false)
  }

  const ChatModal = () => !selected ? null : (
    <div style={{ position:"fixed", inset:0, zIndex:1000, display:"flex", flexDirection:isMobile?"column":"row", alignItems:isMobile?"stretch":"center", justifyContent:"center", background:"rgba(0,0,0,0.7)" }}
      onClick={e=>{ if(e.target===e.currentTarget) setSelected(null) }}>
      <div style={{ marginTop:isMobile?"auto":"0", background:"#0f0f0f", borderRadius:isMobile?"16px 16px 0 0":"16px", border:"1px solid #1e1e1e", width:isMobile?"100%":520, height:isMobile?"80vh":600, display:"flex", flexDirection:"column", overflow:"hidden" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"1rem", borderBottom:"1px solid #1e1e1e", flexShrink:0 }}>
          <div>
            <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:800, color:"#f0ede6" }}>{selected.otherUserName}</div>
            <div style={{ fontSize:11, color:"#555" }}>{selected.serviceName}</div>
          </div>
          <button onClick={()=>setSelected(null)} style={{ background:"#1a1a1a", border:"none", borderRadius:"50%", width:32, height:32, color:"#888", cursor:"pointer", fontSize:18, display:"flex", alignItems:"center", justifyContent:"center" }}>×</button>
        </div>
        <div style={{ flex:1, minHeight:0 }}>
          <ChatWindow bookingId={selected.bookingId} otherUserId={selected.otherUserId} otherUserName={selected.otherUserName} onClose={()=>setSelected(null)}/>
        </div>
      </div>
    </div>
  )

  return (
    <>
      <ChatModal />
      <div style={{ fontFamily:"Syne", fontSize:isMobile?16:18, fontWeight:800, color:"#f0ede6", marginBottom:4 }}>Customer Messages</div>
      <div style={{ fontSize:11, color:"#555", marginBottom:"1rem" }}>{conversations.length} active delivery{conversations.length!==1?"s":""}</div>
      {loading&&<div style={{ color:"#555", fontSize:13 }}>Loading...</div>}
      {!loading&&conversations.length===0&&<div style={{ color:"#444", fontSize:13, textAlign:"center", padding:"3rem" }}><div style={{ fontSize:32, marginBottom:10 }}>💬</div>No active deliveries</div>}
      {conversations.map(c=>(
        <div key={c.bookingId} onClick={()=>setSelected(c)}
          style={{ background:"#111", border:`1px solid ${selected?.bookingId===c.bookingId?"#1d9e7540":"#1a1a1a"}`, borderRadius:10, padding:"0.9rem", marginBottom:8, cursor:"pointer" }}>
          <div style={{ display:"flex", alignItems:"flex-start", gap:10 }}>
            <div style={{ width:44, height:44, borderRadius:"50%", background:"#071a12", border:"1px solid #1d9e7530", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"Syne", fontSize:16, fontWeight:800, color:"#1d9e75", flexShrink:0 }}>
              {c.otherUserName[0]?.toUpperCase()}
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:2 }}>
                <div style={{ fontSize:13, fontWeight:c.unread>0?700:500, color:"#f0ede6", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{c.otherUserName}</div>
                <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                  {c.unread>0&&<div style={{ width:20, height:20, borderRadius:"50%", background:"#1d9e75", color:"#fff", fontSize:10, fontWeight:700, display:"flex", alignItems:"center", justifyContent:"center" }}>{c.unread}</div>}
                  <span style={{ fontSize:10, color:"#444" }}>{c.lastTime?new Date(c.lastTime).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}):""}</span>
                </div>
              </div>
              <div style={{ fontSize:11, color:"#666", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", marginBottom:4 }}>{c.lastMessage}</div>
              <div style={{ fontSize:10, color:"#555" }}>● {c.status} · {c.serviceName}</div>
            </div>
            <div style={{ fontSize:11, color:"#1d9e75", flexShrink:0, marginTop:2 }}>💬 Chat</div>
          </div>
        </div>
      ))}
    </>
  )
}
