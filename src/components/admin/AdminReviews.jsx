import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"
import { useAuth } from "../../contexts/AuthContext"
import useIsMobile from "../../lib/useIsMobile"
import toast from "react-hot-toast"

export default function AdminReviews() {
  const isMobile = useIsMobile()
  const { user } = useAuth()
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState("all")
  const [tab, setTab] = useState("all")
  const [adminNote, setAdminNote] = useState("")
  const [notingId, setNotingId] = useState(null)

  useEffect(() => {
    load()
    const sub = supabase.channel("admin-reviews-live")
      .on("postgres_changes", { event:"*", schema:"public", table:"reviews" }, () => load())
      .subscribe()
    return () => supabase.removeChannel(sub)
  }, [])

  async function load() {
    const { data } = await supabase.from("reviews")
      .select("*, customer:profile_public!reviews_customer_id_fkey(first_name,last_name), provider:profile_public!reviews_provider_id_fkey(first_name,last_name,business_name), driver:profile_public!reviews_driver_id_fkey(first_name,last_name), mechanic:mechanics!reviews_mechanic_id_fkey(first_name,last_name)")
      .order("created_at", { ascending:false })
    setReviews(data||[])
    setLoading(false)
  }

  async function toggleHide(id, is_hidden) {
    await supabase.from("reviews").update({ is_hidden:!is_hidden }).eq("id", id)
    toast.success(is_hidden?"Review visible":"Review hidden")
    load()
  }

  async function toggleFlag(id, is_flagged) {
    await supabase.from("reviews").update({ is_flagged:!is_flagged }).eq("id", id)
    toast.success(is_flagged?"Flag removed":"Review flagged for moderation")
    load()
  }

  async function deleteReview(id) {
    if (!confirm("Delete this review permanently?")) return
    await supabase.from("reviews").delete().eq("id", id)
    toast.success("Review deleted")
    load()
  }

  async function saveNote(id) {
    if (!adminNote.trim()) return
    await supabase.from("reviews").update({ admin_notes: adminNote }).eq("id", id)
    toast.success("Note saved")
    setNotingId(null); setAdminNote(""); load()
  }

  const allFiltered = tab==="flagged" ? reviews.filter(r=>r.is_flagged) :
    tab==="hidden" ? reviews.filter(r=>r.is_hidden) :
    tab==="provider" ? reviews.filter(r=>r.provider_rating) :
    tab==="driver" ? reviews.filter(r=>r.driver_rating) :
    tab==="mechanic" ? reviews.filter(r=>r.mechanic_rating) : reviews

  const avgRating = reviews.length > 0 ? (reviews.reduce((s,r)=>s+(r.provider_rating||0),0)/reviews.filter(r=>r.provider_rating).length||0).toFixed(1) : "0.0"

  return (
    <div>
      <div style={{ fontFamily:"Syne", fontSize:isMobile?16:20, fontWeight:800, marginBottom:"1.25rem" }}>Reviews & Ratings</div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))", gap:10, marginBottom:"1.5rem" }}>
        {[
          { label:"Total reviews", value:reviews.length, color:"#000" },
          { label:"Provider avg", value:avgRating+" ★", color:"#e6821e" },
          { label:"Flagged", value:reviews.filter(r=>r.is_flagged).length, color:"#e24b4a" },
          { label:"Hidden", value:reviews.filter(r=>r.is_hidden).length, color:"#888" },
          { label:"With response", value:reviews.filter(r=>r.provider_response||r.driver_response).length, color:"#1d9e75" },
        ].map(s=>(
          <div key={s.label} style={{ background:"#f8f8f8", borderRadius:10, padding:"0.75rem", border:"1px solid #eee", textAlign:"center" }}>
            <div style={{ fontFamily:"Syne", fontSize:18, fontWeight:800, color:s.color }}>{s.value}</div>
            <div style={{ fontSize:10, color:"#888", marginTop:2 }}>{s.label}</div>
          </div>
        ))}
      </div>
      <div style={{ overflowX:"auto", marginBottom:"1rem", paddingBottom:4 }}>
        <div style={{ display:"flex", gap:6, minWidth:"max-content" }}>
          {[
            {k:"all",l:"All ("+reviews.length+")"},
            {k:"flagged",l:"Flagged ("+reviews.filter(r=>r.is_flagged).length+")"},
            {k:"hidden",l:"Hidden ("+reviews.filter(r=>r.is_hidden).length+")"},
            {k:"provider",l:"Provider"},
            {k:"driver",l:"Driver"},
            {k:"mechanic",l:"Mechanic"},
          ].map(t=>(
            <button key={t.k} onClick={()=>setTab(t.k)}
              style={{ padding:"6px 14px", borderRadius:6, border:"none", fontSize:12, cursor:"pointer", background:tab===t.k?"#e24b4a":"#f0f0f0", color:tab===t.k?"#fff":"#666", whiteSpace:"nowrap" }}>
              {t.l}
            </button>
          ))}
        </div>
      </div>
      {loading&&<div style={{ color:"#888", fontSize:13 }}>Loading...</div>}
      {!loading&&allFiltered.length===0&&<div style={{ color:"#888", fontSize:13, textAlign:"center", padding:"2rem" }}>No reviews found</div>}
      {allFiltered.map(r=>(
        <div key={r.id} style={{ background:"#f8f8f8", border:"1px solid "+(r.is_flagged?"#e24b4a":r.is_hidden?"#888":"#eee")+"30", borderRadius:12, padding:"1rem", marginBottom:10, opacity:r.is_hidden?0.6:1 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
            <div>
              <div style={{ display:"flex", gap:6, alignItems:"center", flexWrap:"wrap", marginBottom:4 }}>
                <div style={{ fontSize:13, fontWeight:600 }}>{r.provider?.business_name||r.provider?.first_name+" "+r.provider?.last_name||"Unknown provider"}</div>
                {r.is_flagged&&<span style={{ fontSize:10, color:"#e24b4a", background:"#fff5f5", padding:"1px 8px", borderRadius:10 }}>🚩 Flagged</span>}
                {r.is_hidden&&<span style={{ fontSize:10, color:"#888", background:"#f0f0f0", padding:"1px 8px", borderRadius:10 }}>Hidden</span>}
              </div>
              <div style={{ fontSize:11, color:"#888" }}>By: {r.customer?.first_name} {r.customer?.last_name} · {new Date(r.created_at).toLocaleDateString()}</div>
            </div>
            <div style={{ textAlign:"right" }}>
              {r.provider_rating&&<div style={{ fontSize:12, color:"#e6821e" }}>Provider: {"★".repeat(r.provider_rating)}</div>}
              {r.driver_rating&&<div style={{ fontSize:12, color:"#378add" }}>Driver: {"★".repeat(r.driver_rating)}</div>}
              {r.mechanic_rating&&<div style={{ fontSize:12, color:"#1d9e75" }}>Mechanic: {"★".repeat(r.mechanic_rating)}</div>}
            </div>
          </div>
          {r.provider_review&&<div style={{ fontSize:12, color:"#555", fontStyle:"italic", marginBottom:6 }}>"{"}{r.provider_review}{"}"}"</div>}
          {r.driver_review&&<div style={{ fontSize:12, color:"#378add", fontStyle:"italic", marginBottom:6 }}>Driver: "{"}{r.driver_review}{"}"}"</div>}
          {r.mechanic_review&&<div style={{ fontSize:12, color:"#1d9e75", fontStyle:"italic", marginBottom:6 }}>Mechanic: "{"}{r.mechanic_review}{"}"}"</div>}
          {r.provider_response&&<div style={{ background:"#fff8f0", border:"1px solid #e6821e20", borderRadius:8, padding:"0.5rem 0.75rem", fontSize:11, color:"#555", marginBottom:6 }}>Provider reply: {r.provider_response}</div>}
          {r.driver_response&&<div style={{ background:"#eff6ff", border:"1px solid #378add20", borderRadius:8, padding:"0.5rem 0.75rem", fontSize:11, color:"#555", marginBottom:6 }}>Driver reply: {r.driver_response}</div>}
          {r.admin_notes&&<div style={{ background:"#f5f3ff", border:"1px solid #8b5cf620", borderRadius:8, padding:"0.5rem 0.75rem", fontSize:11, color:"#8b5cf6", marginBottom:6 }}>Admin note: {r.admin_notes}</div>}
          {notingId===r.id&&(
            <div style={{ marginBottom:8 }}>
              <textarea value={adminNote} onChange={e=>setAdminNote(e.target.value)} placeholder="Add internal admin note..." rows={2}
                style={{ width:"100%", background:"#fff", border:"1px solid #8b5cf640", borderRadius:8, padding:"8px 10px", fontSize:12, outline:"none", resize:"none", boxSizing:"border-box" }}/>
              <div style={{ display:"flex", gap:6, marginTop:4 }}>
                <button onClick={()=>saveNote(r.id)} style={{ background:"#8b5cf6", border:"none", borderRadius:6, color:"#fff", fontSize:11, padding:"6px 12px", cursor:"pointer" }}>Save Note</button>
                <button onClick={()=>{ setNotingId(null); setAdminNote("") }} style={{ background:"#f0f0f0", border:"none", borderRadius:6, color:"#555", fontSize:11, padding:"6px 10px", cursor:"pointer" }}>Cancel</button>
              </div>
            </div>
          )}
          <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginTop:8 }}>
            <button onClick={()=>toggleFlag(r.id, r.is_flagged)}
              style={{ background:r.is_flagged?"#fff5f5":"#f8f8f8", border:"1px solid "+(r.is_flagged?"#e24b4a40":"#ddd"), borderRadius:6, color:r.is_flagged?"#e24b4a":"#555", fontSize:11, padding:"5px 10px", cursor:"pointer" }}>
              {r.is_flagged?"🚩 Unflag":"🚩 Flag"}
            </button>
            <button onClick={()=>toggleHide(r.id, r.is_hidden)}
              style={{ background:"#f8f8f8", border:"1px solid #ddd", borderRadius:6, color:"#555", fontSize:11, padding:"5px 10px", cursor:"pointer" }}>
              {r.is_hidden?"👁️ Show":"🙈 Hide"}
            </button>
            <button onClick={()=>{ setNotingId(r.id); setAdminNote(r.admin_notes||"") }}
              style={{ background:"#f5f3ff", border:"1px solid #8b5cf620", borderRadius:6, color:"#8b5cf6", fontSize:11, padding:"5px 10px", cursor:"pointer" }}>
              📝 Note
            </button>
            <button onClick={()=>deleteReview(r.id)}
              style={{ background:"#fff5f5", border:"1px solid #e24b4a30", borderRadius:6, color:"#e24b4a", fontSize:11, padding:"5px 10px", cursor:"pointer" }}>
              🗑️ Delete
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}