import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"
import { useAuth } from "../../contexts/AuthContext"
import { useNavigate } from "react-router-dom"
import { useLanguage } from "../../contexts/LanguageContext"
import useIsMobile from "../../lib/useIsMobile"
import toast from "react-hot-toast"
import { downloadInvoice } from "../../lib/invoice"

const SC = { pending:"#e6821e", confirmed:"#378add", "in-progress":"#8b5cf6", completed:"#1d9e75", cancelled:"#e24b4a" }
const SB = { pending:"#1a1208", confirmed:"#0c1f2e", "in-progress":"#160a2e", completed:"#071a12", cancelled:"#1a0808" }

export default function CustomerBookings() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { t } = useLanguage()
  const isMobile = useIsMobile()
  const [bookings, setBookings] = useState([])
  const [filter, setFilter] = useState("all")
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(null)
  const [rebooking, setRebooking] = useState(null)
  const [invoiceLoading, setInvoiceLoading] = useState(null)
  const [driverInfo, setDriverInfo] = useState({})

  async function loadDriverInfo(driverId, bookingId) {
    if (!driverId || driverInfo[bookingId]) return
    const [{ data: driver }, { data: status }] = await Promise.all([
      supabase.from("profiles").select("first_name,last_name").eq("id",driverId).single(),
      supabase.from("driver_status").select("is_online,current_booking_id").eq("driver_id",driverId).maybeSingle(),
    ])
    if (driver) setDriverInfo(prev=>({...prev,[bookingId]:{...driver,...status}}))
  }

  async function downloadBookingInvoice(booking) {
    setInvoiceLoading(booking.id)
    try {
      const [{ data: provider }, { data: customer }, { data: mechanic }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", booking.provider_id).single(),
        supabase.from("profiles").select("*").eq("id", booking.customer_id).single(),
        booking.assigned_mechanic_id ? supabase.from("mechanics").select("*").eq("id", booking.assigned_mechanic_id).single() : Promise.resolve({ data:null }),
      ])
      downloadInvoice(booking, provider, customer, mechanic, null)
      toast.success("Invoice downloaded")
    } catch(err) {
      toast.error("Could not generate invoice")
    } finally {
      setInvoiceLoading(null)
    }
  }

  const [rebookForm, setRebookForm] = useState({ date:"", time:"" })

  useEffect(() => { if (user) load() }, [user])

  async function load() {
    const { data } = await supabase.from("bookings").select("*").eq("customer_id", user.id).order("created_at",{ascending:false})
    setBookings(data||[])
    setLoading(false)
  }

  async function approveParts(booking) {
    const { error } = await supabase.from("bookings").update({ parts_approved:true }).eq("id",booking.id).eq("customer_id",user.id)
    if (error) return toast.error(error.message)
    await supabase.from("notifications").insert({
      user_id: booking.provider_id,
      title: "Parts approved by customer ✅",
      message: `Customer has approved the parts for booking ${booking.booking_number}. Total: KES ${Number(booking.updated_total||booking.total_amount).toLocaleString()}`,
      type: "success",
    })
    toast.success("Parts approved — provider notified")
    load()
  }

  async function cancelBooking(id) {
    if (!confirm("Cancel this booking?")) return
    const { error } = await supabase.from("bookings").update({ status:"cancelled" }).eq("id",id).eq("customer_id",user.id)
    if (error) return toast.error(error.message)
    toast.success(t("cancelBooking"))
    load()
  }

  async function rebook(e) {
    e.preventDefault()
    const b = bookings.find(b=>b.id===rebooking)
    if (!b) return
    const { error } = await supabase.from("bookings").insert({
      customer_id: user.id,
      provider_id: b.provider_id,
      service_id: b.service_id,
      service_name: b.service_name,
      booking_date: rebookForm.date,
      booking_time: rebookForm.time,
      total_amount: b.total_amount,
      payment_method: b.payment_method,
      status: "pending",
      payment_status: "pending"
    })
    if (error) return toast.error(error.message)
    toast.success("Booking created!")
    setRebooking(null)
    load()
  }

  const filtered = filter==="all" ? bookings : bookings.filter(b=>b.status===filter)
  const inp = { width:"100%", background:"#111", border:"1px solid #222", borderRadius:8, padding:"10px 12px", color:"#f0ede6", fontSize:13, outline:"none", fontFamily:"'DM Sans',sans-serif" }

  return (
    <div>
      <div style={{ display:"flex", gap:6, marginBottom:"1rem", flexWrap:"wrap" }}>
        {["all","pending","confirmed","in-progress","completed","cancelled"].map(s=>(
          <button key={s} onClick={()=>setFilter(s)}
            style={{ padding:isMobile?"5px 10px":"6px 14px", borderRadius:6, border:"none", fontSize:isMobile?11:12, cursor:"pointer", background:filter===s?"#1a1208":"#111", color:filter===s?"#e6821e":"#666", fontFamily:"'DM Sans',sans-serif" }}>
            {s==="all"?"All":s.charAt(0).toUpperCase()+s.slice(1)}
          </button>
        ))}
      </div>

      {loading&&<div style={{ color:"#555", fontSize:13 }}>{t("loading")}</div>}
      {!loading&&filtered.length===0&&<div style={{ color:"#444", fontSize:13, textAlign:"center", padding:"2rem" }}>{t("noBookingsFound")}</div>}

      {filtered.map(b=>(
        <div key={b.id} style={{ background:"#111", border:`1px solid ${SB[b.status]||"#1e1e1e"}`, borderRadius:10, padding:isMobile?"0.75rem":"1rem", marginBottom:8 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
            <div style={{ flex:1, minWidth:0, marginRight:8 }}>
              <div style={{ fontSize:isMobile?13:14, fontWeight:500, color:"#f0ede6", marginBottom:2 }}>{b.service_name}</div>
              <div style={{ fontSize:11, color:"#555" }}>{b.booking_date} · {b.booking_time?.slice(0,5)}</div>
              {b.booking_number&&<div style={{ fontSize:10, color:"#444", marginTop:2 }}>#{b.booking_number}</div>}
            </div>
            <div style={{ textAlign:"right", flexShrink:0 }}>
              <span style={{ fontSize:10, fontWeight:500, padding:"2px 8px", borderRadius:20, background:SB[b.status]||"#111", color:SC[b.status]||"#888", border:`1px solid ${SC[b.status]||"#888"}40`, display:"inline-block" }}>{b.status}</span>
              <div style={{ fontFamily:"Syne", fontSize:isMobile?13:14, fontWeight:700, color:"#e6821e", marginTop:4 }}>${Number(b.total_amount).toFixed(2)}</div>
            </div>
          </div>

          <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
            {["pending","confirmed"].includes(b.status)&&(
              <button onClick={()=>cancelBooking(b.id)}
                style={{ background:"none", border:"1px solid #e24b4a40", borderRadius:7, color:"#e24b4a", fontSize:11, padding:"5px 10px", cursor:"pointer" }}>
                {t("cancelBooking")}
              </button>
            )}
            {b.status==="completed"&&(
              <>
                <button onClick={()=>navigate(`/dashboard/claims?booking=${b.id}`)}
                  style={{ background:"#1a0808", border:"1px solid #e24b4a30", borderRadius:7, color:"#e24b4a", fontSize:11, padding:"5px 10px", cursor:"pointer" }}>
                  🛡️ Service guarantee
                </button>
                <button onClick={()=>downloadBookingInvoice(b)} disabled={invoiceLoading===b.id}
                  style={{ background:"#071a12", border:"1px solid #1d9e7540", borderRadius:7, color:"#1d9e75", fontSize:11, padding:"5px 10px", cursor:"pointer" }}>
                  {invoiceLoading===b.id?"...":"⬇ Invoice"}
                </button>
                <button onClick={()=>{ setRebooking(b.id); setRebookForm({ date:"", time:"" }) }}
                style={{ background:"#1a1208", border:"1px solid #e6821e40", borderRadius:7, color:"#e6821e", fontSize:11, padding:"5px 10px", cursor:"pointer" }}>
                {t("rebookService")}
                </button>
              </>
              )}
            <button onClick={()=>setExpanded(expanded===b.id?null:b.id)}
              style={{ background:"none", border:"1px solid #333", borderRadius:7, color:"#666", fontSize:11, padding:"5px 10px", cursor:"pointer" }}>
              {expanded===b.id?t("less"):t("details")}
            </button>
          </div>

          {b.is_concierge&&b.driver_id&&(
            <div style={{ marginTop:10, background:"#0c1f2e", border:"1px solid #378add30", borderRadius:10, padding:"0.9rem" }}>
              <div style={{ fontFamily:"Syne", fontSize:12, fontWeight:700, color:"#378add", marginBottom:8 }}>🚗 Concierge delivery</div>
              {/* Driver info */}
              {b.driver_id&&(
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}
                  ref={el=>{ if(el&&!driverInfo[b.id]) loadDriverInfo(b.driver_id,b.id) }}>
                  <div style={{ width:32, height:32, borderRadius:"50%", background:"#071a12", border:"1px solid #1d9e7540", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"Syne", fontSize:12, fontWeight:800, color:"#1d9e75", flexShrink:0 }}>
                    {driverInfo[b.id]?.first_name?.[0]}{driverInfo[b.id]?.last_name?.[0]}
                  </div>
                  <div>
                    <div style={{ fontSize:12, color:"#f0ede6" }}>Driver: {driverInfo[b.id]?.first_name} {driverInfo[b.id]?.last_name}</div>
                    <div style={{ fontSize:10, color:"#555" }}>Concierge driver assigned</div>
                  </div>
                </div>
              )}
              {/* Concierge progress */}
              <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
                {[
                  { k:"accepted", l:"Assigned" },
                  { k:"pickup", l:"At pickup" },
                  { k:"in_transit", l:"To provider" },
                  { k:"at_provider", l:"At provider" },
                  { k:"return_transit", l:"Returning" },
                  { k:"dropoff", l:"At dropoff" },
                  { k:"completed", l:"Done" },
                ].map((step,i)=>{
                  const steps = ["accepted","pickup","in_transit","at_provider","return_transit","dropoff","completed"]
                  const currentIdx = steps.indexOf(b.concierge_status)
                  const isDone = i<=currentIdx
                  return (
                    <div key={step.k} style={{ fontSize:9, padding:"2px 7px", borderRadius:6, background:isDone?"#071a12":"#1a1a1a", color:isDone?"#1d9e75":"#333", border:`1px solid ${isDone?"#1d9e7530":"#222"}` }}>
                      {isDone?"✓ ":""}{step.l}
                    </div>
                  )
                })}
              </div>
              {/* Transport allowance */}
              {b.transport_allowance>0&&(
                <div style={{ fontSize:11, color:"#555", marginTop:8 }}>
                  🚌 Transport allowance: KES {Number(b.transport_allowance).toLocaleString()} included
                </div>
              )}
            </div>
          )}

          {b.parts_details?.length>0&&!b.parts_approved&&(
            <div style={{ marginTop:10, background:"#0c1f2e", border:"1px solid #378add40", borderRadius:10, padding:"0.9rem" }}>
              <div style={{ fontFamily:"Syne", fontSize:13, fontWeight:700, color:"#378add", marginBottom:8 }}>🔧 Parts added by provider</div>
              {b.parts_details.map((p,i)=>(
                <div key={i} style={{ display:"flex", justifyContent:"space-between", fontSize:12, padding:"4px 0", borderBottom:"1px solid #1a1a1a" }}>
                  <span style={{ color:"#888" }}>{p.name} × {p.quantity}</span>
                  <span style={{ color:"#f0ede6" }}>KES {p.total?.toLocaleString()}</span>
                </div>
              ))}
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:13, fontWeight:700, color:"#e6821e", marginTop:8 }}>
                <span>New total</span><span>KES {Number(b.updated_total||b.total_amount).toLocaleString()}</span>
              </div>
              <div style={{ display:"flex", gap:8, marginTop:10 }}>
                <button onClick={()=>approveParts(b)}
                  style={{ background:"#1d9e75", border:"none", borderRadius:8, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:12, fontWeight:700, padding:"8px 16px", cursor:"pointer" }}>
                  ✓ Approve parts
                </button>
                <button onClick={()=>cancelBooking(b.id)}
                  style={{ background:"none", border:"1px solid #e24b4a40", borderRadius:8, color:"#e24b4a", fontSize:12, padding:"8px 14px", cursor:"pointer" }}>
                  Decline & cancel
                </button>
              </div>
            </div>
          )}

          {expanded===b.id&&(
            <div style={{ marginTop:10, paddingTop:10, borderTop:"1px solid #1e1e1e" }}>
              <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr 1fr":"repeat(3,1fr)", gap:8 }}>
                {[
                  { l:t("paymentStatus"), v:b.payment_status },
                  { l:"Payment method", v:b.payment_method },
                  { l:b.is_concierge?"Concierge":"Service type", v:b.is_concierge?"Yes":"Standard" },
                ].map(f=>(
                  <div key={f.l}>
                    <div style={{ fontSize:10, color:"#555", textTransform:"uppercase", marginBottom:2 }}>{f.l}</div>
                    <div style={{ fontSize:12, color:"#f0ede6" }}>{f.v||"—"}</div>
                  </div>
                ))}
              </div>
              {b.notes&&<div style={{ fontSize:11, color:"#666", fontStyle:"italic", marginTop:8 }}>Note: "{b.notes}"</div>}
            </div>
          )}

          {rebooking===b.id&&(
            <div style={{ marginTop:10, background:"#0f0f0f", borderRadius:8, padding:"1rem", border:"1px solid #222" }}>
              <div style={{ fontFamily:"Syne", fontSize:13, fontWeight:700, marginBottom:10, color:"#f0ede6" }}>{t("rebookService")}</div>
              <form onSubmit={rebook}>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:10 }}>
                  <div>
                    <label style={{ fontSize:11, color:"#666", display:"block", marginBottom:4 }}>Date</label>
                    <input type="date" value={rebookForm.date} onChange={e=>setRebookForm(f=>({...f,date:e.target.value}))} required min={new Date().toISOString().split("T")[0]} style={inp}/>
                  </div>
                  <div>
                    <label style={{ fontSize:11, color:"#666", display:"block", marginBottom:4 }}>Time</label>
                    <select value={rebookForm.time} onChange={e=>setRebookForm(f=>({...f,time:e.target.value}))} required style={inp}>
                      <option value="">Select time</option>
                      {["07:00","08:00","09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00"].map(t2=><option key={t2} value={t2}>{t2}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{ display:"flex", gap:8 }}>
                  <button type="submit" style={{ background:"#e6821e", border:"none", borderRadius:7, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:12, fontWeight:700, padding:"8px 16px", cursor:"pointer" }}>{t("confirmBooking")}</button>
                  <button type="button" onClick={()=>setRebooking(null)} style={{ background:"none", border:"1px solid #333", borderRadius:7, color:"#888", fontSize:12, padding:"8px 16px", cursor:"pointer" }}>{t("cancel")}</button>
                </div>
              </form>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}













