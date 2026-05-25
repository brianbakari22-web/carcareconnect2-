import useIsMobile from "../../lib/useIsMobile"
import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"
import { useAuth } from "../../contexts/AuthContext"
import ChatWindow from "../shared/ChatWindow"

export default function DriverChat() {
  const isMobile = useIsMobile()
  const { user } = useAuth()
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
    const { data: profs } = await supabase.from("profile_public")
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
        bookingId: b.id,
        serviceName: b.service_name,
        bookingDate: b.booking_date,
        status: b.status,
        otherUserId: b.customer_id,
        otherUserName: `${customer?.first_name||""} ${customer?.last_name||""}`.trim()||"Customer",
        lastMessage: last?.message||"No messages yet",
        lastTime: last?.created_at,
        unread,
      }
    })
    setConversations(convs)
    setLoading(false)
  }

  return (
    <div style={{ display:"grid", gridTemplateColumns:"1fr", gap:10, height:"calc(100vh - 120px)" }}>
      <div style={{ background:"#111", borderRadius:12, border:"1px solid #1e1e1e", overflow:"hidden", display:"flex", flexDirection:"column" }}>
        <div style={{ padding:"1rem", borderBottom:"1px solid #1e1e1e", flexShrink:0 }}>
          <div style={{ fontFamily:"Syne", fontSize:16, fontWeight:800, color:"#f0ede6" }}>Customer Messages</div>
          <div style={{ fontSize:11, color:"#555", marginTop:2 }}>{conversations.length} active delivery{conversations.length!==1?"s":""}</div>
        </div>
        <div style={{ flex:1, overflowY:"auto" }}>
          {loading&&<div style={{ color:"#555", fontSize:13, padding:"1rem" }}>Loading...</div>}
          {!loading&&conversations.length===0&&(
            <div style={{ color:"#444", fontSize:13, textAlign:"center", padding:"2rem" }}>
              <div style={{ fontSize:28, marginBottom:8 }}>💬</div>
              No active deliveries to chat about
            </div>
          )}
          {conversations.map(c=>(
            <div key={c.bookingId} onClick={()=>setSelected(c)}
              style={{ padding:"0.9rem 1rem", borderBottom:"1px solid #1a1a1a", cursor:"pointer", background:selected?.bookingId===c.bookingId?"#071a12":"transparent" }}>
              <div style={{ display:"flex", alignItems:"flex-start", gap:10 }}>
                <div style={{ width:38, height:38, borderRadius:"50%", background:"#071a12", border:"1px solid #1d9e7530", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"Syne", fontSize:14, fontWeight:800, color:"#1d9e75", flexShrink:0 }}>
                  {c.otherUserName[0]?.toUpperCase()}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:2 }}>
                    <div style={{ fontSize:13, fontWeight:c.unread>0?700:500, color:"#f0ede6", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{c.otherUserName}</div>
                    {c.unread>0&&<div style={{ width:18, height:18, borderRadius:"50%", background:"#1d9e75", color:"#fff", fontSize:10, fontWeight:700, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>{c.unread}</div>}
                  </div>
                  <div style={{ fontSize:11, color:"#666", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", marginBottom:2 }}>{c.lastMessage}</div>
                  <div style={{ fontSize:10, color:"#555" }}>● {c.status} · {c.serviceName}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {selected ? (
        <div style={{ display:"flex", flexDirection:"column", height:"100%" }}>
          {isMobile&&(
            <button onClick={()=>setSelected(null)} style={{ background:"none", border:"none", color:"#666", cursor:"pointer", fontSize:13, padding:"8px 0", textAlign:"left", fontFamily:"DM Sans,sans-serif" }}>
              ← Back to conversations
            </button>
          )}
          <ChatWindow
          bookingId={selected.bookingId}
          otherUserId={selected.otherUserId}
          otherUserName={selected.otherUserName}
          onClose={()=>setSelected(null)}
          />
        </div>
      ) : (
        <div style={{ background:"#111", borderRadius:12, border:"1px solid #1e1e1e", display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:10 }}>
          <div style={{ fontSize:32 }}>💬</div>
          <div style={{ fontSize:14, color:"#555" }}>Select a conversation</div>
        </div>
      )}
    </div>
  )
}




