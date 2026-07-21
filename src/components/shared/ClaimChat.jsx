import { useEffect, useState, useRef } from "react"
import { supabase } from "../../lib/supabase"
import { validateFile, sanitizeFilePath } from "../../lib/uploadValidation"
import { useAuth } from "../../contexts/AuthContext"
import toast from "react-hot-toast"

export default function ClaimChat({ claimId, claim, onClose }) {
  const { user, profile } = useAuth()
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState("")
  const [photos, setPhotos] = useState([])
  const [uploading, setUploading] = useState(false)
  const [sending, setSending] = useState(false)
  const [messageType, setMessageType] = useState("message")
  const messagesEndRef = useRef(null)
  useEffect(() => {
    if (!claimId) return
    let active = true
    let channel
    const setup = async () => {
      loadMessages()
      const channelName = `claim-chat-${claimId}`
      // Remove any stale channel with same name
      for (const ch of supabase.getChannels()) {
        if (ch.topic === `realtime:${channelName}`) {
          await supabase.removeChannel(ch)
        }
      }
      if (!active) return
      channel = supabase
        .channel(channelName)
        .on("postgres_changes", { event:"INSERT", schema:"public", table:"chat_messages", filter:`claim_id=eq.${claimId}` },
          payload => {
            setMessages(m => [...m, payload.new])
            setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior:"smooth" }), 100)
          })
        .subscribe()
    }
    setup()
    return () => {
      active = false
      if (channel) supabase.removeChannel(channel)
    }
  }, [claimId])

  async function loadMessages() {
    const { data } = await supabase.from("chat_messages")
      .select("*, sender:profiles!chat_messages_sender_id_fkey(first_name,last_name,role)")
      .eq("claim_id", claimId)
      .order("created_at", { ascending:true })
    setMessages(data||[])
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior:"smooth" }), 100)
  }

  async function uploadPhoto(file) {
    const ext = file.name.split(".").pop()
    const path = `${claimId}/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from("claim-evidence").upload(path, file)
    if (error) throw error
    const { data } = supabase.storage.from("claim-evidence").getPublicUrl(path)
    return data.publicUrl
  }

  async function handlePhotoSelect(e) {
    const files = Array.from(e.target.files).slice(0, 3)
    setUploading(true)
    try {
      const urls = await Promise.all(files.map(uploadPhoto))
      setPhotos(prev => [...prev, ...urls].slice(0, 3))
    } catch(err) { toast.error("Photo upload failed: "+err.message) }
    setUploading(false)
  }

  async function sendMessage(e) {
    e.preventDefault()
    if (!newMessage.trim() && photos.length === 0) return
    setSending(true)
    try {
      await supabase.from("chat_messages").insert({
        claim_id: claimId,
        sender_id: user.id,
        sender_role: profile?.role,
        message: newMessage.trim(),
        photo_urls: photos,
        message_type: messageType,
        receiver_id: profile?.role === "admin" ? claim?.customer_id : null
      })
      // Notify relevant parties
      const notifyUsers = []
      if (profile?.role === "customer") {
        // Notify admin and provider
        const { data: admins } = await supabase.from("profiles").select("id").eq("role","admin")
        admins?.forEach(a => notifyUsers.push({ id:a.id, msg:"Customer added "+( messageType==="evidence"?"evidence":"a message")+" to claim" }))
        if (claim?.provider_id) notifyUsers.push({ id:claim.provider_id, msg:"A claim has been filed against you. Please respond." })
      } else if (profile?.role === "provider") {
        // Notify admin and customer
        const { data: admins } = await supabase.from("profiles").select("id").eq("role","admin")
        admins?.forEach(a => notifyUsers.push({ id:a.id, msg:"Provider responded to claim #"+claimId }))
        if (claim?.customer_id) notifyUsers.push({ id:claim.customer_id, msg:"The service provider has responded to your claim." })
      } else if (profile?.role === "admin") {
        // Notify customer and provider
        if (claim?.customer_id) notifyUsers.push({ id:claim.customer_id, msg:"CCC Admin replied to your service claim." })
        if (claim?.provider_id) notifyUsers.push({ id:claim.provider_id, msg:"CCC Admin replied regarding the service claim." })
      }
      for (const u of notifyUsers) {
        await supabase.from("notifications").insert({
          user_id: u.id,
          title: "Claim update 🛡️",
          message: u.msg,
          type: "info"
        })
      }
      setNewMessage("")
      setPhotos([])
      setMessageType("message")
    } catch(err) { toast.error(err.message) }
    setSending(false)
  }

  const ROLE_COLOR = { customer:"#e6821e", provider:"#8b5cf6", admin:"#378add" }
  const TYPE_LABEL = { evidence:"📸 Evidence", response:"💬 Response", decision:"⚖️ Decision", message:"💬 Message" }

  return (
    <div style={{ display:"flex", flexDirection:"column", height:400, background:"#f8f8f8", borderRadius:12, overflow:"hidden", border:"1px solid #eee" }}>
      {/* Header */}
      <div style={{ background:"#fff", padding:"0.75rem 1rem", borderBottom:"1px solid #eee", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div style={{ fontFamily:"Syne", fontSize:13, fontWeight:700 }}>🛡️ Claim Discussion</div>
        <div style={{ fontSize:10, color:"#888" }}>All parties can view this conversation</div>
      </div>
      {/* Messages */}
      <div style={{ flex:1, overflowY:"auto", padding:"0.75rem", display:"flex", flexDirection:"column", gap:8 }}>
        {messages.length===0&&(
          <div style={{ textAlign:"center", color:"#aaa", fontSize:12, padding:"2rem" }}>
            No messages yet. Add your evidence or response below.
          </div>
        )}
        {messages.map(m => {
          const isMe = m.sender_id === user.id
          const roleColor = ROLE_COLOR[m.sender?.role||m.sender_role] || "#888"
          return (
            <div key={m.id} style={{ display:"flex", flexDirection:"column", alignItems:isMe?"flex-end":"flex-start" }}>
              <div style={{ fontSize:10, color:roleColor, marginBottom:2, fontWeight:600 }}>
                {isMe?"You":((m.sender?.first_name||"")+" "+(m.sender?.last_name||"")).trim()} · {m.sender?.role||m.sender_role}
                {m.message_type&&m.message_type!=="message"&&<span style={{ marginLeft:6, background:roleColor+"20", padding:"1px 6px", borderRadius:4 }}>{TYPE_LABEL[m.message_type]}</span>}
              </div>
              <div style={{ maxWidth:"85%", background:isMe?"#e6821e":"#fff", borderRadius:isMe?"12px 12px 4px 12px":"12px 12px 12px 4px", padding:"8px 12px", border:"1px solid #eee" }}>
                {m.message&&<div style={{ fontSize:13, color:isMe?"#fff":"#000", lineHeight:1.5 }}>{m.message}</div>}
                {m.photo_urls?.length>0&&(
                  <div style={{ display:"flex", gap:6, marginTop:m.message?6:0, flexWrap:"wrap" }}>
                    {m.photo_urls.map((url,i)=>(
                      <img key={i} src={url} alt="Evidence" onClick={()=>window.open(url,"_blank")}
                        style={{ width:80, height:80, objectFit:"cover", borderRadius:6, cursor:"pointer", border:"1px solid #eee" }}/>
                    ))}
                  </div>
                )}
                <div style={{ fontSize:9, color:isMe?"rgba(255,255,255,0.7)":"#aaa", marginTop:4, textAlign:"right" }}>
                  {new Date(m.created_at).toLocaleTimeString()}
                </div>
              </div>
            </div>
          )
        })}
        <div ref={messagesEndRef}/>
      </div>
      {/* Message type selector */}
      <div style={{ background:"#fff", padding:"0.5rem 0.75rem", borderTop:"1px solid #eee", display:"flex", gap:6 }}>
        {[["message","💬 Message"],["evidence","📸 Evidence"],["response","🔄 Response"]].map(([k,l])=>(
          <button key={k} onClick={()=>setMessageType(k)}
            style={{ padding:"4px 10px", borderRadius:6, border:"1px solid "+(messageType===k?"#e6821e":"#eee"), background:messageType===k?"#fff8f0":"#f8f8f8", color:messageType===k?"#e6821e":"#666", fontSize:11, cursor:"pointer" }}>
            {l}
          </button>
        ))}
      </div>
      {/* Photo previews */}
      {photos.length>0&&(
        <div style={{ background:"#fff", padding:"0.5rem 0.75rem", display:"flex", gap:6, flexWrap:"wrap" }}>
          {photos.map((url,i)=>(
            <div key={i} style={{ position:"relative" }}>
              <img src={url} alt="" style={{ width:50, height:50, objectFit:"cover", borderRadius:6, border:"1px solid #eee" }}/>
              <button onClick={()=>setPhotos(p=>p.filter((_,j)=>j!==i))}
                style={{ position:"absolute", top:-4, right:-4, background:"#e24b4a", border:"none", borderRadius:"50%", width:16, height:16, color:"#fff", fontSize:10, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>×</button>
            </div>
          ))}
        </div>
      )}
      {/* Input */}
      <div style={{ background:"#fff", padding:"0.75rem", borderTop:"1px solid #eee", display:"flex", gap:6 }}>
        <input ref={fileInputRef} type="file" accept="image/*" multiple style={{ display:"none" }} onChange={handlePhotoSelect}/>
        <button onClick={()=>fileInputRef.current?.click()} disabled={uploading||photos.length>=3}
          style={{ background:"#f8f8f8", border:"1px solid #eee", borderRadius:8, padding:"0 10px", cursor:"pointer", fontSize:16, flexShrink:0 }}>
          {uploading?"⏳":"📷"}
        </button>
        <input value={newMessage} onChange={e=>setNewMessage(e.target.value)}
          placeholder={messageType==="evidence"?"Describe your evidence...":messageType==="response"?"Write your response...":"Type a message..."}
          style={{ flex:1, background:"#f5f5f5", border:"1px solid #e0e0e0", borderRadius:8, padding:"8px 12px", fontSize:13, outline:"none" }}
          onKeyDown={e=>{ if(e.key==="Enter"&&!e.shiftKey){ e.preventDefault(); sendMessage(e) }}}/>
        <button onClick={sendMessage} disabled={sending||uploading||(!newMessage.trim()&&photos.length===0)}
          style={{ background:"#e6821e", border:"none", borderRadius:8, color:"#fff", padding:"8px 14px", cursor:"pointer", fontSize:13, fontWeight:700, flexShrink:0 }}>
          {sending?"...":"Send"}
        </button>
      </div>
    </div>
  )
}
