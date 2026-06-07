import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"
import { useAuth } from "../../contexts/AuthContext"
import { useLanguage } from "../../contexts/LanguageContext"
import toast from "react-hot-toast"

export default function CustomerReviews() {
  const { user } = useAuth()
  const { t } = useLanguage()
  const [completedBookings, setCompletedBookings] = useState([])
  const [myReviews, setMyReviews] = useState([])
  const [tab, setTab] = useState("pending")
  const [loading, setLoading] = useState(true)
  const [reviewing, setReviewing] = useState(null)
  const [form, setForm] = useState({ provider_rating:0, provider_review:"", driver_rating:0, driver_review:"" })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => { if (user) load() }, [user])

  async function load() {
    const [{ data: bookings }, { data: reviews }] = await Promise.all([
      supabase.from("bookings").select("*").eq("customer_id",user.id).eq("status","completed").order("created_at",{ascending:false}),
      supabase.from("reviews").select("*, profile_public!reviews_provider_id_fkey(first_name,last_name,business_name)").eq("customer_id",user.id).order("created_at",{ascending:false})
    ])
    setCompletedBookings(bookings||[])
    setMyReviews(reviews||[])
    setLoading(false)
  }

  const reviewedBookingIds = new Set(myReviews.map(r=>r.booking_id))
  const pendingReview = completedBookings.filter(b=>!reviewedBookingIds.has(b.id))

  async function submitReview(e) {
    e.preventDefault()
    if (form.provider_rating===0) return toast.error(t("error"))
    setSubmitting(true)
    try {
      const { error } = await supabase.from("reviews").insert({
        booking_id:reviewing.id, customer_id:user.id, provider_id:reviewing.provider_id,
        driver_id:reviewing.driver_id||null, provider_rating:form.provider_rating,
        provider_review:form.provider_review||null,
        driver_rating:reviewing.is_concierge&&form.driver_rating>0?form.driver_rating:null,
        driver_review:reviewing.is_concierge&&form.driver_review?form.driver_review:null,
      })
      if (error) throw error
      toast.success(t("success"))
      setReviewing(null)
      setForm({ provider_rating:0, provider_review:"", driver_rating:0, driver_review:"" })
      load()
    } catch(err) { toast.error(err.message) }
    finally { setSubmitting(false) }
  }

  function StarRating({ value, onChange, label }) {
    return (
      <div style={{ marginBottom:"1rem" }}>
        <div style={{ fontSize:11, color:"#666", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:8 }}>{label}</div>
        <div style={{ display:"flex", gap:6 }}>
          {[1,2,3,4,5].map(star=>(
            <button key={star} type="button" onClick={()=>onChange(star)}
              style={{ background:"none", border:"none", cursor:"pointer", fontSize:28, color:star<=value?"#e6821e":"#333", padding:"2px" }}>★</button>
          ))}
        </div>
        {value>0&&<div style={{ fontSize:11, color:"#e6821e", marginTop:4 }}>{["","Poor","Fair","Good","Very good","Excellent"][value]}</div>}
      </div>
    )
  }

  const pendingLabel = t("language")==="sw" ? "Zinazosubiri" : "Pending reviews"
  const submittedLabel = t("language")==="sw" ? "Maoni yangu" : "My reviews"
  const inp = { width:"100%", background:"#ffffff", border:"1px solid #e5e5e5", borderRadius:8, padding:"10px 12px", color:"#000000", fontSize:13, outline:"none", fontFamily:"'DM Sans',sans-serif", resize:"vertical" }

  return (
    <div>
      <div style={{ display:"flex", gap:6, marginBottom:"1.25rem" }}>
        {[
          { k:"pending", l:`${pendingLabel} (${pendingReview.length})` },
          { k:"submitted", l:`${submittedLabel} (${myReviews.length})` },
        ].map(t2=>(
          <button key={t2.k} onClick={()=>setTab(t2.k)}
            style={{ padding:"8px 16px", borderRadius:8, border:"none", fontSize:12, cursor:"pointer", background:tab===t2.k?"#e6821e":"#111", color:tab===t2.k?"#fff":"#666", fontFamily:"'DM Sans',sans-serif", fontWeight:tab===t2.k?700:400 }}>
            {t2.l}
          </button>
        ))}
      </div>

      {loading&&<div style={{ color:"#777777", fontSize:13 }}>{t("loading")}</div>}

      {tab==="pending"&&!reviewing&&(
        <div>
          {pendingReview.length===0&&!loading&&<div style={{ color:"#888888", fontSize:13, textAlign:"center", padding:"2rem" }}>{t("noDataYet")}</div>}
          {pendingReview.map(b=>(
            <div key={b.id} style={{ background:"#ffffff", border:"1px solid #eeeeee", borderRadius:10, padding:"1rem", marginBottom:8, display:"flex", alignItems:"center", gap:12 }}>
              <div style={{ width:42, height:42, background:"#1a1208", borderRadius:9, display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, flexShrink:0 }}>🔧</div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:14, fontWeight:500, color:"#000000" }}>{b.service_name}</div>
                <div style={{ fontSize:11, color:"#777777", marginTop:2 }}>{b.booking_date} · KES {Number(b.total_amount).toLocaleString()}</div>
              </div>
              <button onClick={()=>{ setReviewing(b); setForm({ provider_rating:0, provider_review:"", driver_rating:0, driver_review:"" }) }}
                style={{ background:"#e6821e", border:"none", borderRadius:8, color:"#fff", fontSize:12, fontWeight:700, padding:"8px 14px", cursor:"pointer", fontFamily:"Syne,sans-serif", flexShrink:0 }}>
                {t("language")==="sw"?"Kadiria":"Rate"}
              </button>
            </div>
          ))}
        </div>
      )}

      {tab==="pending"&&reviewing&&(
        <div>
          <button onClick={()=>setReviewing(null)} style={{ background:"none", border:"none", color:"#666", cursor:"pointer", fontSize:13, marginBottom:"1rem", fontFamily:"'DM Sans',sans-serif", padding:0 }}>
            ← {t("back")}
          </button>
          <div style={{ background:"#ffffff", border:"1px solid #eeeeee", borderRadius:12, padding:"1.25rem" }}>
            <div style={{ fontFamily:"Syne", fontSize:15, fontWeight:800, color:"#000000", marginBottom:2 }}>{reviewing.service_name}</div>
            <div style={{ fontSize:11, color:"#777777", marginBottom:"1.5rem" }}>{reviewing.booking_date}</div>
            <form onSubmit={submitReview}>
              <StarRating value={form.provider_rating} onChange={v=>setForm(f=>({...f,provider_rating:v}))} label={t("language")==="sw"?"Kadiria mtoa huduma":"Rate the service provider"}/>
              <div style={{ marginBottom:"1rem" }}>
                <div style={{ fontSize:11, color:"#666", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:6 }}>{t("language")==="sw"?"Maoni (hiari)":"Review (optional)"}</div>
                <textarea value={form.provider_review} onChange={e=>setForm(f=>({...f,provider_review:e.target.value}))} rows={3} placeholder={t("language")==="sw"?"Shiriki uzoefu wako...":"Share your experience..."} style={inp}/>
              </div>
              {reviewing.is_concierge&&(
                <>
                  <div style={{ height:1, background:"#f0f0f0", margin:"1rem 0" }}/>
                  <StarRating value={form.driver_rating} onChange={v=>setForm(f=>({...f,driver_rating:v}))} label={t("language")==="sw"?"Kadiria dereva (hiari)":"Rate the driver (optional)"}/>
                </>
              )}
              <button type="submit" disabled={submitting||form.provider_rating===0}
                style={{ width:"100%", background:form.provider_rating>0?"#e6821e":"#333", border:"none", borderRadius:9, color:form.provider_rating>0?"#fff":"#666", fontFamily:"Syne,sans-serif", fontSize:14, fontWeight:700, padding:"13px", cursor:form.provider_rating>0?"pointer":"not-allowed" }}>
                {submitting?t("loading"):t("submit")}
              </button>
            </form>
          </div>
        </div>
      )}

      {tab==="submitted"&&(
        <div>
          {myReviews.length===0&&<div style={{ color:"#888888", fontSize:13, textAlign:"center", padding:"2rem" }}>{t("noDataYet")}</div>}
          {myReviews.map(r=>(
            <div key={r.id} style={{ background:"#ffffff", border:"1px solid #eeeeee", borderRadius:10, padding:"1rem", marginBottom:8 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
                <div>
                  <div style={{ fontSize:13, fontWeight:500, color:"#000000" }}>
                    {r.profile_public?.business_name||`${r.profile_public?.first_name||""} ${r.profile_public?.last_name||""}`}
                  </div>
                  <div style={{ fontSize:10, color:"#888888", marginTop:2 }}>{new Date(r.created_at).toLocaleDateString()}</div>
                </div>
                <div style={{ display:"flex", gap:1 }}>
                  {[1,2,3,4,5].map(s=><span key={s} style={{ color:s<=r.provider_rating?"#e6821e":"#333", fontSize:16 }}>★</span>)}
                </div>
              </div>
              {r.provider_review&&<div style={{ fontSize:12, color:"#555555", lineHeight:1.5, marginBottom:8 }}>"{r.provider_review}"</div>}
              {r.provider_response&&(
                <div style={{ background:"#ffffff", border:"1px solid #e5e5e5", borderRadius:8, padding:"0.75rem", marginTop:8 }}>
                  <div style={{ fontSize:10, color:"#777777", marginBottom:4 }}>{t("language")==="sw"?"Jibu la mtoa huduma":"Provider reply"}</div>
                  <div style={{ fontSize:12, color:"#666666", lineHeight:1.5 }}>{r.provider_response}</div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}



