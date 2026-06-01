import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"
import { useAuth } from "../../contexts/AuthContext"
import useIsMobile from "../../lib/useIsMobile"
import ChatWindow from "../shared/ChatWindow"

const SC = { pending:"#e6821e", under_review:"#8b5cf6", approved:"#1d9e75", rejected:"#e24b4a" }

export default function ProviderClaims() {
  const { user } = useAuth()
  const isMobile = useIsMobile()
  const [claims, setClaims] = useState([])
  const [penalties, setPenalties] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState("claims")
  const [chatClaim, setChatClaim] = useState(null)
  const [adminId, setAdminId] = useState(null)

  useEffect(() => {
    if (!user) return
    load()
    supabase.from("profiles").select("id").eq("role","admin").limit(1)
      .then(({ data }) => { if (data?.length) setAdminId(data[0].id) })
  }, [user])

  async function load() {
    const [{ data: cls }, { data: pens }] = await Promise.all([
      supabase.from("service_claims")
        .select("*, bookings(service_name,booking_number,booking_date,total_amount)")
        .eq("provider_id", user.id)
        .order("created_at", { ascending:false }),
      supabase.from("provider_penalties")
        .select("*")
        .eq("provider_id", user.id)
        .order("created_at", { ascending:false }),
    ])
    setClaims(cls||[])
    setPenalties(pens||[])
    setLoading(false)
  }

  const totalDeducted = penalties.reduce((s,p)=>s+Number(p.amount_deducted||0),0)
  const activePenalties = penalties.filter(p=>p.is_active)

  return (
    <div>
      <div style={{ fontFamily:"Syne", fontSize:isMobile?16:18, fontWeight:800, color:"#f0ede6", marginBottom:4 }}>Service Claims</div>
      <div style={{ fontSize:12, color:"#555", marginBottom:"1.25rem" }}>Claims filed against your services</div>

      {/* Stats */}
      <div style={{ display:"grid", gridTemplateColumns:isMobile?"repeat(2,1fr)":"repeat(4,1fr)", gap:10, marginBottom:"1.5rem" }}>
        {[
          { label:"Total claims", value:claims.length, color:"#f0ede6" },
          { label:"Approved", value:claims.filter(c=>c.status==="approved").length, color:"#e24b4a" },
          { label:"Active penalties", value:activePenalties.length, color:"#e6821e" },
          { label:"Total deducted", value:`KES ${totalDeducted.toLocaleString()}`, color:"#e24b4a" },
        ].map(s=>(
          <div key={s.label} style={{ background:"#111", borderRadius:10, padding:isMobile?"0.75rem":"1rem", border:"1px solid #1e1e1e" }}>
            <div style={{ fontSize:10, color:"#555", textTransform:"uppercase", marginBottom:4 }}>{s.label}</div>
            <div style={{ fontFamily:"Syne", fontSize:isMobile?14:18, fontWeight:800, color:s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Policy reminder */}
      <div style={{ background:"#111", border:"1px solid #1e1e1e", borderRadius:12, padding:"1rem", marginBottom:"1.5rem" }}>
        <div style={{ fontFamily:"Syne", fontSize:13, fontWeight:700, color:"#f0ede6", marginBottom:8 }}>🛡️ Service Guarantee Policy</div>
        {[
          { icon:"⚠️", text:"1st approved claim — Warning + full cost deducted from earnings" },
          { icon:"🚫", text:"2nd approved claim — 7 day suspension + cost deducted" },
          { icon:"❌", text:"3rd approved claim — Permanent ban from platform" },
          { icon:"💡", text:"Dispute a claim by contacting support within 48 hours of notification" },
        ].map(item=>(
          <div key={item.text} style={{ display:"flex", gap:8, alignItems:"flex-start", marginBottom:6 }}>
            <span style={{ fontSize:13, flexShrink:0 }}>{item.icon}</span>
            <span style={{ fontSize:11, color:"#666", lineHeight:1.5 }}>{item.text}</span>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display:"flex", gap:6, marginBottom:"1.25rem" }}>
        {[
          { k:"claims", l:`Claims (${claims.length})` },
          { k:"penalties", l:`Penalties (${penalties.length})` },
        ].map(t=>(
          <button key={t.k} onClick={()=>setTab(t.k)}
            style={{ padding:"8px 16px", borderRadius:8, border:"none", fontSize:12, cursor:"pointer", background:tab===t.k?"#378add":"#111", color:tab===t.k?"#fff":"#666", fontFamily:"'DM Sans',sans-serif", fontWeight:tab===t.k?700:400 }}>
            {t.l}
          </button>
        ))}
      </div>

      {loading&&<div style={{ color:"#555", fontSize:13 }}>Loading...</div>}

      {/* Claims tab */}
      {tab==="claims"&&(
        <div>
          {!loading&&claims.length===0&&(
            <div style={{ color:"#444", fontSize:13, textAlign:"center", padding:"2rem" }}>
              <div style={{ fontSize:32, marginBottom:10 }}>✅</div>
              No claims against your services — keep up the great work!
            </div>
          )}
          {claims.map(c=>(
            <div key={c.id} style={{ background:"#111", border:`1px solid ${SC[c.status]||"#1e1e1e"}30`, borderRadius:10, padding:"1rem", marginBottom:8 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4, flexWrap:"wrap" }}>
                    <div style={{ fontSize:13, fontWeight:600, color:"#f0ede6" }}>{c.bookings?.service_name}</div>
                    <span style={{ fontSize:10, padding:"2px 8px", borderRadius:10, background:`${SC[c.status]||"#888"}20`, color:SC[c.status]||"#888" }}>{c.status?.replace("_"," ")}</span>
                  </div>
                  <div style={{ fontSize:11, color:"#555", marginBottom:2 }}>#{c.bookings?.booking_number} · {c.bookings?.booking_date}</div>
                  <div style={{ fontSize:12, color:"#e6821e", marginBottom:2 }}>Reason: {c.reason}</div>
                  {c.admin_notes&&<div style={{ fontSize:11, color:"#378add", marginTop:4 }}>Admin decision: "{c.admin_notes}"</div>}
                  <div style={{ fontSize:10, color:"#444", marginTop:4 }}>{new Date(c.created_at).toLocaleString()}</div>
                </div>
                <div style={{ textAlign:"right", flexShrink:0 }}>
                  <div style={{ fontFamily:"Syne", fontSize:13, fontWeight:700, color:"#e24b4a" }}>KES {Number(c.bookings?.total_amount||0).toLocaleString()}</div>
                </div>
              </div>
              {(c.status==="pending"||c.status==="under_review")&&(
                <div style={{ marginTop:8 }}>
                  <button onClick={()=>setChatClaim(chatClaim===c.id?null:c.id)}
                    style={{ background:"#0c1f2e", border:"1px solid #378add40", borderRadius:7, color:"#378add", fontSize:11, padding:"5px 12px", cursor:"pointer" }}>
                    💬 {chatClaim===c.id?"Close":"Respond to admin"}
                  </button>
                  {chatClaim===c.id&&(
                    <div style={{ height:280, marginTop:8 }}>
                      <ChatWindow
                        claimId={c.id}
                        otherUserId={null}
                        otherUserName="CCC Admin"
                        onClose={()=>setChatClaim(null)}
                      />
                    </div>
                  )}
                </div>
              )}
              {c.status==="approved"&&(
                <div style={{ marginTop:8 }}>
                  <div style={{ padding:"0.6rem", background:"#1a0808", borderRadius:7, fontSize:11, color:"#e24b4a", marginBottom:6 }}>
                    ❌ Claim approved — KES {Number(c.bookings?.total_amount||0).toLocaleString()} deducted. Dispute within 48 hours.
                  </div>
                  <button onClick={()=>setChatClaim(chatClaim===c.id?null:c.id)}
                    style={{ background:"#1a0808", border:"1px solid #e24b4a40", borderRadius:7, color:"#e24b4a", fontSize:11, padding:"5px 12px", cursor:"pointer" }}>
                    ⚠️ {chatClaim===c.id?"Close":"Dispute this decision"}
                  </button>
                  {chatClaim===c.id&&(
                    <div style={{ height:280, marginTop:8 }}>
                      <ChatWindow claimId={c.id} otherUserId={null} otherUserName="CCC Admin" onClose={()=>setChatClaim(null)}/>
                    </div>
                  )}
                </div>
              )}
              {c.status==="pending"&&(
                <div style={{ marginTop:8, padding:"0.6rem", background:"#1a1208", borderRadius:7, fontSize:11, color:"#e6821e" }}>
                  ⏳ Under review — our team will make a decision within 24 hours
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Penalties tab */}
      {tab==="penalties"&&(
        <div>
          {penalties.length===0&&<div style={{ color:"#444", fontSize:13, textAlign:"center", padding:"2rem" }}>No penalties recorded</div>}
          {penalties.map(p=>(
            <div key={p.id} style={{ background:"#111", border:`1px solid ${p.is_active?"#e24b4a20":"#1e1e1e"}`, borderRadius:10, padding:"1rem", marginBottom:8 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                <div>
                  <div style={{ fontSize:12, fontWeight:600, color:p.is_active?"#e24b4a":"#555", marginBottom:2 }}>{p.penalty_type?.replace(/_/g," ").toUpperCase()}</div>
                  <div style={{ fontSize:11, color:"#666", marginBottom:2 }}>{p.reason}</div>
                  {p.expires_at&&<div style={{ fontSize:10, color:"#555" }}>Until: {new Date(p.expires_at).toLocaleString()}</div>}
                  <div style={{ fontSize:10, color:"#444", marginTop:2 }}>{new Date(p.created_at).toLocaleDateString()}</div>
                </div>
                <div style={{ textAlign:"right" }}>
                  {p.amount_deducted>0&&<div style={{ fontFamily:"Syne", fontSize:13, fontWeight:700, color:"#e24b4a" }}>-KES {Number(p.amount_deducted).toLocaleString()}</div>}
                  <span style={{ fontSize:10, color:p.is_active?"#e24b4a":"#444" }}>{p.is_active?"Active":"Resolved"}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}






