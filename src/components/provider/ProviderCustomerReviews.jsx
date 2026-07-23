import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"
import { useAuth } from "../../contexts/AuthContext"
import useIsMobile from "../../lib/useIsMobile"
import toast from "react-hot-toast"
import { filterReviewContent } from "../../lib/reviewFilter"

function StarRating({ value, onChange, color="#e6821e" }) {
  return (
    <div style={{ display:"flex", gap:6 }}>
      {[1,2,3,4,5].map(star=>(
        <button key={star} type="button" onClick={()=>onChange&&onChange(star)}
          style={{ background:"none", border:"none", cursor:onChange?"pointer":"default", fontSize:26, color:star<=value?color:"#ddd", padding:"2px" }}>★</button>
      ))}
    </div>
  )
}

export default function ProviderCustomerReviews() {
  const { user, profile } = useAuth()
  const isMobile = useIsMobile()
  const [bookings, setBookings] = useState([])
  const [myReviews, setMyReviews] = useState([])
  const [tab, setTab] = useState("pending")
  const [loading, setLoading] = useState(true)
  const [reviewing, setReviewing] = useState(null)
  const [form, setForm] = useState({ rating:0, review:"" })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => { if(user) load() }, [user])

  async function load() {
    const [{ data: bk }, { data: rv }] = await Promise.all([
      supabase.from("bookings").select("*, customer:profiles!bookings_customer_id_fkey(first_name,last_name,id)")
        .eq("provider_id", user.id).eq("status","completed").order("created_at",{ascending:false}),
      supabase.from("reviews").select("*").eq("provider_id", user.id)
        .not("customer_rating","is",null).order("created_at",{ascending:false})
    ])
    setBookings(bk||[])
    setMyReviews(rv||[])
    setLoading(false)
  }

  async function submitReview(e) {
    e.preventDefault()
    if(form.rating===0) return toast.error("Please select a rating")
    const check = filterReviewContent(form.review)
    if(check.hasContactInfo) return toast.error("Reviews cannot contain contact details")
    if(check.hasBadWords) return toast.error("Please keep your review professional")
    setSubmitting(true)
    try {
      // Check if review already exists for this booking
      const { data: existing } = await supabase.from("reviews")
        .select("id").eq("booking_id", reviewing.id).eq("provider_id", user.id).maybeSingle()
      
      if(existing) {
        // Update existing review
        await supabase.from("reviews").update({
          customer_rating: form.rating,
          customer_review: form.review||null,
          reviewed_by: "provider"
        }).eq("id", existing.id)
      } else {
        // Insert new review
        await supabase.from("reviews").insert({
          booking_id: reviewing.id,
          customer_id: reviewing.customer_id,
          provider_id: user.id,
          customer_rating: form.rating,
          customer_review: form.review||null,
          reviewed_by: "provider"
        })
      }
      
      // Notify customer
      await supabase.from("notifications").insert({
        user_id: reviewing.customer_id,
        title: "You received a review ⭐",
        message: (profile?.business_name||profile?.first_name||"Your provider")+" rated your booking experience "+form.rating+" stars.",
        type: "info"
      })

      // Push notification
      try {
        await fetch(import.meta.env.VITE_SUPABASE_URL+"/functions/v1/send-push", {
          method:"POST",
          headers:{"Content-Type":"application/json","Authorization":"Bearer "+import.meta.env.VITE_SUPABASE_ANON_KEY},
          body:JSON.stringify({ user_id:reviewing.customer_id, title:"You received a review ⭐", message:(profile?.business_name||profile?.first_name||"Your provider")+" rated your experience "+form.rating+" stars." })
        })
      } catch(e) {}

      toast.success("Review submitted!")
      setReviewing(null)
      setForm({ rating:0, review:"" })
      load()
    } catch(err) { toast.error(err.message) }
    finally { setSubmitting(false) }
  }

  const reviewedBookingIds = new Set(myReviews.map(r=>r.booking_id))
  const pending = bookings.filter(b=>!reviewedBookingIds.has(b.id))
  const inp = { width:"100%", background:"#fff", border:"1px solid #e0e0e0", borderRadius:8, padding:"10px 12px", fontSize:13, outline:"none", fontFamily:"DM Sans,sans-serif", resize:"vertical", boxSizing:"border-box" }

  if(reviewing) return (
    <div>
      <button onClick={()=>setReviewing(null)} style={{ background:"none", border:"none", color:"#666", cursor:"pointer", fontSize:13, marginBottom:"1rem", padding:0 }}>← Back</button>
      <div style={{ background:"#fff", border:"1px solid #eee", borderRadius:12, padding:"1.25rem" }}>
        <div style={{ fontFamily:"Syne", fontSize:15, fontWeight:800, marginBottom:2 }}>{reviewing.service_name}</div>
        <div style={{ fontSize:11, color:"#888", marginBottom:"0.5rem" }}>{reviewing.booking_date} · {reviewing.customer?.first_name} {reviewing.customer?.last_name}</div>
        <hr style={{ border:"none", borderTop:"1px solid #f0f0f0", margin:"1rem 0" }}/>
        <div style={{ fontSize:12, color:"#666", marginBottom:8, textTransform:"uppercase", letterSpacing:"0.05em" }}>Rate this customer</div>
        <StarRating value={form.rating} onChange={v=>setForm(f=>({...f,rating:v}))}/>
        {form.rating>0&&<div style={{ fontSize:11, color:"#e6821e", marginTop:4, marginBottom:"1rem" }}>{["","Poor experience","Below average","Average","Good customer","Excellent customer"][form.rating]}</div>}
        <div style={{ fontSize:11, color:"#666", marginBottom:4, marginTop:"1rem" }}>Comments (optional)</div>
        <textarea value={form.review} onChange={e=>setForm(f=>({...f,review:e.target.value}))} rows={3}
          placeholder="Was the customer on time? Cooperative? Any issues?" style={inp}/>
        <div style={{ fontSize:10, color:"#888", marginTop:4, marginBottom:"1rem" }}>Note: Customer ratings help other providers make informed decisions. Keep it honest and professional.</div>
        <button onClick={submitReview} disabled={submitting||form.rating===0}
          style={{ width:"100%", background:form.rating>0?"#378add":"#ccc", border:"none", borderRadius:8, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:14, fontWeight:700, padding:"12px", cursor:form.rating>0?"pointer":"not-allowed" }}>
          {submitting?"Submitting...":"Submit Review"}
        </button>
      </div>
    </div>
  )

  return (
    <div>
      <div style={{ fontFamily:"Syne", fontSize:isMobile?16:18, fontWeight:800, marginBottom:4 }}>Customer Reviews</div>
      <div style={{ fontSize:12, color:"#777", marginBottom:"1.25rem" }}>Rate your customers to help other providers.</div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8, marginBottom:"1rem" }}>
        {[
          { label:"Completed", value:bookings.length, color:"#378add" },
          { label:"Reviewed", value:myReviews.length, color:"#1d9e75" },
          { label:"Pending", value:pending.length, color:"#e6821e" },
        ].map(s=>(
          <div key={s.label} style={{ background:"#f8f8f8", borderRadius:10, padding:"0.75rem", textAlign:"center", border:"1px solid #eee" }}>
            <div style={{ fontFamily:"Syne", fontSize:18, fontWeight:800, color:s.color }}>{s.value}</div>
            <div style={{ fontSize:10, color:"#888", marginTop:2 }}>{s.label}</div>
          </div>
        ))}
      </div>
      <div style={{ display:"flex", gap:6, marginBottom:"1rem" }}>
        {[{k:"pending",l:"Pending ("+pending.length+")"},{k:"submitted",l:"Submitted ("+myReviews.length+")"}].map(t=>(
          <button key={t.k} onClick={()=>setTab(t.k)} style={{ padding:"8px 16px", borderRadius:8, border:"none", fontSize:12, cursor:"pointer", background:tab===t.k?"#378add":"#f0f0f0", color:tab===t.k?"#fff":"#555", fontWeight:tab===t.k?700:400 }}>{t.l}</button>
        ))}
      </div>
      {loading&&<div style={{ color:"#888", fontSize:13 }}>Loading...</div>}
      {tab==="pending"&&(
        <div>
          {!loading&&pending.length===0&&<div style={{ color:"#888", fontSize:13, textAlign:"center", padding:"2rem" }}>No pending customer reviews</div>}
          {pending.map(b=>(
            <div key={b.id} style={{ background:"#fff", border:"1px solid #eee", borderRadius:10, padding:"1rem", marginBottom:8, display:"flex", alignItems:"center", gap:12 }}>
              <div style={{ width:42, height:42, background:"#eff6ff", borderRadius:9, display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, flexShrink:0 }}>👤</div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:600 }}>{b.customer?.first_name} {b.customer?.last_name}</div>
                <div style={{ fontSize:11, color:"#888", marginTop:2 }}>{b.service_name} · {b.booking_date}</div>
              </div>
              <button onClick={()=>{ setReviewing(b); setForm({rating:0,review:""}) }}
                style={{ background:"#378add", border:"none", borderRadius:8, color:"#fff", fontSize:12, fontWeight:700, padding:"8px 14px", cursor:"pointer", flexShrink:0 }}>
                ⭐ Rate
              </button>
            </div>
          ))}
        </div>
      )}
      {tab==="submitted"&&(
        <div>
          {!loading&&myReviews.length===0&&<div style={{ color:"#888", fontSize:13, textAlign:"center", padding:"2rem" }}>No reviews submitted yet</div>}
          {myReviews.map(r=>(
            <div key={r.id} style={{ background:"#fff", border:"1px solid #eee", borderRadius:10, padding:"1rem", marginBottom:8 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:6 }}>
                <div>
                  <div style={{ fontSize:13, fontWeight:600 }}>Booking #{r.booking_id?.slice(0,8).toUpperCase()}</div>
                  <div style={{ fontSize:10, color:"#888" }}>{new Date(r.created_at).toLocaleDateString()}</div>
                </div>
                <StarRating value={r.customer_rating||0} color="#378add"/>
              </div>
              {r.customer_review&&<div style={{ fontSize:12, color:"#555", fontStyle:"italic" }}>"{r.customer_review}"</div>}
              {r.customer_response&&(
                <div style={{ background:"#f0fdf4", border:"1px solid #1d9e7520", borderRadius:8, padding:"0.5rem 0.75rem", marginTop:6 }}>
                  <div style={{ fontSize:10, color:"#1d9e75", fontWeight:600, marginBottom:2 }}>Customer response</div>
                  <div style={{ fontSize:12, color:"#333" }}>{r.customer_response}</div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}