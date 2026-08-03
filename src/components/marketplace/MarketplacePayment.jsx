import { useState, useEffect } from "react"
import { LockedIcon } from "../../lib/cccIcons"
import { supabase } from "../../lib/supabase"
import DarajaPayment from "../shared/DarajaPayment"
import { useAuth } from "../../contexts/AuthContext"
import useIsMobile from "../../lib/useIsMobile"
import toast from "react-hot-toast"
export default function MarketplacePayment({ offer, listing, onSuccess, onCancel }) {
  const { user, profile } = useAuth()
  const isMobile = useIsMobile()
  const [paying, setPaying] = useState(false)
  const [showPayment, setShowPayment] = useState(false)
  const [commissionRate, setCommissionRate] = useState(null)
  const [txnId, setTxnId] = useState(null)
  useEffect(() => {
    const rateKey = listing.listing_type==="vehicle" ? "marketplace_vehicle" : "marketplace_item"
    supabase.from("commission_rates").select("platform_rate").eq("provider_type", rateKey).maybeSingle()
      .then(({ data }) => setCommissionRate(data ? Number(data.platform_rate) : (listing.listing_type==="vehicle" ? 0.02 : 0.08)))
  }, [listing.listing_type])
  const salePrice = offer.counter_price || offer.offered_price
  const commission = commissionRate!=null ? salePrice * commissionRate : 0
  const sellerEarnings = salePrice - commission
  const processingFeeRate = 0.01
  const processingFee = Math.ceil(salePrice * processingFeeRate)
  const totalAmount = salePrice + processingFee
  async function initPayment() {
    setPaying(true)
    try {
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
      setTxnId(txn.id)
      setShowPayment(true)
    } catch(e) {
      toast.error(e.message || "Payment failed")
    } finally {
      setPaying(false)
    }
  }
  if (showPayment && txnId) {
    return (
      <DarajaPayment
        amount={totalAmount}
        bookingId={txnId}
        description={`Marketplace - ${listing.title}`}
        onSuccess={async () => {
          await supabase.from("marketplace_transactions").update({ status: "processing" }).eq("id", txnId)
          onSuccess && onSuccess()
        }}
        onClose={() => setShowPayment(false)}
      />
    )
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
          <span>M-Pesa processing fee (1%)</span><span>KES {processingFee.toLocaleString()}</span>
        </div>
        <div style={{ height:1, background:"#f0f0f0", margin:"8px 0" }}/>
        <div style={{ display:"flex", justifyContent:"space-between", fontSize:13, color:"#e6821e", fontWeight:700, marginBottom:4 }}>
          <span>You pay</span><span>KES {totalAmount.toLocaleString()}</span>
        </div>
        <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:"#777777" }}>
          <span>Seller receives</span><span>KES {sellerEarnings.toLocaleString()}</span>
        </div>
        <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:"#777777" }}>
          <span>Platform commission</span><span>KES {commission.toLocaleString()}</span>
        </div>
      </div>
      <div style={{ background:"#f0fdf4", border:"1px solid #1d9e7540", borderRadius:8, padding:"0.75rem", marginBottom:16, fontSize:11, color:"#1d9e75", lineHeight:1.6 }}>
        <><LockedIcon size={12} color="#1d9e75"/> Funds held in escrow</> until you confirm receipt. 7-day dispute window after delivery.
      </div>
      <button onClick={initPayment} disabled={paying||commissionRate==null}
        style={{ width:"100%", background:paying?"#ccc":"#e6821e", border:"none", borderRadius:10, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:14, fontWeight:700, padding:"13px", cursor:paying?"not-allowed":"pointer", marginBottom:8 }}>
        {paying ? "Processing..." : `Pay KES ${totalAmount.toLocaleString()} via M-Pesa →`}
      </button>
      <button onClick={onCancel}
        style={{ width:"100%", background:"none", border:"1px solid #dddddd", borderRadius:10, color:"#666", fontSize:13, padding:"11px", cursor:"pointer" }}>
        Cancel
      </button>
    </div>
  )
}

