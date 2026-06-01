import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"
import { useAuth } from "../../contexts/AuthContext"
import useIsMobile from "../../lib/useIsMobile"
import toast from "react-hot-toast"
import ChatWindow from "../shared/ChatWindow"

function generateVoucherCode() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
  const segments = [4,4,4].map(len=>Array.from({length:len},()=>chars[Math.floor(Math.random()*chars.length)]).join(""))
  return "CCC-" + segments.join("-")
}

export default function AdminClaims() {
  const { user } = useAuth()
  const isMobile = useIsMobile()
  const [claims, setClaims] = useState([])
  const [penalties, setPenalties] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState("claims")
  const [selected, setSelected] = useState(null)
  const [adminNotes, setAdminNotes] = useState("")
  const [processing, setProcessing] = useState(false)
  const [chattingWith, setChattingWith] = useState(null) // {claimId, userId, name, role}

  useEffect(() => {
    load()
    const sub = supabase.channel("admin-claims-live")
      .on("postgres_changes", { event:"*", schema:"public", table:"service_claims" }, () => load())
      .on("postgres_changes", { event:"INSERT", schema:"public", table:"chat_messages", filter:`receiver_id=eq.${user.id}` }, () => { loadClaimMessages(); toast("New message on a claim 💬", { icon:"📋" }) })
      .subscribe()
    return () => supabase.removeChannel(sub)
  }, [])

  async function loadClaimMessages() {
    const { data } = await supabase.from("chat_messages")
      .select("*, profiles!chat_messages_sender_id_fkey(first_name,last_name,role)")
      .not("claim_id","is",null)
      .eq("is_read",false)
      .neq("sender_id",user.id)
      .order("created_at",{ascending:false})
    setClaimMessages(data||[])
  }

  async function loadClaimMessages() {
    supabase.from("chat_messages").select("*, profiles!chat_messages_sender_id_fkey(first_name,last_name,role)").not("claim_id","is",null).eq("is_read",false).neq("sender_id",user.id).order("created_at",{ascending:false}).then(({data})=>setClaimMessages(data||[]))
  }

  async function load() {
    const [{ data: cls }, { data: pens }] = await Promise.all([
      supabase.from("service_claims")
        .select("*, bookings(service_name,booking_number,booking_date,total_amount,provider_id), customer:profiles!service_claims_customer_id_fkey(first_name,last_name), provider:profiles!service_claims_provider_id_fkey(first_name,last_name,business_name)")
        .order("created_at",{ascending:false}),
      supabase.from("provider_penalties").select("*, profiles(first_name,last_name,business_name)").order("created_at",{ascending:false}),
    ])
    setClaims(cls||[])
    setPenalties(pens||[])
    setLoading(false)
  }

  async function approveClaim(claim) {
    setProcessing(true)
    try {
      const voucherCode = generateVoucherCode()
      const amount = Number(claim.bookings?.total_amount||0)
      const expires = new Date(Date.now()+30*24*60*60*1000).toISOString()

      // Get provider penalty count
      const { data: existingPenalties } = await supabase.from("provider_penalties")
        .select("id").eq("provider_id",claim.provider_id).eq("is_active",true)
      const penaltyCount = existingPenalties?.length||0

      let penaltyType = "warning"
      let suspendUntil = null
      let suspendProvider = false
      if (penaltyCount===1) { penaltyType="suspension_7d"; suspendUntil=new Date(Date.now()+7*24*60*60*1000).toISOString(); suspendProvider=true }
      if (penaltyCount>=2) { penaltyType="permanent_ban"; suspendProvider=true }

      await Promise.all([
        // Update claim status
        supabase.from("service_claims").update({ status:"approved", admin_notes:adminNotes, resolved_by:user.id, resolved_at:new Date().toISOString() }).eq("id",claim.id),

        // Create voucher for customer
        supabase.from("service_vouchers").insert({
          claim_id: claim.id,
          customer_id: claim.customer_id,
          voucher_code: voucherCode,
          original_booking_id: claim.booking_id,
          original_provider_id: claim.provider_id,
          amount: amount,
          expires_at: expires,
        }),

        // Record provider penalty
        supabase.from("provider_penalties").insert({
          provider_id: claim.provider_id,
          claim_id: claim.id,
          penalty_type: penaltyType,
          amount_deducted: amount,
          reason: `Service claim approved — ${claim.reason}`,
          is_active: true,
          expires_at: suspendUntil,
          applied_by: user.id,
        }),

        // Save voucher to database
        supabase.from("vouchers").insert({
          code: voucherCode,
          customer_id: claim.customer_id,
          value: amount,
          original_value: amount,
          claim_id: claim.id,
          expires_at: expires,
        }),
        // Notify customer
        supabase.from("notifications").insert({
          user_id: claim.customer_id,
          title: "Claim approved — voucher issued! 🎟️",
          message: `Your service claim has been approved. We have issued a service voucher worth KES ${amount.toLocaleString()} (code: ${voucherCode}). Valid for 30 days. Use it to rebook with any other provider at no charge.`,
          type: "success",
        }),

        // Notify provider
        supabase.from("notifications").insert({
          user_id: claim.provider_id,
          title: "Service claim against you ⚠️",
          message: `A service claim has been filed and approved against booking #${claim.bookings?.booking_number}. Penalty: ${penaltyType.replace(/_/g," ")}. Amount deducted: KES ${amount.toLocaleString()}. Reason: ${claim.reason}.`,
          type: "error",
        }),
      ])

      // Suspend provider if needed
      if (suspendProvider) {
        await supabase.from("profiles").update({ is_active: penaltyType!=="permanent_ban" }).eq("id",claim.provider_id)
      }

      toast.success(`Claim approved — voucher ${voucherCode} issued to customer`)
      setSelected(null)
      setAdminNotes("")
      load()
    } catch(err) {
      toast.error(err.message)
    } finally {
      setProcessing(false)
    }
  }

  async function rejectClaim(claimId) {
    if (!adminNotes) return toast.error("Please add a reason for rejection")
    setProcessing(true)
    try {
      const claim = claims.find(c=>c.id===claimId)
      await Promise.all([
        supabase.from("service_claims").update({ status:"rejected", admin_notes:adminNotes, resolved_by:user.id, resolved_at:new Date().toISOString() }).eq("id",claimId),
        supabase.from("notifications").insert({
          user_id: claim.customer_id,
          title: "Claim update",
          message: `Your service claim has been reviewed. Decision: Not approved. Reason: ${adminNotes}. Contact support if you have questions.`,
          type: "warning",
        }),
      ])
      toast.success("Claim rejected")
      setSelected(null)
      setAdminNotes("")
      load()
    } catch(err) {
      toast.error(err.message)
    } finally {
      setProcessing(false)
    }
  }

  async function issueCashRefund(claim) {
    if (!adminNotes) return toast.error("Please add reason for cash refund exception")
    if (!confirm(`Issue cash refund of KES ${Number(claim.bookings?.total_amount||0).toLocaleString()} to customer? This is an exception — use only when voucher is not appropriate.`)) return
    setProcessing(true)
    try {
      const amount = Number(claim.bookings?.total_amount||0)
      await Promise.all([
        supabase.from("service_claims").update({ status:"approved", admin_notes:`CASH REFUND EXCEPTION: ${adminNotes}`, resolved_by:user.id, resolved_at:new Date().toISOString() }).eq("id",claim.id),
        supabase.from("refunds").insert({
          booking_id: claim.booking_id,
          customer_id: claim.customer_id,
          amount: amount,
          reason: `Service Guarantee cash refund exception: ${adminNotes}`,
          status: "approved",
          approved_by: user.id,
        }),
        supabase.from("notifications").insert({
          user_id: claim.customer_id,
          title: "Cash refund approved 💰",
          message: `As an exception, a cash refund of KES ${amount.toLocaleString()} has been approved for your claim. Please allow 3-5 business days for processing.`,
          type: "success",
        }),
        supabase.from("provider_penalties").insert({
          provider_id: claim.provider_id,
          claim_id: claim.id,
          penalty_type: "deduction",
          amount_deducted: amount,
          reason: `Cash refund issued to customer — ${claim.reason}`,
          is_active: true,
          applied_by: user.id,
        }),
        supabase.from("notifications").insert({
          user_id: claim.provider_id,
          title: "Cash refund issued against you ⚠️",
          message: `A cash refund of KES ${amount.toLocaleString()} has been issued to a customer due to: ${claim.reason}. This amount will be deducted from your earnings.`,
          type: "error",
        }),
      ])
      toast.success("Cash refund approved and recorded")
      setSelected(null)
      setAdminNotes("")
      load()
    } catch(err) {
      toast.error(err.message)
    } finally {
      setProcessing(false)
    }
  }

  async function rejectClaimOLD(claimId) {
    try {} catch(err) {
      toast.error(err.message)
    } finally {
      setProcessing(false)
    }
  }

  async function issueCashRefund(claim) {
    if (!adminNotes) return toast.error("Please add reason for cash refund exception")
    if (!confirm("Issue cash refund? This is an exception — use only when voucher is not appropriate.")) return
    setProcessing(true)
    try {
      const amount = Number(claim.bookings?.total_amount||0)
      await Promise.all([
        supabase.from("service_claims").update({ status:"approved", admin_notes:`CASH REFUND: ${adminNotes}`, resolved_by:user.id, resolved_at:new Date().toISOString() }).eq("id",claim.id),
        supabase.from("notifications").insert({ user_id:claim.customer_id, title:"Cash refund approved 💰", message:`A cash refund of KES ${amount.toLocaleString()} has been approved. Allow 3-5 business days for processing.`, type:"success" }),
        supabase.from("notifications").insert({ user_id:claim.provider_id, title:"Cash refund issued against you ⚠️", message:`A cash refund of KES ${amount.toLocaleString()} was issued due to: ${claim.reason}. Deducted from your earnings.`, type:"error" }),
        supabase.from("provider_penalties").insert({ provider_id:claim.provider_id, claim_id:claim.id, penalty_type:"deduction", amount_deducted:amount, reason:`Cash refund exception — ${claim.reason}`, is_active:true, applied_by:user.id }),
      ])
      toast.success("Cash refund approved")
      setSelected(null); setAdminNotes(""); load()
    } catch(err) { toast.error(err.message) }
    finally { setProcessing(false) }
  }

  const pending = claims.filter(c=>c.status==="pending")
  const underReview = claims.filter(c=>c.status==="under_review")
  const approved = claims.filter(c=>c.status==="approved")
  const SC = { pending:"#e6821e", under_review:"#8b5cf6", approved:"#1d9e75", rejected:"#e24b4a" }

  return (
    <div>
      {/* Stats */}
      <div style={{ display:"grid", gridTemplateColumns:isMobile?"repeat(2,1fr)":"repeat(4,1fr)", gap:10, marginBottom:"1.5rem" }}>
        {[
          { label:"Total claims", value:claims.length, color:"#f0ede6" },
          { label:"Pending review", value:pending.length, color:"#e6821e" },
          { label:"Approved", value:approved.length, color:"#1d9e75" },
          { label:"Provider penalties", value:penalties.length, color:"#e24b4a" },
        ].map(s=>(
          <div key={s.label} style={{ background:"#111", borderRadius:10, padding:isMobile?"0.75rem":"1rem", border:"1px solid #1e1e1e" }}>
            <div style={{ fontSize:10, color:"#555", textTransform:"uppercase", marginBottom:4 }}>{s.label}</div>
            <div style={{ fontFamily:"Syne", fontSize:isMobile?16:20, fontWeight:800, color:s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Urgent banner */}
      {pending.length>0&&(
        <div style={{ background:"#1a1208", border:"1px solid #e6821e40", borderRadius:10, padding:"0.9rem", marginBottom:"1.25rem" }}>
          <div style={{ fontSize:13, color:"#e6821e", fontWeight:600 }}>⚠️ {pending.length} claim{pending.length>1?"s":""} pending review — respond within 24 hours</div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display:"flex", gap:6, marginBottom:"1.25rem", flexWrap:"wrap" }}>
        {[
          { k:"claims", l:"All claims" },
          { k:"penalties", l:`Provider penalties (${penalties.length})` },
        ].map(t=>(
          <button key={t.k} onClick={()=>setTab(t.k)}
            style={{ padding:"8px 16px", borderRadius:8, border:"none", fontSize:12, cursor:"pointer", background:tab===t.k?"#8b5cf6":"#111", color:tab===t.k?"#fff":"#666", fontFamily:"'DM Sans',sans-serif", fontWeight:tab===t.k?700:400 }}>
            {t.l}
          </button>
        ))}
      </div>

      {/* CLAIMS TAB */}
      {tab==="claims"&&(
        <div>
          {loading&&<div style={{ color:"#555", fontSize:13 }}>Loading...</div>}
          {!loading&&claims.length===0&&<div style={{ color:"#444", fontSize:13, textAlign:"center", padding:"2rem" }}>No claims yet</div>}
          {claims.map(c=>(
            <div key={c.id} style={{ background:"#111", border:`1px solid ${SC[c.status]||"#1e1e1e"}30`, borderRadius:12, padding:"1rem", marginBottom:10 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4, flexWrap:"wrap" }}>
                    <div style={{ fontSize:13, fontWeight:600, color:"#f0ede6" }}>{c.bookings?.service_name}</div>
                    <span style={{ fontSize:10, padding:"2px 8px", borderRadius:10, background:`${SC[c.status]||"#888"}20`, color:SC[c.status]||"#888" }}>{c.status?.replace("_"," ")}</span>
                  </div>
                  <div style={{ fontSize:11, color:"#555", marginBottom:2 }}>#{c.bookings?.booking_number} · {c.bookings?.booking_date}</div>
                  <div style={{ fontSize:11, color:"#555", marginBottom:2 }}>👤 Customer: {c.customer?.first_name} {c.customer?.last_name}</div>
                  <div style={{ fontSize:11, color:"#555", marginBottom:4 }}>🏪 Provider: {c.provider?.business_name||`${c.provider?.first_name} ${c.provider?.last_name}`}</div>
                  <div style={{ fontSize:12, color:"#e6821e", marginBottom:2 }}>Reason: {c.reason}</div>
                  <div style={{ fontSize:11, color:"#888", fontStyle:"italic" }}>"{c.description}"</div>
                  {c.admin_notes&&<div style={{ fontSize:11, color:"#378add", marginTop:4 }}>Decision notes: "{c.admin_notes}"</div>}
                  <div style={{ fontSize:10, color:"#444", marginTop:4 }}>{new Date(c.created_at).toLocaleString()}</div>
                </div>
                <div style={{ textAlign:"right", flexShrink:0 }}>
                  <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:800, color:"#e6821e" }}>KES {Number(c.bookings?.total_amount||0).toLocaleString()}</div>
                  <div style={{ display:"flex", flexDirection:"column", gap:4, marginTop:6 }}>
                    {c.status==="pending"&&(
                      <button onClick={()=>{ setSelected(selected===c.id?null:c.id); setAdminNotes("") }}
                        style={{ background:"#160a2e", border:"1px solid #8b5cf640", borderRadius:7, color:"#8b5cf6", fontSize:11, padding:"5px 10px", cursor:"pointer" }}>
                        Review
                      </button>
                    )}
                    {(c.status==="approved"||c.status==="rejected")&&(
                      <button onClick={()=>{ setSelected(selected===c.id?null:c.id); setAdminNotes(c.admin_notes||"") }}
                        style={{ background:"#0c1f2e", border:"1px solid #378add40", borderRadius:7, color:"#378add", fontSize:11, padding:"5px 10px", cursor:"pointer" }}>
                        {selected===c.id?"Close":"View details"}
                      </button>
                    )}
                    {c.status==="approved"&&(
                      <button onClick={()=>setChattingWith({claimId:c.id, userId:c.customer_id, name:c.customer?.first_name+" "+c.customer?.last_name, role:"customer"})}
                        style={{ background:"#071a12", border:"1px solid #1d9e7540", borderRadius:7, color:"#1d9e75", fontSize:11, padding:"5px 10px", cursor:"pointer" }}>
                        💬 Message customer
                      </button>
                    )}
                    {c.status==="approved"&&(
                      <button onClick={()=>setChattingWith({claimId:c.id, userId:c.provider_id, name:c.provider?.first_name+" "+c.provider?.last_name, role:"provider"})}
                        style={{ background:"#1a1208", border:"1px solid #e6821e40", borderRadius:7, color:"#e6821e", fontSize:11, padding:"5px 10px", cursor:"pointer" }}>
                        💬 Message provider
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {selected===c.id&&(
                <div style={{ borderTop:"1px solid #1e1e1e", paddingTop:12 }}>
                  <div style={{ fontFamily:"Syne", fontSize:13, fontWeight:700, color:"#f0ede6", marginBottom:8 }}>Review this claim</div>

                  {/* Provider penalty preview */}
                  <div style={{ background:"#1a0808", border:"1px solid #e24b4a30", borderRadius:8, padding:"0.75rem", marginBottom:12 }}>
                    <div style={{ fontSize:11, color:"#e24b4a", fontWeight:600, marginBottom:4 }}>If approved — provider consequences:</div>
                    <div style={{ fontSize:11, color:"#888" }}>• KES {Number(c.bookings?.total_amount||0).toLocaleString()} deducted from provider earnings</div>
                    <div style={{ fontSize:11, color:"#888" }}>• Penalty recorded against provider account</div>
                    <div style={{ fontSize:11, color:"#888" }}>• Provider notified immediately</div>
                    <div style={{ fontSize:11, color:"#1d9e75", marginTop:4 }}>• Customer receives voucher worth KES {Number(c.bookings?.total_amount||0).toLocaleString()} valid 30 days</div>
                  </div>

                  <div style={{ marginBottom:12 }}>
                    <label style={{ fontSize:11, color:"#666", display:"block", marginBottom:4 }}>Decision notes (required for rejection)</label>
                    <textarea value={adminNotes} onChange={e=>setAdminNotes(e.target.value)}
                      placeholder="Add notes about your decision..."
                      style={{ width:"100%", background:"#0f0f0f", border:"1px solid #222", borderRadius:8, padding:"9px 12px", color:"#f0ede6", fontSize:12, outline:"none", resize:"vertical", minHeight:60, fontFamily:"'DM Sans',sans-serif" }}/>
                  </div>

                  
                  {/* Investigation chat */}
                  <div style={{ marginBottom:12 }}>
                    <div style={{ fontSize:11, color:"#555", marginBottom:6, fontWeight:600 }}>📋 Investigation — Message parties</div>
                    <div style={{ display:"flex", gap:6, marginBottom:8 }}>
                      <button onClick={()=>setChattingWith(chattingWith?.claimId===c.id&&chattingWith?.userId===c.provider_id?null:{ claimId:c.id, userId:c.provider_id, name:c.provider?.business_name||`${c.provider?.first_name} ${c.provider?.last_name}`, role:"provider" })}
                        style={{ background:"#0c1f2e", border:"1px solid #378add40", borderRadius:7, color:"#378add", fontSize:11, padding:"5px 12px", cursor:"pointer" }}>
                        💬 Message provider
                      </button>
                      <button onClick={()=>setChattingWith(chattingWith?.claimId===c.id&&chattingWith?.userId===c.customer_id?null:{ claimId:c.id, userId:c.customer_id, name:`${c.customer?.first_name} ${c.customer?.last_name}`, role:"customer" })}
                        style={{ background:"#1a1208", border:"1px solid #e6821e40", borderRadius:7, color:"#e6821e", fontSize:11, padding:"5px 12px", cursor:"pointer" }}>
                        💬 Message customer
                      </button>
                    </div>
                    {chattingWith?.claimId===c.id&&(
                      <div style={{ height:300, marginBottom:8 }}>
                        <ChatWindow
                          claimId={c.id}
                          otherUserId={chattingWith.userId}
                          otherUserName={chattingWith.name}
                          title={`Claim investigation — ${chattingWith.role}`}
                          onClose={()=>setChattingWith(null)}
                        />
                      </div>
                    )}
                  </div>

                  <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                    <button onClick={()=>approveClaim(c)} disabled={processing}
                      style={{ background:processing?"#333":"#1d9e75", border:"none", borderRadius:8, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:12, fontWeight:700, padding:"9px 18px", cursor:processing?"not-allowed":"pointer" }}>
                      ✓ Approve & issue voucher
                    </button>
                    <button onClick={()=>issueCashRefund(c)} disabled={processing}
                      style={{ background:"#071a12", border:"1px solid #1d9e7540", borderRadius:8, color:"#1d9e75", fontSize:12, padding:"9px 14px", cursor:processing?"not-allowed":"pointer" }}>
                      💰 Cash refund (exception)
                    </button>
                    <button onClick={()=>rejectClaim(c.id)} disabled={processing}
                      style={{ background:"none", border:"1px solid #e24b4a40", borderRadius:8, color:"#e24b4a", fontSize:12, padding:"9px 14px", cursor:processing?"not-allowed":"pointer" }}>
                      Reject claim
                    </button>
                    <button onClick={()=>setSelected(null)}
                      style={{ background:"none", border:"1px solid #333", borderRadius:8, color:"#666", fontSize:12, padding:"9px 14px", cursor:"pointer" }}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* PENALTIES TAB */}
      {tab==="penalties"&&(
        <div>
          {penalties.length===0&&<div style={{ color:"#444", fontSize:13, textAlign:"center", padding:"2rem" }}>No provider penalties yet</div>}
          {penalties.map(p=>(
            <div key={p.id} style={{ background:"#111", border:`1px solid ${p.is_active?"#e24b4a20":"#1e1e1e"}`, borderRadius:10, padding:"1rem", marginBottom:8 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                <div>
                  <div style={{ fontSize:13, fontWeight:600, color:"#f0ede6", marginBottom:2 }}>
                    {p.profiles?.business_name||`${p.profiles?.first_name} ${p.profiles?.last_name}`}
                  </div>
                  <div style={{ fontSize:11, color:"#e24b4a", marginBottom:2 }}>{p.penalty_type?.replace(/_/g," ").toUpperCase()}</div>
                  <div style={{ fontSize:11, color:"#666", marginBottom:2 }}>{p.reason}</div>
                  {p.expires_at&&<div style={{ fontSize:10, color:"#555" }}>Until: {new Date(p.expires_at).toLocaleString()}</div>}
                  <div style={{ fontSize:10, color:"#444", marginTop:2 }}>{new Date(p.created_at).toLocaleString()}</div>
                </div>
                <div style={{ textAlign:"right" }}>
                  {p.amount_deducted>0&&<div style={{ fontFamily:"Syne", fontSize:13, fontWeight:700, color:"#e24b4a" }}>-KES {Number(p.amount_deducted).toLocaleString()}</div>}
                  <span style={{ fontSize:10, padding:"2px 8px", borderRadius:10, background:p.is_active?"#1a0808":"#111", color:p.is_active?"#e24b4a":"#444" }}>
                    {p.is_active?"Active":"Resolved"}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}










