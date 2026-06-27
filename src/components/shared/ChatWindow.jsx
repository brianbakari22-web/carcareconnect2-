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
    <div style={{ display:"flex", flexDirection:"column", height:"100%", minHeight:320, background:"#ffffff", borderRadius:12, border:"1px solid #e5e5e5", overflow:"hidden" }}>
      <div style={{ padding:"1rem", borderBottom:"1px solid #eeeeee", display:"flex", alignItems:"center", justifyContent:"space-between", background:"#ffffff", flexShrink:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:36, height:36, borderRadius:"50%", background:"#fff8f0", border:"1px solid #e6821e30", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"Syne", fontSize:14, fontWeight:800, color:"#e6821e" }}>
            {otherUserName?.[0]?.toUpperCase()||"?"}
          </div>
          <div>
            <div style={{ fontSize:13, fontWeight:600, color:"#000000" }}>{otherUserName}</div>
            <div style={{ fontSize:10, color:otherTyping?"#1d9e75":"#555", transition:"color 0.2s" }}>
              {otherTyping?"typing...":claimId?"Claim investigation":listingId?"Marketplace chat":"Chat"}
            </div>
          </div>
        </div>
        {onClose&&(
          <button onClick={onClose} style={{ background:"none", border:"none", color:"#777777", fontSize:20, cursor:"pointer", lineHeight:1, padding:"4px" }}>×</button>
        )}
      </div>

      <div style={{ flex:1, overflowY:"auto", padding:"1rem", display:"flex", flexDirection:"column", gap:8, maxHeight:"calc(100% - 120px)", minHeight:200 }}>
        {messages.length===0&&(
          <div style={{ textAlign:"center", color:"#888888", fontSize:12, padding:"2rem" }}>
            <div style={{ fontSize:28, marginBottom:8 }}>💬</div>
            No messages yet. Start the conversation!
          </div>
        )}
        {messages.map(m=>{
          const isMine = m.sender_id===effectiveUserId
          return (
            <div key={m.id} style={{ display:"flex", justifyContent:isMine?"flex-end":"flex-start", alignItems:"flex-end", gap:4 }}>
              {isMine&&!m._pending&&(
                <button onClick={()=>deleteMessage(m.id)} style={{ background:"#fff5f5", border:"1px solid #e24b4a40", borderRadius:6, color:"#e24b4a", cursor:"pointer", fontSize:11, padding:"3px 7px", lineHeight:1, flexShrink:0 }} title="Delete">🗑</button>
              )}
              <div style={{ maxWidth:"75%", padding:"10px 14px", borderRadius:isMine?"14px 14px 4px 14px":"14px 14px 14px 4px", background:isMine?"#e6821e":"#ffffff", color:isMine?"#fff":"#000000", fontSize:13, lineHeight:1.5, opacity:m._pending?0.7:1, transition:"opacity 0.2s" }}>
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
            <div style={{ padding:"10px 14px", borderRadius:"14px 14px 14px 4px", background:"#f5f5f5", color:"#777777", fontSize:20, letterSpacing:4 }}>•••</div>
          </div>
        )}
        <div ref={bottomRef}/>
      </div>

      <form onSubmit={send} style={{ padding:"0.75rem", borderTop:"1px solid #eeeeee", display:"flex", gap:8, background:"#ffffff", flexShrink:0 }}>
        <textarea value={text} onChange={e=>setText(e.target.value)} onKeyDown={handleKeyDown}
          placeholder={t("typeMessage")} rows={1}
          style={{ flex:1, background:"#ffffff", border:"1px solid #e5e5e5", borderRadius:10, padding:"10px 12px", color:"#000000", fontSize:13, outline:"none", fontFamily:"'DM Sans',sans-serif", resize:"none", lineHeight:1.4, maxHeight:100 }}/>
        <button type="submit" disabled={!text.trim()||sending}
          style={{ background:text.trim()&&!sending?"#e6821e":"#f5f5f5", border:"none", borderRadius:10, color:text.trim()&&!sending?"#fff":"#555", fontSize:18, padding:"0 16px", cursor:text.trim()&&!sending?"pointer":"default", flexShrink:0, transition:"all 0.12s" }}>
          ➤
        </button>
      </form>
    </div>
  )
}












