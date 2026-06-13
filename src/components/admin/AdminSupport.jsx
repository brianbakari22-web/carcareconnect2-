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

  useEffect(() => {
    load()
    const sub = supabase.channel("admin-support-live")
      .on("postgres_changes", { event:"INSERT", schema:"public", table:"support_tickets" }, () => load())
      .on("postgres_changes", { event:"UPDATE", schema:"public", table:"support_tickets" }, () => load())
      .subscribe()
    return () => supabase.removeChannel(sub)
  }, [])

  useEffect(() => {
    if (!selected) return
    loadMessages(selected.id)
    const sub = supabase.channel(`admin-ticket-${selected.id}`)
      .on("postgres_changes", { event:"INSERT", schema:"public", table:"support_messages", filter:`ticket_id=eq.${selected.id}` },
        payload => setMessages(m=>[...m, payload.new]))
      .on("postgres_changes", { event:"UPDATE", schema:"public", table:"support_tickets", filter:`id=eq.${selected.id}` },
        payload => setSelected(prev=>({...prev,...payload.new})))
      .subscribe()
    return () => supabase.removeChannel(sub)
  }, [selected?.id])

  async function load() {
    const { data } = await supabase.from("support_tickets")
      .select("*, profiles!support_tickets_customer_id_fkey(first_name,last_name,role)")
      .order("created_at", { ascending:false })
    setTickets(data||[])
    setLoading(false)
  }

  async function loadMessages(ticketId) {
    const { data } = await supabase.from("support_messages")
      .select("*, profiles!support_messages_sender_id_fkey(first_name,last_name,role)")
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending:true })
    setMessages(data||[])
  }

  async function sendReply(e) {
    e.preventDefault()
    if (!reply.trim() || !selected) return
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
      title: "Support reply 💬",
      message: "Your ticket #"+selected.ticket_number+" has a new reply from our support team.",
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
    const ticket = tickets.find(tk=>tk.id===ticketId)
    if (ticket) {
      await supabase.from("notifications").insert({
        user_id: ticket.customer_id,
        title: "Ticket "+status.replace("_"," ")+" ✅",
        message: "Your support ticket #"+ticket.ticket_number+" has been "+status.replace("_"," ")+". "+
          (status==="resolved"?"We hope your issue has been resolved. Please reopen if needed.":""),
        type: status==="resolved"?"success":"info"
      })
    }
    toast.success("Ticket "+status.replace("_"," "))
    if (selected?.id===ticketId) setSelected(prev=>({...prev, status}))
    load()
  }

  async function escalateTicket(id, e) {
    e.stopPropagation()
    await supabase.from("support_tickets").update({ priority:"urgent", updated_at:new Date().toISOString() }).eq("id", id)
    toast.success("Ticket escalated to urgent")
    load()
  }

  function getSLAStatus(ticket) {
    if (ticket.status==="resolved" || ticket.status==="closed") return null
    const hours = (Date.now() - new Date(ticket.created_at).getTime()) / (1000*60*60)
    if (hours > 48) return { label:"SLA BREACHED", color:"#e24b4a" }
    if (hours > 24) return { label:"SLA WARNING", color:"#e6821e" }
    return null
  }

  const filtered = filter==="all" ? tickets : tickets.filter(tk=>tk.status===filter)
  const openCount = tickets.filter(tk=>tk.status==="open").length
  const urgentCount = tickets.filter(tk=>tk.priority==="urgent"&&tk.status==="open").length
  const slaBreached = tickets.filter(tk=>{ const s=getSLAStatus(tk); return s?.label==="SLA BREACHED" }).length

  if (selected) return (
    <div style={{ display:"flex", flexDirection:"column", height:"calc(100vh - 120px)" }}>
      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:"1rem", flexShrink:0, flexWrap:"wrap" }}>
        <button onClick={()=>{ setSelected(null); setMessages([]) }}
          style={{ background:"none", border:"none", color:"#888", cursor:"pointer", fontSize:13, padding:0 }}>
          ← Back
        </button>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontFamily:"Syne", fontSize:15, fontWeight:800, color:"#000000" }}>{selected.subject}</div>
          <div style={{ fontSize:11, color:"#888", marginTop:2 }}>
            #{selected.ticket_number} · {selected.profiles?.first_name} {selected.profiles?.last_name} · {selected.category} · {selected.profiles?.role}
          </div>
        </div>
        <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
          {["open","in_progress","resolved","closed"].map(s=>(
            <button key={s} onClick={()=>updateStatus(selected.id, s)}
              style={{ background:selected.status===s?SC[s]+"20":"none", border:"1px solid "+(selected.status===s?SC[s]:"#e0e0e0"), borderRadius:7, color:selected.status===s?SC[s]:"#666", fontSize:11, padding:"4px 10px", cursor:"pointer" }}>
              {s.replace("_"," ")}
            </button>
          ))}
        </div>
      </div>

      {getSLAStatus(selected)&&(
        <div style={{ background:getSLAStatus(selected).color+"15", border:"1px solid "+getSLAStatus(selected).color+"40", borderRadius:8, padding:"0.5rem 0.75rem", marginBottom:10, fontSize:11, color:getSLAStatus(selected).color, fontWeight:600 }}>
          ⏱ {getSLAStatus(selected).label} — Opened {Math.floor((Date.now()-new Date(selected.created_at).getTime())/(1000*60*60))} hours ago
        </div>
      )}

      <div style={{ flex:1, overflowY:"auto", background:"#f8f8f8", borderRadius:12, border:"1px solid #eeeeee", padding:"1rem", display:"flex", flexDirection:"column", gap:10, marginBottom:10 }}>
        {messages.map(m=>{
          const isStaff = m.is_staff
          return (
            <div key={m.id} style={{ display:"flex", justifyContent:isStaff?"flex-end":"flex-start" }}>
              <div style={{ maxWidth:"75%", padding:"10px 14px", borderRadius:isStaff?"14px 14px 4px 14px":"14px 14px 14px 4px", background:isStaff?"#8b5cf6":"#f5f5f5", color:"#fff", fontSize:13, lineHeight:1.5 }}>
                <div style={{ fontSize:10, opacity:0.7, marginBottom:4 }}>
                  {isStaff?"Support Team":m.profiles?.first_name+" ("+m.profiles?.role+")"}
                </div>
                <div style={{ wordBreak:"break-word" }}>{m.message}</div>
                <div style={{ fontSize:9, opacity:0.6, marginTop:4, textAlign:isStaff?"right":"left" }}>
                  {new Date(m.created_at).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}
                </div>
              </div>
            </div>
          )
        })}
        {messages.length===0&&<div style={{ color:"#888", fontSize:13, textAlign:"center", padding:"2rem" }}>No messages yet — send the first reply</div>}
      </div>

      {selected.status!=="closed"&&(
        <form onSubmit={sendReply} style={{ display:"flex", gap:8, flexShrink:0 }}>
          <input value={reply} onChange={e=>setReply(e.target.value)}
            onKeyDown={e=>{ if(e.key==="Enter"&&!e.shiftKey){ e.preventDefault(); sendReply(e) }}}
            placeholder="Type your reply to the customer..."
            style={{ flex:1, background:"#f8f8f8", border:"1px solid #f0f0f0", borderRadius:10, padding:"11px 14px", color:"#000000", fontSize:13, outline:"none", fontFamily:"DM Sans,sans-serif" }}/>
          <button type="submit" disabled={sending||!reply.trim()}
            style={{ background:reply.trim()&&!sending?"#8b5cf6":"#f0f0f0", border:"none", borderRadius:10, color:reply.trim()&&!sending?"#fff":"#555", fontSize:18, padding:"0 16px", cursor:reply.trim()&&!sending?"pointer":"default" }}>
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
          { label:"Open tickets", value:openCount, color:"#e6821e" },
          { label:"Urgent", value:urgentCount, color:urgentCount>0?"#e24b4a":"#555" },
          { label:"SLA breached", value:slaBreached, color:slaBreached>0?"#e24b4a":"#555" },
          { label:"Resolved", value:tickets.filter(tk=>tk.status==="resolved").length, color:"#1d9e75" },
        ].map(s=>(
          <div key={s.label} style={{ background:"#f8f8f8", borderRadius:10, padding:"1rem", border:"1px solid #eeeeee" }}>
            <div style={{ fontSize:10, color:"#888", textTransform:"uppercase", marginBottom:4 }}>{s.label}</div>
            <div style={{ fontFamily:"Syne", fontSize:22, fontWeight:800, color:s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {urgentCount>0&&(
        <div style={{ background:"#fff5f5", border:"1px solid #e24b4a40", borderRadius:10, padding:"0.75rem", marginBottom:"1rem" }}>
          <div style={{ fontSize:13, color:"#e24b4a", fontWeight:600 }}>🚨 {urgentCount} urgent ticket{urgentCount>1?"s":""} need immediate attention</div>
        </div>
      )}

      <div style={{ display:"flex", gap:6, marginBottom:"1rem", flexWrap:"wrap" }}>
        {[{k:"open",l:"Open"},{k:"in_progress",l:"In progress"},{k:"resolved",l:"Resolved"},{k:"closed",l:"Closed"},{k:"all",l:"All"}].map(f=>(
          <button key={f.k} onClick={()=>setFilter(f.k)}
            style={{ padding:"6px 14px", borderRadius:7, border:"none", fontSize:12, cursor:"pointer", background:filter===f.k?"#8b5cf6":"#f8f8f8", color:filter===f.k?"#fff":"#666", fontFamily:"DM Sans,sans-serif" }}>
            {f.l} ({f.k==="all"?tickets.length:tickets.filter(tk=>tk.status===f.k).length})
          </button>
        ))}
      </div>

      {loading&&<div style={{ color:"#888", fontSize:13 }}>Loading...</div>}
      {!loading&&filtered.length===0&&<div style={{ color:"#888", fontSize:13, textAlign:"center", padding:"2rem" }}>No tickets found</div>}

      {filtered.map(ticket=>{
        const sla = getSLAStatus(ticket)
        return (
          <div key={ticket.id} onClick={()=>{ setSelected(ticket); loadMessages(ticket.id) }}
            style={{ background:"#f8f8f8", border:"1px solid "+(ticket.priority==="urgent"&&ticket.status==="open"?"#e24b4a30":sla?"#e6821e20":"#eeeeee"), borderRadius:10, padding:"1rem", marginBottom:8, cursor:"pointer" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:6 }}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:13, fontWeight:600, color:"#000000", marginBottom:2 }}>{ticket.subject}</div>
                <div style={{ fontSize:11, color:"#888", marginBottom:2 }}>
                  {ticket.profiles?.first_name} {ticket.profiles?.last_name} ({ticket.profiles?.role}) · #{ticket.ticket_number}
                </div>
                <div style={{ fontSize:10, color:"#888" }}>{ticket.category} · {new Date(ticket.created_at).toLocaleString()}</div>
                {sla&&(
                  <span style={{ fontSize:10, padding:"2px 8px", borderRadius:8, background:sla.color+"20", color:sla.color, fontWeight:600, display:"inline-block", marginTop:4 }}>
                    ⏱ {sla.label}
                  </span>
                )}
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:4, alignItems:"flex-end", flexShrink:0, marginLeft:10 }}>
                <span style={{ fontSize:10, padding:"2px 8px", borderRadius:10, background:SC[ticket.status]+"20", color:SC[ticket.status] }}>
                  {ticket.status.replace("_"," ")}
                </span>
                <span style={{ fontSize:10, padding:"2px 8px", borderRadius:10, background:PC[ticket.priority]+"20", color:PC[ticket.priority] }}>
                  {ticket.priority}
                </span>
                {ticket.status==="open"&&ticket.priority!=="urgent"&&(
                  <button onClick={e=>escalateTicket(ticket.id, e)}
                    style={{ fontSize:10, padding:"2px 8px", borderRadius:7, background:"#fff5f5", border:"1px solid #e24b4a30", color:"#e24b4a", cursor:"pointer" }}>
                    🔺 Escalate
                  </button>
                )}
                {ticket.status==="open"&&(
                  <button onClick={e=>{ e.stopPropagation(); updateStatus(ticket.id,"in_progress") }}
                    style={{ fontSize:10, padding:"2px 8px", borderRadius:7, background:"#eff6ff", border:"1px solid #378add30", color:"#378add", cursor:"pointer" }}>
                    ▶ Start
                  </button>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
