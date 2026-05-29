import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"
import { useAuth } from "../../contexts/AuthContext"
import useIsMobile from "../../lib/useIsMobile"
import toast from "react-hot-toast"

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
  const [claims, setClaims] = useState([])
  const [vouchers, setVouchers] = useState([])
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ booking_id:"", reason:"", description:"" })
  const [submitting, setSubmitting] = useState(false)
  const [tab, setTab] = useState("claims")

  useEffect(() => { if (user) load() }, [user])

  async function load() {
    const [{ data: cls }, { data: vchs }, { data: bks }] = await Promise.all([
      supabase.from("service_claims").select("*, bookings(service_name,booking_number,booking_date,total_amount)").eq("customer_id",user.id).order("created_at",{ascending:false}),
      supabase.from("service_vouchers").select("*").eq("customer_id",user.id).order("created_at",{ascending:false}),
      supabase.from("bookings").select("id,service_name,booking_number,booking_date,total_amount,status,provider_id").eq("customer_id",user.id).eq("status","completed").order("created_at",{ascending:false}).limit(20),
    ])
    setClaims(cls||[])
    setVouchers(vchs||[])
    setBookings(bks||[])
    setLoading(false)
  }

  async function submitClaim(e) {
    e.preventDefault()
    if (!form.booking_id) return toast.error("Please select a booking")
    if (!form.reason) return toast.error("Please select a reason")
    if (!form.description) return toast.error("Please describe the issue")
    setSubmitting(true)
    try {
      const booking = bookings.find(b=>b.id===form.booking_id)
      const { error } = await supabase.from("service_claims").insert({
        booking_id: form.booking_id,
        customer_id: user.id,
        provider_id: booking?.provider_id,
        reason: form.reason,
        description: form.description,
        status: "pending",
      })
      if (error) throw error
      await supabase.from("notifications").insert({
        user_id: user.id,
        title: "Claim submitted ✅",
        message: "Your service claim has been submitted. Our team will review it within 24 hours and issue a service voucher if approved.",
        type: "success",
      })
      toast.success("Claim submitted — we will review within 24 hours")
      setShowForm(false)
      setForm({ booking_id:"", reason:"", description:"" })
      load()
    } catch(err) {
      toast.error(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const activeVouchers = vouchers.filter(v=>!v.is_used&&new Date(v.expires_at)>new Date())
  const usedVouchers = vouchers.filter(v=>v.is_used)
  const expiredVouchers = vouchers.filter(v=>!v.is_used&&new Date(v.expires_at)<=new Date())

  const inp = { width:"100%", background:"#111", border:"1px solid #222", borderRadius:8, padding:"11px 12px", color:"#f0ede6", fontSize:13, outline:"none", fontFamily:"'DM Sans',sans-serif", marginBottom:12 }
  const lbl = { fontSize:11, color:"#666", textTransform:"uppercase", letterSpacing:"0.05em", display:"block", marginBottom:4 }

  const SC = { pending:"#e6821e", under_review:"#8b5cf6", approved:"#1d9e75", rejected:"#e24b4a" }

  return (
    <div>
      <div style={{ fontFamily:"Syne", fontSize:isMobile?16:18, fontWeight:800, color:"#f0ede6", marginBottom:4 }}>Service Guarantee</div>
      <div style={{ fontSize:12, color:"#555", marginBottom:"1.25rem" }}>Not happy with a service? We'll make it right.</div>

      {/* Active vouchers banner */}
      {activeVouchers.length>0&&(
        <div style={{ background:"#071a12", border:"2px solid #1d9e75", borderRadius:12, padding:"1.25rem", marginBottom:"1.5rem" }}>
          <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:800, color:"#1d9e75", marginBottom:8 }}>🎟️ You have {activeVouchers.length} active voucher{activeVouchers.length>1?"s":""}</div>
          {activeVouchers.map(v=>(
            <div key={v.id} style={{ background:"#0a0a0a", borderRadius:10, padding:"1rem", marginBottom:8, border:"1px solid #1d9e7530" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap", gap:8 }}>
                <div>
                  <div style={{ fontFamily:"Syne", fontSize:20, fontWeight:800, color:"#1d9e75", letterSpacing:2 }}>{v.voucher_code}</div>
                  <div style={{ fontSize:12, color:"#888", marginTop:2 }}>Worth KES {Number(v.amount).toLocaleString()}</div>
                  <div style={{ fontSize:11, color:"#555", marginTop:2 }}>Expires: {new Date(v.expires_at).toLocaleDateString()}</div>
                  <div style={{ fontSize:11, color:"#1d9e75", marginTop:4 }}>✓ Valid for any service from a different provider</div>
                </div>
                <div style={{ background:"#071a12", border:"1px solid #1d9e7540", borderRadius:8, padding:"0.5rem 1rem", textAlign:"center" }}>
                  <div style={{ fontSize:10, color:"#555", marginBottom:2 }}>Voucher value</div>
                  <div style={{ fontFamily:"Syne", fontSize:18, fontWeight:800, color:"#1d9e75" }}>KES {Number(v.amount).toLocaleString()}</div>
                </div>
              </div>
              <div style={{ fontSize:11, color:"#555", marginTop:8, padding:"0.5rem", background:"#111", borderRadius:6 }}>
                💡 Use this code when booking any service — the amount will be deducted from your total
              </div>
            </div>
          ))}
        </div>
      )}

      {/* How it works */}
      <div style={{ background:"#111", border:"1px solid #1e1e1e", borderRadius:12, padding:"1rem", marginBottom:"1.5rem" }}>
        <div style={{ fontFamily:"Syne", fontSize:13, fontWeight:700, color:"#f0ede6", marginBottom:10 }}>How our Service Guarantee works</div>
        {[
          { icon:"1️⃣", title:"Submit a claim", desc:"Tell us what went wrong with your service within 7 days of completion" },
          { icon:"2️⃣", title:"We review", desc:"Our team reviews your claim within 24 hours" },
          { icon:"3️⃣", title:"Get a voucher", desc:"If approved, you receive a service voucher worth the full amount" },
          { icon:"4️⃣", title:"Rebook for free", desc:"Use your voucher to book the same service with any other provider — you pay nothing" },
          { icon:"5️⃣", title:"Provider accountability", desc:"The original provider is penalized and the cost is deducted from their earnings" },
        ].map(step=>(
          <div key={step.icon} style={{ display:"flex", gap:10, alignItems:"flex-start", marginBottom:10 }}>
            <span style={{ fontSize:16, flexShrink:0 }}>{step.icon}</span>
            <div>
              <div style={{ fontSize:12, color:"#f0ede6", fontWeight:600 }}>{step.title}</div>
              <div style={{ fontSize:11, color:"#555", lineHeight:1.5 }}>{step.desc}</div>
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
            style={{ padding:"8px 16px", borderRadius:8, border:"none", fontSize:12, cursor:"pointer", background:tab===t.k?"#e6821e":"#111", color:tab===t.k?"#fff":"#666", fontFamily:"'DM Sans',sans-serif", fontWeight:tab===t.k?700:400 }}>
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
        <div style={{ background:"#111", border:"1px solid #e6821e30", borderRadius:12, padding:"1.25rem", marginBottom:"1.5rem" }}>
          <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:700, color:"#f0ede6", marginBottom:"1rem" }}>Submit a service claim</div>
          <form onSubmit={submitClaim}>
            <label style={lbl}>Select booking *</label>
            <select style={inp} value={form.booking_id} onChange={e=>setForm(f=>({...f,booking_id:e.target.value}))} required>
              <option value="">Select a completed booking</option>
              {bookings.map(b=>(
                <option key={b.id} value={b.id}>{b.service_name} — #{b.booking_number} · {b.booking_date} · KES {Number(b.total_amount).toLocaleString()}</option>
              ))}
            </select>
            <label style={lbl}>Reason *</label>
            <select style={inp} value={form.reason} onChange={e=>setForm(f=>({...f,reason:e.target.value}))} required>
              <option value="">Select reason</option>
              {CLAIM_REASONS.map(r=><option key={r} value={r}>{r}</option>)}
            </select>
            <label style={lbl}>Describe what went wrong *</label>
            <textarea style={{ ...inp, resize:"vertical", minHeight:100 }} placeholder="Please provide as much detail as possible. This helps us investigate and resolve your claim faster." value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} required/>
            <div style={{ background:"#0f0f0f", borderRadius:8, padding:"0.75rem", marginBottom:12, fontSize:11, color:"#666", lineHeight:1.6 }}>
              ⚠️ Claims must be submitted within 7 days of service completion. False claims may result in account suspension.
            </div>
            <div style={{ display:"flex", gap:8 }}>
              <button type="submit" disabled={submitting}
                style={{ background:submitting?"#333":"#e6821e", border:"none", borderRadius:9, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:13, fontWeight:700, padding:"11px 24px", cursor:submitting?"not-allowed":"pointer" }}>
                {submitting?"Submitting...":"Submit claim"}
              </button>
              <button type="button" onClick={()=>{ setShowForm(false); setForm({ booking_id:"", reason:"", description:"" }) }}
                style={{ background:"none", border:"1px solid #333", borderRadius:9, color:"#666", fontSize:13, padding:"11px 16px", cursor:"pointer" }}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {loading&&<div style={{ color:"#555", fontSize:13 }}>Loading...</div>}

      {/* Claims tab */}
      {tab==="claims"&&(
        <div>
          {!loading&&claims.length===0&&(
            <div style={{ color:"#444", fontSize:13, textAlign:"center", padding:"2rem" }}>
              <div style={{ fontSize:32, marginBottom:10 }}>✅</div>
              No claims yet — we hope all your services have been great!
            </div>
          )}
          {claims.map(c=>(
            <div key={c.id} style={{ background:"#111", border:`1px solid ${SC[c.status]||"#1e1e1e"}30`, borderRadius:10, padding:"1rem", marginBottom:8 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4, flexWrap:"wrap" }}>
                    <div style={{ fontSize:13, fontWeight:600, color:"#f0ede6" }}>{c.bookings?.service_name}</div>
                    <span style={{ fontSize:10, padding:"2px 8px", borderRadius:10, background:`${SC[c.status]||"#888"}20`, color:SC[c.status]||"#888" }}>{c.status?.replace("_"," ")}</span>
                  </div>
                  <div style={{ fontSize:11, color:"#555", marginBottom:2 }}>#{c.bookings?.booking_number} · {c.bookings?.booking_date}</div>
                  <div style={{ fontSize:12, color:"#888", marginBottom:2 }}>Reason: {c.reason}</div>
                  <div style={{ fontSize:11, color:"#666", fontStyle:"italic" }}>"{c.description}"</div>
                  {c.admin_notes&&<div style={{ fontSize:11, color:"#378add", marginTop:4 }}>Admin: "{c.admin_notes}"</div>}
                  <div style={{ fontSize:10, color:"#444", marginTop:4 }}>{new Date(c.created_at).toLocaleString()}</div>
                </div>
                <div style={{ textAlign:"right", flexShrink:0 }}>
                  <div style={{ fontFamily:"Syne", fontSize:13, fontWeight:700, color:"#e6821e" }}>KES {Number(c.bookings?.total_amount||0).toLocaleString()}</div>
                </div>
              </div>
              {c.status==="approved"&&(
                <div style={{ marginTop:8, padding:"0.6rem", background:"#071a12", borderRadius:7, fontSize:12, color:"#1d9e75" }}>
                  ✅ Claim approved — check your vouchers tab for your service voucher
                </div>
              )}
              {c.status==="rejected"&&c.admin_notes&&(
                <div style={{ marginTop:8, padding:"0.6rem", background:"#1a0808", borderRadius:7, fontSize:12, color:"#e24b4a" }}>
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
                <div key={v.id} style={{ background:"#071a12", border:"1px solid #1d9e7540", borderRadius:10, padding:"1rem", marginBottom:8 }}>
                  <div style={{ fontFamily:"Syne", fontSize:18, fontWeight:800, color:"#1d9e75", letterSpacing:2, marginBottom:4 }}>{v.voucher_code}</div>
                  <div style={{ fontSize:12, color:"#888" }}>Worth KES {Number(v.amount).toLocaleString()} · Expires {new Date(v.expires_at).toLocaleDateString()}</div>
                  <div style={{ fontSize:11, color:"#555", marginTop:4 }}>Use this code when booking any service</div>
                </div>
              ))}
            </div>
          )}
          {usedVouchers.length>0&&(
            <div style={{ marginBottom:"1.5rem" }}>
              <div style={{ fontSize:11, color:"#555", fontWeight:700, textTransform:"uppercase", marginBottom:8 }}>Used vouchers</div>
              {usedVouchers.map(v=>(
                <div key={v.id} style={{ background:"#111", border:"1px solid #1e1e1e", borderRadius:10, padding:"1rem", marginBottom:8, opacity:0.6 }}>
                  <div style={{ fontFamily:"Syne", fontSize:15, fontWeight:800, color:"#555", letterSpacing:2, marginBottom:4 }}>{v.voucher_code}</div>
                  <div style={{ fontSize:11, color:"#444" }}>KES {Number(v.amount).toLocaleString()} · Used</div>
                </div>
              ))}
            </div>
          )}
          {expiredVouchers.length>0&&(
            <div>
              <div style={{ fontSize:11, color:"#444", fontWeight:700, textTransform:"uppercase", marginBottom:8 }}>Expired vouchers</div>
              {expiredVouchers.map(v=>(
                <div key={v.id} style={{ background:"#111", border:"1px solid #1e1e1e", borderRadius:10, padding:"1rem", marginBottom:8, opacity:0.4 }}>
                  <div style={{ fontFamily:"Syne", fontSize:15, fontWeight:800, color:"#444", letterSpacing:2, marginBottom:4 }}>{v.voucher_code}</div>
                  <div style={{ fontSize:11, color:"#333" }}>KES {Number(v.amount).toLocaleString()} · Expired {new Date(v.expires_at).toLocaleDateString()}</div>
                </div>
              ))}
            </div>
          )}
          {vouchers.length===0&&(
            <div style={{ color:"#444", fontSize:13, textAlign:"center", padding:"2rem" }}>
              <div style={{ fontSize:32, marginBottom:10 }}>🎟️</div>
              No vouchers yet
            </div>
          )}
        </div>
      )}
    </div>
  )
}
