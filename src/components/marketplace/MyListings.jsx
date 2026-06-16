import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"
import { useAuth } from "../../contexts/AuthContext"
import { useNavigate } from "react-router-dom"
import useIsMobile from "../../lib/useIsMobile"
import toast from "react-hot-toast"
import InspectionRequest from "./InspectionRequest"
import PhotoUpload from "./PhotoUpload"
import FeaturedListing from "./FeaturedListing"

export default function MyListings() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const [listings, setListings] = useState([])
  const [offers, setOffers] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState("listings")
  const [expanded, setExpanded] = useState(null)
  const [photoListing, setPhotoListing] = useState(null)
  const [featureListing, setFeatureListing] = useState(null)
  const [inspectListing, setInspectListing] = useState(null)
  const [listingPhotos, setListingPhotos] = useState([])
  const [counterPrice, setCounterPrice] = useState("")
  const [processing, setProcessing] = useState(null)
  const [showInspection, setShowInspection] = useState(null)

  useEffect(() => {
    if (!user) return
    load()
    const sub = supabase.channel("my-listings-live")
      .on("postgres_changes", { event:"*", schema:"public", table:"marketplace_listings", filter:`seller_id=eq.${user.id}` }, () => load())
      .on("postgres_changes", { event:"*", schema:"public", table:"marketplace_offers", filter:`seller_id=eq.${user.id}` }, () => loadOffers())
      .subscribe()
    return () => supabase.removeChannel(sub)
  }, [user])

  async function load() {
    await Promise.all([loadListings(), loadOffers()])
    setLoading(false)
  }

  async function loadListings() {
    const { data } = await supabase.from("marketplace_listings")
      .select("*, marketplace_photos(photo_url,is_primary,display_order)")
      .eq("seller_id", user.id).order("created_at", { ascending:false })
    setListings((data||[]).map(l=>({...l, primary_photo:l.marketplace_photos?.find(p=>p.is_primary)?.photo_url||l.marketplace_photos?.[0]?.photo_url})))
  }

  async function loadOffers() {
    const { data } = await supabase.from("marketplace_offers")
      .select("*, marketplace_listings(title,price), buyer:profiles!marketplace_offers_buyer_id_fkey(first_name,last_name,city)")
      .eq("seller_id", user.id).order("created_at", { ascending:false })
    setOffers(data||[])
  }

  async function acceptOffer(offer) {
    setProcessing(offer.id)
    try {
      await supabase.from("marketplace_offers").update({ status:"accepted" }).eq("id",offer.id)
      await supabase.from("marketplace_offers").update({ status:"rejected" }).eq("listing_id",offer.listing_id).neq("id",offer.id)
      await supabase.from("marketplace_listings").update({ status:"sold" }).eq("id",offer.listing_id)
      const commission = Number(offer.offered_price) * 0.08
      await supabase.from("marketplace_transactions").insert({
        listing_id:offer.listing_id, offer_id:offer.id, buyer_id:offer.buyer_id, seller_id:user.id,
        sale_price:offer.offered_price, platform_commission:commission, seller_earnings:Number(offer.offered_price)-commission, payment_status:"pending"
      })
      await supabase.from("notifications").insert({
        user_id:offer.buyer_id, title:"Offer accepted! 🎉",
        message:"Your offer of KES "+Number(offer.offered_price).toLocaleString()+" has been accepted. Please proceed with payment.",
        type:"success"
      })
      toast.success("Offer accepted!")
      load()
    } catch(err) { toast.error(err.message) }
    finally { setProcessing(null) }
  }

  async function rejectOffer(offerId, buyerId, title) {
    setProcessing(offerId)
    try {
      await supabase.from("marketplace_offers").update({ status:"rejected" }).eq("id",offerId)
      await supabase.from("notifications").insert({ user_id:buyerId, title:"Offer update", message:"Your offer for "+title+" was not accepted.", type:"info" })
      toast.success("Offer rejected")
      load()
    } catch(err) { toast.error(err.message) }
    finally { setProcessing(null) }
  }

  async function counterOffer(offer) {
    if (!counterPrice) return toast.error("Enter counter price")
    setProcessing(offer.id)
    try {
      await supabase.from("marketplace_offers").update({ status:"countered", counter_price:parseFloat(counterPrice) }).eq("id",offer.id)
      await supabase.from("notifications").insert({
        user_id:offer.buyer_id, title:"Counter offer received",
        message:"Seller countered with KES "+Number(counterPrice).toLocaleString(),
        type:"info"
      })
      toast.success("Counter sent")
      setCounterPrice(""); setExpanded(null); load()
    } catch(err) { toast.error(err.message) }
    finally { setProcessing(null) }
  }

  async function openPhotos(listing) {
    const { data } = await supabase.from("marketplace_photos").select("*").eq("listing_id",listing.id).order("display_order")
    setListingPhotos(data||[])
    setPhotoListing(photoListing===listing.id?null:listing.id)
  }

  async function deleteListing(id) {
    if (!confirm("Delete this listing?")) return
    await supabase.from("marketplace_listings").delete().eq("id",id).eq("seller_id",user.id)
    toast.success("Listing deleted")
    loadListings()
  }

  const pendingOffers = offers.filter(o=>o.status==="pending")
  const SC = { pending:"#e6821e", active:"#1d9e75", sold:"#8b5cf6", rejected:"#e24b4a", suspended:"#555" }

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"1.25rem", flexWrap:"wrap", gap:10 }}>
        <div>
          <div style={{ fontFamily:"Syne", fontSize:isMobile?16:20, fontWeight:800, color:"#000000" }}>My Listings</div>
          <div style={{ fontSize:12, color:"#777777" }}>Manage your marketplace listings and offers</div>
        </div>
        <button onClick={()=>navigate("/dashboard/marketplace/new")}
          style={{ background:"#e6821e", border:"none", borderRadius:9, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:13, fontWeight:700, padding:"10px 18px", cursor:"pointer" }}>
          + New listing
        </button>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8, marginBottom:"1.25rem" }}>
        {[
          { label:"Total", value:listings.length, color:"#000000" },
          { label:"Active", value:listings.filter(l=>l.status==="active").length, color:"#1d9e75" },
          { label:"Pending", value:listings.filter(l=>l.status==="pending").length, color:"#e6821e" },
          { label:"Offers", value:pendingOffers.length, color:"#8b5cf6" },
        ].map(s=>(
          <div key={s.label} style={{ background:"#ffffff", borderRadius:10, padding:"0.6rem", border:"1px solid #eeeeee", textAlign:"center" }}>
            <div style={{ fontFamily:"Syne", fontSize:18, fontWeight:800, color:s.color }}>{s.value}</div>
            <div style={{ fontSize:10, color:"#777777" }}>{s.label}</div>
          </div>
        ))}
      </div>

      {pendingOffers.length>0&&(
        <div style={{ background:"#faf5ff", border:"1px solid #8b5cf640", borderRadius:10, padding:"0.75rem", marginBottom:"1rem" }}>
          <div style={{ fontSize:12, color:"#8b5cf6", fontWeight:600 }}>💰 {pendingOffers.length} offer{pendingOffers.length>1?"s":""} waiting</div>
        </div>
      )}

      <div style={{ display:"flex", gap:6, marginBottom:"1rem" }}>
        {[{k:"listings",l:"Listings ("+listings.length+")"},{k:"offers",l:"Offers ("+offers.length+")"}].map(t=>(
          <button key={t.k} onClick={()=>setTab(t.k)}
            style={{ padding:"7px 14px", borderRadius:8, border:"none", fontSize:12, cursor:"pointer", background:tab===t.k?"#e6821e":"#555555", color:tab===t.k?"#fff":"#666", fontFamily:"DM Sans,sans-serif", fontWeight:tab===t.k?700:400 }}>
            {t.l}
          </button>
        ))}
      </div>

      {loading&&<div style={{ color:"#777777", fontSize:13 }}>Loading...</div>}

      {tab==="listings"&&(
        <div>
          {!loading&&listings.length===0&&(
            <div style={{ color:"#888888", fontSize:13, textAlign:"center", padding:"3rem" }}>
              <div style={{ fontSize:32, marginBottom:10 }}>🛒</div>
              No listings yet
              <div style={{ marginTop:12 }}>
                <button onClick={()=>navigate("/dashboard/marketplace/new")}
                  style={{ background:"#e6821e", border:"none", borderRadius:8, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:12, fontWeight:700, padding:"9px 18px", cursor:"pointer" }}>
                  Create first listing
                </button>
              </div>
            </div>
          )}
          {listings.map(l=>(
            <div key={l.id} style={{ background:"#ffffff", border:"1px solid "+(SC[l.status]||"#eeeeee")+"30", borderRadius:12, marginBottom:10, overflow:"hidden" }}>
              <div style={{ display:"flex", gap:0 }}>
                <div style={{ width:90, minHeight:90, background:"#f5f5f5", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", overflow:"hidden" }}>
                  {l.primary_photo
                    ? <img src={l.primary_photo} alt="" style={{ width:"100%", height:"100%", objectFit:"cover", minHeight:90 }}/>
                    : <span style={{ fontSize:32 }}>{l.listing_type==="vehicle"?"🚗":l.listing_type==="part"?"🔧":"✨"}</span>
                  }
                </div>
                <div style={{ flex:1, padding:"0.75rem", minWidth:0 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:4, marginBottom:3 }}>
                    <div style={{ fontSize:13, fontWeight:600, color:"#000000", flex:1, minWidth:0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{l.title}</div>
                    <div style={{ fontFamily:"Syne", fontSize:12, fontWeight:800, color:"#e6821e", flexShrink:0 }}>KES {Number(l.price).toLocaleString()}</div>
                  </div>
                  <div style={{ display:"flex", gap:4, alignItems:"center", flexWrap:"wrap", marginBottom:3 }}>
                    <span style={{ fontSize:10, padding:"1px 6px", borderRadius:8, background:(SC[l.status]||"#888")+"20", color:SC[l.status]||"#888" }}>{l.status}</span>
                    {l.is_featured&&<span style={{ fontSize:10, color:"#e6821e" }}>⭐</span>}
                    {l.is_inspected&&<span style={{ fontSize:10, color:"#1d9e75" }}>✓</span>}
                    {l.video_url&&(
                      <span style={{ fontSize:10, padding:"1px 6px", borderRadius:8,
                        background:l.video_status==="approved"?"#f0fdf4":l.video_status==="rejected"?"#fff5f5":"#fff8f0",
                        color:l.video_status==="approved"?"#1d9e75":l.video_status==="rejected"?"#e24b4a":"#e6821e" }}>
                        🎥 {l.video_status==="approved"?"Video ✓":l.video_status==="rejected"?"Video ✗":"Video pending"}
                      </span>
                    )}
                  </div>
                  {l.listing_type==="vehicle"&&<div style={{ fontSize:10, color:"#777777", marginBottom:2 }}>{[l.make,l.model,l.year].filter(Boolean).join(" · ")}</div>}
                  <div style={{ fontSize:10, color:"#777777" }}>📍 {l.city||"—"} · 👁 {l.views||0} · {new Date(l.created_at).toLocaleDateString()}</div>
                </div>
              </div>

              {l.status==="pending"&&l.listing_type==="vehicle"&&l.inspection_status!=="passed"&&(
                <div style={{ borderTop:"1px solid #eeeeee", padding:"0.75rem", background:"#fff8f0" }}>
                  <div style={{ fontSize:11, color:"#e6821e", marginBottom:6 }}>⏳ CCC inspection required before approval</div>
                  <button onClick={()=>setShowInspection(showInspection===l.id?null:l.id)}
                    style={{ background:"#e6821e", border:"none", borderRadius:7, color:"#fff", fontSize:11, padding:"6px 14px", cursor:"pointer", fontWeight:600, width:"100%" }}>
                    {showInspection===l.id?"Close":"Schedule and Pay Inspection (KES 500)"}
                  </button>
                  {showInspection===l.id&&<div style={{ marginTop:8 }}><InspectionRequest listing={l} onSuccess={()=>{ setShowInspection(null); loadListings() }}/></div>}
                </div>
              )}
              {l.status==="pending"&&(l.listing_type!=="vehicle"||l.inspection_status==="passed")&&(
                <div style={{ borderTop:"1px solid #eeeeee", padding:"0.5rem 0.75rem" }}>
                  <div style={{ fontSize:11, color:"#e6821e" }}>⏳ Under review</div>
                </div>
              )}
              {l.status==="rejected"&&l.admin_notes&&(
                <div style={{ borderTop:"1px solid #eeeeee", padding:"0.5rem 0.75rem" }}>
                  <div style={{ fontSize:11, color:"#e24b4a" }}>❌ {l.admin_notes}</div>
                </div>
              )}

              {inspectListing===l.id&&<div style={{ borderTop:"1px solid #eeeeee", padding:"0.75rem" }}><InspectionRequest listing={l} onSuccess={()=>{ setInspectListing(null); loadListings() }}/></div>}
              {featureListing===l.id&&<div style={{ borderTop:"1px solid #eeeeee", padding:"0.75rem" }}><FeaturedListing listingId={l.id} onSuccess={()=>{ setFeatureListing(null); loadListings() }}/></div>}
              {photoListing===l.id&&(
                <div style={{ borderTop:"1px solid #eeeeee", padding:"0.75rem" }}>
                  <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:8 }}>
                    {listingPhotos.map(p=>(<img key={p.id} src={p.photo_url} alt="" style={{ width:64, height:64, objectFit:"cover", borderRadius:8, border:p.is_primary?"2px solid #e6821e":"1px solid #dddddd" }}/>))}
                    {listingPhotos.length===0&&<div style={{ fontSize:11, color:"#777777" }}>No photos yet</div>}
                  </div>
                  <PhotoUpload listingId={l.id} onSuccess={()=>openPhotos(l)} existingPhotos={listingPhotos}/>
                </div>
              )}

              <div style={{ borderTop:"1px solid #eeeeee", padding:"0.5rem 0.75rem", display:"flex", gap:6, flexWrap:"wrap" }}>
                <button onClick={()=>navigate("/dashboard/marketplace")} style={{ background:"#eff6ff", border:"1px solid #378add40", borderRadius:7, color:"#378add", fontSize:10, padding:"5px 10px", cursor:"pointer" }}>View</button>
                <button onClick={()=>openPhotos(l)} style={{ background:"#ffffff", border:"1px solid #dddddd", borderRadius:7, color:"#555555", fontSize:10, padding:"5px 10px", cursor:"pointer" }}>Photos {l.marketplace_photos?.length>0?"("+l.marketplace_photos.length+")":""}</button>
                {l.listing_type==="vehicle"&&<button onClick={()=>setFeatureListing(featureListing===l.id?null:l.id)} style={{ background:"#fff8f0", border:"1px solid #e6821e40", borderRadius:7, color:"#e6821e", fontSize:10, padding:"5px 10px", cursor:"pointer" }}>Feature</button>}
                <button onClick={()=>setInspectListing(inspectListing===l.id?null:l.id)} style={{ background:"#f0fdf4", border:"1px solid #1d9e7540", borderRadius:7, color:"#1d9e75", fontSize:10, padding:"5px 10px", cursor:"pointer" }}>Inspect</button>
                {l.status!=="sold"&&<button onClick={()=>deleteListing(l.id)} style={{ background:"none", border:"1px solid #e24b4a30", borderRadius:7, color:"#e24b4a", fontSize:10, padding:"5px 10px", cursor:"pointer" }}>Delete</button>}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab==="offers"&&(
        <div>
          {!loading&&offers.length===0&&(
            <div style={{ color:"#888888", fontSize:13, textAlign:"center", padding:"3rem" }}>
              <div style={{ fontSize:32, marginBottom:10 }}>💰</div>
              No offers yet
            </div>
          )}
          {offers.map(o=>{
            const OC = { pending:"#8b5cf6", accepted:"#1d9e75", rejected:"#e24b4a", countered:"#e6821e", withdrawn:"#555" }
            return (
              <div key={o.id} style={{ background:"#ffffff", border:"1px solid "+(OC[o.status]||"#eeeeee")+"30", borderRadius:12, padding:"1rem", marginBottom:10 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13, fontWeight:600, color:"#000000", marginBottom:4 }}>{o.marketplace_listings?.title}</div>
                    <div style={{ fontSize:11, color:"#777777", marginBottom:2 }}>Asking: KES {Number(o.marketplace_listings?.price||0).toLocaleString()}</div>
                    <div style={{ fontSize:11, color:"#777777", marginBottom:2 }}>From: {o.buyer?.first_name} {o.buyer?.last_name}{o.buyer?.city&&" · "+o.buyer.city}</div>
                    {o.message&&<div style={{ fontSize:11, color:"#555555", fontStyle:"italic", marginBottom:4 }}>"{o.message}"</div>}
                    <div style={{ fontSize:10, color:"#888888" }}>{new Date(o.created_at).toLocaleString()}</div>
                  </div>
                  <div style={{ textAlign:"right", flexShrink:0 }}>
                    <div style={{ fontFamily:"Syne", fontSize:16, fontWeight:800, color:"#e6821e" }}>KES {Number(o.offered_price).toLocaleString()}</div>
                    {o.counter_price&&<div style={{ fontSize:11, color:"#8b5cf6", marginTop:2 }}>Counter: KES {Number(o.counter_price).toLocaleString()}</div>}
                    <span style={{ fontSize:10, padding:"2px 8px", borderRadius:10, background:(OC[o.status]||"#888")+"20", color:OC[o.status]||"#888", marginTop:4, display:"inline-block" }}>{o.status}</span>
                  </div>
                </div>
                {o.status==="pending"&&(
                  <div>
                    <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:expanded===o.id?10:0 }}>
                      <button onClick={()=>acceptOffer(o)} disabled={processing===o.id}
                        style={{ background:"#1d9e75", border:"none", borderRadius:7, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:11, fontWeight:700, padding:"6px 14px", cursor:"pointer" }}>
                        Accept
                      </button>
                      <button onClick={()=>setExpanded(expanded===o.id?null:o.id)}
                        style={{ background:"#faf5ff", border:"1px solid #8b5cf640", borderRadius:7, color:"#8b5cf6", fontSize:11, padding:"6px 12px", cursor:"pointer" }}>
                        Counter
                      </button>
                      <button onClick={()=>rejectOffer(o.id,o.buyer_id,o.marketplace_listings?.title)} disabled={processing===o.id}
                        style={{ background:"none", border:"1px solid #e24b4a30", borderRadius:7, color:"#e24b4a", fontSize:11, padding:"6px 12px", cursor:"pointer" }}>
                        Decline
                      </button>
                    </div>
                    {expanded===o.id&&(
                      <div style={{ marginTop:8, display:"flex", gap:8 }}>
                        <input type="number" value={counterPrice} onChange={e=>setCounterPrice(e.target.value)}
                          placeholder="Counter price"
                          style={{ flex:1, background:"#ffffff", border:"1px solid #e5e5e5", borderRadius:7, padding:"8px 12px", color:"#000000", fontSize:12, outline:"none" }}/>
                        <button onClick={()=>counterOffer(o)} disabled={processing===o.id}
                          style={{ background:"#8b5cf6", border:"none", borderRadius:7, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:11, fontWeight:700, padding:"8px 14px", cursor:"pointer" }}>
                          Send
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

