import useIsMobile from "../../lib/useIsMobile"
import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"
import { useAuth } from "../../contexts/AuthContext"
import { contactViaWhatsApp, contactViaEmail } from "../../lib/contact"
import toast from "react-hot-toast"
import { useLanguage } from "../../contexts/LanguageContext"

const SC = { pending:"#e6821e", confirmed:"#378add", "in-progress":"#8b5cf6", completed:"#1d9e75", cancelled:"#e24b4a" }
const SB = { pending:"#1a1208", confirmed:"#0c1f2e", "in-progress":"#160a2e", completed:"#071a12", cancelled:"#1a0808" }
const PC = { pending:"#e6821e", paid:"#1d9e75", cash:"#555" }

export default function ProviderBookings() {
  const isMobile = useIsMobile()
  const { user, profile } = useAuth()
  const { t } = useLanguage()
  const [bookings, setBookings] = useState([])
  const [customers, setCustomers] = useState({})
  const [filter, setFilter] = useState("all")
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(null)
  const [rescheduling, setRescheduling] = useState(null)
  const [rescheduleForm, setRescheduleForm] = useState({ date:"", time:"" })
  const [addingNote, setAddingNote] = useState(null)
  const [noteText, setNoteText] = useState("")

  useEffect(() => {
    if (!user) return
    load()
    const sub = supabase.channel("prov-bookings-page")
      .on("postgres_changes", { event:"*", schema:"public", table:"bookings", filter:`provider_id=eq.${user.id}` }, () => {
        toast("Booking updated", { icon:"📋" }); load()
      }).subscribe()
    return () => supabase.removeChannel(sub)
  }, [user])

  async function load() {
    const { data } = await supabase.from("bookings").select("*").eq("provider_id", user.id).order("created_at",{ascending:false})
    setBookings(data||[])
    if (data&&data.length>0) {
      const ids = [...new Set(data.map(b=>b.customer_id))]
      const { data: profs } = await supabase.from("profile_public").select("id,first_name,last_name").in("id",ids)
      const map = {}
      ids.forEach(id=>{ map[id]=profs?.find(p=>p.id===id) })
      setCustomers(map)
    }
    setLoading(false)
  }

  async function updateStatus(id, status) {
    const { error } = await supabase.from("bookings").update({ status }).eq("id",id).eq("provider_id",user.id)
    if (error) return toast.error(error.message)
    toast.success(`Booking ${status}`)
    const b = bookings.find(b=>b.id===id)
    if (b) await supabase.from("notifications").insert({
      user_id: b.customer_id,
      title: `Booking ${status}`,
      message: `Your booking for ${b.service_name} is now ${status}`,
      type: status==="cancelled"?"error":"success"
    })
    load()
  }

  async function markCashPaid(id) {
    const { error } = await supabase.from("bookings").update({ payment_status:"paid" }).eq("id",id).eq("provider_id",user.id)
    if (error) return toast.error(error.message)
    const b = bookings.find(b=>b.id===id)
    if (b) {
      await supabase.from("notifications").insert({
        user_id: b.customer_id,
        title: "Payment received",
        message: `Cash payment of $${Number(b.total_amount).toFixed(2)} received for ${b.service_name}`,
        type: "success"
      })
      await supabase.from("payments").insert({
        booking_id: id,
        customer_id: b.customer_id,
        provider_id: user.id,
        amount: Number(b.total_amount),
        payment_method: "cash",
        status: "paid"
      }).catch(()=>{})
    }
    toast.success("Cash payment recorded ✓")
    load()
  }

  async function reschedule(e) {
    e.preventDefault()
    const { error } = await supabase.from("bookings").update({ booking_date:rescheduleForm.date, booking_time:rescheduleForm.time }).eq("id",rescheduling).eq("provider_id",user.id)
    if (error) return toast.error(error.message)
    const b = bookings.find(b=>b.id===rescheduling)
    if (b) await supabase.from("notifications").insert({
      user_id: b.customer_id,
      title: "Booking rescheduled",
      message: `Your booking for ${b.service_name} has been rescheduled to ${rescheduleForm.date} at ${rescheduleForm.time}`,
      type: "info"
    })
    toast.success("Booking rescheduled")
    setRescheduling(null)
    setRescheduleForm({ date:"", time:"" })
    load()
  }

  async function saveNote(bookingId) {
    const { error } = await supabase.from("bookings").update({ notes: noteText }).eq("id",bookingId).eq("provider_id",user.id)
    if (error) return toast.error(error.message)
    toast.success("Note saved")
    setAddingNote(null)
    setNoteText("")
    load()
  }

  const filtered = filter==="all" ? bookings : bookings.filter(b=>b.status===filter)
  const senderName = profile?.business_name || profile?.first_name || "Provider"
  const inp = { width:"100%", background:"#0f0f0f", border:"1px solid #222", borderRadius:8, padding:"10px 12px", color:"#f0ede6", fontSize:13, outline:"none", fontFamily:"'DM Sans',sans-serif" }

  return (
    <div>
      <div style={{ display:"flex", gap:6, marginBottom:"1rem", flexWrap:"wrap" }}>
        {["all","pending","confirmed","in-progress","completed","cancelled"].map(s=>(
          <button key={s} onClick={()=>setFilter(s)}
            style={{ padding:"6px 14px", borderRadius:6, border:"none", fontSize:12, cursor:"pointer", background:filter===s?"#1a1208":"#111", color:filter===s?"#e6821e":"#666", fontFamily:"'DM Sans',sans-serif" }}>
            {s==="all"?"All":s.charAt(0).toUpperCase()+s.slice(1)}
            {s==="all"&&` (${bookings.length})`}
          </button>
        ))}
      </div>

      {loading&&<div style={{ color:"#555", fontSize:13 }}>Loading...</div>}
      {!loading&&filtered.length===0&&<div style={{ color:"#444", fontSize:13, textAlign:"center", padding:"2rem" }}>No bookings found</div>}

      {filtered.map(b=>{
        const customer = customers[b.customer_id]
        const isExpanded = expanded===b.id
        const customerName = `${customer?.first_name||""} ${customer?.last_name||""}`.trim()||"Customer"
        const isCashUnpaid = b.payment_status==="pending" && b.status==="completed"

        return (
          <div key={b.id} style={{ background:"#111", border:`1px solid ${isCashUnpaid?"#e6821e30":"#1e1e1e"}`, borderRadius:10, padding:"1rem", marginBottom:10 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
              <div style={{ cursor:"pointer", flex:1 }} onClick={()=>setExpanded(isExpanded?null:b.id)}>
                <div style={{ fontSize:14, fontWeight:500, color:"#f0ede6" }}>{b.service_name}</div>
                <div style={{ fontSize:11, color:"#555", marginTop:2 }}>{customerName}</div>
                <div style={{ fontSize:10, color:"#444", marginTop:2 }}>#{b.booking_number} · {b.booking_date} · {b.booking_time?.slice(0,5)}</div>
              </div>
              <div style={{ textAlign:"right", flexShrink:0 }}>
                <span style={{ fontSize:10, fontWeight:500, padding:"3px 9px", borderRadius:20, background:SB[b.status]||"#111", color:SC[b.status]||"#888", border:`1px solid ${SC[b.status]||"#888"}40`, display:"inline-block" }}>{b.status}</span>
                <div style={{ fontFamily:"Syne", fontSize:13, fontWeight:700, color:"#e6821e", marginTop:4 }}>${Number(b.total_amount).toFixed(2)}</div>
                <div style={{ fontSize:10, marginTop:2, padding:"1px 6px", borderRadius:10, background:b.payment_status==="paid"?"#071a12":"#1a1208", color:b.payment_status==="paid"?"#1d9e75":"#e6821e" }}>
                  {b.payment_status==="paid"?"✓ Paid":"Unpaid"}
                </div>
              </div>
            </div>

            {isCashUnpaid&&(
              <div style={{ background:"#1a1208", border:"1px solid #e6821e30", borderRadius:8, padding:"0.6rem 0.8rem", marginBottom:8, fontSize:11, color:"#e6821e" }}>
                ⚠️ Cash payment pending — mark as paid once you receive it
              </div>
            )}

            {isExpanded&&(
              <div style={{ borderTop:"1px solid #1e1e1e", paddingTop:10, marginBottom:10 }}>
                <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"repeat(3,1fr)", gap:8, marginBottom:8 }}>
                  {[
                    { l:"Your earnings", v:`$${Number(b.provider_earnings||0).toFixed(2)}`, c:"#1d9e75" },
                    { l:"Platform 15%", v:`$${Number(b.platform_commission||0).toFixed(2)}` },
                    { l:"Payment method", v:b.payment_status==="paid"?"Card/M-Pesa":"Cash" },
                  ].map(f=>(
                    <div key={f.l}>
                      <div style={{ fontSize:10, color:"#555", textTransform:"uppercase" }}>{f.l}</div>
                      <div style={{ fontSize:12, color:f.c||"#f0ede6", marginTop:2 }}>{f.v}</div>
                    </div>
                  ))}
                </div>
                {b.is_concierge&&<div style={{ fontSize:11, color:"#378add", marginBottom:6 }}>🚚 Concierge requested · Pickup: {b.pickup_address||"TBD"}</div>}
                {b.notes&&<div style={{ fontSize:11, color:"#666", fontStyle:"italic", marginBottom:4 }}>Note: "{b.notes}"</div>}
              </div>
            )}

            <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
              {b.status==="pending"&&<>
                <button onClick={()=>updateStatus(b.id,"confirmed")} style={{ background:"#071a12", border:"1px solid #1d9e7540", borderRadius:7, color:"#1d9e75", fontSize:12, padding:"6px 14px", cursor:"pointer" }}>Confirm</button>
                <button onClick={()=>updateStatus(b.id,"cancelled")} style={{ background:"none", border:"1px solid #e24b4a40", borderRadius:7, color:"#e24b4a", fontSize:12, padding:"6px 14px", cursor:"pointer" }}>Decline</button>
              </>}
              {b.status==="confirmed"&&(
                <button onClick={()=>updateStatus(b.id,"in-progress")} style={{ background:"#160a2e", border:"1px solid #8b5cf640", borderRadius:7, color:"#8b5cf6", fontSize:12, padding:"6px 14px", cursor:"pointer" }}>Start service</button>
              )}
              {b.status==="in-progress"&&(
                <button onClick={()=>updateStatus(b.id,"completed")} style={{ background:"#071a12", border:"1px solid #1d9e7540", borderRadius:7, color:"#1d9e75", fontSize:12, padding:"6px 14px", cursor:"pointer" }}>Mark complete</button>
              )}
              {isCashUnpaid&&(
                <button onClick={()=>markCashPaid(b.id)} style={{ background:"#1a1208", border:"1px solid #e6821e", borderRadius:7, color:"#e6821e", fontSize:12, padding:"6px 14px", cursor:"pointer", fontWeight:600 }}>
                  ✓ Mark cash paid
                </button>
              )}
              {["pending","confirmed"].includes(b.status)&&(
                <button onClick={()=>{ setRescheduling(b.id); setRescheduleForm({ date:b.booking_date, time:b.booking_time?.slice(0,5)||"" }) }}
                  style={{ background:"#0c1f2e", border:"1px solid #378add40", borderRadius:7, color:"#378add", fontSize:11, padding:"5px 10px", cursor:"pointer" }}>
                  Reschedule
                </button>
              )}
              {!["cancelled"].includes(b.status)&&<>
                <button onClick={()=>{ setAddingNote(b.id); setNoteText(b.notes||"") }}
                  style={{ background:"none", border:"1px solid #333", borderRadius:7, color:"#888", fontSize:11, padding:"5px 10px", cursor:"pointer" }}>
                  Note
                </button>
                <button onClick={()=>contactViaWhatsApp(b.id, customerName, b.service_name, senderName)}
                  style={{ background:"#071a12", border:"1px solid #1d9e7540", borderRadius:7, color:"#1d9e75", fontSize:11, padding:"5px 10px", cursor:"pointer" }}>
                  WhatsApp
                </button>
                <button onClick={()=>contactViaEmail(b.id, customerName, b.service_name, senderName)}
                  style={{ background:"#0c1f2e", border:"1px solid #378add40", borderRadius:7, color:"#378add", fontSize:11, padding:"5px 10px", cursor:"pointer" }}>
                  Email
                </button>
              </>}
              <button onClick={()=>setExpanded(isExpanded?null:b.id)}
                style={{ background:"none", border:"1px solid #333", borderRadius:7, color:"#666", fontSize:11, padding:"5px 10px", cursor:"pointer" }}>
                {isExpanded?t("less"):t("details")}
              </button>
            </div>

            {rescheduling===b.id&&(
              <div style={{ marginTop:10, background:"#0f0f0f", borderRadius:8, padding:"1rem", border:"1px solid #222" }}>
                <div style={{ fontFamily:"Syne", fontSize:13, fontWeight:700, marginBottom:10, color:"#f0ede6" }}>Reschedule booking</div>
                <form onSubmit={reschedule}>
                  <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:10, marginBottom:10 }}>
                    <div>
                      <label style={{ fontSize:11, color:"#666", textTransform:"uppercase", display:"block", marginBottom:4 }}>New date</label>
                      <input type="date" value={rescheduleForm.date} onChange={e=>setRescheduleForm(f=>({...f,date:e.target.value}))} required min={new Date().toISOString().split("T")[0]} style={inp}/>
                    </div>
                    <div>
                      <label style={{ fontSize:11, color:"#666", textTransform:"uppercase", display:"block", marginBottom:4 }}>New time</label>
                      <select value={rescheduleForm.time} onChange={e=>setRescheduleForm(f=>({...f,time:e.target.value}))} required style={inp}>
                        <option value="">Select time</option>
                        {["07:00","07:30","08:00","08:30","09:00","09:30","10:00","10:30","11:00","11:30","12:00","12:30","13:00","13:30","14:00","14:30","15:00","15:30","16:00","16:30","17:00","17:30","18:00"].map(t=><option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                  </div>
                  <div style={{ display:"flex", gap:8 }}>
                    <button type="submit" style={{ background:"#378add", border:"none", borderRadius:7, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:12, fontWeight:700, padding:"8px 16px", cursor:"pointer" }}>Save reschedule</button>
                    <button type="button" onClick={()=>setRescheduling(null)} style={{ background:"none", border:"1px solid #333", borderRadius:7, color:"#888", fontSize:12, padding:"8px 16px", cursor:"pointer" }}>Cancel</button>
                  </div>
                </form>
              </div>
            )}

            {addingNote===b.id&&(
              <div style={{ marginTop:10, background:"#0f0f0f", borderRadius:8, padding:"1rem", border:"1px solid #222" }}>
                <div style={{ fontFamily:"Syne", fontSize:13, fontWeight:700, marginBottom:8, color:"#f0ede6" }}>Provider note</div>
                <textarea value={noteText} onChange={e=>setNoteText(e.target.value)} rows={3}
                  placeholder="Internal note about this booking..."
                  style={{ width:"100%", background:"#111", border:"1px solid #222", borderRadius:7, padding:"8px 10px", color:"#f0ede6", fontSize:12, outline:"none", fontFamily:"'DM Sans',sans-serif", resize:"vertical", marginBottom:8 }}/>
                <div style={{ display:"flex", gap:8 }}>
                  <button onClick={()=>saveNote(b.id)} style={{ background:"#e6821e", border:"none", borderRadius:7, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:12, fontWeight:700, padding:"8px 16px", cursor:"pointer" }}>Save note</button>
                  <button onClick={()=>setAddingNote(null)} style={{ background:"none", border:"1px solid #333", borderRadius:7, color:"#888", fontSize:12, padding:"8px 16px", cursor:"pointer" }}>Cancel</button>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}


