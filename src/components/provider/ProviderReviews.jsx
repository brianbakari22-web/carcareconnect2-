import useIsMobile from "../../lib/useIsMobile"
import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"
import { useAuth } from "../../contexts/AuthContext"
import toast from "react-hot-toast"
import { useLanguage } from "../../contexts/LanguageContext"

export default function ProviderReviews() {
  const isMobile = useIsMobile()
  const { user } = useAuth()
  const { t, language } = useLanguage()
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [replying, setReplying] = useState(null)
  const [replyText, setReplyText] = useState("")
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!user) return
    load()
    const sub = supabase.channel("provider-reviews")
      .on("postgres_changes", { event:"INSERT", schema:"public", table:"reviews", filter:`provider_id=eq.${user.id}` }, () => {
        load()
        toast("New review received!", { icon:"Γ¡É" })
      }).subscribe()
    return () => supabase.removeChannel(sub)
  }, [user])

  async function load() {
    const { data } = await supabase.from("reviews")
      .select("*, profile_public!reviews_customer_id_fkey(first_name,last_name)")
      .eq("provider_id", user.id)
      .order("created_at", { ascending:false })
    setReviews(data||[])
    setLoading(false)
  }

  async function submitReply(id) {
    if (!replyText.trim()) return toast.error("Please write a reply")
    setSubmitting(true)
    const { error } = await supabase.from("reviews")
      .update({ provider_response: replyText })
      .eq("id", id)
      .eq("provider_id", user.id)
    if (error) { toast.error(error.message); setSubmitting(false); return }
    toast.success("Reply posted")
    setReplying(null); setReplyText(""); setSubmitting(false); load()
  }

  const avgRating = reviews.length > 0
    ? (reviews.reduce((s,r) => s + (r.provider_rating||0), 0) / reviews.length).toFixed(1)
    : "0.0"

  const dist = [5,4,3,2,1].map(n => ({
    star: n,
    count: reviews.filter(r => r.provider_rating === n).length,
    pct: reviews.length ? Math.round(reviews.filter(r=>r.provider_rating===n).length/reviews.length*100) : 0
  }))

  return (
    <div>
      {reviews.length > 0 && (
        <div style={{ background:"#ffffff", border:"1px solid #eeeeee", borderRadius:12, padding:"1.25rem", marginBottom:"1.25rem", display:"flex", gap:"1.5rem", alignItems:"center" }}>
          <div style={{ textAlign:"center", flexShrink:0 }}>
            <div style={{ fontFamily:"Syne", fontSize:40, fontWeight:800, color:"#e6821e", lineHeight:1 }}>{avgRating}</div>
            <div style={{ display:"flex", justifyContent:"center", gap:2, margin:"6px 0" }}>
              {[1,2,3,4,5].map(s=>(
                <span key={s} style={{ color: s <= Math.round(avgRating) ? "#e6821e" : "#555555", fontSize:16 }}>Γÿà</span>
              ))}
            </div>
            <div style={{ fontSize:11, color:"#777777" }}>{reviews.length} review{reviews.length!==1?"s":""}</div>
          </div>
          <div style={{ flex:1 }}>
            {dist.map(d => (
              <div key={d.star} style={{ display:"flex", alignItems:"center", gap:8, marginBottom:5 }}>
                <div style={{ fontSize:11, color:"#555555", width:10 }}>{d.star}</div>
                <span style={{ color:"#e6821e", fontSize:12 }}>Γÿà</span>
                <div style={{ flex:1, height:6, background:"#f0f0f0", borderRadius:3, overflow:"hidden" }}>
                  <div style={{ height:"100%", background:"#e6821e", borderRadius:3, width:`${d.pct}%`, transition:"width 0.5s" }} />
                </div>
                <div style={{ fontSize:11, color:"#777777", width:24, textAlign:"right" }}>{d.count}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading && <div style={{ color:"#777777", fontSize:13 }}>Loading...</div>}
      {!loading && reviews.length === 0 && (
        <div style={{ color:"#888888", fontSize:13, textAlign:"center", padding:"2rem" }}>No reviews yet. Complete bookings to receive ratings.</div>
      )}

      {reviews.map(r => (
        <div key={r.id} style={{ background:"#ffffff", border:"1px solid #eeeeee", borderRadius:10, padding:"1rem", marginBottom:10 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <div style={{ width:36, height:36, borderRadius:"50%", background:"#fff8f0", border:"1px solid #e6821e30", display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:700, color:"#e6821e" }}>
                {r.profile_public?.first_name?.[0]}{r.profile_public?.last_name?.[0]}
              </div>
              <div>
                <div style={{ fontSize:13, fontWeight:500, color:"#000000" }}>{r.profile_public?.first_name} {r.profile_public?.last_name}</div>
                <div style={{ fontSize:10, color:"#888888" }}>{new Date(r.created_at).toLocaleDateString()}</div>
              </div>
            </div>
            <div style={{ display:"flex", gap:1 }}>
              {[1,2,3,4,5].map(s=>(
                <span key={s} style={{ color: s <= r.provider_rating ? "#e6821e" : "#555555", fontSize:16 }}>Γÿà</span>
              ))}
            </div>
          </div>

          {r.provider_review && (
            <div style={{ fontSize:13, color:"#666666", lineHeight:1.6, marginBottom:10 }}>"{r.provider_review}"</div>
          )}

          {r.driver_rating > 0 && (
            <div style={{ fontSize:11, color:"#777777", marginBottom:10 }}>
              Driver rated: {[1,2,3,4,5].map(s=><span key={s} style={{ color: s<=r.driver_rating?"#378add":"#555555" }}>Γÿà</span>)}
            </div>
          )}

          {r.provider_response ? (
            <div style={{ background:"#ffffff", border:"1px solid #e5e5e5", borderRadius:8, padding:"0.75rem" }}>
              <div style={{ fontSize:10, color:"#777777", marginBottom:4 }}>Your reply</div>
              <div style={{ fontSize:12, color:"#555555", lineHeight:1.5 }}>{r.provider_response}</div>
              <button onClick={() => { setReplying(r.id); setReplyText(r.provider_response) }}
                style={{ background:"none", border:"none", color:"#777777", fontSize:11, cursor:"pointer", marginTop:6, fontFamily:"'DM Sans',sans-serif", padding:0 }}>
                Edit reply
              </button>
            </div>
          ) : (
            <button onClick={() => { setReplying(r.id); setReplyText("") }}
              style={{ background:"none", border:"1px solid #dddddd", borderRadius:7, color:"#555555", fontSize:11, padding:"5px 12px", cursor:"pointer" }}>
              Reply to review
            </button>
          )}

          {replying === r.id && (
            <div style={{ marginTop:10 }}>
              <textarea value={replyText} onChange={e=>setReplyText(e.target.value)} rows={3}
                placeholder="Write your reply to this review..."
                style={{ width:"100%", background:"#ffffff", border:"1px solid #e5e5e5", borderRadius:8, padding:"10px 12px", color:"#000000", fontSize:13, outline:"none", fontFamily:"'DM Sans',sans-serif", resize:"vertical", marginBottom:8 }} />
              <div style={{ display:"flex", gap:8 }}>
                <button onClick={() => submitReply(r.id)} disabled={submitting}
                  style={{ background:"#e6821e", border:"none", borderRadius:7, color:"#fff", fontSize:12, fontWeight:700, padding:"7px 16px", cursor:"pointer", fontFamily:"Syne,sans-serif" }}>
                  {submitting ? "Posting..." : language==="sw"?"Chapisha jibu":"Post reply"}
                </button>
                <button onClick={() => { setReplying(null); setReplyText("") }}
                  style={{ background:"none", border:"1px solid #dddddd", borderRadius:7, color:"#555555", fontSize:12, padding:"7px 16px", cursor:"pointer" }}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}




