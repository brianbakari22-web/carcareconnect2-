import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"

export default function AdminAIMonitor() {
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(true)
  const [chatInput, setChatInput] = useState("")
  const [chatMessages, setChatMessages] = useState([])
  const [chatLoading, setChatLoading] = useState(false)

  useEffect(() => { scanPlatform() }, [])

  async function scanPlatform() {
    setLoading(true)
    try {
      const [
        { data: stuckBookings },
        { data: pendingClaims },
        { data: pendingTickets },
        { data: pendingVerifications },
        { data: pendingListings },
        { data: expiredVouchers },
        { data: completedUnpaid },
        { data: pendingPayouts },
        { data: todayBookings },
        { data: todayUsers },
        { data: goRequests },
        { count: pendingInspections },
      ] = await Promise.all([
        supabase.from("bookings").select("id,service_name,booking_number,created_at,customer_id").eq("status","pending").lt("created_at", new Date(Date.now()-24*60*60*1000).toISOString()),
        supabase.from("service_claims").select("id,reason,created_at").eq("status","pending"),
        supabase.from("support_tickets").select("id,subject,created_at").eq("status","open"),
        supabase.from("profiles").select("id,first_name,last_name,role").eq("role","driver").eq("is_verified",false),
        supabase.from("marketplace_listings").select("id,title,created_at").eq("status","pending"),
        supabase.from("vouchers").select("id,code,expires_at").eq("is_used",false).lt("expires_at", new Date(Date.now()+3*24*60*60*1000).toISOString()).gt("expires_at", new Date().toISOString()),
        supabase.from("bookings").select("id,service_name,total_amount,platform_commission").eq("status","completed").neq("payment_status","paid"),
        supabase.from("payout_requests").select("id,amount,created_at").eq("status","pending"),
        supabase.from("bookings").select("id").gte("created_at", new Date().toISOString().split("T")[0]),
        supabase.from("profiles").select("id").gte("created_at", new Date().toISOString().split("T")[0]),
        supabase.from("go_service_requests").select("id,status").eq("status","pending"),
        supabase.from("inspection_requests").select("id",{count:"exact",head:true}).eq("status","pending"),
      ])

      const platformData = {
        stuck_bookings: stuckBookings?.length||0,
        stuck_booking_details: stuckBookings?.slice(0,5)||[],
        pending_claims: pendingClaims?.length||0,
        pending_support: pendingTickets?.length||0,
        unverified_drivers: pendingVerifications?.length||0,
        pending_listings: pendingListings?.length||0,
        expiring_vouchers: expiredVouchers?.length||0,
        completed_unpaid: completedUnpaid?.length||0,
        unpaid_amount: completedUnpaid?.reduce((s,b)=>s+Number(b.platform_commission||0),0)||0,
        pending_payouts: pendingPayouts?.length||0,
        todays_bookings: todayBookings?.length||0,
        todays_new_users: todayUsers?.length||0,
        active_go_requests: goRequests?.length||0,
        pending_inspections: pendingInspections||0,
      }

      const prompt = `You are the Car Care Connect AI Admin Monitor. Analyze this platform data and give a CONCISE priority report.

PLATFORM STATUS RIGHT NOW:
- Stuck bookings (pending >24hrs): ${platformData.stuck_bookings}
- Pending service claims: ${platformData.pending_claims}
- Unanswered support tickets: ${platformData.pending_support}
- Unverified drivers: ${platformData.unverified_drivers}
- Marketplace listings pending approval: ${platformData.pending_listings}
- Completed bookings not yet paid out: ${platformData.completed_unpaid} (KES ${platformData.unpaid_amount.toLocaleString()})
- Pending payout requests: ${platformData.pending_payouts}
- Expiring vouchers (3 days): ${platformData.expiring_vouchers}
- Active GO emergency requests: ${platformData.active_go_requests}
- Pending vehicle inspections: ${platformData.pending_inspections}
- Today new bookings: ${platformData.todays_bookings}
- Today new users: ${platformData.todays_new_users}

Give a SHORT report with:
1. 🔴 CRITICAL (needs action NOW)
2. 🟡 WARNING (needs action today)
3. 🟢 TODAY (positive updates)
4. 💡 TOP RECOMMENDATION

Be direct, use bullet points, max 200 words.`

      const res = await fetch("https://gcnefnqtjxtqbhynyoxe.supabase.co/functions/v1/ai-chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdjbmVmbnF0anh0cWJoeW55b3hlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2MDg0MzIsImV4cCI6MjA5NTE4NDQzMn0.Ybyce3psBj2I-hdoF95H5UAklr6hsgQi-mciI9uMIgc"
        },
        body: JSON.stringify({
          system: "You are the Car Care Connect AI Admin Monitor. Be concise, direct and actionable. Always respond in plain text with emoji indicators.",
          messages: [{ role:"user", content:prompt }]
        })
      })
      const data = await res.json()
      const text = data.text || data.content?.[0]?.text || "Unable to generate report"
      setReport({ text, platformData, generatedAt: new Date().toLocaleString() })
      setChatMessages([{ role:"assistant", content:text }])
    } catch(e) {
      setReport({ text:"Could not connect to AI monitor. Check your connection.", platformData:{}, generatedAt:new Date().toLocaleString() })
    }
    setLoading(false)
  }

  async function sendChat(e) {
    e.preventDefault()
    if (!chatInput.trim() || chatLoading) return
    const text = chatInput.trim()
    setChatInput("")
    const msgs = [...chatMessages, { role:"user", content:text }]
    setChatMessages(msgs)
    setChatLoading(true)
    try {
      const res = await fetch("https://gcnefnqtjxtqbhynyoxe.supabase.co/functions/v1/ai-chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdjbmVmbnF0anh0cWJoeW55b3hlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2MDg0MzIsImV4cCI6MjA5NTE4NDQzMn0.Ybyce3psBj2I-hdoF95H5UAklr6hsgQi-mciI9uMIgc"
        },
        body: JSON.stringify({
          system: "You are the Car Care Connect AI Admin Monitor with full platform knowledge. Platform data: " + JSON.stringify(report?.platformData||{}),
          messages: msgs.map(m=>({ role:m.role, content:m.content }))
        })
      })
      const data = await res.json()
      const reply = data.text || data.content?.[0]?.text || "Sorry, could not process."
      setChatMessages(prev=>[...prev, { role:"assistant", content:reply }])
    } catch(e) {
      setChatMessages(prev=>[...prev, { role:"assistant", content:"Connection error. Please try again." }])
    }
    setChatLoading(false)
  }

  return (
    <div style={{ background:"#111", border:"1px solid #8b5cf640", borderRadius:14, marginBottom:"1.5rem", overflow:"hidden" }}>
      <div onClick={()=>setOpen(o=>!o)} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"1rem 1.25rem", cursor:"pointer", background:"linear-gradient(135deg,#160a2e,#0a0a0a)" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:36, height:36, borderRadius:"50%", background:"#8b5cf6", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18 }}>✦</div>
          <div>
            <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:800, color:"#8b5cf6" }}>AI Admin Monitor</div>
            <div style={{ fontSize:10, color:"#555" }}>{loading?"Scanning platform...":report?.generatedAt?"Last scan: "+report.generatedAt:"Ready"}</div>
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <button onClick={e=>{ e.stopPropagation(); scanPlatform() }} style={{ background:"#160a2e", border:"1px solid #8b5cf640", borderRadius:7, color:"#8b5cf6", fontSize:11, padding:"4px 10px", cursor:"pointer" }}>
            🔄 Refresh
          </button>
          <span style={{ color:"#555", fontSize:16 }}>{open?"▲":"▼"}</span>
        </div>
      </div>

      {open&&(
        <div style={{ padding:"1.25rem" }}>
          {loading&&(
            <div style={{ textAlign:"center", padding:"2rem" }}>
              <div style={{ fontSize:28, marginBottom:8 }}>✦</div>
              <div style={{ fontSize:13, color:"#8b5cf6" }}>AI scanning platform...</div>
              <div style={{ fontSize:11, color:"#555", marginTop:4 }}>Checking all systems and data</div>
            </div>
          )}
          {!loading&&report&&(
            <>
              <div style={{ background:"#0f0f0f", borderRadius:10, padding:"1rem", marginBottom:"1rem", whiteSpace:"pre-wrap", fontSize:13, color:"#f0ede6", lineHeight:1.8 }}>
                {report.text}
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8, marginBottom:"1rem" }}>
                {[
                  { l:"Stuck bookings", v:report.platformData.stuck_bookings, c:report.platformData.stuck_bookings>0?"#e24b4a":"#1d9e75" },
                  { l:"Pending claims", v:report.platformData.pending_claims, c:report.platformData.pending_claims>0?"#e6821e":"#1d9e75" },
                  { l:"Support tickets", v:report.platformData.pending_support, c:report.platformData.pending_support>0?"#e6821e":"#1d9e75" },
                  { l:"Unpaid (KES)", v:Number(report.platformData.unpaid_amount||0).toLocaleString(), c:"#e6821e" },
                ].map(s=>(
                  <div key={s.l} style={{ background:"#111", borderRadius:8, padding:"0.6rem", border:"1px solid #1e1e1e", textAlign:"center" }}>
                    <div style={{ fontFamily:"Syne", fontSize:16, fontWeight:800, color:s.c }}>{s.v}</div>
                    <div style={{ fontSize:9, color:"#555", marginTop:2 }}>{s.l}</div>
                  </div>
                ))}
              </div>
              <div style={{ borderTop:"1px solid #1e1e1e", paddingTop:"1rem" }}>
                <div style={{ fontSize:11, color:"#8b5cf6", marginBottom:8, fontWeight:600 }}>Ask AI about any issue:</div>
                <div style={{ maxHeight:200, overflowY:"auto", marginBottom:8, display:"flex", flexDirection:"column", gap:6 }}>
                  {chatMessages.slice(1).map((m,i)=>(
                    <div key={i} style={{ display:"flex", justifyContent:m.role==="user"?"flex-end":"flex-start" }}>
                      <div style={{ maxWidth:"85%", padding:"8px 12px", borderRadius:m.role==="user"?"12px 12px 4px 12px":"12px 12px 12px 4px", background:m.role==="user"?"#8b5cf6":"#1a1a1a", color:"#f0ede6", fontSize:12, lineHeight:1.5, whiteSpace:"pre-wrap" }}>
                        {m.content}
                      </div>
                    </div>
                  ))}
                  {chatLoading&&<div style={{ fontSize:20, color:"#555", letterSpacing:4 }}>•••</div>}
                </div>
                <form onSubmit={sendChat} style={{ display:"flex", gap:8 }}>
                  <input value={chatInput} onChange={e=>setChatInput(e.target.value)}
                    placeholder="e.g. Cancel stuck bookings, show claim details..."
                    style={{ flex:1, background:"#0f0f0f", border:"1px solid #222", borderRadius:8, padding:"8px 12px", color:"#f0ede6", fontSize:12, outline:"none" }}/>
                  <button type="submit" disabled={!chatInput.trim()||chatLoading}
                    style={{ background:chatInput.trim()&&!chatLoading?"#8b5cf6":"#222", border:"none", borderRadius:8, color:chatInput.trim()&&!chatLoading?"#fff":"#555", fontSize:14, padding:"0 14px", cursor:"pointer" }}>
                    ➤
                  </button>
                </form>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
