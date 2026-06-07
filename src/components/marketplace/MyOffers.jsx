import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"
import { useAuth } from "../../contexts/AuthContext"
import { useNavigate } from "react-router-dom"
import useIsMobile from "../../lib/useIsMobile"
import toast from "react-hot-toast"
import MarketplacePayment from "./MarketplacePayment"

export default function MyOffers() {
  const { user } = useAuth()
  const isMobile = useIsMobile()
  const navigate = useNavigate()
  const [offers, setOffers] = useState([])
  const [payingOffer, setPayingOffer] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    load()
    const sub = supabase.channel("my-offers-live")
      .on("postgres_changes", { event:"*", schema:"public", table:"marketplace_offers", filter:`buyer_id=eq.${user.id}` }, () => load())
      .subscribe()
    return () => supabase.removeChannel(sub)
  }, [user])

  async function load() {
    const { data } = await supabase.from("marketplace_offers")
      .select("*, marketplace_listings(title,price,listing_type,make,model,year,status), seller:profiles!marketplace_offers_seller_id_fkey(first_name,last_name,business_name)")
      .eq("buyer_id", user.id)
      .order("created_at", { ascending:false })
    setOffers(data||[])
    setLoading(false)
  }

  async function acceptCounter(offer) {
    try {
      await supabase.from("marketplace_offers").update({ status:"accepted", offered_price:offer.counter_price }).eq("id",offer.id)
      await supabase.from("marketplace_listings").update({ status:"sold" }).eq("id",offer.listing_id)
      const commission = Number(offer.counter_price) * 0.08
      await supabase.from("marketplace_transactions").insert({
        listing_id:offer.listing_id, offer_id:offer.id, buyer_id:user.id,
        seller_id:offer.seller_id, sale_price:offer.counter_price,
        platform_commission:commission, seller_earnings:Number(offer.counter_price)-commission,
        payment_status:"pending",
      })
      await supabase.from("notifications").insert({
        user_id:offer.seller_id, title:"Counter offer accepted! 🎉",
        message:`The buyer has accepted your counter offer of KES ${Number(offer.counter_price).toLocaleString()} for "${offer.marketplace_listings?.title}".`,
        type:"success",
      })
      toast.success("Counter accepted — proceed to payment")
      load()
    } catch(err) { toast.error(err.message) }
  }

  async function withdrawOffer(id) {
    if (!confirm("Withdraw this offer?")) return
    await supabase.from("marketplace_offers").update({ status:"withdrawn" }).eq("id",id).eq("buyer_id",user.id)
    toast.success("Offer withdrawn")
    load()
  }

  const OC = { pending:"#8b5cf6", accepted:"#1d9e75", rejected:"#e24b4a", countered:"#e6821e", withdrawn:"#555" }

  return (
    <div>
      <div style={{ fontFamily:"Syne", fontSize:isMobile?16:20, fontWeight:800, color:"#000000", marginBottom:4 }}>My Offers</div>
      <div style={{ fontSize:12, color:"#777777", marginBottom:"1.25rem" }}>Track offers you have made on marketplace listings</div>

      {loading&&<div style={{ color:"#777777", fontSize:13 }}>Loading...</div>}
      {!loading&&offers.length===0&&(
        <div style={{ color:"#888888", fontSize:13, textAlign:"center", padding:"3rem" }}>
          <div style={{ fontSize:32, marginBottom:10 }}>💰</div>
          No offers made yet
          <div style={{ marginTop:12 }}>
            <button onClick={()=>navigate("/dashboard/marketplace")}
              style={{ background:"#e6821e", border:"none", borderRadius:8, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:12, fontWeight:700, padding:"9px 18px", cursor:"pointer" }}>
              Browse marketplace
            </button>
          </div>
        </div>
      )}

      {offers.map(o=>(
        <div key={o.id} style={{ background:"#ffffff", border:`1px solid ${OC[o.status]||"#1e1e1e"}30`, borderRadius:12, padding:"1rem", marginBottom:10 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4, flexWrap:"wrap" }}>
                <span>{o.marketplace_listings?.listing_type==="vehicle"?"🚗":"🔧"}</span>
                <div style={{ fontSize:13, fontWeight:600, color:"#000000" }}>{o.marketplace_listings?.title}</div>
                <span style={{ fontSize:10, padding:"2px 8px", borderRadius:10, background:`${OC[o.status]||"#888"}20`, color:OC[o.status]||"#888" }}>{o.status}</span>
              </div>
              <div style={{ fontSize:11, color:"#777777", marginBottom:2 }}>
                Asking: KES {Number(o.marketplace_listings?.price||0).toLocaleString()}
              </div>
              <div style={{ fontSize:11, color:"#777777", marginBottom:2 }}>
                Seller: {o.seller?.business_name||`${o.seller?.first_name} ${o.seller?.last_name}`}
              </div>
              {o.message&&<div style={{ fontSize:11, color:"#555555", fontStyle:"italic", marginBottom:4 }}>"{o.message}"</div>}
              <div style={{ fontSize:10, color:"#888888" }}>{new Date(o.created_at).toLocaleString()}</div>
            </div>
            <div style={{ textAlign:"right", flexShrink:0 }}>
              <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:800, color:"#e6821e" }}>
                KES {Number(o.offered_price).toLocaleString()}
              </div>
              {o.counter_price&&<div style={{ fontSize:11, color:"#e6821e", marginTop:2 }}>Counter: KES {Number(o.counter_price).toLocaleString()}</div>}
            </div>
          </div>

          {/* Counter offer action */}
          {o.status==="countered"&&(
            <div style={{ background:"#1a1208", border:"1px solid #e6821e30", borderRadius:8, padding:"0.75rem", marginBottom:8 }}>
              <div style={{ fontSize:12, color:"#e6821e", fontWeight:600, marginBottom:4 }}>🔄 Seller countered with KES {Number(o.counter_price).toLocaleString()}</div>
              <div style={{ display:"flex", gap:8 }}>
                <button onClick={()=>acceptCounter(o)}
                  style={{ background:"#1d9e75", border:"none", borderRadius:7, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:11, fontWeight:700, padding:"6px 14px", cursor:"pointer" }}>
                  ✓ Accept counter
                </button>
                <button onClick={()=>withdrawOffer(o.id)}
                  style={{ background:"none", border:"1px solid #e24b4a30", borderRadius:7, color:"#e24b4a", fontSize:11, padding:"6px 12px", cursor:"pointer" }}>
                  Decline
                </button>
              </div>
            </div>
          )}

          {/* Accepted — proceed to payment */}
          {o.status==="accepted"&&o.marketplace_listings?.status!=="sold"&&(
            <div style={{ background:"#071a12", border:"1px solid #1d9e7540", borderRadius:8, padding:"0.75rem" }}>
              <div style={{ fontSize:12, color:"#1d9e75", fontWeight:600, marginBottom:6 }}>✓ Offer accepted — proceed to payment</div>
              <button onClick={()=>setPayingOffer(payingOffer===o.id?null:o.id)}
                style={{ background:"#e6821e", border:"none", borderRadius:7, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:12, fontWeight:700, padding:"8px 16px", cursor:"pointer" }}>
                💳 Pay now
              </button>
            </div>
          )}
          {payingOffer===o.id&&o.status==="accepted"&&(
            <div style={{ marginTop:10 }}>
              <MarketplacePayment
                offer={o}
                listing={o.marketplace_listings}
                onSuccess={()=>{ setPayingOffer(null); load() }}
                onCancel={()=>setPayingOffer(null)}
              />
            </div>
          )}
          {o.status==="accepted_old"&&o.marketplace_listings?.status!=="sold"&&(
            <div style={{ background:"#071a12", border:"1px solid #1d9e7540", borderRadius:8, padding:"0.75rem" }}>
              <div style={{ fontSize:12, color:"#1d9e75", fontWeight:600, marginBottom:4 }}>✓ Offer accepted! Proceed to payment</div>
              <div style={{ fontSize:11, color:"#777777" }}>Contact support to complete the transaction securely through Car Care Connect.</div>
            </div>
          )}

          {o.status==="pending"&&(
            <button onClick={()=>withdrawOffer(o.id)}
              style={{ background:"none", border:"1px solid #dddddd", borderRadius:7, color:"#777777", fontSize:11, padding:"5px 10px", cursor:"pointer" }}>
              Withdraw offer
            </button>
          )}
        </div>
      ))}
    </div>
  )
}


