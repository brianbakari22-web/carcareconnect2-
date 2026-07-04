import { useEffect, useState, useRef } from "react"
import { supabase } from "../../lib/supabase"
import { useAuth } from "../../contexts/AuthContext"
import useIsMobile from "../../lib/useIsMobile"
import toast from "react-hot-toast"

const SC = { open:"#e6821e", in_progress:"#378add", resolved:"#1d9e75", closed:"#555" }
const PC = { low:"#1d9e75", medium:"#e6821e", high:"#e24b4a", urgent:"#d4537e" }
const CAT_ICON = { booking:"📅", payment:"💳", driver:"🚗", parts:"📦", account:"👤", technical:"🔧", other:"💬" }

export default function AdminSupport() {
  const isMobile = useIsMobile()
  const { user } = useAuth()
  const [tickets, setTickets] = useState([])
  const [selected, setSelected] = useState(null)
  const [messages, setMessages] = useState([])
  const [reply, setReply] = useState("")
  const [sending, setSending] = useState(false)
  const [filter, setFilter] = useState("open")
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const messagesEndRef = useRef(null)

  useEffect(() => {
    load()
    const sub = supabase.channel("admin-support-live")
      .on("postgres_changes", { event:"INSERT", schema:"public", table:"support_tickets" }, () => { load(); toast("New support ticket received!", { icon:"🎫" }) })
      .on("postgres_changes", { event:"UPDATE", schema:"public", table:"support_tickets" }, () => load())
      .subscribe()
    return () => supabase.removeChannel(sub)
  }, [])

  useEffect(() => {
    if (!selected) return
    loadMessages(selected.id)
    const sub = supabase.channel("admin-ticket-"+selected.id)
      .on("postgres_changes", { event:"INSERT", schema:"public", table:"support_messages", filter:`ticket_id=eq.${selected.id}` },
        payload => { setMessages(m=>[...m,payload.new]); setTimeout(()=>messagesEndRef.current?.scrollIntoView({behavior:"smooth"}),100) })
      .on("postgres_changes", { event:"UPDATE", schema:"public", table:"support_tickets", filter:`id=eq.${selected.id}` },
        payload => setSelected(prev=>({...prev,...payload.new})))
      .subscribe()
    return () => supabase.removeChannel(sub)
  }, [selected?.id])

  async function load() {
    const { data } = await supabase.from("support_tickets")
      .select("*, customer:profiles!support_tickets_customer_id_fkey(first_name,last_name,role)")
      .order("created_at", { ascending:false })
    setTickets(data||[])
    setLoading(false)
  }

  async function loadMessages(ticketId) {
    const { data } = await supabase.from("support_messages")
      .select("*, sender:profiles!support_messages_sender_id_fkey(first_name,last_name,role)")
      .eq("ticket_id", ticketId).order("created_at", { ascending:true })
    setMessages(data||[])
    setTimeout(()=>messagesEndRef.current?.scrollIntoView({behavior:"smooth"}),100)
  }

  async function sendReply(e) {
    e.preventDefault()
    if (!reply.trim() || !selected) return
    setSending(true)
    const { error } = await supabase.from("support_messages").insert({
      ticket_id: selected.id, sender_id: user.id, message: reply.trim(), is_staff: true
    })
    if (error) { toast.error(error.message); setSending(false); return }
    await supabase.from("support_tickets").update({ status:"in_progress", updated_at:new Date().toISOString() }).eq("id", selected.id)
    await supabase.from("notifications").insert({
      user_id: selected.customer_id,
      title: "Support reply 💬",
      message: "Your ticket #"+selected.ticket_number+" has a new reply from our support team.",
      type: "info"
    })
    setReply(""); setSending(false)
  }

  async function updateStatus(ticketId, status) {
    const updates = { status, updated_at:new Date().toISOString() }
    if (status==="resolved") updates.resolved_at = new Date().toISOString()
    await supabase.from("support_tickets").update(updates).eq("id", ticketId)
    const ticket = tickets.find(t=>t.id===ticketId)
    if (ticket) {
      const msg = status==="resolved" ? "Your support ticket #"+ticket.ticket_number+" has been resolved. Please rate our support." : "Your ticket #"+ticket.ticket_number+" status updated to "+status+"."
      await supabase.from("notifications").insert({ user_id: ticket.customer_id, title: "Ticket "+status+" "+( status==="resolved"?"✅":"📋"), message: msg, type: status==="resolved"?"success":"info" })
    }
    if (selected?.id === ticketId) setSelected(s=>({...s,status}))
    load(); toast.success("Status updated to "+status)
  }

  async function updatePriority(ticketId, priority) {
    await supabase.from("support_tickets").update({ priority, updated_at:new Date().toISOString() }).eq("id", ticketId)
    if (selected?.id === ticketId) setSelected(s=>({...s,priority}))
    load(); toast.success("Priority updated")
  }

  const filtered = tickets.filter(t => {
    const matchFilter = filter==="all" || t.status===filter
    const matchSearch = !search || (t.subject+t.ticket_number+(t.customer?.first_name||"")+(t.customer?.last_name||"")).toLowerCase().includes(search.toLowerCase())
    return matchFilter && matchSearch
  })

  const stats = {
    open: tickets.filter(t=>t.status==="open").length,
    in_progress: tickets.filter(t=>t.status==="in_progress").length,
    resolved: tickets.filter(t=>t.status==="resolved").length,
    high: tickets.filter(t=>t.priority==="high"&&(t.status==="open"||t.status==="in_progress")).length,
  }

  if (selected) return (
    <div style={{ display:"flex", flexDirection:"column", height:isMobile?"calc(100vh-120px)":"calc(100vh-140px)" }}>
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:"1rem", flexShrink:0, flexWrap:"wrap" }}>
        <button onClick={()=>setSelected(null)} style={{ background:"none", border:"none", color:"#e6821e", cursor:"pointer", fontSize:13, padding:0 }}>← Back</button>
        <div style={{ flex:1 }}>
          <div style={{ fontFamily:"Syne", fontSize:13, fontWeight:800 }}>{selected.subject}</div>
          <div style={{ fontSize:11, color:"#888" }}>
            #{selected.ticket_number} · {CAT_ICON[selected.category]} {selected.category}
            · {selected.customer?.first_name} {selected.customer?.last_name}
          </div>
        </div>
      </div>
      {/* Status + Priority controls */}
      <div style={{ display:"flex", gap:6, marginBottom:"1rem", flexShrink:0, flexWrap:"wrap" }}>
        <div style={{ fontSize:11, color:"#666", alignSelf:"center" }}>Status:</div>
        {["open","in_progress","resolved","closed"].map(s=>(
          <button key={s} onClick={()=>updateStatus(selected.id,s)}
            style={{ padding:"4px 10px", borderRadius:6, border:"1px solid "+(selected.status===s?SC[s]:"#eee"), background:selected.status===s?SC[s]+"20":"#f8f8f8", color:selected.status===s?SC[s]:"#888", fontSize:11, cursor:"pointer", fontWeight:selected.status===s?700:400 }}>
            {s.replace("_"," ")}
          </button>
        ))}
        <div style={{ fontSize:11, color:"#666", alignSelf:"center", marginLeft:8 }}>Priority:</div>
        {["low","medium","high"].map(p=>(
          <button key={p} onClick={()=>updatePriority(selected.id,p)}
            style={{ padding:"4px 10px", borderRadius:6, border:"1px solid "+(selected.priority===p?PC[p]:"#eee"), background:selected.priority===p?PC[p]+"20":"#f8f8f8", color:selected.priority===p?PC[p]:"#888", fontSize:11, cursor:"pointer", fontWeight:selected.priority===p?700:400 }}>
            {p}
          </button>
        ))}
      </div>
      {/* Messages */}
      <div style={{ flex:1, overflowY:"auto", paddingBottom:"0.5rem", marginBottom:"0.5rem" }}>
        {messages.map(m=>{
          const isStaff = m.is_staff
          return (
            <div key={m.id} style={{ display:"flex", justifyContent:isStaff?"flex-end":"flex-start", marginBottom:8 }}>
              <div style={{ maxWidth:"80%", background:isStaff?"#378add":m.sender?.role==="admin"?"#e6821e20":"#f5f5f5", borderRadius:isStaff?"12px 12px 4px 12px":"12px 12px 12px 4px", padding:"10px 14px" }}>
                <div style={{ fontSize:10, color:isStaff?"rgba(255,255,255,0.8)":"#aaa", marginBottom:4 }}>
                  {isStaff?"🎫 Support Staff":"👤 "+( m.sender?.first_name||"Customer")}
                </div>
                <div style={{ fontSize:13, color:isStaff?"#fff":"#000", lineHeight:1.5 }}>{m.message}</div>
                <div style={{ fontSize:10, color:isStaff?"rgba(255,255,255,0.6)":"#aaa", marginTop:4, textAlign:"right" }}>{new Date(m.created_at).toLocaleString()}</div>
              </div>
            </div>
          )
        })}
        <div ref={messagesEndRef}/>
      </div>
      {/* Reply */}
      {(selected.status==="open"||selected.status==="in_progress") ? (
        <form onSubmit={sendReply} style={{ display:"flex", gap:8, flexShrink:0 }}>
          <input value={reply} onChange={e=>setReply(e.target.value)} placeholder="Type your reply..."
            style={{ flex:1, background:"#f5f5f5", border:"1px solid #e0e0e0", borderRadius:10, padding:"10px 14px", fontSize:13, outline:"none" }}/>
          <button type="submit" disabled={sending||!reply.trim()} style={{ background:"#378add", border:"none", borderRadius:10, color:"#fff", padding:"10px 16px", cursor:"pointer", fontSize:13, fontWeight:700 }}>
            {sending?"...":"Reply"}
          </button>
        </form>
      ) : (
        <div style={{ textAlign:"center", fontSize:12, color:"#888", padding:"0.75rem", background:"#f5f5f5", borderRadius:10 }}>
          Ticket is {selected.status}. Change status to reply.
        </div>
      )}
    </div>
  )

  return (
    <div>
      <div style={{ fontFamily:"Syne", fontSize:18, fontWeight:800, color:"#000", marginBottom:"1rem" }}>🎫 Support Tickets</div>
      {/* Stats */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8, marginBottom:"1rem" }}>
        {[
          { label:"Open", value:stats.open, color:"#e6821e" },
          { label:"In progress", value:stats.in_progress, color:"#378add" },
          { label:"Resolved", value:stats.resolved, color:"#1d9e75" },
          { label:"High priority", value:stats.high, color:"#e24b4a" },
        ].map(s=>(
          <div key={s.label} style={{ background:"#f8f8f8", borderRadius:10, padding:"0.75rem", textAlign:"center", border:"1px solid #eee" }}>
            <div style={{ fontFamily:"Syne", fontSize:18, fontWeight:800, color:s.color }}>{s.value}</div>
            <div style={{ fontSize:10, color:"#888", marginTop:2 }}>{s.label}</div>
          </div>
        ))}
      </div>
      {/* Search */}
      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search tickets, customers..."
        style={{ width:"100%", background:"#f8f8f8", border:"1px solid #eee", borderRadius:8, padding:"9px 12px", fontSize:13, outline:"none", marginBottom:"0.75rem", boxSizing:"border-box" }}/>
      {/* Filter tabs */}
      <div style={{ display:"flex", gap:6, marginBottom:"1rem", flexWrap:"wrap" }}>
        {[["all","All"],["open","Open"],["in_progress","In Progress"],["resolved","Resolved"],["closed","Closed"]].map(([k,l])=>(
          <button key={k} onClick={()=>setFilter(k)}
            style={{ padding:"6px 12px", borderRadius:7, border:"none", fontSize:12, cursor:"pointer", background:filter===k?"#e6821e":"#f8f8f8", color:filter===k?"#fff":"#666", fontWeight:filter===k?700:400 }}>
            {l} {k!=="all"&&tickets.filter(t=>t.status===k).length>0&&"("+tickets.filter(t=>t.status===k).length+")"}
          </button>
        ))}
      </div>
      {/* Ticket list */}
      {loading&&<div style={{ color:"#888", fontSize:13 }}>Loading...</div>}
      {!loading&&filtered.length===0&&<div style={{ color:"#888", fontSize:13, textAlign:"center", padding:"2rem" }}>No tickets found</div>}
      {filtered.map(t=>(
        <div key={t.id} onClick={()=>setSelected(t)}
          style={{ background:"#f8f8f8", border:`1px solid ${SC[t.status]||"#eee"}30`, borderRadius:10, padding:"1rem", marginBottom:8, cursor:"pointer", borderLeft:`3px solid ${SC[t.status]||"#eee"}` }}
          onMouseEnter={e=>e.currentTarget.style.background="#f0f0f0"}
          onMouseLeave={e=>e.currentTarget.style.background="#f8f8f8"}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
            <div style={{ flex:1, minWidth:0, marginRight:8 }}>
              <div style={{ display:"flex", gap:6, alignItems:"center", marginBottom:2 }}>
                {t.priority==="high"&&<span style={{ fontSize:10, background:"#e24b4a20", color:"#e24b4a", padding:"1px 6px", borderRadius:4, fontWeight:700 }}>🔴 HIGH</span>}
                <span style={{ fontSize:13, fontWeight:700, color:"#000" }}>{t.subject}</span>
              </div>
              <div style={{ fontSize:11, color:"#888" }}>
                {CAT_ICON[t.category]} {t.category} · 👤 {t.customer?.first_name} {t.customer?.last_name}
              </div>
              <div style={{ fontSize:11, color:"#aaa", marginTop:2 }}>#{t.ticket_number} · {new Date(t.created_at).toLocaleDateString()}</div>
            </div>
            <div style={{ textAlign:"right", flexShrink:0 }}>
              <span style={{ fontSize:10, padding:"2px 8px", borderRadius:10, background:(SC[t.status]||"#888")+"20", color:SC[t.status]||"#888", fontWeight:600, display:"block", marginBottom:4 }}>{t.status?.replace("_"," ")}</span>
              <span style={{ fontSize:11, color:"#e6821e" }}>View →</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
