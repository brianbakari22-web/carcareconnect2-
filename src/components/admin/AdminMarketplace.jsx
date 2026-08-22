import { LocationIcon, EyeIcon, VehicleIcon, WarningIcon } from "../../lib/cccIcons"
import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"
import { useAuth } from "../../contexts/AuthContext"
import useIsMobile from "../../lib/useIsMobile"
import toast from "react-hot-toast"

export default function AdminMarketplace() {
  const isMobile = useIsMobile()
  const { user } = useAuth()
  const [listings, setListings] = useState([])
  const [selectedComments, setSelectedComments] = useState([])
  const [showComments, setShowComments] = useState(null)
  const [offers, setOffers] = useState([])
  const [transactions, setTransactions] = useState([])
  const [disputes, setDisputes] = useState([])
  const [mechanics, setMechanics] = useState([])
  const [allCCCMechanics, setAllCCCMechanics] = useState([])
  const [inspections, setInspections] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState("pending")
  const [selected, setSelected] = useState(null)
  const [adminNotes, setAdminNotes] = useState("")
  const [processing, setProcessing] = useState(false)
  const [search, setSearch] = useState("")
  const [showAddMech, setShowAddMech] = useState(false)
  const [mechForm, setMechForm] = useState({ first_name:"", last_name:"", phone:"", specialization:"" })
  const [addingMech, setAddingMech] = useState(false)
  const [pinPanel, setPinPanel] = useState(null)
  const [pin, setPin] = useState("")
  const [settingPin, setSettingPin] = useState(false)
  const [editingMech, setEditingMech] = useState(null)
  const [editForm, setEditForm] = useState({ first_name:"", last_name:"", phone:"", specialization:"" })
  const [savingEdit, setSavingEdit] = useState(false)

  useEffect(() => {
    load()
    const sub = supabase.channel("admin-marketplace-live")
      .on("postgres_changes", { event:"*", schema:"public", table:"marketplace_listings" }, () => load())
      .on("postgres_changes", { event:"*", schema:"public", table:"marketplace_offers" }, () => loadOffers())
      .subscribe()
    return () => supabase.removeChannel(sub)
  }, [])

  async function load() {
    await Promise.all([loadListings(), loadOffers(), loadTransactions(), loadDisputes(), loadInspections(), loadAllCCCMechanics()])
    supabase.from("mechanics").select("id,first_name,last_name,specialization").eq("is_active",true).is("provider_id", null)
      .then(({ data }) => setMechanics(data||[]))
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

  async function loadInspections() {
    const { data } = await supabase.from("inspection_requests")
      .select("*, marketplace_listings(title), profiles(first_name,last_name)")
      .order("created_at",{ascending:false})
    setInspections(data||[])
  }

  async function addCCCMechanic(e) {
    e.preventDefault()
    if (!mechForm.first_name) return toast.error("First name required")
    setAddingMech(true)
    try {
      // CCC's own in-house inspection mechanic - no provider_id at all, since these
      // aren't tied to any provider's own garage/team.
      const accountRes = await fetch("https://gcnefnqtjxtqbhynyoxe.supabase.co/functions/v1/create-mechanic-account", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdjbmVmbnF0anh0cWJoeW55b3hlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2MDg0MzIsImV4cCI6MjA5NTE4NDQzMn0.Ybyce3psBj2I-hdoF95H5UAklr6hsgQi-mciI9uMIgc" },
        body: JSON.stringify({ first_name: mechForm.first_name, last_name: mechForm.last_name, phone: mechForm.phone })
      })
      const accountData = await accountRes.json()
      if (!accountData.success) throw new Error(accountData.error || "Failed to create mechanic account")
      const { error: mechError } = await supabase.from("mechanics").insert({
        provider_id: null,
        user_id: accountData.user_id,
        first_name: mechForm.first_name,
        last_name: mechForm.last_name,
        phone: mechForm.phone,
        specialization: mechForm.specialization || "Vehicle Inspection",
        is_active: true,
        is_available: true,
      })
      if (mechError) throw mechError
      toast.success("CCC mechanic added!")
      setMechForm({ first_name:"", last_name:"", phone:"", specialization:"" })
      setShowAddMech(false)
      const { data } = await supabase.from("mechanics").select("id,first_name,last_name,specialization").eq("is_active",true).is("provider_id", null)
      setMechanics(data||[])
    } catch(err) { toast.error(err.message) }
    finally { setAddingMech(false) }
  }
  async function setMechanicPin(mechanicId) {
    if (!pin||pin.length<4) return toast.error("PIN must be at least 4 digits")
    setSettingPin(true)
    try {
      const { error } = await supabase.rpc("set_mechanic_pin", { p_mechanic_id: mechanicId, p_pin: pin })
      if (error) throw error
      toast.success("PIN set! Mechanic can now login at carcareconnect.care/mechanic-login")
      setPinPanel(null)
      setPin("")
    } catch(err) { toast.error(err.message) }
    finally { setSettingPin(false) }
  }
  async function setMechanicPin(mechanicId) {
    if (!pin||pin.length<4) return toast.error("PIN must be at least 4 digits")
    setSettingPin(true)
    try {
      const { error } = await supabase.rpc("set_mechanic_pin", { p_mechanic_id: mechanicId, p_pin: pin })
      if (error) throw error
      toast.success("PIN set! Mechanic can now login at carcareconnect.care/mechanic-login")
      setPinPanel(null)
      setPin("")
    } catch(err) { toast.error(err.message) }
    finally { setSettingPin(false) }
  }
  async function loadAllCCCMechanics() {
    // Deliberately no is_active filter here, unlike the mechanics state used for the
    // Assign dropdown - admin needs to see (and reactivate) deactivated mechanics too,
    // not just currently-active ones.
    const { data } = await supabase.from("mechanics").select("id,first_name,last_name,phone,specialization,is_active,is_available,mechanic_code").is("provider_id", null).order("first_name")
    setAllCCCMechanics(data||[])
  }
  async function toggleMechActive(m) {
    await supabase.from("mechanics").update({ is_active: !m.is_active }).eq("id", m.id)
    toast.success(m.is_active?"Mechanic deactivated":"Mechanic activated")
    loadAllCCCMechanics()
    const { data } = await supabase.from("mechanics").select("id,first_name,last_name,specialization").eq("is_active",true).is("provider_id", null)
    setMechanics(data||[])
  }
  async function toggleMechAvailable(m) {
    await supabase.from("mechanics").update({ is_available: !m.is_available }).eq("id", m.id)
    loadAllCCCMechanics()
  }
  function startEditMech(m) {
    setEditingMech(m.id)
    setEditForm({ first_name: m.first_name||"", last_name: m.last_name||"", phone: m.phone||"", specialization: m.specialization||"" })
  }
  async function saveEditMech(mechanicId) {
    if (!editForm.first_name) return toast.error("First name required")
    setSavingEdit(true)
    try {
      const { error } = await supabase.from("mechanics").update({
        first_name: editForm.first_name, last_name: editForm.last_name,
        phone: editForm.phone, specialization: editForm.specialization,
      }).eq("id", mechanicId)
      if (error) throw error
      toast.success("Mechanic details updated")
      setEditingMech(null)
      loadAllCCCMechanics()
    } catch(err) { toast.error(err.message) }
    finally { setSavingEdit(false) }
  }
  async function loadDisputes() {
    const { data } = await supabase.from("marketplace_disputes")
      .select("*, marketplace_transactions(sale_price), profiles(first_name,last_name)")
      .order("created_at", { ascending:false })
    setDisputes(data||[])
  }

  async function requestInspection(listing) {
    setProcessing(true)
    try {
      await supabase.from("inspection_requests").insert({
        listing_id: listing.id,
        seller_id: listing.seller_id,
        status: "pending",
        fee: 500,
        notes: adminNotes||""
      })
      await supabase.from("marketplace_listings").update({ inspection_status:"requested" }).eq("id", listing.id)
      await supabase.from("notifications").insert({
        user_id: listing.seller_id,
        title: "Vehicle inspection required 🔍",
        message: "Your listing " + listing.title + " requires a CCC inspection (KES " + currentFee.toLocaleString() + ") before it can go live. Please go to My Listings to schedule and pay.",
        type: "warning"
      })
      toast.success("Inspection requested — seller notified")
      setSelected(null)
      load()
    } catch(e) { toast.error(e.message) }
    finally { setProcessing(false) }
  }

  async function passInspection(listing) {
    setProcessing(true)
    try {
      await supabase.from("marketplace_listings").update({ is_inspected:true, inspection_status:"passed" }).eq("id", listing.id)
      await supabase.from("inspection_requests").update({ status:"completed", result:"passed" }).eq("listing_id", listing.id)
      await supabase.from("notifications").insert({
        user_id: listing.seller_id,
        title: "Vehicle passed inspection! ✅",
        message: "Your listing " + listing.title + " passed CCC inspection and is ready for approval.",
        type: "success"
      })
      toast.success("Inspection passed")
      load()
    } catch(e) { toast.error(e.message) }
    finally { setProcessing(false) }
  }

  async function loadListingComments(listingId) {
    const { data } = await supabase.from("marketplace_comments")
      .select("*, profiles(first_name, last_name)")
      .eq("listing_id", listingId)
      .eq("is_deleted", false)
      .order("created_at", { ascending: false })
    return data||[]
  }

  async function deleteComment(commentId) {
    await supabase.from("marketplace_comments")
      .update({ is_deleted: true })
      .eq("id", commentId)
    toast.success("Comment removed")
    // Refresh selected listing comments
    if (selectedComments.length > 0) {
      setSelectedComments(prev => prev.filter(c => c.id !== commentId))
    }
  }

  async function approveVideo(id) {
    await supabase.from("marketplace_listings").update({ video_status:"approved" }).eq("id", id)
    setListings(ls => ls.map(l => l.id===id ? {...l, video_status:"approved"} : l))
    toast.success("Video approved and visible to public")
  }

  async function rejectVideo(id, reason) {
    await supabase.from("marketplace_listings").update({ video_status:"rejected", video_rejection_reason:reason||"Does not meet guidelines" }).eq("id", id)
    setListings(ls => ls.map(l => l.id===id ? {...l, video_status:"rejected"} : l))
    toast.success("Video rejected")
  }

  async function approveListing(id) {
    const listing = listings.find(l=>l.id===id)
    if (listing?.listing_type==="vehicle" && !listing?.is_inspected) {
      toast.error("Cannot approve vehicle listing without CCC inspection. Request inspection first.")
      return
    }
    setProcessing(true)
    try {
      const { error } = await supabase.from("marketplace_listings").update({ status:"active", admin_notes:adminNotes||null }).eq("id",id)
      if (error) throw error
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
      // This same "Mark as failed" action doubles as a real inspection-fail path (the button in
      // the inspection section calls this directly, no dedicated fail function existed before).
      // Close out the stale inspection_status/inspection_requests so the seller can cleanly
      // request a fresh inspection if they edit and resubmit, rather than leaving both stuck
      // forever at "requested" with no result ever recorded.
      if (listing?.listing_type==="vehicle" && listing?.inspection_status==="requested") {
        await supabase.from("marketplace_listings").update({ inspection_status:"failed" }).eq("id",id)
        await supabase.from("inspection_requests").update({ status:"completed", result:"failed" }).eq("listing_id",id).eq("status","scheduled")
      }
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

  async function resolveDispute(dispute, resolution) {
    if (!confirm(`Rule in favour of ${resolution==="buyer"?"buyer (refund)":"seller (release funds)"}?`)) return
    try {
      const tx = transactions.find(t=>t.id===dispute.transaction_id)
      
      // Update dispute
      await supabase.from("marketplace_disputes").update({
        status: "resolved",
        resolution: resolution==="buyer" ? "Refund issued to buyer" : "Funds released to seller",
        resolved_at: new Date().toISOString(),
        resolved_by: user.id,
      }).eq("id", dispute.id)

      // Update transaction
      await supabase.from("marketplace_transactions").update({
        payment_status: resolution==="buyer" ? "refunded" : "released",
        escrow_released: resolution==="seller",
        escrow_released_at: resolution==="seller" ? new Date().toISOString() : null,
      }).eq("id", dispute.transaction_id)

      if (resolution==="seller" && tx) {
        // Create payout request for seller
        await supabase.from("payout_requests").insert({
          user_id: tx.seller_id,
          amount: tx.seller_earnings,
          status: "pending",
        })
        await supabase.from("notifications").insert({
          user_id: tx.seller_id,
          title: "Dispute resolved in your favour 🎉",
          message: `The dispute has been resolved. KES ${Number(tx?.seller_earnings||0).toLocaleString()} payout has been requested. Add your bank details under Payouts to receive it.`,
          type: "success",
        })
        await supabase.from("notifications").insert({
          user_id: dispute.raised_by,
          title: "Dispute resolved",
          message: "After review, the dispute was resolved in the seller's favour. Funds have been released.",
          type: "info",
        })
      } else if (resolution==="buyer" && tx) {
        // Create refund payout request for buyer
        await supabase.from("payout_requests").insert({
          user_id: tx.buyer_id,
          amount: tx.sale_price,
          status: "pending",
        })
        await supabase.from("notifications").insert({
          user_id: tx.buyer_id,
          title: "Dispute resolved — Refund incoming 💰",
          message: `The dispute has been resolved in your favour. KES ${Number(tx?.sale_price||0).toLocaleString()} refund has been requested.`,
          type: "success",
        })
        await supabase.from("notifications").insert({
          user_id: tx?.seller_id,
          title: "Dispute resolved",
          message: "After review, the dispute was resolved in the buyer's favour. A refund has been issued.",
          type: "info",
        })
      }

      toast.success(`Dispute resolved in ${resolution}'s favour`)
      load()
    } catch(err) { toast.error(err.message) }
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
    { k:"inspections", l:`Inspections (${inspections.filter(i=>i.status==="pending").length})` },
    { k:"disputes", l:`Disputes (${disputes.filter(d=>d.status==="open").length})` },
  ]

  return (
    <div>
      {/* Stats */}
      <div style={{ display:"grid", gridTemplateColumns:isMobile?"repeat(2,1fr)":"repeat(4,1fr)", gap:10, marginBottom:"1.5rem" }}>
        {[
          { label:"Total listings", value:listings.length, color:"#000000" },
          { label:"Pending review", value:pendingListings.length, color:"#e6821e" },
          { label:"Active listings", value:activeListings.length, color:"#1d9e75" },
          { label:"Platform revenue", value:`KES ${totalRevenue.toLocaleString()}`, color:"#8b5cf6" },
        ].map(s=>(
          <div key={s.label} style={{ background:"#f8f8f8", borderRadius:10, padding:isMobile?"0.75rem":"1rem", border:"1px solid #eeeeee" }}>
            <div style={{ fontSize:10, color:"#888", textTransform:"uppercase", marginBottom:4 }}>{s.label}</div>
            <div style={{ fontFamily:"Syne", fontSize:isMobile?14:18, fontWeight:800, color:s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Pending alert */}
      {pendingListings.length>0&&(
        <div style={{ background:"#fff8f0", border:"1px solid #e6821e40", borderRadius:10, padding:"0.9rem", marginBottom:"1.25rem" }}>
          <div style={{ fontSize:13, color:"#e6821e", fontWeight:600 }}>⏳ {pendingListings.length} listing{pendingListings.length>1?"s":""} waiting for review</div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display:"flex", gap:6, marginBottom:"1.25rem", flexWrap:"wrap" }}>
        {TABS.map(t=>(
          <button key={t.k} onClick={()=>setTab(t.k)}
            style={{ padding:"7px 14px", borderRadius:8, border:"none", fontSize:12, cursor:"pointer", background:tab===t.k?"#8b5cf6":"#f8f8f8", color:tab===t.k?"#fff":"#666", fontFamily:"'DM Sans',sans-serif", fontWeight:tab===t.k?700:400 }}>
            {t.l}
          </button>
        ))}
      </div>

      {/* Search */}
      {["pending","active","rejected"].includes(tab)&&(
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search listings..."
          style={{ width:"100%", background:"#f8f8f8", border:"1px solid #f0f0f0", borderRadius:8, padding:"9px 12px", color:"#000000", fontSize:13, outline:"none", marginBottom:"1rem", fontFamily:"'DM Sans',sans-serif" }}/>
      )}

      {loading&&<div style={{ color:"#888", fontSize:13 }}>Loading...</div>}

      {/* LISTINGS TABS */}
      {["pending","active","rejected"].includes(tab)&&(
        <div>
          {filtered.length===0&&<div style={{ color:"#888", fontSize:13, textAlign:"center", padding:"2rem" }}>No listings</div>}
          {filtered.map(l=>{
            const seller = l.profiles
            return (
              <div key={l.id} style={{ background:"#f8f8f8", border:`1px solid ${SC[l.status]||"#eeeeee"}20`, borderRadius:12, padding:"1rem", marginBottom:10 }}>
                {/* Photo thumbnail */}
                {l.primary_photo&&(
                  <div style={{ width:"100%", height:160, borderRadius:8, overflow:"hidden", marginBottom:10 }}>
                    <img src={l.primary_photo} alt={l.title} style={{ width:"100%", height:"100%", objectFit:"cover" }}/>
                  </div>
                )}
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4, flexWrap:"wrap" }}>
                      <span style={{ fontSize:16 }}>{l.listing_type==="vehicle"?"🚗":l.listing_type==="part"?"🔧":"✨"}</span>
                      <div style={{ fontSize:13, fontWeight:600, color:"#000000" }}>{l.title}</div>
                      <span style={{ fontSize:10, padding:"2px 8px", borderRadius:10, background:`${SC[l.status]||"#888"}20`, color:SC[l.status]||"#888" }}>{l.status}</span>
                      {l.is_featured&&<span style={{ fontSize:10, color:"#e6821e" }}>⭐ Featured</span>}
                    </div>
                    <div style={{ fontSize:11, color:"#888", marginBottom:2 }}>
                      👤 {seller?.business_name||`${seller?.first_name} ${seller?.last_name}`} · {seller?.role}
                    </div>
                    {l.listing_type==="vehicle"&&<div style={{ fontSize:11, color:"#888", marginBottom:2 }}>{[l.make,l.model,l.year].filter(Boolean).join(" ")}{l.mileage?` · ${Number(l.mileage).toLocaleString()}km`:""}</div>}
                    {l.city&&<div style={{ fontSize:11, color:"#888", marginBottom:2 }}>📍 {l.city}</div>}
                    {l.admin_notes&&<div style={{ fontSize:11, color:"#378add", marginTop:4 }}>Admin note: &quot;{l.admin_notes}&quot;</div>}
                    <div style={{ fontSize:10, color:"#888", marginTop:4 }}>{new Date(l.created_at).toLocaleString()} · 👁 {l.views||0} views</div>
                  </div>
                  <div style={{ textAlign:"right", flexShrink:0 }}>
                    <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:800, color:"#e6821e" }}>KES {Number(l.price).toLocaleString()}</div>
                    <div style={{ fontSize:10, color:"#888", marginTop:2 }}>{l.negotiable?"Negotiable":"Fixed price"}</div>
                    <div style={{ fontSize:10, color:"#888" }}>Commission: {Math.round((l.commission_rate||0.08)*100)}%</div>
                  </div>
                </div>

                <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                  {l.status==="pending"&&(
                    <>
                      <button onClick={()=>{ setSelected(selected===l.id?null:l.id); setAdminNotes("") }}
                        style={{ background:"#f5f3ff", border:"1px solid #8b5cf640", borderRadius:7, color:"#8b5cf6", fontSize:11, padding:"5px 10px", cursor:"pointer" }}>
                        Review
                      </button>
                    </>
                  )}
                  {l.status==="active"&&(
                    <>
                      <button onClick={()=>featureListing(l.id,!l.is_featured)}
                        style={{ background:l.is_featured?"#fff8f0":"#fff8f0", border:`1px solid ${l.is_featured?"#e24b4a40":"#e6821e40"}`, borderRadius:7, color:l.is_featured?"#e24b4a":"#e6821e", fontSize:11, padding:"5px 10px", cursor:"pointer" }}>
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
                      style={{ background:"#f0fdf4", border:"1px solid #1d9e7540", borderRadius:7, color:"#1d9e75", fontSize:11, padding:"5px 10px", cursor:"pointer" }}>
                      Reactivate
                    </button>
                  ):null}
                </div>

                {selected===l.id&&l.status==="pending"&&(
                  <div style={{ marginTop:10, borderTop:"1px solid #eeeeee", paddingTop:10 }}>
                    <div style={{ fontFamily:"Syne", fontSize:13, fontWeight:700, color:"#000000", marginBottom:8 }}>Review listing</div>

                    {/* Description preview */}
                    {l.description&&(
                      <div style={{ background:"#ffffff", borderRadius:8, padding:"0.75rem", marginBottom:10, fontSize:12, color:"#888", lineHeight:1.6 }}>
                        {l.description.replace(/\*\*/g,"").replace(/\*/g,"").replace(/#{1,6} /g,"").replace(/- /g,"• ")}
                      </div>
                    )}

                    {/* Comments Moderation */}
                    <div style={{ marginTop:12, background:"#f8f8f8", borderRadius:10, padding:"1rem" }}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                        <div style={{ fontSize:12, fontWeight:700, color:"#555" }}>💬 Comments ({l.comments_count||0})</div>
                        <button onClick={async()=>{
                          if (showComments===l.id) { setShowComments(null); setSelectedComments([]) }
                          else { const data = await loadListingComments(l.id); setSelectedComments(data); setShowComments(l.id) }
                        }} style={{ background:"#378add", border:"none", borderRadius:6, color:"#fff", fontSize:10, fontWeight:700, padding:"4px 10px", cursor:"pointer" }}>
                          {showComments===l.id?"Hide":"View Comments"}
                        </button>
                      </div>
                      {showComments===l.id&&(
                        <div>
                          {selectedComments.length===0&&<div style={{ fontSize:11, color:"#888", textAlign:"center", padding:8 }}>No comments yet</div>}
                          {selectedComments.map(cm=>(
                            <div key={cm.id} style={{ display:"flex", gap:8, alignItems:"flex-start", marginBottom:8, background:"#ffffff", borderRadius:8, padding:"8px 10px" }}>
                              <div style={{ flex:1 }}>
                                <div style={{ fontSize:11, fontWeight:700, color:"#000" }}>{cm.profiles?.first_name} {cm.profiles?.last_name}</div>
                                <div style={{ fontSize:11, color:"#444", marginTop:2 }}>{cm.comment}</div>
                                <div style={{ fontSize:9, color:"#888", marginTop:2 }}>{new Date(cm.created_at).toLocaleString()}</div>
                              </div>
                              <button onClick={()=>deleteComment(cm.id)}
                                style={{ background:"#fff5f5", border:"1px solid #e24b4a30", borderRadius:6, color:"#e24b4a", fontSize:10, fontWeight:700, padding:"3px 8px", cursor:"pointer", flexShrink:0 }}>
                                🗑️ Remove
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div style={{ marginBottom:10 }}>
                      <label style={{ fontSize:11, color:"#888", display:"block", marginBottom:4 }}>Admin notes (required for rejection)</label>
                      <textarea value={adminNotes} onChange={e=>setAdminNotes(e.target.value)}
                        placeholder="Add notes..."
                        style={{ width:"100%", background:"#ffffff", border:"1px solid #f0f0f0", borderRadius:8, padding:"9px 12px", color:"#000000", fontSize:12, outline:"none", resize:"vertical", minHeight:60, fontFamily:"'DM Sans',sans-serif" }}/>
                    </div>

                    {/* Photo gallery */}
                    {l.marketplace_photos?.length>0&&(
                      <div style={{ marginBottom:12 }}>
                        <div style={{ fontSize:12, fontWeight:700, color:"#555", marginBottom:8 }}>📸 Photos ({l.marketplace_photos.length})</div>
                        <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                          {l.marketplace_photos.sort((a,b)=>a.display_order-b.display_order).map((p,i)=>(
                            <a key={i} href={p.photo_url} target="_blank" rel="noopener noreferrer">
                              <img src={p.photo_url} alt="" style={{ width:70, height:70, objectFit:"cover", borderRadius:6, border:"1px solid #eeeeee" }}/>
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                    {l.video_url&&(
                      <div style={{ marginTop:12, background:"#f8f8f8", borderRadius:10, padding:"1rem" }}>
                        <div style={{ fontSize:12, fontWeight:700, color:"#555", marginBottom:8 }}>
                          🎥 Video Review
                          <span style={{ marginLeft:8, fontSize:10, padding:"2px 8px", borderRadius:10,
                            background:l.video_status==="approved"?"#f0fdf4":l.video_status==="rejected"?"#fff5f5":"#fff8f0",
                            color:l.video_status==="approved"?"#1d9e75":l.video_status==="rejected"?"#e24b4a":"#e6821e" }}>
                            {l.video_status==="approved"?"✓ Approved":l.video_status==="rejected"?"✗ Rejected":"⏳ Pending Review"}
                          </span>
                        </div>
                        <video src={l.video_url} controls style={{ width:"100%", borderRadius:8, maxHeight:200, marginBottom:8 }}/>
                        <div style={{ display:"flex", gap:8 }}>
                          {l.video_status!=="approved"&&(
                            <button onClick={()=>approveVideo(l.id)}
                              style={{ background:"#f0fdf4", border:"1px solid #1d9e7540", borderRadius:7, color:"#1d9e75", fontSize:11, fontWeight:700, padding:"6px 14px", cursor:"pointer" }}>
                              ✓ Approve Video
                            </button>
                          )}
                          {l.video_status!=="rejected"&&(
                            <button onClick={()=>{ const r=window.prompt("Reason for rejection?","Does not meet content guidelines"); if(r!==null) rejectVideo(l.id,r) }}
                              style={{ background:"#fff5f5", border:"1px solid #e24b4a40", borderRadius:7, color:"#e24b4a", fontSize:11, fontWeight:700, padding:"6px 14px", cursor:"pointer" }}>
                              ✗ Reject Video
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>

                      {/* Vehicle inspection workflow */}
                      {l.listing_type==="vehicle"&&!l.is_inspected&&l.inspection_status!=="requested"&&(
                        <button onClick={()=>requestInspection(l)} disabled={processing}
                          style={{ background:"#fff8f0", border:"1px solid #e6821e40", borderRadius:8, color:"#e6821e", fontSize:12, fontWeight:700, padding:"9px 18px", cursor:processing?"not-allowed":"pointer" }}>
                          🔍 Request inspection
                        </button>
                      )}

                      {l.listing_type==="vehicle"&&l.inspection_status==="requested"&&!l.is_inspected&&(
                        <div style={{ width:"100%", background:"#eff6ff", border:"1px solid #378add40", borderRadius:8, padding:"0.75rem", marginBottom:8 }}>
                          <div style={{ fontSize:11, color:"#378add", fontWeight:600, marginBottom:8 }}>🔍 Inspection in progress</div>
                          <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                            <button onClick={()=>passInspection(l)} disabled={processing}
                              style={{ background:"#1d9e75", border:"none", borderRadius:7, color:"#fff", fontSize:11, fontWeight:700, padding:"7px 14px", cursor:"pointer" }}>
                              ✓ Mark as passed
                            </button>
                            <button onClick={()=>rejectListing(l.id)} disabled={processing}
                              style={{ background:"none", border:"1px solid #e24b4a40", borderRadius:7, color:"#e24b4a", fontSize:11, padding:"7px 12px", cursor:"pointer" }}>
                              ✗ Mark as failed
                            </button>
                          </div>
                        </div>
                      )}

                      {l.is_inspected&&(
                        <div style={{ fontSize:11, color:"#1d9e75", padding:"7px 12px", background:"#f0fdf4", borderRadius:8, border:"1px solid #1d9e7540" }}>
                          ✓ CCC Inspected
                        </div>
                      )}

                      <button onClick={()=>approveListing(l.id)} disabled={processing||(l.listing_type==="vehicle"&&!l.is_inspected)}
                        style={{ background:processing||(l.listing_type==="vehicle"&&!l.is_inspected)?"#e0e0e0":"#1d9e75", border:"none", borderRadius:8, color:processing||(l.listing_type==="vehicle"&&!l.is_inspected)?"#555":"#fff", fontFamily:"Syne,sans-serif", fontSize:12, fontWeight:700, padding:"9px 18px", cursor:processing||(l.listing_type==="vehicle"&&!l.is_inspected)?"not-allowed":"pointer" }}>
                        {l.listing_type==="vehicle"&&!l.is_inspected?"🔒 Inspect first":"✓ Approve & publish"}
                      </button>

                      <button onClick={()=>rejectListing(l.id)} disabled={processing}
                        style={{ background:"none", border:"1px solid #e24b4a40", borderRadius:8, color:"#e24b4a", fontSize:12, padding:"9px 14px", cursor:processing?"not-allowed":"pointer" }}>
                        Reject
                      </button>
                      <button onClick={()=>setSelected(null)}
                        style={{ background:"none", border:"1px solid #dddddd", borderRadius:8, color:"#888", fontSize:12, padding:"9px 14px", cursor:"pointer" }}>
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
          {offers.length===0&&<div style={{ color:"#888", fontSize:13, textAlign:"center", padding:"2rem" }}>No offers yet</div>}
          {offers.map(o=>(
            <div key={o.id} style={{ background:"#f8f8f8", border:"1px solid #eeeeee", borderRadius:10, padding:"1rem", marginBottom:8 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                <div>
                  <div style={{ fontSize:13, fontWeight:600, color:"#000000", marginBottom:4 }}>{o.marketplace_listings?.title}</div>
                  <div style={{ fontSize:11, color:"#888", marginBottom:2 }}>
                    Asking: KES {Number(o.marketplace_listings?.price||0).toLocaleString()}
                  </div>
                  <div style={{ fontSize:11, color:"#888", marginBottom:2 }}>
                    Buyer: {o.buyer?.first_name} {o.buyer?.last_name}
                  </div>
                  <div style={{ fontSize:11, color:"#888", marginBottom:4 }}>
                    Seller: {o.seller?.first_name} {o.seller?.last_name}
                  </div>
                  {o.message&&<div style={{ fontSize:11, color:"#888", fontStyle:"italic" }}>&quot;{o.message}&quot;</div>}
                  <div style={{ fontSize:10, color:"#888", marginTop:4 }}>{new Date(o.created_at).toLocaleString()}</div>
                </div>
                <div style={{ textAlign:"right" }}>
                  <div style={{ fontFamily:"Syne", fontSize:15, fontWeight:800, color:"#e6821e" }}>KES {Number(o.offered_price).toLocaleString()}</div>
                  {o.counter_price&&<div style={{ fontSize:11, color:"#8b5cf6", marginTop:2 }}>Counter: KES {Number(o.counter_price).toLocaleString()}</div>}
                  <span style={{ fontSize:10, padding:"2px 8px", borderRadius:10, background:"#f5f5f5", color:"#888", marginTop:4, display:"inline-block" }}>{o.status}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TRANSACTIONS TAB */}
      {tab==="transactions"&&(
        <div>
          {transactions.length===0&&<div style={{ color:"#888", fontSize:13, textAlign:"center", padding:"2rem" }}>No transactions yet</div>}
          {transactions.map(t=>(
            <div key={t.id} style={{ background:"#f8f8f8", border:"1px solid #eeeeee", borderRadius:10, padding:"1rem", marginBottom:8 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                <div>
                  <div style={{ fontSize:13, fontWeight:600, color:"#000000", marginBottom:4 }}>{t.marketplace_listings?.title}</div>
                  <div style={{ fontSize:11, color:"#888", marginBottom:2 }}>Buyer: {t.buyer?.first_name} {t.buyer?.last_name}</div>
                  <div style={{ fontSize:11, color:"#888", marginBottom:2 }}>Seller: {t.seller?.first_name} {t.seller?.last_name}</div>
                  <div style={{ fontSize:11, color:t.buyer_confirmed?"#1d9e75":"#e6821e" }}>{t.buyer_confirmed?"✓ Buyer confirmed":"⏳ Awaiting buyer confirmation"}</div>
                  <div style={{ fontSize:10, color:"#888", marginTop:4 }}>{new Date(t.created_at).toLocaleString()}</div>
                </div>
                <div style={{ textAlign:"right" }}>
                  <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:800, color:"#e6821e" }}>KES {Number(t.sale_price).toLocaleString()}</div>
                  <div style={{ fontSize:11, color:"#1d9e75", marginTop:2 }}>Platform: KES {Number(t.platform_commission).toLocaleString()}</div>
                  <div style={{ fontSize:11, color:"#888" }}>Seller: KES {Number(t.seller_earnings).toLocaleString()}</div>
                  <span style={{ fontSize:10, padding:"2px 8px", borderRadius:10, background:"#f5f5f5", color:"#888", marginTop:4, display:"inline-block" }}>{t.payment_status}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab==="inspections"&&(
        <div>
          <div style={{ background:"#f8f8f8", border:"1px solid #eeeeee", borderRadius:10, padding:"0.75rem", marginBottom:16 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom: showAddMech?10:0 }}>
              <div style={{ fontSize:12, fontWeight:700, color:"#000" }}>CCC Inspection Mechanics ({mechanics.length})</div>
              <button onClick={()=>setShowAddMech(!showAddMech)} style={{ background:"#e6821e", border:"none", borderRadius:7, color:"#fff", fontSize:11, padding:"5px 12px", cursor:"pointer" }}>{showAddMech?"Cancel":"+ Add mechanic"}</button>
            </div>
            {showAddMech&&(
              <form onSubmit={addCCCMechanic} style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:8, marginTop:8 }}>
                <input placeholder="First name" value={mechForm.first_name} onChange={e=>setMechForm(f=>({...f,first_name:e.target.value}))} required style={{ fontSize:12, border:"1px solid #ddd", borderRadius:6, padding:"7px 10px", outline:"none" }}/>
                <input placeholder="Last name" value={mechForm.last_name} onChange={e=>setMechForm(f=>({...f,last_name:e.target.value}))} style={{ fontSize:12, border:"1px solid #ddd", borderRadius:6, padding:"7px 10px", outline:"none" }}/>
                <input placeholder="Phone" value={mechForm.phone} onChange={e=>setMechForm(f=>({...f,phone:e.target.value}))} style={{ fontSize:12, border:"1px solid #ddd", borderRadius:6, padding:"7px 10px", outline:"none" }}/>
                <input placeholder="Specialization (optional)" value={mechForm.specialization} onChange={e=>setMechForm(f=>({...f,specialization:e.target.value}))} style={{ fontSize:12, border:"1px solid #ddd", borderRadius:6, padding:"7px 10px", outline:"none" }}/>
                <button type="submit" disabled={addingMech} style={{ gridColumn:"span 2", background:"#1d9e75", border:"none", borderRadius:7, color:"#fff", fontSize:12, fontWeight:700, padding:"8px", cursor:addingMech?"not-allowed":"pointer" }}>{addingMech?"Creating...":"Create mechanic account"}</button>
              </form>
            )}
            {allCCCMechanics.length>0&&(
              <div style={{ marginTop:10, display:"grid", gap:6 }}>
                {allCCCMechanics.map(m=>(
                  <div key={m.id} style={{ background:"#ffffff", border:"1px solid #eeeeee", borderRadius:8, padding:"0.5rem 0.75rem", opacity:m.is_active?1:0.55 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:4 }}>
                      <div>
                        <div style={{ fontSize:12, color:"#000" }}>{m.first_name} {m.last_name}{m.specialization?" - "+m.specialization:""}{!m.is_active&&<span style={{ marginLeft:6, fontSize:10, color:"#e24b4a" }}>(inactive)</span>}</div>
                        <div style={{ fontSize:10, color:"#888" }}>{m.phone||"No phone on file"}</div>
                      </div>
                      <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                        <button onClick={()=>startEditMech(m)} style={{ background:"none", border:"1px solid #ddd", borderRadius:6, color:"#555", fontSize:10, padding:"4px 10px", cursor:"pointer" }}>
                          Edit
                        </button>
                        <button onClick={()=>toggleMechAvailable(m)} style={{ background:m.is_available?"#f0fdf4":"#fff8f0", border:"1px solid "+(m.is_available?"#1d9e7540":"#e6821e40"), borderRadius:6, color:m.is_available?"#1d9e75":"#e6821e", fontSize:10, padding:"4px 10px", cursor:"pointer" }}>
                          {m.is_available?"Available":"Unavailable"}
                        </button>
                        <button onClick={()=>toggleMechActive(m)} style={{ background:"none", border:"1px solid "+(m.is_active?"#e24b4a40":"#1d9e7540"), borderRadius:6, color:m.is_active?"#e24b4a":"#1d9e75", fontSize:10, padding:"4px 10px", cursor:"pointer" }}>
                          {m.is_active?"Deactivate":"Activate"}
                        </button>
                        <button onClick={()=>{ setPinPanel(pinPanel===m.id?null:m.id); setPin("") }} style={{ background:"#eff6ff", border:"1px solid #378add40", borderRadius:6, color:"#378add", fontSize:10, padding:"4px 10px", cursor:"pointer" }}>
                          🔑 {m.mechanic_code?"Reset PIN":"Set PIN"}
                        </button>
                      </div>
                    </div>
                    {editingMech===m.id&&(
                      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6, marginTop:8 }}>
                        <input placeholder="First name" value={editForm.first_name} onChange={e=>setEditForm(f=>({...f,first_name:e.target.value}))} style={{ fontSize:12, border:"1px solid #ddd", borderRadius:6, padding:"6px 9px", outline:"none" }}/>
                        <input placeholder="Last name" value={editForm.last_name} onChange={e=>setEditForm(f=>({...f,last_name:e.target.value}))} style={{ fontSize:12, border:"1px solid #ddd", borderRadius:6, padding:"6px 9px", outline:"none" }}/>
                        <input placeholder="Phone" value={editForm.phone} onChange={e=>setEditForm(f=>({...f,phone:e.target.value}))} style={{ fontSize:12, border:"1px solid #ddd", borderRadius:6, padding:"6px 9px", outline:"none" }}/>
                        <input placeholder="Specialization" value={editForm.specialization} onChange={e=>setEditForm(f=>({...f,specialization:e.target.value}))} style={{ fontSize:12, border:"1px solid #ddd", borderRadius:6, padding:"6px 9px", outline:"none" }}/>
                        <button onClick={()=>saveEditMech(m.id)} disabled={savingEdit} style={{ gridColumn:"span 2", background:"#1d9e75", border:"none", borderRadius:6, color:"#fff", fontSize:11, fontWeight:700, padding:"7px", cursor:"pointer" }}>{savingEdit?"Saving...":"Save changes"}</button>
                      </div>
                    )}
                    {pinPanel===m.id&&(
                      <div style={{ display:"flex", gap:6, marginTop:8 }}>
                        <input type="password" value={pin} onChange={e=>setPin(e.target.value.replace(/\D/g,"").slice(0,6))} placeholder="e.g. 1234" maxLength={6} style={{ flex:1, background:"#f8f8f8", border:"1px solid #ddd", borderRadius:6, padding:"7px 10px", fontSize:13, letterSpacing:3, outline:"none" }}/>
                        <button onClick={()=>setMechanicPin(m.id)} disabled={settingPin||pin.length<4} style={{ background:pin.length>=4?"#378add":"#ccc", border:"none", borderRadius:6, color:"#fff", fontSize:11, fontWeight:700, padding:"7px 14px", cursor:"pointer", whiteSpace:"nowrap" }}>{settingPin?"Saving...":"Save PIN"}</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          {inspections.length===0&&<div style={{ color:"#888", fontSize:13, textAlign:"center", padding:"2rem" }}>No inspection requests</div>}
          {inspections.map(insp=>(
            <div key={insp.id} style={{ background:"#f8f8f8", border:`1px solid ${insp.status==="pending"?"#e6821e20":"#eeeeee"}`, borderRadius:10, padding:"1rem", marginBottom:8 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                <div>
                  <div style={{ fontSize:13, fontWeight:600, color:"#000000", marginBottom:4 }}>{insp.marketplace_listings?.title}</div>
                  <div style={{ fontSize:11, color:"#888", marginBottom:2 }}>Seller: {insp.profiles?.first_name} {insp.profiles?.last_name}</div>
                  <div style={{ fontSize:11, color:"#888", marginBottom:2 }}>Preferred date: {insp.scheduled_date}</div>
                  <span style={{ fontSize:10, padding:"2px 8px", borderRadius:10, background:"#fff8f0", color:"#e6821e" }}>{insp.status}</span>
                </div>
                <div style={{ textAlign:"right" }}>
                  <div style={{ fontFamily:"Syne", fontSize:13, fontWeight:700, color:"#1d9e75" }}>KES {Number(insp.amount).toLocaleString()}</div>
                  <div style={{ fontSize:10, color:insp.payment_status==="paid"?"#1d9e75":"#e24b4a", marginTop:2 }}>{insp.payment_status}</div>
                  {insp.status==="pending"&&(
                    <div style={{ marginTop:6 }}>
                    <select id={`mech-${insp.id}`} style={{ fontSize:11, border:"1px solid #ddd", borderRadius:6, padding:"4px 8px", marginRight:6, outline:"none" }}>
                      <option value="">Select mechanic...</option>
                      {mechanics.map(m=>(<option key={m.id} value={m.id}>{m.first_name} {m.last_name}{m.specialization?" — "+m.specialization:""}</option>))}
                    </select>
                    <button onClick={async()=>{
                      const mechId = document.getElementById(`mech-${insp.id}`)?.value
                      if (!mechId) return toast.error("Please select a mechanic")
                      const mech = mechanics.find(m=>m.id===mechId)
                      await supabase.from("inspection_requests").update({ status:"assigned", mechanic_id:mechId }).eq("id",insp.id)
                      await supabase.from("notifications").insert({ user_id:insp.seller_id, title:"Inspection assigned 🔍", message:`${mech?.first_name} ${mech?.last_name} has been assigned to inspect "${insp.marketplace_listings?.title}". Scheduled: ${insp.scheduled_date}`, type:"info" })
                      loadInspections()
                      toast.success("Mechanic assigned!")
                    }}
                      style={{ background:"#f0fdf4", border:"1px solid #1d9e7540", borderRadius:7, color:"#1d9e75", fontSize:10, padding:"4px 10px", cursor:"pointer" }}>
                      Assign
                    </button>
                  </div>
                  )}
                  {insp.status==="assigned"&&(
                    <button onClick={async()=>{
                      const result = prompt("Inspection result (passed/failed/conditional):")
                      const notes = prompt("Inspection notes:")
                      if (!result) return
                      await supabase.from("inspection_requests").update({ status:"completed", inspection_result:result, inspection_notes:notes, completed_at:new Date().toISOString() }).eq("id",insp.id)
                      if (result==="passed") await supabase.from("marketplace_listings").update({ is_inspected:true }).eq("id",insp.listing_id)
                      await supabase.from("notifications").insert({ user_id:insp.seller_id, title:"Inspection complete ✅", message:`Your vehicle inspection is complete. Result: ${result?.toUpperCase()}. ${notes}`, type:result==="passed"?"success":"warning" })
                      loadInspections()
                    }}
                      style={{ background:"#f5f3ff", border:"1px solid #8b5cf640", borderRadius:7, color:"#8b5cf6", fontSize:10, padding:"4px 10px", cursor:"pointer", marginTop:6 }}>
                      Complete inspection
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* DISPUTES TAB */}
      {tab==="disputes"&&(
        <div>
          {disputes.length===0&&<div style={{ color:"#888", fontSize:13, textAlign:"center", padding:"2rem" }}>No disputes</div>}
          {disputes.map(d=>(
            <div key={d.id} style={{ background:"#f8f8f8", border:`1px solid ${d.status==="open"?"#e24b4a20":"#eeeeee"}`, borderRadius:10, padding:"1rem", marginBottom:8 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                <div>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                    <div style={{ fontSize:13, fontWeight:600, color:"#000000" }}>{d.reason}</div>
                    <span style={{ fontSize:10, padding:"2px 8px", borderRadius:10, background:d.status==="open"?"#fff5f5":"#f8f8f8", color:d.status==="open"?"#e24b4a":"#555" }}>{d.status}</span>
                  </div>
                  <div style={{ fontSize:11, color:"#888", marginBottom:2 }}>Raised by: {d.profiles?.first_name} {d.profiles?.last_name}</div>
                  {d.description&&<div style={{ fontSize:11, color:"#888", fontStyle:"italic" }}>&quot;{d.description}&quot;</div>}
                  {d.status==="open"&&(
                    <div style={{ display:"flex", gap:6, marginTop:10 }}>
                      <button onClick={()=>resolveDispute(d,"buyer")}
                        style={{ background:"#fff5f5", border:"1px solid #e24b4a40", borderRadius:7, color:"#e24b4a", fontSize:11, fontWeight:600, padding:"6px 12px", cursor:"pointer" }}>
                        💰 Refund buyer
                      </button>
                      <button onClick={()=>resolveDispute(d,"seller")}
                        style={{ background:"#f0fdf4", border:"1px solid #1d9e7540", borderRadius:7, color:"#1d9e75", fontSize:11, fontWeight:600, padding:"6px 12px", cursor:"pointer" }}>
                        ✓ Release to seller
                      </button>
                    </div>
                  )}
                  <div style={{ fontSize:10, color:"#888", marginTop:4 }}>{new Date(d.created_at).toLocaleString()}</div>
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





