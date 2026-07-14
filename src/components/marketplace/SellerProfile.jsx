import { useState, useEffect } from "react"
import { supabase } from "../../lib/supabase"
import { useAuth } from "../../contexts/AuthContext"
import toast from "react-hot-toast"

export default function SellerProfile({ sellerId, onClose, onSelectListing }) {
  const { user } = useAuth()
  const [seller, setSeller] = useState(null)
  const [listings, setListings] = useState([])
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState("listings")

  useEffect(() => { if (sellerId) load() }, [sellerId])

  async function load() {
    setLoading(true)
    try {
      const [{ data: sellerData }, { data: listingsData }, { data: reviewsData }] = await Promise.all([
        supabase.from("profiles").select("id,first_name,last_name,avatar_url,is_verified,marketplace_rating,marketplace_review_count,created_at,city").eq("id", sellerId).single(),
        supabase.from("marketplace_listings").select("*, marketplace_photos(photo_url,is_primary)").eq("seller_id", sellerId).eq("status","active").order("created_at", { ascending:false }),
        supabase.from("marketplace_reviews").select("*, reviewer:profiles!marketplace_reviews_reviewer_id_fkey(first_name,last_name,avatar_url)").eq("seller_id", sellerId).order("created_at", { ascending:false })
      ])
      setSeller(sellerData)
      setListings((listingsData||[]).map(l=>({...l, primary_photo:l.marketplace_photos?.find(p=>p.is_primary)?.photo_url || l.marketplace_photos?.[0]?.photo_url})))
      setReviews(reviewsData||[])
    } catch(e) { toast.error("Failed to load seller profile") }
    finally { setLoading(false) }
  }

  if (!sellerId) return null

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", zIndex:200, display:"flex", alignItems:"flex-end", justifyContent:"center" }}
      onClick={e=>{ if(e.target===e.currentTarget) onClose() }}>
      <div style={{ background:"#fff", borderRadius:"20px 20px 0 0", width:"100%", maxWidth:600, maxHeight:"90vh", display:"flex", flexDirection:"column", overflow:"hidden" }}>
        {/* Header */}
        <div style={{ padding:"1.25rem", borderBottom:"1px solid #eee", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div style={{ fontFamily:"Syne", fontSize:16, fontWeight:800 }}>Seller Profile</div>
          <button onClick={onClose} style={{ background:"#f5f5f5", border:"none", borderRadius:"50%", width:32, height:32, cursor:"pointer", fontSize:18 }}>×</button>
        </div>

        {loading ? (
          <div style={{ padding:"3rem", textAlign:"center", color:"#888" }}>Loading...</div>
        ) : (
          <div style={{ flex:1, overflowY:"auto" }}>
            {/* Seller info */}
            <div style={{ padding:"1.25rem", borderBottom:"1px solid #eee" }}>
              <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:12 }}>
                <div style={{ width:56, height:56, borderRadius:"50%", background:"#fff8f0", border:"2px solid #e6821e40", display:"flex", alignItems:"center", justifyContent:"center", fontSize:22, fontWeight:800, color:"#e6821e", flexShrink:0 }}>
                  {seller?.avatar_url ? <img src={seller.avatar_url} style={{ width:"100%", height:"100%", borderRadius:"50%", objectFit:"cover" }}/> : (seller?.first_name?.[0]||"S")}
                </div>
                <div>
                  <div style={{ fontFamily:"Syne", fontSize:16, fontWeight:800 }}>
                    {seller?.first_name} {seller?.last_name}
                    {seller?.is_verified && <span style={{ marginLeft:6, fontSize:12, color:"#1d9e75" }}>✓ Verified</span>}
                  </div>
                  <div style={{ fontSize:12, color:"#888" }}>{seller?.city} · Member since {new Date(seller?.created_at).getFullYear()}</div>
                </div>
              </div>
              <div style={{ display:"flex", gap:16 }}>
                <div style={{ textAlign:"center" }}>
                  <div style={{ fontFamily:"Syne", fontSize:20, fontWeight:800, color:"#e6821e" }}>{listings.length}</div>
                  <div style={{ fontSize:11, color:"#888" }}>Listings</div>
                </div>
                <div style={{ textAlign:"center" }}>
                  <div style={{ fontFamily:"Syne", fontSize:20, fontWeight:800, color:"#e6821e" }}>{seller?.marketplace_rating > 0 ? `⭐ ${Number(seller?.marketplace_rating).toFixed(1)}` : "—"}</div>
                  <div style={{ fontSize:11, color:"#888" }}>{seller?.marketplace_review_count||0} reviews</div>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div style={{ display:"flex", gap:0, padding:"0 1rem", borderBottom:"1px solid #eee" }}>
              {[{k:"listings",l:`Listings (${listings.length})`},{k:"reviews",l:`Reviews (${reviews.length})`}].map(t=>(
                <button key={t.k} onClick={()=>setTab(t.k)}
                  style={{ padding:"12px 16px", border:"none", background:"none", fontSize:13, fontWeight:tab===t.k?700:400, color:tab===t.k?"#e6821e":"#888", borderBottom:tab===t.k?"2px solid #e6821e":"2px solid transparent", cursor:"pointer" }}>
                  {t.l}
                </button>
              ))}
            </div>

            {/* Listings tab */}
            {tab==="listings" && (
              <div style={{ padding:"1rem", display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                {listings.length === 0 ? (
                  <div style={{ gridColumn:"1/-1", textAlign:"center", padding:"2rem", color:"#888" }}>No active listings</div>
                ) : listings.map(l=>(
                  <div key={l.id} onClick={()=>{ onSelectListing(l); onClose() }}
                    style={{ background:"#fff", border:"1px solid #eee", borderRadius:10, overflow:"hidden", cursor:"pointer" }}>
                    <div style={{ height:100, background:"#f5f5f5", display:"flex", alignItems:"center", justifyContent:"center" }}>
                      {l.primary_photo ? <img src={l.primary_photo} alt={l.title} style={{ width:"100%", height:"100%", objectFit:"cover" }}/> : <div style={{ fontSize:32 }}>{l.listing_type==="vehicle"?"🚗":"🔧"}</div>}
                    </div>
                    <div style={{ padding:"0.5rem" }}>
                      <div style={{ fontSize:12, fontWeight:700, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{l.title}</div>
                      <div style={{ fontFamily:"Syne", fontSize:13, fontWeight:800, color:"#e6821e" }}>KES {Number(l.price).toLocaleString()}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Reviews tab */}
            {tab==="reviews" && (
              <div style={{ padding:"1rem" }}>
                {reviews.length === 0 ? (
                  <div style={{ textAlign:"center", padding:"2rem", color:"#888" }}>No reviews yet</div>
                ) : reviews.map(r=>(
                  <div key={r.id} style={{ background:"#f9f9f9", borderRadius:10, padding:"1rem", marginBottom:10 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
                      <div style={{ fontSize:13, fontWeight:600 }}>{r.reviewer?.first_name} {r.reviewer?.last_name?.[0]}.</div>
                      <div style={{ fontSize:13, color:"#e6821e" }}>{"⭐".repeat(r.rating)}</div>
                    </div>
                    {r.review_text && <div style={{ fontSize:13, color:"#555", lineHeight:1.5 }}>{r.review_text}</div>}
                    <div style={{ fontSize:11, color:"#bbb", marginTop:6 }}>{new Date(r.created_at).toLocaleDateString()}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
