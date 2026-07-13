import { useEffect, useState, useRef } from "react"
import { supabase } from "../../lib/supabase"
import { validateFile, sanitizeFilePath } from "../../lib/uploadValidation"
import { useAuth } from "../../contexts/AuthContext"
import useIsMobile from "../../lib/useIsMobile"
import ClaimChat from "../shared/ClaimChat"
import toast from "react-hot-toast"

const SC = { pending:"#e6821e", under_review:"#8b5cf6", approved:"#1d9e75", rejected:"#e24b4a" }

const CLAIM_REASONS = [
  "Customer provided false vehicle information",
  "Customer was abusive or threatening",
  "Customer damaged provider equipment",
  "Customer disputed legitimate charges fraudulently",
  "Customer provided wrong location deliberately",
  "Customer no-show after booking confirmed",
  "Other",
]

export default function ProviderClaims() {
  const { user, profile } = useAuth()
  const isMobile = useIsMobile()
  const [claims, setClaims] = useState([])
  const [filedClaims, setFiledClaims] = useState([])
  const [penalties, setPenalties] = useState([])
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState("against")
  const [chatClaim, setChatClaim] = useState(null)
  const [adminId, setAdminId] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [evidencePhotos, setEvidencePhotos] = useState([])
  const [uploadingEvidence, setUploadingEvidence] = useState(false)
  const evidenceInputRef = useRef(null)
  const [form, setForm] = useState({ booking_id:"", reason:"", description:"" })

  useEffect(() => {
    if (!user) return
    load()
    supabase.from("profiles").select("id").eq("role","admin").limit(1)
      .then(({ data }) => { if (data?.length) setAdminId(data[0].id) })
    const sub = supabase.channel("provider-claims-"+user.id)
      .on("postgres_changes", { event:"UPDATE", schema:"public", table:"service_claims", filter:`provider_id=eq.${user.id}` }, () => load())
      .subscribe()
    return () => supabase.removeChannel(sub)
  }, [user])

  async function load() {
    const [{ data: cls }, { data: filed }, { data: pens }, { data: bks }] = await Promise.all([
      supabase.from("service_claims")
        .select("*, bookings(service_name,booking_number,booking_date,total_amount), customer:profiles!service_claims_customer_id_fkey(first_name,last_name)")
        .eq("provider_id", user.id).order("created_at", { ascending:false }),
      supabase.from("service_claims")
        .select("*, bookings(service_name,booking_number,booking_date), against:profiles!service_claims_against_id_fkey(first_name,last_name)")
        .eq("claimant_id", user.id).eq("claimant_type","provider").order("created_at", { ascending:false }),
      supabase.from("provider_penalties")
        .select("*").eq("provider_id", user.id).order("created_at", { ascending:false }),
      supabase.from("bookings")
        .select("id,service_name,booking_number,booking_date,customer_id,profiles!bookings_customer_id_fkey(first_name,last_name)")
        .eq("provider_id", user.id).eq("status","completed").order("created_at", { ascending:false }).limit(20)
    ])
    setClaims(cls||[])
    setFiledClaims(filed||[])
    setPenalties(pens||[])
    setBookings(bks||[])
    setLoading(false)
  }

  async function uploadEvidencePhoto(file) {
    const _v = validateFile(file, "image")
    if (!_v.valid) { toast.error(_v.error); return }

    const ext = file.name.split(".").pop()
    const path = `claims/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
    const { error } = await supabase.storage.from("claim-evidence").upload(path, file)
    if (error) throw error
    const { data } = supabase.storage.from("claim-evidence").getPublicUrl(path)
    return data.publicUrl
  }

  async function handleEvidenceSelect(e) {
    const files = Array.from(e.target.files).slice(0, 3)
    setUploadingEvidence(true)
    try {
      const urls = await Promise.all(files.map(uploadEvidencePhoto))
      setEvidencePhotos(prev => [...prev, ...urls].slice(0, 3))
    } catch(err) { console.error("Photo upload failed:", err.message) }
    setUploadingEvidence(false)
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
        claimant_id: user.id,
        claimant_type: "provider",
        against_id: booking?.customer_id,
        against_type: "customer",
        customer_id: booking?.customer_id,
        provider_id: user.id,
        booking_id: form.booking_id,
        reason: form.reason,
        description: form.description,
        status: "pending",
      })
      if (error) throw error
      // Notify admin
      const { data: admins } = await supabase.from("profiles").select("id").eq("role","admin")
      for (const admin of (admins||[])) {
        await supabase.from("notifications").insert({
          user_id: admin.id,
          title: "Provider filed claim against customer 🛡️",
          message: (profile?.first_name||"Provider")+" "+(profile?.last_name||"")+" filed a claim: "+form.reason,
          type: "warning"
        })
      }
      // Notify customer
      if (booking?.customer_id) {
        await supabase.from("notifications").insert({
          user_id: booking.customer_id,
          title: "A claim has been filed against you ⚠️",
          message: "A service provider has filed a claim regarding booking "+booking.booking_number+". Our team will review within 24 hours.",
          type: "warning"
        })
      }
      toast.success("Claim submitted — our team will review within 24 hours")
      setShowForm(false)
      setForm({ booking_id:"", reason:"", description:"" })
      setEvidencePhotos([])
      load()
    } catch(err) { toast.error(err.message) }
    finally { setSubmitting(false) }
  }

  const activePenalties = penalties.filter(p=>p.is_active)
  const totalDeducted = penalties.reduce((sum,p)=>sum+Number(p.amount_deducted||0),0)
  const inp = { width:"100%", background:"#f5f5f5", border:"1px solid #e0e0e0", borderRadius:8, padding:"10px 12px", fontSize:13, outline:"none", marginBottom:12, boxSizing:"border-box" }
  const lbl = { fontSize:11, color:"#666", display:"block", marginBottom:4, fontWeight:600 }

  return (
    <div>
      <div style={{ fontFamily:"Syne", fontSize:18, fontWeight:800, color:"#000", marginBottom:"1rem" }}>🛡️ Claims Center</div>

      {/* Stats */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8, marginBottom:"1rem" }}>
        {[
          { label:"Against you", value:claims.length, color:"#e24b4a" },
          { label:"Filed by you", value:filedClaims.length, color:"#8b5cf6" },
          { label:"Penalties", value:activePenalties.length, color:"#e6821e" },
          { label:"Deducted", value:"KES "+totalDeducted.toLocaleString(), color:"#e24b4a" },
        ].map(s=>(
          <div key={s.label} style={{ background:"#f8f8f8", borderRadius:10, padding:"0.75rem 0.5rem", textAlign:"center", border:"1px solid #eee" }}>
            <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:800, color:s.color }}>{s.value}</div>
            <div style={{ fontSize:10, color:"#888", marginTop:2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display:"flex", gap:6, marginBottom:"1rem", flexWrap:"wrap" }}>
        {[
          { k:"against", l:"Claims against you ("+claims.length+")" },
          { k:"filed", l:"Claims you filed ("+filedClaims.length+")" },
          { k:"penalties", l:"Penalties ("+penalties.length+")" },
        ].map(t=>(
          <button key={t.k} onClick={()=>setTab(t.k)}
            style={{ padding:"7px 14px", borderRadius:8, border:"none", fontSize:12, cursor:"pointer", background:tab===t.k?"#e6821e":"#f0f0f0", color:tab===t.k?"#fff":"#555", fontWeight:tab===t.k?700:400 }}>
            {t.l}
          </button>
        ))}
        <button onClick={()=>setShowForm(!showForm)}
          style={{ marginLeft:"auto", background:"#8b5cf6", border:"none", borderRadius:8, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:12, fontWeight:700, padding:"7px 14px", cursor:"pointer" }}>
          + File a claim
        </button>
      </div>

      {/* File claim form */}
      {showForm&&(
        <div style={{ background:"#f8f8f8", border:"1px solid #8b5cf640", borderRadius:12, padding:"1.25rem", marginBottom:"1rem" }}>
          <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:800, marginBottom:"1rem" }}>File a Claim Against a Customer</div>
          <form onSubmit={submitClaim}>
            <label style={lbl}>Select booking *</label>
            <select style={inp} value={form.booking_id} onChange={e=>setForm(f=>({...f,booking_id:e.target.value}))} required>
              <option value="">Select a completed booking</option>
              {bookings.map(b=>(
                <option key={b.id} value={b.id}>{b.service_name} — #{b.booking_number} · {b.profiles?.first_name} {b.profiles?.last_name}</option>
              ))}
            </select>
            <label style={lbl}>Reason *</label>
            <select style={inp} value={form.reason} onChange={e=>setForm(f=>({...f,reason:e.target.value}))} required>
              <option value="">Select reason</option>
              {CLAIM_REASONS.map(r=><option key={r} value={r}>{r}</option>)}
            </select>
            <label style={lbl}>Description *</label>
            <textarea style={{ ...inp, resize:"vertical", minHeight:100 }}
              placeholder="Describe what happened in detail..." rows={4}
              value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} required/>
            <div style={{ background:"#fff8f0", border:"1px solid #e6821e30", borderRadius:8, padding:"0.75rem", marginBottom:12, fontSize:11, color:"#666" }}>
              ⚠️ False claims may result in account suspension. Only file claims for genuine incidents.
            </div>
              {/* Evidence photos */}
              <div style={{ marginBottom:12 }}>
                <div style={{ fontSize:11, color:"#666", fontWeight:600, marginBottom:6 }}>📸 Attach evidence photos (optional, max 3)</div>
                <input ref={evidenceInputRef} type="file" accept="image/*" multiple style={{ display:"none" }} onChange={handleEvidenceSelect}/>
                <div style={{ display:"flex", gap:6, flexWrap:"wrap", alignItems:"center" }}>
                  {evidencePhotos.map((url,i)=>(
                    <div key={i} style={{ position:"relative" }}>
                      <img src={url} alt="Evidence" style={{ width:60, height:60, objectFit:"cover", borderRadius:8, border:"1px solid #eee" }}/>
                      <button type="button" onClick={()=>setEvidencePhotos(p=>p.filter((_,j)=>j!==i))}
                        style={{ position:"absolute", top:-4, right:-4, background:"#e24b4a", border:"none", borderRadius:"50%", width:16, height:16, color:"#fff", fontSize:10, cursor:"pointer" }}>x</button>
                    </div>
                  ))}
                  {evidencePhotos.length<3&&(
                    <button type="button" onClick={()=>evidenceInputRef.current?.click()} disabled={uploadingEvidence}
                      style={{ width:60, height:60, background:"#f8f8f8", border:"2px dashed #ddd", borderRadius:8, cursor:"pointer", fontSize:20, color:"#aaa" }}>
                      {uploadingEvidence?"⏳":"📷"}
                    </button>
                  )}
                </div>
              </div>
            <div style={{ display:"flex", gap:8 }}>
              <button type="submit" disabled={submitting}
                style={{ background:submitting?"#ccc":"#8b5cf6", border:"none", borderRadius:9, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:13, fontWeight:700, padding:"11px 24px", cursor:submitting?"not-allowed":"pointer" }}>
                {submitting?"Submitting...":"Submit claim"}
              </button>
              <button type="button" onClick={()=>setShowForm(false)}
                style={{ background:"none", border:"1px solid #ddd", borderRadius:9, color:"#666", fontSize:13, padding:"11px 16px", cursor:"pointer" }}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {loading&&<div style={{ color:"#888", fontSize:13 }}>Loading...</div>}

      {/* Claims against provider tab */}
      {tab==="against"&&(
        <div>
          {!loading&&claims.length===0&&(
            <div style={{ textAlign:"center", padding:"2rem", color:"#888" }}>
              <div style={{ fontSize:32, marginBottom:10 }}>✅</div>
              No claims against your services — keep up the great work!
            </div>
          )}
          {claims.map(c=>(
            <div key={c.id} style={{ background:"#f8f8f8", border:"1px solid #eee", borderLeft:`4px solid ${SC[c.status]||"#eee"}`, borderRadius:10, padding:"1rem", marginBottom:8 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4, flexWrap:"wrap" }}>
                    <div style={{ fontSize:13, fontWeight:700, color:"#000" }}>{c.bookings?.service_name}</div>
                    <span style={{ fontSize:10, padding:"2px 8px", borderRadius:10, background:(SC[c.status]||"#888")+"20", color:SC[c.status]||"#888" }}>{c.status?.replace("_"," ")}</span>
                  </div>
                  <div style={{ fontSize:11, color:"#888" }}>#{c.bookings?.booking_number} · {c.bookings?.booking_date}</div>
                  <div style={{ fontSize:11, color:"#888" }}>Customer: {c.customer?.first_name} {c.customer?.last_name}</div>
                  <div style={{ fontSize:12, color:"#e6821e", marginTop:4 }}>Reason: {c.reason}</div>
                  {c.admin_notes&&<div style={{ fontSize:11, color:"#378add", marginTop:4 }}>Admin: "{c.admin_notes}"</div>}
                </div>
                <div style={{ textAlign:"right" }}>
                  <div style={{ fontFamily:"Syne", fontSize:13, fontWeight:700, color:"#e24b4a" }}>KES {Number(c.bookings?.total_amount||0).toLocaleString()}</div>
                </div>
              </div>
              {(c.status==="pending"||c.status==="under_review")&&(
                <div style={{ marginTop:8 }}>
                  <button onClick={()=>setChatClaim(chatClaim===c.id?null:c.id)}
                    style={{ background:"#eff6ff", border:"1px solid #378add40", borderRadius:7, color:"#378add", fontSize:11, padding:"5px 12px", cursor:"pointer" }}>
                    💬 {chatClaim===c.id?"Close":"Submit response / evidence"}
                  </button>
                  {chatClaim===c.id&&(
                    <div style={{ marginTop:8 }}>
                      <ClaimChat claimId={c.id} claim={c} onClose={()=>setChatClaim(null)}/>
                    </div>
                  )}
                </div>
              )}
              {c.status==="approved"&&(
                <div style={{ marginTop:8, padding:"0.6rem", background:"#fff5f5", borderRadius:7, fontSize:11, color:"#e24b4a" }}>
                  ❗ Claim approved — KES {Number(c.bookings?.total_amount||0).toLocaleString()} deducted. Dispute within 48 hours via support.
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Claims filed by provider tab */}
      {tab==="filed"&&(
        <div>
          {!loading&&filedClaims.length===0&&(
            <div style={{ textAlign:"center", padding:"2rem", color:"#888" }}>
              <div style={{ fontSize:32, marginBottom:10 }}>📋</div>
              No claims filed yet
            </div>
          )}
          {filedClaims.map(c=>(
            <div key={c.id} style={{ background:"#f8f8f8", border:"1px solid #eee", borderLeft:`4px solid ${SC[c.status]||"#eee"}`, borderRadius:10, padding:"1rem", marginBottom:8 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontFamily:"Syne", fontSize:13, fontWeight:700, marginBottom:2 }}>{c.bookings?.service_name}</div>
                  <div style={{ fontSize:11, color:"#888" }}>Against: {c.against?.first_name} {c.against?.last_name} (Customer)</div>
                  <div style={{ fontSize:12, color:"#e6821e", marginTop:4 }}>Reason: {c.reason}</div>
                  {c.admin_notes&&<div style={{ fontSize:11, color:"#378add", marginTop:4 }}>Admin decision: "{c.admin_notes}"</div>}
                  <div style={{ fontSize:10, color:"#aaa", marginTop:4 }}>{new Date(c.created_at).toLocaleDateString()}</div>
                </div>
                <span style={{ fontSize:10, padding:"2px 8px", borderRadius:10, background:(SC[c.status]||"#888")+"20", color:SC[c.status]||"#888", fontWeight:600 }}>{c.status?.replace("_"," ")}</span>
              </div>
              <div style={{ marginTop:8 }}>
                <button onClick={()=>setChatClaim(chatClaim===c.id?null:c.id)}
                  style={{ background:"#f5f3ff", border:"1px solid #8b5cf640", borderRadius:7, color:"#8b5cf6", fontSize:11, padding:"5px 12px", cursor:"pointer" }}>
                  💬 {chatClaim===c.id?"Close":"View discussion"}
                </button>
                {chatClaim===c.id&&(
                  <div style={{ marginTop:8 }}>
                    <ClaimChat claimId={c.id} claim={c} onClose={()=>setChatClaim(null)}/>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Penalties tab */}
      {tab==="penalties"&&(
        <div>
          {penalties.length===0&&<div style={{ textAlign:"center", padding:"2rem", color:"#888" }}>No penalties yet — keep up the great work!</div>}
          {penalties.map(p=>(
            <div key={p.id} style={{ background:"#f8f8f8", border:`1px solid ${p.is_active?"#e24b4a20":"#eee"}`, borderLeft:`4px solid ${p.is_active?"#e24b4a":"#ccc"}`, borderRadius:10, padding:"1rem", marginBottom:8 }}>
              <div style={{ display:"flex", justifyContent:"space-between" }}>
                <div>
                  <div style={{ fontSize:12, fontWeight:700, color:"#e24b4a" }}>{p.penalty_type?.replace(/_/g," ").toUpperCase()}</div>
                  <div style={{ fontSize:11, color:"#888", marginTop:2 }}>{p.reason}</div>
                  {p.expires_at&&<div style={{ fontSize:10, color:"#888", marginTop:2 }}>Until: {new Date(p.expires_at).toLocaleString()}</div>}
                  <div style={{ fontSize:10, color:"#aaa", marginTop:2 }}>{new Date(p.created_at).toLocaleDateString()}</div>
                </div>
                <div style={{ textAlign:"right" }}>
                  {p.amount_deducted>0&&<div style={{ fontFamily:"Syne", fontSize:13, fontWeight:700, color:"#e24b4a" }}>-KES {Number(p.amount_deducted).toLocaleString()}</div>}
                  <span style={{ fontSize:10, padding:"2px 8px", borderRadius:10, background:p.is_active?"#fff5f5":"#f0f0f0", color:p.is_active?"#e24b4a":"#888" }}>
                    {p.is_active?"Active":"Resolved"}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
