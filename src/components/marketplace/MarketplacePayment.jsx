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
  const processingFee = salePrice * 0.025
  const totalAmount = salePrice + processingFee

  async function initPayment() {
    setPaying(true)
    try {
      // Create transaction record first
      const { data: txn, error: txnError } = await supabase.from("marketplace_transactions").insert({
        listing_id: listing.id,
        offer_id: offer.id,
        buyer_id: user.id,
        seller_id: listing.seller_id,
        amount: salePrice,
        commission: commission,
        seller_earnings: sellerEarnings,
        status: "pending"
      }).select("id").single()

      if (txnError) throw txnError

      // Call Pesapal edge function
      const res = await fetch("https://gcnefnqtjxtqbhynyoxe.supabase.co/functions/v1/pesapal-payment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdjbmVmbnF0anh0cWJoeW55b3hlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2MDg0MzIsImV4cCI6MjA5NTE4NDQzMn0.Ybyce3psBj2I-hdoF95H5UAklr6hsgQi-mciI9uMIgc"
        },
        body: JSON.stringify({
          amount: totalAmount,
          bookingId: txn.id,
          customerEmail: user.email,
          customerPhone: profile?.phone || "",
          customerName: (profile?.first_name || "") + " " + (profile?.last_name || "")
        })
      })

      const order = await res.json()

      if (order.redirect_url) {
        // Update transaction with tracking ID
        await supabase.from("marketplace_transactions").update({
          pesapal_tracking_id: order.order_tracking_id,
          status: "processing"
        }).eq("id", txn.id)

        // Redirect to Pesapal
        window.location.href = order.redirect_url
      } else {
        throw new Error(typeof order.error === "object" ? JSON.stringify(order.error) : order.error || "Payment failed")
      }
    } catch(e) {
      toast.error(e.message || "Payment failed")
      setPaying(false)
    }
  }

  return (
    <div style={{ background:"#ffffff", border:"1px solid #eeeeee", borderRadius:12, padding:"1.25rem" }}>
      <div style={{ fontFamily:"Syne", fontSize:15, fontWeight:800, color:"#000000", marginBottom:12 }}>
        Complete Purchase
      </div>

      <div style={{ background:"#ffffff", borderRadius:8, padding:"0.75rem", marginBottom:16 }}>
        <div style={{ fontSize:12, color:"#555555", marginBottom:8, fontWeight:600 }}>{listing.title}</div>
        <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, color:"#555555", marginBottom:4 }}>
          <span>Sale price</span><span>KES {Number(salePrice).toLocaleString()}</span>
        </div>
        <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, color:"#555555", marginBottom:4 }}>
          <span>Processing fee (2.5%)</span><span>KES {processingFee.toFixed(0)}</span>
        </div>
        <div style={{ height:1, background:"#f0f0f0", margin:"8px 0" }}/>
        <div style={{ display:"flex", justifyContent:"space-between", fontSize:13, color:"#e6821e", fontWeight:700, marginBottom:4 }}>
          <span>You pay</span><span>KES {totalAmount.toFixed(0)}</span>
        </div>
        <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:"#777777" }}>
          <span>Seller receives</span><span>KES {sellerEarnings.toLocaleString()}</span>
        </div>
        <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:"#777777" }}>
          <span>Platform commission</span><span>KES {commission.toLocaleString()}</span>
        </div>
      </div>

      <div style={{ background:"#f0fdf4", border:"1px solid #1d9e7540", borderRadius:8, padding:"0.75rem", marginBottom:16, fontSize:11, color:"#1d9e75", lineHeight:1.6 }}>
        🔒 Funds held in escrow until you confirm receipt. 7-day dispute window after delivery.
      </div>

      <button onClick={initPayment} disabled={paying}
        style={{ width:"100%", background:paying?"#555555":"#e6821e", border:"none", borderRadius:10, color:paying?"#555":"#fff", fontFamily:"Syne,sans-serif", fontSize:14, fontWeight:700, padding:"13px", cursor:paying?"not-allowed":"pointer", marginBottom:8 }}>
        {paying ? "Connecting to Pesapal..." : "Pay KES " + totalAmount.toFixed(0) + " →"}
      </button>

      <button onClick={onCancel}
        style={{ width:"100%", background:"none", border:"1px solid #dddddd", borderRadius:10, color:"#666", fontSize:13, padding:"11px", cursor:"pointer" }}>
        Cancel
      </button>
    </div>
  )
}

