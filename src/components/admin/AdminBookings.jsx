import useIsMobile from "../../lib/useIsMobile"
import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"
import toast from "react-hot-toast"

const SC = { pending:"#e6821e", confirmed:"#378add", "in-progress":"#8b5cf6", completed:"#1d9e75", cancelled:"#e24b4a" }
const SB = { pending:"#1a1208", confirmed:"#0c1f2e", "in-progress":"#160a2e", completed:"#071a12", cancelled:"#1a0808" }

export default function AdminBookings() {
  const isMobile = useIsMobile()
  const [bookings, setBookings] = useState([])
  const [filter, setFilter] = useState("all")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
    const sub = supabase.channel("admin-bookings-page")
      .on("postgres_changes", { event:"*", schema:"public", table:"bookings" }, () => load())
      .subscribe()
    return () => supabase.removeChannel(sub)
  }, [])

  async function load() {
    const { data } = await supabase.from("bookings").select("*").order("created_at", { ascending:false })
    setBookings(data || [])
    setLoading(false)
  }

  async function cancelBooking(id) {
    if (!confirm("Cancel this booking?")) return
    await supabase.from("bookings").update({ status:"cancelled" }).eq("id", id)
    toast.success("Booking cancelled")
  }

  const filtered = filter==="all" ? bookings : bookings.filter(b=>b.status===filter)

  return (
    <div>
      <div style={{ display:"flex", gap:6, marginBottom:"1rem", flexWrap:"wrap" }}>
        {["all","pending","confirmed","in-progress","completed","cancelled"].map(s => (
          <button key={s} onClick={()=>setFilter(s)} style={{ padding:"6px 14px", borderRadius:6, border:"none", fontSize:12, cursor:"pointer", background:filter===s?"#1a1208":"#111", color:filter===s?"#e6821e":"#666", fontFamily:"'DM Sans',sans-serif" }}>
            {s==="all"?"All":s.charAt(0).toUpperCase()+s.slice(1)}
          </button>
        ))}
      </div>
      <div style={{ fontSize:12, color:"#555", marginBottom:10 }}>{filtered.length} booking{filtered.length!==1?"s":""}</div>
      {loading && <div style={{ color:"#555", fontSize:13 }}>Loading...</div>}
      {filtered.map(b => (
        <div key={b.id} style={{ background:"#111", border:"1px solid #1e1e1e", borderRadius:10, padding:"1rem", marginBottom:8 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
            <div>
              <div style={{ fontSize:14, fontWeight:500 }}>{b.service_name}</div>
              <div style={{ fontSize:10, color:"#444", marginTop:2 }}>#{b.booking_number}</div>
            </div>
            <span style={{ fontSize:10, padding:"3px 9px", borderRadius:20, background:SB[b.status]||"#111", color:SC[b.status]||"#888", border:`1px solid ${SC[b.status]||"#888"}40` }}>{b.status}</span>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:isMobile?"repeat(2,1fr)":"repeat(4,1fr)", gap:8, marginBottom:8 }}>
            {[{l:"Date",v:b.booking_date},{l:"Time",v:b.booking_time?.slice(0,5)},{l:"Amount",v:`$${Number(b.total_amount).toFixed(2)}`},{l:"Payment",v:b.payment_status}].map(f => (
              <div key={f.l}><div style={{ fontSize:10, color:"#555", textTransform:"uppercase" }}>{f.l}</div><div style={{ fontSize:12, marginTop:2 }}>{f.v}</div></div>
            ))}
          </div>
          {!["completed","cancelled"].includes(b.status) && (
            <button onClick={()=>cancelBooking(b.id)} style={{ background:"none", border:"1px solid #e24b4a40", borderRadius:7, color:"#e24b4a", fontSize:11, padding:"5px 12px", cursor:"pointer" }}>
              Cancel booking
            </button>
          )}
        </div>
      ))}
      {!loading && filtered.length===0 && <div style={{ color:"#444", fontSize:13, textAlign:"center", padding:"2rem" }}>No bookings found</div>}
    </div>
  )
}


