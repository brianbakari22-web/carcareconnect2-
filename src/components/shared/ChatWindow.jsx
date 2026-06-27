import { useEffect, useState, useRef } from "react"
import { supabase } from "../../lib/supabase"
import { useAuth } from "../../contexts/AuthContext"
import { useLanguage } from "../../contexts/LanguageContext"
import toast from "react-hot-toast"

export default function ChatWindow({ bookingId, listingId, claimId, mechanicId, otherUserId, otherUserName, overrideUserId, onClose, title }) {
  const { user } = useAuth()
  const effectiveUserId = overrideUserId != null ? overrideUserId : user?.id
  const { t } = useLanguage()
  const [messages, setMessages] = useState([])
  const [text, setText] = useState("")
  const [sending, setSending] = useState(false)
  const [otherTyping, setOtherTyping] = useState(false)
  const bottomRef = useRef(null)
  const typingRef = useRef(null)
  const channelRef = useRef(null)
  const chatId = bookingId || listingId || claimId || mechanicId

  useEffect(() => {
    console.log("ChatWindow mount - effectiveUserId:", effectiveUserId, "chatId:", chatId, "mechanicId:", mechanicId, "otherUserId:", otherUserId)
    if (!effectiveUserId || !chatId) return
    load()
    markRead()

    const filterStr = bookingId
      ? `booking_id=eq.${bookingId}`
      : listingId
      ? `listing_id=eq.${listingId}`
      : claimId
      ? `claim_id=eq.${claimId}`
      : `mechanic_id=eq.${mechanicId}`

    const channel = supabase.channel(`chat-${chatId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "chat_messages",
        filter: filterStr
      }, payload => {
        // For claim chats, a single claim_id can have separate admin<->customer and admin<->provider threads.
        // Discard realtime events that don't belong to this specific participant pair.
        if (claimId && otherUserId) {
          const msg = payload.new
          const belongsHere = (msg.sender_id===effectiveUserId && msg.receiver_id===otherUserId) || (msg.sender_id===otherUserId && msg.receiver_id===effectiveUserId)
          if (!belongsHere) return
        }
        setMessages(prev => {
          const exists = prev.find(m => m.id===payload.new.id || m._tempId===payload.new.id)
          if (exists) return prev.map(m => m._tempId===payload.new.id ? {...payload.new} : m)
          return [...prev, payload.new]
        })
        if (payload.new.sender_id !== effectiveUserId) markRead()
      })
      .on("broadcast", { event:"typing" }, payload => {
        if (payload.payload?.userId !== effectiveUserId) {
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
  }, [effectiveUserId, chatId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior:"smooth" })
  }, [messages, otherTyping])

  async function load() {
    let query = supabase.from("chat_messages").select("*")
    if (bookingId) query = query.eq("booking_id", bookingId)
    else if (listingId) {
      query = query.eq("listing_id", listingId)
      // Scope to just the two participants - prevents seeing other customers' messages on same listing
      if (otherUserId) {
        query = query.or(`and(sender_id.eq.${effectiveUserId},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${effectiveUserId})`)
      }
    }
    else if (claimId) {
      query = query.eq("claim_id", claimId)
      // A single claim can have separate admin<->customer and admin<->provider threads.
      // Scope to just the two participants in THIS conversation.
      if (otherUserId) {
        query = query.or(`and(sender_id.eq.${effectiveUserId},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${effectiveUserId})`)
      }
    }
    else if (mechanicId) query = query.eq("mechanic_id", mechanicId)
    const { data, error } = await query.order("created_at", { ascending:true })
    console.log("ChatWindow load() result - data:", data, "error:", error)
    setMessages(data||[])
  }

  async function markRead() {
    let query = supabase.from("chat_messages").update({ is_read:true }).eq("receiver_id", effectiveUserId).eq("is_read", false)
    if (bookingId) query = query.eq("booking_id", bookingId)
    else if (listingId) query = query.eq("listing_id", listingId)
    else if (claimId) query = query.eq("claim_id", claimId)
    else if (mechanicId) query = query.eq("mechanic_id", mechanicId)
    await query
  }

  async function broadcastTyping() {
    if (!channelRef.current) return
    channelRef.current.send({ type:"broadcast", event:"typing", payload:{ userId:effectiveUserId } }).catch(()=>{})
  }

  // Filter out contact info from messages
  function normalizeText(text) {
    // Normalize word numbers to digits
    return text
      .replace(/\bzero\b/gi,"0").replace(/\bone\b/gi,"1").replace(/\btwo\b/gi,"2")
      .replace(/\bthree\b/gi,"3").replace(/\bfour\b/gi,"4").replace(/\bfive\b/gi,"5")
      .replace(/\bsix\b/gi,"6").replace(/\bseven\b/gi,"7").replace(/\beight\b/gi,"8")
      .replace(/\bnine\b/gi,"9").replace(/\boh\b/gi,"0")
      // Normalize obfuscated email
      .replace(/\[at\]/gi,"@").replace(/\(at\)/gi,"@").replace(/\bat\b/gi,"@")
      .replace(/\[dot\]/gi,".").replace(/\(dot\)/gi,".").replace(/\bdot\b/gi,".")
      // Remove spaces/dashes between digits
      .replace(/(\d)[\s\-\.](\d)/g,"$1$2")
      .replace(/(\d)[\s\-\.](\d)/g,"$1$2")
      .replace(/(\d)[\s\-\.](\d)/g,"$1$2")
  }

  function filterContactInfo(text) {
    let filtered = normalizeText(text)
    // Phone numbers - Kenyan formats (07xx, 01xx, +2547xx, +2541xx)
    filtered = filtered.replace(/(?:\+?254|0)[17]\d{8}/g, "[contact removed]")
    // International phone numbers
    filtered = filtered.replace(/(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?)\d{3,4}[\s.-]?\d{3,4}/g, "[contact removed]")
    // Any 10+ consecutive digits
    filtered = filtered.replace(/\d{7,}/g, "[contact removed]")
    // Email addresses (including obfuscated)
    filtered = filtered.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "[contact removed]")
    // WhatsApp/Telegram links
    filtered = filtered.replace(/(?:wa\.me|t\.me|telegram\.me)[/\\]?[\w\d+]*/gi, "[contact removed]")
    // Explicit contact sharing
    filtered = filtered.replace(/(?:my\s+)?(?:number|phone|contact|whatsapp|wa|email|gmail|yahoo|hotmail|line|signal|viber)\s*(?:is|:|-)?\s*[\w.@+\d\s()-]{3,}/gi, "[contact removed]")
    // Social media with contact intent
    filtered = filtered.replace(/(?:call|text|ping|reach|hit|find|dm|message|inbox)\s*(?:me|us)?\s*(?:on|at|via|through)?\s*(?:whatsapp|wa|telegram|signal|viber|ig|instagram|facebook|fb|twitter|tiktok)?\s*[\w.@+\d-]{3,}/gi, "[contact removed]")
    return filtered
  }

  function hasContactInfo(text) {
    const normalized = normalizeText(text)
    const patterns = [
      /(?:\+?254|0)[17]\d{8}/,
      /\d{7,}/,
      /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/,
      /(?:wa\.me|t\.me)/i,
      /(?:my\s+)?(?:number|phone|whatsapp|email)\s*(?:is|:)/i,
      /(?:call|text|ping|reach)\s*(?:me|us)/i,
    ]
    return patterns.some(p => p.test(normalized))
  }

  async function send(e) {
    e.preventDefault()
    if (!text.trim() || sending) return
    const rawText = text.trim()
    const messageText = filterContactInfo(rawText)
    const wasFiltered = messageText !== rawText
    if (wasFiltered) {
      toast("📵 Contact info removed — share details only after booking is confirmed", { icon:"⚠️", duration:5000 })
    }
    const tempId = `temp-${Date.now()}`
    setText("")
    setSending(true)

    const optimistic = {
      id: tempId, _tempId: tempId,
      booking_id: bookingId||null,
      listing_id: listingId||null,
      claim_id: claimId||null,
      mechanic_id: mechanicId||null,
      sender_id: effectiveUserId,
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
      claim_id: claimId||null,
      mechanic_id: mechanicId||null,
      sender_id: effectiveUserId,
      receiver_id: otherUserId,
      message: messageText,
    })

    if (error) {
      console.error("Chat error:", error)
      toast.error("Send failed: " + (error.message || error.details || JSON.stringify(error)))
      setMessages(prev => prev.filter(m => m.id !== tempId))
      setText(messageText)
      setSending(false)
      return
    }

    setMessages(prev => prev.map(m => m.id===tempId ? {...m, _pending:false} : m))
    // Notify the recipient so they get a push/in-app alert, not just a silent unread badge
    try {
      if (!otherUserId) return
      await supabase.from("notifications").insert({
        user_id: otherUserId,
        title: "New message \uD83D\uDCAC",
        message: hasContactInfo(messageText) ? "New message received" : messageText.length > 80 ? messageText.slice(0, 80) + "..." : messageText,
        type: "info"
      })
    } catch(_) { /* notification send failed - non-critical */ }





  }

  

  async function deleteMessage(id) {
    if (!confirm("Delete this message?")) return
    await supabase.from("chat_messages").delete().eq("id", id).eq("sender_id", effectiveUserId)
    setMessages(prev => prev.filter(m => m.id!==id))
  }

  function handleKeyDown(e) {
    if (e.key==="Enter" && !e.shiftKey) { e.preventDefault(); send(e) }
    else broadcastTyping()
  }

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", background:"#f5f5f5", overflow:"hidden" }}>

      {/* Header */}
      <div style={{ padding:"0.85rem 1rem", background:"linear-gradient(135deg,#e6821e,#f09840)", display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:36, height:36, borderRadius:"50%", background:"rgba(255,255,255,0.25)", border:"2px solid rgba(255,255,255,0.5)", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"Syne", fontSize:14, fontWeight:800, color:"#fff", flexShrink:0 }}>
            {otherUserName?.[0]?.toUpperCase()||"?"}
          </div>
          <div>
            <div style={{ fontSize:14, fontWeight:700, color:"#fff", fontFamily:"Syne" }}>{otherUserName}</div>
            <div style={{ fontSize:10, color:"rgba(255,255,255,0.8)" }}>
              {otherTyping?"✍️ typing...":claimId?"🛡️ Claim chat":listingId?"🛒 Marketplace chat":"💬 Booking chat"}
            </div>
          </div>
        </div>
        {onClose&&(
          <button onClick={onClose} style={{ background:"rgba(255,255,255,0.2)", border:"none", borderRadius:"50%", width:32, height:32, color:"#fff", fontSize:18, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>×</button>
        )}
      </div>

      {/* Contact filter notice */}
      <div style={{ background:"#fff8f0", borderBottom:"1px solid #e6821e20", padding:"4px 12px", flexShrink:0 }}>
        <span style={{ fontSize:10, color:"#e6821e" }}>🔒 Contact info is automatically removed to protect both parties</span>
      </div>

      {/* Messages - scrollable */}
      <div style={{ flex:1, overflowY:"auto", padding:"1rem", display:"flex", flexDirection:"column", gap:4, WebkitOverflowScrolling:"touch" }}>
        {messages.length===0&&(
          <div style={{ textAlign:"center", color:"#888", fontSize:12, padding:"3rem 1rem", display:"flex", flexDirection:"column", alignItems:"center", gap:8 }}>
            <div style={{ fontSize:40 }}>💬</div>
            <div style={{ fontFamily:"Syne", fontSize:13, fontWeight:700, color:"#555" }}>Start the conversation</div>
            <div style={{ fontSize:11, color:"#aaa", lineHeight:1.6 }}>Ask about availability, pricing or service details</div>
          </div>
        )}
        {messages.map((m,idx)=>{
          const isMine = m.sender_id===effectiveUserId
          const prevMsg = messages[idx-1]
          const showTime = !prevMsg || new Date(m.created_at)-new Date(prevMsg.created_at)>5*60*1000
          return (
            <div key={m.id}>
              {showTime&&(
                <div style={{ textAlign:"center", fontSize:9, color:"#aaa", margin:"8px 0 4px" }}>
                  {new Date(m.created_at).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}
                </div>
              )}
              <div style={{ display:"flex", justifyContent:isMine?"flex-end":"flex-start", alignItems:"flex-end", gap:6, marginBottom:2 }}>
                {!isMine&&(
                  <div style={{ width:26, height:26, borderRadius:"50%", background:"#e6821e20", display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, fontWeight:700, color:"#e6821e", flexShrink:0 }}>
                    {otherUserName?.[0]?.toUpperCase()||"?"}
                  </div>
                )}
                <div style={{ maxWidth:"72%", display:"flex", flexDirection:"column", alignItems:isMine?"flex-end":"flex-start" }}>
                  <div style={{ padding:"10px 14px", borderRadius:isMine?"18px 18px 4px 18px":"18px 18px 18px 4px", background:isMine?"linear-gradient(135deg,#e6821e,#f09840)":"#ffffff", color:isMine?"#fff":"#000", fontSize:13, lineHeight:1.6, opacity:m._pending?0.6:1, boxShadow:isMine?"0 2px 8px rgba(230,130,30,0.25)":"0 1px 3px rgba(0,0,0,0.08)", wordBreak:"break-word" }}>
                    {m.message}
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:4, marginTop:2 }}>
                    {!showTime&&<span style={{ fontSize:9, color:"#bbb" }}>{new Date(m.created_at).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</span>}
                    {isMine&&<span style={{ fontSize:9, color:m.is_read?"#1d9e75":"#bbb" }}>{m._pending?"⏳":m.is_read?"✓✓":"✓"}</span>}
                    {isMine&&!m._pending&&(
                      <button onClick={()=>deleteMessage(m.id)} style={{ background:"none", border:"none", color:"#ddd", cursor:"pointer", fontSize:10, padding:"0 2px" }}>🗑</button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
        {otherTyping&&(
          <div style={{ display:"flex", alignItems:"flex-end", gap:6 }}>
            <div style={{ width:26, height:26, borderRadius:"50%", background:"#e6821e20", display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, fontWeight:700, color:"#e6821e" }}>
              {otherUserName?.[0]?.toUpperCase()||"?"}
            </div>
            <div style={{ padding:"10px 14px", borderRadius:"18px 18px 18px 4px", background:"#ffffff", boxShadow:"0 1px 3px rgba(0,0,0,0.08)", display:"flex", gap:3, alignItems:"center" }}>
              <div style={{ width:6, height:6, borderRadius:"50%", background:"#e6821e", opacity:0.5 }}/>
              <div style={{ width:6, height:6, borderRadius:"50%", background:"#e6821e", opacity:0.7 }}/>
              <div style={{ width:6, height:6, borderRadius:"50%", background:"#e6821e", opacity:1 }}/>
            </div>
          </div>
        )}
        <div ref={bottomRef}/>
      </div>

      {/* Input */}
      <form onSubmit={send} style={{ padding:"0.75rem", borderTop:"1px solid #e0e0e0", display:"flex", gap:8, background:"#ffffff", flexShrink:0, alignItems:"flex-end" }}>
        <textarea value={text} onChange={e=>setText(e.target.value)} onKeyDown={handleKeyDown}
          placeholder="Type a message..." rows={1}
          style={{ flex:1, background:"#f8f8f8", border:"1px solid #e5e5e5", borderRadius:20, padding:"10px 16px", color:"#000", fontSize:13, outline:"none", fontFamily:"DM Sans,sans-serif", resize:"none", lineHeight:1.5, maxHeight:80, WebkitOverflowScrolling:"touch" }}/>
        <button type="submit" disabled={!text.trim()||sending}
          style={{ background:text.trim()&&!sending?"linear-gradient(135deg,#e6821e,#f09840)":"#f0f0f0", border:"none", borderRadius:"50%", width:42, height:42, color:text.trim()&&!sending?"#fff":"#aaa", fontSize:18, cursor:text.trim()&&!sending?"pointer":"default", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", boxShadow:text.trim()&&!sending?"0 2px 8px rgba(230,130,30,0.35)":"none", transition:"all 0.15s" }}>
          ➤
        </button>
      </form>
    </div>
  )
}












