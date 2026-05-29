import { useEffect, useState, useRef } from "react"
import { supabase } from "../../lib/supabase"
import { useAuth } from "../../contexts/AuthContext"
import { useLanguage } from "../../contexts/LanguageContext"

export default function ChatWindow({ bookingId, listingId, otherUserId, otherUserName, onClose }) {
  const { user } = useAuth()
  const { t } = useLanguage()
  const [messages, setMessages] = useState([])
  const [text, setText] = useState("")
  const [sending, setSending] = useState(false)
  const [otherTyping, setOtherTyping] = useState(false)
  const bottomRef = useRef(null)
  const typingRef = useRef(null)
  const channelRef = useRef(null)
  const chatId = bookingId || listingId

  useEffect(() => {
    if (!user || !chatId) return
    load()
    markRead()

    const filterStr = bookingId
      ? `booking_id=eq.${bookingId}`
      : `listing_id=eq.${listingId}`

    const channel = supabase.channel(`chat-${chatId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "chat_messages",
        filter: filterStr
      }, payload => {
        setMessages(prev => {
          const exists = prev.find(m => m.id===payload.new.id || m._tempId===payload.new.id)
          if (exists) return prev.map(m => m._tempId===payload.new.id ? {...payload.new} : m)
          return [...prev, payload.new]
        })
        if (payload.new.sender_id !== user.id) markRead()
      })
      .on("broadcast", { event:"typing" }, payload => {
        if (payload.payload?.userId !== user.id) {
          setOtherTyping(true)
          clearTimeout(typingRef.current)
          typingRef.current = setTimeout(() => setOtherTyping(false), 2000)
        }
      })
      .subscribe()

    channelRef.current = channel
    return () => {
      supabase.removeChannel(channel)
      clearTimeout(typingRef.current)
    }
  }, [user, chatId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior:"smooth" })
  }, [messages, otherTyping])

  async function load() {
    let query = supabase.from("chat_messages").select("*")
    if (bookingId) query = query.eq("booking_id", bookingId)
    else if (listingId) query = query.eq("listing_id", listingId)
    const { data } = await query.order("created_at", { ascending:true })
    setMessages(data||[])
  }

  async function markRead() {
    let query = supabase.from("chat_messages").update({ is_read:true }).eq("receiver_id", user.id).eq("is_read", false)
    if (bookingId) query = query.eq("booking_id", bookingId)
    else if (listingId) query = query.eq("listing_id", listingId)
    await query
  }

  async function broadcastTyping() {
    if (!channelRef.current) return
    channelRef.current.send({ type:"broadcast", event:"typing", payload:{ userId:user.id } }).catch(()=>{})
  }

  async function send(e) {
    e.preventDefault()
    if (!text.trim() || sending) return
    const messageText = text.trim()
    const tempId = `temp-${Date.now()}`
    setText("")
    setSending(true)

    const optimistic = {
      id: tempId, _tempId: tempId,
      booking_id: bookingId||null,
      listing_id: listingId||null,
      sender_id: user.id,
      receiver_id: otherUserId,
      message: messageText,
      is_read: false,
      created_at: new Date().toISOString(),
      _pending: true
    }
    setMessages(prev => [...prev, optimistic])

    const { error } = await supabase.from("chat_messages").insert({
      booking_id: bookingId||null,
      listing_id: listingId||null,
      sender_id: user.id,
      receiver_id: otherUserId,
      message: messageText,
    })

    if (error) {
      console.error("Chat error:", error)
      setMessages(prev => prev.filter(m => m.id !== tempId))
      setText(messageText)
      setSending(false)
      return
    }

    setMessages(prev => prev.map(m => m.id===tempId ? {...m, _pending:false} : m))
    setSending(false)

    supabase.from("notifications").insert({
      user_id: otherUserId,
      title: listingId ? "New message about your listing 💬" : "New message",
      message: messageText.slice(0, 60),
      type: "info"
    }).catch(()=>{})
  }

  function handleKeyDown(e) {
    if (e.key==="Enter" && !e.shiftKey) { e.preventDefault(); send(e) }
    else broadcastTyping()
  }

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", minHeight:320, background:"#0f0f0f", borderRadius:12, border:"1px solid #2a2a2a", overflow:"hidden" }}>
      <div style={{ padding:"1rem", borderBottom:"1px solid #1e1e1e", display:"flex", alignItems:"center", justifyContent:"space-between", background:"#111", flexShrink:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:36, height:36, borderRadius:"50%", background:"#1a1208", border:"1px solid #e6821e30", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"Syne", fontSize:14, fontWeight:800, color:"#e6821e" }}>
            {otherUserName?.[0]?.toUpperCase()||"?"}
          </div>
          <div>
            <div style={{ fontSize:13, fontWeight:600, color:"#f0ede6" }}>{otherUserName}</div>
            <div style={{ fontSize:10, color:otherTyping?"#1d9e75":"#555", transition:"color 0.2s" }}>
              {otherTyping?"typing...":listingId?"Marketplace chat":"Chat"}
            </div>
          </div>
        </div>
        {onClose&&(
          <button onClick={onClose} style={{ background:"none", border:"none", color:"#555", fontSize:20, cursor:"pointer", lineHeight:1, padding:"4px" }}>×</button>
        )}
      </div>

      <div style={{ flex:1, overflowY:"auto", padding:"1rem", display:"flex", flexDirection:"column", gap:8 }}>
        {messages.length===0&&(
          <div style={{ textAlign:"center", color:"#444", fontSize:12, padding:"2rem" }}>
            <div style={{ fontSize:28, marginBottom:8 }}>💬</div>
            No messages yet. Start the conversation!
          </div>
        )}
        {messages.map(m=>{
          const isMine = m.sender_id===user.id
          return (
            <div key={m.id} style={{ display:"flex", justifyContent:isMine?"flex-end":"flex-start" }}>
              <div style={{ maxWidth:"75%", padding:"10px 14px", borderRadius:isMine?"14px 14px 4px 14px":"14px 14px 14px 4px", background:isMine?"#e6821e":"#1a1a1a", color:isMine?"#fff":"#f0ede6", fontSize:13, lineHeight:1.5, opacity:m._pending?0.7:1, transition:"opacity 0.2s" }}>
                <div style={{ wordBreak:"break-word" }}>{m.message}</div>
                <div style={{ fontSize:9, opacity:0.6, marginTop:4, textAlign:isMine?"right":"left", display:"flex", alignItems:"center", justifyContent:isMine?"flex-end":"flex-start", gap:4 }}>
                  {new Date(m.created_at).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}
                  {isMine&&<span>{m._pending?"⏳":m.is_read?"✓✓":"✓"}</span>}
                </div>
              </div>
            </div>
          )
        })}
        {otherTyping&&(
          <div style={{ display:"flex", justifyContent:"flex-start" }}>
            <div style={{ padding:"10px 14px", borderRadius:"14px 14px 14px 4px", background:"1a1a1a", color:"#555", fontSize:20, letterSpacing:4 }}>•••</div>
          </div>
        )}
        <div ref={bottomRef}/>
      </div>

      <form onSubmit={send} style={{ padding:"0.75rem", borderTop:"1px solid #1e1e1e", display:"flex", gap:8, background:"#111", flexShrink:0 }}>
        <textarea value={text} onChange={e=>setText(e.target.value)} onKeyDown={handleKeyDown}
          placeholder={t("typeMessage")} rows={1}
          style={{ flex:1, background:"#0f0f0f", border:"1px solid #222", borderRadius:10, padding:"10px 12px", color:"#f0ede6", fontSize:13, outline:"none", fontFamily:"'DM Sans',sans-serif", resize:"none", lineHeight:1.4, maxHeight:100 }}/>
        <button type="submit" disabled={!text.trim()||sending}
          style={{ background:text.trim()&&!sending?"#e6821e":"#222", border:"none", borderRadius:10, color:text.trim()&&!sending?"#fff":"#555", fontSize:18, padding:"0 16px", cursor:text.trim()&&!sending?"pointer":"default", flexShrink:0, transition:"all 0.12s" }}>
          ➤
        </button>
      </form>
    </div>
  )
}
