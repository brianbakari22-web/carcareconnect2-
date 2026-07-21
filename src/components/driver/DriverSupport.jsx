import { useEffect, useState, useRef } from "react"
import { supabase } from "../../lib/supabase"
import { useAuth } from "../../contexts/AuthContext"
import useIsMobile from "../../lib/useIsMobile"
import toast from "react-hot-toast"

const CATEGORIES = [
  { k:"payment", l:"Payment Issue", icon:"💳" },
  { k:"delivery", l:"Delivery Problem", icon:"🚗" },
  { k:"customer", l:"Customer Complaint", icon:"👤" },
  { k:"vehicle", l:"Vehicle Incident", icon:"🚨" },
  { k:"account", l:"Account Issue", icon:"⚙️" },
  { k:"go_service", l:"GO Service Issue", icon:"🔧" },
  { k:"other", l:"Other", icon:"💬" },
]
const PRIORITIES = [
  { k:"low", l:"Low" },
  { k:"medium", l:"Medium" },
  { k:"high", l:"High" },
]
const STATUS_COLOR = { open:"#e6821e", in_progress:"#378add", resolved:"#1d9e75", closed:"#888" }
const FAQ = [
  { q:"When do I receive my earnings?", a:"Driver earnings are sent automatically to your M-Pesa or Pochi la Biashara after each completed delivery or concierge job." },
  { q:"How do I update my M-Pesa number?", a:"Go to Profile, then Payment Settings to update your preferred payout method." },
  { q:"What do I do if a customer is abusive?", a:"End the trip safely and file a support ticket with details. Our team will investigate and take action." },
  { q:"My GO Service alarm is not working?", a:"Ensure notifications are enabled for the CCC app. Go to phone Settings, then Apps, then CCC, then Notifications." },
  { q:"How do I report a vehicle incident?", a:"File a High priority support ticket with incident details, photos, and location. Our team responds within 2 hours." },
  { q:"How do I go online or offline?", a:"Use the toggle switch on your Driver Overview page to set your availability status." },
]

