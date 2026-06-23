import useIsMobile from "../../lib/useIsMobile"
import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"
import toast from "react-hot-toast"

const SC = { pending:"#e6821e", confirmed:"#378add", "in-progress":"#8b5cf6", completed:"#1d9e75", cancelled:"#e24b4a" }
const SB = { pending:"#fff8f0", confirmed:"#eff6ff", "in-progress":"#f5f3ff", completed:"#f0fdf4", cancelled:"#fff5f5" }
const PC = { paid:"#1d9e75", pending:"#e6821e", partial:"#378add", refunded:"#8b5cf6" }

export default function AdminBookings() {
  const isMobile = useIsMobile()
  const [bookings, setBookings] = useState([])
  const [filter, setFilter] = useState("all")
  const [payFilter, setPayFilter] = useState("all")
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(null)
  const [updating, setUpdating] = useState(null)

  useEffect(() => {
    load()
    const sub = supabase.channel("admin-bookings-page")
      .on("postgres_changes", { event:"*", schema:"public", table:"bookings" }, () => load())
      .subscribe()
    return () => supabase.removeChannel(sub)
  }, [])

  async function load() {
    const { data: bks } = await supabase.from("bookings").select("*").order("created_at", { ascending:false })
    if (!bks?.length) { setBookings([]); setLoading(false); return }
    const userIds = [...new Set([...bks.map(b=>b.customer_id), ...bks.map(b=>b.provider_id)].filter(Boolean))]
    const { data: profs } = await supabase.from("profiles").select("id,first_name,last_name,business_name,phone").in("id", userIds)
    const profMap = {}
    profs?.forEach(p => { profMap[p.id] = p })
    setBookings(bks.map(b => ({...b, customer:profMap[b.customer_id]||null, provider:profMap[b.provider_id]||null})))
    setLoading(false)
  }

  async function updateStatus(id, status) {
    setUpdating(id)
    await supabase.from("bookings").update({ status }).eq("id", id)
    toast.success(`Booking ${status}`)
    load()
    setUpdating(null)
  }

  async function updatePayment(id, payment_status) {
    setUpdating(id)
    await supabase.from("bookings").update({ payment_status }).eq("id", id)
    toast.success(`Payment marked as ${payment_status}`)
    load()
    setUpdating(null)
  }

  const filtered = bookings.filter(b => {
    const matchStatus = filter==="all" || b.status===filter
    const matchPay = payFilter==="all" || b.payment_status===payFilter
    const matchSearch = !search || 
      b.booking_number?.toLowerCase().includes(search.toLowerCase()) ||
      b.service_name?.toLowerCase().includes(search.toLowerCase()) ||
      `${b.customer?.first_name} ${b.customer?.last_name}`.toLowerCase().includes(search.toLowerCase()) ||
      b.provider?.business_name?.toLowerCase().includes(search.toLowerCase())
    return matchStatus && matchPay && matchSearch
  })

  const stats = {
    total: bookings.length,
    pending: bookings.filter(b=>b.status==="pending").length,
    confirmed: bookings.filter(b=>b.status==="confirmed").length,
    completed: bookings.filter(b=>b.status==="completed").length,
    revenue: bookings.filter(b=>b.payment_status==="paid").reduce((s,b)=>s+Number(b.platform_commission||0),0)
  }

  return (
    <div>
      {/* Stats */}
      <div style={{ display:"grid", gridTemplateColumns:isMobile?"repeat(2,1fr)":"repeat(5,1fr)", gap:8, marginBottom:"1.25rem" }}>
        {[
          { label:"Total", value:stats.total, color:"#000" },
          { label:"Pending", value:stats.pending, color:"#e6821e" },
          { label:"Confirmed", value:stats.confirmed, color:"#378add" },
          { label:"Completed", value:stats.completed, color:"#1d9e75" },
          { label:"Commission", value:`KES ${stats.revenue.toLocaleString()}`, color:"#8b5cf6" },
        ].map(s=>(
          <div key={s.label} style={{ background:"#f8f8f8", borderRadius:10, padding:"0.75rem", border:"1px solid #eeeeee" }}>
            <div style={{ fontSize:10, color:"#888", textTransform:"uppercase", marginBottom:4 }}>{s.label}</div>
            <div style={{ fontFamily:"Syne", fontSize:18, fontWeight:800, color:s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Search */}
      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by booking #, customer, provider, service..."
        style={{ width:"100%", background:"#f8f8f8", border:"1px solid #eeeeee", borderRadius:8, padding:"10px 14px", fontSize:13, outline:"none", marginBottom:10, fontFamily:"DM Sans,sans-serif" }}/>

      {/* Filters */}
      <div style={{ display:"flex", gap:6, marginBottom:6, flexWrap:"wrap" }}>
        {["all","pending","confirmed","in-progress","completed","cancelled"].map(s=>(
          <button key={s} onClick={()=>setFilter(s)} style={{ padding:"6px 12px", borderRadius:6, border:"none", fontSize:11, cursor:"pointer", background:filter===s?"#e6821e":"#f8f8f8", color:filter===s?"#fff":"#666" }}>
            {s==="all"?"All statuses":s}
          </button>
        ))}
      </div>
      <div style={{ display:"flex", gap:6, marginBottom:"1rem", flexWrap:"wrap" }}>
        {["all","paid","pending","partial","refunded"].map(s=>(
          <button key={s} onClick={()=>setPayFilter(s)} style={{ padding:"5px 10px", borderRadius:6, border:"none", fontSize:11, cursor:"pointer", background:payFilter===s?"#8b5cf6":"#f8f8f8", color:payFilter===s?"#fff":"#666" }}>
            {s==="all"?"All payments":s}
          </button>
        ))}
      </div>

      <div style={{ fontSize:12, color:"#888", marginBottom:10 }}>{filtered.length} booking{filtered.length!==1?"s":""}</div>

      {loading&&<div style={{ color:"#888", fontSize:13 }}>Loading...</div>}

      {filtered.map(b=>(
        <div key={b.id} style={{ background:"#f8f8f8", border:`1px solid ${expanded===b.id?"#e6821e40":"#eeeeee"}`, borderRadius:10, padding:"1rem", marginBottom:8 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:6 }}>
            <div style={{ flex:1, minWidth:0, marginRight:8 }}>
              <div style={{ fontSize:13, fontWeight:600, color:"#000", marginBottom:2 }}>{b.service_name}</div>
              <div style={{ fontSize:11, color:"#888" }}>
                👤 {b.customer?.first_name} {b.customer?.last_name} {b.customer?.phone?`· ${b.customer.phone}`:""}
              </div>
              <div style={{ fontSize:11, color:"#888" }}>
                🏪 {b.provider?.business_name||`${b.provider?.first_name} ${b.provider?.last_name}`}
              </div>
              <div style={{ fontSize:10, color:"#aaa", marginTop:2 }}>#{b.booking_number} · {b.booking_date} {b.booking_time?.slice(0,5)}</div>
            </div>
            <div style={{ textAlign:"right", flexShrink:0 }}>
              <span style={{ fontSize:10, padding:"2px 8px", borderRadius:10, background:SB[b.status]||"#f8f8f8", color:SC[b.status]||"#888", border:`1px solid ${SC[b.status]||"#888"}30`, display:"block", marginBottom:4 }}>{b.status}</span>
              <span style={{ fontSize:10, padding:"2px 8px", borderRadius:10, background:`${PC[b.payment_status]||"#888"}15`, color:PC[b.payment_status]||"#888", display:"block", marginBottom:4 }}>{b.payment_status}</span>
              <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:700, color:"#e6821e" }}>KES {Number(b.total_amount).toLocaleString()}</div>
            </div>
          </div>

          <div style={{ display:"flex", gap:6, flexWrap:"wrap", alignItems:"center" }}>
            <button onClick={()=>setExpanded(expanded===b.id?null:b.id)}
              style={{ background:"none", border:"1px solid #ddd", borderRadius:6, color:"#555", fontSize:11, padding:"4px 10px", cursor:"pointer" }}>
              {expanded===b.id?"Hide details":"View details"}
            </button>
            {b.status==="pending"&&<button onClick={()=>updateStatus(b.id,"confirmed")} disabled={updating===b.id} style={{ background:"#eff6ff", border:"1px solid #378add40", borderRadius:6, color:"#378add", fontSize:11, padding:"4px 10px", cursor:"pointer" }}>Confirm</button>}
            {b.status==="confirmed"&&<button onClick={()=>updateStatus(b.id,"in-progress")} disabled={updating===b.id} style={{ background:"#f5f3ff", border:"1px solid #8b5cf640", borderRadius:6, color:"#8b5cf6", fontSize:11, padding:"4px 10px", cursor:"pointer" }}>Start</button>}
            {b.status==="in-progress"&&<button onClick={()=>updateStatus(b.id,"completed")} disabled={updating===b.id} style={{ background:"#f0fdf4", border:"1px solid #1d9e7540", borderRadius:6, color:"#1d9e75", fontSize:11, padding:"4px 10px", cursor:"pointer" }}>Complete</button>}
            {b.payment_status==="pending"&&<button onClick={()=>updatePayment(b.id,"paid")} disabled={updating===b.id} style={{ background:"#f0fdf4", border:"1px solid #1d9e7540", borderRadius:6, color:"#1d9e75", fontSize:11, padding:"4px 10px", cursor:"pointer" }}>Mark paid</button>}
            {!["completed","cancelled"].includes(b.status)&&<button onClick={()=>updateStatus(b.id,"cancelled")} disabled={updating===b.id} style={{ background:"none", border:"1px solid #e24b4a30", borderRadius:6, color:"#e24b4a", fontSize:11, padding:"4px 10px", cursor:"pointer" }}>Cancel</button>}
          </div>

          {expanded===b.id&&(
            <div style={{ marginTop:10, paddingTop:10, borderTop:"1px solid #eeeeee" }}>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:8, fontSize:11 }}>
                {[
                  {l:"Booking ID", v:b.id},
                  {l:"Payment method", v:b.payment_method},
                  {l:"Platform commission", v:`KES ${Number(b.platform_commission||0).toLocaleString()}`},
                  {l:"Provider earnings", v:`KES ${Number(b.provider_earnings||0).toLocaleString()}`},
                  {l:"Is concierge", v:b.is_concierge?"Yes":"No"},
                  {l:"Pesapal tracking", v:b.pesapal_tracking_id||"—"},
                  {l:"Notes", v:b.notes||"—"},
                  {l:"Problem", v:b.problem_description||"—"},
                ].map(f=>(
                  <div key={f.l} style={{ background:"#ffffff", borderRadius:6, padding:"0.5rem 0.75rem" }}>
                    <div style={{ color:"#888", textTransform:"uppercase", fontSize:9, marginBottom:2 }}>{f.l}</div>
                    <div style={{ color:"#000", wordBreak:"break-all" }}>{f.v}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
      {!loading&&filtered.length===0&&<div style={{ color:"#888", fontSize:13, textAlign:"center", padding:"2rem" }}>No bookings found</div>}
    </div>
  )
}
