import { useEffect, useState } from "react"
import { pushNotify } from "../../lib/pushNotify"
import { MarketplaceIcon, VehicleIcon, ServicesIcon, LocationIcon, HeartIcon, ChatIcon, ShareIcon, EyeIcon, MyListingsIcon, ShieldIcon, WarningIcon, FilterIcon, SearchIcon, PartsIcon, NoteIcon, CrownIcon, StarIcon, CheckIcon, NewIcon, AccessoryIcon, SettingsIcon, HomeIcon, ReceiptIcon } from "../../lib/cccIcons"
import { supabase } from "../../lib/supabase"
import SellerProfile from "./SellerProfile"
import NewCarMarketplace from "../customer/NewCarMarketplace"
import MyNewCarListings from "../customer/MyNewCarListings"
import CustomerPartsMarketplace from "../customer/CustomerPartsMarketplace"
import MarketplaceCart from "./MarketplaceCart"
import { useAuth } from "../../contexts/AuthContext"
import { useNavigate, useSearchParams } from "react-router-dom"
import ChatWindow from "../shared/ChatWindow"
import useIsMobile from "../../lib/useIsMobile"
import toast from "react-hot-toast"

const FUEL_TYPES = ["Petrol","Diesel","Electric","Hybrid"]
const TRANSMISSIONS = ["Manual","Automatic"]
const CONDITIONS = ["New","Used","Refurbished","For parts"]

