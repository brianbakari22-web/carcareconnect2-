import { useEffect, useState, useRef } from "react"
import { supabase } from "../../lib/supabase"
import { BookingsIcon, PaymentsIcon, VehicleIcon, OrdersIcon, ProfileIcon, ServicesIcon, SettingsIcon, ChatIcon, TicketIcon, NoteIcon, PenIcon, QuestionIcon } from "../../lib/cccIcons"

import { useAuth } from "../../contexts/AuthContext"
import useIsMobile from "../../lib/useIsMobile"
import toast from "react-hot-toast"

const CATEGORIES = [
  { k:"booking", l:"Service Booking", icon:"bookings" },
  { k:"payment", l:"Payment Issue", icon:"payments" },
  { k:"driver", l:"Driver Complaint", icon:"vehicle" },
  { k:"parts", l:"Parts Order", icon:"orders" },
  { k:"account", l:"Account Issue", icon:"profile" },
  { k:"provider", l:"Provider Issue", icon:"services" },
  { k:"technical", l:"Technical Problem", icon:"settings" },
  { k:"other", l:"Other", icon:"chat" },
]

const PRIORITIES = [
  { k:"low", l:"Low", color:"#1d9e75" },
  { k:"medium", l:"Medium", color:"#e6821e" },
  { k:"high", l:"High", color:"#e24b4a" },
]

const STATUS_COLOR = { open:"#e6821e", in_progress:"#378add", resolved:"#1d9e75", closed:"#888" }

const FAQ = [
  { q:"How do I cancel a booking?", a:"Go to My Bookings → tap the booking → tap Cancel. Cancellations within 24hrs of the appointment may incur a fee." },
  { q:"When will I get my refund?", a:"Approved refunds are processed within 7 business days to your original payment method." },
  { q:"How do I track my parts order?", a:"Go to Marketplace → My Orders → tap your order to see delivery status and driver location." },
  { q:"My driver did not show up — what do I do?", a:"Tap Rate & Review on the booking and select Driver no-show. Our team will investigate and issue a service voucher." },
  { q:"How do I update my vehicle details?", a:"Go to Profile → My Vehicles → tap Edit on the vehicle you want to update." },
  { q:"How do I link a vehicle tracker?", a:"Go to Profile → My Vehicles → tap Link Tracker on the vehicle. Enter your tracker provider API key." },
]

