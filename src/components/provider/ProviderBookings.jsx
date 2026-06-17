import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"
import { useAuth } from "../../contexts/AuthContext"
import { useLanguage } from "../../contexts/LanguageContext"
import useIsMobile from "../../lib/useIsMobile"
import toast from "react-hot-toast"
import { downloadInvoice } from "../../lib/invoice"
import VehicleConditionReport from "../shared/VehicleConditionReport"
import ProviderPartsManager from "./ProviderPartsManager"

const SC = { pending:"#e6821e", confirmed:"#378add", "in-progress":"#8b5cf6", completed:"#1d9e75", cancelled:"#e24b4a" }
const SB = { pending:"#fff8f0", confirmed:"#eff6ff", "in-progress":"#faf5ff", completed:"#f0fdf4", cancelled:"#fff5f5" }
const CATEGORIES = {
  shop_standard: { label:"Shop Standard", icon:"🏪", color:"#378add" },
  shop_premium: { label:"Shop Premium", icon:"🏡", color:"#8b5cf6" },
  go_service: { label:"GO Service", icon:"🚨", color:"#e24b4a" },
}

export default function ProviderBookings() {
  const { user } = useAuth()
  const { t, language } = useLanguage()
  const isMobile = useIsMobile()
  const [bookings, setBookings] = useState([])
  const [mechanics, setMechanics] = useState([])
  const [filter, setFilter] = useState("all")
  const [loading, setLoading] = useState(true)
  const [partsRequests, setPartsRequests] = useState([])
  const [expanded, setExpanded] = useState(null)
  const [assigningMechanic, setAssigningMechanic] = useState(null)
  const [showReport, setShowReport] = useState(null)
  const [reportType, setReportType] = useState("pickup")
  const [existingReports, setExistingReports] = useState({})
  const [selectedMechanic, setSelectedMechanic] = useState("")
  const [showParts, setShowParts] = useState(null)

  useEffect(() => {
    if (!user) return
    load()
    loadPartsRequests()
    const sub = supabase.channel("provider-bookings-live")
      .on("postgres_changes", { event:"*", schema:"public", table:"bookings", filter:`provider_id=eq.${user.id}` }, () => { load(); toast("Booking updated", { icon:"📋" }) })
      .subscribe()
    return () => supabase.removeChannel(sub)
  }, [user])

  async function loadPartsRequests() {
    const { data } = await supabase.from("mechanic_parts_requests")
      .select("*, mechanics(first_name,last_name,specialization), bookings(id,service_name,booking_date)")
      .eq("provider_id", user.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
    setPartsRequests(data||[])
  }

  async function updatePartsStatus(id, status) {
    await supabase.from("mechanic_parts_requests").update({ status }).eq("id", id)
    loadPartsRequests()
    toast.success("Parts request " + status)
  }

  async function load() {
    const [{ data: bks }, { data: mechs }] = await Promise.all([
      supabase.from("bookings").select("*").eq("provider_id", user.id).order("created_at",{ascending:false}),
      supabase.from("mechanics").select("*").eq("provider_id", user.id).eq("is_active", true).eq("is_available", true),
    ])
    setBookings(bks||[])
    setMechanics(mechs||[])

    if (bks?.length) {
      const premiumGoBookings = bks.filter(b=>b.service_category==="shop_premium"||b.service_category==="go_service")
      if (premiumGoBookings.length) {
        const ids = premiumGoBookings.map(b=>b.id)
        const { data: reps } = await supabase.from("vehicle_condition_reports").select("booking_id,report_type").in("booking_id", ids)
        const repMap = {}
        reps?.forEach(r => {
          if (!repMap[r.booking_id]) repMap[r.booking_id] = {}
          repMap[r.booking_id][r.report_type] = true
        })
        setExistingReports(repMap)
      }
    }
    setLoading(false)
  }

  async function updateStatus(id, status) {
    const { error } = await supabase.from("bookings").update({ status }).eq("id",id).eq("provider_id",user.id)
    if (error) return toast.error(error.message)
    toast.success(`Booking ${status}`)
    load()
  }

  async function assignMechanic(bookingId) {
    if (!selectedMechanic && mechanics.length > 0) return toast.error("Please select a mechanic")
    try {
      await supabase.from("bookings").update({ assigned_mechanic_id: selectedMechanic||null, status:"in-progress" }).eq("id", bookingId).eq("provider_id", user.id)
      if (selectedMechanic) {
        await supabase.from("mechanics").update({ is_available:false, current_booking_id:bookingId }).eq("id", selectedMechanic)
      }
      toast.success("Mechanic assigned — customer notified! 👨‍🔧")
      setAssigningMechanic(null)
      setSelectedMechanic("")
      load()
    } catch(err) { toast.error(err.message) }
  }

  async function markPaid(id) {
    const { error } = await supabase.from("bookings").update({ payment_status:"paid" }).eq("id",id).eq("provider_id",user.id)
    if (error) return toast.error(error.message)
    toast.success("Marked as paid")
    load()
  }

  async function completeAndFreeMechanic(bookingId, mechanicId) {
    const booking = bookings.find(b=>b.id===bookingId)
    await supabase.from("bookings").update({ status:"completed" }).eq("id",bookingId).eq("provider_id",user.id)
    if (mechanicId) {
      await supabase.from("mechanics").update({ is_available:true, current_booking_id:null, current_latitude:null, current_longitude:null }).eq("id",mechanicId)
    }
    // Auto notify customer to leave review + pay
    if (booking?.customer_id) {
      await supabase.from("notifications").insert([
        {
          user_id: booking.customer_id,
          title: "Service completed! How was it? Γ¡É",
          message: "Your "+booking.service_name+" has been completed! Please go to My Bookings → tap the booking → Leave a Review. Your feedback helps other customers and earns you 50 bonus loyalty points!",
          type: "success"
        },
        {
          user_id: booking.customer_id,
          title: "Payment reminder 💳",
          message: "Please complete payment for your "+booking.service_name+" service. Amount: KES "+Number(booking.updated_total||booking.total_amount).toLocaleString(),
          type: "info"
        }
      ])
    }
    toast.success("Booking completed — customer notified!")
    load()
  }

  async function downloadBookingInvoice(booking) {
    try {
      const [{ data: provider }, { data: customer }, { data: mechanic }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", booking.provider_id).single(),
        supabase.from("profiles").select("*").eq("id", booking.customer_id).single(),
        booking.assigned_mechanic_id ? supabase.from("mechanics").select("*").eq("id", booking.assigned_mechanic_id).single() : Promise.resolve({ data:null }),
      ])
      downloadInvoice(booking, provider, customer, mechanic, null)
      toast.success("Invoice downloaded")
    } catch(err) { toast.error("Could not generate invoice") }
  }

  const filtered = filter==="all" ? bookings : bookings.filter(b=>b.status===filter)

  if (showReport) return (
    <div>
      <button onClick={()=>setShowReport(null)} style={{ background:"none", border:"none", color:"#378add", cursor:"pointer", fontSize:13, marginBottom:"1rem", fontFamily:"DM Sans,sans-serif", padding:0 }}>
        ΓåÉ Back to bookings
      </button>
      <VehicleConditionReport
        bookingId={showReport}
        reportType={reportType}
        onComplete={()=>{ setShowReport(null); load() }}
      />
    </div>
  )

  return (
    <div>
      <div style={{ display:"grid", gridTemplateColumns:isMobile?"repeat(2,1fr)":"repeat(4,1fr)", gap:10, marginBottom:"1.25rem" }}>
        {[
          { label:t("pending"), value:bookings.filter(b=>b.status==="pending").length, color:"#e6821e" },
          { label:"Confirmed", value:bookings.filter(b=>b.status==="confirmed").length, color:"#378add" },
          { label:"In progress", value:bookings.filter(b=>b.status==="in-progress").length, color:"#8b5cf6" },
          { label:t("completed"), value:bookings.filter(b=>b.status==="completed").length, color:"#1d9e75" },
        ].map(s=>(
          <div key={s.label} style={{ background:"#ffffff", borderRadius:10, padding:isMobile?"0.75rem":"1rem", border:"1px solid #eeeeee" }}>
            <div style={{ fontSize:10, color:"#777777", textTransform:"uppercase", marginBottom:4 }}>{s.label}</div>
            <div style={{ fontFamily:"Syne", fontSize:isMobile?16:20, fontWeight:800, color:s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display:"flex", gap:6, marginBottom:"1rem", flexWrap:"wrap" }}>
        {["all","pending","confirmed","in-progress","completed","cancelled"].map(s=>(
          <button key={s} onClick={()=>setFilter(s)}
            style={{ padding:isMobile?"5px 10px":"6px 14px", borderRadius:6, border:"none", fontSize:isMobile?11:12, cursor:"pointer", background:filter===s?"#378add":"#555555", color:filter===s?"#fff":"#666", fontFamily:"'DM Sans',sans-serif" }}>
            {s==="all"?"All":s.charAt(0).toUpperCase()+s.slice(1)}
          </button>
        ))}
      </div>

      {/* Parts requests banner */}
      {partsRequests.length>0&&(
        <div style={{ background:"#fff8f0", border:"1px solid #e6821e40", borderRadius:10, padding:"0.75rem", marginBottom:"1rem" }}>
          <div style={{ fontFamily:"Syne", fontSize:13, fontWeight:700, color:"#e6821e", marginBottom:8 }}>🔩 Mechanic Parts Requests ({partsRequests.length})</div>
          {partsRequests.map(pr=>(
            <div key={pr.id} style={{ background:"#ffffff", borderRadius:8, padding:"0.75rem", marginBottom:6, border:"1px solid #eeeeee" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:4 }}>
                <div>
                  <div style={{ fontSize:13, fontWeight:700, color:"#000" }}>{pr.quantity}x {pr.part_name}</div>
                  <div style={{ fontSize:11, color:"#555" }}>From: {pr.mechanics?.first_name} {pr.mechanics?.last_name}</div>
                  <div style={{ fontSize:11, color:"#888" }}>Booking: #{pr.booking_id?.slice(0,8)}</div>
                  {pr.notes&&<div style={{ fontSize:11, color:"#666", marginTop:2 }}>Note: {pr.notes}</div>}
                </div>
                <span style={{ fontSize:10, padding:"2px 8px", borderRadius:8, fontWeight:700,
                  background:pr.urgency==="critical"?"#fff5f5":pr.urgency==="urgent"?"#fff8f0":"#f8f8f8",
                  color:pr.urgency==="critical"?"#e24b4a":pr.urgency==="urgent"?"#e6821e":"#888" }}>
                  {pr.urgency}
                </span>
              </div>
              <div style={{ display:"flex", gap:6 }}>
                <button onClick={()=>updatePartsStatus(pr.id,"approved")}
                  style={{ background:"#f0fdf4", border:"1px solid #1d9e7540", borderRadius:6, color:"#1d9e75", fontSize:10, fontWeight:700, padding:"4px 10px", cursor:"pointer" }}>
                  ✓ Approve
                </button>
                <button onClick={()=>updatePartsStatus(pr.id,"rejected")}
                  style={{ background:"#fff5f5", border:"1px solid #e24b4a40", borderRadius:6, color:"#e24b4a", fontSize:10, fontWeight:700, padding:"4px 10px", cursor:"pointer" }}>
                  ✗ Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}


      {loading&&<div style={{ color:"#777777", fontSize:13 }}>{t("loading")}</div>}
      {!loading&&filtered.length===0&&<div style={{ color:"#888888", fontSize:13, textAlign:"center", padding:"2rem" }}>No bookings found</div>}

      {filtered.map(b=>{
        const cat = CATEGORIES[b.service_category]||CATEGORIES.shop_standard
        const reports = existingReports[b.id]||{}
        return (
          <div key={b.id} style={{ background:"#ffffff", border:`1px solid ${SB[b.status]||"#eeeeee"}`, borderRadius:10, padding:isMobile?"0.75rem":"1rem", marginBottom:8 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
              <div style={{ flex:1, minWidth:0, marginRight:8 }}>
                <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:4, flexWrap:"wrap" }}>
                  <span style={{ fontSize:14 }}>{cat.icon}</span>
                  <div style={{ fontSize:isMobile?13:14, fontWeight:500, color:"#000000" }}>{b.service_name}</div>
                  <span style={{ fontSize:10, padding:"1px 7px", borderRadius:10, background:`${cat.color}20`, color:cat.color }}>{cat.label}</span>
                </div>
                <div style={{ fontSize:11, color:"#777777" }}>{b.booking_date} · {b.booking_time?.slice(0,5)}</div>
                {b.booking_number&&<div style={{ fontSize:10, color:"#888888", marginTop:2 }}>#{b.booking_number}</div>}
                {b.problem_description&&<div style={{ fontSize:11, color:"#555555", marginTop:4, fontStyle:"italic" }}>"{b.problem_description}"</div>}
                {b.assigned_mechanic_id&&<div style={{ fontSize:11, color:"#1d9e75", marginTop:2 }}>👨‍🔧 Mechanic assigned</div>}
                {b.parts_details?.length>0&&(
                  <div style={{ fontSize:11, color:b.parts_approved?"#1d9e75":"#e6821e", marginTop:2 }}>
                    🔧 Parts: {b.parts_details.length} item{b.parts_details.length!==1?"s":""} · {b.parts_approved?"✓ Approved":"Awaiting approval"}
                  </div>
                )}
              </div>
              <div style={{ textAlign:"right", flexShrink:0 }}>
                <span style={{ fontSize:10, fontWeight:500, padding:"2px 8px", borderRadius:20, background:SB[b.status]||"#555555", color:SC[b.status]||"#888", border:`1px solid ${SC[b.status]||"#888"}40`, display:"inline-block" }}>{b.status}</span>
                <div style={{ fontFamily:"Syne", fontSize:13, fontWeight:700, color:"#e6821e", marginTop:4 }}>
                  KES {Number(b.updated_total||b.total_amount).toLocaleString()}
                </div>
              </div>
            </div>

            <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
              {b.status==="pending"&&<>
                <button onClick={()=>updateStatus(b.id,"confirmed")} style={{ background:"#f0fdf4", border:"1px solid #1d9e7540", borderRadius:7, color:"#1d9e75", fontSize:11, padding:"5px 10px", cursor:"pointer" }}>Confirm</button>
                <button onClick={()=>updateStatus(b.id,"cancelled")} style={{ background:"none", border:"1px solid #e24b4a40", borderRadius:7, color:"#e24b4a", fontSize:11, padding:"5px 10px", cursor:"pointer" }}>Decline</button>
              </>}

              {b.status==="confirmed"&&<>
                <button onClick={()=>{ setAssigningMechanic(b.id); setSelectedMechanic("") }}
                  style={{ background:"#faf5ff", border:"1px solid #8b5cf640", borderRadius:7, color:"#8b5cf6", fontSize:11, padding:"5px 10px", cursor:"pointer" }}>
                  👨‍🔧 Assign mechanic
                </button>
                <button onClick={()=>updateStatus(b.id,"in-progress")}
                  style={{ background:"#f0fdf4", border:"1px solid #1d9e7540", borderRadius:7, color:"#1d9e75", fontSize:11, padding:"5px 10px", cursor:"pointer" }}>
                  Start
                </button>
              </>}

              {b.status==="in-progress"&&(
                <button onClick={()=>completeAndFreeMechanic(b.id, b.assigned_mechanic_id)}
                  style={{ background:"#f0fdf4", border:"1px solid #1d9e7540", borderRadius:7, color:"#1d9e75", fontSize:11, padding:"5px 10px", cursor:"pointer" }}>
                  ✓ Complete
                </button>
              )}

              {(b.service_category==="shop_premium"||b.service_category==="go_service")&&b.assigned_mechanic_id&&<>
                {!reports.pickup&&(
                  <button onClick={()=>{ setShowReport(b.id); setReportType("pickup") }}
                    style={{ background:"#eff6ff", border:"1px solid #378add40", borderRadius:7, color:"#378add", fontSize:11, padding:"5px 10px", cursor:"pointer" }}>
                    📋 Pickup report
                  </button>
                )}
                {reports.pickup&&!reports.dropoff&&(
                  <button onClick={()=>{ setShowReport(b.id); setReportType("dropoff") }}
                    style={{ background:"#f0fdf4", border:"1px solid #1d9e7540", borderRadius:7, color:"#1d9e75", fontSize:11, padding:"5px 10px", cursor:"pointer" }}>
                    📋 Dropoff report
                  </button>
                )}
              </>}

              {["confirmed","in-progress"].includes(b.status)&&(
                <button onClick={()=>setShowParts(showParts===b.id?null:b.id)}
                  style={{ background:"#eff6ff", border:"1px solid #378add40", borderRadius:7, color:"#378add", fontSize:11, padding:"5px 10px", cursor:"pointer" }}>
                  🔧 {b.parts_details?.length>0?"Edit parts":"Add parts"}
                </button>
              )}

              {b.status==="completed"&&(
                <button onClick={()=>downloadBookingInvoice(b)}
                  style={{ background:"#f0fdf4", border:"1px solid #1d9e7540", borderRadius:7, color:"#1d9e75", fontSize:11, padding:"5px 10px", cursor:"pointer" }}>
                  Γ¼ç Invoice
                </button>
              )}

              {b.status==="completed"&&b.payment_status!=="paid"&&(
                <button onClick={()=>markPaid(b.id)}
                  style={{ background:"#fff8f0", border:"1px solid #e6821e40", borderRadius:7, color:"#e6821e", fontSize:11, padding:"5px 10px", cursor:"pointer" }}>
                  Mark paid
                </button>
              )}

              <button onClick={()=>setExpanded(expanded===b.id?null:b.id)}
                style={{ background:"none", border:"1px solid #dddddd", borderRadius:7, color:"#666", fontSize:11, padding:"5px 10px", cursor:"pointer" }}>
                {expanded===b.id?"Less":"Details"}
              </button>
            </div>

            {/* Assign mechanic panel */}
            {assigningMechanic===b.id&&(
              <div style={{ marginTop:10, background:"#faf5ff", border:"1px solid #8b5cf630", borderRadius:10, padding:"1rem" }}>
                <div style={{ fontFamily:"Syne", fontSize:13, fontWeight:700, color:"#8b5cf6", marginBottom:8 }}>Assign mechanic</div>
                {mechanics.length===0?(
                  <div style={{ fontSize:12, color:"#777777", marginBottom:8 }}>No available mechanics.</div>
                ):(
                  <div style={{ marginBottom:10 }}>
                    {mechanics.map(m=>(
                      <div key={m.id} onClick={()=>setSelectedMechanic(m.id)}
                        style={{ display:"flex", alignItems:"center", gap:10, padding:"8px", borderRadius:8, cursor:"pointer", background:selectedMechanic===m.id?"#faf5ff":"transparent", border:`1px solid ${selectedMechanic===m.id?"#8b5cf6":"transparent"}`, marginBottom:4 }}>
                        <div style={{ width:32, height:32, borderRadius:"50%", background:"#f0fdf4", border:"1px solid #1d9e7540", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"Syne", fontSize:12, fontWeight:800, color:"#1d9e75", flexShrink:0 }}>
                          {m.first_name[0]}{m.last_name[0]}
                        </div>
                        <div>
                          <div style={{ fontSize:12, color:"#000000" }}>{m.first_name} {m.last_name}</div>
                          <div style={{ fontSize:10, color:"#777777" }}>{m.specialization}</div>
                        </div>
                        {selectedMechanic===m.id&&<div style={{ marginLeft:"auto", fontSize:14, color:"#8b5cf6" }}>✓</div>}
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ display:"flex", gap:8 }}>
                  <button onClick={()=>assignMechanic(b.id)} disabled={mechanics.length>0&&!selectedMechanic}
                    style={{ background:mechanics.length>0&&!selectedMechanic?"#555555":"#8b5cf6", border:"none", borderRadius:8, color:mechanics.length>0&&!selectedMechanic?"#555":"#fff", fontFamily:"Syne,sans-serif", fontSize:12, fontWeight:700, padding:"8px 16px", cursor:mechanics.length>0&&!selectedMechanic?"not-allowed":"pointer" }}>
                    Assign & notify customer
                  </button>
                  <button onClick={()=>{ setAssigningMechanic(null); setSelectedMechanic("") }}
                    style={{ background:"none", border:"1px solid #dddddd", borderRadius:8, color:"#666", fontSize:12, padding:"8px 14px", cursor:"pointer" }}>
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Parts manager */}
            {showParts===b.id&&(
              <ProviderPartsManager booking={b} onUpdate={()=>{ setShowParts(null); load() }}/>
            )}

            {/* Expanded details */}
            {expanded===b.id&&(
              <div style={{ marginTop:10, paddingTop:10, borderTop:"1px solid #eeeeee" }}>
                <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr 1fr":"repeat(3,1fr)", gap:8, marginBottom:8 }}>
                  {[
                    { l:"Your earnings", v:`KES ${Number(b.provider_earnings||0).toFixed(0)}`, c:"#1d9e75" },
                    { l:"Platform fee", v:`KES ${Number(b.platform_commission||0).toFixed(0)}` },
                    { l:"Payment", v:b.payment_status },
                    { l:"Method", v:b.payment_method },
                    { l:"Category", v:cat.label },
                    { l:"Concierge", v:b.is_concierge?"Yes":"No" },
                  ].map(f=>(
                    <div key={f.l}>
                      <div style={{ fontSize:10, color:"#777777", textTransform:"uppercase", marginBottom:2 }}>{f.l}</div>
                      <div style={{ fontSize:12, color:f.c||"#000000" }}>{f.v||"—"}</div>
                    </div>
                  ))}
                </div>
                {b.parts_details?.length>0&&(
                  <div style={{ marginTop:8 }}>
                    <div style={{ fontSize:11, color:"#378add", marginBottom:4 }}>Parts breakdown:</div>
                    {b.parts_details.map((p,i)=>(
                      <div key={i} style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:"#666", padding:"3px 0" }}>
                        <span>{p.name} × {p.quantity}</span>
                        <span>KES {p.total?.toLocaleString()}</span>
                      </div>
                    ))}
                    <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:"#e6821e", marginTop:4, fontWeight:600 }}>
                      <span>Parts total</span>
                      <span>KES {Number(b.parts_cost||0).toLocaleString()}</span>
                    </div>
                  </div>
                )}
                {b.notes&&<div style={{ fontSize:11, color:"#666", fontStyle:"italic", marginTop:8 }}>Note: "{b.notes}"</div>}
                {b.problem_description&&<div style={{ fontSize:11, color:"#555555", fontStyle:"italic", marginTop:4 }}>Problem: "{b.problem_description}"</div>}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}




