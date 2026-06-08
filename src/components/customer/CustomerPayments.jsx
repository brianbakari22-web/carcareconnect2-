import useIsMobile from "../../lib/useIsMobile"
import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"
import { useAuth } from "../../contexts/AuthContext"
import { generateInvoice } from "../../lib/invoice"
import { useLanguage } from "../../contexts/LanguageContext"
import toast from "react-hot-toast"

export default function CustomerPayments() {
  const isMobile = useIsMobile()
  const { user, profile } = useAuth()
  const { t } = useLanguage()
  const [bookings, setBookings] = useState([])
  const [refunds, setRefunds] = useState([])
  const [tab, setTab] = useState("history")
  const [loading, setLoading] = useState(true)
  const [refundForm, setRefundForm] = useState({ bookingId:"", reason:"" })
  const [submitting, setSubmitting] = useState(false)
  const [vouchers, setVouchers] = useState([])

  useEffect(() => { if (user) load() }, [user])

  async function load() {
    const [{ data: bks }, { data: rfs }] = await Promise.all([
      supabase.from("bookings").select("*").eq("customer_id", user.id).order("created_at", { ascending:false }),
      supabase.from("refunds").select("*").eq("customer_id", user.id).order("created_at", { ascending:false })
    ])
    setBookings(bks||[]); setRefunds(rfs||[]); setLoading(false)
  }

  async function submitRefund(e) {
    e.preventDefault()
    if (!refundForm.bookingId) return toast.error("Select a booking")
    setSubmitting(true)
    const booking = bookings.find(b=>b.id===refundForm.bookingId)
    const { error } = await supabase.from("refunds").insert({
      booking_id: refundForm.bookingId,
      customer_id: user.id,
      amount: Number(booking.total_amount),
      reason: refundForm.reason,
      status: "pending"
    })
    if (error) { toast.error(error.message); setSubmitting(false); return }
    toast.success("Refund request submitted")
    setRefundForm({ bookingId:"", reason:"" }); setSubmitting(false); load()
  }

  const paid = bookings.filter(b=>b.payment_status==="paid")
  const totalSpent = paid.reduce((s,b)=>s+Number(b.total_amount),0)
  const totalRefunded = refunds.filter(r=>r.status==="approved").reduce((s,r)=>s+Number(r.amount),0)
  const refundable = bookings.filter(b=>b.status==="completed")
  const SC = { pending:"#e6821e", confirmed:"#378add", "in-progress":"#8b5cf6", completed:"#1d9e75", cancelled:"#e24b4a" }
  const RC = { pending:"#e6821e", approved:"#1d9e75", rejected:"#e24b4a" }
  const inp = { width:"100%", background:"#ffffff", border:"1px solid #e5e5e5", borderRadius:8, padding:"10px 12px", color:"#000000", fontSize:13, outline:"none", fontFamily:"'DM Sans',sans-serif" }

  return (
    <div>
      <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"repeat(3,1fr)", gap:10, marginBottom:"1.5rem" }}>
        {[
          { label:"Total spent", value:`KES ${totalSpent.toFixed(2)}` },
          { label:"Transactions", value:paid.length },
          { label:"Refunded", value:`KES ${totalRefunded.toLocaleString()}`, color:"#1d9e75" },
        ].map(s=>(
          <div key={s.label} style={{ background:"#ffffff", borderRadius:10, padding:"1rem", border:"1px solid #eeeeee" }}>
            <div style={{ fontSize:11, color:"#777777", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:6 }}>{s.label}</div>
            <div style={{ fontFamily:"Syne", fontSize:22, fontWeight:800, color:s.color||"#f0ede6" }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display:"flex", gap:6, marginBottom:"1.25rem" }}>
        {[{k:"history",l:"Payment history"},{k:"refunds",l:"Refund requests"},{k:"vouchers",l:"My Vouchers"}].map(t=>(
          <button key={t.k} onClick={()=>setTab(t.k)} style={{ padding:"8px 16px", borderRadius:8, border:"none", fontSize:12, cursor:"pointer", background:tab===t.k?"#e6821e":"#111", color:tab===t.k?"#fff":"#666", fontFamily:"'DM Sans',sans-serif", fontWeight:tab===t.k?700:400 }}>
            {t.l}
          </button>
        ))}
      </div>

      {tab==="history"&&(
        <div>
          {loading&&<div style={{ color:"#777777", fontSize:13 }}>Loading...</div>}
          {!loading&&bookings.length===0&&<div style={{ color:"#888888", fontSize:13, textAlign:"center", padding:"2rem" }}>No payments yet</div>}
          {bookings.map(b=>(
            <div key={b.id} style={{ background:"#ffffff", border:"1px solid #eeeeee", borderRadius:10, padding:"1rem", marginBottom:8 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
                <div>
                  <div style={{ fontSize:14, fontWeight:500, color:"#000000" }}>{b.service_name}</div>
                  <div style={{ fontSize:10, color:"#888888", marginTop:2 }}>#{b.booking_number} · {b.booking_date}</div>
                </div>
                <div style={{ textAlign:"right" }}>
                  <div style={{ fontFamily:"Syne", fontSize:15, fontWeight:800, color:"#e6821e" }}>KES {Number(b.total_amount).toLocaleString()}</div>
                  <span style={{ fontSize:10, padding:"2px 8px", borderRadius:20, background:b.payment_status==="paid"?"#071a12":"#1a1208", color:b.payment_status==="paid"?"#1d9e75":"#e6821e" }}>
                    {b.payment_status}
                  </span>
                </div>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8, marginBottom:10 }}>
                {[
                  { l:"Status", v:b.status },
                  { l:"Platform 15%", v:`KES ${(Number(b.total_amount)*0.15).toLocaleString()}` },
                    { l:"Provider 70%", v:"KES " + Number(b.provider_earnings||0).toLocaleString() },
                    { l:"Driver 15%", v:"KES " + Number(b.driver_earnings||0).toLocaleString() },
                ].map(f=>(
                  <div key={f.l}>
                    <div style={{ fontSize:10, color:"#777777", textTransform:"uppercase" }}>{f.l}</div>
                    <div style={{ fontSize:12, color:f.l==="Status"?(SC[f.v]||"#888"):"#f0ede6", marginTop:2 }}>{f.v}</div>
                  </div>
                ))}
              </div>
              <button onClick={()=>generateInvoice(b, profile, "customer")}
                style={{ background:"#0c1f2e", border:"1px solid #378add40", borderRadius:7, color:"#378add", fontSize:11, padding:"5px 12px", cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}>
                Download Invoice
              </button>
            </div>
          ))}
        </div>
      )}

      {tab==="vouchers"&&(
        <div>
          {vouchers.length===0&&<div style={{ color:"#888888", fontSize:13, textAlign:"center", padding:"2rem" }}>No vouchers yet</div>}
          {vouchers.map(v=>(
            <div key={v.id} style={{ background:"#ffffff", border:`1px solid ${v.is_used?"#1e1e1e":new Date(v.expires_at)<new Date()?"#1a0808":"#1d9e7540"}`, borderRadius:10, padding:"1rem", marginBottom:8 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
                <div>
                  <div style={{ fontFamily:"Syne", fontSize:16, fontWeight:800, color:v.is_used?"#555":new Date(v.expires_at)<new Date()?"#e24b4a":"#1d9e75", letterSpacing:2 }}>{v.code}</div>
                  <div style={{ fontSize:11, color:"#777777", marginTop:2 }}>Value: KES {Number(v.value).toLocaleString()}</div>
                  <div style={{ fontSize:10, color:"#888888", marginTop:2 }}>Expires: {new Date(v.expires_at).toLocaleDateString()}</div>
                </div>
                <span style={{ fontSize:11, padding:"3px 10px", borderRadius:20, background:v.is_used?"#111":new Date(v.expires_at)<new Date()?"#1a0808":"#071a12", color:v.is_used?"#555":new Date(v.expires_at)<new Date()?"#e24b4a":"#1d9e75", fontWeight:600 }}>
                  {v.is_used?"Used":new Date(v.expires_at)<new Date()?"Expired":"Active"}
                </span>
              </div>
              {!v.is_used&&new Date(v.expires_at)>new Date()&&(
                <div style={{ fontSize:11, color:"#555555", background:"#ffffff", borderRadius:6, padding:"6px 10px" }}>
                  Use this code when booking a service to get KES {Number(v.value).toLocaleString()} off
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {tab==="refunds"&&(
        <div>
          {refunds.length>0&&(
            <div style={{ marginBottom:"1.5rem" }}>
              <div style={{ fontFamily:"Syne", fontSize:13, fontWeight:700, marginBottom:10 }}>Your refund requests</div>
              {refunds.map(r=>(
                <div key={r.id} style={{ background:"#ffffff", border:"1px solid #eeeeee", borderRadius:10, padding:"1rem", marginBottom:8 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                    <div>
                      <div style={{ fontSize:13, fontWeight:500 }}>KES {Number(r.amount).toLocaleString()} refund</div>
                      <div style={{ fontSize:11, color:"#777777", marginTop:2 }}>{r.reason}</div>
                      <div style={{ fontSize:10, color:"#888888", marginTop:2 }}>{new Date(r.created_at).toLocaleDateString()}</div>
                    </div>
                    <span style={{ fontSize:11, padding:"3px 9px", borderRadius:20, background:r.status==="approved"?"#071a12":r.status==="rejected"?"#1a0808":"#1a1208", color:RC[r.status]||"#888" }}>
                      {r.status}
                    </span>
                  </div>
                  {r.admin_notes&&<div style={{ fontSize:11, color:"#666", marginTop:8, fontStyle:"italic" }}>Admin: "{r.admin_notes}"</div>}
                </div>
              ))}
            </div>
          )}
          <div style={{ background:"#ffffff", border:"1px solid #eeeeee", borderRadius:10, padding:"1.25rem" }}>
            <div style={{ fontFamily:"Syne", fontSize:13, fontWeight:700, marginBottom:"1rem" }}>Request a refund</div>
            {refundable.length===0?(
              <div style={{ fontSize:13, color:"#777777" }}>No completed bookings eligible for refund</div>
            ):(
              <form onSubmit={submitRefund}>
                <div style={{ marginBottom:10 }}>
                  <label style={{ fontSize:11, color:"#666", textTransform:"uppercase", letterSpacing:"0.05em", display:"block", marginBottom:4 }}>Select booking</label>
                  <select value={refundForm.bookingId} onChange={e=>setRefundForm(f=>({...f,bookingId:e.target.value}))} style={inp} required>
                    <option value="">Choose a booking...</option>
                    {refundable.map(b=><option key={b.id} value={b.id}>{b.service_name} — KES {Number(b.total_amount).toLocaleString()} · {b.booking_date}</option>)}
                  </select>
                </div>
                <div style={{ marginBottom:12 }}>
                  <label style={{ fontSize:11, color:"#666", textTransform:"uppercase", letterSpacing:"0.05em", display:"block", marginBottom:4 }}>Reason</label>
                  <textarea value={refundForm.reason} onChange={e=>setRefundForm(f=>({...f,reason:e.target.value}))} rows={3} placeholder="Explain why you are requesting a refund..." style={{...inp,resize:"vertical"}} required/>
                </div>
                <button type="submit" disabled={submitting} style={{ background:submitting?"#333":"#e6821e", border:"none", borderRadius:8, color:submitting?"#666":"#fff", fontFamily:"Syne,sans-serif", fontSize:13, fontWeight:700, padding:"10px 20px", cursor:submitting?"not-allowed":"pointer" }}>
                  {submitting?t("loading"):t("submit")}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}