export default function Marketplace() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const isMobile = useIsMobile()
  const [listings, setListings] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState(() => searchParams.get("tab") || "all")
  const [orders, setOrders] = useState([])
  const [cart, setCart] = useState([])
  const [showCart, setShowCart] = useState(false)
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
  const [viewingSeller, setViewingSeller] = useState(null)
  const [similarListings, setSimilarListings] = useState([])
  const [activeFilter, setActiveFilter] = useState(null)
  const featured = listings.filter(l=>l.is_featured&&l.status==="active").slice(0,1)
  const [reportingListing, setReportingListing] = useState(null)
  const [reportReason, setReportReason] = useState("")
  const [submittingReport, setSubmittingReport] = useState(false)
  const [submittingComment, setSubmittingComment] = useState(false)
  const [replyingTo, setReplyingTo] = useState(null)
  const [replyText, setReplyText] = useState("")
  const [loadingComments, setLoadingComments] = useState(false)

  useEffect(() => { load(); loadUserLikes(); if(tab==="my_orders") loadOrders() }, [tab])
  // Directly adds a shop inventory item to the real cart, instead of navigating away to a
  // separate Parts & Accessories page - the listing card already has everything addToCart needs.
  function addToCart(listing) {
    setCart(prev => {
      const existing = prev.find(c=>c.id===listing.id)
      if (existing) return prev.map(c=>c.id===listing.id?{...c,qty:c.qty+1}:c)
      return [...prev, { id:listing.id, name:listing.title, price:listing.price, provider_id:listing.seller_id, stock_quantity:listing.quantity, unit:"unit", qty:1 }]
    })
    toast.success(listing.title+" added to cart")
  }

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

  async function loadOrders() {
    if (!user) return
    const { data } = await supabase.from("orders")
      .select("*, order_items(*, inventory(name,unit)), profiles!orders_provider_id_fkey(business_name,first_name,last_name)")
      .eq("customer_id", user.id)
      .order("created_at", { ascending:false })
    setOrders(data||[])
  }
  async function load() {
    setLoading(true)
    try {
      let usedListings = []
      let newCarListings = []
      if(tab==="all" || tab==="vehicle" || tab==="part" || tab==="accessory" || tab==="parts_shop" || tab==="saved" || tab==="my_listings") {
        let query = supabase.from("marketplace_listings")
          .select("*, profiles(first_name,last_name,role,business_name), marketplace_photos(photo_url,is_primary), video_url, video_status")
          .eq("status","active")
          .order("is_featured",{ascending:false})
          .order("created_at",{ascending:false})
        if(tab==="vehicle") query = query.eq("listing_type","vehicle")
        else if(tab==="part" || tab==="parts_shop") query = query.in("listing_type",["part","accessory"])
        const { data } = await query
        usedListings = (data||[]).map(l=>({
          ...l,
          _type: l.listing_type==="vehicle" ? "used_car" : l.listing_type==="part" ? "part" : l.listing_type==="accessory" ? "accessory" : "part",
          primary_photo: l.marketplace_photos?.find(p=>p.is_primary)?.photo_url||l.marketplace_photos?.[0]?.photo_url
        }))
      }
      if(tab==="all" || tab==="new_cars" || tab==="saved" || tab==="my_listings") {
        const { data: newCars } = await supabase.from("new_car_listings")
          .select("*")
          .eq("is_active", true)
          .eq("listing_fee_paid", true)
          .order("is_featured",{ascending:false})
          .order("created_at",{ascending:false})
        newCarListings = (newCars||[]).map(l=>({
          ...l,
          _type: "new_car",
          title: (l.brand||"")+" "+(l.model||"")+" "+(l.year||""),
          price: l.price,
          city: l.showroom_location,
          primary_photo: l.photos?.[0]||null,
          profiles: { first_name: l.showroom_name, business_name: l.showroom_name },
          listing_type: "new_car",
        }))
      }
      // Load provider inventory (parts & accessories)
      let inventoryListings = []
      if(tab==="all" || tab==="part" || tab==="parts_shop" || tab==="accessory" || tab==="saved" || tab==="my_listings") {
        const { data: inv } = await supabase.from("inventory")
          .select("*, profiles!inventory_provider_id_fkey(first_name,last_name,business_name,role)")
          .eq("is_active", true)
          .order("created_at", { ascending:false })
        inventoryListings = (inv||[]).map(l=>({
          ...l,
          _type: l.category==="accessories" ? "accessory" : "part",
          listing_type: l.category==="accessories" ? "accessory" : "part",
          title: l.name,
          city: l.profiles?.business_name||"Kenya",
          primary_photo: l.photos?.[0]||null,
          profiles: l.profiles,
          seller_id: l.provider_id,
          part_category: l.category,
          compatible_makes: l.compatible_cars?.join(", ")||"",
          quantity: l.stock_quantity,
          condition: "New",
          negotiable: false,
          status: "active",
          _source: "inventory"
        }))
      }
      const merged = [...usedListings, ...newCarListings, ...inventoryListings]
        .sort((a,b) => {
          if(a.is_featured && !b.is_featured) return -1
          if(!a.is_featured && b.is_featured) return 1
          return new Date(b.created_at) - new Date(a.created_at)
        })
      setListings(merged)
    } catch(e) { console.error("Load error:", e) }
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
      const { error } = await supabase.from("marketplace_likes").delete()
        .eq("user_id", user.id).eq("listing_id", listingId)
      if (error) return toast.error("Couldn't unlike - try again")
      setUserLikes(prev => { const n = new Set(prev); n.delete(listingId); return n })
      setListings(ls => ls.map(l => l.id===listingId ? {...l, likes_count:(l.likes_count||1)-1} : l))
      if (selected?.id===listingId) setSelected(s => ({...s, likes_count:(s.likes_count||1)-1}))
    } else {
      const { error } = await supabase.from("marketplace_likes").insert({ user_id: user.id, listing_id: listingId })
      // 23505 = already liked (a race with loadUserLikes still loading, or stale local state) -
      // the database already reflects "liked", so just sync local state to match instead of
      // surfacing a confusing error for something that isn't really a failure.
      if (error && error.code !== "23505") return toast.error("Couldn't like - try again")
      setUserLikes(prev => new Set([...prev, listingId]))
      if (!error) {
        setListings(ls => ls.map(l => l.id===listingId ? {...l, likes_count:(l.likes_count||0)+1} : l))
        if (selected?.id===listingId) setSelected(s => ({...s, likes_count:(s.likes_count||0)+1}))
      }
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
    console.log("Opening listing _type:", listing._type, "listing_type:", listing.listing_type)
    setSelected(listing)
    setActivePhoto(0)
    setComments([])
    setNewComment("")
    if(listing._type === "new_car") {
      setPhotos([])
      setOffers([])
      setSellerInfo({ first_name: listing.showroom_name, business_name: listing.showroom_name })
      return
    }
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
    if (seller.role==="provider") return { label:"Verified Seller", color:"#378add", bg:"#eff6ff" }
    return { label:"Private Seller", color:"#555555", bg:"#f5f5f5" }
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
      addToCart={addToCart}
    />
  )

  // new_cars now handled inline
  // parts_shop now handled inline
  if (tab==="my_orders") {
    const SC = { pending:"#e6821e", confirmed:"#378add", preparing:"#378add", ready:"#8b5cf6", delivered:"#1d9e75", cancelled:"#e24b4a" }
    return (
      <div>
        <div style={{ fontFamily:"Syne", fontSize:18, fontWeight:800, marginBottom:"1rem", display:"flex", alignItems:"center", gap:8 }}><ReceiptIcon size={20} color="#e6821e" /> My Orders</div>
        {orders.length===0 ? (
          <div style={{ textAlign:"center", padding:"3rem", color:"#888" }}>
            <div style={{ marginBottom:12, display:"flex", justifyContent:"center" }}><ReceiptIcon size={48} color="#e6821e"/></div>
            <div style={{ fontWeight:700, marginBottom:6 }}>No orders yet</div>
            <div style={{ fontSize:13, marginBottom:16 }}>Orders from shop parts & accessories will show up here</div>
            <button onClick={()=>setTab("parts_shop")} style={{ background:"#e6821e", border:"none", borderRadius:8, color:"#fff", fontSize:13, fontWeight:700, padding:"10px 20px", cursor:"pointer" }}>
              Browse Parts & Accessories
            </button>
          </div>
        ) : (
          orders.map(o=>(
            <div key={o.id} style={{ background:"#ffffff", border:"1px solid #eeeeee", borderRadius:10, padding:"1rem", marginBottom:8 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
                <div>
                  <div style={{ fontSize:13, fontWeight:600, color:"#000000" }}>#{o.order_number}</div>
                  <div style={{ fontSize:11, color:"#777777" }}>{o.profiles?.business_name||o.profiles?.first_name} · {o.fulfillment_type}</div>
                  <div style={{ fontSize:10, color:"#888888" }}>{new Date(o.created_at).toLocaleString()}</div>
                </div>
                <div style={{ textAlign:"right" }}>
                  <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:800, color:"#e6821e" }}>KES {Number(o.subtotal||0).toLocaleString()}</div>
                  <span style={{ fontSize:10, padding:"3px 10px", borderRadius:20, background:(SC[o.status]||"#888")+"20", color:SC[o.status]||"#888", fontWeight:600, border:"1px solid "+(SC[o.status]||"#888")+"30" }}>{o.status?.toUpperCase()}</span>
                </div>
              </div>
              {o.order_items?.map(oi=>(
                <div key={oi.id} style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:"#666", padding:"4px 0", borderTop:"1px solid #eeeeee" }}>
                  <span>{oi.name} x{oi.quantity}</span>
                  <span>KES {Number(oi.unit_price*oi.quantity).toLocaleString()}</span>
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    )
  }
  if (tab==="my_listings") {
    // Filter listings belonging to current user
    const myListings = listings.filter(l => l.user_id === user?.id || l.dealer_id === user?.id)
    return (
      <div>
        <div style={{ fontFamily:"Syne", fontSize:18, fontWeight:800, marginBottom:"1rem", display:"flex", alignItems:"center", gap:8 }}><MyListingsIcon size={20} color="#e6821e" /> My Listings</div>
        {myListings.length===0 ? (
          <div style={{ textAlign:"center", padding:"3rem", color:"#888" }}>
            <div style={{ marginBottom:12, display:"flex", justifyContent:"center" }}><NoteIcon size={48} color="#e6821e"/></div>
            <div style={{ fontWeight:700, marginBottom:6 }}>No listings yet</div>
            <div style={{ fontSize:13, marginBottom:16 }}>Start selling by listing a vehicle or part</div>
            <button onClick={()=>setTab("all")} style={{ background:"#e6821e", border:"none", borderRadius:8, color:"#fff", fontSize:13, fontWeight:700, padding:"10px 20px", cursor:"pointer" }}>
              Browse Marketplace
            </button>
          </div>
        ) : (
          <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr 1fr":"repeat(3,1fr)", gap:10 }}>
            {myListings.map(l=>(
              <div key={l.id} onClick={()=>setSelected(l)} style={{ background:"#fff", border:"1px solid #eee", borderRadius:12, overflow:"hidden", cursor:"pointer" }}>
                <div style={{ height:130, background:"#f5f5f5", position:"relative", display:"flex", alignItems:"center", justifyContent:"center" }}>
                  {l.primary_photo ? <img src={l.primary_photo} alt={l.title} style={{ width:"100%", height:"100%", objectFit:"cover" }}/> : <div style={{ fontSize:36 }}>{l._type==="new_car"?"🚗":l._type==="part"?"⚙️":"🚗"}</div>}
                  <div style={{ position:"absolute", top:6, left:6, background:l._type==="new_car"?"#378add":l._type==="part"?"#8b5cf6":"#1d9e75", color:"#fff", fontSize:9, fontWeight:700, padding:"2px 6px", borderRadius:4, whiteSpace:"nowrap" }}>{l._type==="new_car"?"NEW":l._type==="part"?"PART":"USED"}</div>
                </div>
                <div style={{ padding:"0.75rem" }}>
                  <div style={{ fontFamily:"Syne", fontSize:12, fontWeight:700, marginBottom:4, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{l.title}</div>
                  <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:800, color:"#e6821e" }}>KES {Number(l.price).toLocaleString()}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }
  // my_listings handled below
  if (tab==="saved") return (
    <div>
      <div style={{ fontFamily:"Syne", fontSize:18, fontWeight:800, marginBottom:"1rem", display:"flex", alignItems:"center", gap:8 }}><HeartIcon size={20} color="#e24b4a" /> Saved Listings</div>
      {userLikes.size === 0 ? (
        <div style={{ textAlign:"center", padding:"3rem", color:"#888" }}>
          <div style={{ marginBottom:12, display:"flex", justifyContent:"center" }}><HeartIcon size={48} color="#e24b4a"/></div>
          <div style={{ fontWeight:700, marginBottom:6 }}>No saved listings yet</div>
          <div style={{ fontSize:13 }}>Tap the heart on any listing to save it</div>
        </div>
      ) : (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))", gap:12 }}>
          {listings.filter(l=>userLikes.has(l.id)).map(l=>(
            <div key={l.id} onClick={()=>setSelected(l)} style={{ background:"#fff", border:"1px solid #eee", borderRadius:12, overflow:"hidden", cursor:"pointer" }}>
              <div style={{ height:140, background:"#f5f5f5", display:"flex", alignItems:"center", justifyContent:"center", position:"relative" }}>
                {l.primary_photo ? <img src={l.primary_photo} alt={l.title} style={{ width:"100%", height:"100%", objectFit:"cover" }}/> : <div style={{ fontSize:40 }}>{l.listing_type==="vehicle"?"🚗":"🔧"}</div>}
                <button onClick={e=>{ e.stopPropagation(); toggleLike(l.id) }} style={{ position:"absolute", top:8, right:8, background:"rgba(255,255,255,0.9)", border:"none", borderRadius:"50%", width:32, height:32, cursor:"pointer", fontSize:16 }}>❤️</button>
              </div>
              <div style={{ padding:"0.75rem" }}>
                <div style={{ fontFamily:"Syne", fontSize:13, fontWeight:700, marginBottom:4, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{l.title}</div>
                <div style={{ fontFamily:"Syne", fontSize:15, fontWeight:800, color:"#e6821e" }}>KES {Number(l.price).toLocaleString()}</div>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:4 }}>
                <div style={{ fontSize:11, color:"#888" }}>{l.city}</div>
                {l.seller?.marketplace_rating > 0 && (
                  <div style={{ fontSize:10, color:"#e6821e" }}>
                    ⭐ {Number(l.seller?.marketplace_rating).toFixed(1)} ({l.seller?.marketplace_review_count})
                  </div>
                )}
              </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"1.25rem", flexWrap:"wrap", gap:10 }}>
        <div>
          <div style={{ fontFamily:"Syne", fontSize:isMobile?18:22, fontWeight:800, color:"#000000", display:"flex", alignItems:"center", gap:8 }}><MarketplaceIcon size={22} color="#e6821e" /> Marketplace</div>
          <div style={{ fontSize:12, color:"#777777", marginTop:2 }}>Buy and sell vehicles, parts & accessories</div>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <button onClick={()=>setShowCart(true)} style={{ background:cart.length>0?"#e6821e":"#f5f5f5", border:"1px solid #e0e0e0", borderRadius:9, color:cart.length>0?"#fff":"#666", fontFamily:"Syne,sans-serif", fontSize:13, fontWeight:700, padding:"10px 16px", cursor:"pointer" }}>
            Cart {cart.length>0&&`(${cart.length})`}
          </button>
          <button onClick={()=>navigate("/dashboard/marketplace/new")}
            style={{ background:"#e6821e", border:"none", borderRadius:9, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:13, fontWeight:700, padding:"10px 20px", cursor:"pointer" }}>
            + List item
          </button>
        </div>
      </div>

      <div style={{ display:"flex", gap:6, marginBottom:"1rem", flexWrap:"wrap" }}>
        {[{k:"all",l:"All",icon:"marketplace"},{k:"vehicle",l:"Vehicles",icon:"vehicle"},{k:"new_cars",l:"New Cars",icon:"new"},{k:"parts_shop",l:"Parts& Accessories",icon:"settings"},{k:"my_orders",l:"My Orders",icon:"receipt"},{k:"my_listings",l:"My Listings",icon:"home"},{k:"saved",l:"Saved",icon:"heart"}].map(t=>(
          <button key={t.k} onClick={()=>setTab(t.k)}
            style={{ padding:"8px 14px", borderRadius:8, border:"none", fontSize:12, cursor:"pointer", background:tab===t.k?"#e6821e":"#f0f0f0", color:tab===t.k?"#fff":"#555", fontFamily:"'DM Sans',sans-serif", fontWeight:tab===t.k?700:400, display:"inline-flex", alignItems:"center", gap:5 }}>
            {t.icon==="marketplace"?<MarketplaceIcon size={13} color="currentColor"/>:t.icon==="vehicle"?<VehicleIcon size={13} color="currentColor"/>:t.icon==="new"?<NewIcon size={13} color="currentColor"/>:t.icon==="settings"?<SettingsIcon size={13} color="currentColor"/>:t.icon==="home"?<HomeIcon size={13} color="currentColor"/>:t.icon==="receipt"?<ReceiptIcon size={13} color="currentColor"/>:<HeartIcon size={13} color="currentColor"/>} {t.l}
          </button>
        ))}
      </div>
      <div style={{ fontSize:11, color:"#888", marginBottom:"0.75rem" }}>{listings.length} listing{listings.length!==1?"s":""} available</div>

      <div style={{ display:"flex", gap:8, marginBottom:"1rem" }}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search vehicles, parts, makes..."
          style={{ ...inp, flex:1 }}/>
        <button onClick={()=>setShowFilters(f=>!f)}
          style={{ background:showFilters?"#e6821e":"#f0f0f0", border:`1px solid ${showFilters?"#e6821e":"#e0e0e0"}`, borderRadius:8, color:showFilters?"#fff":"#555", fontSize:12, padding:"9px 14px", cursor:"pointer" }}>
          <FilterIcon size={14} color="#64748B" /> Filter
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
          <div style={{ marginBottom:10, display:"flex", justifyContent:"center" }}><MarketplaceIcon size={40} color="#e6821e" /></div>
          No listings found
          <div style={{ marginTop:12 }}>
            <button onClick={()=>navigate("/dashboard/marketplace/new")}
              style={{ background:"#e6821e", border:"none", borderRadius:8, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:12, fontWeight:700, padding:"9px 18px", cursor:"pointer" }}>
              Be the first to list
            </button>
          </div>
        </div>
      )}

      {/* Filter chips */}
      <div style={{ display:"flex", gap:8, overflowX:"auto", paddingBottom:4, margin:"0 0 12px", flexShrink:0 }}>
        {[{label:"✓ Inspected",key:"inspected"},{label:"Negotiable",key:"negotiable"},{label:"Under KES 500K",key:"under500"},{label:"New arrivals",key:"new"},{label:"⭐ Top rated",key:"rated"}].map(f=>(
          <button key={f.key} onClick={()=>setActiveFilter(prev=>prev===f.key?null:f.key)}
            style={{ padding:"5px 12px", borderRadius:20, border:"0.5px solid "+(activeFilter===f.key?"#e6821e":"#ddd"), fontSize:12, cursor:"pointer", background:activeFilter===f.key?"#fff8f0":"#f5f5f5", color:activeFilter===f.key?"#e6821e":"#555", whiteSpace:"nowrap", flexShrink:0 }}>
            {f.label}
          </button>
        ))}
      </div>
      {/* Featured banner */}
      {listings.filter(l=>l.is_featured&&l.status==="active").length > 0 && (
        <div onClick={()=>openListing(listings.filter(l=>l.is_featured&&l.status==="active")[0])}
          style={{ background:"#fff8f0", border:"0.5px solid #e6821e40", borderRadius:12, padding:"12px 14px", marginBottom:12, display:"flex", alignItems:"center", gap:12, cursor:"pointer" }}>
          <div style={{ width:52, height:52, borderRadius:8, background:"#f5f5f5", overflow:"hidden", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center" }}>
            {listings.filter(l=>l.is_featured)[0]?.primary_photo ? <img src={listings.filter(l=>l.is_featured)[0].primary_photo} style={{ width:"100%", height:"100%", objectFit:"cover" }}/> : <div style={{ fontSize:24 }}>👑</div>}
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:10, color:"#8b5cf6", fontWeight:500, marginBottom:2, display:"flex", alignItems:"center", gap:3 }}><CrownIcon size={10} color="#8b5cf6"/> FEATURED</div>
            <div style={{ fontSize:13, fontWeight:500, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{listings.filter(l=>l.is_featured)[0]?.title}</div>
            <div style={{ fontSize:13, color:"#e6821e", fontWeight:500 }}>KES {Number(listings.filter(l=>l.is_featured)[0]?.price||0).toLocaleString()}</div>
          </div>
          <div style={{ fontSize:12, color:"#e6821e" }}>View →</div>
        </div>
      )}
      <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr 1fr":"repeat(3,1fr)", gap:12 }}>
        {filtered.map(l=>{
          const badge = getSellerBadge(l.profiles)
          return (
            <div key={l.id} onClick={()=>openListing(l)}
              style={{ background:"#ffffff", border:`1px solid ${l.featured_tier==="premium"?"#8b5cf6":l.is_featured?"#e6821e":"#eeeeee"}`, borderRadius:12, overflow:"hidden", cursor:"pointer" }}>
              <div style={{ height:isMobile?120:160, background:"#f5f5f5", position:"relative", display:"flex", alignItems:"center", justifyContent:"center" }}>
                {l.is_featured&&<div style={{ position:"absolute", top:8, left:8, background:l.featured_tier==="premium"?"#8b5cf6":"#e6821e", color:"#fff", fontSize:9, fontWeight:700, padding:"2px 7px", borderRadius:10, zIndex:2 }}>{l.featured_tier==="premium"?<><CrownIcon size={10} color="#fff"/> PREMIUM</>:<><StarIcon size={10} color="#fff"/> FEATURED</>}</div>}
                {l.is_inspected&&<div style={{ position:"absolute", top:8, right:8, background:"#1d9e75", color:"#fff", fontSize:9, fontWeight:700, padding:"2px 7px", borderRadius:10, zIndex:2 }}><><CheckIcon size={10} color="#fff"/> INSPECTED</></div>}
                <button onClick={e=>{ e.stopPropagation(); toggleLike(l.id) }} style={{ position:"absolute", bottom:8, right:8, background:"rgba(255,255,255,0.9)", border:"none", borderRadius:"50%", width:32, height:32, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, boxShadow:"0 2px 8px rgba(0,0,0,0.15)", zIndex:2 }}>
                  <HeartIcon size={16} color="#e24b4a" active={userLikes.has(l.id)} />
                </button>
                {l._type&&<div style={{ position:"absolute", bottom:8, left:8, background:l._type==="new_car"?"#378add":l._type==="part"||l._type==="accessory"?"#8b5cf6":"#1d9e75", color:"#fff", fontSize:9, fontWeight:700, padding:"2px 6px", borderRadius:4, whiteSpace:"nowrap", zIndex:2 }}>{l._type==="new_car"?<><NewIcon size={10} color="#fff"/> NEW</>:l._type==="part"?<><ServicesIcon size={10} color="#fff"/> PART</>:l._type==="accessory"?<><AccessoryIcon size={10} color="#fff"/> ACC</>:<><VehicleIcon size={10} color="#fff"/> USED</>}</div>}
                {l.primary_photo ? (
                  <img src={l.primary_photo} alt={l.title} style={{ width:"100%", height:"100%", objectFit:"cover" }}/>
                ) : (
                  <div style={{ display:"flex", justifyContent:"center" }}>{l.listing_type==="vehicle"?<VehicleIcon size={40} color="#e6821e"/>:l.listing_type==="part"?<PartsIcon size={40} color="#8b5cf6"/>:<MarketplaceIcon size={40} color="#1d9e75"/>}</div>
                )}
              </div>
              <div style={{ padding:"0.75rem" }}>
                <div style={{ fontFamily:"Syne", fontSize:isMobile?12:13, fontWeight:700, color:"#000000", marginBottom:4, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{l.title}</div>
                {l.listing_type==="vehicle"&&l.mileage&&<div style={{ fontSize:10, color:"#777777", marginBottom:4 }}>{Number(l.mileage).toLocaleString()} km · {l.year||""}</div>}
                {l.listing_type==="part"&&<div style={{ fontSize:10, color:"#777777", marginBottom:4 }}>{l.part_category}</div>}
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
                  <div style={{ fontFamily:"Syne", fontSize:isMobile?13:15, fontWeight:800, color:"#e6821e" }}>KES {Number(l.price).toLocaleString()}</div>
                  <span style={{ fontSize:10, color:"#e24b4a", display:"flex", alignItems:"center", gap:2 }}><HeartIcon size={10} color="#e24b4a" /> {l.likes_count||0}</span>
                  {l.seller?.marketplace_rating>0&&<span style={{ fontSize:10, color:"#e6821e", display:"flex", alignItems:"center", gap:2 }}><StarIcon size={9} color="#e6821e"/> {Number(l.seller.marketplace_rating).toFixed(1)}</span>}
                  <span style={{ fontSize:10, color:"#e24b4a", display:"flex", alignItems:"center", gap:2 }}><HeartIcon size={10} color="#e24b4a"/> {l.likes_count||0}</span>
                  {l.negotiable&&<span style={{ fontSize:9, color:"#1d9e75" }}>Negotiable</span>}
                  <div style={{ display:"flex", gap:8, marginTop:4 }}>
                    
                    {(l.comments_count>0)&&<span style={{ fontSize:9, color:"#888", display:"flex", alignItems:"center", gap:2 }}><ChatIcon size={9} color="#888" /> {l.comments_count}</span>}
                    {(l.shares_count>0)&&<span style={{ fontSize:9, color:"#1d9e75", display:"flex", alignItems:"center", gap:2 }}><ShareIcon size={9} color="#1d9e75" /> {l.shares_count}</span>}
                  </div>
                </div>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
                  <span style={{ fontSize:9, padding:"2px 6px", borderRadius:6, background:badge.bg, color:badge.color }}>{badge.label}</span>
                  {l.city&&<span style={{ fontSize:9, color:"#888", display:"flex", alignItems:"center", gap:2 }}><LocationIcon size={9} color="#888"/> {l.city}</span>}
                </div>
                <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
                  {l.condition&&<span style={{ fontSize:9, padding:"1px 6px", borderRadius:6, background:"#f5f5f5", color:"#666" }}>{l.condition}</span>}
                  {l.transmission&&<span style={{ fontSize:9, padding:"1px 6px", borderRadius:6, background:"#f5f5f5", color:"#666" }}>{l.transmission}</span>}
                  {l.fuel_type&&<span style={{ fontSize:9, padding:"1px 6px", borderRadius:6, background:"#f5f5f5", color:"#666" }}>{l.fuel_type}</span>}
                </div>
                <div style={{ fontSize:9, color:"#555555", marginTop:6, display:"flex", alignItems:"center", gap:2 }}><EyeIcon size={9} color="#555555"/> {l.views||0} views</div>
              </div>
            </div>
          )
        })}
      </div>
      <MarketplaceCart cart={cart} setCart={setCart} showCart={showCart} setShowCart={setShowCart} user={user} profile={profile} onOrderComplete={()=>{ setTab("my_orders") }} />
    </div>
  )
}

function ListingDetail({ listing, photos, activePhoto, setActivePhoto, sellerInfo, offers, user, isMobile, onBack, onOffer, comments, newComment, setNewComment, userLikes, toggleLike, submitComment, submitReply, deleteComment, shareViaWhatsApp, replyingTo, setReplyingTo, replyText, setReplyText, submittingComment, loadingComments, addToCart }) {
  const [showOffer, setShowOffer] = useState(false)
  const [showChat, setShowChat] = useState(false)
  const [offerPrice, setOfferPrice] = useState("")
  const [offerMessage, setOfferMessage] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const navigate = useNavigate()

  if (!listing) return null

  const _listingType = listing._type ?? listing.listing_type ?? listing.type

  if(_listingType === "new_car") return (
    <div>
      <button onClick={onBack} style={{ background:"none", border:"none", color:"#e6821e", cursor:"pointer", fontSize:13, marginBottom:"1rem", padding:0 }}>← Back to listings</button>
      {listing.photos?.length>0&&(<div style={{ marginBottom:"1rem" }}>
        <img src={listing.photos[activePhoto||0]} alt={listing.title} style={{ width:"100%", height:isMobile?220:380, objectFit:"cover", borderRadius:12, marginBottom:8 }}/>
        {listing.photos.length>1&&(<div style={{ display:"flex", gap:6, overflowX:"auto" }}>{listing.photos.map((p,i)=>(<img key={i} src={p} alt="" onClick={()=>setActivePhoto(i)} style={{ width:70, height:52, objectFit:"cover", borderRadius:8, flexShrink:0, cursor:"pointer", border:(activePhoto||0)===i?"2px solid #e6821e":"2px solid transparent" }}/>))}</div>)}
      </div>)}
      {listing.video_url&&(<div style={{ marginBottom:"1rem" }}><video src={listing.video_url} controls style={{ width:"100%", borderRadius:12, maxHeight:260, background:"#000" }}/></div>)}
      <div style={{ background:"#fff", border:"1px solid #eee", borderRadius:12, padding:"1rem", marginBottom:"1rem" }}>
        <div style={{ fontFamily:"Syne", fontSize:isMobile?18:22, fontWeight:800, marginBottom:4 }}>{listing.brand} {listing.model} {listing.year}</div>
        <div style={{ fontFamily:"Syne", fontSize:20, fontWeight:800, color:"#e6821e", marginBottom:12 }}>KES {Number(listing.price).toLocaleString()}</div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:12 }}>
          {[{label:"Engine",value:listing.engine_cc?listing.engine_cc+"cc":"—"},{label:"Transmission",value:listing.transmission||"—"},{label:"Fuel",value:listing.fuel_type||"—"},{label:"Drive",value:listing.drive_type||"—"},{label:"Seats",value:listing.seats||"—"},{label:"Doors",value:listing.doors||"—"},{label:"Color",value:listing.exterior_color||"—"},{label:"Interior",value:listing.interior_color||"—"}].map(s=>(<div key={s.label} style={{ background:"#f8f8f8", borderRadius:8, padding:"0.5rem 0.75rem" }}><div style={{ fontSize:10, color:"#888", marginBottom:2 }}>{s.label}</div><div style={{ fontSize:12, fontWeight:600 }}>{s.value}</div></div>))}
        </div>
        {listing.description&&<div style={{ fontSize:12, color:"#555", lineHeight:1.6, marginTop:8 }}>{listing.description}</div>}
      </div>
      <div style={{ background:"#fff", border:"1px solid #eee", borderRadius:12, padding:"1rem" }}>
        <div style={{ fontFamily:"Syne", fontSize:13, fontWeight:700, marginBottom:8, display:"flex", alignItems:"center", gap:6 }}><ShieldIcon size={14} color="#e6821e"/> Showroom</div>
        <div style={{ fontSize:13, fontWeight:600, marginBottom:4 }}>{listing.showroom_name}</div>
        <div style={{ fontSize:12, color:"#888", marginBottom:8, display:"flex", alignItems:"center", gap:4 }}><LocationIcon size={12} color="#888"/> {listing.showroom_location}</div>
        <div style={{ display:"flex", gap:8 }}>
          {listing.showroom_phone&&<a href={"tel:"+listing.showroom_phone} style={{ flex:1, background:"#378add", border:"none", borderRadius:8, color:"#fff", fontSize:12, fontWeight:700, padding:"10px", textAlign:"center", textDecoration:"none" }}>📞 Call</a>}
          {listing.showroom_phone&&<a href={"https://wa.me/254"+listing.showroom_phone.replace(/^0/,"")} target="_blank" rel="noreferrer" style={{ flex:1, background:"#25D366", border:"none", borderRadius:8, color:"#fff", fontSize:12, fontWeight:700, padding:"10px", textAlign:"center", textDecoration:"none" }}>💚 WhatsApp</a>}
        </div>
      </div>
    </div>
  )

  if(showChat) return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", zIndex:200, display:"flex", flexDirection:"column", justifyContent:"flex-end" }} onClick={()=>setShowChat(false)}>
      <div style={{ width:"100%", background:"#fff", borderRadius:"20px 20px 0 0", height:"85vh", display:"flex", flexDirection:"column", overflow:"hidden" }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0.75rem 1rem", borderBottom:"1px solid #f0f0f0" }}>
          <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:800 }}>{sellerInfo?.business_name||sellerInfo?.first_name||"Seller"}</div>
          <button onClick={()=>setShowChat(false)} style={{ background:"#f5f5f5", border:"none", borderRadius:"50%", width:34, height:34, cursor:"pointer", fontSize:18 }}>x</button>
        </div>
        <ChatWindow
          listingId={listing._source==="inventory" ? undefined : listing.id}
          inventoryId={listing._source==="inventory" ? listing.id : undefined}
          otherUserId={listing.seller_id||listing.provider_id}
          otherUserName={sellerInfo?.business_name||(sellerInfo?.first_name||"")}
          onClose={()=>setShowChat(false)}
        />
      </div>
    </div>
  )
  if(showChat) return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", zIndex:200, display:"flex", flexDirection:"column", justifyContent:"flex-end" }} onClick={()=>setShowChat(false)}>
      <div style={{ width:"100%", background:"#fff", borderRadius:"20px 20px 0 0", height:"85vh", display:"flex", flexDirection:"column", overflow:"hidden" }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0.75rem 1rem", borderBottom:"1px solid #f0f0f0" }}>
          <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:800 }}>{sellerInfo?.business_name||sellerInfo?.first_name||"Seller"}</div>
          <button onClick={()=>setShowChat(false)} style={{ background:"#f5f5f5", border:"none", borderRadius:"50%", width:34, height:34, cursor:"pointer", fontSize:18 }}>x</button>
        </div>
        <ChatWindow
          listingId={listing._source==="inventory" ? undefined : listing.id}
          inventoryId={listing._source==="inventory" ? listing.id : undefined}
          otherUserId={listing.seller_id||listing.provider_id}
          otherUserName={sellerInfo?.business_name||(sellerInfo?.first_name||"")}
          onClose={()=>setShowChat(false)}
        />
      </div>
    </div>
  )
  if(_listingType === "part" || _listingType === "accessory") return (
    <div>
      <button onClick={onBack} style={{ background:"none", border:"none", color:"#e6821e", cursor:"pointer", fontSize:13, marginBottom:"1rem", padding:0, fontFamily:"DM Sans,sans-serif" }}>← Back to listings</button>
      {(photos?.length>0||listing.primary_photo)&&(<div style={{ marginBottom:"1rem" }}><img src={photos?.[activePhoto||0]?.photo_url||listing.primary_photo} alt={listing.title} style={{ width:"100%", height:isMobile?220:320, objectFit:"cover", borderRadius:12 }}/></div>)}
      {listing.video_url&&(<div style={{ marginBottom:"1rem" }}><div style={{ fontFamily:"Syne", fontSize:12, fontWeight:700, marginBottom:6 }}>🎥 Video</div><video src={listing.video_url} controls style={{ width:"100%", borderRadius:12, maxHeight:260, background:"#000" }}/></div>)}
      <div style={{ background:"#fff", border:"1px solid #eee", borderRadius:12, padding:"1rem", marginBottom:"1rem" }}>
        <div style={{ fontFamily:"Syne", fontSize:isMobile?18:22, fontWeight:800, marginBottom:4 }}>{listing.title}</div>
        <div style={{ fontFamily:"Syne", fontSize:20, fontWeight:800, color:"#e6821e", marginBottom:4 }}>KES {Number(listing.price).toLocaleString()}</div>
        {listing.negotiable&&<div style={{ fontSize:11, color:"#1d9e75", marginBottom:12 }}>✓ Price negotiable</div>}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:12 }}>
          {[{label:"Category",value:listing.part_category||"—"},{label:"Condition",value:listing.condition||"—"},{label:"Qty",value:listing.quantity||"—"},{label:"Compatible with",value:listing.compatible_makes||listing.make||"—"}].map(s=>(<div key={s.label} style={{ background:"#f8f8f8", borderRadius:8, padding:"0.5rem 0.75rem" }}><div style={{ fontSize:10, color:"#888", marginBottom:2 }}>{s.label}</div><div style={{ fontSize:12, fontWeight:600 }}>{s.value}</div></div>))}
        </div>
        {listing.description&&<div><div style={{ fontSize:12, fontWeight:700, marginBottom:4 }}>Description</div><div style={{ fontSize:12, color:"#555", lineHeight:1.6 }}>{listing.description}</div></div>}
      </div>
      <div style={{ background:"#fff", border:"1px solid #eee", borderRadius:12, padding:"1rem", marginBottom:"1rem" }}>
        <div style={{ fontFamily:"Syne", fontSize:13, fontWeight:700, marginBottom:8 }}>Seller</div>
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
          <div style={{ width:40, height:40, borderRadius:"50%", background:"#e6821e20", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"Syne", fontSize:16, fontWeight:800, color:"#e6821e" }}>{(sellerInfo?.first_name||"S")[0]}</div>
          <div>
            <div style={{ fontSize:13, fontWeight:600 }}>{sellerInfo?.business_name||((sellerInfo?.first_name||"")+" "+(sellerInfo?.last_name||"")).trim()}</div>
            <div style={{ fontSize:11, color:"#888" }}>📍 {listing.city}</div>
          </div>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <button onClick={()=>toggleLike(listing.id)} style={{ flex:1, background:"#f8f8f8", border:"1px solid #eee", borderRadius:8, fontSize:12, padding:"10px", cursor:"pointer" }}>
            <HeartIcon size={16} color="#e24b4a" active={userLikes?.has(listing.id)} /> {listing.likes_count||0}
          </button>
          {listing._source==="inventory" ? (
            <button onClick={()=>addToCart(listing)} style={{ flex:2, background:"#e6821e", border:"none", borderRadius:8, color:"#fff", fontSize:12, fontWeight:700, padding:"10px", cursor:"pointer" }}>
              🛒 Add to Cart
            </button>
          ) : (
            <button onClick={()=>setShowChat(true)} style={{ flex:2, background:"#e6821e", border:"none", borderRadius:8, color:"#fff", fontSize:12, fontWeight:700, padding:"10px", cursor:"pointer" }}>
              <ChatIcon size={14} color="currentColor" /> Message seller
            </button>
          )}
        </div>
      </div>
    </div>
  )

  const badge = sellerInfo?.role==="provider"
    ? { label:"🏪 Verified Seller", color:"#378add", bg:"#eff6ff" }
    : { label:"Private Seller", color:"#555555", bg:"#f5f5f5" }

  const existingOffer = offers?.find(o=>o.status==="pending"||o.status==="countered")

  if (showChat) return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", zIndex:200, display:"flex", flexDirection:"column", justifyContent:"flex-end" }} onClick={()=>setShowChat(false)}>
      <div style={{ width:"100%", background:"#fff", borderRadius:"20px 20px 0 0", height:"85vh", display:"flex", flexDirection:"column", overflow:"hidden", boxShadow:"0 -8px 32px rgba(0,0,0,0.15)" }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:"flex", justifyContent:"center", padding:"10px 0 0" }}>
          <div style={{ width:36, height:4, borderRadius:2, background:"#e0e0e0" }}/>
        </div>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0.75rem 1rem", borderBottom:"1px solid #f0f0f0", flexShrink:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ width:40, height:40, borderRadius:"50%", background:"linear-gradient(135deg,#e6821e,#f09840)", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"Syne", fontSize:15, fontWeight:800, color:"#fff", flexShrink:0 }}>
              {(sellerInfo?.business_name||sellerInfo?.first_name||"S")?.[0]?.toUpperCase()}
            </div>
            <div>
              <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:800, color:"#000" }}>{sellerInfo?.business_name||sellerInfo?.first_name||"Seller"}</div>
              <div style={{ fontSize:11, color:"#888" }}>Re: {listing.title?.substring(0,30)}{listing.title?.length>30?"...":""}</div>
            </div>
          </div>
          <button onClick={()=>setShowChat(false)} style={{ background:"#f5f5f5", border:"none", borderRadius:"50%", width:34, height:34, cursor:"pointer", fontSize:18, display:"flex", alignItems:"center", justifyContent:"center", color:"#555" }}>×</button>
        </div>
        <div style={{ flex:1, minHeight:0, display:"flex", flexDirection:"column" }}>
          <ChatWindow
            listingId={listing.id}
            otherUserId={listing.seller_id}
            otherUserName={sellerInfo?.business_name||sellerInfo?.first_name||"Seller"}
            onClose={()=>setShowChat(false)}
          />

            {/* Comments Section */}
            <div style={{ marginTop:16, background:"#ffffff", border:"1px solid #eeeeee", borderRadius:12, padding:"1rem" }}>
              <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:800, color:"#000", marginBottom:12, display:"flex", alignItems:"center", gap:6 }}><ChatIcon size={16} color="#000"/> Comments ({listing.comments_count||0})</div>
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
              {listing.video_url&&(
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
              : <div style={{ display:"flex", justifyContent:"center" }}>{listing.listing_type==="vehicle"?<VehicleIcon size={64} color="#e6821e"/>:listing.listing_type==="part"?"🔧":"✨"}</div>
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
            {listing.is_featured&&<span style={{ fontSize:10, background:listing.featured_tier==="premium"?"#8b5cf6":"#e6821e", color:"#fff", padding:"2px 8px", borderRadius:10, marginRight:4 }}>{listing.featured_tier==="premium"?"👑 Premium":"⭐ Featured"}</span>}
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
                <div style={{ fontSize:13, color:"#000000", fontWeight:600 }}>{sellerInfo?.business_name||`${sellerInfo?.first_name} ${sellerInfo?.last_name||""}`}</div>
                <span style={{ fontSize:10, padding:"2px 7px", borderRadius:6, background:badge.bg, color:badge.color }}>{badge.label}</span>
              </div>
            </div>
            {listing.city&&<div style={{ fontSize:11, color:"#777777", marginTop:8, display:"flex", alignItems:"center", gap:4 }}><LocationIcon size={11} color="#777777"/> {listing.city}</div>}
          </div>

          {listing.seller_id!==user?.id&&(
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {listing._source==="inventory" ? (
                <button onClick={()=>addToCart(listing)}
                  style={{ width:"100%", background:"#e6821e", border:"none", borderRadius:10, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:14, fontWeight:700, padding:"13px", cursor:"pointer" }}>
                  🛒 Add to Cart
                </button>
              ) : (
                <button onClick={()=>setShowChat(true)}
                  style={{ width:"100%", background:"#000", border:"none", borderRadius:10, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:14, fontWeight:700, padding:"13px", cursor:"pointer" }}>
                  <ChatIcon size={14} color="currentColor"/> Message seller
                </button>
              )}

              {/* Social actions */}
              <div style={{ display:"flex", gap:8, marginTop:4 }}>
                <button onClick={()=>toggleLike(listing.id)}
                  style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:6, background:userLikes?.has(listing.id)?"#fff0f3":"#f8f8f8", border:`1px solid ${userLikes?.has(listing.id)?"#e24b4a40":"#eeeeee"}`, borderRadius:10, padding:"10px", cursor:"pointer", transition:"all 0.15s" }}>
                  <HeartIcon size={18} color="#e24b4a" active={userLikes?.has(listing.id)} />
                  <span style={{ fontSize:12, fontWeight:700, color:userLikes?.has(listing.id)?"#e24b4a":"#666" }}>{listing.likes_count||0}</span>
                </button>
                <button onClick={()=>document.getElementById("comment-input").focus()}
                  style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:6, background:"#f8f8f8", border:"1px solid #eeeeee", borderRadius:10, padding:"10px", cursor:"pointer" }}>
                  <ChatIcon size={18} color="#8b5cf6" />
                  <span style={{ fontSize:12, fontWeight:700, color:"#666" }}>{listing.comments_count||0}</span>
                </button>
                <button onClick={()=>shareViaWhatsApp(listing)}
                  style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:6, background:"#f0fdf4", border:"1px solid #1d9e7540", borderRadius:10, padding:"10px", cursor:"pointer" }}>
                  <ShareIcon size={18} color="#64748B" />
                  <span style={{ fontSize:12, fontWeight:700, color:"#1d9e75" }}>{listing.shares_count||0}</span>
                </button>
              </div>

              {/* Status banner */}
              {!listing.is_inspected&&listing.listing_type==="vehicle"&&(
                <div style={{ background:"#fff8f0", border:"1px solid #e6821e40", borderRadius:10, padding:"0.9rem" }}>
                  <div style={{ fontSize:12, color:"#e6821e", fontWeight:600, marginBottom:4 }}>⏳ Pending CCC Inspection</div>
                  <div style={{ fontSize:11, color:"#555555", lineHeight:1.6 }}>
                    This listing is awaiting CCC inspection. This ensures all listings on our platform are verified.
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
                    <span style={{display:"flex",alignItems:"center",gap:6}}><MarketplaceIcon size={14} color="currentColor"/> Make an offer</span>
                  </button>
                )
              )}

              {/* Message button - only if inspected */}
              {listing.is_inspected&&(
                <button onClick={()=>setShowChat(s=>!s)}
                style={{ background:"#eff6ff", border:"1px solid #378add40", borderRadius:10, color:"#378add", fontFamily:"Syne,sans-serif", fontSize:13, fontWeight:600, padding:"12px", cursor:"pointer" }}>
                  <><ChatIcon size={14} color="currentColor"/> {showChat?"Close chat":"Open chat"}</>
                </button>
              )}
            {showChat&&(
              <div style={{ marginTop:8, height:400 }}>
                <ChatWindow
                  listingId={listing._source==="inventory" ? undefined : listing.id}
                  inventoryId={listing._source==="inventory" ? listing.id : undefined}
                  otherUserId={listing.seller_id||listing.provider_id}
                  onClose={()=>setShowChat(false)}
                />
              </div>
            )}
            </div>
          )}

          {listing.seller_id===user?.id&&(
            <div style={{ background:"#ffffff", border:"1px solid #eeeeee", borderRadius:10, padding:"0.9rem", textAlign:"center" }}>
              <div style={{ fontSize:12, color:"#777777", display:"flex", alignItems:"center", gap:4 }}>This is your listing · <EyeIcon size={12} color="#777777"/> {listing.views||0} views</div>
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