export default function CustomerSupport() {
  const { user, profile } = useAuth()
  const isMobile = useIsMobile()
  const [tickets, setTickets] = useState([])
  const [selected, setSelected] = useState(null)
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState("")
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [sending, setSending] = useState(false)
  const [tab, setTab] = useState("faq")
  const [expandedFaq, setExpandedFaq] = useState(null)
  const [form, setForm] = useState({ subject:"", category:"booking", priority:"medium", message:"" })
  const messagesEndRef = useRef(null)

  useEffect(() => {
    if (!user) return
    load()
    const sub = supabase.channel("customer-support-"+user.id)
      .on("postgres_changes", { event:"INSERT", schema:"public", table:"support_messages" },
        payload => {
          if (selected && payload.new.ticket_id === selected.id) {
            setMessages(m => [...m, payload.new])
            setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior:"smooth" }), 100)
          }
          load()
        })
      .on("postgres_changes", { event:"UPDATE", schema:"public", table:"support_tickets", filter:`customer_id=eq.${user.id}` },
        payload => {
          setTickets(t => t.map(tk => tk.id === payload.new.id ? {...tk,...payload.new} : tk))
          if (selected?.id === payload.new.id) setSelected(s => ({...s,...payload.new}))
        })
      .subscribe()
    return () => supabase.removeChannel(sub)
  }, [user, selected?.id])

  useEffect(() => { if (selected) loadMessages(selected.id) }, [selected?.id])

  async function load() {
    const { data } = await supabase.from("support_tickets")
      .select("*").eq("customer_id", user.id)
      .order("updated_at", { ascending:false })
    setTickets(data||[])
    setLoading(false)
  }

  async function loadMessages(ticketId) {
    const { data } = await supabase.from("support_messages")
      .select("*, profiles!support_messages_sender_id_fkey(first_name,last_name,role)")
      .eq("ticket_id", ticketId).order("created_at", { ascending:true })
    setMessages(data||[])
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior:"smooth" }), 100)
  }

  async function submitTicket(e) {
    e.preventDefault()
    if (!form.subject.trim() || !form.message.trim()) return toast.error("Please fill all fields")
    setSubmitting(true)
    try {
      const { data: ticket, error } = await supabase.from("support_tickets").insert({
        customer_id: user.id, subject: form.subject, category: form.category, priority: form.priority,
      }).select().single()
      if (error) throw error
      await supabase.from("support_messages").insert({ ticket_id: ticket.id, sender_id: user.id, message: form.message, is_staff: false })
      await supabase.from("notifications").insert({ user_id: user.id, title: "Support ticket created ✅", message: "Ticket "+ticket.ticket_number+" submitted. We will respond within 24 hours.", type: "info" })
      const { data: admins } = await supabase.from("profiles").select("id").eq("role","admin")
      for (const admin of (admins||[])) {
        await supabase.from("notifications").insert({ user_id: admin.id, title: "New support ticket 🎫"+(form.priority==="high"?" 🔴 HIGH":""), message: (profile?.first_name||"")+" "+(profile?.last_name||"")+" — "+form.subject+" ["+form.category+"]", type: form.priority==="high"?"error":"info" })
      }
      toast.success("Ticket "+ticket.ticket_number+" created! We will respond within 24 hours.")
      setForm({ subject:"", category:"booking", priority:"medium", message:"" })
      setTab("tickets"); load()
    } catch(err) { toast.error(err.message) }
    finally { setSubmitting(false) }
  }

  async function sendMessage(e) {
    e.preventDefault()
    if (!newMessage.trim() || !selected) return
    setSending(true)
    const { error } = await supabase.from("support_messages").insert({ ticket_id: selected.id, sender_id: user.id, message: newMessage.trim(), is_staff: false })
    if (!error) {
      const { data: admins } = await supabase.from("profiles").select("id").eq("role","admin")
      for (const admin of (admins||[])) {
        await supabase.from("notifications").insert({ user_id: admin.id, title: "Support reply from customer 💬", message: (profile?.first_name||"Customer")+" replied on ticket #"+selected.ticket_number, type:"info" })
      }
    }
    if (error) { toast.error(error.message); setSending(false); return }
    setNewMessage(""); setSending(false)
  }

  async function closeTicket(id) {
    await supabase.from("support_tickets").update({ status:"closed", updated_at:new Date().toISOString() }).eq("id", id)
    toast.success("Ticket closed"); setSelected(null); load()
  }

  async function reopenTicket(id) {
    await supabase.from("support_tickets").update({ status:"open", updated_at:new Date().toISOString() }).eq("id", id)
    toast.success("Ticket reopened"); load()
  }

  const openCount = tickets.filter(t=>t.status==="open"||t.status==="in_progress").length

  if (selected) return (
    <div style={{ display:"flex", flexDirection:"column", height:isMobile?"calc(100vh - 120px)":"calc(100vh - 140px)" }}>
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:"1rem", flexShrink:0 }}>
        <button onClick={()=>setSelected(null)} style={{ background:"none", border:"none", color:"#e6821e", cursor:"pointer", fontSize:13, padding:0 }}>← Back</button>
        <div style={{ flex:1 }}>
          <div style={{ fontFamily:"Syne", fontSize:13, fontWeight:800, color:"#000" }}>{selected.subject}</div>
          <div style={{ display:"flex", gap:6, alignItems:"center", marginTop:2 }}>
            <span style={{ fontSize:10, padding:"2px 8px", borderRadius:10, background:(STATUS_COLOR[selected.status]||"#888")+"20", color:STATUS_COLOR[selected.status]||"#888", fontWeight:600 }}>{selected.status?.replace("_"," ").toUpperCase()}</span>
            <span style={{ fontSize:10, color:"#888" }}>#{selected.ticket_number}</span>
          </div>
        </div>
        {(selected.status==="open"||selected.status==="in_progress")&&(
          <button onClick={()=>closeTicket(selected.id)} style={{ background:"#f5f5f5", border:"none", borderRadius:7, color:"#555", fontSize:11, padding:"6px 10px", cursor:"pointer" }}>Close</button>
        )}
        {(selected.status==="closed"||selected.status==="resolved")&&(
          <button onClick={()=>reopenTicket(selected.id)} style={{ background:"#fff8f0", border:"1px solid #e6821e40", borderRadius:7, color:"#e6821e", fontSize:11, padding:"6px 10px", cursor:"pointer" }}>Reopen</button>
        )}
      </div>
      <div style={{ flex:1, overflowY:"auto", paddingBottom:"0.5rem", marginBottom:"0.5rem" }}>
        {messages.map(m => {
          const isMe = m.sender_id === user.id
          const isStaff = m.is_staff
          return (
            <div key={m.id} style={{ display:"flex", justifyContent:isMe?"flex-end":"flex-start", marginBottom:8 }}>
              <div style={{ maxWidth:"80%", background:isMe?"#e6821e":isStaff?"#eff6ff":"#f5f5f5", borderRadius:isMe?"12px 12px 4px 12px":"12px 12px 12px 4px", padding:"10px 14px" }}>
                {isStaff&&<div style={{ fontSize:10, color:"#378add", fontWeight:600, marginBottom:4 }}>🎫 CCC Support</div>}
                <div style={{ fontSize:13, color:isMe?"#fff":"#000", lineHeight:1.5 }}>{m.message}</div>
                <div style={{ fontSize:10, color:isMe?"rgba(255,255,255,0.7)":"#aaa", marginTop:4, textAlign:"right" }}>{new Date(m.created_at).toLocaleTimeString()}</div>
              </div>
            </div>
          )
        })}
        <div ref={messagesEndRef}/>
      </div>
      {(selected.status==="open"||selected.status==="in_progress") ? (
        <form onSubmit={sendMessage} style={{ display:"flex", gap:8, flexShrink:0 }}>
          <input value={newMessage} onChange={e=>setNewMessage(e.target.value)} placeholder="Type your message..."
            style={{ flex:1, background:"#f5f5f5", border:"1px solid #e0e0e0", borderRadius:10, padding:"10px 14px", fontSize:13, outline:"none" }}/>
          <button type="submit" disabled={sending||!newMessage.trim()} style={{ background:"#e6821e", border:"none", borderRadius:10, color:"#fff", padding:"10px 16px", cursor:"pointer", fontSize:13, fontWeight:700 }}>
            {sending?"...":"Send"}
          </button>
        </form>
      ) : (
        <div style={{ textAlign:"center", fontSize:12, color:"#888", padding:"0.75rem", background:"#f5f5f5", borderRadius:10 }}>
          This ticket is {selected.status}. Reopen to send more messages.
        </div>
      )}
    </div>
  )

  return (
    <div>
      <div style={{ fontFamily:"Syne", fontSize:18, fontWeight:800, color:"#000", marginBottom:"1rem" }}><><TicketIcon size={18} color="#e6821e"/> Support Center</></div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:"1rem" }}>
        {[
          { label:"Open tickets", value:openCount, color:"#e6821e" },
          { label:"Total tickets", value:tickets.length, color:"#378add" },
          { label:"Response time", value:"< 24h", color:"#1d9e75" },
        ].map(s=>(
          <div key={s.label} style={{ background:"#f8f8f8", borderRadius:10, padding:"0.75rem 0.5rem", textAlign:"center", border:"1px solid #eee" }}>
            <div style={{ fontFamily:"Syne", fontSize:16, fontWeight:800, color:s.color }}>{s.value}</div>
            <div style={{ fontSize:10, color:"#888", marginTop:2 }}>{s.label}</div>
          </div>
        ))}
      </div>
      <div style={{ display:"flex", gap:6, marginBottom:"1rem" }}>
        {[{ k:"faq", l:"FAQ" },{ k:"new", l:"New ticket" },{ k:"tickets", l:"My tickets"+(openCount>0?" ("+openCount+")":"") }].map(t=>(
          <button key={t.k} onClick={()=>setTab(t.k)}
            style={{ flex:1, padding:"8px", borderRadius:8, border:"none", fontSize:12, cursor:"pointer", background:tab===t.k?"#e6821e":"#f0f0f0", color:tab===t.k?"#fff":"#555", fontWeight:tab===t.k?700:400 }}>
            {t.k==="faq"?<><QuestionIcon size={14} color="currentColor"/> {t.l}</>:t.k==="new"?<><PenIcon size={14} color="currentColor"/> {t.l}</>:<><NoteIcon size={14} color="currentColor"/> {t.l}</>}
          </button>
        ))}
      </div>
      {tab==="faq"&&(
        <div>
          <div style={{ fontSize:12, color:"#888", marginBottom:"1rem" }}>Common questions — tap to expand</div>
          {FAQ.map((f,i)=>(
            <div key={i} style={{ background:"#f8f8f8", borderRadius:10, marginBottom:8, overflow:"hidden", border:"1px solid #eee" }}>
              <button onClick={()=>setExpandedFaq(expandedFaq===i?null:i)}
                style={{ width:"100%", background:"none", border:"none", padding:"12px", textAlign:"left", cursor:"pointer", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <span style={{ fontSize:13, fontWeight:600, color:"#000" }}>{f.q}</span>
                <span style={{ color:"#e6821e", fontSize:16 }}>{expandedFaq===i?"−":"+"}</span>
              </button>
              {expandedFaq===i&&(
                <div style={{ padding:"0 12px 12px", fontSize:12, color:"#555", lineHeight:1.7, borderTop:"1px solid #eee" }}>{f.a}</div>
              )}
            </div>
          ))}
          <div style={{ marginTop:"1rem", textAlign:"center" }}>
            <div style={{ fontSize:12, color:"#888", marginBottom:8 }}>Didnt find your answer?</div>
            <button onClick={()=>setTab("new")} style={{ background:"#e6821e", border:"none", borderRadius:10, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:13, fontWeight:700, padding:"12px 24px", cursor:"pointer" }}>
              <><PenIcon size={14} color="#e6821e"/> Create a support ticket</>
            </button>
          </div>
        </div>
      )}
      {tab==="new"&&(
        <form onSubmit={submitTicket}>
          <label style={{ fontSize:11, color:"#666", display:"block", marginBottom:4, fontWeight:600 }}>Category</label>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6, marginBottom:12 }}>
            {CATEGORIES.map(c=>(
              <button type="button" key={c.k} onClick={()=>setForm(f=>({...f,category:c.k}))}
                style={{ padding:"8px", borderRadius:8, border:"1px solid "+(form.category===c.k?"#e6821e":"#e0e0e0"), background:form.category===c.k?"#fff8f0":"#f8f8f8", color:form.category===c.k?"#e6821e":"#555", fontSize:12, cursor:"pointer", display:"flex", alignItems:"center", gap:6 }}>
                <span>{c.icon}</span><span style={{ fontWeight:form.category===c.k?700:400 }}>{c.l}</span>
              </button>
            ))}
          </div>
          <label style={{ fontSize:11, color:"#666", display:"block", marginBottom:4, fontWeight:600 }}>Priority</label>
          <div style={{ display:"flex", gap:6, marginBottom:12 }}>
            {PRIORITIES.map(p=>(
              <button type="button" key={p.k} onClick={()=>setForm(f=>({...f,priority:p.k}))}
                style={{ flex:1, padding:"8px", borderRadius:8, border:"1px solid "+(form.priority===p.k?p.color:"#e0e0e0"), background:form.priority===p.k?p.color+"15":"#f8f8f8", color:form.priority===p.k?p.color:"#555", fontSize:12, cursor:"pointer", fontWeight:form.priority===p.k?700:400 }}>
                {p.l}
              </button>
            ))}
          </div>
          <label style={{ fontSize:11, color:"#666", display:"block", marginBottom:4, fontWeight:600 }}>Subject *</label>
          <input value={form.subject} onChange={e=>setForm(f=>({...f,subject:e.target.value}))} placeholder="Brief description of your issue"
            style={{ width:"100%", background:"#f5f5f5", border:"1px solid #e0e0e0", borderRadius:8, padding:"10px 12px", fontSize:13, marginBottom:12, outline:"none", boxSizing:"border-box" }} required/>
          <label style={{ fontSize:11, color:"#666", display:"block", marginBottom:4, fontWeight:600 }}>Message *</label>
          <textarea value={form.message} onChange={e=>setForm(f=>({...f,message:e.target.value}))}
            placeholder="Describe your issue in detail. Include booking numbers, dates, or any relevant information." rows={5}
            style={{ width:"100%", background:"#f5f5f5", border:"1px solid #e0e0e0", borderRadius:8, padding:"10px 12px", fontSize:13, marginBottom:16, outline:"none", resize:"vertical", boxSizing:"border-box" }} required/>
          <div style={{ background:"#f0fdf4", border:"1px solid #1d9e7530", borderRadius:8, padding:"0.75rem", marginBottom:16, fontSize:12, color:"#555" }}>
            ⏱️ Our support team typically responds within 24 hours on business days.
          </div>
          <button type="submit" disabled={submitting}
            style={{ width:"100%", background:submitting?"#ccc":"#e6821e", border:"none", borderRadius:10, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:14, fontWeight:700, padding:"14px", cursor:submitting?"not-allowed":"pointer" }}>
            {submitting?"Submitting...":"🎫 Submit ticket"}
          </button>
        </form>
      )}
      {tab==="tickets"&&(
        <div>
          {loading&&<div style={{ color:"#888", fontSize:13 }}>Loading...</div>}
          {!loading&&tickets.length===0&&(
            <div style={{ textAlign:"center", padding:"3rem", color:"#888" }}>
              <div style={{ fontSize:32, marginBottom:10 }}>🎫</div>
              No support tickets yet
              <div style={{ marginTop:"1rem" }}>
                <button onClick={()=>setTab("new")} style={{ background:"#e6821e", border:"none", borderRadius:10, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:13, fontWeight:700, padding:"10px 20px", cursor:"pointer" }}>
                  Create your first ticket
                </button>
              </div>
            </div>
          )}
          {tickets.map(t=>(
            <div key={t.id} onClick={()=>setSelected(t)}
              style={{ background:"#f8f8f8", border:`1px solid ${STATUS_COLOR[t.status]||"#eee"}30`, borderRadius:10, padding:"1rem", marginBottom:8, cursor:"pointer" }}
              onMouseEnter={e=>e.currentTarget.style.background="#f0f0f0"}
              onMouseLeave={e=>e.currentTarget.style.background="#f8f8f8"}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                <div style={{ flex:1, minWidth:0, marginRight:8 }}>
                  <div style={{ fontFamily:"Syne", fontSize:13, fontWeight:700, color:"#000", marginBottom:2 }}>{t.subject}</div>
                  <div style={{ fontSize:11, color:"#888" }}>#{t.ticket_number} · {CATEGORIES.find(c=>c.k===t.category)?.icon} {t.category}</div>
                  <div style={{ fontSize:11, color:"#aaa", marginTop:2 }}>{new Date(t.updated_at||t.created_at).toLocaleDateString()}</div>
                </div>
                <div style={{ textAlign:"right", flexShrink:0 }}>
                  <span style={{ fontSize:10, padding:"2px 8px", borderRadius:10, background:(STATUS_COLOR[t.status]||"#888")+"20", color:STATUS_COLOR[t.status]||"#888", fontWeight:600, display:"block", marginBottom:4 }}>{t.status?.replace("_"," ")}</span>
                  <span style={{ fontSize:10, padding:"2px 6px", borderRadius:6, background:(PRIORITIES.find(p=>p.k===t.priority)?.color||"#888")+"20", color:PRIORITIES.find(p=>p.k===t.priority)?.color||"#888" }}>{t.priority}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}


