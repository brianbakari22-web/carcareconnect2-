import useIsMobile from "../../lib/useIsMobile"
import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"
import toast from "react-hot-toast"

export default function AdminReviews() {
  const isMobile = useIsMobile()
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState("all")

  useEffect(() => {
    load()
    const sub = supabase.channel("admin-reviews")
      .on("postgres_changes", { event:"*", schema:"public", table:"reviews" }, () => load())
      .subscribe()
    return () => supabase.removeChannel(sub)
  }, [])

  async function load() {
    const { data } = await supabase.from("reviews")
      .select("*, customer:profile_public!reviews_customer_id_fkey(first_name,last_name), provider:profile_public!reviews_provider_id_fkey(first_name,last_name,business_name)")
      .order("created_at", { ascending:false })
    setReviews(data||[])
    setLoading(false)
  }

  async function toggleHide(id, is_hidden) {
    await supabase.from("reviews").update({ is_hidden:!is_hidden }).eq("id", id)
    toast.success(is_hidden ? "Review visible" : "Review hidden")
    load()
  }

  async function deleteReview(id) {
    if (!confirm("Delete this review permanently?")) return
    await supabase.from("reviews").delete().eq("id", id)
    toast.success("Review deleted")
    load()
  }

  const filtered = filter === "all" ? reviews : filter === "hidden" ? reviews.filter(r=>r.is_hidden) : reviews.filter(r=>!r.is_hidden)
  const avgRating = reviews.length > 0 ? (reviews.reduce((s,r)=>s+(r.provider_rating||0),0)/reviews.length).toFixed(1) : "0.0"

  return (
    <div>
      <div style={{ display:"grid", gridTemplateColumns:isMobile?"repeat(2,1fr)":"repeat(3,1fr)", gap:10, marginBottom:"1.5rem" }}>
        {[
          { label:"Total reviews", value:reviews.length },
          { label:"Average rating", value:`${avgRating} ★`, color:"#e6821e" },
          { label:"Hidden reviews", value:reviews.filter(r=>r.is_hidden).length },
        ].map(s=>(
          <div key={s.label} style={{ background:"#f8f8f8", borderRadius:10, padding:"1rem", border:"1px solid #eeeeee" }}>
            <div style={{ fontSize:11, color:"#888", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:6 }}>{s.label}</div>
            <div style={{ fontFamily:"Syne", fontSize:22, fontWeight:800, color:s.color||"#000000" }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display:"flex", gap:6, marginBottom:"1rem" }}>
        {[{k:"all",l:"All"},{k:"visible",l:"Visible"},{k:"hidden",l:"Hidden"}].map(t=>(
          <button key={t.k} onClick={()=>setFilter(t.k)}
            style={{ padding:"6px 14px", borderRadius:6, border:"none", fontSize:12, cursor:"pointer", background:filter===t.k?"#e6821e":"#f8f8f8", color:filter===t.k?"#fff":"#666", fontFamily:"'DM Sans',sans-serif" }}>
            {t.l}
          </button>
        ))}
      </div>

      <div style={{ fontSize:12, color:"#888", marginBottom:10 }}>{filtered.length} review{filtered.length!==1?"s":""}</div>

      {loading && <div style={{ color:"#888", fontSize:13 }}>Loading...</div>}
      {!loading && filtered.length === 0 && <div style={{ color:"#888", fontSize:13, textAlign:"center", padding:"2rem" }}>No reviews found</div>}

      {filtered.map(r => (
        <div key={r.id} style={{ background:"#f8f8f8", border:`1px solid ${r.is_hidden?"#e24b4a20":"#eeeeee"}`, borderRadius:10, padding:"1rem", marginBottom:8, opacity:r.is_hidden?0.6:1 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
            <div>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:2 }}>
                <div style={{ fontSize:13, fontWeight:500, color:"#000000" }}>
                  {r.provider?.business_name || `${r.provider?.first_name||""} ${r.provider?.last_name||""}`}
                </div>
                {r.is_hidden && <span style={{ fontSize:10, color:"#e24b4a", background:"#fff5f5", padding:"1px 6px", borderRadius:10 }}>Hidden</span>}
              </div>
              <div style={{ fontSize:11, color:"#888" }}>
                By {r.customer?.first_name} {r.customer?.last_name} · {new Date(r.created_at).toLocaleDateString()}
              </div>
            </div>
            <div style={{ display:"flex", gap:1, flexShrink:0 }}>
              {[1,2,3,4,5].map(s=>(
                <span key={s} style={{ color:s<=r.provider_rating?"#e6821e":"#e0e0e0", fontSize:16 }}>★</span>
              ))}
            </div>
          </div>

          {r.provider_review && (
            <div style={{ fontSize:12, color:"#888", lineHeight:1.5, marginBottom:8 }}>&quot;{r.provider_review}&quot;</div>
          )}

          {r.provider_response && (
            <div style={{ background:"#ffffff", border:"1px solid #f0f0f0", borderRadius:8, padding:"0.75rem", marginBottom:8 }}>
              <div style={{ fontSize:10, color:"#888", marginBottom:3 }}>Provider reply</div>
              <div style={{ fontSize:12, color:"#777" }}>{r.provider_response}</div>
            </div>
          )}

          {r.driver_rating > 0 && (
            <div style={{ fontSize:11, color:"#888", marginBottom:8 }}>
              Driver rating: {[1,2,3,4,5].map(s=><span key={s} style={{ color:s<=r.driver_rating?"#378add":"#e0e0e0" }}>★</span>)}
              {r.driver_review && <span style={{ marginLeft:6, fontStyle:"italic" }}>&quot;{r.driver_review}&quot;</span>}
            </div>
          )}

          <div style={{ display:"flex", gap:6 }}>
            <button onClick={()=>toggleHide(r.id, r.is_hidden)}
              style={{ background:"none", border:`1px solid ${r.is_hidden?"#1d9e7540":"#e24b4a40"}`, borderRadius:7, color:r.is_hidden?"#1d9e75":"#e24b4a", fontSize:11, padding:"5px 10px", cursor:"pointer" }}>
              {r.is_hidden ? "Show review" : "Hide review"}
            </button>
            <button onClick={()=>deleteReview(r.id)}
              style={{ background:"none", border:"1px solid #e24b4a40", borderRadius:7, color:"#e24b4a", fontSize:11, padding:"5px 10px", cursor:"pointer" }}>
              Delete
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}


