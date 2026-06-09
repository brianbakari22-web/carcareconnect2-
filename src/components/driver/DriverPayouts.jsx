import useIsMobile from "../../lib/useIsMobile"
import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"
import { useAuth } from "../../contexts/AuthContext"
import toast from "react-hot-toast"

export default function DriverPayouts() {
  const isMobile = useIsMobile()
  const { user } = useAuth()
  const [payouts, setPayouts] = useState([])
  const [earnings, setEarnings] = useState(0)
  const [paid, setPaid] = useState(0)
  const [loading, setLoading] = useState(true)
  const [bankInfo, setBankInfo] = useState({ bank_name:"", bank_account_name:"", bank_account_number:"" })
  const [bankSaved, setBankSaved] = useState(false)
  const [amount, setAmount] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [savingBank, setSavingBank] = useState(false)
  const [tab, setTab] = useState("payouts")

  useEffect(() => { if (user) load() }, [user])

  async function load() {
    const [{ data: bks }, { data: pts }, { data: sens }] = await Promise.all([
      supabase.from("bookings").select("driver_earnings").eq("driver_id", user.id).eq("status", "completed"),
      supabase.from("payout_requests").select("*").eq("user_id", user.id).order("created_at", { ascending:false }),
      supabase.from("profile_sensitive").select("bank_name,bank_account_name,bank_account_number").eq("id", user.id).single()
    ])
    const totalEarned = (bks||[]).reduce((s,b)=>s+Number(b.driver_earnings||15),0)
    const totalPaid = (pts||[]).filter(p=>p.status==="paid").reduce((s,p)=>s+Number(p.amount),0)
    setEarnings(totalEarned)
    setPaid(totalPaid)
    setPayouts(pts||[])
    if (sens?.bank_name) {
      setBankInfo({ bank_name:sens.bank_name||"", bank_account_name:sens.bank_account_name||"", bank_account_number:sens.bank_account_number||"" })
      setBankSaved(true)
    }
    setLoading(false)
  }

  async function saveBank(e) {
    e.preventDefault()
    if (!bankInfo.bank_name||!bankInfo.bank_account_name||!bankInfo.bank_account_number) return toast.error("Fill in all bank details")
    setSavingBank(true)
    const { error } = await supabase.from("profile_sensitive").update({
      bank_name: bankInfo.bank_name,
      bank_account_name: bankInfo.bank_account_name,
      bank_account_number: bankInfo.bank_account_number,
    }).eq("id", user.id)
    if (error) { toast.error(error.message); setSavingBank(false); return }
    toast.success("Bank details saved")
    setBankSaved(true)
    setSavingBank(false)
  }

  async function requestPayout(e) {
    e.preventDefault()
    if (!bankSaved) return toast.error("Save your bank details first")
    const amt = Number(amount)
    const available = earnings - paid
    if (amt < 5000) return toast.error("Minimum payout is KES 5,000")
    if (amt > available) return toast.error(`Maximum available is KES ${available.toLocaleString()}`)
    setSubmitting(true)
    const { error } = await supabase.from("payout_requests").insert({
      user_id: user.id,
      amount: amt,
      bank_name: bankInfo.bank_name,
      bank_account_name: bankInfo.bank_account_name,
      bank_account_number: bankInfo.bank_account_number,
      status: "pending"
    })
    if (error) { toast.error(error.message); setSubmitting(false); return }
    toast.success("Payout request submitted!")
    setAmount("")
    setSubmitting(false)
    load()
  }

  const available = earnings - paid
  const RC = { pending:"#e6821e", approved:"#378add", paid:"#1d9e75", rejected:"#e24b4a" }
  const inp = { width:"100%", background:"#ffffff", border:"1px solid #e5e5e5", borderRadius:8, padding:"10px 12px", color:"#000000", fontSize:13, outline:"none", fontFamily:"'DM Sans',sans-serif", marginBottom:10 }
  const lbl = { fontSize:11, color:"#666", textTransform:"uppercase", letterSpacing:"0.05em", display:"block", marginBottom:4 }

  return (
    <div>
      <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"repeat(3,1fr)", gap:10, marginBottom:"1.5rem" }}>
        {[
          { label:"Total earned", value:`KES ${earnings.toLocaleString()}` },
          { label:"Available", value:`KES ${available.toLocaleString()}`, color:available>0?"#e6821e":undefined },
          { label:"Total paid out", value:`KES ${paid.toLocaleString()}`, color:"#1d9e75" },
        ].map(s=>(
          <div key={s.label} style={{ background:"#ffffff", borderRadius:10, padding:"1rem", border:"1px solid #eeeeee" }}>
            <div style={{ fontSize:11, color:"#777777", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:6 }}>{s.label}</div>
            <div style={{ fontFamily:"Syne", fontSize:22, fontWeight:800, color:s.color||"#f0ede6" }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display:"flex", gap:6, marginBottom:"1.5rem" }}>
        {[{k:"payouts",l:"Payouts"},{k:"bank",l:"Bank details"}].map(t=>(
          <button key={t.k} onClick={()=>setTab(t.k)}
            style={{ padding:"8px 16px", borderRadius:8, border:"none", fontSize:12, cursor:"pointer", background:tab===t.k?"#e6821e":"#f0f0f0", color:tab===t.k?"#fff":"#555", fontFamily:"'DM Sans',sans-serif", fontWeight:tab===t.k?700:400 }}>
            {t.l} {t.k==="bank"&&!bankSaved&&<span style={{ color:"#e24b4a", marginLeft:4 }}>⚠️</span>}
          </button>
        ))}
      </div>

      {tab==="bank"&&(
        <div style={{ background:"#ffffff", border:`1px solid ${bankSaved?"#1d9e7530":"#e6821e30"}`, borderRadius:12, padding:"1.25rem" }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:"1rem" }}>
            <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:700, color:"#000000" }}>Bank account details</div>
            {bankSaved&&<span style={{ fontSize:11, color:"#1d9e75", background:"#f0fdf4", padding:"2px 8px", borderRadius:10 }}>✓ Saved</span>}
          </div>
          {!bankSaved&&<div style={{ fontSize:12, color:"#e6821e", marginBottom:"1rem", background:"#1a1208", borderRadius:8, padding:"0.75rem" }}>Add your bank details to request payouts</div>}
          <form onSubmit={saveBank}>
            <label style={lbl}>Bank name</label>
            <input style={inp} placeholder="e.g. Equity Bank, KCB, M-Pesa Paybill" value={bankInfo.bank_name} onChange={e=>setBankInfo(b=>({...b,bank_name:e.target.value}))} required/>
            <label style={lbl}>Account holder name</label>
            <input style={inp} placeholder="Full name as on account" value={bankInfo.bank_account_name} onChange={e=>setBankInfo(b=>({...b,bank_account_name:e.target.value}))} required/>
            <label style={lbl}>Account number / M-Pesa number</label>
            <input style={inp} placeholder="Account or phone number" value={bankInfo.bank_account_number} onChange={e=>setBankInfo(b=>({...b,bank_account_number:e.target.value}))} required/>
            <button type="submit" disabled={savingBank}
              style={{ background:savingBank?"#ccc":"#e6821e", border:"none", borderRadius:9, color:savingBank?"#999":"#fff", fontFamily:"Syne,sans-serif", fontSize:13, fontWeight:700, padding:"11px 24px", cursor:savingBank?"not-allowed":"pointer" }}>
              {savingBank?"Saving...":"Save bank details"}
            </button>
          </form>
        </div>
      )}

      {tab==="payouts"&&(
        <div>
          {!bankSaved&&(
            <div style={{ background:"#fff8f0", border:"1px solid #e6821e30", borderRadius:10, padding:"1rem", marginBottom:"1.5rem", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div>
                <div style={{ fontSize:13, color:"#e6821e", fontWeight:500 }}>Bank details required</div>
                <div style={{ fontSize:11, color:"#777777", marginTop:2 }}>Add your bank details before requesting a payout</div>
              </div>
              <button onClick={()=>setTab("bank")}
                style={{ background:"#e6821e", border:"none", borderRadius:7, color:"#fff", fontSize:12, fontWeight:700, padding:"7px 14px", cursor:"pointer", fontFamily:"Syne,sans-serif", whiteSpace:"nowrap" }}>
                Add now
              </button>
            </div>
          )}

          {bankSaved&&(
            <div style={{ background:"#ffffff", border:"1px solid #1d9e7530", borderRadius:10, padding:"1rem", marginBottom:"1.5rem" }}>
              <div style={{ fontSize:11, color:"#777777", marginBottom:6 }}>Payout to</div>
              <div style={{ fontSize:13, fontWeight:500, color:"#000000" }}>{bankInfo.bank_account_name}</div>
              <div style={{ fontSize:12, color:"#777777", marginTop:2 }}>{bankInfo.bank_name} · {bankInfo.bank_account_number}</div>
              <button onClick={()=>setTab("bank")} style={{ background:"none", border:"none", color:"#e6821e", fontSize:11, cursor:"pointer", marginTop:6, padding:0, fontFamily:"'DM Sans',sans-serif" }}>
                Change bank details
              </button>
            </div>
          )}

          <div style={{ background:"#ffffff", border:"1px solid #eeeeee", borderRadius:12, padding:"1.25rem", marginBottom:"1.5rem" }}>
            <div style={{ fontSize:12, color:"#777777", marginBottom:"1rem" }}>{`Minimum KES 5,000 · Available: KES ${Number(available).toLocaleString()} · Transfer takes 2-3 business days`}</div>
            {available < 5000 ? (
            {available < 50 ? (
                Complete more deliveries to reach the KES 5,000 minimum. You need KES {Number(5000-available).toLocaleString()} more.
                Complete more deliveries to reach the KES 5,000 minimum. You need ${(50-available).toLocaleString()} more.
              </div>
            ) : (
                <input style={inp} type="number" min="5000" max={available} placeholder={`5,000 — ${Number(available).toLocaleString()}`} value={amount} onChange={e=>setAmount(e.target.value)} required/>
                {amount&&Number(amount)>=5000&&(
                <input style={inp} type="number" min="50" max={available} step="0.01" placeholder={`50.00 — ${available.toLocaleString()}`} value={amount} onChange={e=>setAmount(e.target.value)} required/>
                    You will receive: <span style={{ color:"#1d9e75", fontWeight:600 }}>KES {Number(amount).toLocaleString()}</span> to {bankInfo.bank_name}
                  <div style={{ fontSize:12, color:"#777777", marginBottom:10, marginTop:-6 }}>
                    You will receive: <span style={{ color:"#1d9e75", fontWeight:600 }}>${Number(amount).toLocaleString()}</span> to {bankInfo.bank_name}
                  </div>
                )}
                <button type="submit" disabled={submitting||!bankSaved}
                  style={{ background:submitting||!bankSaved?"#ccc":"#e6821e", border:"none", borderRadius:9, color:submitting||!bankSaved?"#999":"#fff", fontFamily:"Syne,sans-serif", fontSize:13, fontWeight:700, padding:"11px 24px", cursor:submitting||!bankSaved?"not-allowed":"pointer" }}>
                  {submitting?"Submitting...":"Request payout"}
                </button>
              </form>
            )}
          </div>

          {payouts.length > 0 && (
            <div>
              <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:700, marginBottom:10, color:"#000000" }}>Payout history</div>
              {payouts.map(p=>(
                <div key={p.id} style={{ background:"#ffffff", border:"1px solid #eeeeee", borderRadius:10, padding:"1rem", marginBottom:8, display:"flex", alignItems:"center", gap:12 }}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:14, fontWeight:500, color:"#000000" }}>${Number(p.amount).toLocaleString()}</div>
                    <div style={{ fontSize:14, fontWeight:500, color:"#000000" }}>KES {Number(p.amount).toLocaleString()}</div>
                    <div style={{ fontSize:10, color:"#888888", marginTop:2 }}>{new Date(p.created_at).toLocaleDateString()}</div>
                    {p.admin_note&&<div style={{ fontSize:11, color:"#666", marginTop:4, fontStyle:"italic" }}>"{p.admin_note}"</div>}
                  </div>
                  <span style={{ fontSize:11, padding:"3px 9px", borderRadius:20, background:`${RC[p.status]}20`, color:RC[p.status], border:`1px solid ${RC[p.status]}40`, flexShrink:0 }}>
                    {p.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}









