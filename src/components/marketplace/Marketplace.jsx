import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"
import { useAuth } from "../../contexts/AuthContext"
import { useNavigate, useSearchParams } from "react-router-dom"
import ChatWindow from "../shared/ChatWindow"
import useIsMobile from "../../lib/useIsMobile"
import toast from "react-hot-toast"

const FUEL_TYPES = ["Petrol","Diesel","Electric","Hybrid"]
const TRANSMISSIONS = ["Manual","Automatic"]
const CONDITIONS = ["New","Used","Refurbished","For parts"]

export default function Marketplace() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const isMobile = useIsMobile()
  const [listings, setListings] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState("all")
  const [search, setSearch] = useState("")
  const [filters, setFilters] = useState({ minPrice:"", maxPrice:"", condition:"", city:"", make:"", fuelType:"", transmission:"" })
  const [showFilters, setShowFilters] = useState(false)
  const [selected, setSelected] = useState(null)
  const [sellerInfo, setSellerInfo] = useState(null)
  const [photos, setPhotos] = useState([])
  const [activePhoto, setActivePhoto] = useState(0)
  const [offers, setOffers] = useState([])
  const [comments, setComments] = useState([])
  const [newComment, setNewComment] = useState("")
  const [userLikes, setUserLikes] = useState(new Set())
  const [submittingComment, setSubmittingComment] = useState(false)
  const [replyingTo, setReplyingTo] = useState(null)
  const [replyText, setReplyText] = useState("")
  const [loadingComments, setLoadingComments] = useState(false)

  useEffect(() => { load(); loadUserLikes() }, [tab])

  useEffect(() => {
    const listingId = searchParams.get("listing")
    if (!listingId || listings.length === 0) return
    // Find the exact listing by ID
    const found = listings.find(l => l.id === listingId)
    if (found) {
      setSelected(found)
    } else {
      // If not in current tab, fetch it directly
      supabase.from("marketplace_listings")
        .select("*, profiles!marketplace_listings_seller_id_fkey(first_name,last_name,avatar_url,business_name)")
        .eq("id", listingId)
        .single()
        .then(({ data }) => { if (data) setSelected(data) })
    }
  }, [searchParams, listings])

  async function load() {
    setLoading(true)
    let query = supabase.from("marketplace_listings")
      .select("*, profiles(first_name,last_name,role,business_name), marketplace_photos(photo_url,is_primary), video_url")
      .eq("status","active")
      .order("is_featured",{ascending:false})
      .order("created_at",{ascending:false})
    if (tab==="vehicle") query = query.eq("listing_type","vehicle")
    else if (tab==="part") query = query.eq("listing_type","part")
    else if (tab==="accessory") query = query.eq("listing_type","accessory")
    const { data } = await query
    setListings((data||[]).map(l=>({...l, primary_photo:l.marketplace_photos?.find(p=>p.is_primary)?.photo_url||l.marketplace_photos?.[0]?.photo_url})))
    setLoading(false)
  }

  async function loadComments(listingId) {
    setLoadingComments(true)
    const { data } = await supabase.from("marketplace_comments")
      .select("*, profiles(first_name, last_name, role), replies:marketplace_comments!parent_comment_id(*, profiles(first_name, last_name, role))")
      .eq("listing_id", listingId)
      .eq("is_approved", true)
      .eq("is_deleted", false)
      .is("parent_comment_id", null)
      .order("created_at", { ascending: true })
    setComments(data||[])
    setLoadingComments(false)
  }

  async function loadUserLikes() {
    if (!user) return
    const { data } = await supabase.from("marketplace_likes")
      .select("listing_id").eq("user_id", user.id)
    setUserLikes(new Set((data||[]).map(l=>l.listing_id)))
  }

  async function toggleLike(listingId) {
    if (!user) return toast.error("Please sign in to like listings")
    const isLiked = userLikes.has(listingId)
    if (isLiked) {
      await supabase.from("marketplace_likes").delete()
        .eq("user_id", user.id).eq("listing_id", listingId)
      setUserLikes(prev => { const n = new Set(prev); n.delete(listingId); return n })
      setListings(ls => ls.map(l => l.id===listingId ? {...l, likes_count:(l.likes_count||1)-1} : l))
      if (selected?.id===listingId) setSelected(s => ({...s, likes_count:(s.likes_count||1)-1}))
    } else {
      await supabase.from("marketplace_likes").insert({ user_id: user.id, listing_id: listingId })
      setUserLikes(prev => new Set([...prev, listingId]))
      setListings(ls => ls.map(l => l.id===listingId ? {...l, likes_count:(l.likes_count||0)+1} : l))
      if (selected?.id===listingId) setSelected(s => ({...s, likes_count:(s.likes_count||0)+1}))
    }
  }

  async function submitComment(listingId) {
    if (!user) return toast.error("Please sign in to comment")
    if (!newComment.trim()) return toast.error("Please write a comment")
    if (newComment.trim().length > 500) return toast.error("Comment too long (max 500 chars)")
    setSubmittingComment(true)
    try {
      const { data, error } = await supabase.from("marketplace_comments").insert({
        user_id: user.id,
        listing_id: listingId,
        comment: newComment.trim()
      }).select("*, profiles(first_name, last_name, role)").single()
      if (error) throw error
      setComments(prev => [...prev, data])
      setNewComment("")
      setListings(ls => ls.map(l => l.id===listingId ? {...l, comments_count:(l.comments_count||0)+1} : l))
      if (selected?.id===listingId) setSelected(s => ({...s, comments_count:(s.comments_count||0)+1}))
      toast.success("Comment posted!")
    } catch(e) { toast.error("Failed to post comment") }
    finally { setSubmittingComment(false) }
  }

  async function submitReply(listingId, parentCommentId, isSeller) {
    if (!user) return toast.error("Please sign in to reply")
    if (!replyText.trim()) return toast.error("Please write a reply")
    setSubmittingComment(true)
    try {
      const { data, error } = await supabase.from("marketplace_comments").insert({
        user_id: user.id,
        listing_id: listingId,
        comment: replyText.trim(),
        parent_comment_id: parentCommentId,
        is_seller_reply: isSeller
      }).select("*, profiles(first_name, last_name, role)").single()
      if (error) throw error
      setComments(prev => prev.map(cm => 
        cm.id === parentCommentId 
          ? {...cm, replies: [...(cm.replies||[]), data]} 
          : cm
      ))
      setReplyText("")
      setReplyingTo(null)
      toast.success("Reply posted!")
    } catch(e) { toast.error("Failed to post reply") }
    finally { setSubmittingComment(false) }
  }

  async function deleteComment(commentId, listingId) {
    if (!confirm("Delete this comment?")) return
    await supabase.from("marketplace_comments").update({ is_deleted: true }).eq("id", commentId)
    setComments(prev => prev.filter(c => c.id !== commentId))
    setListings(ls => ls.map(l => l.id===listingId ? {...l, comments_count:Math.max(0,(l.comments_count||1)-1)} : l))
  }

  async function shareViaWhatsApp(listing) {
    const url = `https://carcareconnect.care/marketplace`
    const text = `Check out this listing on Car Care Connect: ${listing.title} - KES ${Number(listing.price).toLocaleString()} ${url}`
    const waUrl = `https://wa.me/?text=${encodeURIComponent(text)}`
    const { openExternal } = await import("../../lib/openExternal")
    openExternal(waUrl)
    // Update share count
    await supabase.from("marketplace_listings").update({ shares_count:(listing.shares_count||0)+1 }).eq("id", listing.id)
    setListings(ls => ls.map(l => l.id===listing.id ? {...l, shares_count:(l.shares_count||0)+1} : l))
    if (selected?.id===listing.id) setSelected(s => ({...s, shares_count:(s.shares_count||0)+1}))
  }

  async function openListing(listing) {
    setSelected(listing)
    setActivePhoto(0)
    setComments([])
    setNewComment("")
    loadComments(listing.id)
    await supabase.from("marketplace_listings").update({ views:(listing.views||0)+1 }).eq("id",listing.id)
    const { data: pics } = await supabase.from("marketplace_photos").select("*").eq("listing_id",listing.id).order("display_order")
    setPhotos(pics||[])
    setSellerInfo(listing.profiles)
    const { data: ofs } = await supabase.from("marketplace_offers").select("*").eq("listing_id",listing.id).eq("buyer_id",user.id)
    setOffers(ofs||[])
  }

  const filtered = listings.filter(l=>{
    const matchSearch = `${l.title} ${l.make||""} ${l.model||""} ${l.city||""} ${l.part_category||""}`.toLowerCase().includes(search.toLowerCase())
    const matchMin = !filters.minPrice || Number(l.price)>=Number(filters.minPrice)
    const matchMax = !filters.maxPrice || Number(l.price)<=Number(filters.maxPrice)
    const matchCondition = !filters.condition || l.condition===filters.condition.toLowerCase()
    const matchCity = !filters.city || l.city?.toLowerCase().includes(filters.city.toLowerCase())
    const matchMake = !filters.make || l.make?.toLowerCase().includes(filters.make.toLowerCase())
    const matchFuel = !filters.fuelType || l.fuel_type===filters.fuelType.toLowerCase()
    const matchTrans = !filters.transmission || l.transmission===filters.transmission.toLowerCase()
    return matchSearch&&matchMin&&matchMax&&matchCondition&&matchCity&&matchMake&&matchFuel&&matchTrans
  })

  function getSellerBadge(seller) {
    if (!seller) return { label:"Seller", color:"#777777", bg:"#ffffff" }
    if (seller.role==="provider") return { label:"🏪 Verified Seller", color:"#378add", bg:"#eff6ff" }
    return { label:"👤 Private Seller", color:"#555555", bg:"#f5f5f5" }
  }

  const inp = { width:"100%", background:"#ffffff", border:"1px solid #e5e5e5", borderRadius:8, padding:"9px 12px", color:"#000000", fontSize:12, outline:"none", fontFamily:"'DM Sans',sans-serif" }

  if (selected) return (
    <ListingDetail
      listing={selected}
      photos={photos}
      activePhoto={activePhoto}
      setActivePhoto={setActivePhoto}
      sellerInfo={sellerInfo}
      offers={offers}
      user={user}
      isMobile={isMobile}
      onBack={()=>{ setSelected(null); load() }}
      onOffer={()=>openListing(selected)}
      comments={comments}
      newComment={newComment}
      setNewComment={setNewComment}
      userLikes={userLikes}
      toggleLike={toggleLike}
      submitComment={submitComment}
      submitReply={submitReply}
      deleteComment={deleteComment}
      shareViaWhatsApp={shareViaWhatsApp}
      replyingTo={replyingTo}
      setReplyingTo={setReplyingTo}
      replyText={replyText}
      setReplyText={setReplyText}
      submittingComment={submittingComment}
      loadingComments={loadingComments}
    />
  )

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"1.25rem", flexWrap:"wrap", gap:10 }}>
        <div>
          <div style={{ fontFamily:"Syne", fontSize:isMobile?18:22, fontWeight:800, color:"#000000" }}>🛒 Marketplace</div>
          <div style={{ fontSize:12, color:"#777777", marginTop:2 }}>Buy and sell vehicles, parts & accessories</div>
        </div>
        <button onClick={()=>navigate("/dashboard/marketplace/new")}
          style={{ background:"#e6821e", border:"none", borderRadius:9, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:13, fontWeight:700, padding:"10px 20px", cursor:"pointer" }}>
          + List item
        </button>
      </div>

      <div style={{ display:"flex", gap:6, marginBottom:"1rem", flexWrap:"wrap" }}>
        {[{k:"all",l:"All",icon:"🛒"},{k:"vehicle",l:"Vehicles",icon:"🚗"},{k:"part",l:"Parts",icon:"🔧"},{k:"accessory",l:"Accessories",icon:"✨"}].map(t=>(
          <button key={t.k} onClick={()=>setTab(t.k)}
            style={{ padding:"8px 14px", borderRadius:8, border:"none", fontSize:12, cursor:"pointer", background:tab===t.k?"#e6821e":"#f0f0f0", color:tab===t.k?"#fff":"#555", fontFamily:"'DM Sans',sans-serif", fontWeight:tab===t.k?700:400 }}>
            {t.icon} {t.l}
          </button>
        ))}
      </div>

      <div style={{ display:"flex", gap:8, marginBottom:"1rem" }}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search vehicles, parts, makes..."
          style={{ ...inp, flex:1 }}/>
        <button onClick={()=>setShowFilters(f=>!f)}
          style={{ background:showFilters?"#e6821e":"#f0f0f0", border:`1px solid ${showFilters?"#e6821e":"#e0e0e0"}`, borderRadius:8, color:showFilters?"#fff":"#555", fontSize:12, padding:"9px 14px", cursor:"pointer" }}>
          🔽 Filter
        </button>
      </div>

      {showFilters&&(
        <div style={{ background:"#ffffff", border:"1px solid #eeeeee", borderRadius:12, padding:"1rem", marginBottom:"1rem" }}>
          <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr 1fr":"repeat(4,1fr)", gap:10 }}>
            <div><div style={{ fontSize:10, color:"#777777", marginBottom:4 }}>Min price</div><input style={inp} type="number" placeholder="0" value={filters.minPrice} onChange={e=>setFilters(f=>({...f,minPrice:e.target.value}))}/></div>
            <div><div style={{ fontSize:10, color:"#777777", marginBottom:4 }}>Max price</div><input style={inp} type="number" placeholder="Any" value={filters.maxPrice} onChange={e=>setFilters(f=>({...f,maxPrice:e.target.value}))}/></div>
            <div><div style={{ fontSize:10, color:"#777777", marginBottom:4 }}>Condition</div>
              <select style={inp} value={filters.condition} onChange={e=>setFilters(f=>({...f,condition:e.target.value}))}>
                <option value="">Any</option>
                {CONDITIONS.map(c=><option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div><div style={{ fontSize:10, color:"#777777", marginBottom:4 }}>City</div><input style={inp} placeholder="e.g. Nairobi" value={filters.city} onChange={e=>setFilters(f=>({...f,city:e.target.value}))}/></div>
            {tab==="vehicle"&&<>
              <div><div style={{ fontSize:10, color:"#777777", marginBottom:4 }}>Make</div><input style={inp} placeholder="e.g. Toyota" value={filters.make} onChange={e=>setFilters(f=>({...f,make:e.target.value}))}/></div>
              <div><div style={{ fontSize:10, color:"#777777", marginBottom:4 }}>Fuel</div>
                <select style={inp} value={filters.fuelType} onChange={e=>setFilters(f=>({...f,fuelType:e.target.value}))}>
                  <option value="">Any</option>{FUEL_TYPES.map(f=><option key={f} value={f}>{f}</option>)}
                </select>
              </div>
              <div><div style={{ fontSize:10, color:"#777777", marginBottom:4 }}>Transmission</div>
                <select style={inp} value={filters.transmission} onChange={e=>setFilters(f=>({...f,transmission:e.target.value}))}>
                  <option value="">Any</option>{TRANSMISSIONS.map(t=><option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </>}
          </div>
          <button onClick={()=>setFilters({ minPrice:"", maxPrice:"", condition:"", city:"", make:"", fuelType:"", transmission:"" })}
            style={{ background:"none", border:"none", color:"#777777", fontSize:11, cursor:"pointer", marginTop:8 }}>Clear filters</button>
        </div>
      )}

      <div style={{ fontSize:12, color:"#777777", marginBottom:"1rem" }}>{filtered.length} listing{filtered.length!==1?"s":""}</div>

      {loading&&<div style={{ color:"#777777", fontSize:13, textAlign:"center", padding:"2rem" }}>Loading...</div>}
      {!loading&&filtered.length===0&&(
        <div style={{ color:"#888888", fontSize:13, textAlign:"center", padding:"3rem" }}>
          <div style={{ fontSize:40, marginBottom:10 }}>🛒</div>
          No listings found
          <div style={{ marginTop:12 }}>
            <button onClick={()=>navigate("/dashboard/marketplace/new")}
              style={{ background:"#e6821e", border:"none", borderRadius:8, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:12, fontWeight:700, padding:"9px 18px", cursor:"pointer" }}>
              Be the first to list
            </button>
          </div>
        </div>
      )}

      <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr 1fr":"repeat(3,1fr)", gap:12 }}>
        {filtered.map(l=>{
          const badge = getSellerBadge(l.profiles)
          return (
            <div key={l.id} onClick={()=>openListing(l)}
              style={{ background:"#ffffff", border:`1px solid ${l.is_featured?"#e6821e":"#eeeeee"}`, borderRadius:12, overflow:"hidden", cursor:"pointer" }}>
              <div style={{ height:isMobile?120:160, background:"#f5f5f5", position:"relative", display:"flex", alignItems:"center", justifyContent:"center" }}>
                {l.is_featured&&<div style={{ position:"absolute", top:8, left:8, background:"#e6821e", color:"#fff", fontSize:9, fontWeight:700, padding:"2px 7px", borderRadius:10 }}>⭐ FEATURED</div>}
                {l.is_inspected&&<div style={{ position:"absolute", top:8, right:8, background:"#1d9e75", color:"#fff", fontSize:9, fontWeight:700, padding:"2px 7px", borderRadius:10 }}>✓ INSPECTED</div>}
                {l.primary_photo ? (
                  <img src={l.primary_photo} alt={l.title} style={{ width:"100%", height:"100%", objectFit:"cover" }}/>
                ) : (
                  <div style={{ fontSize:40 }}>{l.listing_type==="vehicle"?"🚗":l.listing_type==="part"?"🔧":"✨"}</div>
                )}
              </div>
              <div style={{ padding:"0.75rem" }}>
                <div style={{ fontFamily:"Syne", fontSize:isMobile?12:13, fontWeight:700, color:"#000000", marginBottom:4, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{l.title}</div>
                {l.listing_type==="vehicle"&&<div style={{ fontSize:10, color:"#777777", marginBottom:4 }}>{[l.make,l.model,l.year].filter(Boolean).join(" ")}{l.mileage?` · ${Number(l.mileage).toLocaleString()}km`:""}</div>}
                {l.listing_type==="part"&&<div style={{ fontSize:10, color:"#777777", marginBottom:4 }}>{l.part_category}</div>}
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
                  <div style={{ fontFamily:"Syne", fontSize:isMobile?13:15, fontWeight:800, color:"#e6821e" }}>KES {Number(l.price).toLocaleString()}</div>
                  {l.negotiable&&<span style={{ fontSize:9, color:"#1d9e75" }}>Negotiable</span>}
                  <div style={{ display:"flex", gap:8, marginTop:4 }}>
                    {(l.likes_count>0)&&<span style={{ fontSize:9, color:"#e24b4a" }}>❤️ {l.likes_count}</span>}
                    {(l.comments_count>0)&&<span style={{ fontSize:9, color:"#888" }}>💬 {l.comments_count}</span>}
                    {(l.shares_count>0)&&<span style={{ fontSize:9, color:"#1d9e75" }}>📤 {l.shares_count}</span>}
                  </div>
                </div>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
                  <span style={{ fontSize:9, padding:"2px 6px", borderRadius:6, background:badge.bg, color:badge.color }}>{badge.label}</span>
                  {l.city&&<span style={{ fontSize:9, color:"#888888" }}>📍 {l.city}</span>}
                </div>
                <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
                  {l.condition&&<span style={{ fontSize:9, padding:"1px 6px", borderRadius:6, background:"#f5f5f5", color:"#666" }}>{l.condition}</span>}
                  {l.transmission&&<span style={{ fontSize:9, padding:"1px 6px", borderRadius:6, background:"#f5f5f5", color:"#666" }}>{l.transmission}</span>}
                  {l.fuel_type&&<span style={{ fontSize:9, padding:"1px 6px", borderRadius:6, background:"#f5f5f5", color:"#666" }}>{l.fuel_type}</span>}
                </div>
                <div style={{ fontSize:9, color:"#555555", marginTop:6 }}>👁 {l.views||0} views</div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ListingDetail({ listing, photos, activePhoto, setActivePhoto, sellerInfo, offers, user, isMobile, onBack, onOffer, comments, newComment, setNewComment, userLikes, toggleLike, submitComment, submitReply, deleteComment, shareViaWhatsApp, replyingTo, setReplyingTo, replyText, setReplyText, submittingComment, loadingComments }) {
  const [showOffer, setShowOffer] = useState(false)
  const [showChat, setShowChat] = useState(false)
  const [offerPrice, setOfferPrice] = useState("")
  const [offerMessage, setOfferMessage] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const navigate = useNavigate()

  if (!listing) return null

  const badge = sellerInfo?.role==="provider"
    ? { label:"🏪 Verified Seller", color:"#378add", bg:"#eff6ff" }
    : { label:"👤 Private Seller", color:"#555555", bg:"#f5f5f5" }

  const existingOffer = offers?.find(o=>o.status==="pending"||o.status==="countered")

  if (showChat) return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", zIndex:200, display:"flex", alignItems:"flex-end", justifyContent:"center" }}>
      <div style={{ width:"100%", maxWidth:500, background:"#fff", borderRadius:"16px 16px 0 0", height:"70vh", display:"flex", flexDirection:"column", overflow:"hidden" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"1rem", borderBottom:"1px solid #eee", flexShrink:0 }}>
          <div>
            <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:800, color:"#000" }}>{listing.title}</div>
            <div style={{ fontSize:11, color:"#888" }}>Chat with {sellerInfo?.business_name||sellerInfo?.first_name||"Seller"}</div>
          </div>
          <button onClick={()=>setShowChat(false)} style={{ background:"#f5f5f5", border:"none", borderRadius:"50%", width:32, height:32, cursor:"pointer", fontSize:18 }}>×</button>
        </div>
        <div style={{ flex:1, minHeight:0 }}>
          <ChatWindow
            listingId={listing.id}
            otherUserId={listing.seller_id}
            otherUserName={sellerInfo?.business_name||sellerInfo?.first_name||"Seller"}
            onClose={()=>setShowChat(false)}
          />

            {/* Comments Section */}
            <div style={{ marginTop:16, background:"#ffffff", border:"1px solid #eeeeee", borderRadius:12, padding:"1rem" }}>
              <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:800, color:"#000", marginBottom:12 }}>💬 Comments ({listing.comments_count||0})</div>
              <div style={{ display:"flex", gap:8, marginBottom:16 }}>
                <textarea id="comment-input" value={newComment} onChange={e=>setNewComment(e.target.value)}
                  placeholder="Write a comment... (contact sharing not allowed)" rows={2}
                  style={{ flex:1, background:"#f8f8f8", border:"1px solid #eeeeee", borderRadius:8, padding:"10px 12px", fontSize:12, color:"#000", outline:"none", resize:"none", fontFamily:"DM Sans,sans-serif" }}/>
                <button onClick={()=>submitComment(listing.id)} disabled={submittingComment||!newComment.trim()}
                  style={{ background:submittingComment||!newComment.trim()?"#eeeeee":"#e6821e", border:"none", borderRadius:8, color:submittingComment||!newComment.trim()?"#999":"#fff", fontSize:12, fontWeight:700, padding:"0 14px", cursor:submittingComment||!newComment.trim()?"not-allowed":"pointer", flexShrink:0 }}>
                  {submittingComment?"...":"Post"}
                </button>
              </div>
              {loadingComments&&<div style={{ color:"#888", fontSize:12, textAlign:"center" }}>Loading...</div>}
              {!loadingComments&&comments.length===0&&<div style={{ color:"#888", fontSize:12, textAlign:"center", padding:"1rem" }}>No comments yet. Be the first!</div>}
              {/* Video context label */}
              {listing.video_url&&listing.video_status==="approved"&&(
                <div style={{ fontSize:11, color:"#888", marginBottom:12, display:"flex", alignItems:"center", gap:6 }}>
                  <span>🎥</span> Comments below refer to this listing and its video
                </div>
              )}

              {comments.map(cm=>(
                <div key={cm.id} style={{ marginBottom:14 }}>
                  {/* Main comment */}
                  <div style={{ display:"flex", gap:10, alignItems:"flex-start" }}>
                    <div style={{ width:32, height:32, borderRadius:"50%", background:"#fff8f0", border:"1px solid #e6821e30", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"Syne", fontSize:12, fontWeight:800, color:"#e6821e", flexShrink:0 }}>
                      {(cm.profiles?.first_name||"?")[0].toUpperCase()}
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:2 }}>
                        <span style={{ fontSize:12, fontWeight:700, color:"#000" }}>{cm.profiles?.first_name} {cm.profiles?.last_name}</span>
                        <span style={{ fontSize:10, color:"#888" }}>{new Date(cm.created_at).toLocaleDateString()}</span>
                        {user?.id===cm.user_id&&(
                          <button onClick={()=>deleteComment(cm.id, listing.id)} style={{ marginLeft:"auto", background:"none", border:"none", color:"#e24b4a", fontSize:10, cursor:"pointer", padding:0 }}>Delete</button>
                        )}
                      </div>
                      <div style={{ fontSize:12, color:"#333", lineHeight:1.5, background:"#f8f8f8", borderRadius:"4px 12px 12px 12px", padding:"8px 12px" }}>{cm.comment}</div>
                      {/* Reply button - visible to seller and all users */}
                      <button onClick={()=>{ setReplyingTo(replyingTo===cm.id?null:cm.id); setReplyText("") }}
                        style={{ background:"none", border:"none", color:"#378add", fontSize:10, cursor:"pointer", padding:"4px 0", fontWeight:600 }}>
                        {replyingTo===cm.id?"Cancel":"↩ Reply"}
                        {user?.id===listing?.seller_id&&" (as seller)"}
                      </button>
                      {/* Reply input */}
                      {replyingTo===cm.id&&(
                        <div style={{ display:"flex", gap:6, marginTop:6 }}>
                          <textarea value={replyText} onChange={e=>setReplyText(e.target.value)}
                            placeholder={user?.id===listing?.seller_id?"Reply as seller...":"Write a reply..."}
                            rows={2} style={{ flex:1, background:"#f0f7ff", border:"1px solid #378add30", borderRadius:8, padding:"8px 10px", fontSize:11, color:"#000", outline:"none", resize:"none" }}/>
                          <button onClick={()=>submitReply(listing.id, cm.id, user?.id===listing?.seller_id)} disabled={submittingComment||!replyText.trim()}
                            style={{ background:submittingComment||!replyText.trim()?"#eeeeee":"#378add", border:"none", borderRadius:8, color:"#fff", fontSize:11, fontWeight:700, padding:"0 12px", cursor:"pointer", flexShrink:0 }}>
                            {submittingComment?"...":"Reply"}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  {/* Replies */}
                  {(cm.replies||[]).filter(r=>!r.is_deleted).map(reply=>(
                    <div key={reply.id} style={{ display:"flex", gap:8, alignItems:"flex-start", marginTop:8, marginLeft:42 }}>
                      <div style={{ width:26, height:26, borderRadius:"50%", background:reply.is_seller_reply?"#eff6ff":"#f8f8f8", border:`1px solid ${reply.is_seller_reply?"#378add30":"#eeeeee"}`, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"Syne", fontSize:10, fontWeight:800, color:reply.is_seller_reply?"#378add":"#888", flexShrink:0 }}>
                        {(reply.profiles?.first_name||"?")[0].toUpperCase()}
                      </div>
                      <div style={{ flex:1 }}>
                        <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:2 }}>
                          <span style={{ fontSize:11, fontWeight:700, color:"#000" }}>{reply.profiles?.first_name} {reply.profiles?.last_name}</span>
                          {reply.is_seller_reply&&<span style={{ fontSize:9, background:"#eff6ff", color:"#378add", padding:"1px 6px", borderRadius:8, fontWeight:700 }}>Seller</span>}
                          <span style={{ fontSize:9, color:"#888" }}>{new Date(reply.created_at).toLocaleDateString()}</span>
                          {user?.id===reply.user_id&&(
                            <button onClick={()=>deleteComment(reply.id, listing.id)} style={{ marginLeft:"auto", background:"none", border:"none", color:"#e24b4a", fontSize:9, cursor:"pointer", padding:0 }}>Delete</button>
                          )}
                        </div>
                        <div style={{ fontSize:11, color:"#333", lineHeight:1.5, background:reply.is_seller_reply?"#eff6ff":"#f8f8f8", borderRadius:"4px 12px 12px 12px", padding:"6px 10px" }}>{reply.comment}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
        </div>
      </div>
    </div>
  )

  async function submitOffer(e) {
    e.preventDefault()
    if (!offerPrice) return
    setSubmitting(true)
    try {
      const { error } = await supabase.from("marketplace_offers").insert({
        listing_id:listing.id, buyer_id:user.id, seller_id:listing.seller_id,
        offered_price:parseFloat(offerPrice), message:offerMessage, status:"pending",
      })
      if (error) throw error
      await supabase.from("notifications").insert({
        user_id:listing.seller_id, title:"New offer on your listing 💰",
        message:`Someone offered KES ${Number(offerPrice).toLocaleString()} for: ${listing.title}`,
        type:"info",
      })
      toast.success("Offer submitted!")
      setShowOffer(false)
      setOfferPrice("")
      setOfferMessage("")
      onOffer()
    } catch(err) { toast.error(err.message) }
    finally { setSubmitting(false) }
  }

  return (
    <div>
      <button onClick={onBack} style={{ background:"none", border:"none", color:"#e6821e", cursor:"pointer", fontSize:13, marginBottom:"1rem", fontFamily:"'DM Sans',sans-serif", padding:0 }}>
        ← Back to marketplace
      </button>

      <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:"1.5rem" }}>
        <div>
          <div style={{ background:"#f5f5f5", borderRadius:12, height:isMobile?220:300, display:"flex", alignItems:"center", justifyContent:"center", marginBottom:8, overflow:"hidden" }}>
            {photos.length>0
              ? <img src={photos[activePhoto]?.photo_url} alt={listing.title} style={{ width:"100%", height:"100%", objectFit:"cover" }}/>
              : <div style={{ fontSize:64 }}>{listing.listing_type==="vehicle"?"🚗":listing.listing_type==="part"?"🔧":"✨"}</div>
            }
          </div>
          {photos.length>1&&(
            <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
              {photos.map((p,i)=>(
                <div key={p.id} onClick={()=>setActivePhoto(i)}
                  style={{ width:48, height:48, borderRadius:6, overflow:"hidden", border:`2px solid ${i===activePhoto?"#e6821e":"transparent"}`, cursor:"pointer" }}>
                  <img src={p.photo_url} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }}/>
                </div>
              ))}
            </div>
          )}
          {listing.video_url&&listing.video_status==="approved"&&(
            <div style={{ marginTop:10 }}>
              <div style={{ fontSize:12, fontWeight:700, color:"#555", marginBottom:6 }}>🎥 Video</div>
              <video src={listing.video_url} controls style={{ width:"100%", borderRadius:8, maxHeight:250 }}/>
            </div>
          )}
        </div>

        <div>
          <div style={{ marginBottom:8 }}>
            {listing.is_featured&&<span style={{ fontSize:10, background:"#e6821e", color:"#fff", padding:"2px 8px", borderRadius:10, marginRight:4 }}>⭐ Featured</span>}
            {listing.is_inspected&&<span style={{ fontSize:10, background:"#1d9e75", color:"#fff", padding:"2px 8px", borderRadius:10 }}>✓ CCC Inspected</span>}
          </div>
          <div style={{ fontFamily:"Syne", fontSize:isMobile?18:22, fontWeight:800, color:"#000000", marginBottom:8 }}>{listing.title}</div>
          <div style={{ fontFamily:"Syne", fontSize:isMobile?22:28, fontWeight:800, color:"#e6821e", marginBottom:4 }}>KES {Number(listing.price).toLocaleString()}</div>
          {listing.negotiable&&<div style={{ fontSize:12, color:"#1d9e75", marginBottom:12 }}>✓ Price negotiable</div>}

          {listing.listing_type==="vehicle"&&(
            <div style={{ background:"#ffffff", borderRadius:10, padding:"0.9rem", marginBottom:12 }}>
              <div style={{ fontSize:11, color:"#777777", marginBottom:8, textTransform:"uppercase" }}>Vehicle details</div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                {[{l:"Make",v:listing.make},{l:"Model",v:listing.model},{l:"Year",v:listing.year},{l:"Mileage",v:listing.mileage?`${Number(listing.mileage).toLocaleString()}km`:null},{l:"Color",v:listing.color},{l:"Transmission",v:listing.transmission},{l:"Fuel",v:listing.fuel_type},{l:"Engine",v:listing.engine_size},{l:"Body",v:listing.body_type},{l:"Drive",v:listing.drive_type},{l:"Condition",v:listing.condition}].filter(f=>f.v).map(f=>(
                  <div key={f.l}>
                    <div style={{ fontSize:10, color:"#888888" }}>{f.l}</div>
                    <div style={{ fontSize:12, color:"#000000", fontWeight:500, textTransform:"capitalize" }}>{f.v}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {listing.listing_type==="part"&&(
            <div style={{ background:"#ffffff", borderRadius:10, padding:"0.9rem", marginBottom:12 }}>
              <div style={{ fontSize:11, color:"#777777", marginBottom:8, textTransform:"uppercase" }}>Part details</div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                {[{l:"Category",v:listing.part_category},{l:"Condition",v:listing.condition},{l:"Part No.",v:listing.part_number},{l:"Qty",v:listing.quantity}].filter(f=>f.v).map(f=>(
                  <div key={f.l}><div style={{ fontSize:10, color:"#888888" }}>{f.l}</div><div style={{ fontSize:12, color:"#000000" }}>{f.v}</div></div>
                ))}
              </div>
              {listing.compatible_makes?.length>0&&(
                <div style={{ marginTop:8 }}>
                  <div style={{ fontSize:10, color:"#888888", marginBottom:4 }}>Compatible with</div>
                  <div style={{ display:"flex", flexWrap:"wrap", gap:4 }}>
                    {listing.compatible_makes.map(m=><span key={m} style={{ fontSize:10, padding:"2px 7px", borderRadius:6, background:"#f5f5f5", color:"#555555" }}>{m}</span>)}
                  </div>
                </div>
              )}
            </div>
          )}

          {listing.description&&(
            <div style={{ background:"#ffffff", borderRadius:10, padding:"0.9rem", marginBottom:12 }}>
              <div style={{ fontSize:11, color:"#777777", marginBottom:6, textTransform:"uppercase" }}>Description</div>
              <div style={{ fontSize:13, color:"#555555", lineHeight:1.7 }}>{listing.description}</div>
            </div>
          )}

          <div style={{ background:"#ffffff", borderRadius:10, padding:"0.9rem", marginBottom:12 }}>
            <div style={{ fontSize:11, color:"#777777", marginBottom:8, textTransform:"uppercase" }}>Seller</div>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <div style={{ width:40, height:40, borderRadius:"50%", background:badge.bg, border:`1px solid ${badge.color}40`, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"Syne", fontSize:14, fontWeight:800, color:badge.color, flexShrink:0 }}>
                {sellerInfo?.first_name?.[0]}{sellerInfo?.last_name?.[0]}
              </div>
              <div>
                <div style={{ fontSize:13, color:"#000000", fontWeight:600 }}>{sellerInfo?.business_name||`${sellerInfo?.first_name} ${sellerInfo?.last_name}`}</div>
                <span style={{ fontSize:10, padding:"2px 7px", borderRadius:6, background:badge.bg, color:badge.color }}>{badge.label}</span>
              </div>
            </div>
            {listing.city&&<div style={{ fontSize:11, color:"#777777", marginTop:8 }}>📍 {listing.city}</div>}
          </div>

          {listing.seller_id!==user?.id&&(
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              <button onClick={()=>setShowChat(true)}
                style={{ width:"100%", background:"#000", border:"none", borderRadius:10, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:14, fontWeight:700, padding:"13px", cursor:"pointer" }}>
                💬 Message seller
              </button>

              {/* Social actions */}
              <div style={{ display:"flex", gap:8, marginTop:4 }}>
                <button onClick={()=>toggleLike(listing.id)}
                  style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:6, background:userLikes?.has(listing.id)?"#fff0f3":"#f8f8f8", border:`1px solid ${userLikes?.has(listing.id)?"#e24b4a40":"#eeeeee"}`, borderRadius:10, padding:"10px", cursor:"pointer", transition:"all 0.15s" }}>
                  <span style={{ fontSize:18 }}>{userLikes?.has(listing.id)?"❤️":"🤍"}</span>
                  <span style={{ fontSize:12, fontWeight:700, color:userLikes?.has(listing.id)?"#e24b4a":"#666" }}>{listing.likes_count||0}</span>
                </button>
                <button onClick={()=>document.getElementById("comment-input").focus()}
                  style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:6, background:"#f8f8f8", border:"1px solid #eeeeee", borderRadius:10, padding:"10px", cursor:"pointer" }}>
                  <span style={{ fontSize:18 }}>💬</span>
                  <span style={{ fontSize:12, fontWeight:700, color:"#666" }}>{listing.comments_count||0}</span>
                </button>
                <button onClick={()=>shareViaWhatsApp(listing)}
                  style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:6, background:"#f0fdf4", border:"1px solid #1d9e7540", borderRadius:10, padding:"10px", cursor:"pointer" }}>
                  <span style={{ fontSize:18 }}>📤</span>
                  <span style={{ fontSize:12, fontWeight:700, color:"#1d9e75" }}>{listing.shares_count||0}</span>
                </button>
              </div>

              {/* Status banner */}
              {!listing.is_inspected&&(
                <div style={{ background:"#fff8f0", border:"1px solid #e6821e40", borderRadius:10, padding:"0.9rem" }}>
                  <div style={{ fontSize:12, color:"#e6821e", fontWeight:600, marginBottom:4 }}>⏳ Pending CCC Inspection</div>
                  <div style={{ fontSize:11, color:"#555555", lineHeight:1.6 }}>
                    This listing is awaiting Car Care Connect vehicle inspection before offers and messages are enabled. This ensures all vehicles on our platform are verified and trustworthy.
                  </div>
                </div>
              )}

              {listing.is_inspected&&(
                <div style={{ background:"#f0fdf4", border:"1px solid #1d9e7540", borderRadius:10, padding:"0.75rem", display:"flex", alignItems:"center", gap:8 }}>
                  <span style={{ fontSize:14 }}>✓</span>
                  <div>
                    <div style={{ fontSize:12, color:"#1d9e75", fontWeight:600 }}>CCC Verified Vehicle</div>
                    <div style={{ fontSize:10, color:"#777777" }}>Inspected and approved by Car Care Connect</div>
                  </div>
                </div>
              )}

              {/* Offer button - only if inspected */}
              {listing.is_inspected&&(
                existingOffer?(
                  <div style={{ background:"#f0fdf4", border:"1px solid #1d9e7540", borderRadius:10, padding:"0.9rem" }}>
                    <div style={{ fontSize:12, color:"#1d9e75", fontWeight:600 }}>✓ Offer submitted</div>
                    <div style={{ fontSize:11, color:"#777777", marginTop:2 }}>KES {Number(existingOffer.offered_price).toLocaleString()} · {existingOffer.status}</div>
                    {existingOffer.counter_price&&<div style={{ fontSize:11, color:"#e6821e", marginTop:4 }}>Counter: KES {Number(existingOffer.counter_price).toLocaleString()}</div>}
                  </div>
                ):(
                  <button onClick={()=>setShowOffer(true)}
                    style={{ background:"#e6821e", border:"none", borderRadius:10, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:14, fontWeight:700, padding:"13px", cursor:"pointer" }}>
                    💰 Make an offer
                  </button>
                )
              )}

              {/* Message button - only if inspected */}
              {listing.is_inspected&&(
                <button onClick={()=>setShowChat(s=>!s)}
                style={{ background:"#eff6ff", border:"1px solid #378add40", borderRadius:10, color:"#378add", fontFamily:"Syne,sans-serif", fontSize:13, fontWeight:600, padding:"12px", cursor:"pointer" }}>
                  💬 {showChat?"Close chat":"Open chat"}
                </button>
              )}
            {showChat&&(
              <div style={{ marginTop:8, height:400 }}>
                <ChatWindow
                  listingId={listing.id}
                  otherUserId={listing.seller_id}
                  otherUserName={sellerInfo?.business_name||`${sellerInfo?.first_name} ${sellerInfo?.last_name}`}
                  onClose={()=>setShowChat(false)}
                />
              </div>
            )}
            </div>
          )}

          {listing.seller_id===user?.id&&(
            <div style={{ background:"#ffffff", border:"1px solid #eeeeee", borderRadius:10, padding:"0.9rem", textAlign:"center" }}>
              <div style={{ fontSize:12, color:"#777777" }}>This is your listing · 👁 {listing.views||0} views</div>
            </div>
          )}
        </div>
      </div>

      {showOffer&&(
        <div style={{ position:"fixed", inset:0, zIndex:200, display:"flex", alignItems:isMobile?"flex-end":"center", justifyContent:"center" }}
          onClick={e=>{ if(e.target===e.currentTarget) setShowOffer(false) }}>
          <div style={{ position:"absolute", inset:0, background:"rgba(0,0,0,0.75)" }} onClick={()=>setShowOffer(false)}/>
          <div style={{ position:"relative", zIndex:1, background:"#ffffff", border:"1px solid #e5e5e5", borderRadius:isMobile?"20px 20px 0 0":"16px", padding:"1.5rem", width:isMobile?"100%":"420px" }}>
            {isMobile&&<div style={{ width:40, height:4, background:"#e5e5e5", borderRadius:2, margin:"0 auto 1.5rem" }}/>}
            <div style={{ fontFamily:"Syne", fontSize:16, fontWeight:800, color:"#000000", marginBottom:4 }}>Make an offer</div>
            <div style={{ fontSize:12, color:"#777777", marginBottom:"1.25rem" }}>Asking: KES {Number(listing.price).toLocaleString()}</div>
            <form onSubmit={submitOffer}>
              <label style={{ fontSize:11, color:"#666", display:"block", marginBottom:4 }}>Your offer (KES) *</label>
              <input type="number" value={offerPrice} onChange={e=>setOfferPrice(e.target.value)} required
                style={{ width:"100%", background:"#ffffff", border:"1px solid #e5e5e5", borderRadius:8, padding:"11px 12px", color:"#000000", fontSize:13, outline:"none", fontFamily:"'DM Sans',sans-serif", marginBottom:12 }}/>
              <label style={{ fontSize:11, color:"#666", display:"block", marginBottom:4 }}>Message (optional)</label>
              <textarea value={offerMessage} onChange={e=>setOfferMessage(e.target.value)}
                placeholder="Introduce yourself..."
                style={{ width:"100%", background:"#ffffff", border:"1px solid #e5e5e5", borderRadius:8, padding:"11px 12px", color:"#000000", fontSize:13, outline:"none", fontFamily:"'DM Sans',sans-serif", resize:"vertical", minHeight:70, marginBottom:12 }}/>
              <div style={{ background:"#fff8f0", border:"1px solid #e6821e30", borderRadius:8, padding:"0.75rem", marginBottom:16 }}>
                <div style={{ fontSize:11, color:"#e6821e" }}>⚠️ Do not share personal contact details. All communication must stay on Car Care Connect.</div>
              </div>
              <div style={{ display:"flex", gap:8 }}>
                <button type="submit" disabled={submitting}
                  style={{ flex:1, background:submitting?"#555555":"#e6821e", border:"none", borderRadius:9, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:13, fontWeight:700, padding:"12px", cursor:submitting?"not-allowed":"pointer" }}>
                  {submitting?"Submitting...":"Submit offer"}
                </button>
                <button type="button" onClick={()=>setShowOffer(false)}
                  style={{ background:"none", border:"1px solid #dddddd", borderRadius:9, color:"#666", fontSize:13, padding:"12px 18px", cursor:"pointer" }}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}





