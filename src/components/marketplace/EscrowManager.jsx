import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"
import { useAuth } from "../../contexts/AuthContext"
import useIsMobile from "../../lib/useIsMobile"
import toast from "react-hot-toast"

export default function EscrowManager() {
  const { user } = useAuth()
  const isMobile = useIsMobile()
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState("buying")
  const [disputing, setDisputing] = useState(null)
  const [disputeReason, setDisputeReason] = useState("")
  const [disputeDesc, setDisputeDesc] = useState("")

  useEffect(() => { if (user) load() }, [user])

  async function load() {
    const [{ data: buying }, { data: selling }] = await Promise.all([
      supabase.from("marketplace_transactions")
        .select("*, marketplace_listings(title,listing_type,make,model)")
        .eq("buyer_id", user.id)
        .order("created_at",{ascending:false}),
      supabase.from("marketplace_transactions")
        .select("*, marketplace_listings(title,listing_type,make,model)")
        .eq("seller_id", user.id)
        .order("created_at",{ascending:false}),
    ])
    setTransactions({ buying:buying||[], selling:selling||[] })
    setLoading(false)
  }

  async function confirmReceipt(txId) {
    if (!confirm("Confirm you have received the item in the described condition?")) return
    try {
      await supabase.from("marketplace_transactions").update({
        buyer_confirmed: true,
        buyer_confirmed_at: new Date().toISOString(),
        payment_status: "released",
        escrow_released: true,
        escrow_released_at: new Date().toISOString(),
      }).eq("id",txId)

      const tx = transactions.buying.find(t=>t.id===txId)
      await supabase.from("notifications").insert({
        user_id: tx.seller_id,
        title: "Payment released! 🎉",
        message: `The buyer has confirmed receipt of "${tx.marketplace_listings?.title}". KES ${Number(tx.seller_earnings).toLocaleString()} has been released to your account.`,
        type: "success",
      })

      toast.success("Receipt confirmed — payment released to seller!")
      load()
    } catch(err) { toast.error(err.message) }
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
      <div style={{ fontFamily:"Syne", fontSize:isMobile?16:20, fontWeight:800, color:"#f0ede6", marginBottom:4 }}>Transactions</div>
      <div style={{ fontSize:12, color:"#555", marginBottom:"1.25rem" }}>Track your marketplace purchases and sales</div>

      <div style={{ display:"flex", gap:6, marginBottom:"1.25rem" }}>
        {[
          { k:"buying", l:`Buying (${transactions.buying?.length||0})` },
          { k:"selling", l:`Selling (${transactions.selling?.length||0})` },
        ].map(t=>(
          <button key={t.k} onClick={()=>setTab(t.k)}
            style={{ padding:"8px 16px", borderRadius:8, border:"none", fontSize:12, cursor:"pointer", background:tab===t.k?"#e6821e":"#111", color:tab===t.k?"#fff":"#666", fontFamily:"'DM Sans',sans-serif", fontWeight:tab===t.k?700:400 }}>
            {t.l}
          </button>
        ))}
      </div>

      {loading&&<div style={{ color:"#555", fontSize:13 }}>Loading...</div>}
      {!loading&&txList.length===0&&(
        <div style={{ color:"#444", fontSize:13, textAlign:"center", padding:"3rem" }}>
          <div style={{ fontSize:32, marginBottom:10 }}>💳</div>
          No transactions yet
        </div>
      )}

      {txList.map(tx=>{
        const days = daysLeft(tx.dispute_deadline)
        return (
          <div key={tx.id} style={{ background:"#111", border:`1px solid ${PS[tx.payment_status]||"#1e1e1e"}20`, borderRadius:12, padding:"1rem", marginBottom:10 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:13, fontWeight:600, color:"#f0ede6", marginBottom:4 }}>
                  {tx.marketplace_listings?.title}
                </div>
                <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
                  <span style={{ fontSize:10, padding:"2px 8px", borderRadius:10, background:`${PS[tx.payment_status]}20`, color:PS[tx.payment_status] }}>{tx.payment_status}</span>
                  {tx.buyer_confirmed&&<span style={{ fontSize:10, color:"#1d9e75" }}>✓ Receipt confirmed</span>}
                  {tx.dispute_raised&&<span style={{ fontSize:10, color:"#e24b4a" }}>⚠️ Dispute raised</span>}
                </div>
                <div style={{ fontSize:10, color:"#444", marginTop:4 }}>{new Date(tx.created_at).toLocaleString()}</div>
              </div>
              <div style={{ textAlign:"right", flexShrink:0 }}>
                <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:800, color:"#e6821e" }}>KES {Number(tx.sale_price).toLocaleString()}</div>
                {tab==="selling"&&<div style={{ fontSize:11, color:"#1d9e75", marginTop:2 }}>You get: KES {Number(tx.seller_earnings).toLocaleString()}</div>}
                {tab==="buying"&&<div style={{ fontSize:11, color:"#555", marginTop:2 }}>Commission: KES {Number(tx.platform_commission).toLocaleString()}</div>}
              </div>
            </div>

            {/* Escrow status */}
            {tx.payment_status==="paid"&&!tx.buyer_confirmed&&!tx.dispute_raised&&(
              <div style={{ background:"#0c1f2e", border:"1px solid #378add30", borderRadius:8, padding:"0.75rem", marginBottom:8 }}>
                <div style={{ fontSize:11, color:"#378add", marginBottom:4 }}>
                  🔒 Funds in escrow{days!==null?` · ${days} days left to confirm or dispute`:""}
                </div>
                {tab==="buying"&&(
                  <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                    <button onClick={()=>confirmReceipt(tx.id)}
                      style={{ background:"#1d9e75", border:"none", borderRadius:7, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:11, fontWeight:700, padding:"6px 14px", cursor:"pointer" }}>
                      ✓ Confirm receipt
                    </button>
                    {!tx.dispute_raised&&(
                      <button onClick={()=>setDisputing(disputing===tx.id?null:tx.id)}
                        style={{ background:"none", border:"1px solid #e24b4a40", borderRadius:7, color:"#e24b4a", fontSize:11, padding:"6px 12px", cursor:"pointer" }}>
                        ⚠️ Raise dispute
                      </button>
                    )}
                  </div>
                )}
                {tab==="selling"&&(
                  <div style={{ fontSize:11, color:"#555" }}>Waiting for buyer to confirm receipt</div>
                )}
              </div>
            )}

            {tx.payment_status==="released"&&(
              <div style={{ background:"#071a12", border:"1px solid #1d9e7540", borderRadius:8, padding:"0.75rem" }}>
                <div style={{ fontSize:11, color:"#1d9e75" }}>
                  ✅ {tab==="buying"?"Transaction complete":"Payment released to your account"}
                </div>
              </div>
            )}

            {/* Dispute form */}
            {disputing===tx.id&&(
              <div style={{ marginTop:8, background:"#1a0808", border:"1px solid #e24b4a30", borderRadius:8, padding:"0.9rem" }}>
                <div style={{ fontFamily:"Syne", fontSize:13, fontWeight:700, color:"#e24b4a", marginBottom:8 }}>Raise a dispute</div>
                <select value={disputeReason} onChange={e=>setDisputeReason(e.target.value)}
                  style={{ width:"100%", background:"#111", border:"1px solid #222", borderRadius:7, padding:"9px 12px", color:"#f0ede6", fontSize:12, outline:"none", marginBottom:8, fontFamily:"'DM Sans',sans-serif" }}>
                  <option value="">Select reason</option>
                  {DISPUTE_REASONS.map(r=><option key={r} value={r}>{r}</option>)}
                </select>
                <textarea value={disputeDesc} onChange={e=>setDisputeDesc(e.target.value)}
                  placeholder="Describe the issue in detail..."
                  style={{ width:"100%", background:"#111", border:"1px solid #222", borderRadius:7, padding:"9px 12px", color:"#f0ede6", fontSize:12, outline:"none", resize:"vertical", minHeight:70, marginBottom:8, fontFamily:"'DM Sans',sans-serif" }}/>
                <div style={{ display:"flex", gap:8 }}>
                  <button onClick={()=>raiseDispute(tx)}
                    style={{ background:"#e24b4a", border:"none", borderRadius:7, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:11, fontWeight:700, padding:"7px 14px", cursor:"pointer" }}>
                    Submit dispute
                  </button>
                  <button onClick={()=>setDisputing(null)}
                    style={{ background:"none", border:"1px solid #333", borderRadius:7, color:"#666", fontSize:11, padding:"7px 12px", cursor:"pointer" }}>
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
