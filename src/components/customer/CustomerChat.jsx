import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"
import { useAuth } from "../../contexts/AuthContext"
import { useLanguage } from "../../contexts/LanguageContext"
import useIsMobile from "../../lib/useIsMobile"
import ChatWindow from "../shared/ChatWindow"
import { useSearchParams } from "react-router-dom"

export default function CustomerChat() {
  const { user } = useAuth()
  const { t } = useLanguage()
  const isMobile = useIsMobile()
  const [conversations, setConversations] = useState([])
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(true)
  const [searchParams] = useSearchParams()

  useEffect(() => {
    if (!user) return
    load()
    const sub = supabase.channel("customer-chat-list")
      .on("postgres_changes", { event:"INSERT", schema:"public", table:"chat_messages", filter:`receiver_id=eq.${user.id}` }, () => load())
      .subscribe()
    return () => supabase.removeChannel(sub)
  }, [user])

  async function load() {
    const { data: bookings } = await supabase.from("bookings")
      .select("id,service_name,provider_id,status,booking_date")
      .eq("customer_id", user.id)
      .order("created_at", { ascending:false })
      .order("created_at", { ascending:false })

    // Continue even if no bookings - need to load listing messages too

    const providerIds = [...new Set(bookings.map(b=>b.provider_id))]
    const { data: profs } = await supabase.from("profiles")
      .select("id,first_name,last_name,business_name").in("id", providerIds)

    const { data: lastMessages } = await supabase.from("chat_messages")
      .select("booking_id,message,created_at,sender_id,is_read,receiver_id")
      .in("booking_id", bookings.map(b=>b.id))
      .order("created_at", { ascending:false })

    const convs = bookings.map(b => {
      const provider = profs?.find(p=>p.id===b.provider_id)
      const msgs = lastMessages?.filter(m=>m.booking_id===b.id)||[]
      const last = msgs[0]
      const unread = msgs.filter(m=>m.receiver_id===user.id&&!m.is_read).length
      return {
        bookingId: b.id,
        serviceName: b.service_name,
        _hasMessages: msgs.length>0,
        bookingDate: b.booking_date,
        status: b.status,
        otherUserId: b.provider_id,
        otherUserName: provider?.business_name||`${provider?.first_name||""} ${provider?.last_name||""}`.trim()||"Provider",
        lastMessage: last?.message||"No messages yet",
        lastTime: last?.created_at,
        unread,
      }
    })
    const filtered = convs.filter(c=>c._hasMessages)
    setConversations(filtered)
    setLoading(false)
    // Auto-open from notification redirect
    const bookingId = searchParams.get("booking")
    if (bookingId) {
      const conv = filtered.find(c=>c.bookingId===bookingId)
      if (conv) setSelected(conv)
    }
  }

  const SC = { pending:"#e6821e", confirmed:"#378add", "in-progress":"#8b5cf6", completed:"#1d9e75", cancelled:"#e24b4a" }

  return (
    <>
      {/* Mobile chat popup modal */}
      {isMobile && selected && (
        <div style={{ position:"fixed", inset:0, zIndex:1000, display:"flex", flexDirection:"column", background:"rgba(0,0,0,0.7)" }}
          onClick={e=>{ if(e.target===e.currentTarget) setSelected(null) }}>
          <div style={{ marginTop:"auto", background:"#ffffff", borderRadius:"16px 16px 0 0", height:"80vh", display:"flex", flexDirection:"column", overflow:"hidden" }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"1rem", borderBottom:"1px solid #eeeeee", flexShrink:0 }}>
              <div>
                <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:800, color:"#000000" }}>{selected.otherUserName}</div>
                <div style={{ fontSize:11, color:"#777777" }}>{selected.serviceName}</div>
              </div>
              <button onClick={()=>setSelected(null)}
                style={{ background:"#f5f5f5", border:"none", borderRadius:"50%", width:32, height:32, color:"#555555", cursor:"pointer", fontSize:18, display:"flex", alignItems:"center", justifyContent:"center" }}>
                ×
              </button>
            </div>
            <div style={{ flex:1, minHeight:0 }}>
              <ChatWindow
                bookingId={selected.bookingId||null}
                listingId={selected.listingId||null}
                otherUserId={selected.otherUserId}
                otherUserName={selected.otherUserName}
                onClose={()=>setSelected(null)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Desktop chat popup modal */}
      {!isMobile && selected && (
        <div style={{ position:"fixed", inset:0, zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", background:"rgba(0,0,0,0.7)" }}
          onClick={e=>{ if(e.target===e.currentTarget) setSelected(null) }}>
          <div style={{ width:520, height:600, background:"#ffffff", borderRadius:16, border:"1px solid #eeeeee", display:"flex", flexDirection:"column", overflow:"hidden" }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"1rem", borderBottom:"1px solid #eeeeee", flexShrink:0 }}>
              <div>
                <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:800, color:"#000000" }}>{selected.otherUserName}</div>
                <div style={{ fontSize:11, color:"#777777" }}>{selected.serviceName}</div>
              </div>
              <button onClick={()=>setSelected(null)}
                style={{ background:"#f5f5f5", border:"none", borderRadius:"50%", width:32, height:32, color:"#555555", cursor:"pointer", fontSize:18, display:"flex", alignItems:"center", justifyContent:"center" }}>
                ×
              </button>
            </div>
            <div style={{ flex:1, minHeight:0 }}>
              <ChatWindow
                bookingId={selected.bookingId||null}
                listingId={selected.listingId||null}
                otherUserId={selected.otherUserId}
                otherUserName={selected.otherUserName}
                onClose={()=>setSelected(null)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Conversation list */}
      <div style={{ fontFamily:"Syne", fontSize:isMobile?16:18, fontWeight:800, color:"#000000", marginBottom:4 }}>Messages</div>
      <div style={{ fontSize:11, color:"#777777", marginBottom:"1rem" }}>{conversations.length} active booking{conversations.length!==1?"s":""}</div>

      {loading&&<div style={{ color:"#777777", fontSize:13 }}>Loading...</div>}
      {!loading&&conversations.length===0&&(
        <div style={{ color:"#888888", fontSize:13, textAlign:"center", padding:"3rem" }}>
          <div style={{ fontSize:32, marginBottom:10 }}>💬</div>
          No active bookings to chat about
        </div>
      )}

      {conversations.map(c=>(
        <div key={c.bookingId} onClick={()=>setSelected(c)}
          style={{ background:"#ffffff", border:`1px solid ${selected?.bookingId===c.bookingId?"#e6821e":"#eeeeee"}`, borderRadius:10, padding:"0.9rem", marginBottom:8, cursor:"pointer" }}
          onMouseEnter={e=>e.currentTarget.style.background="#fff8f0"}
          onMouseLeave={e=>e.currentTarget.style.background="#ffffff"}>
          <div style={{ display:"flex", alignItems:"flex-start", gap:10 }}>
            <div style={{ width:44, height:44, borderRadius:"50%", background:"#fff8f0", border:"1px solid #e6821e40", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"Syne", fontSize:16, fontWeight:800, color:"#e6821e", flexShrink:0 }}>
              {c.otherUserName[0]?.toUpperCase()}
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:2 }}>
                <div style={{ fontSize:13, fontWeight:c.unread>0?700:500, color:"#000000", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{c.otherUserName}</div>
                <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                  {c.unread>0&&<div style={{ width:20, height:20, borderRadius:"50%", background:"#e6821e", color:"#fff", fontSize:10, fontWeight:700, display:"flex", alignItems:"center", justifyContent:"center" }}>{c.unread}</div>}
                  <span style={{ fontSize:10, color:"#888888" }}>{c.lastTime?new Date(c.lastTime).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}):""}</span>
                </div>
              </div>
              <div style={{ fontSize:11, color:"#666", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", marginBottom:4 }}>{c.lastMessage}</div>
              <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                <span style={{ fontSize:10, color:SC[c.status]||"#555" }}>● {c.status}</span>
                <span style={{ fontSize:10, color:"#888888" }}>· {c.serviceName} · {c.bookingDate}</span>
              </div>
            </div>
            <div style={{ fontSize:11, color:"#e6821e", flexShrink:0, marginTop:2 }}>💬 Chat</div>
          </div>
        </div>
      ))}
    </>
  )
}








