import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"
import { useAuth } from "../../contexts/AuthContext"
import useIsMobile from "../../lib/useIsMobile"
import ChatWindow from "../shared/ChatWindow"
import toast from "react-hot-toast"

export default function DriverClaims() {
  const { user } = useAuth()
  const isMobile = useIsMobile()
  const [claims, setClaims] = useState([])
  const [loading, setLoading] = useState(true)
  const [chatClaim, setChatClaim] = useState(null)
  const [adminId, setAdminId] = useState(null)
  const [tab, setTab] = useState("claims")

  useEffect(() => {
    if (!user) return
    load()
    supabase.from("profiles").select("id").eq("role","admin").limit(1)
      .then(({ data }) => { if (data?.length) setAdminId(data[0].id) })
  }, [user])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from("service_claims")
      .select("*, bookings(service_name,booking_number,booking_date,total_amount)")
      .eq("driver_id", user.id)
      .order("created_at", { ascending:false })
    setClaims(data||[])
    setLoading(false)
  }

  const STATUS_COLOR = { pending:"#e6821e", under_review:"#378add", approved:"#1d9e75", rejected:"#e24b4a" }
  const STATUS_BG = { pending:"#fff8f0", under_review:"#eff6ff", approved:"#f0fdf4", rejected:"#fff5f5" }

  return (
    <div style={{ maxWidth:700, margin:"0 auto" }}>
      <div style={{ fontFamily:"Syne", fontSize:20, fontWeight:800, color:"#000000", marginBottom:4 }}>Service Claims</div>
      <div style={{ fontSize:12, color:"#777777", marginBottom:"1.5rem" }}>Claims related to your deliveries</div>

      {/* Stats */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10, marginBottom:"1.5rem" }}>
        {[
          { label:"Total claims", value:claims.length },
          { label:"Pending", value:claims.filter(c=>c.status==="pending"||c.status==="under_review").length },
          { label:"Resolved", value:claims.filter(c=>c.status==="approved"||c.status==="rejected").length },
        ].map((s,i)=>(
          <div key={i} style={{ background:"#ffffff", border:"1px solid #eeeeee", borderRadius:10, padding:"0.9rem", textAlign:"center" }}>
            <div style={{ fontFamily:"Syne", fontSize:20, fontWeight:800, color:"#000000" }}>{s.value}</div>
            <div style={{ fontSize:11, color:"#777777" }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Policy */}
      <div style={{ background:"#ffffff", border:"1px solid #eeeeee", borderRadius:10, padding:"1rem", marginBottom:"1.5rem" }}>
        <div style={{ fontSize:12, fontWeight:600, color:"#000000", marginBottom:8 }}>🛡️ Claims Policy for Drivers</div>
        <div style={{ fontSize:11, color:"#555555", lineHeight:1.7 }}>
          ⚠️ 1st claim — Warning issued<br/>
          🚫 2nd claim — 24 hour suspension<br/>
          ❌ 3rd claim — 72 hour suspension<br/>
          🔴 4th claim — Permanent ban<br/>
          💡 Respond to admin within 48 hours of notification
        </div>
      </div>

      {loading&&<div style={{ color:"#777777", fontSize:13 }}>Loading...</div>}

      {!loading&&claims.length===0&&(
        <div style={{ textAlign:"center", padding:"3rem", color:"#888888" }}>
          <div style={{ fontSize:32, marginBottom:10 }}>✅</div>
          <div style={{ fontSize:13 }}>No claims against your deliveries — keep up the great work!</div>
        </div>
      )}

      {claims.map(c=>(
        <div key={c.id} style={{ background:"#ffffff", border:"1px solid #eeeeee", borderRadius:12, padding:"1.25rem", marginBottom:12 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
            <div>
              <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:700, color:"#000000", marginBottom:2 }}>
                {c.bookings?.service_name||"Service"}
              </div>
              <div style={{ fontSize:11, color:"#777777" }}>
                #{c.bookings?.booking_number} · {c.bookings?.booking_date ? new Date(c.bookings.booking_date).toLocaleDateString() : ""}
              </div>
            </div>
            <span style={{ fontSize:11, padding:"3px 10px", borderRadius:20, background:STATUS_BG[c.status]||"#555555", color:STATUS_COLOR[c.status]||"#888", fontWeight:600 }}>
              {c.status?.replace("_"," ")}
            </span>
          </div>

          <div style={{ fontSize:12, color:"#e6821e", marginBottom:4 }}>Reason: {c.reason}</div>
          <div style={{ fontSize:12, color:"#555555", marginBottom:4, lineHeight:1.5 }}>{c.description}</div>
          {c.admin_notes&&(
            <div style={{ background:"#eff6ff", border:"1px solid #378add30", borderRadius:8, padding:"0.75rem", marginBottom:8 }}>
              <div style={{ fontSize:11, color:"#378add", fontWeight:600, marginBottom:2 }}>Admin decision:</div>
              <div style={{ fontSize:12, color:"#555555" }}>{c.admin_notes}</div>
            </div>
          )}

          <div style={{ fontSize:10, color:"#888888", marginBottom:8 }}>{new Date(c.created_at).toLocaleString()}</div>

          {(c.status==="pending"||c.status==="under_review")&&(
            <div style={{ marginTop:8 }}>
              <button onClick={()=>setChatClaim(chatClaim===c.id?null:c.id)}
                style={{ background:"#eff6ff", border:"1px solid #378add40", borderRadius:7, color:"#378add", fontSize:11, padding:"5px 12px", cursor:"pointer" }}>
                💬 {chatClaim===c.id?"Close":"Respond to admin"}
              </button>
              {chatClaim===c.id&&(
                <div style={{ height:280, marginTop:8 }}>
                  <ChatWindow
                    claimId={c.id}
                    otherUserId={adminId}
                    otherUserName="CCC Admin"
                    onClose={()=>setChatClaim(null)}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