export default function DriverSupport() {
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
  const [form, setForm] = useState({ subject:"", category:"payment", priority:"medium", message:"" })
  const messagesEndRef = useRef(null)

  useEffect(() => {
    if (!user) return
    load()
    const sub = supabase.channel("driver-support-"+user.id)
      .on("postgres_changes", { event:"INSERT", schema:"public", table:"support_messages" },
        payload => {
          if (selected && payload.new.ticket_id === selected.id) {
            setMessages(m => [...m, payload.new])
            setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior:"smooth" }), 100)
          }
          load()
        })
      .subscribe()
    return () => supabase.removeChannel(sub)
  }, [user, selected])

  async function load() {
    const { data } = await supabase.from("support_tickets")
      .select("*").eq("user_id", user.id)
      .order("updated_at", { ascending:false })
    setTickets(data||[])
    setLoading(false)
  }

  async function loadMessages(ticketId) {
    const { data } = await supabase.from("support_messages")
      .select("*, sender:profiles!support_messages_sender_id_fkey(first_name,last_name,role)")
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
        customer_id: user.id, user_id: user.id, user_role: "driver",
        subject: form.subject, category: form.category, priority: form.priority,
      }).select().single()
      if (error) throw error
      await supabase.from("support_messages").insert({ ticket_id: ticket.id, sender_id: user.id, message: form.message, is_staff: false })
      await supabase.from("notifications").insert({ user_id: user.id, title: "Support ticket created", message: "Ticket "+ticket.ticket_number+" submitted. We respond within 24 hours.", type: "info" })
      const { data: admins } = await supabase.from("profiles").select("id").eq("role","admin")
      for (const admin of (admins||[])) {
        await supabase.from("notifications").insert({ user_id: admin.id, title: "Driver support ticket"+(form.priority==="high"?" HIGH":""), message: (profile?.first_name||"Driver")+" "+(profile?.last_name||"")+" — "+form.subject+" ["+form.category+"]", type: form.priority==="high"?"error":"info" })
      }
      toast.success("Ticket "+ticket.ticket_number+" created!")
      setForm({ subject:"", category:"payment", priority:"medium", message:"" })
      setTab("tickets"); load()
    } catch(err) { toast.error(err.message) }
    finally { setSubmitting(false) }
  }

  async function sendMessage(e) {
    e.preventDefault()
    if (!newMessage.trim() || !selected) return
    setSending(true)
    const { error } = await supabase.from("support_messages").insert({ ticket_id: selected.id, sender_id: user.id, message: newMessage.trim(), is_staff: false })
    if (!error) { setNewMessage(""); loadMessages(selected.id) }
    else toast.error(error.message)
    setSending(false)
  }

  const inp = { width:"100%", background:"#fff", border:"1px solid #e0e0e0", borderRadius:8, padding:"10px 12px", fontSize:13, outline:"none", fontFamily:"DM Sans,sans-serif", marginBottom:10, boxSizing:"border-box" }
  const SC = STATUS_COLOR

  if (selected) return (
    <div style={{ display:"flex", flexDirection:"column", height:"calc(100vh - 140px)" }}>
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
        <button onClick={()=>{ setSelected(null); setMessages([]) }} style={{ background:"none", border:"none", fontSize:20, cursor:"pointer" }}>←</button>
        <div>
          <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:700 }}>{selected.subject}</div>
          <div style={{ display:"flex", gap:6, alignItems:"center", marginTop:2 }}>
            <span style={{ fontSize:10, padding:"2px 8px", borderRadius:10, background:(SC[selected.status]||"#888")+"20", color:SC[selected.status]||"#888" }}>{selected.status?.replace("_"," ")}</span>
            <span style={{ fontSize:10, color:"#888" }}>#{selected.ticket_number}</span>
          </div>
        </div>
      </div>
      <div style={{ flex:1, overflowY:"auto", display:"flex", flexDirection:"column", gap:8, paddingBottom:8 }}>
        {messages.map(m=>(
          <div key={m.id} style={{ display:"flex", flexDirection:"column", alignItems:m.sender_id===user.id?"flex-end":"flex-start" }}>
            <div style={{ fontSize:10, color:"#888", marginBottom:2 }}>{m.is_staff?"CCC Support":((m.sender?.first_name||"")+" "+(m.sender?.last_name||"")).trim()||"You"} · {new Date(m.created_at).toLocaleTimeString()}</div>
            <div style={{ maxWidth:"80%", background:m.sender_id===user.id?"#1d9e75":"#f0f0f0", color:m.sender_id===user.id?"#fff":"#000", borderRadius:m.sender_id===user.id?"12px 12px 4px 12px":"12px 12px 12px 4px", padding:"8px 12px", fontSize:13 }}>
              {m.message}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef}/>
      </div>
      <form onSubmit={sendMessage} style={{ display:"flex", gap:8, paddingTop:8, borderTop:"1px solid #eee" }}>
        <input value={newMessage} onChange={e=>setNewMessage(e.target.value)} placeholder="Type your message..." style={{ ...inp, marginBottom:0, flex:1 }}/>
        <button type="submit" disabled={sending||!newMessage.trim()} style={{ background:"#1d9e75", border:"none", borderRadius:8, color:"#fff", padding:"10px 18px", cursor:"pointer", fontWeight:700, fontSize:13 }}>{sending?"...":"Send"}</button>
      </form>
    </div>
  )

  return (
    <div>
      <div style={{ fontFamily:"Syne", fontSize:isMobile?16:18, fontWeight:800, marginBottom:4 }}>Driver Support</div>
      <div style={{ fontSize:12, color:"#777", marginBottom:"1.25rem" }}>Get help with deliveries, payments, and account issues.</div>
      <div style={{ display:"flex", gap:6, marginBottom:"1.25rem", overflowX:"auto", paddingBottom:4 }}>
        {[{k:"faq",l:"FAQ"},{k:"tickets",l:"My Tickets ("+tickets.length+")"},{k:"new",l:"+ New Ticket"}].map(t=>(
          <button key={t.k} onClick={()=>setTab(t.k)} style={{ padding:"8px 16px", borderRadius:8, border:"none", fontSize:12, cursor:"pointer", background:tab===t.k?"#1d9e75":"#f0f0f0", color:tab===t.k?"#fff":"#555", fontWeight:tab===t.k?700:400, whiteSpace:"nowrap" }}>{t.l}</button>
        ))}
      </div>
      {tab==="faq"&&(
        <div>
          {FAQ.map((f,i)=>(
            <div key={i} onClick={()=>setExpandedFaq(expandedFaq===i?null:i)} style={{ background:"#fff", border:"1px solid #eee", borderRadius:10, padding:"0.75rem 1rem", marginBottom:8, cursor:"pointer" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div style={{ fontSize:13, fontWeight:600 }}>{f.q}</div>
                <div style={{ fontSize:14, color:"#888" }}>{expandedFaq===i?"▲":"▼"}</div>
              </div>
              {expandedFaq===i&&<div style={{ fontSize:12, color:"#555", marginTop:8, lineHeight:1.6 }}>{f.a}</div>}
            </div>
          ))}
        </div>
      )}
      {tab==="tickets"&&(
        <div>
          {loading&&<div style={{ color:"#888", fontSize:13 }}>Loading...</div>}
          {!loading&&tickets.length===0&&<div style={{ color:"#888", fontSize:13, textAlign:"center", padding:"2rem" }}>No tickets yet. Tap + New Ticket to get help.</div>}
          {tickets.map(t=>(
            <div key={t.id} onClick={()=>{ setSelected(t); loadMessages(t.id) }} style={{ background:"#fff", border:"1px solid #eee", borderRadius:10, padding:"0.75rem 1rem", marginBottom:8, cursor:"pointer" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                <div>
                  <div style={{ fontSize:13, fontWeight:600 }}>{t.subject}</div>
                  <div style={{ fontSize:10, color:"#888", marginTop:2 }}>#{t.ticket_number} · {t.category} · {new Date(t.created_at).toLocaleDateString()}</div>
                </div>
                <span style={{ fontSize:10, padding:"2px 8px", borderRadius:10, background:(SC[t.status]||"#888")+"20", color:SC[t.status]||"#888" }}>{t.status?.replace("_"," ")}</span>
              </div>
            </div>
          ))}
        </div>
      )}
      {tab==="new"&&(
        <form onSubmit={submitTicket}>
          <div style={{ fontSize:11, color:"#666", marginBottom:4 }}>Category</div>
          <select style={inp} value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))}>
            {CATEGORIES.map(c=><option key={c.k} value={c.k}>{c.icon} {c.l}</option>)}
          </select>
          <div style={{ fontSize:11, color:"#666", marginBottom:4 }}>Priority</div>
          <select style={inp} value={form.priority} onChange={e=>setForm(f=>({...f,priority:e.target.value}))}>
            {PRIORITIES.map(p=><option key={p.k} value={p.k}>{p.l}</option>)}
          </select>
          <div style={{ fontSize:11, color:"#666", marginBottom:4 }}>Subject</div>
          <input style={inp} placeholder="Brief description of your issue" value={form.subject} onChange={e=>setForm(f=>({...f,subject:e.target.value}))}/>
          <div style={{ fontSize:11, color:"#666", marginBottom:4 }}>Message</div>
          <textarea style={{ ...inp, minHeight:100, resize:"vertical" }} placeholder="Describe your issue in detail..." value={form.message} onChange={e=>setForm(f=>({...f,message:e.target.value}))}/>
          <button type="submit" disabled={submitting} style={{ width:"100%", background:"#1d9e75", border:"none", borderRadius:8, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:14, fontWeight:700, padding:"12px", cursor:"pointer" }}>{submitting?"Submitting...":"Submit Ticket"}</button>
        </form>
      )}
    </div>
  )
}