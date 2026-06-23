import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"
import { downloadJSON, downloadPDF } from "../../lib/dataExport"
import useIsMobile from "../../lib/useIsMobile"
import toast from "react-hot-toast"

const SC = { pending:"#e6821e", confirmed:"#378add", "in-progress":"#8b5cf6", completed:"#1d9e75", cancelled:"#e24b4a" }
const RC = { customer:"#e6821e", provider:"#378add", driver:"#1d9e75", admin:"#8b5cf6" }

export default function AdminUserDetail({ userId, onBack }) {
  const isMobile = useIsMobile()
  const [profile, setProfile] = useState(null)
  const [sensitive, setSensitive] = useState(null)
  const [bookings, setBookings] = useState([])
  const [payments, setPayments] = useState([])
  const [reviews, setReviews] = useState([])
  const [tickets, setTickets] = useState([])
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState("overview")
  const [exporting, setExporting] = useState(false)

  useEffect(() => { if (userId) load() }, [userId])

  async function load() {
    setLoading(true)
    try {
      const [
        { data: prof },
        { data: sens },
        { data: bks },
        { data: pays },
        { data: revs },
        { data: ticks },
        { data: notifs },
      ] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", userId).single(),
        supabase.from("profile_sensitive").select("phone,email,address").eq("id", userId).maybeSingle(),
        supabase.from("bookings").select("*").or(`customer_id.eq.${userId},provider_id.eq.${userId},driver_id.eq.${userId}`).order("created_at",{ascending:false}),
        supabase.from("payments").select("*").or(`customer_id.eq.${userId},provider_id.eq.${userId}`),
        supabase.from("reviews").select("*").or(`customer_id.eq.${userId},provider_id.eq.${userId}`),
        supabase.from("support_tickets").select("*").eq("customer_id", userId),
        supabase.from("notifications").select("*").eq("user_id", userId).order("created_at",{ascending:false}).limit(30),
      ])
      setProfile(prof)
      setSensitive(sens)
      setBookings(bks||[])
      setPayments(pays||[])
      setReviews(revs||[])
      setTickets(ticks||[])
      setNotifications(notifs||[])
    } catch(err) {
      toast.error("Failed to load user data")
    } finally {
      setLoading(false)
    }
  }

  async function handleExport() {
    if (!profile) return
    setExporting(true)
    try {
      const data = {
        exported_at: new Date().toISOString(),
        profile: { ...profile, ...sensitive },
        bookings, payments, reviews,
        support_tickets: tickets,
        notifications,
      }
      downloadJSON(data, `user-${userId}-${new Date().toISOString().split("T")[0]}.json`)
      toast.success("Data exported")
    } catch(err) { toast.error(err.message) }
    finally { setExporting(false) }
  }

  if (loading) return <div style={{ color:"#888", fontSize:13, padding:"2rem" }}>Loading user data...</div>
  if (!profile) return <div style={{ color:"#e24b4a", fontSize:13, padding:"2rem" }}>User not found</div>

  const totalSpent = payments.reduce((s,p)=>s+Number(p.amount||0),0)
  const completedBookings = bookings.filter(b=>b.status==="completed").length

  const TABS = [
    { k:"overview", l:"Overview" },
    { k:"bookings", l:`Bookings (${bookings.length})` },
    { k:"payments", l:`Payments (${payments.length})` },
    { k:"reviews", l:`Reviews (${reviews.length})` },
    { k:"tickets", l:`Tickets (${tickets.length})` },
    { k:"activity", l:`Activity (${notifications.length})` },
  ]

  return (
    <div>
      <button onClick={onBack} style={{ background:"none", border:"none", color:"#888", cursor:"pointer", fontSize:13, marginBottom:"1.5rem", fontFamily:"'DM Sans',sans-serif", padding:0 }}>
        ← Back to users
      </button>

      {/* Profile header */}
      <div style={{ background:"#f8f8f8", border:"1px solid #eeeeee", borderRadius:12, padding:"1.25rem", marginBottom:"1.25rem" }}>
        <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:"1.25rem", flexWrap:"wrap" }}>
          <div style={{ width:52, height:52, borderRadius:12, background:`${RC[profile?.role]||"#e0e0e0"}20`, border:`2px solid ${RC[profile?.role]||"#e0e0e0"}40`, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"Syne", fontSize:18, fontWeight:800, color:RC[profile?.role]||"#888", flexShrink:0 }}>
            {profile?.first_name?.[0]}{profile?.last_name?.[0]}
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4, flexWrap:"wrap" }}>
              <div style={{ fontFamily:"Syne", fontSize:16, fontWeight:800, color:"#000000" }}>{profile?.business_name||`${profile?.first_name} ${profile?.last_name}`}</div>
              {profile?.business_name&&<div style={{ fontSize:12, color:"#888" }}>{profile?.first_name} {profile?.last_name}</div>}
              <span style={{ fontSize:11, padding:"2px 8px", borderRadius:10, background:`${RC[profile?.role]||"#e0e0e0"}20`, color:RC[profile?.role]||"#888" }}>{profile?.role}</span>
              {profile?.is_verified&&<span style={{ fontSize:11, color:"#1d9e75" }}>✓ Verified</span>}
              {!profile?.is_active&&<span style={{ fontSize:11, color:"#e24b4a", background:"#fff5f5", padding:"2px 8px", borderRadius:10 }}>Suspended</span>}
            </div>
            <div style={{ fontSize:11, color:"#888" }}>
              {sensitive?.email&&`${sensitive.email} · `}
              {sensitive?.phone&&`${sensitive.phone} · `}
              {profile?.city&&`${profile?.city} · `}
              Joined {new Date(profile?.created_at).toLocaleDateString()}
            </div>
          </div>
          <div style={{ display:"flex", gap:8, flexShrink:0, flexWrap:"wrap" }}>
            <button onClick={handleExport} disabled={exporting}
              style={{ background:"#f0fdf4", border:"1px solid #1d9e7540", borderRadius:8, color:"#1d9e75", fontSize:12, padding:"7px 14px", cursor:"pointer" }}>
              {exporting?"Exporting...":"⬇ Export"}
            </button>
          </div>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:isMobile?"repeat(2,1fr)":"repeat(4,1fr)", gap:10 }}>
          {[
            { label:"Total bookings", value:bookings.length },
            { label:"Completed", value:completedBookings, color:"#1d9e75" },
            { label:"Total paid", value:`KES ${totalSpent.toFixed(0)}`, color:"#e6821e" },
            { label:"Reviews", value:reviews.length, color:"#8b5cf6" },
          ].map(s=>(
            <div key={s.label} style={{ background:"#ffffff", borderRadius:8, padding:"0.75rem", border:"1px solid #f5f5f5" }}>
              <div style={{ fontSize:10, color:"#888", textTransform:"uppercase", marginBottom:4 }}>{s.label}</div>
              <div style={{ fontFamily:"Syne", fontSize:16, fontWeight:800, color:s.color||"#000000" }}>{s.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display:"flex", gap:6, marginBottom:"1.25rem", flexWrap:"wrap" }}>
        {TABS.map(t=>(
          <button key={t.k} onClick={()=>setTab(t.k)}
            style={{ padding:"7px 14px", borderRadius:7, border:"none", fontSize:12, cursor:"pointer", background:tab===t.k?"#8b5cf6":"#f8f8f8", color:tab===t.k?"#fff":"#666", fontFamily:"'DM Sans',sans-serif", fontWeight:tab===t.k?700:400 }}>
            {t.l}
          </button>
        ))}
      </div>

      {/* OVERVIEW */}
      {tab==="overview"&&(
        <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:10 }}>
          <div style={{ background:"#f8f8f8", border:"1px solid #eeeeee", borderRadius:12, padding:"1.25rem" }}>
            <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:700, marginBottom:"1rem", color:"#000000" }}>Profile info</div>
            {[
              { label:"Role", value:profile?.role },
              { label:"Email", value:sensitive?.email||"—" },
              { label:"Phone", value:sensitive?.phone||"—" },
              { label:"City", value:profile?.city||"—" },
              { label:"Referral code", value:profile?.referral_code||"—" },
              { label:"Status", value:profile?.is_active?"Active":"Suspended" },
              { label:"Verified", value:profile?.is_verified?"Yes":"No" },
              { label:"Joined", value:new Date(profile?.created_at).toLocaleDateString() },
            ].map(f=>(
              <div key={f.label} style={{ display:"flex", justifyContent:"space-between", padding:"7px 0", borderBottom:"1px solid #f5f5f5", fontSize:12 }}>
                <span style={{ color:"#888" }}>{f.label}</span>
                <span style={{ color:"#000000", fontWeight:500 }}>{f.value}</span>
              </div>
            ))}
          </div>
          <div style={{ background:"#f8f8f8", border:"1px solid #eeeeee", borderRadius:12, padding:"1.25rem" }}>
            <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:700, marginBottom:"1rem", color:"#000000" }}>Recent bookings</div>
            {bookings.slice(0,6).map(b=>(
              <div key={b.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"7px 0", borderBottom:"1px solid #f5f5f5" }}>
                <div>
                  <div style={{ fontSize:12, color:"#000000" }}>{b.service_name}</div>
                  <div style={{ fontSize:10, color:"#888" }}>{b.booking_date}</div>
                </div>
                <div style={{ textAlign:"right" }}>
                  <span style={{ fontSize:10, padding:"1px 7px", borderRadius:10, background:`${SC[b.status]||"#888"}20`, color:SC[b.status]||"#888" }}>{b.status}</span>
                  <div style={{ fontSize:11, color:"#e6821e", marginTop:2 }}>KES {Number(b.total_amount).toLocaleString()}</div>
                </div>
              </div>
            ))}
            {!bookings.length&&<div style={{ color:"#888", fontSize:12 }}>No bookings</div>}
          </div>
        </div>
      )}

      {/* BOOKINGS */}
      {tab==="bookings"&&(
        <div>
          {bookings.map(b=>(
            <div key={b.id} style={{ background:"#f8f8f8", border:"1px solid #eeeeee", borderRadius:10, padding:"1rem", marginBottom:8 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                <div>
                  <div style={{ fontSize:13, fontWeight:500, color:"#000000", marginBottom:2 }}>{b.service_name}</div>
                  <div style={{ fontSize:11, color:"#888" }}>#{b.booking_number} · {b.booking_date} · {b.booking_time?.slice(0,5)}</div>
                  {b.is_emergency&&<div style={{ fontSize:10, color:"#e24b4a", marginTop:2 }}>🚨 Emergency</div>}
                </div>
                <div style={{ textAlign:"right" }}>
                  <span style={{ fontSize:10, padding:"2px 8px", borderRadius:10, background:`${SC[b.status]||"#888"}20`, color:SC[b.status]||"#888" }}>{b.status}</span>
                  <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:700, color:"#e6821e", marginTop:4 }}>KES {Number(b.total_amount).toLocaleString()}</div>
                </div>
              </div>
            </div>
          ))}
          {!bookings.length&&<div style={{ color:"#888", fontSize:13, textAlign:"center", padding:"2rem" }}>No bookings</div>}
        </div>
      )}

      {/* PAYMENTS */}
      {tab==="payments"&&(
        <div>
          {payments.map(p=>(
            <div key={p.id} style={{ background:"#f8f8f8", border:"1px solid #eeeeee", borderRadius:10, padding:"1rem", marginBottom:8, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div>
                <div style={{ fontSize:13, color:"#000000", marginBottom:2 }}>{p.payment_method||"Payment"}</div>
                <div style={{ fontSize:11, color:"#888" }}>{new Date(p.created_at).toLocaleDateString()}</div>
              </div>
              <div style={{ textAlign:"right" }}>
                <div style={{ fontFamily:"Syne", fontSize:16, fontWeight:700, color:"#e6821e" }}>KES {Number(p.amount).toLocaleString()}</div>
                <div style={{ fontSize:10, color:p.status==="paid"?"#1d9e75":"#e6821e", marginTop:2 }}>{p.status}</div>
              </div>
            </div>
          ))}
          {!payments.length&&<div style={{ color:"#888", fontSize:13, textAlign:"center", padding:"2rem" }}>No payments</div>}
        </div>
      )}

      {/* REVIEWS */}
      {tab==="reviews"&&(
        <div>
          {reviews.map(r=>(
            <div key={r.id} style={{ background:"#f8f8f8", border:"1px solid #eeeeee", borderRadius:10, padding:"1rem", marginBottom:8 }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
                <div style={{ fontSize:12, color:"#888" }}>{new Date(r.created_at).toLocaleDateString()}</div>
                <div style={{ display:"flex", gap:1 }}>
                  {[1,2,3,4,5].map(s=><span key={s} style={{ color:s<=r.provider_rating?"#e6821e":"#e0e0e0", fontSize:14 }}>★</span>)}
                </div>
              </div>
              {r.provider_review&&<div style={{ fontSize:12, color:"#888", lineHeight:1.5 }}>&quot;{r.provider_review}&quot;</div>}
            </div>
          ))}
          {!reviews.length&&<div style={{ color:"#888", fontSize:13, textAlign:"center", padding:"2rem" }}>No reviews</div>}
        </div>
      )}

      {/* TICKETS */}
      {tab==="tickets"&&(
        <div>
          {tickets.map(t=>(
            <div key={t.id} style={{ background:"#f8f8f8", border:"1px solid #eeeeee", borderRadius:10, padding:"1rem", marginBottom:8 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                <div>
                  <div style={{ fontSize:13, fontWeight:500, color:"#000000", marginBottom:2 }}>{t.subject}</div>
                  <div style={{ fontSize:11, color:"#888" }}>#{t.ticket_number} · {t.category} · {new Date(t.created_at).toLocaleDateString()}</div>
                </div>
                <span style={{ fontSize:10, padding:"2px 8px", borderRadius:10, background:"#f5f5f5", color:"#888" }}>{t.status}</span>
              </div>
            </div>
          ))}
          {!tickets.length&&<div style={{ color:"#888", fontSize:13, textAlign:"center", padding:"2rem" }}>No support tickets</div>}
        </div>
      )}

      {/* ACTIVITY */}
      {tab==="activity"&&(
        <div>
          {notifications.map(n=>(
            <div key={n.id} style={{ display:"flex", gap:12, padding:"0.75rem 0", borderBottom:"1px solid #f5f5f5", alignItems:"flex-start" }}>
              <div style={{ width:8, height:8, borderRadius:"50%", background:n.type==="success"?"#1d9e75":n.type==="error"?"#e24b4a":"#e6821e", flexShrink:0, marginTop:5 }}/>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:12, color:"#000000", marginBottom:2 }}>{n.title}</div>
                <div style={{ fontSize:11, color:"#888" }}>{n.message}</div>
              </div>
              <div style={{ fontSize:10, color:"#888", flexShrink:0 }}>{new Date(n.created_at).toLocaleDateString()}</div>
            </div>
          ))}
          {!notifications.length&&<div style={{ color:"#888", fontSize:13, textAlign:"center", padding:"2rem" }}>No activity</div>}
        </div>
      )}
    </div>
  )
}





