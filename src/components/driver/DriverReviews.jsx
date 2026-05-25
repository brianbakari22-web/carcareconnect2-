import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"
import { useAuth } from "../../contexts/AuthContext"

export default function DriverReviews() {
  const { user } = useAuth()
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    load()
    const sub = supabase.channel("driver-reviews")
      .on("postgres_changes", { event:"INSERT", schema:"public", table:"reviews", filter:`driver_id=eq.${user.id}` }, () => {
        load()
      }).subscribe()
    return () => supabase.removeChannel(sub)
  }, [user])

  async function load() {
    const { data } = await supabase.from("reviews")
      .select("*, profile_public!reviews_customer_id_fkey(first_name,last_name)")
      .eq("driver_id", user.id)
      .not("driver_rating", "is", null)
      .order("created_at", { ascending:false })
    setReviews(data||[])
    setLoading(false)
  }

  const avgRating = reviews.length > 0
    ? (reviews.reduce((s,r)=>s+(r.driver_rating||0),0)/reviews.length).toFixed(1)
    : "0.0"

  const dist = [5,4,3,2,1].map(n => ({
    star: n,
    count: reviews.filter(r=>r.driver_rating===n).length,
    pct: reviews.length ? Math.round(reviews.filter(r=>r.driver_rating===n).length/reviews.length*100) : 0
  }))

  return (
    <div>
      {reviews.length > 0 && (
        <div style={{ background:"#111", border:"1px solid #1e1e1e", borderRadius:12, padding:"1.25rem", marginBottom:"1.25rem", display:"flex", gap:"1.5rem", alignItems:"center" }}>
          <div style={{ textAlign:"center", flexShrink:0 }}>
            <div style={{ fontFamily:"Syne", fontSize:40, fontWeight:800, color:"#378add", lineHeight:1 }}>{avgRating}</div>
            <div style={{ display:"flex", justifyContent:"center", gap:2, margin:"6px 0" }}>
              {[1,2,3,4,5].map(s=>(
                <span key={s} style={{ color:s<=Math.round(avgRating)?"#378add":"#333", fontSize:16 }}>★</span>
              ))}
            </div>
            <div style={{ fontSize:11, color:"#555" }}>{reviews.length} rating{reviews.length!==1?"s":""}</div>
          </div>
          <div style={{ flex:1 }}>
            {dist.map(d=>(
              <div key={d.star} style={{ display:"flex", alignItems:"center", gap:8, marginBottom:5 }}>
                <div style={{ fontSize:11, color:"#888", width:10 }}>{d.star}</div>
                <span style={{ color:"#378add", fontSize:12 }}>★</span>
                <div style={{ flex:1, height:6, background:"#1e1e1e", borderRadius:3, overflow:"hidden" }}>
                  <div style={{ height:"100%", background:"#378add", borderRadius:3, width:`${d.pct}%`, transition:"width 0.5s" }}/>
                </div>
                <div style={{ fontSize:11, color:"#555", width:24, textAlign:"right" }}>{d.count}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading && <div style={{ color:"#555", fontSize:13 }}>Loading...</div>}
      {!loading && reviews.length === 0 && (
        <div style={{ color:"#444", fontSize:13, textAlign:"center", padding:"2rem" }}>
          No ratings yet. Complete concierge deliveries to receive ratings.
        </div>
      )}

      {reviews.map(r=>(
        <div key={r.id} style={{ background:"#111", border:"1px solid #1e1e1e", borderRadius:10, padding:"1rem", marginBottom:8 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <div style={{ width:36, height:36, borderRadius:"50%", background:"#0c1f2e", border:"1px solid #378add30", display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:700, color:"#378add" }}>
                {r.profile_public?.first_name?.[0]}{r.profile_public?.last_name?.[0]}
              </div>
              <div>
                <div style={{ fontSize:13, fontWeight:500, color:"#f0ede6" }}>{r.profile_public?.first_name} {r.profile_public?.last_name}</div>
                <div style={{ fontSize:10, color:"#444" }}>{new Date(r.created_at).toLocaleDateString()}</div>
              </div>
            </div>
            <div style={{ display:"flex", gap:1, flexShrink:0 }}>
              {[1,2,3,4,5].map(s=>(
                <span key={s} style={{ color:s<=r.driver_rating?"#378add":"#333", fontSize:16 }}>★</span>
              ))}
            </div>
          </div>
          {r.driver_review && (
            <div style={{ fontSize:12, color:"#888", lineHeight:1.5 }}>"{r.driver_review}"</div>
          )}
        </div>
      ))}
    </div>
  )
}
