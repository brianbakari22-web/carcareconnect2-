import { useState, useEffect, useRef } from "react"
import { supabase } from "../../lib/supabase"
import { useAuth } from "../../contexts/AuthContext"
import useIsMobile from "../../lib/useIsMobile"
import ChatWindow from "../shared/ChatWindow"

export default function ProviderChat() {
  const { user } = useAuth()
  const isMobile = useIsMobile()
  const [conversations, setConversations] = useState([])
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(true)
  const [menuFor, setMenuFor] = useState(null) // conversation key for context menu
  const [hidden, setHidden] = useState([])
  const longPressRef = useRef(null)
  
  function startLongPress(c) {
    longPressRef.current = setTimeout(() => setMenuFor(c.bookingId||c.inventoryId), 500)
  }
  function cancelLongPress() {
    clearTimeout(longPressRef.current)
  }
  
  async function deleteConversation(c) {
    if (!c.bookingId && !c.inventoryId) return
    const col = c.bookingId ? "booking_id" : "inventory_id"
    const val = c.bookingId || c.inventoryId
    const { error } = await supabase.from("chat_messages").delete()
      .eq(col, val)
    console.log("delete result:", error)
    if (error) { console.error("Delete failed:", error.message); return }
    // Save to DB so it persists across devices
    await supabase.from("hidden_conversations").upsert({
      user_id: user.id,
      [col === "booking_id" ? "booking_id" : "inventory_id"]: val
    }, { onConflict: col === "booking_id" ? "user_id,booking_id" : "user_id,inventory_id" })
    setHidden(prev => [...prev, val])
    setMenuFor(null)
  }
  async function markAllRead(c) {
    const col = c.bookingId ? "booking_id" : "inventory_id"
    const val = c.bookingId || c.inventoryId
    await supabase.from("chat_messages").update({ is_read:true })
      .eq(col, val).eq("receiver_id", user.id)
    setConversations(prev => prev.map(x => (x.bookingId||x.inventoryId)===val ? {...x, unread:0} : x))
    setMenuFor(null)
  }

  useEffect(() => {
    if (!user) return
    load()
    const sub = supabase.channel("provider-chat-list")
      .on("postgres_changes", { event:"INSERT", schema:"public", table:"chat_messages", filter:`receiver_id=eq.${user.id}` }, () => load())
      .subscribe()
    return () => supabase.removeChannel(sub)
  }, [user])

  async function load() {
    const { data: hiddenData } = await supabase.from("hidden_conversations").select("booking_id,inventory_id").eq("user_id", user.id)
    const hiddenKeys = (hiddenData||[]).map(h => h.booking_id || h.inventory_id)
    setHidden(hiddenKeys)
    const { data: bookings } = await supabase.from("bookings")
      .select("id,service_name,customer_id,status,booking_date")
      .eq("provider_id", user.id)
      .not("status","eq","deleted")
      .order("created_at", { ascending:false })

    if (!bookings||bookings.length===0) { 
    // Still check for inventory chats even with no bookings
  }

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
      const _hasMessages = msgs.length>0
      const unread = msgs.filter(m=>m.receiver_id===user.id&&!m.is_read).length
      return {
        _hasMessages,
        bookingId: b.id, serviceName: b.service_name, bookingDate: b.booking_date,
        status: b.status, otherUserId: b.customer_id,
        otherUserName: `${customer?.first_name||""} ${customer?.last_name||""}`.trim()||"Customer",
        lastMessage: last?.message||"No messages yet", lastTime: last?.created_at, unread,
      }
    })
    // Fetch inventory/parts chat messages for this provider
    const { data: invMsgs } = await supabase.from("chat_messages")
      .select("*, inventory!chat_messages_inventory_id_fkey(name,provider_id), sender:profiles!chat_messages_sender_id_fkey(first_name,last_name)")
      .not("inventory_id", "is", null)
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .order("created_at", { ascending:false })

    if (invMsgs?.length) {
      const inventoryIds = [...new Set(invMsgs.map(m=>m.inventory_id))]
      inventoryIds.forEach(invId => {
        const msgs = invMsgs.filter(m=>m.inventory_id===invId)
        const last = msgs[0]
        const otherUserId = last.sender_id===user.id ? last.receiver_id : last.sender_id
        const otherProfile = last.sender_id===user.id ? null : last.sender
        const unread = msgs.filter(m=>m.receiver_id===user.id&&!m.is_read).length
        if (!convs.find(c=>c.inventoryId===invId)) {
          convs.push({
            _hasMessages: true,
            inventoryId: invId,
            bookingId: null,
            serviceName: last.inventory?.name||"Parts inquiry",
            otherUserId,
            otherUserName: otherProfile ? otherProfile.first_name+" "+otherProfile.last_name : "Customer",
            lastMessage: last.message||"",
            lastTime: last.created_at,
            unread,
          })
        }
      })
    }
    console.log("ProviderChat conversations:", convs.length, "hiddenKeys:", hiddenKeys, "user.id:", user.id)
    setConversations(convs.filter(c => !hiddenKeys.includes(c.bookingId||c.inventoryId)))
    setLoading(false)
  }

  const SC = { pending:"#e6821e", confirmed:"#378add", "in-progress":"#8b5cf6", completed:"#1d9e75", cancelled:"#e24b4a" }

  return (
    <>
      {selected&&(
        <div style={{ position:"fixed", inset:0, zIndex:1000, display:"flex", flexDirection:isMobile?"column":"row", alignItems:isMobile?"stretch":"center", justifyContent:"center", background:"rgba(0,0,0,0.7)" }}
          onClick={e=>{ if(e.target===e.currentTarget) setSelected(null) }}>
          <div style={{ marginTop:isMobile?"auto":"0", background:"#ffffff", borderRadius:isMobile?"16px 16px 0 0":"16px", border:"1px solid #eeeeee", width:isMobile?"100%":520, height:isMobile?"80vh":600, display:"flex", flexDirection:"column", overflow:"hidden" }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"1rem", borderBottom:"1px solid #eeeeee", flexShrink:0 }}>
              <div>
                <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:800, color:"#000000" }}>{selected.otherUserName}</div>
                <div style={{ fontSize:11, color:"#777777" }}>{selected.serviceName}</div>
              </div>
              <button onClick={()=>setSelected(null)} style={{ background:"#f5f5f5", border:"none", borderRadius:"50%", width:32, height:32, color:"#555555", cursor:"pointer", fontSize:18, display:"flex", alignItems:"center", justifyContent:"center" }}>×</button>
            </div>
            <div style={{ flex:1, minHeight:0 }}>
              <ChatWindow bookingId={selected.bookingId} inventoryId={selected.inventoryId} otherUserId={selected.otherUserId} otherUserName={selected.otherUserName} onClose={()=>setSelected(null)}/>
            </div>
          </div>
        </div>
      )}
      <div style={{ fontFamily:"Syne", fontSize:isMobile?16:18, fontWeight:800, color:"#000000", marginBottom:4 }}>Customer Messages</div>
      <div style={{ fontSize:11, color:"#777777", marginBottom:"1rem" }}>{conversations.filter(c=>!hidden.includes(c.bookingId||c.inventoryId)).length} active conversation{conversations.filter(c=>!hidden.includes(c.bookingId||c.inventoryId)).length!==1?"s":""}</div>
      {loading&&<div style={{ color:"#777777", fontSize:13 }}>Loading...</div>}
      {!loading&&conversations.length===0&&<div style={{ color:"#888888", fontSize:13, textAlign:"center", padding:"3rem" }}><div style={{ fontSize:32, marginBottom:10 }}>💬</div><div style={{ fontWeight:600, marginBottom:6 }}>No conversations yet</div><div style={{ fontSize:11, color:"#aaa" }}>Conversations appear here when customers book your services</div></div>}
      {/* Context menu overlay */}
      {menuFor&&(
        <div style={{ position:"fixed", inset:0, zIndex:200, background:"rgba(0,0,0,0.5)" }} onClick={()=>setMenuFor(null)}>
          <div style={{ position:"absolute", bottom:0, left:0, right:0, background:"#fff", borderRadius:"20px 20px 0 0", padding:"1.25rem", boxShadow:"0 -4px 24px rgba(0,0,0,0.15)" }}
            onClick={e=>e.stopPropagation()}>
            <div style={{ width:36, height:4, background:"#e0e0e0", borderRadius:2, margin:"0 auto 1.25rem" }}/>
            <div style={{ fontFamily:"Syne", fontSize:15, fontWeight:800, color:"#000", marginBottom:"1rem", textAlign:"center" }}>
              {conversations.find(c=>(c.bookingId||c.inventoryId)===menuFor)?.otherUserName}
            </div>
            {[
              { icon:"✓", label:"Mark all as read", color:"#1d9e75", action:()=>{ const c=conversations.find(x=>(x.bookingId||x.inventoryId)===menuFor); if(c) markAllRead(c) } },
              { icon:"💬", label:"Open chat", color:"#378add", action:()=>{ const c=conversations.find(x=>(x.bookingId||x.inventoryId)===menuFor); if(c){ setSelected(c); setMenuFor(null) } } },
              { icon:"🗑", label:"Delete conversation", color:"#e24b4a", action:()=>{ const c=conversations.find(x=>(x.bookingId||x.inventoryId)===menuFor); if(c) deleteConversation(c) } },
            ].map(item=>(
              <div key={item.label} onClick={item.action}
                style={{ display:"flex", alignItems:"center", gap:14, padding:"1rem", borderRadius:12, cursor:"pointer", marginBottom:6, background:"#f8f8f8" }}>
                <span style={{ fontSize:20 }}>{item.icon}</span>
                <span style={{ fontSize:14, fontWeight:600, color:item.color }}>{item.label}</span>
              </div>
            ))}
            <div onClick={()=>setMenuFor(null)}
              style={{ display:"flex", alignItems:"center", justifyContent:"center", padding:"1rem", borderRadius:12, cursor:"pointer", background:"#f0f0f0", marginTop:4 }}>
              <span style={{ fontSize:14, fontWeight:600, color:"#555" }}>Cancel</span>
            </div>
          </div>
        </div>
      )}

      {conversations.filter(c=>!hidden.includes(c.bookingId||c.inventoryId)).map(c=>({...c})).map(c=>{
        const key = c.bookingId||c.inventoryId
        const isSelected = selected?.bookingId===c.bookingId
        const isMenuOpen = menuFor===key
        return (
        <div key={key}
          onClick={()=>{ if(!menuFor) setSelected(c) }}
          onTouchStart={()=>startLongPress(c)}
          onTouchEnd={cancelLongPress}
          onTouchMove={cancelLongPress}
          onContextMenu={e=>{ e.preventDefault(); setMenuFor(key) }}
          style={{ background:isMenuOpen?"#f0f6ff":"#ffffff", border:`1px solid ${isSelected?"#378add40":isMenuOpen?"#378add30":"#f0f0f0"}`, borderRadius:10, padding:"0.9rem", marginBottom:8, cursor:"pointer", transition:"all 0.15s", userSelect:"none" }}>
          <div style={{ display:"flex", alignItems:"flex-start", gap:10 }}>
            <div style={{ width:44, height:44, borderRadius:"50%", background:"#eff6ff", border:"1px solid #378add30", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"Syne", fontSize:16, fontWeight:800, color:"#378add", flexShrink:0 }}>
              {c.otherUserName[0]?.toUpperCase()}
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:2 }}>
                <div style={{ fontSize:13, fontWeight:c.unread>0?700:500, color:"#000000", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{c.otherUserName}</div>
                <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                  {c.unread>0&&<div style={{ width:20, height:20, borderRadius:"50%", background:"#378add", color:"#fff", fontSize:10, fontWeight:700, display:"flex", alignItems:"center", justifyContent:"center" }}>{c.unread}</div>}
                  <span style={{ fontSize:10, color:"#888888" }}>{c.lastTime?new Date(c.lastTime).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}):""}</span>
                </div>
              </div>
              <div style={{ fontSize:11, color:"#666", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", marginBottom:4 }}>{c.lastMessage||"Tap to start chatting"}</div>
              <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                <span style={{ fontSize:10, color:SC[c.status]||"#555" }}>● {c.status}</span>
                <span style={{ fontSize:10, color:"#888888" }}>· {c.serviceName}</span>
              </div>
            </div>
            <div style={{ fontSize:11, color:"#378add", flexShrink:0, marginTop:2 }}>💬</div>
          </div>
        </div>
      )})}
    </>
  )
}






