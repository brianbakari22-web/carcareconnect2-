import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"
import { useAuth } from "../../contexts/AuthContext"
import { useNavigate } from "react-router-dom"
import ChatWindow from "../shared/ChatWindow"
import useIsMobile from "../../lib/useIsMobile"
import toast from "react-hot-toast"

const FUEL_TYPES = ["Petrol","Diesel","Electric","Hybrid"]
const TRANSMISSIONS = ["Manual","Automatic"]
const CONDITIONS = ["New","Used","Refurbished","For parts"]

export default function Marketplace() {
  const { user } = useAuth()
  const navigate = useNavigate()
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

  useEffect(() => { load() }, [tab])

  async function load() {
    setLoading(true)
    let query = supabase.from("marketplace_listings")
      .select("*, profiles(first_name,last_name,role,business_name), marketplace_photos(photo_url,is_primary)")
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

  async function openListing(listing) {
    setSelected(listing)
    setActivePhoto(0)
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
    if (!seller) return { label:"Seller", color:"#555", bg:"#1a1a1a" }
    if (seller.role==="provider") return { label:"🏪 Verified Seller", color:"#378add", bg:"#0c1f2e" }
    return { label:"👤 Private Seller", color:"#888", bg:"#1a1a1a" }
  }

  const inp = { width:"100%", background:"#111", border:"1px solid #222", borderRadius:8, padding:"9px 12px", color:"#f0ede6", fontSize:12, outline:"none", fontFamily:"'DM Sans',sans-serif" }

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
    />
  )

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"1.25rem", flexWrap:"wrap", gap:10 }}>
        <div>
          <div style={{ fontFamily:"Syne", fontSize:isMobile?18:22, fontWeight:800, color:"#f0ede6" }}>🛒 Marketplace</div>
          <div style={{ fontSize:12, color:"#555", marginTop:2 }}>Buy and sell vehicles, parts & accessories</div>
        </div>
        <button onClick={()=>navigate("/dashboard/marketplace/new")}
          style={{ background:"#e6821e", border:"none", borderRadius:9, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:13, fontWeight:700, padding:"10px 20px", cursor:"pointer" }}>
          + List item
        </button>
      </div>

      <div style={{ display:"flex", gap:6, marginBottom:"1rem", flexWrap:"wrap" }}>
        {[{k:"all",l:"All",icon:"🛒"},{k:"vehicle",l:"Vehicles",icon:"🚗"},{k:"part",l:"Parts",icon:"🔧"},{k:"accessory",l:"Accessories",icon:"✨"}].map(t=>(
          <button key={t.k} onClick={()=>setTab(t.k)}
            style={{ padding:"8px 14px", borderRadius:8, border:"none", fontSize:12, cursor:"pointer", background:tab===t.k?"#e6821e":"#111", color:tab===t.k?"#fff":"#666", fontFamily:"'DM Sans',sans-serif", fontWeight:tab===t.k?700:400 }}>
            {t.icon} {t.l}
          </button>
        ))}
      </div>

      <div style={{ display:"flex", gap:8, marginBottom:"1rem" }}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search vehicles, parts, makes..."
          style={{ ...inp, flex:1 }}/>
        <button onClick={()=>setShowFilters(f=>!f)}
          style={{ background:showFilters?"#e6821e":"#111", border:`1px solid ${showFilters?"#e6821e":"#333"}`, borderRadius:8, color:showFilters?"#fff":"#666", fontSize:12, padding:"9px 14px", cursor:"pointer" }}>
          🔽 Filter
        </button>
      </div>

      {showFilters&&(
        <div style={{ background:"#111", border:"1px solid #1e1e1e", borderRadius:12, padding:"1rem", marginBottom:"1rem" }}>
          <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr 1fr":"repeat(4,1fr)", gap:10 }}>
            <div><div style={{ fontSize:10, color:"#555", marginBottom:4 }}>Min price</div><input style={inp} type="number" placeholder="0" value={filters.minPrice} onChange={e=>setFilters(f=>({...f,minPrice:e.target.value}))}/></div>
            <div><div style={{ fontSize:10, color:"#555", marginBottom:4 }}>Max price</div><input style={inp} type="number" placeholder="Any" value={filters.maxPrice} onChange={e=>setFilters(f=>({...f,maxPrice:e.target.value}))}/></div>
            <div><div style={{ fontSize:10, color:"#555", marginBottom:4 }}>Condition</div>
              <select style={inp} value={filters.condition} onChange={e=>setFilters(f=>({...f,condition:e.target.value}))}>
                <option value="">Any</option>
                {CONDITIONS.map(c=><option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div><div style={{ fontSize:10, color:"#555", marginBottom:4 }}>City</div><input style={inp} placeholder="e.g. Nairobi" value={filters.city} onChange={e=>setFilters(f=>({...f,city:e.target.value}))}/></div>
            {tab==="vehicle"&&<>
              <div><div style={{ fontSize:10, color:"#555", marginBottom:4 }}>Make</div><input style={inp} placeholder="e.g. Toyota" value={filters.make} onChange={e=>setFilters(f=>({...f,make:e.target.value}))}/></div>
              <div><div style={{ fontSize:10, color:"#555", marginBottom:4 }}>Fuel</div>
                <select style={inp} value={filters.fuelType} onChange={e=>setFilters(f=>({...f,fuelType:e.target.value}))}>
                  <option value="">Any</option>{FUEL_TYPES.map(f=><option key={f} value={f}>{f}</option>)}
                </select>
              </div>
              <div><div style={{ fontSize:10, color:"#555", marginBottom:4 }}>Transmission</div>
                <select style={inp} value={filters.transmission} onChange={e=>setFilters(f=>({...f,transmission:e.target.value}))}>
                  <option value="">Any</option>{TRANSMISSIONS.map(t=><option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </>}
          </div>
          <button onClick={()=>setFilters({ minPrice:"", maxPrice:"", condition:"", city:"", make:"", fuelType:"", transmission:"" })}
            style={{ background:"none", border:"none", color:"#555", fontSize:11, cursor:"pointer", marginTop:8 }}>Clear filters</button>
        </div>
      )}

      <div style={{ fontSize:12, color:"#555", marginBottom:"1rem" }}>{filtered.length} listing{filtered.length!==1?"s":""}</div>

      {loading&&<div style={{ color:"#555", fontSize:13, textAlign:"center", padding:"2rem" }}>Loading...</div>}
      {!loading&&filtered.length===0&&(
        <div style={{ color:"#444", fontSize:13, textAlign:"center", padding:"3rem" }}>
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
              style={{ background:"#111", border:`1px solid ${l.is_featured?"#e6821e40":"#1e1e1e"}`, borderRadius:12, overflow:"hidden", cursor:"pointer" }}>
              <div style={{ height:isMobile?120:160, background:"#1a1a1a", position:"relative", display:"flex", alignItems:"center", justifyContent:"center" }}>
                {l.is_featured&&<div style={{ position:"absolute", top:8, left:8, background:"#e6821e", color:"#fff", fontSize:9, fontWeight:700, padding:"2px 7px", borderRadius:10 }}>⭐ FEATURED</div>}
                {l.is_inspected&&<div style={{ position:"absolute", top:8, right:8, background:"#1d9e75", color:"#fff", fontSize:9, fontWeight:700, padding:"2px 7px", borderRadius:10 }}>✓ INSPECTED</div>}
                {l.primary_photo ? (
                  <img src={l.primary_photo} alt={l.title} style={{ width:"100%", height:"100%", objectFit:"cover" }}/>
                ) : (
                  <div style={{ fontSize:40 }}>{l.listing_type==="vehicle"?"🚗":l.listing_type==="part"?"🔧":"✨"}</div>
                )}
              </div>
              <div style={{ padding:"0.75rem" }}>
                <div style={{ fontFamily:"Syne", fontSize:isMobile?12:13, fontWeight:700, color:"#f0ede6", marginBottom:4, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{l.title}</div>
                {l.listing_type==="vehicle"&&<div style={{ fontSize:10, color:"#555", marginBottom:4 }}>{[l.make,l.model,l.year].filter(Boolean).join(" ")}{l.mileage?` · ${Number(l.mileage).toLocaleString()}km`:""}</div>}
                {l.listing_type==="part"&&<div style={{ fontSize:10, color:"#555", marginBottom:4 }}>{l.part_category}</div>}
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
                  <div style={{ fontFamily:"Syne", fontSize:isMobile?13:15, fontWeight:800, color:"#e6821e" }}>KES {Number(l.price).toLocaleString()}</div>
                  {l.negotiable&&<span style={{ fontSize:9, color:"#1d9e75" }}>Negotiable</span>}
                </div>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
                  <span style={{ fontSize:9, padding:"2px 6px", borderRadius:6, background:badge.bg, color:badge.color }}>{badge.label}</span>
                  {l.city&&<span style={{ fontSize:9, color:"#444" }}>📍 {l.city}</span>}
                </div>
                <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
                  {l.condition&&<span style={{ fontSize:9, padding:"1px 6px", borderRadius:6, background:"#1a1a1a", color:"#666" }}>{l.condition}</span>}
                  {l.transmission&&<span style={{ fontSize:9, padding:"1px 6px", borderRadius:6, background:"#1a1a1a", color:"#666" }}>{l.transmission}</span>}
                  {l.fuel_type&&<span style={{ fontSize:9, padding:"1px 6px", borderRadius:6, background:"#1a1a1a", color:"#666" }}>{l.fuel_type}</span>}
                </div>
                <div style={{ fontSize:9, color:"#333", marginTop:6 }}>👁 {l.views||0} views</div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ListingDetail({ listing, photos, activePhoto, setActivePhoto, sellerInfo, offers, user, isMobile, onBack, onOffer }) {
  const [showOffer, setShowOffer] = useState(false)
  const [showChat, setShowChat] = useState(false)
  const [offerPrice, setOfferPrice] = useState("")
  const [offerMessage, setOfferMessage] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const navigate = useNavigate()

  const badge = sellerInfo?.role==="provider"
    ? { label:"🏪 Verified Seller", color:"#378add", bg:"#0c1f2e" }
    : { label:"👤 Private Seller", color:"#888", bg:"#1a1a1a" }

  const existingOffer = offers?.find(o=>o.status==="pending"||o.status==="countered")

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
          <div style={{ background:"#1a1a1a", borderRadius:12, height:isMobile?220:300, display:"flex", alignItems:"center", justifyContent:"center", marginBottom:8, overflow:"hidden" }}>
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
        </div>

        <div>
          <div style={{ marginBottom:8 }}>
            {listing.is_featured&&<span style={{ fontSize:10, background:"#e6821e", color:"#fff", padding:"2px 8px", borderRadius:10, marginRight:4 }}>⭐ Featured</span>}
            {listing.is_inspected&&<span style={{ fontSize:10, background:"#1d9e75", color:"#fff", padding:"2px 8px", borderRadius:10 }}>✓ CCC Inspected</span>}
          </div>
          <div style={{ fontFamily:"Syne", fontSize:isMobile?18:22, fontWeight:800, color:"#f0ede6", marginBottom:8 }}>{listing.title}</div>
          <div style={{ fontFamily:"Syne", fontSize:isMobile?22:28, fontWeight:800, color:"#e6821e", marginBottom:4 }}>KES {Number(listing.price).toLocaleString()}</div>
          {listing.negotiable&&<div style={{ fontSize:12, color:"#1d9e75", marginBottom:12 }}>✓ Price negotiable</div>}

          {listing.listing_type==="vehicle"&&(
            <div style={{ background:"#111", borderRadius:10, padding:"0.9rem", marginBottom:12 }}>
              <div style={{ fontSize:11, color:"#555", marginBottom:8, textTransform:"uppercase" }}>Vehicle details</div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                {[{l:"Make",v:listing.make},{l:"Model",v:listing.model},{l:"Year",v:listing.year},{l:"Mileage",v:listing.mileage?`${Number(listing.mileage).toLocaleString()}km`:null},{l:"Color",v:listing.color},{l:"Transmission",v:listing.transmission},{l:"Fuel",v:listing.fuel_type},{l:"Engine",v:listing.engine_size},{l:"Body",v:listing.body_type},{l:"Drive",v:listing.drive_type},{l:"Condition",v:listing.condition}].filter(f=>f.v).map(f=>(
                  <div key={f.l}>
                    <div style={{ fontSize:10, color:"#444" }}>{f.l}</div>
                    <div style={{ fontSize:12, color:"#f0ede6", fontWeight:500, textTransform:"capitalize" }}>{f.v}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {listing.listing_type==="part"&&(
            <div style={{ background:"#111", borderRadius:10, padding:"0.9rem", marginBottom:12 }}>
              <div style={{ fontSize:11, color:"#555", marginBottom:8, textTransform:"uppercase" }}>Part details</div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                {[{l:"Category",v:listing.part_category},{l:"Condition",v:listing.condition},{l:"Part No.",v:listing.part_number},{l:"Qty",v:listing.quantity}].filter(f=>f.v).map(f=>(
                  <div key={f.l}><div style={{ fontSize:10, color:"#444" }}>{f.l}</div><div style={{ fontSize:12, color:"#f0ede6" }}>{f.v}</div></div>
                ))}
              </div>
              {listing.compatible_makes?.length>0&&(
                <div style={{ marginTop:8 }}>
                  <div style={{ fontSize:10, color:"#444", marginBottom:4 }}>Compatible with</div>
                  <div style={{ display:"flex", flexWrap:"wrap", gap:4 }}>
                    {listing.compatible_makes.map(m=><span key={m} style={{ fontSize:10, padding:"2px 7px", borderRadius:6, background:"#1a1a1a", color:"#888" }}>{m}</span>)}
                  </div>
                </div>
              )}
            </div>
          )}

          {listing.description&&(
            <div style={{ background:"#111", borderRadius:10, padding:"0.9rem", marginBottom:12 }}>
              <div style={{ fontSize:11, color:"#555", marginBottom:6, textTransform:"uppercase" }}>Description</div>
              <div style={{ fontSize:13, color:"#888", lineHeight:1.7 }}>{listing.description}</div>
            </div>
          )}

          <div style={{ background:"#111", borderRadius:10, padding:"0.9rem", marginBottom:12 }}>
            <div style={{ fontSize:11, color:"#555", marginBottom:8, textTransform:"uppercase" }}>Seller</div>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <div style={{ width:40, height:40, borderRadius:"50%", background:badge.bg, border:`1px solid ${badge.color}40`, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"Syne", fontSize:14, fontWeight:800, color:badge.color, flexShrink:0 }}>
                {sellerInfo?.first_name?.[0]}{sellerInfo?.last_name?.[0]}
              </div>
              <div>
                <div style={{ fontSize:13, color:"#f0ede6", fontWeight:600 }}>{sellerInfo?.business_name||`${sellerInfo?.first_name} ${sellerInfo?.last_name}`}</div>
                <span style={{ fontSize:10, padding:"2px 7px", borderRadius:6, background:badge.bg, color:badge.color }}>{badge.label}</span>
              </div>
            </div>
            {listing.city&&<div style={{ fontSize:11, color:"#555", marginTop:8 }}>📍 {listing.city}</div>}
          </div>

          {listing.seller_id!==user?.id&&(
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>

              {/* Status banner */}
              {!listing.is_inspected&&(
                <div style={{ background:"#1a1208", border:"1px solid #e6821e40", borderRadius:10, padding:"0.9rem" }}>
                  <div style={{ fontSize:12, color:"#e6821e", fontWeight:600, marginBottom:4 }}>⏳ Pending CCC Inspection</div>
                  <div style={{ fontSize:11, color:"#888", lineHeight:1.6 }}>
                    This listing is awaiting Car Care Connect vehicle inspection before offers and messages are enabled. This ensures all vehicles on our platform are verified and trustworthy.
                  </div>
                </div>
              )}

              {listing.is_inspected&&(
                <div style={{ background:"#071a12", border:"1px solid #1d9e7540", borderRadius:10, padding:"0.75rem", display:"flex", alignItems:"center", gap:8 }}>
                  <span style={{ fontSize:14 }}>✓</span>
                  <div>
                    <div style={{ fontSize:12, color:"#1d9e75", fontWeight:600 }}>CCC Verified Vehicle</div>
                    <div style={{ fontSize:10, color:"#555" }}>Inspected and approved by Car Care Connect</div>
                  </div>
                </div>
              )}

              {/* Offer button - only if inspected */}
              {listing.is_inspected&&(
                existingOffer?(
                  <div style={{ background:"#071a12", border:"1px solid #1d9e7540", borderRadius:10, padding:"0.9rem" }}>
                    <div style={{ fontSize:12, color:"#1d9e75", fontWeight:600 }}>✓ Offer submitted</div>
                    <div style={{ fontSize:11, color:"#555", marginTop:2 }}>KES {Number(existingOffer.offered_price).toLocaleString()} · {existingOffer.status}</div>
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
                style={{ background:"#0c1f2e", border:"1px solid #378add40", borderRadius:10, color:"#378add", fontFamily:"Syne,sans-serif", fontSize:13, fontWeight:600, padding:"12px", cursor:"pointer" }}>
                  💬 {showChat?"Close chat":"Message seller"}
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
            <div style={{ background:"#111", border:"1px solid #1e1e1e", borderRadius:10, padding:"0.9rem", textAlign:"center" }}>
              <div style={{ fontSize:12, color:"#555" }}>This is your listing · 👁 {listing.views||0} views</div>
            </div>
          )}
        </div>
      </div>

      {showOffer&&(
        <div style={{ position:"fixed", inset:0, zIndex:200, display:"flex", alignItems:isMobile?"flex-end":"center", justifyContent:"center" }}
          onClick={e=>{ if(e.target===e.currentTarget) setShowOffer(false) }}>
          <div style={{ position:"absolute", inset:0, background:"rgba(0,0,0,0.75)" }} onClick={()=>setShowOffer(false)}/>
          <div style={{ position:"relative", zIndex:1, background:"#0f0f0f", border:"1px solid #2a2a2a", borderRadius:isMobile?"20px 20px 0 0":"16px", padding:"1.5rem", width:isMobile?"100%":"420px" }}>
            {isMobile&&<div style={{ width:40, height:4, background:"#333", borderRadius:2, margin:"0 auto 1.5rem" }}/>}
            <div style={{ fontFamily:"Syne", fontSize:16, fontWeight:800, color:"#f0ede6", marginBottom:4 }}>Make an offer</div>
            <div style={{ fontSize:12, color:"#555", marginBottom:"1.25rem" }}>Asking: KES {Number(listing.price).toLocaleString()}</div>
            <form onSubmit={submitOffer}>
              <label style={{ fontSize:11, color:"#666", display:"block", marginBottom:4 }}>Your offer (KES) *</label>
              <input type="number" value={offerPrice} onChange={e=>setOfferPrice(e.target.value)} required
                style={{ width:"100%", background:"#111", border:"1px solid #222", borderRadius:8, padding:"11px 12px", color:"#f0ede6", fontSize:13, outline:"none", fontFamily:"'DM Sans',sans-serif", marginBottom:12 }}/>
              <label style={{ fontSize:11, color:"#666", display:"block", marginBottom:4 }}>Message (optional)</label>
              <textarea value={offerMessage} onChange={e=>setOfferMessage(e.target.value)}
                placeholder="Introduce yourself..."
                style={{ width:"100%", background:"#111", border:"1px solid #222", borderRadius:8, padding:"11px 12px", color:"#f0ede6", fontSize:13, outline:"none", fontFamily:"'DM Sans',sans-serif", resize:"vertical", minHeight:70, marginBottom:12 }}/>
              <div style={{ background:"#1a1208", border:"1px solid #e6821e30", borderRadius:8, padding:"0.75rem", marginBottom:16 }}>
                <div style={{ fontSize:11, color:"#e6821e" }}>⚠️ Do not share personal contact details. All communication must stay on Car Care Connect.</div>
              </div>
              <div style={{ display:"flex", gap:8 }}>
                <button type="submit" disabled={submitting}
                  style={{ flex:1, background:submitting?"#333":"#e6821e", border:"none", borderRadius:9, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:13, fontWeight:700, padding:"12px", cursor:submitting?"not-allowed":"pointer" }}>
                  {submitting?"Submitting...":"Submit offer"}
                </button>
                <button type="button" onClick={()=>setShowOffer(false)}
                  style={{ background:"none", border:"1px solid #333", borderRadius:9, color:"#666", fontSize:13, padding:"12px 18px", cursor:"pointer" }}>
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



