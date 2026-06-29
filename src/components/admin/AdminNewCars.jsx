import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"
import { useAuth } from "../../contexts/AuthContext"
import useIsMobile from "../../lib/useIsMobile"
import toast from "react-hot-toast"

export default function AdminNewCars() {
  const { user } = useAuth()
  const isMobile = useIsMobile()
  const [listings, setListings] = useState([])
  const [enquiries, setEnquiries] = useState([])
  const [brands, setBrands] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState("all")
  const [selected, setSelected] = useState(null)
  const [adminNotes, setAdminNotes] = useState("")
  const [processing, setProcessing] = useState(false)
  const [brandForm, setBrandForm] = useState({ name:"", is_popular:false })
  const [showBrandForm, setShowBrandForm] = useState(false)
  const [applications, setApplications] = useState([])

  useEffect(() => { load() }, [])

  async function load() {
    const [{ data: lst }, { data: enq }, { data: brs }, { data: apps }] = await Promise.all([
      supabase.from("new_car_listings").select("*, dealer:profiles!new_car_listings_dealer_id_fkey(first_name,last_name,provider_type,city)").order("created_at",{ascending:false}),
      supabase.from("car_enquiries").select("*, new_car_listings(brand,model,year), customer:profiles!car_enquiries_customer_id_fkey(first_name,last_name)").order("created_at",{ascending:false}),
      supabase.from("car_brands").select("*").order("display_order"),
      supabase.from("dealer_applications").select("*, profiles!dealer_applications_user_id_fkey(first_name,last_name)").order("created_at",{ascending:false})
    ])
    setListings(lst||[])
    setEnquiries(enq||[])
    setBrands(brs||[])
    setApplications(apps||[])
    setLoading(false)
  }

  async function approveListing(id) {
    setProcessing(true)
    try {
      const expires = new Date(Date.now() + 30*24*60*60*1000).toISOString()
      await supabase.from("new_car_listings").update({
        is_active: true, listing_fee_paid: true,
        listing_paid_at: new Date().toISOString(),
        listing_expires_at: expires,
        approved_by: user.id, approved_at: new Date().toISOString(),
        admin_notes: adminNotes||null, rejection_reason: null
      }).eq("id", id)
      const listing = listings.find(l=>l.id===id)
      if (listing) {
        await supabase.from("notifications").insert({ user_id:listing.dealer_id, title:"Listing Approved! ✅", message:`Your ${listing.year} ${listing.brand} ${listing.model} listing has been approved and is now live.`, type:"success" })
      }
      toast.success("Listing approved and activated!")
      setSelected(null); setAdminNotes(""); load()
    } catch(e) { toast.error(e.message) }
    finally { setProcessing(false) }
  }

  async function rejectListing(id) {
    if (!adminNotes) return toast.error("Please add a rejection reason")
    setProcessing(true)
    try {
      await supabase.from("new_car_listings").update({ rejection_reason: adminNotes, is_active:false }).eq("id", id)
      const listing = listings.find(l=>l.id===id)
      if (listing) {
        await supabase.from("notifications").insert({ user_id:listing.dealer_id, title:"Listing Update Required", message:`Your ${listing.year} ${listing.brand} ${listing.model} listing was not approved: ${adminNotes}`, type:"warning" })
      }
      toast.success("Listing rejected")
      setSelected(null); setAdminNotes(""); load()
    } catch(e) { toast.error(e.message) }
    finally { setProcessing(false) }
  }

  async function toggleFeatured(id, is_featured) {
    await supabase.from("new_car_listings").update({ is_featured:!is_featured }).eq("id",id)
    toast.success(is_featured?"Removed from featured":"Added to featured!")
    load()
  }

  async function markSold(id) {
    await supabase.from("new_car_listings").update({ is_sold:true, is_active:false }).eq("id",id)
    toast.success("Marked as sold")
    load()
  }

  async function suspendListing(id) {
    if (!confirm("Suspend this listing?")) return
    await supabase.from("new_car_listings").update({ is_active:false }).eq("id",id)
    toast.success("Listing suspended")
    load()
  }

  async function deleteListing(id) {
    if (!confirm("Delete this listing permanently?")) return
    await supabase.from("new_car_listings").delete().eq("id",id)
    toast.success("Listing deleted")
    load()
  }

  async function addBrand(e) {
    e.preventDefault()
    await supabase.from("car_brands").insert({ name:brandForm.name, is_popular:brandForm.is_popular, display_order:brands.length+1 })
    toast.success("Brand added!")
    setBrandForm({ name:"", is_popular:false }); setShowBrandForm(false); load()
  }

  async function approveApplication(app) {
    await supabase.from("dealer_applications").update({ status:"approved", reviewed_by:user.id, reviewed_at:new Date().toISOString() }).eq("id",app.id)
    await supabase.from("notifications").insert({ user_id:app.user_id, title:"Dealer Application Approved! 🏢", message:`Welcome to CCC! Your dealership ${app.showroom_name} has been approved. You can now list vehicles.`, type:"success" })
    toast.success("Application approved!")
    load()
  }

  async function rejectApplication(app) {
    await supabase.from("dealer_applications").update({ status:"rejected", reviewed_by:user.id, reviewed_at:new Date().toISOString() }).eq("id",app.id)
    await supabase.from("notifications").insert({ user_id:app.user_id, title:"Dealer Application Update", message:`Your dealership application for ${app.showroom_name} was not approved. Contact support for more information.`, type:"warning" })
    toast.success("Application rejected")
    load()
  }

  const pending = listings.filter(l=>l.listing_fee_paid&&!l.is_active&&!l.rejection_reason)
  const active = listings.filter(l=>l.is_active)
  const rejected = listings.filter(l=>l.rejection_reason)
  const unpaid = listings.filter(l=>!l.listing_fee_paid)
  const newEnquiries = enquiries.filter(e=>e.status==="new").length
  const converted = enquiries.filter(e=>e.status==="converted").length
  const pendingApps = applications.filter(a=>a.status==="pending").length

  const tabListings = tab==="pending" ? pending : tab==="active" ? active : tab==="rejected" ? rejected : tab==="unpaid" ? unpaid : listings

  const STATUS_COLOR = { pending:"#e6821e", active:"#1d9e75", rejected:"#e24b4a", unpaid:"#8b5cf6" }

  function getListingStatus(l) {
    if (l.is_sold) return { label:"Sold", color:"#888" }
    if (l.rejection_reason) return { label:"Rejected", color:"#e24b4a" }
    if (!l.listing_fee_paid) return { label:"Unpaid", color:"#8b5cf6" }
    if (!l.is_active) return { label:"Pending review", color:"#e6821e" }
    return { label:"Active", color:"#1d9e75" }
  }

  return (
    <div>
      {/* Header */}
      <div style={{ fontFamily:"Syne", fontSize:isMobile?16:20, fontWeight:800, color:"#000", marginBottom:4 }}>New Car Marketplace</div>
      <div style={{ fontSize:12, color:"#777", marginBottom:"1.25rem" }}>Manage listings, brands and dealer applications</div>

      {/* Gradient stats header */}
      <div style={{ background:"linear-gradient(135deg,#8b5cf6,#a78bfa)", borderRadius:14, padding:"1rem 1.25rem", marginBottom:"1.25rem", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div>
          <div style={{ fontFamily:"Syne", fontSize:22, fontWeight:800, color:"#fff" }}>{listings.length} listings</div>
          <div style={{ fontSize:11, color:"rgba(255,255,255,0.8)", marginTop:2 }}>{active.length} active · {pending.length} pending · {enquiries.length} enquiries</div>
        </div>
        <div style={{ display:"flex", gap:16 }}>
          {pending.length>0&&<div style={{ textAlign:"center" }}>
            <div style={{ fontFamily:"Syne", fontSize:20, fontWeight:800, color:"#fde68a" }}>{pending.length}</div>
            <div style={{ fontSize:10, color:"rgba(255,255,255,0.7)" }}>Need review</div>
          </div>}
          {pendingApps>0&&<div style={{ textAlign:"center" }}>
            <div style={{ fontFamily:"Syne", fontSize:20, fontWeight:800, color:"#fde68a" }}>{pendingApps}</div>
            <div style={{ fontSize:10, color:"rgba(255,255,255,0.7)" }}>Dealer apps</div>
          </div>}
          <div style={{ textAlign:"center" }}>
            <div style={{ fontFamily:"Syne", fontSize:20, fontWeight:800, color:"rgba(255,255,255,0.9)" }}>{converted}</div>
            <div style={{ fontSize:10, color:"rgba(255,255,255,0.7)" }}>Converted</div>
          </div>
        </div>
      </div>

      {/* Alert for pending items */}
      {(pending.length>0||pendingApps>0)&&(
        <div style={{ background:"#fff8f0", border:"1px solid #e6821e40", borderRadius:10, padding:"0.75rem 1rem", marginBottom:"1rem", display:"flex", gap:8, alignItems:"center" }}>
          <span>⚠️</span>
          <span style={{ fontSize:12, color:"#e6821e", fontWeight:600 }}>
            {pending.length>0&&`${pending.length} listing${pending.length>1?"s":""} awaiting review`}
            {pending.length>0&&pendingApps>0&&" · "}
            {pendingApps>0&&`${pendingApps} dealer application${pendingApps>1?"s":""} pending`}
          </span>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display:"flex", gap:6, marginBottom:"1.25rem", flexWrap:"wrap" }}>
        {[
          {k:"all",l:"All listings",count:listings.length},
          {k:"pending",l:"Pending",count:pending.length,alert:pending.length>0},
          {k:"active",l:"Active",count:active.length},
          {k:"unpaid",l:"Unpaid",count:unpaid.length},
          {k:"rejected",l:"Rejected",count:rejected.length},
          {k:"enquiries",l:"Enquiries",count:enquiries.length},
          {k:"brands",l:"Brands",count:brands.length},
          {k:"applications",l:"Dealers",count:applications.length,alert:pendingApps>0},
        ].map(t=>(
          <button key={t.k} onClick={()=>{ setTab(t.k); setSelected(null) }}
            style={{ padding:"7px 14px", borderRadius:8, border:"none", fontSize:11, cursor:"pointer", background:tab===t.k?"#8b5cf6":"#f0f0f0", color:tab===t.k?"#fff":"#555", fontWeight:tab===t.k?700:400, position:"relative" }}>
            {t.l} ({t.count})
            {t.alert&&t.count>0&&<span style={{ position:"absolute", top:-4, right:-4, width:8, height:8, borderRadius:"50%", background:"#e24b4a" }}/>}
          </button>
        ))}
      </div>

      {loading&&<div style={{ color:"#888", fontSize:13 }}>Loading...</div>}

      {/* Listings */}
      {["all","pending","active","unpaid","rejected"].includes(tab)&&(
        <div>
          {tabListings.length===0&&(
            <div style={{ textAlign:"center", padding:"2rem", color:"#888" }}>
              <div style={{ fontSize:32, marginBottom:8 }}>🚗</div>
              <div style={{ fontSize:13 }}>No listings in this category</div>
            </div>
          )}
          {tabListings.map(l=>{
            const status = getListingStatus(l)
            return (
              <div key={l.id} style={{ background:"#ffffff", border:"1px solid "+(selected===l.id?"#8b5cf6":"#eeeeee"), borderRadius:14, padding:"1rem", marginBottom:10, boxShadow:"0 1px 4px rgba(0,0,0,0.04)" }}>
                <div style={{ display:"flex", gap:12, alignItems:"flex-start" }}>
                  {/* Photos strip */}
                  <div style={{ flexShrink:0 }}>
                    {l.photos?.length>0 ? (
                      <div style={{ display:"flex", gap:3, flexDirection:"column" }}>
                        <img src={l.photos[0]} alt="" onClick={()=>window.open(l.photos[0],"_blank")}
                          style={{ width:80, height:60, objectFit:"cover", borderRadius:8, cursor:"pointer", border:"1px solid #eee" }}/>
                        {l.photos.length>1&&(
                          <div style={{ display:"flex", gap:3 }}>
                            {l.photos.slice(1,3).map((p,i)=>(
                              <img key={i} src={p} alt="" onClick={()=>window.open(p,"_blank")}
                                style={{ width:38, height:28, objectFit:"cover", borderRadius:5, cursor:"pointer", border:"1px solid #eee" }}/>
                            ))}
                            {l.photos.length>3&&<div style={{ width:38, height:28, borderRadius:5, background:"#f0f0f0", display:"flex", alignItems:"center", justifyContent:"center", fontSize:9, color:"#888", fontWeight:700 }}>+{l.photos.length-3}</div>}
                          </div>
                        )}
                        {l.video_url&&<div style={{ fontSize:9, color:"#8b5cf6", marginTop:2 }}>🎥 Has video</div>}
                      </div>
                    ):(
                      <div style={{ width:80, height:80, borderRadius:8, background:"#f0f0f0", display:"flex", alignItems:"center", justifyContent:"center", fontSize:28 }}>🚗</div>
                    )}
                  </div>

                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:6 }}>
                      <div style={{ flex:1, minWidth:0, marginRight:8 }}>
                        <div style={{ fontSize:14, fontWeight:700, color:"#000", marginBottom:2 }}>{l.year} {l.brand} {l.model} {l.variant||""}</div>
                        <div style={{ fontSize:11, color:"#888" }}>🏢 {l.showroom_name} · 📍 {l.showroom_location}</div>
                        <div style={{ fontSize:11, color:"#888" }}>👤 {l.dealer?.first_name} {l.dealer?.last_name}</div>
                        <div style={{ fontSize:10, color:"#aaa", marginTop:2 }}>{new Date(l.created_at).toLocaleDateString()} · 👁 {l.views||0} views · 💬 {l.enquiries||0} enquiries</div>
                      </div>
                      <div style={{ textAlign:"right", flexShrink:0 }}>
                        <div style={{ fontFamily:"Syne", fontSize:15, fontWeight:800, color:"#e6821e" }}>KES {Number(l.price).toLocaleString()}</div>
                        {l.discount_price&&<div style={{ fontSize:11, color:"#1d9e75" }}>Offer: KES {Number(l.discount_price).toLocaleString()}</div>}
                        <span style={{ fontSize:10, padding:"2px 8px", borderRadius:10, background:status.color+"20", color:status.color, fontWeight:600, border:"1px solid "+status.color+"30" }}>{status.label}</span>
                        {l.is_featured&&<div style={{ fontSize:10, color:"#e6821e", marginTop:2 }}>⭐ Featured</div>}
                      </div>
                    </div>

                    {/* Video preview */}
                    {selected===l.id&&l.video_url&&(
                      <div style={{ marginBottom:8 }}>
                        <video src={l.video_url} controls style={{ width:"100%", maxHeight:180, borderRadius:8 }}/>
                      </div>
                    )}

                    {l.rejection_reason&&<div style={{ fontSize:11, color:"#e24b4a", marginBottom:6, background:"#fff5f5", padding:"4px 8px", borderRadius:6 }}>Rejected: {l.rejection_reason}</div>}
                    {l.admin_notes&&<div style={{ fontSize:11, color:"#378add", marginBottom:6 }}>Notes: {l.admin_notes}</div>}

                    {/* Action buttons */}
                    <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginTop:8 }}>
                      <button onClick={()=>{ setSelected(selected===l.id?null:l.id); setAdminNotes("") }}
                        style={{ background:"#f5f3ff", border:"1px solid #8b5cf640", borderRadius:7, color:"#8b5cf6", fontSize:11, fontWeight:600, padding:"5px 10px", cursor:"pointer" }}>
                        {selected===l.id?"▲ Close":"▼ Review"}
                      </button>
                      <button onClick={()=>toggleFeatured(l.id,l.is_featured)}
                        style={{ background:l.is_featured?"#fff8f0":"#f8f8f8", border:"1px solid #e6821e30", borderRadius:7, color:"#e6821e", fontSize:11, fontWeight:600, padding:"5px 10px", cursor:"pointer" }}>
                        {l.is_featured?"★ Unfeature":"☆ Feature"}
                      </button>
                      {l.is_active&&!l.is_sold&&(
                        <button onClick={()=>markSold(l.id)}
                          style={{ background:"#f0fdf4", border:"1px solid #1d9e7540", borderRadius:7, color:"#1d9e75", fontSize:11, fontWeight:600, padding:"5px 10px", cursor:"pointer" }}>
                          ✓ Mark sold
                        </button>
                      )}
                      {l.is_active&&(
                        <button onClick={()=>suspendListing(l.id)}
                          style={{ background:"#fff5f5", border:"1px solid #e24b4a40", borderRadius:7, color:"#e24b4a", fontSize:11, fontWeight:600, padding:"5px 10px", cursor:"pointer" }}>
                          ⏸ Suspend
                        </button>
                      )}
                      <button onClick={()=>deleteListing(l.id)}
                        style={{ background:"#fff5f5", border:"1px solid #e24b4a40", borderRadius:7, color:"#e24b4a", fontSize:11, fontWeight:600, padding:"5px 10px", cursor:"pointer" }}>
                        🗑 Delete
                      </button>
                    </div>

                    {/* Review panel */}
                    {selected===l.id&&(
                      <div style={{ marginTop:10, background:"#f8f8ff", border:"1px solid #8b5cf630", borderRadius:10, padding:"0.75rem" }}>
                        <div style={{ fontFamily:"Syne", fontSize:12, fontWeight:700, color:"#8b5cf6", marginBottom:8 }}>Admin review</div>
                        <textarea value={adminNotes} onChange={e=>setAdminNotes(e.target.value)} placeholder="Admin notes (optional for approval, required for rejection)..."
                          style={{ width:"100%", background:"#ffffff", border:"1px solid #eeeeee", borderRadius:8, padding:"8px 10px", fontSize:12, outline:"none", resize:"vertical", minHeight:60, fontFamily:"DM Sans,sans-serif", marginBottom:8 }}/>
                        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                          <button onClick={()=>approveListing(l.id)} disabled={processing}
                            style={{ background:"#1d9e75", border:"none", borderRadius:7, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:12, fontWeight:700, padding:"7px 16px", cursor:"pointer" }}>
                            ✓ Approve & activate
                          </button>
                          <button onClick={()=>rejectListing(l.id)} disabled={processing||!adminNotes}
                            style={{ background:"none", border:"1px solid #e24b4a40", borderRadius:7, color:"#e24b4a", fontSize:12, padding:"7px 14px", cursor:"pointer" }}>
                            Reject
                          </button>
                          <button onClick={()=>setSelected(null)}
                            style={{ background:"none", border:"1px solid #ddd", borderRadius:7, color:"#888", fontSize:12, padding:"7px 12px", cursor:"pointer" }}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Enquiries tab */}
      {tab==="enquiries"&&(
        <div>
          {enquiries.length===0&&<div style={{ textAlign:"center", padding:"2rem", color:"#888", fontSize:13 }}>No enquiries yet</div>}
          {enquiries.map(e=>(
            <div key={e.id} style={{ background:"#ffffff", border:"1px solid #eeeeee", borderRadius:12, padding:"1rem", marginBottom:8 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                <div>
                  <div style={{ fontSize:13, fontWeight:600, color:"#000" }}>{e.new_car_listings?.brand} {e.new_car_listings?.model} {e.new_car_listings?.year}</div>
                  <div style={{ fontSize:11, color:"#888" }}>👤 {e.customer?.first_name} {e.customer?.last_name} · 📞 {e.phone}</div>
                  {e.message&&<div style={{ fontSize:11, color:"#555", marginTop:4, fontStyle:"italic" }}>"{e.message}"</div>}
                  <div style={{ fontSize:10, color:"#aaa", marginTop:4 }}>{new Date(e.created_at).toLocaleString()}</div>
                </div>
                <span style={{ fontSize:10, padding:"3px 10px", borderRadius:20, background:e.status==="new"?"#e6821e20":"#f0f0f0", color:e.status==="new"?"#e6821e":"#888", fontWeight:600 }}>{e.status}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Brands tab */}
      {tab==="brands"&&(
        <div>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"1rem" }}>
            <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:700, color:"#000" }}>Car Brands ({brands.length})</div>
            <button onClick={()=>setShowBrandForm(f=>!f)}
              style={{ background:"#8b5cf6", border:"none", borderRadius:8, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:12, fontWeight:700, padding:"8px 16px", cursor:"pointer" }}>
              + Add brand
            </button>
          </div>
          {showBrandForm&&(
            <div style={{ background:"#f5f3ff", border:"1px solid #8b5cf630", borderRadius:12, padding:"1rem", marginBottom:"1rem" }}>
              <form onSubmit={addBrand} style={{ display:"flex", gap:8, flexWrap:"wrap", alignItems:"flex-end" }}>
                <div style={{ flex:1, minWidth:150 }}>
                  <label style={{ fontSize:11, color:"#666", display:"block", marginBottom:4 }}>Brand name</label>
                  <input value={brandForm.name} onChange={e=>setBrandForm(f=>({...f,name:e.target.value}))} required placeholder="e.g. Toyota"
                    style={{ width:"100%", background:"#fff", border:"1px solid #e5e5e5", borderRadius:8, padding:"9px 12px", fontSize:13, outline:"none" }}/>
                </div>
                <label style={{ display:"flex", alignItems:"center", gap:6, fontSize:12, color:"#555", cursor:"pointer" }}>
                  <input type="checkbox" checked={brandForm.is_popular} onChange={e=>setBrandForm(f=>({...f,is_popular:e.target.checked}))}/>
                  Popular brand
                </label>
                <button type="submit" style={{ background:"#8b5cf6", border:"none", borderRadius:8, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:12, fontWeight:700, padding:"9px 18px", cursor:"pointer" }}>Add</button>
                <button type="button" onClick={()=>setShowBrandForm(false)} style={{ background:"none", border:"1px solid #ddd", borderRadius:8, color:"#888", fontSize:12, padding:"9px 14px", cursor:"pointer" }}>Cancel</button>
              </form>
            </div>
          )}
          <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
            {brands.map(b=>(
              <div key={b.id} style={{ background:b.is_popular?"#f5f3ff":"#f8f8f8", border:"1px solid "+(b.is_popular?"#8b5cf640":"#eeeeee"), borderRadius:8, padding:"6px 12px", display:"flex", alignItems:"center", gap:6 }}>
                <span style={{ fontSize:12, color:b.is_popular?"#8b5cf6":"#555", fontWeight:b.is_popular?700:400 }}>{b.name}</span>
                {b.is_popular&&<span style={{ fontSize:9, color:"#8b5cf6" }}>★</span>}
                <button onClick={async()=>{ await supabase.from("car_brands").delete().eq("id",b.id); load() }}
                  style={{ background:"none", border:"none", color:"#ddd", cursor:"pointer", fontSize:12 }}>×</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Dealer applications tab */}
      {tab==="applications"&&(
        <div>
          {applications.length===0&&<div style={{ textAlign:"center", padding:"2rem", color:"#888", fontSize:13 }}>No dealer applications</div>}
          {applications.map(app=>(
            <div key={app.id} style={{ background:"#ffffff", border:"1px solid "+(app.status==="pending"?"#e6821e30":"#eeeeee"), borderRadius:14, padding:"1rem", marginBottom:10 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
                <div>
                  <div style={{ fontSize:14, fontWeight:700, color:"#000", marginBottom:2 }}>🏢 {app.showroom_name}</div>
                  <div style={{ fontSize:11, color:"#888" }}>📍 {app.showroom_location}</div>
                  <div style={{ fontSize:11, color:"#888" }}>📞 {app.showroom_phone}</div>
                  {app.showroom_email&&<div style={{ fontSize:11, color:"#888" }}>✉️ {app.showroom_email}</div>}
                  {app.brands_sold?.length>0&&<div style={{ fontSize:11, color:"#888", marginTop:4 }}>🚗 Brands: {app.brands_sold.join(", ")}</div>}
                  {app.monthly_stock&&<div style={{ fontSize:11, color:"#888" }}>📦 Monthly stock: {app.monthly_stock} vehicles</div>}
                  <div style={{ fontSize:11, color:"#888", marginTop:4 }}>👤 {app.profiles?.first_name} {app.profiles?.last_name}</div>
                  <div style={{ fontSize:10, color:"#aaa", marginTop:2 }}>{new Date(app.created_at).toLocaleDateString()}</div>
                </div>
                <span style={{ fontSize:11, padding:"3px 10px", borderRadius:20, background:app.status==="approved"?"#f0fdf4":app.status==="rejected"?"#fff5f5":"#fff8f0", color:app.status==="approved"?"#1d9e75":app.status==="rejected"?"#e24b4a":"#e6821e", fontWeight:700 }}>
                  {app.status}
                </span>
              </div>
              {app.status==="pending"&&(
                <div style={{ display:"flex", gap:8 }}>
                  <button onClick={()=>approveApplication(app)}
                    style={{ background:"#1d9e75", border:"none", borderRadius:8, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:12, fontWeight:700, padding:"8px 16px", cursor:"pointer" }}>
                    ✓ Approve dealer
                  </button>
                  <button onClick={()=>rejectApplication(app)}
                    style={{ background:"none", border:"1px solid #e24b4a40", borderRadius:8, color:"#e24b4a", fontSize:12, padding:"8px 14px", cursor:"pointer" }}>
                    Reject
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
