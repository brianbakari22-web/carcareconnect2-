import useIsMobile from "../../lib/useIsMobile"
import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"
import toast from "react-hot-toast"
import { sendRefundApproved } from "../../lib/email"

export default function AdminRefunds() {
  const isMobile = useIsMobile()
  const [refunds, setRefunds] = useState([])
  const [filter, setFilter] = useState("pending")
  const [loading, setLoading] = useState(true)
  const [note, setNote] = useState({})

  useEffect(() => {
    load()
    const sub = supabase.channel("admin-refunds")
      .on("postgres_changes", { event:"INSERT", schema:"public", table:"refunds" }, () => { load(); toast("New refund request", { icon:"↩️" }) })
      .subscribe()
    return () => supabase.removeChannel(sub)
  }, [])

  async function load() {
    const { data } = await supabase.from("refunds")
      .select("*, profile_public!refunds_customer_id_fkey(first_name,last_name), bookings(service_name,booking_date)")
      .order("created_at", { ascending:false })
    setRefunds(data||[])
    setLoading(false)
  }

  async function updateRefund(id, status) {
    const { error } = await supabase.from("refunds").update({ status, admin_notes:note[id]||null, processed_at:new Date().toISOString() }).eq("id", id)
    if (error) return toast.error(error.message)
    const refund = refunds.find(r=>r.id===id)
    if (refund) {
      await supabase.from("notifications").insert({
        user_id: refund.customer_id,
        title: `Refund ${status}`,
        message: `Your refund request of $${Number(refund.amount).toFixed(2)} has been ${status}`,
        type: status==="approved"?"success":"error"
      })
    }
    toast.success(`Refund ${status}`)
    if (status === "approved" && refund) {
      const { data: sens } = await supabase.from("profile_sensitive").select("email").eq("id", refund.customer_id).single()
      const bookingName = refund.bookings?.service_name || "your service"
      if (sens?.email) await sendRefundApproved(sens.email, refund, bookingName)
    }
    load()
  }

  const filtered = filter==="all" ? refunds : refunds.filter(r=>r.status===filter)
  const RC = { pending:"#e6821e", approved:"#1d9e75", rejected:"#e24b4a" }

  return (
    <div>
      <div style={{ display:"grid", gridTemplateColumns:isMobile?"repeat(2,1fr)":"repeat(3,1fr)", gap:10, marginBottom:"1.5rem" }}>
        {[
          { label:"Pending", value:refunds.filter(r=>r.status==="pending").length, color:"#e6821e" },
          { label:"Approved", value:refunds.filter(r=>r.status==="approved").length, color:"#1d9e75" },
          { label:"Total requested", value:`$${refunds.reduce((s,r)=>s+Number(r.amount),0).toFixed(2)}` },
        ].map(s=>(
          <div key={s.label} style={{ background:"#111", borderRadius:10, padding:"1rem", border:"1px solid #1e1e1e" }}>
            <div style={{ fontSize:11, color:"#555", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:6 }}>{s.label}</div>
            <div style={{ fontFamily:"Syne", fontSize:22, fontWeight:800, color:s.color||"#f0ede6" }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display:"flex", gap:6, marginBottom:"1rem" }}>
        {[{k:"pending",l:"Pending"},{k:"approved",l:"Approved"},{k:"rejected",l:"Rejected"},{k:"all",l:"All"}].map(t=>(
          <button key={t.k} onClick={()=>setFilter(t.k)}
            style={{ padding:"6px 14px", borderRadius:6, border:"none", fontSize:12, cursor:"pointer", background:filter===t.k?"#e6821e":"#111", color:filter===t.k?"#fff":"#666", fontFamily:"'DM Sans',sans-serif" }}>
            {t.l}
          </button>
        ))}
      </div>

      {loading&&<div style={{ color:"#555", fontSize:13 }}>Loading...</div>}
      {!loading&&filtered.length===0&&<div style={{ color:"#444", fontSize:13, textAlign:"center", padding:"2rem" }}>No refund requests</div>}

      {filtered.map(r=>(
        <div key={r.id} style={{ background:"#111", border:`1px solid ${r.status==="pending"?"#e6821e20":"#1e1e1e"}`, borderRadius:10, padding:"1rem", marginBottom:10 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
            <div>
              <div style={{ fontSize:14, fontWeight:500, color:"#f0ede6" }}>${Number(r.amount).toFixed(2)} refund</div>
              <div style={{ fontSize:11, color:"#555", marginTop:2 }}>
                {r.profile_public?.first_name} {r.profile_public?.last_name} · {r.bookings?.service_name}
              </div>
              <div style={{ fontSize:10, color:"#444", marginTop:2 }}>{new Date(r.created_at).toLocaleDateString()}</div>
            </div>
            <span style={{ fontSize:11, padding:"3px 9px", borderRadius:20, background:`${RC[r.status]}20`, color:RC[r.status], border:`1px solid ${RC[r.status]}40` }}>
              {r.status}
            </span>
          </div>
          <div style={{ fontSize:12, color:"#888", marginBottom:10, fontStyle:"italic" }}>"{r.reason}"</div>
          {r.status==="pending"&&(
            <div>
              <input placeholder="Admin note (optional)" value={note[r.id]||""} onChange={e=>setNote(n=>({...n,[r.id]:e.target.value}))}
                style={{ width:"100%", background:"#0f0f0f", border:"1px solid #222", borderRadius:7, padding:"8px 10px", color:"#f0ede6", fontSize:12, outline:"none", fontFamily:"'DM Sans',sans-serif", marginBottom:8 }}/>
              <div style={{ display:"flex", gap:8 }}>
                <button onClick={()=>updateRefund(r.id,"approved")}
                  style={{ background:"#071a12", border:"1px solid #1d9e7540", borderRadius:7, color:"#1d9e75", fontSize:12, padding:"6px 14px", cursor:"pointer" }}>
                  Approve
                </button>
                <button onClick={()=>updateRefund(r.id,"rejected")}
                  style={{ background:"none", border:"1px solid #e24b4a40", borderRadius:7, color:"#e24b4a", fontSize:12, padding:"6px 14px", cursor:"pointer" }}>
                  Reject
                </button>
              </div>
            </div>
          )}
          {r.admin_notes&&<div style={{ fontSize:11, color:"#666", marginTop:8, fontStyle:"italic" }}>Note: "{r.admin_notes}"</div>}
        </div>
      ))}
    </div>
  )
}

