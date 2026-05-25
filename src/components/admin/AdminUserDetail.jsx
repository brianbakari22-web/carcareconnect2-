import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"
import { exportUserData, downloadJSON, downloadCSV, downloadPDF } from "../../lib/dataExport"
import toast from "react-hot-toast"

const SC = { pending:"#e6821e", confirmed:"#378add", "in-progress":"#8b5cf6", completed:"#1d9e75", cancelled:"#e24b4a" }

export default function AdminUserDetail({ userId, onBack }) {
  const [profile, setProfile] = useState(null)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState("overview")
  const [exporting, setExporting] = useState(false)

  useEffect(() => { if (userId) load() }, [userId])

  async function load() {
    setLoading(true)
    const [{ data: prof }, exportedData] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).single(),
      exportUserData(userId)
    ])
    setProfile(prof)
    setData(exportedData)
    setLoading(false)
  }

  async function handleExport() {
    setExporting(true)
    try {
      downloadPDF(data, `user-${userId}-data-${new Date().toISOString().split("T")[0]}.pdf`)
      toast.success("Data exported")
    } catch(err) { toast.error(err.message) }
    finally { setExporting(false) }
  }

  if (loading) return <div style={{ color:"#555", fontSize:13, padding:"2rem" }}>Loading user data...</div>
  if (!profile) return <div style={{ color:"#e24b4a", fontSize:13 }}>User not found</div>

  const RC = { customer:"#e6821e", provider:"#378add", driver:"#1d9e75", admin:"#8b5cf6" }
  const totalSpent = data?.payments?.reduce((s,p)=>s+Number(p.amount||0),0)||0
  const completedBookings = data?.bookings?.filter(b=>b.status==="completed").length||0

  const tabs = [
    {k:"overview",l:"Overview"},
    {k:"bookings",l:`Bookings (${data?.bookings?.length||0})`},
    {k:"payments",l:`Payments (${data?.payments?.length||0})`},
    {k:"reviews",l:`Reviews (${data?.reviews?.length||0})`},
    {k:"tickets",l:`Tickets (${data?.support_tickets?.length||0})`},
    {k:"activity",l:`Notifications (${data?.notifications?.length||0})`},
  ]

  return (
    <div>
      <button onClick={onBack} style={{ background:"none", border:"none", color:"#666", cursor:"pointer", fontSize:13, marginBottom:"1.5rem", fontFamily:"'DM Sans',sans-serif", padding:0 }}>
        ← Back to users
      </button>

      <div style={{ background:"#111", border:"1px solid #1e1e1e", borderRadius:12, padding:"1.5rem", marginBottom:"1.25rem" }}>
        <div style={{ display:"flex", alignItems:"center", gap:16, marginBottom:"1.25rem" }}>
          <div style={{ width:56, height:56, borderRadius:14, background:`${RC[profile.role]||"#333"}20`, border:`2px solid ${RC[profile.role]||"#333"}40`, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"Syne", fontSize:20, fontWeight:800, color:RC[profile.role]||"#888", flexShrink:0 }}>
            {profile.first_name?.[0]}{profile.last_name?.[0]}
          </div>
          <div style={{ flex:1 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4, flexWrap:"wrap" }}>
              <div style={{ fontFamily:"Syne", fontSize:18, fontWeight:800, color:"#f0ede6" }}>{profile.business_name||`${profile.first_name} ${profile.last_name}`}</div>
              {profile.business_name&&<div style={{ fontSize:12, color:"#666" }}>{profile.first_name} {profile.last_name}</div>}
              <span style={{ fontSize:11, padding:"2px 8px", borderRadius:10, background:`${RC[profile.role]||"#333"}20`, color:RC[profile.role]||"#888" }}>{profile.role}</span>
              {profile.is_verified&&<span style={{ fontSize:11, color:"#1d9e75", background:"#071a12", padding:"2px 8px", borderRadius:10 }}>✓ Verified</span>}
              {!profile.is_active&&<span style={{ fontSize:11, color:"#e24b4a", background:"#1a0808", padding:"2px 8px", borderRadius:10 }}>Suspended</span>}
            </div>
            <div style={{ fontSize:12, color:"#555" }}>
              {data?.profile?.email&&`${data.profile.email} · `}
              {data?.profile?.phone&&`${data.profile.phone} · `}
              {profile.city&&`${profile.city} · `}
              Joined {new Date(profile.created_at).toLocaleDateString()}
            </div>
          </div>
          <div style={{ display:"flex", gap:8, flexShrink:0 }}>
            <button onClick={handleExport} disabled={exporting}
              style={{ background:"#071a12", border:"1px solid #1d9e7540", borderRadius:8, color:"#1d9e75", fontSize:12, padding:"8px 14px", cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}>
              {exporting?"Exporting...":"⬇ Export data"}
            </button>
            <button onClick={()=>downloadCSV(data?.bookings||[], `user-${userId}-bookings.csv`)}
              style={{ background:"#0c1f2e", border:"1px solid #378add40", borderRadius:8, color:"#378add", fontSize:12, padding:"8px 14px", cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}>
              ⬇ CSV
            </button>
          </div>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10 }}>
          {[
            { label:"Total bookings", value:data?.bookings?.length||0 },
            { label:"Completed", value:completedBookings, color:"#1d9e75" },
            { label:"Total spent", value:`$${totalSpent.toFixed(2)}`, color:"#e6821e" },
            { label:"Loyalty points", value:(data?.loyalty?.points||0).toLocaleString(), color:"#8b5cf6" },
          ].map(s=>(
            <div key={s.label} style={{ background:"#0f0f0f", borderRadius:8, padding:"0.9rem", border:"1px solid #1a1a1a" }}>
              <div style={{ fontSize:10, color:"#555", textTransform:"uppercase", marginBottom:4 }}>{s.label}</div>
              <div style={{ fontFamily:"Syne", fontSize:18, fontWeight:800, color:s.color||"#f0ede6" }}>{s.value}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display:"flex", gap:6, marginBottom:"1.25rem", flexWrap:"wrap" }}>
        {tabs.map(t=>(
          <button key={t.k} onClick={()=>setTab(t.k)}
            style={{ padding:"7px 14px", borderRadius:7, border:"none", fontSize:12, cursor:"pointer", background:tab===t.k?"#8b5cf6":"#111", color:tab===t.k?"#fff":"#666", fontFamily:"'DM Sans',sans-serif", fontWeight:tab===t.k?700:400 }}>
            {t.l}
          </button>
        ))}
      </div>

      {tab==="overview"&&(
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
          <div style={{ background:"#111", border:"1px solid #1e1e1e", borderRadius:12, padding:"1.25rem" }}>
            <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:700, marginBottom:"1rem", color:"#f0ede6" }}>Profile info</div>
            {[
              { label:"Role", value:profile.role },
              { label:"Email", value:data?.profile?.email||"—" },
              { label:"Phone", value:data?.profile?.phone||"—" },
              { label:"City", value:profile.city||"—" },
              { label:"Referral code", value:profile.referral_code||"—" },
              { label:"Account status", value:profile.is_active?"Active":"Suspended" },
              { label:"Verified", value:profile.is_verified?"Yes":"No" },
              { label:"Joined", value:new Date(profile.created_at).toLocaleDateString() },
            ].map(f=>(
              <div key={f.label} style={{ display:"flex", justifyContent:"space-between", padding:"7px 0", borderBottom:"1px solid #1a1a1a", fontSize:12 }}>
                <span style={{ color:"#555" }}>{f.label}</span>
                <span style={{ color:"#f0ede6", fontWeight:500 }}>{f.value}</span>
              </div>
            ))}
          </div>
          <div style={{ background:"#111", border:"1px solid #1e1e1e", borderRadius:12, padding:"1.25rem" }}>
            <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:700, marginBottom:"1rem", color:"#f0ede6" }}>Recent bookings</div>
            {data?.bookings?.slice(0,6).map(b=>(
              <div key={b.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"7px 0", borderBottom:"1px solid #1a1a1a" }}>
                <div>
                  <div style={{ fontSize:12, color:"#f0ede6" }}>{b.service_name}</div>
                  <div style={{ fontSize:10, color:"#444" }}>{b.booking_date}</div>
                </div>
                <div style={{ textAlign:"right" }}>
                  <span style={{ fontSize:10, padding:"1px 7px", borderRadius:10, background:`${SC[b.status]||"#888"}20`, color:SC[b.status]||"#888" }}>{b.status}</span>
                  <div style={{ fontSize:11, color:"#e6821e", marginTop:2 }}>${Number(b.total_amount).toFixed(2)}</div>
                </div>
              </div>
            ))}
            {!data?.bookings?.length&&<div style={{ color:"#444", fontSize:12 }}>No bookings</div>}
          </div>
        </div>
      )}

      {tab==="bookings"&&(
        <div>
          {data?.bookings?.map(b=>(
            <div key={b.id} style={{ background:"#111", border:"1px solid #1e1e1e", borderRadius:10, padding:"1rem", marginBottom:8 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                <div>
                  <div style={{ fontSize:13, fontWeight:500, color:"#f0ede6", marginBottom:2 }}>{b.service_name}</div>
                  <div style={{ fontSize:11, color:"#555" }}>#{b.booking_number} · {b.booking_date} · {b.booking_time?.slice(0,5)}</div>
                </div>
                <div style={{ textAlign:"right" }}>
                  <span style={{ fontSize:10, padding:"2px 8px", borderRadius:10, background:`${SC[b.status]||"#888"}20`, color:SC[b.status]||"#888" }}>{b.status}</span>
                  <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:700, color:"#e6821e", marginTop:4 }}>${Number(b.total_amount).toFixed(2)}</div>
                </div>
              </div>
            </div>
          ))}
          {!data?.bookings?.length&&<div style={{ color:"#444", fontSize:13, textAlign:"center", padding:"2rem" }}>No bookings</div>}
        </div>
      )}

      {tab==="payments"&&(
        <div>
          {data?.payments?.map(p=>(
            <div key={p.id} style={{ background:"#111", border:"1px solid #1e1e1e", borderRadius:10, padding:"1rem", marginBottom:8, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div>
                <div style={{ fontSize:13, color:"#f0ede6", marginBottom:2 }}>{p.payment_method||"Payment"}</div>
                <div style={{ fontSize:11, color:"#555" }}>{new Date(p.created_at).toLocaleDateString()}</div>
              </div>
              <div style={{ textAlign:"right" }}>
                <div style={{ fontFamily:"Syne", fontSize:16, fontWeight:700, color:"#e6821e" }}>${Number(p.amount).toFixed(2)}</div>
                <div style={{ fontSize:10, color:p.status==="paid"?"#1d9e75":"#e6821e", marginTop:2 }}>{p.status}</div>
              </div>
            </div>
          ))}
          {!data?.payments?.length&&<div style={{ color:"#444", fontSize:13, textAlign:"center", padding:"2rem" }}>No payments</div>}
        </div>
      )}

      {tab==="reviews"&&(
        <div>
          {data?.reviews?.map(r=>(
            <div key={r.id} style={{ background:"#111", border:"1px solid #1e1e1e", borderRadius:10, padding:"1rem", marginBottom:8 }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
                <div style={{ fontSize:12, color:"#555" }}>{new Date(r.created_at).toLocaleDateString()}</div>
                <div style={{ display:"flex", gap:1 }}>
                  {[1,2,3,4,5].map(s=><span key={s} style={{ color:s<=r.provider_rating?"#e6821e":"#333", fontSize:14 }}>★</span>)}
                </div>
              </div>
              {r.provider_review&&<div style={{ fontSize:12, color:"#888", lineHeight:1.5 }}>"{r.provider_review}"</div>}
            </div>
          ))}
          {!data?.reviews?.length&&<div style={{ color:"#444", fontSize:13, textAlign:"center", padding:"2rem" }}>No reviews</div>}
        </div>
      )}

      {tab==="tickets"&&(
        <div>
          {data?.support_tickets?.map(t=>(
            <div key={t.id} style={{ background:"#111", border:"1px solid #1e1e1e", borderRadius:10, padding:"1rem", marginBottom:8 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                <div>
                  <div style={{ fontSize:13, fontWeight:500, color:"#f0ede6", marginBottom:2 }}>{t.subject}</div>
                  <div style={{ fontSize:11, color:"#555" }}>#{t.ticket_number} · {t.category} · {new Date(t.created_at).toLocaleDateString()}</div>
                </div>
                <span style={{ fontSize:10, padding:"2px 8px", borderRadius:10, background:"#1a1a1a", color:"#888" }}>{t.status}</span>
              </div>
            </div>
          ))}
          {!data?.support_tickets?.length&&<div style={{ color:"#444", fontSize:13, textAlign:"center", padding:"2rem" }}>No support tickets</div>}
        </div>
      )}

      {tab==="activity"&&(
        <div>
          {data?.notifications?.slice(0,30).map(n=>(
            <div key={n.id} style={{ display:"flex", gap:12, padding:"0.75rem 0", borderBottom:"1px solid #1a1a1a", alignItems:"flex-start" }}>
              <div style={{ width:8, height:8, borderRadius:"50%", background:n.type==="success"?"#1d9e75":n.type==="error"?"#e24b4a":"#e6821e", flexShrink:0, marginTop:5 }}/>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:12, color:"#f0ede6", marginBottom:2 }}>{n.title}</div>
                <div style={{ fontSize:11, color:"#666" }}>{n.message}</div>
              </div>
              <div style={{ fontSize:10, color:"#444", flexShrink:0 }}>{new Date(n.created_at).toLocaleDateString()}</div>
            </div>
          ))}
          {!data?.notifications?.length&&<div style={{ color:"#444", fontSize:13, textAlign:"center", padding:"2rem" }}>No activity</div>}
        </div>
      )}
    </div>
  )
}

