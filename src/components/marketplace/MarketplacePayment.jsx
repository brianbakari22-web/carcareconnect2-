import { useState } from "react"
import { supabase } from "../../lib/supabase"
import { useAuth } from "../../contexts/AuthContext"
import useIsMobile from "../../lib/useIsMobile"
import toast from "react-hot-toast"

export default function MarketplacePayment({ offer, listing, onSuccess, onCancel }) {
  const { user, profile } = useAuth()
  const isMobile = useIsMobile()
  const [paying, setPaying] = useState(false)

  const salePrice = offer.counter_price || offer.offered_price
  const commission = salePrice * (listing.listing_type==="vehicle" ? 0.02 : 0.08)
  const sellerEarnings = salePrice - commission

  async function initPayment() {
    setPaying(true)
    try {
      const ref = `MKT-${Date.now()}-${user.id.slice(0,8)}`
      window.FlutterwaveCheckout({
        public_key: "FLWPUBK_TEST-7cc800b81b21b4d7075e716052932f32-X",
        tx_ref: ref,
        amount: salePrice,
        currency: "KES",
        payment_options: "card,mpesa",
        customer: {
          email: user.email,
          name: `${profile?.first_name} ${profile?.last_name}`,
          phone_number: profile?.phone || "",
        },
        customizations: {
          title: "Car Care Connect Marketplace",
          description: `Payment for: ${listing.title}`,
          logo: "https://carcareconnect2.pages.dev/logo.png",
        },
        callback: async (response) => {
          if (response.status === "successful") {
            await processPayment(ref, response.transaction_id)
          } else {
            toast.error("Payment failed — please try again")
            setPaying(false)
          }
        },
        onclose: () => setPaying(false),
      })
    } catch(err) {
      toast.error(err.message)
      setPaying(false)
    }
  }

  async function processPayment(ref, flwTxId) {
    try {
      // Create transaction with escrow
      const disputeDeadline = new Date(Date.now()+7*24*60*60*1000).toISOString()
      const { error } = await supabase.from("marketplace_transactions").insert({
        listing_id: listing.id,
        offer_id: offer.id,
        buyer_id: user.id,
        seller_id: listing.seller_id,
        sale_price: salePrice,
        platform_commission: commission,
        seller_earnings: sellerEarnings,
        payment_status: "paid",
        flw_transaction_id: flwTxId,
        flw_reference: ref,
        dispute_deadline: disputeDeadline,
      })
      if (error) throw error

      // Mark listing as sold
      await supabase.from("marketplace_listings").update({ status:"sold" }).eq("id",listing.id)

      // Mark offer as accepted
      await supabase.from("marketplace_offers").update({ status:"accepted" }).eq("id",offer.id)

      // Reject other offers
      await supabase.from("marketplace_offers").update({ status:"rejected" })
        .eq("listing_id",listing.id).neq("id",offer.id)

      // Notify seller
      await supabase.from("notifications").insert({
        user_id: listing.seller_id,
        title: "Payment received! 💰",
        message: `${profile?.first_name} ${profile?.last_name} has paid KES ${Number(salePrice).toLocaleString()} for your listing "${listing.title}". Funds are held in escrow until buyer confirms receipt. You will receive KES ${Number(sellerEarnings).toLocaleString()} after confirmation.`,
        type: "success",
      })

      toast.success("Payment successful! Funds held in escrow.")
      if (onSuccess) onSuccess()
    } catch(err) {
      toast.error(err.message)
      setPaying(false)
    }
  }

  return (
    <div style={{ background:"#0f0f0f", border:"1px solid #2a2a2a", borderRadius:16, padding:"1.5rem" }}>
      <div style={{ fontFamily:"Syne", fontSize:16, fontWeight:800, color:"#f0ede6", marginBottom:4 }}>Complete purchase</div>
      <div style={{ fontSize:12, color:"#555", marginBottom:"1.5rem" }}>Payment is held in escrow until you confirm receipt</div>

      {/* Listing summary */}
      <div style={{ background:"#111", borderRadius:10, padding:"1rem", marginBottom:"1.25rem" }}>
        <div style={{ fontSize:13, fontWeight:600, color:"#f0ede6", marginBottom:8 }}>{listing.title}</div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
          {[
            { l:"Sale price", v:`KES ${Number(salePrice).toLocaleString()}`, c:"#e6821e" },
            { l:"Platform fee", v:`KES ${Number(commission).toFixed(0)}`, c:"#555" },
            { l:"Seller receives", v:`KES ${Number(sellerEarnings).toFixed(0)}`, c:"#1d9e75" },
            { l:"You pay", v:`KES ${Number(salePrice).toLocaleString()}`, c:"#f0ede6" },
          ].map(f=>(
            <div key={f.l}>
              <div style={{ fontSize:10, color:"#444" }}>{f.l}</div>
              <div style={{ fontSize:13, fontWeight:600, color:f.c }}>{f.v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Escrow explanation */}
      <div style={{ background:"#0c1f2e", border:"1px solid #378add30", borderRadius:10, padding:"0.9rem", marginBottom:"1.25rem" }}>
        <div style={{ fontFamily:"Syne", fontSize:12, fontWeight:700, color:"#378add", marginBottom:8 }}>🔒 How escrow works</div>
        {[
          "You pay now — funds are held securely by Car Care Connect",
          "Seller is notified and arranges handover",
          "You confirm receipt within 7 days after handover",
          "Funds released to seller after your confirmation",
          "Raise a dispute within 7 days if item not as described",
        ].map((s,i)=>(
          <div key={i} style={{ display:"flex", gap:8, marginBottom:4 }}>
            <span style={{ color:"#378add", flexShrink:0 }}>{i+1}.</span>
            <span style={{ fontSize:11, color:"#888" }}>{s}</span>
          </div>
        ))}
      </div>

      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
        <button onClick={initPayment} disabled={paying}
          style={{ background:paying?"#333":"#e6821e", border:"none", borderRadius:10, color:paying?"#555":"#fff", fontFamily:"Syne,sans-serif", fontSize:14, fontWeight:700, padding:"14px", cursor:paying?"not-allowed":"pointer" }}>
          {paying?"Processing...":"💳 Pay KES "+Number(salePrice).toLocaleString()}
        </button>
        <button onClick={onCancel}
          style={{ background:"none", border:"1px solid #333", borderRadius:10, color:"#666", fontSize:13, padding:"12px", cursor:"pointer" }}>
          Cancel
        </button>
      </div>
    </div>
  )
}

