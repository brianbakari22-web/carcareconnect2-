import { useEffect, useState } from "react"
import { PaymentsIcon, LockedIcon, ShieldIcon, WarningIcon } from "../../lib/cccIcons"
import { supabase } from "../../lib/supabase"
import { useAuth } from "../../contexts/AuthContext"
import useIsMobile from "../../lib/useIsMobile"
import toast from "react-hot-toast"

export default function EscrowManager() {
  const { user, profile } = useAuth()
  const isMobile = useIsMobile()
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState("buying")
  const [disputing, setDisputing] = useState(null)
  const [reviewTx, setReviewTx] = useState(null)
  const [reviewRating, setReviewRating] = useState(5)
  const [reviewText, setReviewText] = useState("")
  const [submittingReview, setSubmittingReview] = useState(false)
  const [disputeReason, setDisputeReason] = useState("")
  const [disputeDesc, setDisputeDesc] = useState("")
  const [generatedOtp, setGeneratedOtp] = useState({})
  const [otpGenerating, setOtpGenerating] = useState(null)
  const [otpInput, setOtpInput] = useState({})
  const [otpVerifying, setOtpVerifying] = useState(null)
  const [payingFee, setPayingFee] = useState(null)

  useEffect(() => { if (user) load() }, [user])

  async function load() {
    const [{ data: buying }, { data: selling }] = await Promise.all([
      // Only show transactions that genuinely reached a paid state or beyond - a purely
      // pending, unpaid transaction shouldn't offer a "Confirm Receipt" option at all.
      supabase.from("marketplace_transactions")
        .select("*, marketplace_listings(title,listing_type,make,model)")
        .eq("buyer_id", user.id)
        .neq("payment_status", "pending")
        .order("created_at",{ascending:false}),
      supabase.from("marketplace_transactions")
        .select("*, marketplace_listings(title,listing_type,make,model)")
        .eq("seller_id", user.id)
        .neq("payment_status", "pending")
        .order("created_at",{ascending:false}),
    ])
    setTransactions({ buying:buying||[], selling:selling||[] })
    setLoading(false)
  }

  // The buyer generates the code deliberately, on their own device, only once they have
  // genuinely received and are satisfied with the item - the seller can never fake or rush
  // this moment, since they can only enter what the buyer chooses to give them in person.
  async function payFacilitationFee(tx) {
    setPayingFee(tx.id)
    try {
      const { data, error } = await supabase.functions.invoke("daraja-stk-push", {
        body: {
          amount: tx.facilitation_fee_amount,
          bookingId: tx.id,
          customerEmail: user.email,
          customerPhone: profile?.phone || "",
          customerName: (profile?.first_name||"") + " " + (profile?.last_name||""),
          description: `Facilitation fee for large sale (KES ${Number(tx.sale_price).toLocaleString()})`
        }
      })
      if (error) throw error
      if (data?.success) toast.success("STK Push sent! Check your phone for the M-Pesa prompt.")
      else throw new Error(data?.error || "Payment initiation failed")
    } catch(err) { toast.error(err.message) }
    finally { setPayingFee(null) }
  }
  async function payFacilitationFee(tx) {
    setPayingFee(tx.id)
    try {
      const { data, error } = await supabase.functions.invoke("daraja-stk-push", {
        body: {
          amount: tx.facilitation_fee_amount,
          bookingId: tx.id,
          customerEmail: user.email,
          customerPhone: profile?.phone || "",
          customerName: (profile?.first_name||"") + " " + (profile?.last_name||""),
          description: `Facilitation fee for large sale (KES ${Number(tx.sale_price).toLocaleString()})`
        }
      })
      if (error) throw error
      if (data?.success) toast.success("STK Push sent! Check your phone for the M-Pesa prompt.")
      else throw new Error(data?.error || "Payment initiation failed")
    } catch(err) { toast.error(err.message) }
    finally { setPayingFee(null) }
  }
  async function generateOtp(txId) {
    setOtpGenerating(txId)
    try {
      const { data, error } = await supabase.rpc("generate_handover_otp", { p_transaction_id: txId, p_buyer_id: user.id })
      if (error) throw error
      if (!data?.success) throw new Error(data?.error || "Failed to generate code")
      setGeneratedOtp(prev => ({ ...prev, [txId]: data.otp }))
      toast.success("Code generated - read it to the seller once you're satisfied")
    } catch(err) { toast.error(err.message) }
    finally { setOtpGenerating(null) }
  }
  async function verifyOtp(tx) {
    const entered = otpInput[tx.id]
    if (!entered || entered.length !== 4) return toast.error("Enter the 4-digit code")
    setOtpVerifying(tx.id)
    try {
      const { data, error } = await supabase.rpc("verify_handover_otp", { p_transaction_id: tx.id, p_otp: entered })
      if (error) throw error
      if (!data?.success) throw new Error(data?.error || "Verification failed")
      toast.success("Handover confirmed - payout requested!")
      const reviewableTx = transactions.selling.find(t=>t.id===tx.id)
      if (reviewableTx) setReviewTx(reviewableTx)
      load()
    } catch(err) { toast.error(err.message) }
    finally { setOtpVerifying(null) }
  }

  async function raiseDispute(tx) {
    if (!disputeReason) return toast.error("Please select a reason")
    if (!disputeDesc) return toast.error("Please describe the issue")
    try {
      await supabase.from("marketplace_disputes").insert({
        transaction_id: tx.id,
        raised_by: user.id,
        reason: disputeReason,
        description: disputeDesc,
        status: "open",
      })
      await supabase.from("marketplace_transactions").update({ dispute_raised:true }).eq("id",tx.id)
      await supabase.from("notifications").insert({
        user_id: tx.seller_id,
        title: "Dispute raised ⚠️",
        message: `A dispute has been raised on the transaction for "${tx.marketplace_listings?.title}". Reason: ${disputeReason}. Admin will review within 24 hours.`,
        type: "warning",
      })
      toast.success("Dispute raised — admin will review within 24 hours")
      setDisputing(null)
      setDisputeReason("")
      setDisputeDesc("")
      load()
    } catch(err) { toast.error(err.message) }
  }

  async function submitReview() {
    if (!reviewTx) return
    setSubmittingReview(true)
    try {
      await supabase.from("marketplace_reviews").insert({
        transaction_id: reviewTx.id,
        listing_id: reviewTx.listing_id,
        reviewer_id: user.id,
        seller_id: reviewTx.seller_id,
        rating: reviewRating,
        review_text: reviewText.trim()
      })
      toast.success("Review submitted! Thank you 🌟")
      setReviewTx(null)
      setReviewRating(5)
      setReviewText("")
    } catch(err) { toast.error(err.message) }
    finally { setSubmittingReview(false) }
  }

  function daysLeft(deadline) {
    if (!deadline) return null
    const diff = new Date(deadline) - new Date()
    return Math.max(0, Math.floor(diff/(1000*60*60*24)))
  }

  const PS = { pending:"#e6821e", paid:"#378add", released:"#1d9e75", refunded:"#8b5cf6", disputed:"#e24b4a" }
  const txList = tab==="buying" ? transactions.buying||[] : transactions.selling||[]

  const DISPUTE_REASONS = [
    "Item not as described",
    "Item not received",
    "Item damaged on arrival",
    "Wrong item received",
    "Seller unresponsive",
    "Other",
  ]

  return (
    <div>
      <div style={{ fontFamily:"Syne", fontSize:isMobile?16:20, fontWeight:800, color:"#000000", marginBottom:4 }}>Transactions</div>
      <div style={{ fontSize:12, color:"#777777", marginBottom:"1.25rem" }}>Track your marketplace purchases and sales</div>

      <div style={{ display:"flex", gap:6, marginBottom:"1.25rem" }}>
        {[
          { k:"buying", l:`Buying (${transactions.buying?.length||0})` },
          { k:"selling", l:`Selling (${transactions.selling?.length||0})` },
        ].map(t=>(
          <button key={t.k} onClick={()=>setTab(t.k)}
            style={{ padding:"8px 16px", borderRadius:8, border:"none", fontSize:12, cursor:"pointer", background:tab===t.k?"#e6821e":"#555555", color:tab===t.k?"#fff":"#666", fontFamily:"'DM Sans',sans-serif", fontWeight:tab===t.k?700:400 }}>
            {t.l}
          </button>
        ))}
      </div>

      {loading&&<div style={{ color:"#777777", fontSize:13 }}>Loading...</div>}
      {!loading&&txList.length===0&&(
        <div style={{ color:"#888888", fontSize:13, textAlign:"center", padding:"3rem" }}>
          <div style={{ marginBottom:10, display:"flex", justifyContent:"center" }}><PaymentsIcon size={32} color="#e6821e"/></div>
          No transactions yet
        </div>
      )}

      {txList.map(tx=>{
        const days = daysLeft(tx.dispute_deadline)
        return (
          <div key={tx.id} style={{ background:"#ffffff", border:`1px solid ${PS[tx.payment_status]||"#eeeeee"}20`, borderRadius:12, padding:"1rem", marginBottom:10 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:13, fontWeight:600, color:"#000000", marginBottom:4 }}>
                  {tx.marketplace_listings?.title}
                </div>
                <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
                  <span style={{ fontSize:10, padding:"2px 8px", borderRadius:10, background:`${PS[tx.payment_status]}20`, color:PS[tx.payment_status] }}>{tx.payment_status}</span>
                  {tx.buyer_confirmed&&<span style={{ fontSize:10, color:"#1d9e75" }}>✓ Receipt confirmed</span>}
                  {tx.dispute_raised&&<span style={{ fontSize:10, color:"#e24b4a" }}>⚠️ Dispute raised</span>}
                </div>
                <div style={{ fontSize:10, color:"#888888", marginTop:4 }}>{new Date(tx.created_at).toLocaleString()}</div>
              </div>
              <div style={{ textAlign:"right", flexShrink:0 }}>
                <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:800, color:"#e6821e" }}>KES {Number(tx.sale_price).toLocaleString()}</div>
                {tab==="selling"&&<div style={{ fontSize:11, color:"#1d9e75", marginTop:2 }}>You get: KES {Number(tx.seller_earnings).toLocaleString()}</div>}
                {tab==="buying"&&<div style={{ fontSize:11, color:"#777777", marginTop:2 }}>Commission: KES {Number(tx.platform_commission).toLocaleString()}</div>}
              </div>
            </div>

            {/* Escrow status */}
            {tx.payment_status==="paid"&&!tx.buyer_confirmed&&!tx.dispute_raised&&(
              <div style={{ background:"#eff6ff", border:"1px solid #378add30", borderRadius:8, padding:"0.75rem", marginBottom:8 }}>
                <div style={{ fontSize:11, color:"#378add", marginBottom:4 }}>
                  🔒 Funds in escrow{days!==null?` · ${days} days left to confirm or dispute`:""}
                </div>
                {tab==="buying"&&tx.payment_status==="awaiting_facilitation_fee"&&(
                  <div style={{ fontSize:11, color:"#777777" }}>Waiting for the seller to pay their facilitation fee before handover can be arranged.</div>
                )}
                {tab==="buying"&&tx.payment_status!=="awaiting_facilitation_fee"&&(
                  <div>
                    {!tx.buyer_confirmed&&(
                      <div style={{ background:"#fff8f0", border:"1px solid #e6821e30", borderRadius:8, padding:"10px 12px", marginBottom:10 }}>
                        <div style={{ fontSize:11, fontWeight:700, color:"#e6821e", marginBottom:4 }}>📍 Arrange Handover</div>
                        <div style={{ fontSize:10, color:"#555", lineHeight:1.6 }}>
                          1. Contact seller via CCC chat to arrange meeting<br/>
                          2. Meet in a safe public location (petrol station, mall, police station)<br/>
                          3. Inspect item carefully before confirming receipt<br/>
                          4. Only confirm receipt once satisfied — this releases payment to seller
                        </div>
                      </div>
                    )}
                  <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                    {!generatedOtp[tx.id] ? (
                      <button onClick={()=>generateOtp(tx.id)} disabled={otpGenerating===tx.id}
                        style={{ background:"#1d9e75", border:"none", borderRadius:7, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:11, fontWeight:700, padding:"6px 14px", cursor:"pointer" }}>
                        {otpGenerating===tx.id?"...":"✓ I've received it - generate code"}
                      </button>
                    ) : (
                      <div style={{ background:"#f0fdf4", border:"1px solid #1d9e7550", borderRadius:8, padding:"10px 12px" }}>
                        <div style={{ fontSize:11, color:"#555", marginBottom:4 }}>Read this code to the seller to release their payment:</div>
                        <div style={{ fontFamily:"Syne", fontSize:24, fontWeight:800, color:"#1d9e75", letterSpacing:6, textAlign:"center" }}>{generatedOtp[tx.id]}</div>
                      </div>
                    )}
                    {!tx.dispute_raised&&(
                      <button onClick={()=>setDisputing(disputing===tx.id?null:tx.id)}
                        style={{ background:"none", border:"1px solid #e24b4a40", borderRadius:7, color:"#e24b4a", fontSize:11, padding:"6px 12px", cursor:"pointer" }}>
                        ⚠️ Raise dispute
                      </button>
                    )}
                  </div>
                  </div>
                )}
                {tab==="selling"&&tx.payment_status==="awaiting_facilitation_fee"&&(
                  <div>
                    <div style={{ fontSize:11, color:"#777777", marginBottom:6 }}>This is a large sale - CCC can't hold the full amount, so pay your facilitation fee to unlock the handover step. You and the buyer exchange the sale amount directly between yourselves.</div>
                    <button onClick={()=>payFacilitationFee(tx)} disabled={payingFee===tx.id}
                      style={{ background:"#e6821e", border:"none", borderRadius:7, color:"#fff", fontSize:11, fontWeight:700, padding:"7px 14px", cursor:"pointer" }}>
                      {payingFee===tx.id?"...":`Pay facilitation fee - KES ${Number(tx.facilitation_fee_amount||0).toLocaleString()}`}
                    </button>
                  </div>
                )}
                {tab==="selling"&&tx.payment_status!=="awaiting_facilitation_fee"&&(
                  <div>
                    <div style={{ fontSize:11, color:"#777777", marginBottom:6 }}>Ask the buyer for their 4-digit code once you've handed over the item, to release your payment.</div>
                    <div style={{ display:"flex", gap:6 }}>
                      <input type="text" maxLength={4} placeholder="Code" value={otpInput[tx.id]||""}
                        onChange={e=>setOtpInput(prev=>({...prev,[tx.id]:e.target.value.replace(/\D/g,"")}))}
                        style={{ width:70, padding:"7px", borderRadius:7, border:"1px solid #ddd", fontSize:14, textAlign:"center", letterSpacing:4 }}/>
                      <button onClick={()=>verifyOtp(tx)} disabled={otpVerifying===tx.id}
                        style={{ background:"#1d9e75", border:"none", borderRadius:7, color:"#fff", fontSize:11, fontWeight:700, padding:"7px 14px", cursor:"pointer" }}>
                        {otpVerifying===tx.id?"...":"Verify & release"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {tx.payment_status==="released"&&(
              <div style={{ background:"#f0fdf4", border:"1px solid #1d9e7540", borderRadius:8, padding:"0.75rem" }}>
                <div style={{ fontSize:11, color:"#1d9e75" }}>
                  ✅ {tab==="buying"?"Transaction complete":"Payment released to your account"}
                </div>
              </div>
            )}

            {/* Dispute form */}
            {disputing===tx.id&&(
              <div style={{ marginTop:8, background:"#fff5f5", border:"1px solid #e24b4a30", borderRadius:8, padding:"0.9rem" }}>
                <div style={{ fontFamily:"Syne", fontSize:13, fontWeight:700, color:"#e24b4a", marginBottom:8 }}>Raise a dispute</div>
                <select value={disputeReason} onChange={e=>setDisputeReason(e.target.value)}
                  style={{ width:"100%", background:"#ffffff", border:"1px solid #e5e5e5", borderRadius:7, padding:"9px 12px", color:"#000000", fontSize:12, outline:"none", marginBottom:8, fontFamily:"'DM Sans',sans-serif" }}>
                  <option value="">Select reason</option>
                  {DISPUTE_REASONS.map(r=><option key={r} value={r}>{r}</option>)}
                </select>
                <textarea value={disputeDesc} onChange={e=>setDisputeDesc(e.target.value)}
                  placeholder="Describe the issue in detail..."
                  style={{ width:"100%", background:"#ffffff", border:"1px solid #e5e5e5", borderRadius:7, padding:"9px 12px", color:"#000000", fontSize:12, outline:"none", resize:"vertical", minHeight:70, marginBottom:8, fontFamily:"'DM Sans',sans-serif" }}/>
                <div style={{ display:"flex", gap:8 }}>
                  <button onClick={()=>raiseDispute(tx)}
                    style={{ background:"#e24b4a", border:"none", borderRadius:7, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:11, fontWeight:700, padding:"7px 14px", cursor:"pointer" }}>
                    Submit dispute
                  </button>
                  <button onClick={()=>setDisputing(null)}
                    style={{ background:"none", border:"1px solid #dddddd", borderRadius:7, color:"#666", fontSize:11, padding:"7px 12px", cursor:"pointer" }}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

