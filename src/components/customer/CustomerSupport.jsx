import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"
import { useAuth } from "../../contexts/AuthContext"
import { useLanguage } from "../../contexts/LanguageContext"
import toast from "react-hot-toast"

const CATEGORIES = ["booking","payment","technical","driver","provider","other"]
const PRIORITIES = ["low","medium","high","urgent"]
const SC = { open:"#e6821e", in_progress:"#378add", resolved:"#1d9e75", closed:"#555" }
const PC = { low:"#555", medium:"#e6821e", high:"#e24b4a", urgent:"#d4537e" }

export default function CustomerSupport() {
  const { user } = useAuth()
  const { t, language } = useLanguage()
  const [tickets, setTickets] = useState([])
  const [bookings, setBookings] = useState([])
  const [selected, setSelected] = useState(null)
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState("")
  const [tab, setTab] = useState("tickets")
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [form, setForm] = useState({ subject:"", category:"booking", priority:"medium", booking_id:"", message:"" })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => { if (user) load() }, [user])

  useEffect(() => {
    if (!selected) return
    loadMessages(selected.id)
    const sub = supabase.channel(`ticket-${selected.id}`)
      .on("postgres_changes", { event:"INSERT", schema:"public", table:"support_messages", filter:`ticket_id=eq.${selected.id}` },
        payload => setMessages(m => [...m, payload.new]))
      .subscribe()
    return () => supabase.removeChannel(sub)
  }, [selected])

  async function load() {
    const [{ data: tks }, { data: bks }] = await Promise.all([
      supabase.from("support_tickets").select("*").eq("customer_id", user.id).order("created_at",{ascending:false}),
      supabase.from("bookings").select("id,service_name,booking_date").eq("customer_id", user.id).order("created_at",{ascending:false}).limit(20)
    ])
    setTickets(tks||[])
    setBookings(bks||[])
    setLoading(false)
  }

  async function loadMessages(ticketId) {
    const { data } = await supabase.from("support_messages").select("*, profiles!support_messages_sender_id_fkey(first_name,last_name,role)").eq("ticket_id", ticketId).order("created_at",{ascending:true})
    setMessages(data||[])
  }

  async function submitTicket(e) {
    e.preventDefault()
    if (!form.subject.trim() || !form.message.trim()) return toast.error("Please fill all fields")
    setSubmitting(true)
    try {
      const { data: ticket, error } = await supabase.from("support_tickets").insert({
        customer_id: user.id,
        subject: form.subject,
        category: form.category,
        priority: form.priority,
        booking_id: form.booking_id || null,
      }).select().single()
      if (error) throw error
      await supabase.from("support_messages").insert({
        ticket_id: ticket.id,
        sender_id: user.id,
        message: form.message,
        is_staff: false
      })
      await supabase.from("notifications").insert({
        user_id: user.id,
        title: "Support ticket created",
        message: `Ticket ${ticket.ticket_number} has been submitted. We'll get back to you soon.`,
        type: "info"
      })
      toast.success(`Ticket ${ticket.ticket_number} created!`)
      setForm({ subject:"", category:"booking", priority:"medium", booking_id:"", message:"" })
      setTab("tickets")
      load()
    } catch(err) { toast.error(err.message) }
    finally { setSubmitting(false) }
  }

  async function sendMessage(e) {
    e.preventDefault()
    if (!newMessage.trim() || !selected) return
    setSending(true)
    const { error } = await supabase.from("support_messages").insert({
      ticket_id: selected.id,
      sender_id: user.id,
      message: newMessage.trim(),
      is_staff: false
    })
    if (error) { toast.error(error.message); setSending(false); return }
    setNewMessage("")
    setSending(false)
  }

  async function closeTicket(ticketId) {
    await supabase.from("support_tickets").update({ status:"closed", updated_at:new Date().toISOString() }).eq("id", ticketId).eq("customer_id", user.id)
    toast.success("Ticket closed")
    setSelected(null)
    load()
  }

  function getSLAStatus(ticket) {
    if (ticket.status==="resolved"||ticket.status==="closed") return null
    const hours = (Date.now() - new Date(ticket.created_at).getTime()) / (1000*60*60)
    if (hours>48) return { label:"SLA BREACHED", color:"#e24b4a" }
    if (hours>24) return { label:"SLA WARNING", color:"#e6821e" }
    return null
  }

  const inp = { width:"100%", background:"#111", border:"1px solid #222", borderRadius:8, padding:"10px 12px", color:"#f0ede6", fontSize:13, outline:"none", fontFamily:"'DM Sans',sans-serif", marginBottom:10 }
  const lbl = { fontSize:11, color:"#666", textTransform:"uppercase", letterSpacing:"0.05em", display:"block", marginBottom:4 }

  if (selected) return (
    <div style={{ display:"flex", flexDirection:"column", height:"calc(100vh - 120px)" }}>
      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:"1rem", flexShrink:0 }}>
        <button onClick={()=>setSelected(null)} style={{ background:"none", border:"none", color:"#666", cursor:"pointer", fontSize:13, fontFamily:"'DM Sans',sans-serif", padding:0 }}>
          ← {t("back")}
        </button>
        <div style={{ flex:1 }}>
          <div style={{ fontFamily:"Syne", fontSize:15, fontWeight:800, color:"#f0ede6" }}>{selected.subject}</div>
          <div style={{ display:"flex", gap:8, marginTop:2, flexWrap:"wrap" }}>
            <span style={{ fontSize:10, padding:"1px 7px", borderRadius:10, background:`${SC[selected.status]}20`, color:SC[selected.status] }}>{selected.status.replace("_"," ")}</span>
            <span style={{ fontSize:10, padding:"1px 7px", borderRadius:10, background:`${PC[selected.priority]}20`, color:PC[selected.priority] }}>{selected.priority}</span>
            <span style={{ fontSize:10, color:"#444" }}>#{selected.ticket_number}</span>
          </div>
        </div>
        <div style={{ display:"flex", gap:6 }}>
          {selected.status==="resolved"&&(
            <button onClick={async()=>{ await supabase.from("support_tickets").update({status:"open"}).eq("id",selected.id); toast.success("Ticket reopened"); load(); setSelected(t=>({...t,status:"open"})) }}
              style={{ background:"#1a1208", border:"1px solid #e6821e40", borderRadius:7, color:"#e6821e", fontSize:11, padding:"5px 10px", cursor:"pointer", flexShrink:0 }}>
              🔄 Reopen
            </button>
          )}
          {selected.status!=="closed"&&selected.status!=="resolved"&&(
            <button onClick={()=>closeTicket(selected.id)}
              style={{ background:"none", border:"1px solid #333", borderRadius:7, color:"#666", fontSize:11, padding:"5px 10px", cursor:"pointer", flexShrink:0 }}>
              {language==="sw"?"Funga":"Close ticket"}
            </button>
          )}
        </div>
      </div>

      <div style={{ flex:1, overflowY:"auto", background:"#111", borderRadius:12, border:"1px solid #1e1e1e", padding:"1rem", display:"flex", flexDirection:"column", gap:10, marginBottom:10 }}>
        {messages.map(m=>{
          const isMine = m.sender_id === user.id
          const isStaff = m.is_staff
          return (
            <div key={m.id} style={{ display:"flex", justifyContent:isMine?"flex-end":"flex-start" }}>
              <div style={{ maxWidth:"75%", padding:"10px 14px", borderRadius:isMine?"14px 14px 4px 14px":"14px 14px 14px 4px", background:isMine?"#e6821e":isStaff?"#160a2e":"#1a1a1a", color:"#fff", fontSize:13, lineHeight:1.5 }}>
                {isStaff&&!isMine&&<div style={{ fontSize:10, color:"#8b5cf6", marginBottom:4, fontWeight:600 }}>Support Team</div>}
                <div style={{ wordBreak:"break-word" }}>{m.message}</div>
                <div style={{ fontSize:9, opacity:0.6, marginTop:4, textAlign:isMine?"right":"left" }}>
                  {new Date(m.created_at).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}
                </div>
              </div>
            </div>
          )
        })}
        {messages.length===0&&<div style={{ color:"#444", fontSize:13, textAlign:"center", padding:"2rem" }}>No messages yet</div>}
      </div>

      {selected.status!=="closed"&&(
        <form onSubmit={sendMessage} style={{ display:"flex", gap:8, flexShrink:0 }}>
          <input value={newMessage} onChange={e=>setNewMessage(e.target.value)} onKeyDown={e=>{ if(e.key==="Enter"&&!e.shiftKey){ e.preventDefault(); sendMessage(e) }}}
            placeholder={language==="sw"?"Andika ujumbe...":"Type a reply..."}
            style={{ flex:1, background:"#111", border:"1px solid #222", borderRadius:10, padding:"11px 14px", color:"#f0ede6", fontSize:13, outline:"none", fontFamily:"'DM Sans',sans-serif" }}/>
          <button type="submit" disabled={sending||!newMessage.trim()}
            style={{ background:newMessage.trim()?"#e6821e":"#222", border:"none", borderRadius:10, color:newMessage.trim()?"#fff":"#555", fontSize:18, padding:"0 16px", cursor:newMessage.trim()?"pointer":"default" }}>
            ➤
          </button>
        </form>
      )}
    </div>
  )

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"1.25rem" }}>
        <div>
          <div style={{ fontFamily:"Syne", fontSize:20, fontWeight:800, color:"#f0ede6" }}>
            {language==="sw"?"Msaada":"Support"}
          </div>
          <div style={{ fontSize:12, color:"#555", marginTop:2 }}>
            {tickets.filter(t=>t.status==="open").length} {language==="sw"?"wazi":"open"} · {tickets.length} {language==="sw"?"jumla":"total"}
          </div>
        </div>
        <button onClick={()=>setTab(tab==="new"?"tickets":"new")}
          style={{ background:tab==="new"?"#111":"#e6821e", border:`1px solid ${tab==="new"?"#333":"transparent"}`, borderRadius:8, color:tab==="new"?"#888":"#fff", fontFamily:"Syne,sans-serif", fontSize:12, fontWeight:700, padding:"8px 16px", cursor:"pointer" }}>
          {tab==="new"?(language==="sw"?"Maombi":"My tickets"):(language==="sw"?"Ombi jipya":"New ticket")}
        </button>
      </div>

      {tab==="new"&&(
        <div style={{ background:"#111", border:"1px solid #1e1e1e", borderRadius:12, padding:"1.25rem" }}>
          <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:700, marginBottom:"1rem", color:"#f0ede6" }}>
            {language==="sw"?"Omba msaada":"Submit a support request"}
          </div>
          <form onSubmit={submitTicket}>
            <label style={lbl}>{language==="sw"?"Kichwa":"Subject"}</label>
            <input style={inp} placeholder={language==="sw"?"Eleza tatizo lako kwa kifupi":"Briefly describe your issue"} value={form.subject} onChange={e=>setForm(f=>({...f,subject:e.target.value}))} required/>

            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:10 }}>
              <div>
                <label style={lbl}>{language==="sw"?"Aina":"Category"}</label>
                <select value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))} style={{ ...inp, marginBottom:0, padding:"10px 12px" }}>
                  {CATEGORIES.map(c=><option key={c} value={c}>{c.charAt(0).toUpperCase()+c.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>{language==="sw"?"Kipaumbele":"Priority"}</label>
                <select value={form.priority} onChange={e=>setForm(f=>({...f,priority:e.target.value}))} style={{ ...inp, marginBottom:0, padding:"10px 12px" }}>
                  {PRIORITIES.map(p=><option key={p} value={p}>{p.charAt(0).toUpperCase()+p.slice(1)}</option>)}
                </select>
              </div>
            </div>

            <label style={lbl}>{language==="sw"?"Miadi inayohusika (hiari)":"Related booking (optional)"}</label>
            <select value={form.booking_id} onChange={e=>setForm(f=>({...f,booking_id:e.target.value}))} style={{ ...inp, padding:"10px 12px" }}>
              <option value="">{language==="sw"?"Chagua miadi...":"Select a booking..."}</option>
              {bookings.map(b=><option key={b.id} value={b.id}>{b.service_name} · {b.booking_date}</option>)}
            </select>

            <label style={lbl}>{language==="sw"?"Ujumbe":"Message"}</label>
            <textarea value={form.message} onChange={e=>setForm(f=>({...f,message:e.target.value}))} rows={4}
              placeholder={language==="sw"?"Eleza tatizo lako kwa undani...":"Describe your issue in detail..."}
              style={{ ...inp, resize:"vertical" }} required/>

            <button type="submit" disabled={submitting}
              style={{ background:submitting?"#333":"#e6821e", border:"none", borderRadius:9, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:13, fontWeight:700, padding:"12px 24px", cursor:submitting?"not-allowed":"pointer" }}>
              {submitting?(language==="sw"?"Inatuma...":"Submitting..."):(language==="sw"?"Tuma ombi":"Submit ticket")}
            </button>
          </form>
        </div>
      )}

      {tab==="tickets"&&(
        <div>
          {loading&&<div style={{ color:"#555", fontSize:13 }}>{t("loading")}</div>}
          {!loading&&tickets.length===0&&(
            <div style={{ background:"#111", border:"1px solid #1e1e1e", borderRadius:12, padding:"3rem", textAlign:"center" }}>
              <div style={{ fontSize:36, marginBottom:12 }}>🎫</div>
              <div style={{ fontSize:14, color:"#555", marginBottom:4 }}>{language==="sw"?"Hakuna maombi bado":"No support tickets yet"}</div>
              <div style={{ fontSize:12, color:"#444", marginBottom:"1.5rem" }}>{language==="sw"?"Bonyeza 'Ombi jipya' kuanza":"Click 'New ticket' to get help"}</div>
              <button onClick={()=>setTab("new")}
                style={{ background:"#e6821e", border:"none", borderRadius:8, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:13, fontWeight:700, padding:"10px 20px", cursor:"pointer" }}>
                {language==="sw"?"Omba msaada":"Get help"}
              </button>
            </div>
          )}
          {tickets.map(ticket=>(
            <div key={ticket.id} onClick={()=>{ setSelected(ticket); loadMessages(ticket.id) }}
              style={{ background:"#111", border:`1px solid ${ticket.status==="open"?"#e6821e20":"#1e1e1e"}`, borderRadius:10, padding:"1rem", marginBottom:8, cursor:"pointer", transition:"border-color 0.12s" }}
              onMouseEnter={e=>e.currentTarget.style.borderColor="#e6821e40"}
              onMouseLeave={e=>e.currentTarget.style.borderColor=ticket.status==="open"?"#e6821e20":"#1e1e1e"}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:6 }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:600, color:"#f0ede6", marginBottom:2 }}>{ticket.subject}</div>
                  <div style={{ fontSize:10, color:"#444" }}>#{ticket.ticket_number} · {new Date(ticket.created_at).toLocaleDateString()}</div>
                </div>
                <div style={{ display:"flex", gap:6, flexShrink:0, marginLeft:10 }}>
                  <span style={{ fontSize:10, padding:"2px 8px", borderRadius:10, background:`${SC[ticket.status]}20`, color:SC[ticket.status], border:`1px solid ${SC[ticket.status]}40` }}>
                    {ticket.status.replace("_"," ")}
                  </span>
                  <span style={{ fontSize:10, padding:"2px 8px", borderRadius:10, background:`${PC[ticket.priority]}20`, color:PC[ticket.priority] }}>
                    {ticket.priority}
                  </span>
                </div>
              </div>
              <div style={{ fontSize:11, color:"#555", marginBottom:4 }}>{ticket.category} · {language==="sw"?"Bonyeza kuona":"Click to view"}</div>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div style={{ fontSize:11, color:ticket.status==="open"?"#e6821e":ticket.status==="in_progress"?"#378add":ticket.status==="resolved"?"#1d9e75":"#555" }}>
                  {ticket.status==="open"?"⏳ Awaiting response — within 24hrs":
                   ticket.status==="in_progress"?"👤 Support team is reviewing your ticket":
                   ticket.status==="resolved"?"✅ Resolved — please confirm or reopen":
                   "🔒 Closed"}
                </div>
                {ticket.status==="open"&&(
                  <div style={{ fontSize:10, color:"#444" }}>
                    {Math.floor((Date.now()-new Date(ticket.created_at).getTime())/(1000*60*60))}h ago
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}



