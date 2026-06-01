import useIsMobile from "../../lib/useIsMobile"
import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"
import { useAuth } from "../../contexts/AuthContext"
import toast from "react-hot-toast"

const SC = { open:"#e6821e", in_progress:"#378add", resolved:"#1d9e75", closed:"#555" }
const PC = { low:"#555", medium:"#e6821e", high:"#e24b4a", urgent:"#d4537e" }

export default function AdminSupport() {
  const isMobile = useIsMobile()
  const { user } = useAuth()
  const [tickets, setTickets] = useState([])
  const [selected, setSelected] = useState(null)
  const [messages, setMessages] = useState([])
  const [reply, setReply] = useState("")
  const [sending, setSending] = useState(false)
  const [filter, setFilter] = useState("open")
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  useEffect(() => {
    if (!selected) return
    loadMessages(selected.id)
    const sub = supabase.channel(`admin-ticket-${selected.id}`)
      .on("postgres_changes", { event:"INSERT", schema:"public", table:"support_messages", filter:`ticket_id=eq.${selected.id}` },
        payload => setMessages(m=>[...m, payload.new]))
      .subscribe()
    return () => supabase.removeChannel(sub)
  }, [selected])

  async function load() {
    const { data } = await supabase.from("support_tickets")
      .select("*, profiles!support_tickets_customer_id_fkey(first_name,last_name)")
      .order("created_at",{ascending:false})
    setTickets(data||[])
    setLoading(false)
  }

  async function loadMessages(ticketId) {
    const { data } = await supabase.from("support_messages")
      .select("*, profiles!support_messages_sender_id_fkey(first_name,last_name,role)")
      .eq("ticket_id", ticketId)
      .order("created_at",{ascending:true})
    setMessages(data||[])
  }

  async function sendReply(e) {
    e.preventDefault()
    if (!reply.trim()||!selected) return
    setSending(true)
    const { error } = await supabase.from("support_messages").insert({
      ticket_id: selected.id,
      sender_id: user.id,
      message: reply.trim(),
      is_staff: true
    })
    if (error) { toast.error(error.message); setSending(false); return }
    await supabase.from("support_tickets").update({ status:"in_progress", updated_at:new Date().toISOString() }).eq("id", selected.id)
    await supabase.from("notifications").insert({
      user_id: selected.customer_id,
      title: "Support reply",
      message: `Your ticket #${selected.ticket_number} has a new reply from support`,
      type: "info"
    })
    setReply("")
    setSending(false)
    load()
  }

  async function updateStatus(ticketId, status) {
    const updates = { status, updated_at:new Date().toISOString() }
    if (status==="resolved") updates.resolved_at = new Date().toISOString()
    await supabase.from("support_tickets").update(updates).eq("id", ticketId)
    const ticket = tickets.find(t=>t.id===ticketId)
    if (ticket) {
      await supabase.from("notifications").insert({
        user_id: ticket.customer_id,
        title: `Ticket ${status.replace("_"," ")}`,
        message: `Your support ticket #${ticket.ticket_number} has been ${status.replace("_"," ")}`,
        type: status==="resolved"?"success":"info"
      })
    }
    toast.success(`Ticket ${status.replace("_"," ")}`)
    if (selected?.id===ticketId) setSelected(t=>({...t,status}))
    load()
  }

  const filtered = filter==="all" ? tickets : tickets.filter(t=>t.status===filter)
  const openCount = tickets.filter(t=>t.status==="open").length
  const urgentCount = tickets.filter(t=>t.priority==="urgent"&&t.status==="open").length

  if (selected) return (
    <div style={{ display:"flex", flexDirection:"column", height:"calc(100vh - 120px)" }}>
      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:"1rem", flexShrink:0, flexWrap:"wrap" }}>
        <button onClick={()=>setSelected(null)} style={{ background:"none", border:"none", color:"#666", cursor:"pointer", fontSize:13, fontFamily:"'DM Sans',sans-serif", padding:0 }}>
          ← Back
        </button>
        <div style={{ flex:1 }}>
          <div style={{ fontFamily:"Syne", fontSize:15, fontWeight:800, color:"#f0ede6" }}>{selected.subject}</div>
          <div style={{ fontSize:11, color:"#555", marginTop:2 }}>
            #{selected.ticket_number} · {selected.profiles?.first_name} {selected.profiles?.last_name} · {selected.category}
          </div>
        </div>
        <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
          {["open","in_progress","resolved","closed"].map(s=>(
            <button key={s} onClick={()=>updateStatus(selected.id,s)}
              style={{ background:selected.status===s?`${SC[s]}20`:"none", border:`1px solid ${selected.status===s?SC[s]:"#333"}`, borderRadius:7, color:selected.status===s?SC[s]:"#666", fontSize:11, padding:"4px 10px", cursor:"pointer" }}>
              {s.replace("_"," ")}
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex:1, overflowY:"auto", background:"#111", borderRadius:12, border:"1px solid #1e1e1e", padding:"1rem", display:"flex", flexDirection:"column", gap:10, marginBottom:10 }}>
        {messages.map(m=>{
          const isStaff = m.is_staff
          return (
            <div key={m.id} style={{ display:"flex", justifyContent:isStaff?"flex-end":"flex-start" }}>
              <div style={{ maxWidth:"75%", padding:"10px 14px", borderRadius:isStaff?"14px 14px 4px 14px":"14px 14px 14px 4px", background:isStaff?"#8b5cf6":"#1a1a1a", color:"#fff", fontSize:13, lineHeight:1.5 }}>
                <div style={{ fontSize:10, opacity:0.7, marginBottom:4 }}>
                  {isStaff?"Support Team":m.profiles?.first_name}
                </div>
                <div style={{ wordBreak:"break-word" }}>{m.message}</div>
                <div style={{ fontSize:9, opacity:0.6, marginTop:4, textAlign:isStaff?"right":"left" }}>
                  {new Date(m.created_at).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}
                </div>
              </div>
            </div>
          )
        })}
        {messages.length===0&&<div style={{ color:"#444", fontSize:13, textAlign:"center", padding:"2rem" }}>No messages yet</div>}
      </div>

      {selected.status!=="closed"&&(
        <form onSubmit={sendReply} style={{ display:"flex", gap:8, flexShrink:0 }}>
          <input value={reply} onChange={e=>setReply(e.target.value)} onKeyDown={e=>{ if(e.key==="Enter"&&!e.shiftKey){ e.preventDefault(); sendReply(e) }}}
            placeholder="Type your reply..."
            style={{ flex:1, background:"#111", border:"1px solid #222", borderRadius:10, padding:"11px 14px", color:"#f0ede6", fontSize:13, outline:"none", fontFamily:"'DM Sans',sans-serif" }}/>
          <button type="submit" disabled={sending||!reply.trim()}
            style={{ background:reply.trim()?"#8b5cf6":"#222", border:"none", borderRadius:10, color:reply.trim()?"#fff":"#555", fontSize:18, padding:"0 16px", cursor:reply.trim()?"pointer":"default" }}>
            ➤
          </button>
        </form>
      )}
    </div>
  )

  return (
    <div>
      <div style={{ display:"grid", gridTemplateColumns:isMobile?"repeat(2,1fr)":"repeat(4,1fr)", gap:10, marginBottom:"1.5rem" }}>
        {[
          { label:"Open", value:openCount, color:"#e6821e" },
          { label:"Urgent", value:urgentCount, color:urgentCount>0?"#e24b4a":undefined },
          { label:"In progress", value:tickets.filter(t=>t.status==="in_progress").length, color:"#378add" },
          { label:"Resolved", value:tickets.filter(t=>t.status==="resolved").length, color:"#1d9e75" },
        ].map(s=>(
          <div key={s.label} style={{ background:"#111", borderRadius:10, padding:"1rem", border:"1px solid #1e1e1e" }}>
            <div style={{ fontSize:11, color:"#555", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:6 }}>{s.label}</div>
            <div style={{ fontFamily:"Syne", fontSize:22, fontWeight:800, color:s.color||"#f0ede6" }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display:"flex", gap:6, marginBottom:"1rem", flexWrap:"wrap" }}>
        {[{k:"open",l:"Open"},{k:"in_progress",l:"In progress"},{k:"resolved",l:"Resolved"},{k:"closed",l:"Closed"},{k:"all",l:"All"}].map(f=>(
          <button key={f.k} onClick={()=>setFilter(f.k)}
            style={{ padding:"6px 14px", borderRadius:7, border:"none", fontSize:12, cursor:"pointer", background:filter===f.k?"#8b5cf6":"#111", color:filter===f.k?"#fff":"#666", fontFamily:"'DM Sans',sans-serif" }}>
            {f.l} {f.k!=="all"&&`(${tickets.filter(t=>t.status===f.k).length})`}
          </button>
        ))}
      </div>

      {loading&&<div style={{ color:"#555", fontSize:13 }}>Loading...</div>}
      {!loading&&filtered.length===0&&<div style={{ color:"#444", fontSize:13, textAlign:"center", padding:"2rem" }}>No tickets found</div>}

      {filtered.map(ticket=>(
        <div key={ticket.id} onClick={()=>{ setSelected(ticket); loadMessages(ticket.id) }}
          style={{ background:"#111", border:`1px solid ${ticket.status==="open"&&ticket.priority==="urgent"?"#e24b4a30":ticket.status==="open"?"#e6821e20":"#1e1e1e"}`, borderRadius:10, padding:"1rem", marginBottom:8, cursor:"pointer" }}
          onMouseEnter={e=>e.currentTarget.style.borderColor="#8b5cf640"}
          onMouseLeave={e=>e.currentTarget.style.borderColor=ticket.status==="open"&&ticket.priority==="urgent"?"#e24b4a30":ticket.status==="open"?"#e6821e20":"#1e1e1e"}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:4 }}>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:13, fontWeight:600, color:"#f0ede6", marginBottom:2 }}>{ticket.subject}</div>
              <div style={{ fontSize:11, color:"#555" }}>
                {ticket.profiles?.first_name} {ticket.profiles?.last_name} · {ticket.category} · #{ticket.ticket_number}
              </div>
              <div style={{ fontSize:10, color:"#444", marginTop:2 }}>{new Date(ticket.created_at).toLocaleDateString()}</div>
              {getSLAStatus(ticket)&&(
                <span style={{ fontSize:10, padding:"2px 8px", borderRadius:8, background:getSLAStatus(ticket).color+"20", color:getSLAStatus(ticket).color, fontWeight:600, display:"inline-block", marginTop:4 }}>
                  ⏱ {getSLAStatus(ticket).label}
                </span>
              )}
            </div>
            <div style={{ display:"flex", gap:6, flexShrink:0, marginLeft:10 }}>
              <span style={{ fontSize:10, padding:"2px 8px", borderRadius:10, background:`${SC[ticket.status]}20`, color:SC[ticket.status] }}>
                {ticket.status.replace("_"," ")}
              </span>
              <span style={{ fontSize:10, padding:"2px 8px", borderRadius:10, background:`${PC[ticket.priority]}20`, color:PC[ticket.priority] }}>
                {ticket.priority}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}



