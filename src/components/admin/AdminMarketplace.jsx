import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"
import useIsMobile from "../../lib/useIsMobile"
import toast from "react-hot-toast"

export default function AdminMarketplace() {
  const isMobile = useIsMobile()
  const [listings, setListings] = useState([])
  const [offers, setOffers] = useState([])
  const [transactions, setTransactions] = useState([])
  const [disputes, setDisputes] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState("pending")
  const [selected, setSelected] = useState(null)
  const [adminNotes, setAdminNotes] = useState("")
  const [processing, setProcessing] = useState(false)
  const [search, setSearch] = useState("")

  useEffect(() => {
    load()
    const sub = supabase.channel("admin-marketplace-live")
      .on("postgres_changes", { event:"*", schema:"public", table:"marketplace_listings" }, () => load())
      .on("postgres_changes", { event:"*", schema:"public", table:"marketplace_offers" }, () => loadOffers())
      .subscribe()
    return () => supabase.removeChannel(sub)
  }, [])

  async function load() {
    await Promise.all([loadListings(), loadOffers(), loadTransactions(), loadDisputes()])
    setLoading(false)
  }

  async function loadListings() {
    const { data } = await supabase.from("marketplace_listings")
      .select("*, profiles(first_name,last_name,role,business_name)")
      .order("created_at", { ascending:false })
    setListings(data||[])
  }

  async function loadOffers() {
    const { data } = await supabase.from("marketplace_offers")
      .select("*, marketplace_listings(title,price), buyer:profiles!marketplace_offers_buyer_id_fkey(first_name,last_name), seller:profiles!marketplace_offers_seller_id_fkey(first_name,last_name)")
      .order("created_at", { ascending:false })
    setOffers(data||[])
  }

  async function loadTransactions() {
    const { data } = await supabase.from("marketplace_transactions")
      .select("*, marketplace_listings(title), buyer:profiles!marketplace_transactions_buyer_id_fkey(first_name,last_name), seller:profiles!marketplace_transactions_seller_id_fkey(first_name,last_name)")
      .order("created_at", { ascending:false })
    setTransactions(data||[])
  }

  async function loadDisputes() {
    const { data } = await supabase.from("marketplace_disputes")
      .select("*, marketplace_transactions(sale_price), profiles(first_name,last_name)")
      .order("created_at", { ascending:false })
    setDisputes(data||[])
  }

  async function approveListing(id) {
    setProcessing(true)
    try {
      const { error } = await supabase.from("marketplace_listings").update({ status:"active", admin_notes:adminNotes||null }).eq("id",id)
      if (error) throw error
      const listing = listings.find(l=>l.id===id)
      await supabase.from("notifications").insert({
        user_id: listing.seller_id,
        title: "Listing approved! 🎉",
        message: `Your listing "${listing.title}" is now live on the marketplace.`,
        type: "success",
      })
      toast.success("Listing approved and live")
      setSelected(null); setAdminNotes(""); load()
    } catch(err) { toast.error(err.message) }
    finally { setProcessing(false) }
  }

  async function rejectListing(id) {
    if (!adminNotes) return toast.error("Please add reason for rejection")
    setProcessing(true)
    try {
      const { error } = await supabase.from("marketplace_listings").update({ status:"rejected", admin_notes:adminNotes }).eq("id",id)
      if (error) throw error
      const listing = listings.find(l=>l.id===id)
      await supabase.from("notifications").insert({
        user_id: listing.seller_id,
        title: "Listing not approved",
        message: `Your listing "${listing.title}" was not approved. Reason: ${adminNotes}. Please edit and resubmit.`,
        type: "warning",
      })
      toast.success("Listing rejected")
      setSelected(null); setAdminNotes(""); load()
    } catch(err) { toast.error(err.message) }
    finally { setProcessing(false) }
  }

  async function suspendListing(id) {
    await supabase.from("marketplace_listings").update({ status:"suspended" }).eq("id",id)
    toast.success("Listing suspended")
    load()
  }

  async function featureListing(id, featured) {
    const featuredUntil = featured ? new Date(Date.now()+7*24*60*60*1000).toISOString() : null
    await supabase.from("marketplace_listings").update({ is_featured:featured, featured_until:featuredUntil }).eq("id",id)
    toast.success(featured?"Listing featured for 7 days":"Listing unfeatured")
    load()
  }

  const pendingListings = listings.filter(l=>l.status==="pending")
  const activeListings = listings.filter(l=>l.status==="active")
  const rejectedListings = listings.filter(l=>l.status==="rejected"||l.status==="suspended")

  const filtered = (tab==="pending"?pendingListings:tab==="active"?activeListings:tab==="rejected"?rejectedListings:tab==="offers"?[]:tab==="transactions"?[]:listings)
    .filter(l=>!search||`${l.title} ${l.make||""} ${l.model||""} ${l.city||""}`.toLowerCase().includes(search.toLowerCase()))

  const totalRevenue = transactions.filter(t=>t.payment_status==="released").reduce((s,t)=>s+Number(t.platform_commission||0),0)

  const SC = { pending:"#e6821e", active:"#1d9e75", rejected:"#e24b4a", suspended:"#555" }

  const TABS = [
    { k:"pending", l:`Pending (${pendingListings.length})` },
    { k:"active", l:`Active (${activeListings.length})` },
    { k:"rejected", l:`Rejected (${rejectedListings.length})` },
    { k:"offers", l:`Offers (${offers.length})` },
    { k:"transactions", l:`Transactions (${transactions.length})` },
    { k:"disputes", l:`Disputes (${disputes.filter(d=>d.status==="open").length})` },
  ]

  return (
    <div>
      {/* Stats */}
      <div style={{ display:"grid", gridTemplateColumns:isMobile?"repeat(2,1fr)":"repeat(4,1fr)", gap:10, marginBottom:"1.5rem" }}>
        {[
          { label:"Total listings", value:listings.length, color:"#f0ede6" },
          { label:"Pending review", value:pendingListings.length, color:"#e6821e" },
          { label:"Active listings", value:activeListings.length, color:"#1d9e75" },
          { label:"Platform revenue", value:`KES ${totalRevenue.toLocaleString()}`, color:"#8b5cf6" },
        ].map(s=>(
          <div key={s.label} style={{ background:"#111", borderRadius:10, padding:isMobile?"0.75rem":"1rem", border:"1px solid #1e1e1e" }}>
            <div style={{ fontSize:10, color:"#555", textTransform:"uppercase", marginBottom:4 }}>{s.label}</div>
            <div style={{ fontFamily:"Syne", fontSize:isMobile?14:18, fontWeight:800, color:s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Pending alert */}
      {pendingListings.length>0&&(
        <div style={{ background:"#1a1208", border:"1px solid #e6821e40", borderRadius:10, padding:"0.9rem", marginBottom:"1.25rem" }}>
          <div style={{ fontSize:13, color:"#e6821e", fontWeight:600 }}>⏳ {pendingListings.length} listing{pendingListings.length>1?"s":""} waiting for review</div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display:"flex", gap:6, marginBottom:"1.25rem", flexWrap:"wrap" }}>
        {TABS.map(t=>(
          <button key={t.k} onClick={()=>setTab(t.k)}
            style={{ padding:"7px 14px", borderRadius:8, border:"none", fontSize:12, cursor:"pointer", background:tab===t.k?"#8b5cf6":"#111", color:tab===t.k?"#fff":"#666", fontFamily:"'DM Sans',sans-serif", fontWeight:tab===t.k?700:400 }}>
            {t.l}
          </button>
        ))}
      </div>

      {/* Search */}
      {["pending","active","rejected"].includes(tab)&&(
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search listings..."
          style={{ width:"100%", background:"#111", border:"1px solid #222", borderRadius:8, padding:"9px 12px", color:"#f0ede6", fontSize:13, outline:"none", marginBottom:"1rem", fontFamily:"'DM Sans',sans-serif" }}/>
      )}

      {loading&&<div style={{ color:"#555", fontSize:13 }}>Loading...</div>}

      {/* LISTINGS TABS */}
      {["pending","active","rejected"].includes(tab)&&(
        <div>
          {filtered.length===0&&<div style={{ color:"#444", fontSize:13, textAlign:"center", padding:"2rem" }}>No listings</div>}
          {filtered.map(l=>{
            const seller = l.profiles
            return (
              <div key={l.id} style={{ background:"#111", border:`1px solid ${SC[l.status]||"#1e1e1e"}20`, borderRadius:12, padding:"1rem", marginBottom:10 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4, flexWrap:"wrap" }}>
                      <span style={{ fontSize:16 }}>{l.listing_type==="vehicle"?"🚗":l.listing_type==="part"?"🔧":"✨"}</span>
                      <div style={{ fontSize:13, fontWeight:600, color:"#f0ede6" }}>{l.title}</div>
                      <span style={{ fontSize:10, padding:"2px 8px", borderRadius:10, background:`${SC[l.status]||"#888"}20`, color:SC[l.status]||"#888" }}>{l.status}</span>
                      {l.is_featured&&<span style={{ fontSize:10, color:"#e6821e" }}>⭐ Featured</span>}
                    </div>
                    <div style={{ fontSize:11, color:"#555", marginBottom:2 }}>
                      👤 {seller?.business_name||`${seller?.first_name} ${seller?.last_name}`} · {seller?.role}
                    </div>
                    {l.listing_type==="vehicle"&&<div style={{ fontSize:11, color:"#555", marginBottom:2 }}>{[l.make,l.model,l.year].filter(Boolean).join(" ")}{l.mileage?` · ${Number(l.mileage).toLocaleString()}km`:""}</div>}
                    {l.city&&<div style={{ fontSize:11, color:"#555", marginBottom:2 }}>📍 {l.city}</div>}
                    {l.admin_notes&&<div style={{ fontSize:11, color:"#378add", marginTop:4 }}>Admin note: "{l.admin_notes}"</div>}
                    <div style={{ fontSize:10, color:"#444", marginTop:4 }}>{new Date(l.created_at).toLocaleString()} · 👁 {l.views||0} views</div>
                  </div>
                  <div style={{ textAlign:"right", flexShrink:0 }}>
                    <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:800, color:"#e6821e" }}>KES {Number(l.price).toLocaleString()}</div>
                    <div style={{ fontSize:10, color:"#555", marginTop:2 }}>{l.negotiable?"Negotiable":"Fixed price"}</div>
                    <div style={{ fontSize:10, color:"#555" }}>Commission: {Math.round((l.commission_rate||0.08)*100)}%</div>
                  </div>
                </div>

                <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                  {l.status==="pending"&&(
                    <>
                      <button onClick={()=>{ setSelected(selected===l.id?null:l.id); setAdminNotes("") }}
                        style={{ background:"#160a2e", border:"1px solid #8b5cf640", borderRadius:7, color:"#8b5cf6", fontSize:11, padding:"5px 10px", cursor:"pointer" }}>
                        Review
                      </button>
                    </>
                  )}
                  {l.status==="active"&&(
                    <>
                      <button onClick={()=>featureListing(l.id,!l.is_featured)}
                        style={{ background:l.is_featured?"#1a1208":"#1a1208", border:`1px solid ${l.is_featured?"#e24b4a40":"#e6821e40"}`, borderRadius:7, color:l.is_featured?"#e24b4a":"#e6821e", fontSize:11, padding:"5px 10px", cursor:"pointer" }}>
                        {l.is_featured?"Unfeature":"⭐ Feature"}
                      </button>
                      <button onClick={()=>suspendListing(l.id)}
                        style={{ background:"none", border:"1px solid #e24b4a30", borderRadius:7, color:"#e24b4a", fontSize:11, padding:"5px 10px", cursor:"pointer" }}>
                        Suspend
                      </button>
                    </>
                  )}
                  {l.status==="rejected"||l.status==="suspended"?(
                    <button onClick={()=>approveListing(l.id)}
                      style={{ background:"#071a12", border:"1px solid #1d9e7540", borderRadius:7, color:"#1d9e75", fontSize:11, padding:"5px 10px", cursor:"pointer" }}>
                      Reactivate
                    </button>
                  ):null}
                </div>

                {selected===l.id&&l.status==="pending"&&(
                  <div style={{ marginTop:10, borderTop:"1px solid #1e1e1e", paddingTop:10 }}>
                    <div style={{ fontFamily:"Syne", fontSize:13, fontWeight:700, color:"#f0ede6", marginBottom:8 }}>Review listing</div>

                    {/* Description preview */}
                    {l.description&&(
                      <div style={{ background:"#0f0f0f", borderRadius:8, padding:"0.75rem", marginBottom:10, fontSize:12, color:"#888", lineHeight:1.6 }}>
                        "{l.description}"
                      </div>
                    )}

                    <div style={{ marginBottom:10 }}>
                      <label style={{ fontSize:11, color:"#666", display:"block", marginBottom:4 }}>Admin notes (required for rejection)</label>
                      <textarea value={adminNotes} onChange={e=>setAdminNotes(e.target.value)}
                        placeholder="Add notes..."
                        style={{ width:"100%", background:"#0f0f0f", border:"1px solid #222", borderRadius:8, padding:"9px 12px", color:"#f0ede6", fontSize:12, outline:"none", resize:"vertical", minHeight:60, fontFamily:"'DM Sans',sans-serif" }}/>
                    </div>

                    <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                      <button onClick={()=>approveListing(l.id)} disabled={processing}
                        style={{ background:processing?"#333":"#1d9e75", border:"none", borderRadius:8, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:12, fontWeight:700, padding:"9px 18px", cursor:processing?"not-allowed":"pointer" }}>
                        ✓ Approve & publish
                      </button>
                      <button onClick={()=>rejectListing(l.id)} disabled={processing}
                        style={{ background:"none", border:"1px solid #e24b4a40", borderRadius:8, color:"#e24b4a", fontSize:12, padding:"9px 14px", cursor:processing?"not-allowed":"pointer" }}>
                        Reject
                      </button>
                      <button onClick={()=>setSelected(null)}
                        style={{ background:"none", border:"1px solid #333", borderRadius:8, color:"#666", fontSize:12, padding:"9px 14px", cursor:"pointer" }}>
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* OFFERS TAB */}
      {tab==="offers"&&(
        <div>
          {offers.length===0&&<div style={{ color:"#444", fontSize:13, textAlign:"center", padding:"2rem" }}>No offers yet</div>}
          {offers.map(o=>(
            <div key={o.id} style={{ background:"#111", border:"1px solid #1e1e1e", borderRadius:10, padding:"1rem", marginBottom:8 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                <div>
                  <div style={{ fontSize:13, fontWeight:600, color:"#f0ede6", marginBottom:4 }}>{o.marketplace_listings?.title}</div>
                  <div style={{ fontSize:11, color:"#555", marginBottom:2 }}>
                    Asking: KES {Number(o.marketplace_listings?.price||0).toLocaleString()}
                  </div>
                  <div style={{ fontSize:11, color:"#555", marginBottom:2 }}>
                    Buyer: {o.buyer?.first_name} {o.buyer?.last_name}
                  </div>
                  <div style={{ fontSize:11, color:"#555", marginBottom:4 }}>
                    Seller: {o.seller?.first_name} {o.seller?.last_name}
                  </div>
                  {o.message&&<div style={{ fontSize:11, color:"#888", fontStyle:"italic" }}>"{o.message}"</div>}
                  <div style={{ fontSize:10, color:"#444", marginTop:4 }}>{new Date(o.created_at).toLocaleString()}</div>
                </div>
                <div style={{ textAlign:"right" }}>
                  <div style={{ fontFamily:"Syne", fontSize:15, fontWeight:800, color:"#e6821e" }}>KES {Number(o.offered_price).toLocaleString()}</div>
                  {o.counter_price&&<div style={{ fontSize:11, color:"#8b5cf6", marginTop:2 }}>Counter: KES {Number(o.counter_price).toLocaleString()}</div>}
                  <span style={{ fontSize:10, padding:"2px 8px", borderRadius:10, background:"#1a1a1a", color:"#888", marginTop:4, display:"inline-block" }}>{o.status}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TRANSACTIONS TAB */}
      {tab==="transactions"&&(
        <div>
          {transactions.length===0&&<div style={{ color:"#444", fontSize:13, textAlign:"center", padding:"2rem" }}>No transactions yet</div>}
          {transactions.map(t=>(
            <div key={t.id} style={{ background:"#111", border:"1px solid #1e1e1e", borderRadius:10, padding:"1rem", marginBottom:8 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                <div>
                  <div style={{ fontSize:13, fontWeight:600, color:"#f0ede6", marginBottom:4 }}>{t.marketplace_listings?.title}</div>
                  <div style={{ fontSize:11, color:"#555", marginBottom:2 }}>Buyer: {t.buyer?.first_name} {t.buyer?.last_name}</div>
                  <div style={{ fontSize:11, color:"#555", marginBottom:2 }}>Seller: {t.seller?.first_name} {t.seller?.last_name}</div>
                  <div style={{ fontSize:11, color:t.buyer_confirmed?"#1d9e75":"#e6821e" }}>{t.buyer_confirmed?"✓ Buyer confirmed":"⏳ Awaiting buyer confirmation"}</div>
                  <div style={{ fontSize:10, color:"#444", marginTop:4 }}>{new Date(t.created_at).toLocaleString()}</div>
                </div>
                <div style={{ textAlign:"right" }}>
                  <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:800, color:"#e6821e" }}>KES {Number(t.sale_price).toLocaleString()}</div>
                  <div style={{ fontSize:11, color:"#1d9e75", marginTop:2 }}>Platform: KES {Number(t.platform_commission).toLocaleString()}</div>
                  <div style={{ fontSize:11, color:"#555" }}>Seller: KES {Number(t.seller_earnings).toLocaleString()}</div>
                  <span style={{ fontSize:10, padding:"2px 8px", borderRadius:10, background:"#1a1a1a", color:"#888", marginTop:4, display:"inline-block" }}>{t.payment_status}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* DISPUTES TAB */}
      {tab==="disputes"&&(
        <div>
          {disputes.length===0&&<div style={{ color:"#444", fontSize:13, textAlign:"center", padding:"2rem" }}>No disputes</div>}
          {disputes.map(d=>(
            <div key={d.id} style={{ background:"#111", border:`1px solid ${d.status==="open"?"#e24b4a20":"#1e1e1e"}`, borderRadius:10, padding:"1rem", marginBottom:8 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                <div>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                    <div style={{ fontSize:13, fontWeight:600, color:"#f0ede6" }}>{d.reason}</div>
                    <span style={{ fontSize:10, padding:"2px 8px", borderRadius:10, background:d.status==="open"?"#1a0808":"#111", color:d.status==="open"?"#e24b4a":"#555" }}>{d.status}</span>
                  </div>
                  <div style={{ fontSize:11, color:"#555", marginBottom:2 }}>Raised by: {d.profiles?.first_name} {d.profiles?.last_name}</div>
                  {d.description&&<div style={{ fontSize:11, color:"#888", fontStyle:"italic" }}>"{d.description}"</div>}
                  <div style={{ fontSize:10, color:"#444", marginTop:4 }}>{new Date(d.created_at).toLocaleString()}</div>
                </div>
                <div style={{ textAlign:"right" }}>
                  <div style={{ fontFamily:"Syne", fontSize:13, fontWeight:700, color:"#e6821e" }}>KES {Number(d.marketplace_transactions?.sale_price||0).toLocaleString()}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
