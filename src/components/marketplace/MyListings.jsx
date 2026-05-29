import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"
import { useAuth } from "../../contexts/AuthContext"
import { useNavigate } from "react-router-dom"
import useIsMobile from "../../lib/useIsMobile"
import toast from "react-hot-toast"

export default function MyListings() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const [listings, setListings] = useState([])
  const [offers, setOffers] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState("listings")
  const [expanded, setExpanded] = useState(null)
  const [counterPrice, setCounterPrice] = useState("")
  const [processing, setProcessing] = useState(null)

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
      .select("*").eq("seller_id", user.id).order("created_at", { ascending:false })
    setListings(data||[])
  }

  async function loadOffers() {
    const { data } = await supabase.from("marketplace_offers")
      .select("*, marketplace_listings(title,price), buyer:profiles!marketplace_offers_buyer_id_fkey(first_name,last_name,city)")
      .eq("seller_id", user.id)
      .order("created_at", { ascending:false })
    setOffers(data||[])
  }

  async function acceptOffer(offer) {
    setProcessing(offer.id)
    try {
      await supabase.from("marketplace_offers").update({ status:"accepted" }).eq("id",offer.id)
      // Mark other offers as rejected
      await supabase.from("marketplace_offers").update({ status:"rejected" }).eq("listing_id",offer.listing_id).neq("id",offer.id)
      // Mark listing as sold
      await supabase.from("marketplace_listings").update({ status:"sold" }).eq("id",offer.listing_id)
      // Create transaction
      const commission = Number(offer.offered_price) * 0.08
      await supabase.from("marketplace_transactions").insert({
        listing_id: offer.listing_id,
        offer_id: offer.id,
        buyer_id: offer.buyer_id,
        seller_id: user.id,
        sale_price: offer.offered_price,
        platform_commission: commission,
        seller_earnings: Number(offer.offered_price) - commission,
        payment_status: "pending",
      })
      // Notify buyer
      await supabase.from("notifications").insert({
        user_id: offer.buyer_id,
        title: "Offer accepted! 🎉",
        message: `Your offer of KES ${Number(offer.offered_price).toLocaleString()} for "${offer.marketplace_listings?.title}" has been accepted. Please proceed with payment.`,
        type: "success",
      })
      toast.success("Offer accepted — buyer notified!")
      load()
    } catch(err) { toast.error(err.message) }
    finally { setProcessing(null) }
  }

  async function rejectOffer(offerId, buyerId, listingTitle) {
    setProcessing(offerId)
    try {
      await supabase.from("marketplace_offers").update({ status:"rejected" }).eq("id",offerId)
      await supabase.from("notifications").insert({
        user_id: buyerId,
        title: "Offer update",
        message: `Your offer for "${listingTitle}" was not accepted. The item may still be available — try making another offer.`,
        type: "info",
      })
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
        user_id: offer.buyer_id,
        title: "Counter offer received 🔄",
        message: `The seller has countered your offer for "${offer.marketplace_listings?.title}" with KES ${Number(counterPrice).toLocaleString()}. Go to My Offers to respond.`,
        type: "info",
      })
      toast.success("Counter offer sent")
      setCounterPrice("")
      setExpanded(null)
      load()
    } catch(err) { toast.error(err.message) }
    finally { setProcessing(null) }
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
          <div style={{ fontFamily:"Syne", fontSize:isMobile?16:20, fontWeight:800, color:"#f0ede6" }}>My Listings</div>
          <div style={{ fontSize:12, color:"#555", marginTop:2 }}>Manage your marketplace listings and offers</div>
        </div>
        <button onClick={()=>navigate("/dashboard/marketplace/new")}
          style={{ background:"#e6821e", border:"none", borderRadius:9, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:13, fontWeight:700, padding:"10px 18px", cursor:"pointer" }}>
          + New listing
        </button>
      </div>

      {/* Stats */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:"1.5rem" }}>
        {[
          { label:"Total", value:listings.length, color:"#f0ede6" },
          { label:"Active", value:listings.filter(l=>l.status==="active").length, color:"#1d9e75" },
          { label:"Pending", value:listings.filter(l=>l.status==="pending").length, color:"#e6821e" },
          { label:"New offers", value:pendingOffers.length, color:"#8b5cf6" },
        ].map(s=>(
          <div key={s.label} style={{ background:"#111", borderRadius:10, padding:"0.75rem", border:"1px solid #1e1e1e", textAlign:"center" }}>
            <div style={{ fontFamily:"Syne", fontSize:isMobile?16:20, fontWeight:800, color:s.color }}>{s.value}</div>
            <div style={{ fontSize:10, color:"#555", marginTop:2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* New offers alert */}
      {pendingOffers.length>0&&(
        <div style={{ background:"#160a2e", border:"1px solid #8b5cf640", borderRadius:10, padding:"0.9rem", marginBottom:"1.25rem" }}>
          <div style={{ fontSize:13, color:"#8b5cf6", fontWeight:600 }}>💰 {pendingOffers.length} new offer{pendingOffers.length>1?"s":""} waiting for your response</div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display:"flex", gap:6, marginBottom:"1.25rem" }}>
        {[
          { k:"listings", l:`Listings (${listings.length})` },
          { k:"offers", l:`Offers (${offers.length})` },
        ].map(t=>(
          <button key={t.k} onClick={()=>setTab(t.k)}
            style={{ padding:"8px 16px", borderRadius:8, border:"none", fontSize:12, cursor:"pointer", background:tab===t.k?"#e6821e":"#111", color:tab===t.k?"#fff":"#666", fontFamily:"'DM Sans',sans-serif", fontWeight:tab===t.k?700:400 }}>
            {t.l}
          </button>
        ))}
      </div>

      {loading&&<div style={{ color:"#555", fontSize:13 }}>Loading...</div>}

      {/* LISTINGS */}
      {tab==="listings"&&(
        <div>
          {!loading&&listings.length===0&&(
            <div style={{ color:"#444", fontSize:13, textAlign:"center", padding:"3rem" }}>
              <div style={{ fontSize:32, marginBottom:10 }}>🛒</div>
              No listings yet
              <div style={{ marginTop:12 }}>
                <button onClick={()=>navigate("/dashboard/marketplace/new")}
                  style={{ background:"#e6821e", border:"none", borderRadius:8, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:12, fontWeight:700, padding:"9px 18px", cursor:"pointer" }}>
                  Create your first listing
                </button>
              </div>
            </div>
          )}
          {listings.map(l=>(
            <div key={l.id} style={{ background:"#111", border:`1px solid ${SC[l.status]||"#1e1e1e"}20`, borderRadius:12, padding:"1rem", marginBottom:10 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4, flexWrap:"wrap" }}>
                    <span>{l.listing_type==="vehicle"?"🚗":l.listing_type==="part"?"🔧":"✨"}</span>
                    <div style={{ fontSize:13, fontWeight:600, color:"#f0ede6" }}>{l.title}</div>
                    <span style={{ fontSize:10, padding:"2px 8px", borderRadius:10, background:`${SC[l.status]||"#888"}20`, color:SC[l.status]||"#888" }}>{l.status}</span>
                    {l.is_featured&&<span style={{ fontSize:10, color:"#e6821e" }}>⭐</span>}
                  </div>
                  {l.listing_type==="vehicle"&&<div style={{ fontSize:11, color:"#555", marginBottom:2 }}>{[l.make,l.model,l.year].filter(Boolean).join(" ")}</div>}
                  <div style={{ fontSize:11, color:"#555", marginBottom:2 }}>📍 {l.city} · 👁 {l.views||0} views</div>
                  {l.status==="pending"&&<div style={{ fontSize:11, color:"#e6821e", marginTop:4 }}>⏳ Under review — will go live within 24 hours</div>}
                  {l.status==="rejected"&&l.admin_notes&&<div style={{ fontSize:11, color:"#e24b4a", marginTop:4 }}>Rejected: {l.admin_notes}</div>}
                  <div style={{ fontSize:10, color:"#444", marginTop:4 }}>{new Date(l.created_at).toLocaleDateString()}</div>
                </div>
                <div style={{ textAlign:"right", flexShrink:0 }}>
                  <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:800, color:"#e6821e" }}>KES {Number(l.price).toLocaleString()}</div>
                  <div style={{ display:"flex", gap:6, marginTop:6, justifyContent:"flex-end" }}>
                    {l.status!=="sold"&&(
                      <button onClick={()=>deleteListing(l.id)}
                        style={{ background:"none", border:"1px solid #e24b4a30", borderRadius:6, color:"#e24b4a", fontSize:10, padding:"4px 8px", cursor:"pointer" }}>
                        Delete
                      </button>
                    )}
                    <button onClick={()=>navigate("/dashboard/marketplace")}
                      style={{ background:"#0c1f2e", border:"1px solid #378add40", borderRadius:6, color:"#378add", fontSize:10, padding:"4px 8px", cursor:"pointer" }}>
                      View
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* OFFERS */}
      {tab==="offers"&&(
        <div>
          {!loading&&offers.length===0&&(
            <div style={{ color:"#444", fontSize:13, textAlign:"center", padding:"3rem" }}>
              <div style={{ fontSize:32, marginBottom:10 }}>💰</div>
              No offers yet
            </div>
          )}
          {offers.map(o=>{
            const OC = { pending:"#8b5cf6", accepted:"#1d9e75", rejected:"#e24b4a", countered:"#e6821e", withdrawn:"#555" }
            return (
              <div key={o.id} style={{ background:"#111", border:`1px solid ${OC[o.status]||"#1e1e1e"}30`, borderRadius:12, padding:"1rem", marginBottom:10 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13, fontWeight:600, color:"#f0ede6", marginBottom:4 }}>{o.marketplace_listings?.title}</div>
                    <div style={{ fontSize:11, color:"#555", marginBottom:2 }}>
                      Asking: KES {Number(o.marketplace_listings?.price||0).toLocaleString()}
                    </div>
                    <div style={{ fontSize:11, color:"#555", marginBottom:2 }}>
                      From: {o.buyer?.first_name} {o.buyer?.last_name}
                      {o.buyer?.city&&` · ${o.buyer.city}`}
                    </div>
                    {o.message&&<div style={{ fontSize:11, color:"#888", fontStyle:"italic", marginBottom:4 }}>"{o.message}"</div>}
                    <div style={{ fontSize:10, color:"#444" }}>{new Date(o.created_at).toLocaleString()}</div>
                  </div>
                  <div style={{ textAlign:"right", flexShrink:0 }}>
                    <div style={{ fontFamily:"Syne", fontSize:16, fontWeight:800, color:"#e6821e" }}>
                      KES {Number(o.offered_price).toLocaleString()}
                    </div>
                    {o.counter_price&&<div style={{ fontSize:11, color:"#8b5cf6", marginTop:2 }}>Your counter: KES {Number(o.counter_price).toLocaleString()}</div>}
                    <span style={{ fontSize:10, padding:"2px 8px", borderRadius:10, background:`${OC[o.status]||"#888"}20`, color:OC[o.status]||"#888", marginTop:4, display:"inline-block" }}>{o.status}</span>
                  </div>
                </div>

                {o.status==="pending"&&(
                  <div>
                    <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:expanded===o.id?10:0 }}>
                      <button onClick={()=>acceptOffer(o)} disabled={processing===o.id}
                        style={{ background:"#1d9e75", border:"none", borderRadius:7, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:11, fontWeight:700, padding:"6px 14px", cursor:"pointer" }}>
                        ✓ Accept
                      </button>
                      <button onClick={()=>setExpanded(expanded===o.id?null:o.id)}
                        style={{ background:"#160a2e", border:"1px solid #8b5cf640", borderRadius:7, color:"#8b5cf6", fontSize:11, padding:"6px 12px", cursor:"pointer" }}>
                        🔄 Counter
                      </button>
                      <button onClick={()=>rejectOffer(o.id,o.buyer_id,o.marketplace_listings?.title)} disabled={processing===o.id}
                        style={{ background:"none", border:"1px solid #e24b4a30", borderRadius:7, color:"#e24b4a", fontSize:11, padding:"6px 12px", cursor:"pointer" }}>
                        Decline
                      </button>
                    </div>
                    {expanded===o.id&&(
                      <div style={{ marginTop:8, display:"flex", gap:8 }}>
                        <input type="number" value={counterPrice} onChange={e=>setCounterPrice(e.target.value)}
                          placeholder={`e.g. ${Math.round(Number(o.marketplace_listings?.price||0)*0.95).toLocaleString()}`}
                          style={{ flex:1, background:"#0f0f0f", border:"1px solid #222", borderRadius:7, padding:"8px 12px", color:"#f0ede6", fontSize:12, outline:"none", fontFamily:"'DM Sans',sans-serif" }}/>
                        <button onClick={()=>counterOffer(o)} disabled={processing===o.id}
                          style={{ background:"#8b5cf6", border:"none", borderRadius:7, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:11, fontWeight:700, padding:"8px 14px", cursor:"pointer" }}>
                          Send counter
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
