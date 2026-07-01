import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"
import { useAuth } from "../../contexts/AuthContext"
import { useLocation } from "react-router-dom"
import useIsMobile from "../../lib/useIsMobile"
import toast from "react-hot-toast"
import ChatWindow from "../shared/ChatWindow"

const CLAIM_REASONS = [
  "Service not completed properly",
  "Mechanic was unprofessional",
  "Vehicle was damaged during service",
  "Service took much longer than promised",
  "Wrong service was performed",
  "Parts used were substandard",
  "Provider did not show up",
  "Other",
]

export default function CustomerClaims() {
  const { user } = useAuth()
  const isMobile = useIsMobile()
  const location = useLocation()
  const preselectedBooking = new URLSearchParams(location.search).get("booking")

  const [claims, setClaims] = useState([])
  const [vouchers, setVouchers] = useState([])
  const [bookings, setBookings] = useState([])
  const [orders, setOrders] = useState([])
  const [claimType, setClaimType] = useState("booking")
  const [loading, setLoading] = useState(true)
  const [adminId, setAdminId] = useState(null)
  const [showForm, setShowForm] = useState(!!preselectedBooking)
  const [form, setForm] = useState({ booking_id:preselectedBooking||"", order_id:"", reason:"", description:"" })
  const [submitting, setSubmitting] = useState(false)
  const [tab, setTab] = useState("claims")
  const [chatClaim, setChatClaim] = useState(null)

  useEffect(() => {
    if (user) {
      load()
      supabase.from("profiles").select("id").eq("role","admin").limit(1)
        .then(({ data }) => { if (data?.length) setAdminId(data[0].id) })
    }
  }, [user])

  async function load() {
    const [{ data: cls }, { data: vchs }, { data: bks }, { data: ords }] = await Promise.all([
      supabase.from("service_claims")
        .select("*, bookings(service_name,booking_number,booking_date,total_amount)")
        .eq("customer_id", user.id)
        .order("created_at", { ascending:false }),
      supabase.from("service_vouchers")
        .select("*")
        .eq("customer_id", user.id)
        .order("created_at", { ascending:false }),
      supabase.from("bookings")
        .select("id,service_name,booking_number,booking_date,total_amount,status,provider_id")
        .eq("customer_id", user.id)
        .eq("status", "completed")
        .order("created_at", { ascending:false })
        .limit(20),
      supabase.from("orders").select("id,order_number,status,subtotal,provider_id,created_at").eq("customer_id", user.id).eq("status","delivered").order("created_at", { ascending:false }).limit(20),
    ])
    setClaims(cls||[])
    setVouchers(vchs||[])
    setBookings(bks||[])
    setOrders(ords||[])
    setLoading(false)
  }

  async function submitClaim(e) {
    e.preventDefault()
    if (claimType==="booking" && !form.booking_id) return toast.error("Please select a booking")
    if (claimType==="order" && !form.order_id) return toast.error("Please select an order")
    if (!form.reason) return toast.error("Please select a reason")
    if (!form.description) return toast.error("Please describe the issue")
    setSubmitting(true)
    try {
      const booking = bookings.find(b=>b.id===form.booking_id)
      const order = orders.find(o=>o.id===form.order_id)
      const { error } = await supabase.from("service_claims").insert({
        booking_id: claimType==="booking" ? form.booking_id : null,
        order_id: claimType==="order" ? form.order_id : null,
        customer_id: user.id,
        provider_id: claimType==="booking" ? booking?.provider_id : order?.provider_id,
        reason: form.reason,
        description: form.description,
        status: "pending",
      })
      if (error) throw error
      await supabase.from("notifications").insert({
        user_id: user.id,
        title: "Claim submitted ✅",
        message: "Your service claim has been submitted. Our team will review it within 24 hours.",
        type: "success",
      })
      toast.success("Claim submitted — we will review within 24 hours")
      setShowForm(false)
      setForm({ booking_id:"", order_id:"", reason:"", description:"" })
      load()
    } catch(err) { toast.error(err.message) }
    finally { setSubmitting(false) }
  }

  const activeVouchers = vouchers.filter(v=>!v.is_used&&new Date(v.expires_at)>new Date())
  const usedVouchers = vouchers.filter(v=>v.is_used)
  const expiredVouchers = vouchers.filter(v=>!v.is_used&&new Date(v.expires_at)<=new Date())

  const inp = { width:"100%", background:"#ffffff", border:"1px solid #e5e5e5", borderRadius:8, padding:"11px 12px", color:"#000000", fontSize:13, outline:"none", fontFamily:"'DM Sans',sans-serif", marginBottom:12 }
  const lbl = { fontSize:11, color:"#666", textTransform:"uppercase", letterSpacing:"0.05em", display:"block", marginBottom:4 }
  const SC = { pending:"#e6821e", under_review:"#8b5cf6", approved:"#1d9e75", rejected:"#e24b4a" }

  return (
    <div>
      <div style={{ fontFamily:"Syne", fontSize:isMobile?16:18, fontWeight:800, color:"#000000", marginBottom:4 }}>Service Guarantee</div>
      <div style={{ fontSize:12, color:"#777777", marginBottom:"1.25rem" }}>Not happy with a service? We will make it right.</div>

      {/* Active vouchers banner */}
      {activeVouchers.length>0&&(
        <div style={{ background:"#f0fdf4", border:"2px solid #1d9e75", borderRadius:12, padding:"1.25rem", marginBottom:"1.5rem" }}>
          <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:800, color:"#1d9e75", marginBottom:8 }}>
            🎟️ You have {activeVouchers.length} active voucher{activeVouchers.length>1?"s":""}
          </div>
          {activeVouchers.map(v=>(
            <div key={v.id} style={{ background:"#ffffff", borderRadius:10, padding:"1rem", marginBottom:8, border:"1px solid #1d9e7530" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap", gap:8 }}>
                <div>
                  <div style={{ fontFamily:"Syne", fontSize:20, fontWeight:800, color:"#1d9e75", letterSpacing:2 }}>{v.voucher_code}</div>
                  <div style={{ fontSize:12, color:"#555555", marginTop:2 }}>Worth KES {Number(v.amount).toLocaleString()}</div>
                  <div style={{ fontSize:11, color:"#777777", marginTop:2 }}>Expires: {new Date(v.expires_at).toLocaleDateString()}</div>
                  <div style={{ fontSize:11, color:"#1d9e75", marginTop:4 }}>✓ Valid for any service from a different provider</div>
                </div>
                <div style={{ background:"#f0fdf4", border:"1px solid #1d9e7540", borderRadius:8, padding:"0.5rem 1rem", textAlign:"center" }}>
                  <div style={{ fontSize:10, color:"#777777", marginBottom:2 }}>Value</div>
                  <div style={{ fontFamily:"Syne", fontSize:18, fontWeight:800, color:"#1d9e75" }}>KES {Number(v.amount).toLocaleString()}</div>
                </div>
              </div>
              <div style={{ fontSize:11, color:"#777777", marginTop:8, padding:"0.5rem", background:"#ffffff", borderRadius:6 }}>
                💡 Use this code when booking any service — the amount will be deducted from your total
              </div>
            </div>
          ))}
        </div>
      )}

      {/* How it works */}
      <div style={{ background:"#ffffff", border:"1px solid #eeeeee", borderRadius:12, padding:"1rem", marginBottom:"1.5rem" }}>
        <div style={{ fontFamily:"Syne", fontSize:13, fontWeight:700, color:"#000000", marginBottom:10 }}>How our Service Guarantee works</div>
        {[
          { icon:"1️⃣", title:"Submit a claim", desc:"Tell us what went wrong within 7 days of completion" },
          { icon:"2️⃣", title:"We review", desc:"Our team reviews your claim within 24 hours" },
          { icon:"3️⃣", title:"Get a voucher", desc:"If approved, you receive a service voucher worth the full amount" },
          { icon:"4️⃣", title:"Rebook for free", desc:"Use your voucher to book the same service with any other provider" },
          { icon:"5️⃣", title:"Provider accountability", desc:"The original provider is penalized and cost deducted from their earnings" },
        ].map(step=>(
          <div key={step.icon} style={{ display:"flex", gap:10, alignItems:"flex-start", marginBottom:10 }}>
            <span style={{ fontSize:16, flexShrink:0 }}>{step.icon}</span>
            <div>
              <div style={{ fontSize:12, color:"#000000", fontWeight:600 }}>{step.title}</div>
              <div style={{ fontSize:11, color:"#777777", lineHeight:1.5 }}>{step.desc}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display:"flex", gap:6, marginBottom:"1.25rem" }}>
        {[
          { k:"claims", l:`My claims (${claims.length})` },
          { k:"vouchers", l:`Vouchers (${vouchers.length})` },
        ].map(t=>(
          <button key={t.k} onClick={()=>setTab(t.k)}
            style={{ padding:"8px 16px", borderRadius:8, border:"none", fontSize:12, cursor:"pointer", background:tab===t.k?"#e6821e":"#555555", color:tab===t.k?"#fff":"#666", fontFamily:"'DM Sans',sans-serif", fontWeight:tab===t.k?700:400 }}>
            {t.l}
          </button>
        ))}
        <button onClick={()=>setShowForm(true)}
          style={{ marginLeft:"auto", background:"#e6821e", border:"none", borderRadius:8, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:12, fontWeight:700, padding:"8px 16px", cursor:"pointer" }}>
          + New claim
        </button>
      </div>

      {/* Claim form */}
      {showForm&&(
        <div style={{ background:"#ffffff", border:"1px solid #e6821e30", borderRadius:12, padding:"1.25rem", marginBottom:"1.5rem" }}>
          <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:700, color:"#000000", marginBottom:"1rem" }}>Submit a service claim</div>
          <form onSubmit={submitClaim}>
            <div style={{ display:"flex", gap:8, marginBottom:12 }}>
              <button type="button" onClick={()=>setClaimType("booking")} style={{ flex:1, padding:"8px", borderRadius:8, border:"1px solid "+(claimType==="booking"?"#e6821e":"#e0e0e0"), background:claimType==="booking"?"#fff8f0":"#f8f8f8", color:claimType==="booking"?"#e6821e":"#555", fontSize:12, fontWeight:claimType==="booking"?700:400, cursor:"pointer" }}>📅 A service booking</button>
              <button type="button" onClick={()=>setClaimType("order")} style={{ flex:1, padding:"8px", borderRadius:8, border:"1px solid "+(claimType==="order"?"#e6821e":"#e0e0e0"), background:claimType==="order"?"#fff8f0":"#f8f8f8", color:claimType==="order"?"#e6821e":"#555", fontSize:12, fontWeight:claimType==="order"?700:400, cursor:"pointer" }}>📦 A parts order</button>
            </div>
            {claimType==="booking"&&(
              <><label style={lbl}>Select booking *</label>
              <select style={inp} value={form.booking_id} onChange={e=>setForm(f=>({...f,booking_id:e.target.value}))}>
                <option value="">Select a completed booking</option>
                {bookings.map(b=>(
                  <option key={b.id} value={b.id}>{b.service_name} — #{b.booking_number} · {b.booking_date} · KES {Number(b.total_amount).toLocaleString()}</option>
                ))}
              </select></>
            )}
            {claimType==="order"&&(
              <><label style={lbl}>Select order *</label>
              <select style={inp} value={form.order_id} onChange={e=>setForm(f=>({...f,order_id:e.target.value}))}>
                <option value="">Select a delivered order</option>
                {orders.map(o=>(
                  <option key={o.id} value={o.id}>Order #{o.order_number} · KES {Number(o.subtotal||0).toLocaleString()} · {new Date(o.created_at).toLocaleDateString()}</option>
                ))}
              </select></>
            )}
            <label style={lbl}>Reason *</label>
            <select style={inp} value={form.reason} onChange={e=>setForm(f=>({...f,reason:e.target.value}))} required>
              <option value="">Select reason</option>
              {CLAIM_REASONS.map(r=><option key={r} value={r}>{r}</option>)}
            </select>
            <label style={lbl}>Describe what went wrong *</label>
            <textarea style={{ ...inp, resize:"vertical", minHeight:100 }}
              placeholder="Please provide as much detail as possible."
              value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} required/>
            <div style={{ background:"#ffffff", borderRadius:8, padding:"0.75rem", marginBottom:12, fontSize:11, color:"#666", lineHeight:1.6 }}>
              ⚠️ Claims must be submitted within 7 days of service completion. False claims may result in account suspension.
            </div>
            <div style={{ display:"flex", gap:8 }}>
              <button type="submit" disabled={submitting}
                style={{ background:submitting?"#555555":"#e6821e", border:"none", borderRadius:9, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:13, fontWeight:700, padding:"11px 24px", cursor:submitting?"not-allowed":"pointer" }}>
                {submitting?"Submitting...":"Submit claim"}
              </button>
              <button type="button" onClick={()=>{ setShowForm(false); setForm({ booking_id:"", order_id:"", reason:"", description:"" }) }}
                style={{ background:"none", border:"1px solid #dddddd", borderRadius:9, color:"#666", fontSize:13, padding:"11px 16px", cursor:"pointer" }}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {loading&&<div style={{ color:"#777777", fontSize:13 }}>Loading...</div>}

      {/* Claims tab */}
      {tab==="claims"&&(
        <div>
          {!loading&&claims.length===0&&(
            <div style={{ color:"#888888", fontSize:13, textAlign:"center", padding:"2rem" }}>
              <div style={{ fontSize:32, marginBottom:10 }}>✅</div>
              No claims yet — we hope all your services have been great!
            </div>
          )}
          {claims.map(c=>(
            <div key={c.id} style={{ background:"#ffffff", border:`1px solid ${SC[c.status]||"#eeeeee"}30`, borderRadius:10, padding:"1rem", marginBottom:8 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4, flexWrap:"wrap" }}>
                    <div style={{ fontSize:13, fontWeight:600, color:"#000000" }}>{c.bookings?.service_name}</div>
                    <span style={{ fontSize:10, padding:"2px 8px", borderRadius:10, background:`${SC[c.status]||"#888"}20`, color:SC[c.status]||"#888" }}>{c.status?.replace("_"," ")}</span>
                  </div>
                  <div style={{ fontSize:11, color:"#777777", marginBottom:2 }}>#{c.bookings?.booking_number} · {c.bookings?.booking_date}</div>
                  <div style={{ fontSize:12, color:"#555555", marginBottom:2 }}>Reason: {c.reason}</div>
                  <div style={{ fontSize:11, color:"#666", fontStyle:"italic" }}>&quot;{c.description}&quot;</div>
                  {c.admin_notes&&<div style={{ fontSize:11, color:"#378add", marginTop:4 }}>Admin: &quot;{c.admin_notes}&quot;</div>}
                  <div style={{ fontSize:10, color:"#888888", marginTop:4 }}>{new Date(c.created_at).toLocaleString()}</div>
                </div>
                <div style={{ textAlign:"right", flexShrink:0 }}>
                  <div style={{ fontFamily:"Syne", fontSize:13, fontWeight:700, color:"#e6821e" }}>KES {Number(c.bookings?.total_amount||0).toLocaleString()}</div>
                </div>
              </div>
              <div style={{ marginTop:8 }}>
                <button onClick={()=>setChatClaim(chatClaim===c.id?null:c.id)}
                  style={{ background:"#eff6ff", border:"1px solid #378add40", borderRadius:7, color:"#378add", fontSize:11, padding:"5px 12px", cursor:"pointer" }}>
                  💬 {chatClaim===c.id?"Close":(c.status==="pending"||c.status==="under_review")?"Add evidence / message admin":"View conversation with admin"}
                </button>
                {chatClaim===c.id&&(
                  <div style={{ height:280, marginTop:8 }}>
                    <ChatWindow
                      claimId={c.id}
                      otherUserId={adminId}
                      otherUserName="CCC Admin"
                      onClose={()=>setChatClaim(null)}
                    />
                  </div>
                )}
              </div>
            {c.status==="approved"&&(
                <div style={{ marginTop:8, padding:"0.6rem", background:"#f0fdf4", borderRadius:7, fontSize:12, color:"#1d9e75" }}>
                  ✅ Claim approved — check your vouchers tab
                </div>
              )}
              {c.status==="rejected"&&c.admin_notes&&(
                <div style={{ marginTop:8, padding:"0.6rem", background:"#fff5f5", borderRadius:7, fontSize:12, color:"#e24b4a" }}>
                  ❌ Claim rejected: {c.admin_notes}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Vouchers tab */}
      {tab==="vouchers"&&(
        <div>
          {activeVouchers.length>0&&(
            <div style={{ marginBottom:"1.5rem" }}>
              <div style={{ fontSize:11, color:"#1d9e75", fontWeight:700, textTransform:"uppercase", marginBottom:8 }}>Active vouchers</div>
              {activeVouchers.map(v=>(
                <div key={v.id} style={{ background:"#f0fdf4", border:"1px solid #1d9e7540", borderRadius:10, padding:"1rem", marginBottom:8 }}>
                  <div style={{ fontFamily:"Syne", fontSize:18, fontWeight:800, color:"#1d9e75", letterSpacing:2, marginBottom:4 }}>{v.voucher_code}</div>
                  <div style={{ fontSize:12, color:"#555555" }}>Worth KES {Number(v.amount).toLocaleString()} · Expires {new Date(v.expires_at).toLocaleDateString()}</div>
                  <div style={{ fontSize:11, color:"#777777", marginTop:4 }}>Use this code when booking any service</div>
                </div>
              ))}
            </div>
          )}
          {usedVouchers.length>0&&(
            <div style={{ marginBottom:"1.5rem" }}>
              <div style={{ fontSize:11, color:"#777777", fontWeight:700, textTransform:"uppercase", marginBottom:8 }}>Used vouchers</div>
              {usedVouchers.map(v=>(
                <div key={v.id} style={{ background:"#ffffff", border:"1px solid #eeeeee", borderRadius:10, padding:"1rem", marginBottom:8, opacity:0.6 }}>
                  <div style={{ fontFamily:"Syne", fontSize:15, fontWeight:800, color:"#777777", letterSpacing:2, marginBottom:4 }}>{v.voucher_code}</div>
                  <div style={{ fontSize:11, color:"#888888" }}>KES {Number(v.amount).toLocaleString()} · Used</div>
                </div>
              ))}
            </div>
          )}
          {expiredVouchers.length>0&&(
            <div>
              <div style={{ fontSize:11, color:"#888888", fontWeight:700, textTransform:"uppercase", marginBottom:8 }}>Expired vouchers</div>
              {expiredVouchers.map(v=>(
                <div key={v.id} style={{ background:"#ffffff", border:"1px solid #eeeeee", borderRadius:10, padding:"1rem", marginBottom:8, opacity:0.4 }}>
                  <div style={{ fontFamily:"Syne", fontSize:15, fontWeight:800, color:"#888888", letterSpacing:2, marginBottom:4 }}>{v.voucher_code}</div>
                  <div style={{ fontSize:11, color:"#555555" }}>KES {Number(v.amount).toLocaleString()} · Expired {new Date(v.expires_at).toLocaleDateString()}</div>
                </div>
              ))}
            </div>
          )}
          {vouchers.length===0&&(
            <div style={{ color:"#888888", fontSize:13, textAlign:"center", padding:"2rem" }}>
              <div style={{ fontSize:32, marginBottom:10 }}>🎟️</div>
              No vouchers yet
            </div>
          )}
        </div>
      )}
    </div>
  )
}







