import { useEffect, useState, useRef } from "react"
import { ShieldIcon } from "../../lib/cccIcons"
import { supabase } from "../../lib/supabase"
import { validateFile, sanitizeFilePath } from "../../lib/uploadValidation"
import { useAuth } from "../../contexts/AuthContext"
import useIsMobile from "../../lib/useIsMobile"
import ClaimChat from "../shared/ClaimChat"
import toast from "react-hot-toast"

const SC = { pending:"#e6821e", under_review:"#378add", approved:"#1d9e75", rejected:"#e24b4a" }

const CLAIM_REASONS = [
  "Customer vehicle was in undisclosed poor condition",
  "Customer provided wrong pickup location deliberately",
  "Customer was abusive or threatening",
  "Customer had undisclosed vehicle damage before pickup",
  "Customer no-show after driver arrived",
  "Customer made false damage claim against driver",
  "Other",
]

export default function DriverClaims() {
  const { user, profile } = useAuth()
  const isMobile = useIsMobile()
  const [claims, setClaims] = useState([])
  const [filedClaims, setFiledClaims] = useState([])
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [chatClaim, setChatClaim] = useState(null)
  const [tab, setTab] = useState("against")
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [evidencePhotos, setEvidencePhotos] = useState([])
  const [uploadingEvidence, setUploadingEvidence] = useState(false)
  const evidenceInputRef = useRef(null)
  const [form, setForm] = useState({ booking_id:"", reason:"", description:"" })

  useEffect(() => {
    if (!user) return
    load()
    const sub = supabase.channel("driver-claims-"+user.id)
      .on("postgres_changes", { event:"UPDATE", schema:"public", table:"service_claims", filter:`driver_id=eq.${user.id}` }, () => load())
      .subscribe()
    return () => supabase.removeChannel(sub)
  }, [user])

  async function load() {
    setLoading(true)
    const [{ data: cls }, { data: filed }, { data: bks }] = await Promise.all([
      supabase.from("service_claims")
        .select("*, bookings(service_name,booking_number,booking_date,total_amount), customer:profiles!service_claims_customer_id_fkey(first_name,last_name)")
        .eq("driver_id", user.id).order("created_at", { ascending:false }),
      supabase.from("service_claims")
        .select("*, bookings(service_name,booking_number,booking_date), against:profiles!service_claims_against_id_fkey(first_name,last_name)")
        .eq("claimant_id", user.id).eq("claimant_type","driver").order("created_at", { ascending:false }),
      supabase.from("bookings")
        .select("id,service_name,booking_number,booking_date,customer_id,profiles!bookings_customer_id_fkey(first_name,last_name)")
        .eq("driver_id", user.id).eq("status","completed").order("created_at", { ascending:false }).limit(20)
    ])
    setClaims(cls||[])
    setFiledClaims(filed||[])
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
        claimant_type: "driver",
        against_id: booking?.customer_id,
        against_type: "customer",
        customer_id: booking?.customer_id,
        driver_id: user.id,
        booking_id: form.booking_id,
        reason: form.reason,
        description: form.description,
        status: "pending",
      })
      if (error) throw error
      const { data: admins } = await supabase.from("profiles").select("id").eq("role","admin")
      for (const admin of (admins||[])) {
        await supabase.from("notifications").insert({
          user_id: admin.id,
          title: "Driver filed claim against customer 🛡️",
          message: (profile?.first_name||"Driver")+" "+(profile?.last_name||"")+" filed a claim: "+form.reason,
          type: "warning"
        })
      }
      if (booking?.customer_id) {
        await supabase.from("notifications").insert({
          user_id: booking.customer_id,
          title: "A claim has been filed against you ⚠️",
          message: "A driver has filed a claim regarding booking "+booking.booking_number+". Our team will review within 24 hours.",
          type: "warning"
        })
      }
      toast.success("Claim submitted successfully")
      setShowForm(false)
      setForm({ booking_id:"", reason:"", description:"" })
      setEvidencePhotos([])
      load()
    } catch(err) { toast.error(err.message) }
    finally { setSubmitting(false) }
  }

  const inp = { width:"100%", background:"#f5f5f5", border:"1px solid #e0e0e0", borderRadius:8, padding:"10px 12px", fontSize:13, outline:"none", marginBottom:12, boxSizing:"border-box" }
  const lbl = { fontSize:11, color:"#666", display:"block", marginBottom:4, fontWeight:600 }

  return (
    <div>
      <div style={{ fontFamily:"Syne", fontSize:18, fontWeight:800, color:"#000", marginBottom:"1rem", display:"flex", alignItems:"center", gap:8 }}><ShieldIcon size={20} color="#e6821e"/> Claims Center</div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8, marginBottom:"1rem" }}>
        {[
          { label:"Against you", value:claims.length, color:"#e24b4a" },
          { label:"Filed by you", value:filedClaims.length, color:"#8b5cf6" },
          { label:"Pending", value:claims.filter(c=>c.status==="pending").length, color:"#e6821e" },
        ].map(s=>(
          <div key={s.label} style={{ background:"#f8f8f8", borderRadius:10, padding:"0.75rem", textAlign:"center", border:"1px solid #eee" }}>
            <div style={{ fontFamily:"Syne", fontSize:16, fontWeight:800, color:s.color }}>{s.value}</div>
            <div style={{ fontSize:10, color:"#888", marginTop:2 }}>{s.label}</div>
          </div>
        ))}
      </div>
      <div style={{ display:"flex", gap:6, marginBottom:"1rem", flexWrap:"wrap" }}>
        {[
          { k:"against", l:"Against you ("+claims.length+")" },
          { k:"filed", l:"Filed by you ("+filedClaims.length+")" },
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
            <textarea style={{ ...inp, resize:"vertical", minHeight:80 }}
              placeholder="Describe what happened..." rows={4}
              value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} required/>
            <div style={{ background:"#fff8f0", border:"1px solid #e6821e30", borderRadius:8, padding:"0.75rem", marginBottom:12, fontSize:11, color:"#666" }}>
              ⚠️ Only file genuine claims. False claims may result in account suspension.
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
      {tab==="against"&&(
        <div>
          {!loading&&claims.length===0&&(
            <div style={{ textAlign:"center", padding:"2rem", color:"#888" }}>
              <div style={{ fontSize:32, marginBottom:10 }}>✅</div>
              No claims against you — great work!
            </div>
          )}
          {claims.map(c=>(
            <div key={c.id} style={{ background:"#f8f8f8", border:"1px solid #eee", borderLeft:`4px solid ${SC[c.status]||"#eee"}`, borderRadius:10, padding:"1rem", marginBottom:8 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontFamily:"Syne", fontSize:13, fontWeight:700, marginBottom:2 }}>{c.bookings?.service_name}</div>
                  <div style={{ fontSize:11, color:"#888" }}>#{c.bookings?.booking_number} · {c.bookings?.booking_date}</div>
                  <div style={{ fontSize:11, color:"#888" }}>Customer: {c.customer?.first_name} {c.customer?.last_name}</div>
                  <div style={{ fontSize:12, color:"#e6821e", marginTop:4 }}>Reason: {c.reason}</div>
                  {c.admin_notes&&<div style={{ fontSize:11, color:"#378add", marginTop:4 }}>Admin: "{c.admin_notes}"</div>}
                </div>
                <span style={{ fontSize:10, padding:"2px 8px", borderRadius:10, background:(SC[c.status]||"#888")+"20", color:SC[c.status]||"#888", fontWeight:600 }}>{c.status?.replace("_"," ")}</span>
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
            </div>
          ))}
        </div>
      )}
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
    </div>
  )
}

