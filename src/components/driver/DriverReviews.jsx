import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"
import { useAuth } from "../../contexts/AuthContext"
import useIsMobile from "../../lib/useIsMobile"
import toast from "react-hot-toast"

export default function DriverReviews() {
  const { user } = useAuth()
  const isMobile = useIsMobile()
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [replying, setReplying] = useState(null)
  const [replyText, setReplyText] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [filter, setFilter] = useState("all")

  useEffect(() => {
    if (!user) return
    load()
    const sub = supabase.channel("driver-reviews-"+user.id)
      .on("postgres_changes", { event:"INSERT", schema:"public", table:"reviews", filter:"driver_id=eq."+user.id }, () => {
        load()
        toast("New review received!", { icon:"⭐" })
      }).subscribe()
    return () => supabase.removeChannel(sub)
  }, [user])

  async function load() {
    const { data } = await supabase.from("reviews")
      .select("*, customer:profile_public!reviews_customer_id_fkey(first_name,last_name)")
      .eq("driver_id", user.id)
      .not("driver_rating", "is", null)
      .order("created_at", { ascending:false })
    setReviews(data||[])
    setLoading(false)
  }

  async function submitReply(id) {
    if (!replyText.trim()) return toast.error("Please write a reply")
    setSubmitting(true)
    const { error } = await supabase.from("reviews")
      .update({ driver_response: replyText })
      .eq("id", id)
      .eq("driver_id", user.id)
    if (error) { toast.error(error.message); setSubmitting(false); return }
    toast.success("Reply posted")
    setReplying(null); setReplyText(""); setSubmitting(false); load()
  }

  const avgRating = reviews.length > 0
    ? (reviews.reduce((s,r)=>s+(r.driver_rating||0),0)/reviews.length).toFixed(1)
    : "0.0"
  const dist = [5,4,3,2,1].map(n => ({
    star: n,
    count: reviews.filter(r=>r.driver_rating===n).length,
    pct: reviews.length ? Math.round(reviews.filter(r=>r.driver_rating===n).length/reviews.length*100) : 0
  }))

  const filtered = filter==="replied" ? reviews.filter(r=>r.driver_response) :
    filter==="pending" ? reviews.filter(r=>!r.driver_response) : reviews

  return (
    <div>
      <div style={{ fontFamily:"Syne", fontSize:isMobile?16:18, fontWeight:800, marginBottom:"1.25rem" }}>My Ratings</div>
      {reviews.length > 0 && (
        <div style={{ background:"#fff", border:"1px solid #eee", borderRadius:12, padding:"1.25rem", marginBottom:"1.25rem", display:"flex", gap:"1.5rem", alignItems:"center" }}>
          <div style={{ textAlign:"center", flexShrink:0 }}>
            <div style={{ fontFamily:"Syne", fontSize:40, fontWeight:800, color:"#378add", lineHeight:1 }}>{avgRating}</div>
            <div style={{ display:"flex", justifyContent:"center", gap:2, margin:"6px 0" }}>
              {[1,2,3,4,5].map(s=>(
                <span key={s} style={{ color:s<=Math.round(avgRating)?"#378add":"#ddd", fontSize:18 }}>★</span>
              ))}
            </div>
            <div style={{ fontSize:11, color:"#777" }}>{reviews.length} rating{reviews.length!==1?"s":""}</div>
          </div>
          <div style={{ flex:1 }}>
            {dist.map(d=>(
              <div key={d.star} style={{ display:"flex", alignItems:"center", gap:8, marginBottom:5 }}>
                <div style={{ fontSize:11, color:"#555", width:10 }}>{d.star}</div>
                <span style={{ color:"#378add", fontSize:12 }}>★</span>
                <div style={{ flex:1, height:6, background:"#f0f0f0", borderRadius:3, overflow:"hidden" }}>
                  <div style={{ height:"100%", background:"#378add", borderRadius:3, width:d.pct+"%", transition:"width 0.5s" }}/>
                </div>
                <div style={{ fontSize:11, color:"#777", width:24, textAlign:"right" }}>{d.count}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8, marginBottom:"1rem" }}>
        {[
          { label:"Total", value:reviews.length, color:"#378add" },
          { label:"Replied", value:reviews.filter(r=>r.driver_response).length, color:"#1d9e75" },
          { label:"Pending reply", value:reviews.filter(r=>!r.driver_response).length, color:"#e6821e" },
        ].map(s=>(
          <div key={s.label} style={{ background:"#f8f8f8", borderRadius:10, padding:"0.75rem", textAlign:"center", border:"1px solid #eee" }}>
            <div style={{ fontFamily:"Syne", fontSize:18, fontWeight:800, color:s.color }}>{s.value}</div>
            <div style={{ fontSize:10, color:"#888", marginTop:2 }}>{s.label}</div>
          </div>
        ))}
      </div>
      <div style={{ display:"flex", gap:6, marginBottom:"1rem", overflowX:"auto" }}>
        {[{k:"all",l:"All"},{k:"pending",l:"Needs reply"},{k:"replied",l:"Replied"}].map(t=>(
          <button key={t.k} onClick={()=>setFilter(t.k)}
            style={{ padding:"6px 14px", borderRadius:6, border:"none", fontSize:12, cursor:"pointer", background:filter===t.k?"#378add":"#f0f0f0", color:filter===t.k?"#fff":"#666", whiteSpace:"nowrap" }}>
            {t.l}
          </button>
        ))}
      </div>
      {loading&&<div style={{ color:"#888", fontSize:13 }}>Loading...</div>}
      {!loading&&filtered.length===0&&<div style={{ color:"#888", fontSize:13, textAlign:"center", padding:"2rem" }}>No reviews yet</div>}
      {filtered.map(r=>(
        <div key={r.id} style={{ background:"#fff", border:"1px solid #eee", borderRadius:12, padding:"1rem", marginBottom:10 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
            <div>
              <div style={{ fontSize:13, fontWeight:600 }}>{r.customer?.first_name} {r.customer?.last_name}</div>
              <div style={{ fontSize:10, color:"#888", marginTop:2 }}>{new Date(r.created_at).toLocaleDateString()}</div>
            </div>
            <div style={{ display:"flex", gap:1 }}>
              {[1,2,3,4,5].map(s=><span key={s} style={{ color:s<=r.driver_rating?"#378add":"#ddd", fontSize:16 }}>★</span>)}
            </div>
          </div>
          {r.driver_review&&<div style={{ fontSize:12, color:"#555", lineHeight:1.5, marginBottom:8, fontStyle:"italic" }}>"{"}{r.driver_review}{"}"}"</div>}
          {r.driver_response?(
            <div style={{ background:"#eff6ff", border:"1px solid #378add20", borderRadius:8, padding:"0.75rem", marginBottom:8 }}>
              <div style={{ fontSize:10, color:"#378add", fontWeight:600, marginBottom:4 }}>Your reply</div>
              <div style={{ fontSize:12, color:"#333", lineHeight:1.5 }}>{r.driver_response}</div>
            </div>
          ):(
            replying===r.id?(
              <div style={{ marginTop:8 }}>
                <textarea value={replyText} onChange={e=>setReplyText(e.target.value)} placeholder="Write a professional reply..." rows={3}
                  style={{ width:"100%", background:"#f8f8f8", border:"1px solid #ddd", borderRadius:8, padding:"10px 12px", fontSize:12, outline:"none", resize:"none", boxSizing:"border-box" }}/>
                <div style={{ display:"flex", gap:8, marginTop:6 }}>
                  <button onClick={()=>submitReply(r.id)} disabled={submitting||!replyText.trim()}
                    style={{ background:"#378add", border:"none", borderRadius:7, color:"#fff", fontSize:12, fontWeight:700, padding:"8px 16px", cursor:"pointer" }}>
                    {submitting?"Posting...":"Post Reply"}
                  </button>
                  <button onClick={()=>{ setReplying(null); setReplyText("") }}
                    style={{ background:"#f0f0f0", border:"none", borderRadius:7, color:"#555", fontSize:12, padding:"8px 14px", cursor:"pointer" }}>
                    Cancel
                  </button>
                </div>
              </div>
            ):(
              <button onClick={()=>{ setReplying(r.id); setReplyText("") }}
                style={{ background:"#eff6ff", border:"1px solid #378add30", borderRadius:7, color:"#378add", fontSize:11, padding:"5px 12px", cursor:"pointer" }}>
                💬 Reply to review
              </button>
            )
          )}
        </div>
      ))}
    </div>
  )
}