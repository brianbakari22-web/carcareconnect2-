import useIsMobile from "../../lib/useIsMobile"
import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"
import toast from "react-hot-toast"

export default function AdminProviders() {
  const isMobile = useIsMobile()
  const [providers, setProviders] = useState([])
  const [services, setServices] = useState({})
  const [earnings, setEarnings] = useState({})
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState("all")

  useEffect(() => { load() }, [])

  async function load() {
    const [{ data: ps }, { data: svcs }, { data: bks }] = await Promise.all([
      supabase.from("profiles").select("*").eq("role","provider").order("created_at",{ascending:false}),
      supabase.from("services").select("provider_id,id,is_active"),
      supabase.from("bookings").select("provider_id,provider_earnings,status")
    ])
    setProviders(ps||[])
    const svcMap = {}
    ;(svcs||[]).forEach(s=>{ if (!svcMap[s.provider_id]) svcMap[s.provider_id]={total:0,active:0}; svcMap[s.provider_id].total++; if(s.is_active) svcMap[s.provider_id].active++ })
    setServices(svcMap)
    const earnMap = {}
    ;(bks||[]).filter(b=>b.status==="completed").forEach(b=>{ earnMap[b.provider_id]=(earnMap[b.provider_id]||0)+Number(b.provider_earnings||0) })
    setEarnings(earnMap)
    setLoading(false)
  }

  async function markCommissionPaid(providerId, amount) {
    await supabase.from("profiles").update({
      cash_commission_balance: 0,
      last_commission_paid_at: new Date().toISOString(),
      is_active: true
    }).eq("id", providerId)
    toast.success("KES " + amount.toLocaleString() + " commission marked as paid")
    load()
  }

  async function toggleVerified(id, is_verified) {
    const newStatus = !is_verified
    await supabase.from("profiles").update({ 
      is_verified: newStatus,
      verification_status: newStatus ? "approved" : "pending",
      verified_at: newStatus ? new Date().toISOString() : null,
    }).eq("id",id)
    
    await supabase.from("notifications").insert({
      user_id: id,
      title: newStatus ? "You\'re Verified! ✓" : "Verification Removed",
      message: newStatus 
        ? "Your provider account has been verified. You now appear in customer search results with a verified badge!" 
        : "Your verification status has been changed. Please contact support if you have questions.",
      type: newStatus ? "success" : "warning",
    })
    
    toast.success(is_verified?"Verification removed":"Provider verified ✓")
    load()
  }

  async function rejectVerification(id) {
    const reason = prompt("Reason for rejection (will be sent to provider):")
    if (!reason) return
    
    await supabase.from("profiles").update({ 
      verification_status: "rejected",
      verification_notes: reason,
    }).eq("id",id)
    
    await supabase.from("notifications").insert({
      user_id: id,
      title: "Verification Update Required",
      message: "Your verification was not approved: " + reason + ". Please update your profile and documents, then contact support.",
      type: "warning",
    })
    
    toast.success("Provider notified of rejection")
    load()
  }

  async function toggleActive(id, is_active) {
    await supabase.from("profiles").update({ is_active:!is_active }).eq("id",id)
    toast.success(is_active?"Provider suspended":"Provider activated")
    load()
  }

  const filtered = providers.filter(p=>
    (typeFilter==="all"||p.provider_type===typeFilter) &&
    `${p.first_name} ${p.last_name} ${p.business_name||""} ${p.city||""}`.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <div style={{ display:"grid", gridTemplateColumns:isMobile?"repeat(2,1fr)":"repeat(3,1fr)", gap:10, marginBottom:"1.5rem" }}>
        {[
          { label:"Total providers", value:providers.length },
          { label:"Verified", value:providers.filter(p=>p.is_verified).length, color:"#1d9e75" },
          { label:"Suspended", value:providers.filter(p=>!p.is_active).length, color:providers.filter(p=>!p.is_active).length>0?"#e24b4a":undefined },
        ].map(s=>(
          <div key={s.label} style={{ background:"#f8f8f8", borderRadius:10, padding:"1rem", border:"1px solid #eeeeee" }}>
            <div style={{ fontSize:11, color:"#888", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:6 }}>{s.label}</div>
            <div style={{ fontFamily:"Syne", fontSize:22, fontWeight:800, color:s.color||"#000000" }}>{s.value}</div>
          </div>
        ))}
      </div>

      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search providers..."
        style={{ width:"100%", background:"#f8f8f8", border:"1px solid #f0f0f0", borderRadius:8, padding:"9px 12px", color:"#000000", fontSize:13, outline:"none", fontFamily:"'DM Sans',sans-serif", marginBottom:"1rem" }}/>

      <div style={{ display:"flex", gap:6, marginBottom:"1rem", flexWrap:"wrap" }}>
        {["all","garage","parts_dealer","accessories_shop","tyre_shop","auto_electrician","car_wash","panel_beater","auto_glass"].map(t=>(
          <button key={t} onClick={()=>setTypeFilter(t)}
            style={{ padding:"5px 12px", borderRadius:7, border:"none", fontSize:11, cursor:"pointer", background:typeFilter===t?"#8b5cf6":"#f8f8f8", color:typeFilter===t?"#fff":"#666" }}>
            {t==="all"?"All types":t.replace(/_/g," ")}
          </button>
        ))}
      </div>
      {loading&&<div style={{ color:"#888", fontSize:13 }}>Loading...</div>}
      {filtered.map(p=>(
        <div key={p.id} style={{ background:"#f8f8f8", border:`1px solid ${!p.is_active?"#e24b4a20":"#eeeeee"}`, borderRadius:10, padding:"1rem", marginBottom:8 }}>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <div style={{ width:44, height:44, borderRadius:10, background:"#eff6ff", border:"1px solid #378add30", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"Syne", fontSize:16, fontWeight:800, color:"#378add", flexShrink:0 }}>
              {(p.business_name||p.first_name||"?")[0].toUpperCase()}
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap", marginBottom:2 }}>
                <div style={{ fontSize:13, fontWeight:600, color:p.is_active?"#000000":"#555" }}>{p.business_name||`${p.first_name} ${p.last_name}`}</div>
                {p.is_verified&&<span style={{ fontSize:10, color:"#1d9e75", background:"#f0fdf4", padding:"1px 6px", borderRadius:10 }}>✓ Verified</span>}
                {!p.is_verified&&p.verification_status==="rejected"&&<span style={{ fontSize:10, color:"#e24b4a", background:"#fff5f5", padding:"1px 6px", borderRadius:10 }}>Rejected</span>}
                {!p.is_verified&&p.verification_status==="pending"&&<span style={{ fontSize:10, color:"#e6821e", background:"#fff8f0", padding:"1px 6px", borderRadius:10 }}>Pending review</span>}
                {!p.is_active&&<span style={{ fontSize:10, color:"#e24b4a", background:"#fff5f5", padding:"1px 6px", borderRadius:10 }}>Suspended</span>}
                {p.provider_type&&<span style={{ fontSize:10, color:"#8b5cf6", background:"#f5f3ff", padding:"1px 6px", borderRadius:10 }}>{p.provider_type.replace(/_/g," ")}</span>}
              </div>
              <div style={{ fontSize:11, color:"#888" }}>
                {p.business_name&&`${p.first_name} ${p.last_name} · `}
                {p.city&&`${p.city} · `}
                {services[p.id]?.active||0} services · KES {Number(earnings[p.id]||0).toLocaleString()} earned
              </div>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:6, alignItems:"flex-end", flexShrink:0 }}>
              {p.cash_commission_balance>0&&(
                <div style={{ background:"#fff5f5", border:"1px solid #e24b4a30", borderRadius:8, padding:"4px 8px", textAlign:"center" }}>
                  <div style={{ fontSize:10, color:"#e24b4a", fontWeight:700 }}>💰 Cash Commission Due</div>
                  <div style={{ fontSize:12, fontWeight:800, color:"#e24b4a" }}>KES {Number(p.cash_commission_balance).toLocaleString()}</div>
                  {p.cash_commission_due_date&&<div style={{ fontSize:9, color:"#888" }}>Due: {new Date(p.cash_commission_due_date).toLocaleDateString()}</div>}
                  <button onClick={()=>{ if(window.confirm("Mark KES "+Number(p.cash_commission_balance).toLocaleString()+" as paid by "+((p.business_name||p.first_name))+"?")) markCommissionPaid(p.id, p.cash_commission_balance) }}
                    style={{ marginTop:4, background:"#1d9e75", border:"none", borderRadius:6, color:"#fff", fontSize:10, fontWeight:700, padding:"3px 8px", cursor:"pointer", width:"100%" }}>
                    ✓ Mark Paid
                  </button>
                </div>
              )}
              {p.cash_commission_strikes>0&&(
                <div style={{ fontSize:10, color:"#e24b4a" }}>⚠️ {p.cash_commission_strikes} strike{p.cash_commission_strikes>1?"s":""}</div>
              )}
              <button onClick={()=>setSelected(selected===p.id?null:p.id)}
                style={{ background:"none", border:"1px solid #dddddd", borderRadius:7, color:"#888", fontSize:11, padding:"5px 10px", cursor:"pointer" }}>
                {selected===p.id?"Close":"Manage"}
              </button>
            </div>
          </div>
          {selected===p.id&&(
            <div style={{ marginTop:10, paddingTop:10, borderTop:"1px solid #eeeeee", display:"flex", gap:8, flexWrap:"wrap" }}>
              <button onClick={()=>toggleVerified(p.id,p.is_verified)} style={{ background:"#f0fdf4", border:"1px solid #1d9e7540", borderRadius:7, color:"#1d9e75", fontSize:12, padding:"6px 12px", cursor:"pointer" }}>
                {p.is_verified?"Remove verification":"✓ Verify provider"}
              </button>
              {!p.is_verified&&(
                <button onClick={()=>rejectVerification(p.id)} style={{ background:"#fff5f5", border:"1px solid #e24b4a40", borderRadius:7, color:"#e24b4a", fontSize:12, padding:"6px 12px", cursor:"pointer" }}>
                  ✗ Reject verification
                </button>
              )}
              <button onClick={()=>toggleActive(p.id,p.is_active)} style={{ background:p.is_active?"#fff5f5":"#f0fdf4", border:`1px solid ${p.is_active?"#e24b4a40":"#1d9e7540"}`, borderRadius:7, color:p.is_active?"#e24b4a":"#1d9e75", fontSize:12, padding:"6px 12px", cursor:"pointer" }}>
                {p.is_active?"Suspend":"Activate"}
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}




