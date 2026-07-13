import { useEffect, useState, useRef } from "react"
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
  const [menuFor, setMenuFor] = useState(null)
  const [selected, setSelected] = useState(null)
  const [hidden, setHidden] = useState([])
  const longPressRef = useRef(null)

  function startLongPress(key) {
    longPressRef.current = setTimeout(() => setMenuFor(key), 500)
  }
  function cancelLongPress() { clearTimeout(longPressRef.current) }

  async function deleteConversation(c) {
    const col = c.bookingId ? "booking_id" : c.listingId ? "listing_id" : "inventory_id"
    const val = c.bookingId || c.listingId || c.inventoryId
    await supabase.from("chat_messages").delete().eq(col, val)
    const hidePayload = { user_id: user.id }
    hidePayload[col] = val
    await supabase.from("hidden_conversations").upsert(hidePayload, { onConflict: "user_id,"+col })
    setHidden(prev => [...prev, val])
    setMenuFor(null)
  }

  async function markAllRead(c) {
    const col = c.bookingId ? "booking_id" : c.listingId ? "listing_id" : "inventory_id"
    const val = c.bookingId || c.listingId || c.inventoryId
    await supabase.from("chat_messages").update({ is_read:true })
      .eq(col, val).eq("receiver_id", user.id)
    setConversations(prev => prev.map(x => (x.bookingId||x.listingId||x.inventoryId)===val ? {...x, unread:0} : x))
    setMenuFor(null)
  }
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
    const { data: hiddenData } = await supabase.from("hidden_conversations").select("booking_id,inventory_id,listing_id").eq("user_id", user.id)
    const hiddenKeys = (hiddenData||[]).map(h => h.booking_id || h.inventory_id || h.listing_id)
    setHidden(hiddenKeys)
    const { data: bookings } = await supabase.from("bookings")
      .select("id,service_name,provider_id,assigned_mechanic_id,driver_id,status,booking_date")
      .eq("customer_id", user.id)
      .order("created_at", { ascending:false })

    // Continue even if no bookings - need to load listing messages too

    const providerIds = [...new Set(bookings.map(b=>b.provider_id))]
    const { data: profs } = await supabase.from("profiles")
      .select("id,first_name,last_name,business_name").in("id", providerIds)

    const mechanicIds = [...new Set(bookings.map(b=>b.assigned_mechanic_id).filter(Boolean))]
    const { data: mechs } = mechanicIds.length>0 ? await supabase.from("mechanics")
      .select("id,user_id,first_name,last_name").in("id", mechanicIds) : { data: [] }
    const driverIds = [...new Set(bookings.map(b=>b.driver_id).filter(Boolean))]
    const { data: drivers } = driverIds.length>0 ? await supabase.from("profiles")
      .select("id,first_name,last_name").in("id", driverIds) : { data: [] }

    const { data: lastMessages } = await supabase.from("chat_messages")
      .select("booking_id,message,created_at,sender_id,is_read,receiver_id")
      .in("booking_id", bookings.map(b=>b.id))
      .order("created_at", { ascending:false })

    const convs = bookings.map(b => {
      const provider = profs?.find(p=>p.id===b.provider_id)
      const mechanic = mechs?.find(mc=>mc.id===b.assigned_mechanic_id)
      const msgs = lastMessages?.filter(m=>m.booking_id===b.id)||[]
      const last = msgs[0]
      const unread = msgs.filter(m=>m.receiver_id===user.id&&!m.is_read).length
      // If the mechanic has actually sent/received a message on this booking, show their identity instead of the provider's
      const mechanicIsParty = mechanic?.user_id && msgs.some(m=>m.sender_id===mechanic.user_id||m.receiver_id===mechanic.user_id)
      const driver = drivers?.find(d=>d.id===b.driver_id)
      const driverIsParty = driver && msgs.some(m=>m.sender_id===driver.id||m.receiver_id===driver.id)
      const otherUserId = mechanicIsParty ? mechanic.user_id : driverIsParty ? driver.id : b.provider_id
      const otherUserName = mechanicIsParty
        ? `${mechanic.first_name||""} ${mechanic.last_name||""}`.trim()||"Mechanic"
        : driverIsParty
        ? `${driver.first_name||""} ${driver.last_name||""}`.trim()||"Driver"
        : provider?.business_name||`${provider?.first_name||""} ${provider?.last_name||""}`.trim()||"Provider"
      return {
        bookingId: b.id,
        serviceName: b.service_name,
        _hasMessages: msgs.length>0,
        bookingDate: b.booking_date,
        status: b.status,
        otherUserId,
        otherUserName,
        lastMessage: last?.message||"No messages yet",
        lastTime: last?.created_at,
        unread,
      }
    })
    const filtered = convs // Show all bookings including those without messages yet
    // Load listing messages
    const { data: listingMsgs } = await supabase.from("chat_messages")
      .select("id,listing_id,sender_id,receiver_id,message,created_at,is_read")
      .eq("receiver_id", user.id)
      .not("listing_id","is",null)
      .order("created_at", { ascending:false })
    const listingConvs = []
    if (listingMsgs?.length > 0) {
      const senderIds = [...new Set(listingMsgs.map(m=>m.sender_id))]
      const listingIds = [...new Set(listingMsgs.map(m=>m.listing_id))]
      const [{ data: senderProfs }, { data: listings }] = await Promise.all([
        supabase.from("profiles").select("id,first_name,last_name,business_name").in("id", senderIds),
        supabase.from("marketplace_listings").select("id,title").in("id", listingIds)
      ])
      const grouped = {}
      listingMsgs.forEach(m => {
        const key = `${m.sender_id}-${m.listing_id}`
        if (!grouped[key]) grouped[key] = []
        grouped[key].push(m)
      })
      Object.entries(grouped).forEach(([key, msgs]) => {
        const last = msgs[0]
        const sender = senderProfs?.find(p=>p.id===last.sender_id)
        const listing = listings?.find(l=>l.id===last.listing_id)
        listingConvs.push({
          listingId: last.listing_id,
          serviceName: listing?.title||"Marketplace item",
          otherUserId: last.sender_id,
          otherUserName: sender?.business_name||`${sender?.first_name||""} ${sender?.last_name||""}`.trim()||"Buyer",
          lastMessage: last.message||"",
          lastTime: last.created_at,
          unread: msgs.filter(m=>!m.is_read).length,
          type: "listing"
        })
      })
    }
    const allConvs = [...filtered, ...listingConvs].sort((a,b)=>new Date(b.lastTime||0)-new Date(a.lastTime||0))
    setConversations(allConvs.filter(c => !hiddenKeys.includes(c.bookingId||c.listingId||c.inventoryId)))
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

      {/* Context menu overlay */}
      {menuFor&&(
        <div style={{ position:"fixed", inset:0, zIndex:200, background:"rgba(0,0,0,0.5)" }} onClick={()=>setMenuFor(null)}>
          <div style={{ position:"absolute", bottom:0, left:0, right:0, background:"#fff", borderRadius:"20px 20px 0 0", padding:"1.25rem", boxShadow:"0 -4px 24px rgba(0,0,0,0.15)" }}
            onClick={e=>e.stopPropagation()}>
            <div style={{ width:36, height:4, background:"#e0e0e0", borderRadius:2, margin:"0 auto 1.25rem" }}/>
            <div style={{ fontFamily:"Syne", fontSize:15, fontWeight:800, color:"#000", marginBottom:"1rem", textAlign:"center" }}>
              {conversations.find(c=>(c.bookingId||c.listingId||c.inventoryId)===menuFor)?.otherUserName}
            </div>
            {[
              { icon:"✓", label:"Mark all as read", color:"#1d9e75", action:()=>{ const c=conversations.find(x=>(x.bookingId||x.listingId||x.inventoryId)===menuFor); if(c) markAllRead(c) } },
              { icon:"💬", label:"Open chat", color:"#e6821e", action:()=>{ const c=conversations.find(x=>(x.bookingId||x.listingId||x.inventoryId)===menuFor); if(c){ setSelected(c); setMenuFor(null) } } },
              { icon:"🗑", label:"Delete conversation", color:"#e24b4a", action:()=>{ const c=conversations.find(x=>(x.bookingId||x.listingId||x.inventoryId)===menuFor); if(c) deleteConversation(c) } },
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
      {/* Conversation list */}
      <div style={{ fontFamily:"Syne", fontSize:isMobile?16:18, fontWeight:800, color:"#000000", marginBottom:4 }}>Messages</div>
      <div style={{ fontSize:11, color:"#777777", marginBottom:"1rem" }}>{conversations.length} active booking{conversations.length!==1?"s":""}</div>

      {loading&&<div style={{ color:"#777777", fontSize:13 }}>Loading...</div>}
      {!loading&&conversations.length===0&&(
        <div style={{ color:"#888888", fontSize:13, textAlign:"center", padding:"3rem" }}>
          <div style={{ fontSize:32, marginBottom:10 }}>💬</div>
          No conversations yet. Book a service to start chatting with providers.
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









