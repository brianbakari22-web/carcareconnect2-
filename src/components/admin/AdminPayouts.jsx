import useIsMobile from "../../lib/useIsMobile"
import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"
import toast from "react-hot-toast"
import { sendPayoutProcessed } from "../../lib/email"

export default function AdminPayouts() {
  const isMobile = useIsMobile()
  const [payouts, setPayouts] = useState([])
  const [filter, setFilter] = useState("pending")
  const [loading, setLoading] = useState(true)
  const [goPartsRequests, setGoPartsRequests] = useState([])
  const [note, setNote] = useState({})
  const [selected, setSelected] = useState([])
  const [walletBalance, setWalletBalance] = useState(null)
  const [failedPayouts, setFailedPayouts] = useState([])
  const [totalCommission, setTotalCommission] = useState(0)
  const [withdrawing, setWithdrawing] = useState(false)

  useEffect(() => {
    loadWalletData()
    supabase.from("go_parts_requests").select("*, inventory(name,price), mechanic:profiles!go_parts_requests_mechanic_id_fkey(first_name,last_name), parts_provider:profiles!go_parts_requests_provider_id_fkey(first_name,last_name,business_name)").order("created_at",{ascending:false}).limit(20).then(({data})=>setGoPartsRequests(data||[]))
  }, [])

  async function loadWalletData() {
    try {
      // Get total commission from completed transactions
      const { data: txns } = await supabase
        .from("payment_transactions")
        .select("amount, processing_fee")
        .eq("status", "completed")
        .eq("type", "collection")
      
      if(txns) {
        const total = txns.reduce((sum, t) => {
          const commission = Number(t.amount) * 0.10 // 10% commission
          return sum + commission
        }, 0)
        setTotalCommission(Math.floor(total))
      }

      // Get failed payouts
      const { data: failed } = await supabase
        .from("payment_transactions")
        .select("*, profiles!payment_transactions_provider_id_fkey(first_name,last_name)")
        .eq("status", "failed")
        .eq("type", "payout")
        .order("created_at", { ascending:false })
      
      setFailedPayouts(failed||[])
    } catch(e) { console.error(e) }
  }

  async function retryPayout(txn) {
    try {
      const { data } = await supabase.functions.invoke("intasend-payout", {
        body: {
          booking_id: txn.booking_id,
          provider_id: txn.provider_id,
          amount: txn.amount,
          phone: txn.phone,
          narrative: "Retry payout - CCC"
        }
      })
      if(data?.success) {
        toast.success("Payout retry initiated!")
        loadWalletData()
      }
    } catch(e) { toast.error(e.message) }
  }

  useEffect(() => {
    load()
    const sub = supabase.channel("admin-payouts")
      .on("postgres_changes", { event:"INSERT", schema:"public", table:"payout_requests" }, () => { load(); toast("New payout request", { icon:"🏦" }) })
      .subscribe()
    return () => supabase.removeChannel(sub)
  }, [])

  async function load() {
    const { data } = await supabase.from("payout_requests")
      .select("*, profile_public!payout_requests_user_id_fkey(first_name,last_name,business_name,role)")
      .order("created_at",{ascending:false})
    // Enrich with sensitive data for payment processing
    if (data?.length) {
      const ids = [...new Set(data.map(p=>p.user_id))]
      const { data: sens } = await supabase.from("profile_sensitive").select("id,phone,mpesa_number,id_number,kra_pin").in("id", ids)
      const sensMap = {}
      sens?.forEach(s => { sensMap[s.id] = s })
      data.forEach(p => { Object.assign(p, sensMap[p.user_id]||{}) })
    }
    setPayouts(data||[])
    setLoading(false)
  }

  async function updatePayout(id, status) {
    const { error } = await supabase.from("payout_requests").update({ status, admin_note:note[id]||null, updated_at:new Date().toISOString() }).eq("id",id)
    if (error) return toast.error(error.message)
    const payout = payouts.find(p=>p.id===id)
    if (payout) {
      const titles = {
        paid: "Money sent! 💸",
        approved: "Payout approved ✅",
        rejected: "Payout request declined",
      }
      const messages = {
        paid: `KES ${Number(payout.amount).toLocaleString()} has been sent your way. Check your account!`,
        approved: `Your payout of KES ${Number(payout.amount).toLocaleString()} has been approved and is being processed.`,
        rejected: `Your payout request of KES ${Number(payout.amount).toLocaleString()} was declined.${note[id]?" Reason: "+note[id]:""}`,
      }
      await supabase.from("notifications").insert({
        user_id: payout.user_id,
        title: titles[status] || `Payout ${status}`,
        message: messages[status] || `Your payout of KES ${Number(payout.amount).toLocaleString()} has been ${status}`,
        type: status==="paid"?"success":status==="approved"?"info":"error"
      })
    }
    toast.success(`Payout ${status}`)
    if (status === "paid" && payout) {
      const { data: sens } = await supabase.from("profile_sensitive").select("email").eq("id", payout.user_id).single()
      if (sens?.email) await sendPayoutProcessed(sens.email, payout)
    }
    load()
  }

  async function bulkApprove() {
    if (selected.length===0) return toast.error("Select payouts first")
    for (const id of selected) {
      await supabase.from("payout_requests").update({ status:"approved", updated_at:new Date().toISOString() }).eq("id",id)
      const payout = payouts.find(p=>p.id===id)
      if (payout) await supabase.from("notifications").insert({ user_id:payout.user_id, title:"Payout approved ✅", message:`Your payout of KES ${Number(payout.amount).toLocaleString()} has been approved and is being processed.`, type:"info" })
    }
    toast.success(`${selected.length} payouts approved`)
    setSelected([])
    load()
  }

  async function bulkMarkPaid() {
    if (selected.length===0) return toast.error("Select payouts first")
    for (const id of selected) {
      await supabase.from("payout_requests").update({ status:"paid", updated_at:new Date().toISOString() }).eq("id",id)
      const payout = payouts.find(p=>p.id===id)
      if (payout) {
        await supabase.from("notifications").insert({ user_id:payout.user_id, title:"Money sent! 💸", message:`KES ${Number(payout.amount).toLocaleString()} has been sent your way. Check your account!`, type:"success" })
        const { data: sens } = await supabase.from("profile_sensitive").select("email").eq("id", payout.user_id).single()
        if (sens?.email) await sendPayoutProcessed(sens.email, payout)
      }
    }
    toast.success(`${selected.length} payouts marked as paid`)
    setSelected([])
    load()
  }

  function toggleSelect(id) {
    setSelected(s => s.includes(id) ? s.filter(x=>x!==id) : [...s,id])
  }

  function selectAll() {
    const ids = filtered.map(p=>p.id)
    setSelected(s => s.length===ids.length ? [] : ids)
  }

  const filtered = filter==="all" ? payouts : payouts.filter(p=>p.status===filter)
  const RC = { pending:"#e6821e", approved:"#378add", paid:"#1d9e75", rejected:"#e24b4a" }
  const roleColor = { provider:"#378add", driver:"#1d9e75" }

  return (
    <div>
      {/* IntaSend Commission Wallet */}
      <div style={{ background:"linear-gradient(135deg,#e6821e15,#fff8f0)", border:"1px solid #e6821e30", borderRadius:12, padding:"1.25rem", marginBottom:"1.5rem" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
          <div>
            <div style={{ fontFamily:"Syne", fontSize:15, fontWeight:700 }}>IntaSend Commission Wallet</div>
            <div style={{ fontSize:12, color:"#888" }}>CCC earnings from completed bookings</div>
          </div>
          <a href="https://payment.intasend.com" target="_blank" rel="noreferrer"
            style={{ background:"#e6821e", border:"none", borderRadius:8, color:"#fff", fontSize:12, fontWeight:700, padding:"8px 14px", textDecoration:"none", cursor:"pointer" }}>
            Open IntaSend
          </a>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
          <div style={{ background:"#fff", borderRadius:8, padding:"0.75rem", border:"1px solid #e6821e20" }}>
            <div style={{ fontSize:11, color:"#888", marginBottom:4 }}>Total Commission Earned</div>
            <div style={{ fontFamily:"Syne", fontSize:20, fontWeight:800, color:"#e6821e" }}>KES {totalCommission.toLocaleString()}</div>
          </div>
          <div style={{ background:"#fff", borderRadius:8, padding:"0.75rem", border:"1px solid #e6821e20" }}>
            <div style={{ fontSize:11, color:"#888", marginBottom:4 }}>Failed Payouts</div>
            <div style={{ fontFamily:"Syne", fontSize:20, fontWeight:800, color:failedPayouts.length>0?"#e24b4a":"#1d9e75" }}>{failedPayouts.length}</div>
          </div>
        </div>
        {failedPayouts.length>0&&(
          <div style={{ marginTop:12 }}>
            <div style={{ fontSize:12, fontWeight:700, color:"#e24b4a", marginBottom:8 }}>Failed Payouts — Retry Required</div>
            {failedPayouts.map(f=>(
              <div key={f.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", background:"#fff5f5", border:"1px solid #e24b4a20", borderRadius:8, padding:"8px 12px", marginBottom:6 }}>
                <div>
                  <div style={{ fontSize:13, fontWeight:600 }}>{f.profiles?.first_name} {f.profiles?.last_name}</div>
                  <div style={{ fontSize:11, color:"#888" }}>KES {Number(f.amount).toLocaleString()} · {f.phone}</div>
                </div>
                <button onClick={()=>retryPayout(f)}
                  style={{ background:"#e6821e", border:"none", borderRadius:6, color:"#fff", fontSize:11, fontWeight:700, padding:"6px 12px", cursor:"pointer" }}>
                  Retry
                </button>
              </div>
            ))}
          </div>
        )}
      {goPartsRequests.length>0&&(
        <div style={{ background:"#f3f0ff", border:"1px solid #8b5cf640", borderRadius:12, padding:"1.25rem", marginBottom:"1.5rem" }}>
          <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:700, color:"#8b5cf6", marginBottom:10 }}>🔧 GO Service Parts Requests</div>
          {goPartsRequests.map(r=>(
            <div key={r.id} style={{ background:"#fff", borderRadius:10, padding:"0.75rem", marginBottom:8, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div>
                <div style={{ fontSize:12, fontWeight:600 }}>{r.inventory?.name} x{r.quantity}</div>
                <div style={{ fontSize:11, color:"#888" }}>Mechanic: {r.mechanic?.first_name} {r.mechanic?.last_name}</div>
                <div style={{ fontSize:11, color:"#888" }}>Supplier: {r.parts_provider?.business_name||r.parts_provider?.first_name}</div>
                <div style={{ fontSize:11, color:"#e6821e", fontWeight:600 }}>KES {Number(r.total_amount).toLocaleString()}</div>
              </div>
              <span style={{ fontSize:10, padding:"3px 10px", borderRadius:8, background:r.status==="delivered"?"#f0fdf4":r.status==="accepted"?"#eff6ff":"#fff8f0", color:r.status==="delivered"?"#1d9e75":r.status==="accepted"?"#378add":"#e6821e", fontWeight:600 }}>{r.status}</span>
            </div>
          ))}
        </div>
      )}
      </div>
      <div style={{ display:"grid", gridTemplateColumns:isMobile?"repeat(2,1fr)":"repeat(4,1fr)", gap:10, marginBottom:"1.5rem" }}>
        {[
          { label:"Pending", value:payouts.filter(p=>p.status==="pending").length, color:"#e6821e" },
          { label:"Approved", value:payouts.filter(p=>p.status==="approved").length, color:"#378add" },
          { label:"Total paid", value:`KES ${payouts.filter(p=>p.status==="paid").reduce((s,p)=>s+Number(p.amount),0).toLocaleString()}`, color:"#1d9e75" },
          { label:"Total requested", value:`KES ${payouts.reduce((s,p)=>s+Number(p.amount),0).toLocaleString()}` },
        ].map(s=>(
          <div key={s.label} style={{ background:"#f8f8f8", borderRadius:10, padding:"1rem", border:"1px solid #eeeeee" }}>
            <div style={{ fontSize:11, color:"#888", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:6 }}>{s.label}</div>
            <div style={{ fontFamily:"Syne", fontSize:20, fontWeight:800, color:s.color||"#000000" }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display:"flex", gap:6, marginBottom:"1rem", flexWrap:"wrap", alignItems:"center" }}>
        {[{k:"pending",l:"Pending"},{k:"approved",l:"Approved"},{k:"paid",l:"Paid"},{k:"rejected",l:"Rejected"},{k:"all",l:"All"}].map(t=>(
          <button key={t.k} onClick={()=>{ setFilter(t.k); setSelected([]) }}
            style={{ padding:"6px 14px", borderRadius:6, border:"none", fontSize:12, cursor:"pointer", background:filter===t.k?"#e6821e":"#f8f8f8", color:filter===t.k?"#fff":"#666", fontFamily:"'DM Sans',sans-serif" }}>
            {t.l}
          </button>
        ))}
        {filtered.length>0&&<>
          <button onClick={selectAll} style={{ padding:"6px 14px", borderRadius:6, border:"1px solid #dddddd", fontSize:12, cursor:"pointer", background:"none", color:"#888", fontFamily:"'DM Sans',sans-serif" }}>
            {selected.length===filtered.length?"Deselect all":"Select all"}
          </button>
          {selected.length>0&&<>
            <button onClick={bulkApprove} style={{ padding:"6px 14px", borderRadius:6, border:"1px solid #378add40", fontSize:12, cursor:"pointer", background:"#eff6ff", color:"#378add", fontFamily:"'DM Sans',sans-serif" }}>
              Approve {selected.length}
            </button>
            <button onClick={bulkMarkPaid} style={{ padding:"6px 14px", borderRadius:6, border:"1px solid #1d9e7540", fontSize:12, cursor:"pointer", background:"#f0fdf4", color:"#1d9e75", fontFamily:"'DM Sans',sans-serif" }}>
              Mark paid {selected.length}
            </button>
          </>}
        </>}
      </div>

      {loading&&<div style={{ color:"#888", fontSize:13 }}>Loading...</div>}
      {!loading&&filtered.length===0&&<div style={{ color:"#888", fontSize:13, textAlign:"center", padding:"2rem" }}>No payout requests</div>}

      {filtered.map(p=>(
        <div key={p.id} style={{ background:"#f8f8f8", border:`1px solid ${selected.includes(p.id)?"#e6821e40":p.status==="pending"?"#e6821e20":"#eeeeee"}`, borderRadius:10, padding:"1rem", marginBottom:10 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
            <div style={{ display:"flex", alignItems:"flex-start", gap:10 }}>
              <input type="checkbox" checked={selected.includes(p.id)} onChange={()=>toggleSelect(p.id)} style={{ marginTop:3, cursor:"pointer" }}/>
              <div>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:2 }}>
                  <div style={{ fontSize:14, fontWeight:500, color:"#000000" }}>KES {Number(p.amount).toLocaleString()}</div>
                  <span style={{ fontSize:10, padding:"2px 7px", borderRadius:10, background:`${roleColor[p.profile_public?.role]||"#cccccc"}20`, color:roleColor[p.profile_public?.role]||"#888" }}>
                    {p.profile_public?.role}
                  </span>
                </div>
                <div style={{ fontSize:12, color:"#888" }}>
                  {p.profile_public?.business_name||`${p.profile_public?.first_name} ${p.profile_public?.last_name}`}
                </div>
                <div style={{ fontSize:11, color:"#888", marginTop:2 }}>
                  🏦 {p.bank_name} · {p.bank_account_name} · {p.bank_account_number}
                </div>
                {p.mpesa_number&&<div style={{ fontSize:11, color:"#1d9e75", marginTop:2 }}>📱 M-Pesa: {p.mpesa_number}</div>}
                {p.id_number&&<div style={{ fontSize:11, color:"#888", marginTop:2 }}>🪪 ID: {p.id_number}</div>}
                {p.kra_pin&&<div style={{ fontSize:11, color:"#888", marginTop:2 }}>📋 KRA PIN: {p.kra_pin}</div>}
                <div style={{ fontSize:10, color:"#888" }}>{new Date(p.created_at).toLocaleDateString()}</div>
              </div>
            </div>
            <span style={{ fontSize:11, padding:"3px 9px", borderRadius:20, background:`${RC[p.status]}20`, color:RC[p.status], border:`1px solid ${RC[p.status]}40`, flexShrink:0 }}>
              {p.status}
            </span>
          </div>

          {p.status==="pending"&&(
            <div>
              <input placeholder="Admin note (optional)" value={note[p.id]||""} onChange={e=>setNote(n=>({...n,[p.id]:e.target.value}))}
                style={{ width:"100%", background:"#ffffff", border:"1px solid #f0f0f0", borderRadius:7, padding:"8px 10px", color:"#000000", fontSize:12, outline:"none", fontFamily:"'DM Sans',sans-serif", marginBottom:8 }}/>
              <div style={{ display:"flex", gap:8 }}>
                <button onClick={()=>updatePayout(p.id,"approved")} style={{ background:"#eff6ff", border:"1px solid #378add40", borderRadius:7, color:"#378add", fontSize:12, padding:"6px 14px", cursor:"pointer" }}>Approve</button>
                <button onClick={()=>updatePayout(p.id,"rejected")} style={{ background:"none", border:"1px solid #e24b4a40", borderRadius:7, color:"#e24b4a", fontSize:12, padding:"6px 14px", cursor:"pointer" }}>Reject</button>
              </div>
            </div>
          )}
          {p.status==="approved"&&(
            <div style={{ display:"flex", gap:8, alignItems:"center" }}>
              <input placeholder="Payment reference (optional)" value={note[p.id]||""} onChange={e=>setNote(n=>({...n,[p.id]:e.target.value}))}
                style={{ flex:1, background:"#ffffff", border:"1px solid #f0f0f0", borderRadius:7, padding:"8px 10px", color:"#000000", fontSize:12, outline:"none", fontFamily:"'DM Sans',sans-serif" }}/>
              <button onClick={()=>updatePayout(p.id,"paid")} style={{ background:"#f0fdf4", border:"1px solid #1d9e7540", borderRadius:7, color:"#1d9e75", fontSize:12, padding:"6px 14px", cursor:"pointer", whiteSpace:"nowrap" }}>Mark paid</button>
            </div>
          )}
          {p.admin_note&&<div style={{ fontSize:11, color:"#888", marginTop:8, fontStyle:"italic" }}>Note: &quot;{p.admin_note}&quot;</div>}
        </div>
      ))}
    </div>
  )
}






