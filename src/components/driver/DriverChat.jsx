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
  const [tab, setTab] = useState("all")

  useEffect(() => {
    if (!user) return
    load()
    const sub = supabase.channel("driver-chat-list")
      .on("postgres_changes", { event:"INSERT", schema:"public", table:"chat_messages", filter:`receiver_id=eq.${user.id}` }, () => load())
      .subscribe()
    return () => supabase.removeChannel(sub)
  }, [user])

  async function load() {
    const convos = []

    // Booking conversations
    const { data: bookings } = await supabase.from("bookings")
      .select("id,service_name,customer_id,status,booking_date")
      .eq("driver_id", user.id)
      .order("created_at", { ascending:false })

    if (bookings?.length) {
      const customerIds = [...new Set(bookings.map(b=>b.customer_id))]
      const { data: profs } = await supabase.from("profiles")
        .select("id,first_name,last_name").in("id", customerIds)
      const { data: lastMessages } = await supabase.from("chat_messages")
        .select("booking_id,message,created_at,sender_id,is_read,receiver_id")
        .in("booking_id", bookings.map(b=>b.id))
        .order("created_at", { ascending:false })

      bookings.forEach(b=>{
        const profile = profs?.find(p=>p.id===b.customer_id)
        const msgs = lastMessages?.filter(m=>m.booking_id===b.id)||[]
        const last = msgs[0]
        const unread = msgs.filter(m=>m.receiver_id===user.id&&!m.is_read).length
        convos.push({
          id: b.id,
          type: "booking",
          bookingId: b.id,
          listingId: null,
          otherUserId: b.customer_id,
          name: profile ? `${profile.first_name} ${profile.last_name}` : "Customer",
          subtitle: b.service_name,
          status: b.status,
          lastMessage: last?.message||"",
          lastTime: last?.created_at||b.booking_date,
          unread,
        })
      })
    }

    // Marketplace conversations
    const { data: marketMsgs } = await supabase.from("chat_messages")
      .select("*, marketplace_listings(title,seller_id), profiles!chat_messages_sender_id_fkey(first_name,last_name)")
      .not("listing_id", "is", null)
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .order("created_at", { ascending:false })

    if (marketMsgs?.length) {
      const listingIds = [...new Set(marketMsgs.map(m=>m.listing_id))]
      listingIds.forEach(lid=>{
        const msgs = marketMsgs.filter(m=>m.listing_id===lid)
        const last = msgs[0]
        const otherUserId = last.sender_id===user.id ? last.receiver_id : last.sender_id
        const otherProfile = last.profiles
        const unread = msgs.filter(m=>m.receiver_id===user.id&&!m.is_read).length
        const existing = convos.find(c=>c.listingId===lid)
        if (!existing) {
          convos.push({
            id: lid,
            type: "marketplace",
            bookingId: null,
            listingId: lid,
            otherUserId,
            name: otherProfile ? `${otherProfile.first_name} ${otherProfile.last_name}` : "User",
            subtitle: last.marketplace_listings?.title||"Marketplace listing",
            status: "active",
            lastMessage: last.message||"",
            lastTime: last.created_at,
            unread,
          })
        }
      })
    }

    // Sort by latest message
    convos.sort((a,b)=>new Date(b.lastTime)-new Date(a.lastTime))
    setConversations(convos)
    setLoading(false)
  }

  const filtered = tab==="marketplace"
    ? conversations.filter(c=>c.type==="marketplace")
    : tab==="bookings"
    ? conversations.filter(c=>c.type==="booking")
    : conversations

  const totalUnread = conversations.reduce((s,c)=>s+c.unread,0)

  return (
    <div style={{ display:"flex", gap:"1rem", height:isMobile?"auto":"calc(100vh - 140px)" }}>
      {/* Conversation list */}
      {(!isMobile||!selected)&&(
        <div style={{ width:isMobile?"100%":280, flexShrink:0, display:"flex", flexDirection:"column", gap:8 }}>
          <div style={{ fontFamily:"Syne", fontSize:16, fontWeight:800, color:"#f0ede6", marginBottom:4 }}>
            Messages
            {totalUnread>0&&<span style={{ marginLeft:8, background:"#e24b4a", color:"#fff", borderRadius:20, fontSize:11, padding:"2px 7px" }}>{totalUnread}</span>}
          </div>

          {/* Tabs */}
          <div style={{ display:"flex", gap:6, marginBottom:4 }}>
            {[{k:"all",l:"All"},{k:"bookings",l:"Jobs"},{k:"marketplace",l:"Marketplace"}].map(t=>(
              <button key={t.k} onClick={()=>setTab(t.k)}
                style={{ padding:"5px 12px", borderRadius:7, border:"none", fontSize:11, cursor:"pointer", background:tab===t.k?"#1d9e75":"#111", color:tab===t.k?"#fff":"#666", fontFamily:"'DM Sans',sans-serif" }}>
                {t.l}
              </button>
            ))}
          </div>

          {loading&&<div style={{ color:"#555", fontSize:12 }}>Loading...</div>}
          {!loading&&filtered.length===0&&(
            <div style={{ color:"#444", fontSize:12, textAlign:"center", padding:"2rem" }}>
              <div style={{ fontSize:28, marginBottom:8 }}>💬</div>
              No conversations yet
            </div>
          )}

          {filtered.map(c=>(
            <div key={c.id} onClick={()=>setSelected(c)}
              style={{ background:selected?.id===c.id?"#071a12":"#111", border:`1px solid ${selected?.id===c.id?"#1d9e75":"#1e1e1e"}`, borderRadius:10, padding:"0.75rem", cursor:"pointer" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:4 }}>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <div style={{ width:34, height:34, borderRadius:"50%", background:c.type==="marketplace"?"#1a1208":"#071a12", border:`1px solid ${c.type==="marketplace"?"#e6821e40":"#1d9e7540"}`, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"Syne", fontSize:12, fontWeight:800, color:c.type==="marketplace"?"#e6821e":"#1d9e75", flexShrink:0 }}>
                    {c.name?.[0]?.toUpperCase()||"?"}
                  </div>
                  <div style={{ minWidth:0 }}>
                    <div style={{ fontSize:12, fontWeight:c.unread>0?700:500, color:"#f0ede6", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{c.name}</div>
                    <div style={{ fontSize:10, color:"#555", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                      {c.type==="marketplace"?"🛒 ":""}{c.subtitle}
                    </div>
                  </div>
                </div>
                <div style={{ textAlign:"right", flexShrink:0 }}>
                  {c.unread>0&&<div style={{ background:"#1d9e75", color:"#fff", borderRadius:"50%", fontSize:9, fontWeight:800, width:16, height:16, display:"flex", alignItems:"center", justifyContent:"center", marginBottom:2 }}>{c.unread}</div>}
                  <div style={{ fontSize:9, color:"#444" }}>{c.lastTime?new Date(c.lastTime).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}):""}</div>
                </div>
              </div>
              {c.lastMessage&&<div style={{ fontSize:11, color:"#555", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{c.lastMessage}</div>}
              <div style={{ display:"flex", gap:6, marginTop:4, flexWrap:"wrap" }}>
                <span style={{ fontSize:9, padding:"1px 6px", borderRadius:6, background:c.type==="marketplace"?"#1a1208":"#071a12", color:c.type==="marketplace"?"#e6821e":"#1d9e75" }}>
                  {c.type==="marketplace"?"🛒 Marketplace":"🚗 Job"}
                </span>
                {c.status&&<span style={{ fontSize:9, color:"#444" }}>{c.status}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Chat window */}
      {selected?(
        <div style={{ flex:1, display:"flex", flexDirection:"column", minHeight:isMobile?400:0 }}>
          {isMobile&&(
            <button onClick={()=>setSelected(null)} style={{ background:"none", border:"none", color:"#1d9e75", cursor:"pointer", fontSize:13, marginBottom:8, padding:0, fontFamily:"'DM Sans',sans-serif", textAlign:"left" }}>
              ← Back
            </button>
          )}
          <ChatWindow
            bookingId={selected.bookingId}
            listingId={selected.listingId}
            otherUserId={selected.otherUserId}
            otherUserName={selected.name}
            onClose={isMobile?null:()=>setSelected(null)}
          />
        </div>
      ):(
        !isMobile&&(
          <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", color:"#444", fontSize:13 }}>
            <div style={{ textAlign:"center" }}>
              <div style={{ fontSize:40, marginBottom:10 }}>💬</div>
              Select a conversation
            </div>
          </div>
        )
      )}
    </div>
  )
}
