import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"
import useIsMobile from "../../lib/useIsMobile"
import toast from "react-hot-toast"

export default function AdminPaymentTracking() {
  const isMobile = useIsMobile()
  const [bookings, setBookings] = useState([])
  const [goPayments, setGoPayments] = useState([])
  const [marketplace, setMarketplace] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState("overview")
  const [filter, setFilter] = useState("all")

  useEffect(() => { load() }, [])

  async function load() {
    const [{ data: bks }, { data: goPays }, { data: mkt }] = await Promise.all([
      supabase.from("bookings")
        .select("*, profiles!bookings_customer_id_fkey(first_name,last_name), provider:profiles!bookings_provider_id_fkey(first_name,last_name,business_name)")
        .order("created_at", { ascending:false })
        .limit(100),
      supabase.from("bookings")
        .select("*, profiles!bookings_customer_id_fkey(first_name,last_name), provider:profiles!bookings_provider_id_fkey(first_name,last_name,business_name)")
        .eq("is_emergency", true)
        .order("created_at", { ascending:false }),
      supabase.from("marketplace_transactions")
        .select("*, marketplace_listings(title), buyer:profiles!marketplace_transactions_buyer_id_fkey(first_name,last_name), seller:profiles!marketplace_transactions_seller_id_fkey(first_name,last_name)")
        .order("created_at", { ascending:false })
    ])
    setBookings(bks||[])
    setGoPayments(goPays||[])
    setMarketplace(mkt||[])
    setLoading(false)
  }

  async function releasePayment(bookingId) {
    if (!confirm("Release payment to provider? Make sure service is completed.")) return
    await supabase.from("bookings").update({ payment_status:"paid", provider_paid:true }).eq("id", bookingId)
    toast.success("Payment released to provider")
    load()
  }

  async function holdPayment(bookingId) {
    await supabase.from("bookings").update({ payment_status:"disputed" }).eq("id", bookingId)
    toast.success("Payment held — dispute flagged")
    load()
  }

  async function releaseEscrow(txnId) {
    if (!confirm("Release escrow to seller?")) return
    await supabase.from("marketplace_transactions").update({ status:"completed", escrow_released_at:new Date().toISOString() }).eq("id", txnId)
    toast.success("Escrow released to seller")
    load()
  }

  // Stats
  const totalRevenue = bookings.filter(b=>b.payment_status==="paid").reduce((s,b)=>s+Number(b.platform_commission||0),0)
  const pendingRevenue = bookings.filter(b=>b.status==="completed"&&b.payment_status!=="paid").reduce((s,b)=>s+Number(b.platform_commission||0),0)
  const goRevenue = goPayments.filter(b=>b.go_callout_paid).reduce((s,b)=>s+75,0) // KES 75 platform share of KES 500
  const escrowTotal = marketplace.filter(m=>m.status==="pending"||m.status==="processing").reduce((s,m)=>s+Number(m.amount||0),0)

  const filtered = tab==="bookings" ? (filter==="all"?bookings:bookings.filter(b=>b.payment_status===filter)) :
                   tab==="go" ? goPayments :
                   tab==="marketplace" ? marketplace : []

  const SC = { paid:"#1d9e75", pending:"#e6821e", disputed:"#e24b4a", processing:"#378add", partial:"#8b5cf6" }

  return (
    <div>
      <div style={{ marginBottom:"1.25rem" }}>
        <div style={{ fontFamily:"Syne", fontSize:isMobile?16:20, fontWeight:800, color:"#f0ede6" }}>Payment Tracking</div>
        <div style={{ fontSize:12, color:"#555" }}>Monitor all platform payments and revenue</div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:isMobile?"repeat(2,1fr)":"repeat(4,1fr)", gap:10, marginBottom:"1.5rem" }}>
        {[
          { label:"Total revenue", value:"KES "+totalRevenue.toLocaleString(), color:"#1d9e75" },
          { label:"Pending release", value:"KES "+pendingRevenue.toLocaleString(), color:"#e6821e" },
          { label:"GO callout revenue", value:"KES "+goRevenue.toLocaleString(), color:"#e24b4a" },
          { label:"Escrow held", value:"KES "+escrowTotal.toLocaleString(), color:"#8b5cf6" },
        ].map(s=>(
          <div key={s.label} style={{ background:"#111", borderRadius:10, padding:"1rem", border:"1px solid #1e1e1e" }}>
            <div style={{ fontSize:10, color:"#555", marginBottom:4, textTransform:"uppercase" }}>{s.label}</div>
            <div style={{ fontFamily:"Syne", fontSize:isMobile?14:18, fontWeight:800, color:s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display:"flex", gap:6, marginBottom:"1.25rem", flexWrap:"wrap" }}>
        {[{k:"overview",l:"Overview"},{k:"bookings",l:"Bookings"},{k:"go",l:"GO Service"},{k:"marketplace",l:"Marketplace"}].map(t=>(
          <button key={t.k} onClick={()=>setTab(t.k)}
            style={{ padding:"7px 14px", borderRadius:8, border:"none", fontSize:12, cursor:"pointer", background:tab===t.k?"#e6821e":"#111", color:tab===t.k?"#fff":"#666", fontFamily:"DM Sans,sans-serif", fontWeight:tab===t.k?700:400 }}>
            {t.l}
          </button>
        ))}
      </div>

      {tab==="overview"&&(
        <div>
          <div style={{ background:"#111", border:"1px solid #1e1e1e", borderRadius:12, padding:"1.25rem", marginBottom:"1rem" }}>
            <div style={{ fontFamily:"Syne", fontSize:13, fontWeight:700, color:"#f0ede6", marginBottom:12 }}>Payment status summary</div>
            {[
              { label:"Completed & paid", count:bookings.filter(b=>b.payment_status==="paid").length, color:"#1d9e75" },
              { label:"Completed — awaiting release", count:bookings.filter(b=>b.status==="completed"&&b.payment_status!=="paid").length, color:"#e6821e" },
              { label:"Pending bookings", count:bookings.filter(b=>b.status==="pending").length, color:"#888" },
              { label:"Disputed payments", count:bookings.filter(b=>b.payment_status==="disputed").length, color:"#e24b4a" },
              { label:"GO callout fees paid", count:goPayments.filter(b=>b.go_callout_paid).length, color:"#e24b4a" },
              { label:"Marketplace escrow active", count:marketplace.filter(m=>m.status==="pending"||m.status==="processing").length, color:"#8b5cf6" },
            ].map(s=>(
              <div key={s.label} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 0", borderBottom:"1px solid #1e1e1e" }}>
                <div style={{ fontSize:13, color:"#888" }}>{s.label}</div>
                <span style={{ fontFamily:"Syne", fontSize:14, fontWeight:800, color:s.color }}>{s.count}</span>
              </div>
            ))}
          </div>

          <div style={{ background:"#111", border:"1px solid #e6821e30", borderRadius:12, padding:"1.25rem" }}>
            <div style={{ fontFamily:"Syne", fontSize:13, fontWeight:700, color:"#e6821e", marginBottom:12 }}>⚠️ Action required</div>
            {bookings.filter(b=>b.status==="completed"&&b.payment_status!=="paid").slice(0,5).map(b=>(
              <div key={b.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 0", borderBottom:"1px solid #1e1e1e" }}>
                <div>
                  <div style={{ fontSize:12, color:"#f0ede6" }}>{b.service_name}</div>
                  <div style={{ fontSize:10, color:"#555" }}>#{b.booking_number} · {b.profiles?.first_name} {b.profiles?.last_name}</div>
                </div>
                <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                  <span style={{ fontSize:12, color:"#e6821e", fontWeight:600 }}>KES {Number(b.platform_commission||0).toLocaleString()}</span>
                  <button onClick={()=>releasePayment(b.id)} style={{ background:"#1d9e75", border:"none", borderRadius:6, color:"#fff", fontSize:10, padding:"4px 10px", cursor:"pointer" }}>Release</button>
                  <button onClick={()=>holdPayment(b.id)} style={{ background:"none", border:"1px solid #e24b4a40", borderRadius:6, color:"#e24b4a", fontSize:10, padding:"4px 8px", cursor:"pointer" }}>Hold</button>
                </div>
              </div>
            ))}
            {bookings.filter(b=>b.status==="completed"&&b.payment_status!=="paid").length===0&&(
              <div style={{ fontSize:12, color:"#555", textAlign:"center", padding:"1rem" }}>No pending releases</div>
            )}
          </div>
        </div>
      )}

      {tab==="bookings"&&(
        <div>
          <div style={{ display:"flex", gap:6, marginBottom:"1rem", flexWrap:"wrap" }}>
            {["all","pending","paid","disputed"].map(f=>(
              <button key={f} onClick={()=>setFilter(f)}
                style={{ padding:"5px 12px", borderRadius:7, border:"none", fontSize:11, cursor:"pointer", background:filter===f?"#e6821e":"#111", color:filter===f?"#fff":"#666" }}>
                {f}
              </button>
            ))}
          </div>
          {loading&&<div style={{ color:"#555", fontSize:13 }}>Loading...</div>}
          {filtered.map(b=>(
            <div key={b.id} style={{ background:"#111", border:"1px solid #1e1e1e", borderRadius:10, padding:"1rem", marginBottom:8 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
                <div>
                  <div style={{ fontSize:13, fontWeight:600, color:"#f0ede6" }}>{b.service_name}</div>
                  <div style={{ fontSize:11, color:"#555" }}>#{b.booking_number} · {b.profiles?.first_name} {b.profiles?.last_name}</div>
                  <div style={{ fontSize:11, color:"#555" }}>Provider: {b.provider?.business_name||b.provider?.first_name}</div>
                  <div style={{ fontSize:10, color:"#444", marginTop:2 }}>{new Date(b.created_at).toLocaleString()}</div>
                </div>
                <div style={{ textAlign:"right" }}>
                  <div style={{ fontFamily:"Syne", fontSize:13, fontWeight:800, color:"#e6821e" }}>KES {Number(b.total_amount||0).toLocaleString()}</div>
                  <div style={{ fontSize:10, color:"#555" }}>Platform: KES {Number(b.platform_commission||0).toLocaleString()}</div>
                  <span style={{ fontSize:10, padding:"2px 8px", borderRadius:10, background:(SC[b.payment_status]||"#888")+"20", color:SC[b.payment_status]||"#888", display:"inline-block", marginTop:4 }}>{b.payment_status||"pending"}</span>
                </div>
              </div>
              <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                <span style={{ fontSize:10, padding:"2px 8px", borderRadius:8, background:"#1a1a1a", color:b.status==="completed"?"#1d9e75":"#888" }}>Booking: {b.status}</span>
                {b.status==="completed"&&b.payment_status!=="paid"&&(
                  <>
                    <button onClick={()=>releasePayment(b.id)} style={{ background:"#071a12", border:"1px solid #1d9e7540", borderRadius:6, color:"#1d9e75", fontSize:10, padding:"3px 10px", cursor:"pointer" }}>Release payment</button>
                    <button onClick={()=>holdPayment(b.id)} style={{ background:"none", border:"1px solid #e24b4a30", borderRadius:6, color:"#e24b4a", fontSize:10, padding:"3px 8px", cursor:"pointer" }}>Hold</button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab==="go"&&(
        <div>
          {goPayments.map(b=>(
            <div key={b.id} style={{ background:"#111", border:"1px solid #e24b4a30", borderRadius:10, padding:"1rem", marginBottom:8 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                <div>
                  <div style={{ fontSize:13, fontWeight:600, color:"#f0ede6" }}>🚨 {b.emergency_type?.replace(/_/g," ")||"Emergency"}</div>
                  <div style={{ fontSize:11, color:"#555" }}>{b.profiles?.first_name} {b.profiles?.last_name}</div>
                  <div style={{ fontSize:11, color:"#555" }}>Provider: {b.provider?.business_name||b.provider?.first_name}</div>
                  <div style={{ fontSize:10, color:"#444" }}>{new Date(b.created_at).toLocaleString()}</div>
                </div>
                <div style={{ textAlign:"right" }}>
                  <div style={{ fontSize:12, color:"#e6821e", fontWeight:600 }}>Callout: KES 500</div>
                  <div style={{ fontSize:10, color:"#555" }}>Service: KES {Number(b.total_amount||0).toLocaleString()}</div>
                  <span style={{ fontSize:10, padding:"2px 8px", borderRadius:10, background:b.go_callout_paid?"#071a12":"#1a0808", color:b.go_callout_paid?"#1d9e75":"#e24b4a", display:"inline-block", marginTop:4 }}>
                    Callout: {b.go_callout_paid?"Paid":"Unpaid"}
                  </span>
                </div>
              </div>
            </div>
          ))}
          {goPayments.length===0&&<div style={{ color:"#444", fontSize:13, textAlign:"center", padding:"3rem" }}>No GO service payments yet</div>}
        </div>
      )}

      {tab==="marketplace"&&(
        <div>
          {marketplace.map(m=>(
            <div key={m.id} style={{ background:"#111", border:"1px solid #8b5cf630", borderRadius:10, padding:"1rem", marginBottom:8 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
                <div>
                  <div style={{ fontSize:13, fontWeight:600, color:"#f0ede6" }}>{m.marketplace_listings?.title||"Listing"}</div>
                  <div style={{ fontSize:11, color:"#555" }}>Buyer: {m.buyer?.first_name} {m.buyer?.last_name}</div>
                  <div style={{ fontSize:11, color:"#555" }}>Seller: {m.seller?.first_name} {m.seller?.last_name}</div>
                  <div style={{ fontSize:10, color:"#444" }}>{new Date(m.created_at).toLocaleString()}</div>
                </div>
                <div style={{ textAlign:"right" }}>
                  <div style={{ fontFamily:"Syne", fontSize:13, fontWeight:800, color:"#e6821e" }}>KES {Number(m.amount||0).toLocaleString()}</div>
                  <div style={{ fontSize:10, color:"#555" }}>Commission: KES {Number(m.commission||0).toLocaleString()}</div>
                  <span style={{ fontSize:10, padding:"2px 8px", borderRadius:10, background:(SC[m.status]||"#888")+"20", color:SC[m.status]||"#888", display:"inline-block", marginTop:4 }}>{m.status}</span>
                </div>
              </div>
              {(m.status==="pending"||m.status==="processing")&&(
                <button onClick={()=>releaseEscrow(m.id)} style={{ background:"#071a12", border:"1px solid #1d9e7540", borderRadius:7, color:"#1d9e75", fontSize:11, padding:"5px 12px", cursor:"pointer" }}>
                  🔓 Release escrow to seller
                </button>
              )}
            </div>
          ))}
          {marketplace.length===0&&<div style={{ color:"#444", fontSize:13, textAlign:"center", padding:"3rem" }}>No marketplace transactions yet</div>}
        </div>
      )}
    </div>
  )
}
