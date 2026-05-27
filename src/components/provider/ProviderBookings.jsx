import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"
import { useAuth } from "../../contexts/AuthContext"
import { useLanguage } from "../../contexts/LanguageContext"
import useIsMobile from "../../lib/useIsMobile"
import toast from "react-hot-toast"

const SC = { pending:"#e6821e", confirmed:"#378add", "in-progress":"#8b5cf6", completed:"#1d9e75", cancelled:"#e24b4a" }
const SB = { pending:"#1a1208", confirmed:"#0c1f2e", "in-progress":"#160a2e", completed:"#071a12", cancelled:"#1a0808" }

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
  const [expanded, setExpanded] = useState(null)
  const [assigningMechanic, setAssigningMechanic] = useState(null)
  const [selectedMechanic, setSelectedMechanic] = useState("")

  useEffect(() => {
    if (!user) return
    load()
    const sub = supabase.channel("provider-bookings-live")
      .on("postgres_changes", { event:"*", schema:"public", table:"bookings", filter:`provider_id=eq.${user.id}` }, () => { load(); toast("Booking updated", { icon:"📋" }) })
      .subscribe()
    return () => supabase.removeChannel(sub)
  }, [user])

  async function load() {
    const [{ data: bks }, { data: mechs }] = await Promise.all([
      supabase.from("bookings").select("*").eq("provider_id", user.id).order("created_at",{ascending:false}),
      supabase.from("mechanics").select("*").eq("provider_id", user.id).eq("is_active", true).eq("is_available", true),
    ])
    setBookings(bks||[])
    setMechanics(mechs||[])
    setLoading(false)
  }

  async function updateStatus(id, status) {
    const { error } = await supabase.from("bookings").update({ status }).eq("id",id).eq("provider_id",user.id)
    if (error) return toast.error(error.message)
    toast.success(`Booking ${status}`)
    load()
  }

  async function assignMechanic(bookingId) {
    if (!selectedMechanic) return toast.error("Please select a mechanic")
    const { error } = await supabase.from("bookings")
      .update({ assigned_mechanic_id: selectedMechanic, status:"in-progress" })
      .eq("id", bookingId)
      .eq("provider_id", user.id)
    if (error) return toast.error(error.message)

    await supabase.from("mechanics").update({ is_available:false, current_booking_id:bookingId }).eq("id", selectedMechanic)

    toast.success("Mechanic assigned — customer notified! 👨‍🔧")
    setAssigningMechanic(null)
    setSelectedMechanic("")
    load()
  }

  async function markPaid(id) {
    const { error } = await supabase.from("bookings").update({ payment_status:"paid" }).eq("id",id).eq("provider_id",user.id)
    if (error) return toast.error(error.message)
    toast.success("Marked as paid")
    load()
  }

  async function completeAndFreeMechanic(bookingId, mechanicId) {
    await supabase.from("bookings").update({ status:"completed" }).eq("id",bookingId).eq("provider_id",user.id)
    if (mechanicId) {
      await supabase.from("mechanics").update({ is_available:true, current_booking_id:null, current_latitude:null, current_longitude:null }).eq("id",mechanicId)
    }
    toast.success("Booking completed — mechanic freed")
    load()
  }

  const filtered = filter==="all" ? bookings : bookings.filter(b=>b.status===filter)

  return (
    <div>
      <div style={{ display:"grid", gridTemplateColumns:isMobile?"repeat(2,1fr)":"repeat(4,1fr)", gap:10, marginBottom:"1.25rem" }}>
        {[
          { label:t("pending"), value:bookings.filter(b=>b.status==="pending").length, color:"#e6821e" },
          { label:"Confirmed", value:bookings.filter(b=>b.status==="confirmed").length, color:"#378add" },
          { label:"In progress", value:bookings.filter(b=>b.status==="in-progress").length, color:"#8b5cf6" },
          { label:t("completed"), value:bookings.filter(b=>b.status==="completed").length, color:"#1d9e75" },
        ].map(s=>(
          <div key={s.label} style={{ background:"#111", borderRadius:10, padding:isMobile?"0.75rem":"1rem", border:"1px solid #1e1e1e" }}>
            <div style={{ fontSize:10, color:"#555", textTransform:"uppercase", marginBottom:4 }}>{s.label}</div>
            <div style={{ fontFamily:"Syne", fontSize:isMobile?16:20, fontWeight:800, color:s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display:"flex", gap:6, marginBottom:"1rem", flexWrap:"wrap" }}>
        {["all","pending","confirmed","in-progress","completed","cancelled"].map(s=>(
          <button key={s} onClick={()=>setFilter(s)}
            style={{ padding:isMobile?"5px 10px":"6px 14px", borderRadius:6, border:"none", fontSize:isMobile?11:12, cursor:"pointer", background:filter===s?"#378add":"#111", color:filter===s?"#fff":"#666", fontFamily:"'DM Sans',sans-serif" }}>
            {s==="all"?"All":s.charAt(0).toUpperCase()+s.slice(1)}
          </button>
        ))}
      </div>

      {loading&&<div style={{ color:"#555", fontSize:13 }}>{t("loading")}</div>}
      {!loading&&filtered.length===0&&<div style={{ color:"#444", fontSize:13, textAlign:"center", padding:"2rem" }}>No bookings found</div>}

      {filtered.map(b=>{
        const cat = CATEGORIES[b.service_category]||CATEGORIES.shop_standard
        return (
          <div key={b.id} style={{ background:"#111", border:`1px solid ${SB[b.status]||"#1e1e1e"}`, borderRadius:10, padding:isMobile?"0.75rem":"1rem", marginBottom:8 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
              <div style={{ flex:1, minWidth:0, marginRight:8 }}>
                <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:4, flexWrap:"wrap" }}>
                  <span style={{ fontSize:14 }}>{cat.icon}</span>
                  <div style={{ fontSize:isMobile?13:14, fontWeight:500, color:"#f0ede6" }}>{b.service_name}</div>
                  <span style={{ fontSize:10, padding:"1px 7px", borderRadius:10, background:`${cat.color}20`, color:cat.color }}>{cat.label}</span>
                </div>
                <div style={{ fontSize:11, color:"#555" }}>{b.booking_date} · {b.booking_time?.slice(0,5)}</div>
                {b.booking_number&&<div style={{ fontSize:10, color:"#444", marginTop:2 }}>#{b.booking_number}</div>}
                {b.assigned_mechanic_id&&(
                  <div style={{ fontSize:11, color:"#1d9e75", marginTop:4 }}>
                    👨‍🔧 Mechanic assigned
                  </div>
                )}
              </div>
              <div style={{ textAlign:"right", flexShrink:0 }}>
                <span style={{ fontSize:10, fontWeight:500, padding:"2px 8px", borderRadius:20, background:SB[b.status]||"#111", color:SC[b.status]||"#888", border:`1px solid ${SC[b.status]||"#888"}40`, display:"inline-block" }}>{b.status}</span>
                <div style={{ fontFamily:"Syne", fontSize:13, fontWeight:700, color:"#e6821e", marginTop:4 }}>KES {Number(b.total_amount).toLocaleString()}</div>
              </div>
            </div>

            <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
              {b.status==="pending"&&<>
                <button onClick={()=>updateStatus(b.id,"confirmed")} style={{ background:"#071a12", border:"1px solid #1d9e7540", borderRadius:7, color:"#1d9e75", fontSize:11, padding:"5px 10px", cursor:"pointer" }}>Confirm</button>
                <button onClick={()=>updateStatus(b.id,"cancelled")} style={{ background:"none", border:"1px solid #e24b4a40", borderRadius:7, color:"#e24b4a", fontSize:11, padding:"5px 10px", cursor:"pointer" }}>Decline</button>
              </>}

              {b.status==="confirmed"&&(
                <>
                  <button onClick={()=>{ setAssigningMechanic(b.id); setSelectedMechanic("") }}
                    style={{ background:"#160a2e", border:"1px solid #8b5cf640", borderRadius:7, color:"#8b5cf6", fontSize:11, padding:"5px 10px", cursor:"pointer" }}>
                    👨‍🔧 Assign mechanic
                  </button>
                  <button onClick={()=>updateStatus(b.id,"in-progress")} style={{ background:"#071a12", border:"1px solid #1d9e7540", borderRadius:7, color:"#1d9e75", fontSize:11, padding:"5px 10px", cursor:"pointer" }}>Start without mechanic</button>
                </>
              )}

              {b.status==="in-progress"&&(
                <button onClick={()=>completeAndFreeMechanic(b.id, b.assigned_mechanic_id)}
                  style={{ background:"#071a12", border:"1px solid #1d9e7540", borderRadius:7, color:"#1d9e75", fontSize:11, padding:"5px 10px", cursor:"pointer" }}>
                  ✓ Complete booking
                </button>
              )}

              {b.status==="completed"&&b.payment_status!=="paid"&&(
                <button onClick={()=>markPaid(b.id)} style={{ background:"#1a1208", border:"1px solid #e6821e40", borderRadius:7, color:"#e6821e", fontSize:11, padding:"5px 10px", cursor:"pointer" }}>Mark paid</button>
              )}

              <button onClick={()=>setExpanded(expanded===b.id?null:b.id)}
                style={{ background:"none", border:"1px solid #333", borderRadius:7, color:"#666", fontSize:11, padding:"5px 10px", cursor:"pointer" }}>
                {expanded===b.id?"Less":"Details"}
              </button>
            </div>

            {/* Assign mechanic panel */}
            {assigningMechanic===b.id&&(
              <div style={{ marginTop:10, background:"#160a2e", border:"1px solid #8b5cf630", borderRadius:10, padding:"1rem" }}>
                <div style={{ fontFamily:"Syne", fontSize:13, fontWeight:700, color:"#8b5cf6", marginBottom:8 }}>Assign mechanic</div>
                {mechanics.length===0?(
                  <div style={{ fontSize:12, color:"#555", marginBottom:8 }}>No available mechanics. Go to My Mechanics to update availability.</div>
                ):(
                  <div style={{ marginBottom:10 }}>
                    {mechanics.map(m=>(
                      <div key={m.id} onClick={()=>setSelectedMechanic(m.id)}
                        style={{ display:"flex", alignItems:"center", gap:10, padding:"8px", borderRadius:8, cursor:"pointer", background:selectedMechanic===m.id?"#1e0a3e":"transparent", border:`1px solid ${selectedMechanic===m.id?"#8b5cf6":"transparent"}`, marginBottom:4 }}>
                        <div style={{ width:32, height:32, borderRadius:"50%", background:"#071a12", border:"1px solid #1d9e7540", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"Syne", fontSize:12, fontWeight:800, color:"#1d9e75", flexShrink:0 }}>
                          {m.first_name[0]}{m.last_name[0]}
                        </div>
                        <div>
                          <div style={{ fontSize:12, fontWeight:600, color:"#f0ede6" }}>{m.first_name} {m.last_name}</div>
                          <div style={{ fontSize:10, color:"#555" }}>🔧 {m.specialization}</div>
                        </div>
                        {selectedMechanic===m.id&&<div style={{ marginLeft:"auto", fontSize:14, color:"#8b5cf6" }}>✓</div>}
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ display:"flex", gap:8 }}>
                  <button onClick={()=>assignMechanic(b.id)} disabled={!selectedMechanic}
                    style={{ background:selectedMechanic?"#8b5cf6":"#333", border:"none", borderRadius:8, color:selectedMechanic?"#fff":"#555", fontFamily:"Syne,sans-serif", fontSize:12, fontWeight:700, padding:"8px 16px", cursor:selectedMechanic?"pointer":"not-allowed" }}>
                    Assign & notify customer
                  </button>
                  <button onClick={()=>{ setAssigningMechanic(null); setSelectedMechanic("") }}
                    style={{ background:"none", border:"1px solid #333", borderRadius:8, color:"#666", fontSize:12, padding:"8px 14px", cursor:"pointer" }}>
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {expanded===b.id&&(
              <div style={{ marginTop:10, paddingTop:10, borderTop:"1px solid #1e1e1e" }}>
                <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr 1fr":"repeat(3,1fr)", gap:8 }}>
                  {[
                    { l:"Your earnings", v:`KES ${Number(b.provider_earnings||0).toFixed(0)}`, c:"#1d9e75" },
                    { l:"Platform fee", v:`KES ${Number(b.platform_commission||0).toFixed(0)}` },
                    { l:"Payment", v:b.payment_status },
                    { l:"Method", v:b.payment_method },
                    { l:"Category", v:cat.label },
                    { l:"Concierge", v:b.is_concierge?"Yes":"No" },
                  ].map(f=>(
                    <div key={f.l}>
                      <div style={{ fontSize:10, color:"#555", textTransform:"uppercase", marginBottom:2 }}>{f.l}</div>
                      <div style={{ fontSize:12, color:f.c||"#f0ede6" }}>{f.v||"—"}</div>
                    </div>
                  ))}
                </div>
                {b.notes&&<div style={{ fontSize:11, color:"#666", fontStyle:"italic", marginTop:8 }}>Note: "{b.notes}"</div>}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
