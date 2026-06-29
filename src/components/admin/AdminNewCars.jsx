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
  const [tab, setTab] = useState("pending")
  const [selected, setSelected] = useState(null)
  const [adminNotes, setAdminNotes] = useState("")
  const [processing, setProcessing] = useState(false)
  const [brandForm, setBrandForm] = useState({ name:"", is_popular:false })
  const [showBrandForm, setShowBrandForm] = useState(false)
  const [applications, setApplications] = useState([])

  useEffect(() => { load() }, [])

  async function load() {
    const [{ data: lst }, { data: enq }, { data: brs }, { data: apps }] = await Promise.all([
      supabase.from("new_car_listings")
        .select("*, dealer:profiles!new_car_listings_dealer_id_fkey(first_name,last_name,provider_type,city)")
        .order("created_at", { ascending:false }),
      supabase.from("car_enquiries")
        .select("*, new_car_listings(brand,model,year), customer:profiles!car_enquiries_customer_id_fkey(first_name,last_name)")
        .order("created_at", { ascending:false }),
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
        is_active: true,
        listing_fee_paid: true,
        listing_paid_at: new Date().toISOString(),
        listing_expires_at: expires,
        approved_by: user.id,
        approved_at: new Date().toISOString(),
        admin_notes: adminNotes||null,
        updated_at: new Date().toISOString()
      }).eq("id", id)
      const listing = listings.find(l=>l.id===id)
      if (listing?.dealer_id) {
        await supabase.from("notifications").insert({
          user_id: listing.dealer_id,
          title: "Listing approved! 🚗",
          message: `Your ${listing.year} ${listing.brand} ${listing.model} listing is now live on CCC marketplace. Valid for 30 days.`,
          type: "success"
        })
      }
      toast.success("Listing approved and live!")
      setSelected(null); setAdminNotes(""); load()
    } catch(e) { toast.error(e.message) }
    finally { setProcessing(false) }
  }

  async function rejectListing(id) {
    if (!adminNotes) return toast.error("Please add a rejection reason")
    setProcessing(true)
    try {
      await supabase.from("new_car_listings").update({
        is_active: false,
        rejection_reason: adminNotes,
        updated_at: new Date().toISOString()
      }).eq("id", id)
      const listing = listings.find(l=>l.id===id)
      if (listing?.dealer_id) {
        await supabase.from("notifications").insert({
          user_id: listing.dealer_id,
          title: "Listing not approved",
          message: `Your ${listing.brand} ${listing.model} listing was not approved. Reason: ${adminNotes}. Please update and resubmit.`,
          type: "error"
        })
      }
      toast.success("Listing rejected — dealer notified")
      setSelected(null); setAdminNotes(""); load()
    } catch(e) { toast.error(e.message) }
    finally { setProcessing(false) }
  }

  async function toggleFeatured(id, is_featured) {
    await supabase.from("new_car_listings").update({ is_featured:!is_featured }).eq("id",id)
    toast.success(is_featured?"Removed from featured":"Added to featured")
    load()
  }

  async function markSold(id) {
    await supabase.from("new_car_listings").update({ is_sold:true, is_active:false }).eq("id",id)
    toast.success("Marked as sold")
    load()
  }

  async function approveApplication(app) {
    await supabase.from("dealer_applications").update({ status:"approved", reviewed_by:user.id, reviewed_at:new Date().toISOString() }).eq("id",app.id)
    await supabase.from("notifications").insert({
      user_id: app.user_id,
      title: "Dealer application approved! 🎉",
      message: `Welcome to CCC! Your showroom "${app.showroom_name}" has been approved. Go to Marketplace → My Car Listings to start listing your vehicles. Pay KES 2,000 listing fee to activate each listing.`,
      type: "success"
    })
    toast.success("Application approved — dealer notified!")
    load()
  }

  async function rejectApplication(app) {
    const reason = prompt("Rejection reason:")
    if (!reason) return
    await supabase.from("dealer_applications").update({ status:"rejected", admin_notes:reason, reviewed_by:user.id, reviewed_at:new Date().toISOString() }).eq("id",app.id)
    await supabase.from("notifications").insert({
      user_id: app.user_id,
      title: "Dealer application update",
      message: `Your dealer application for "${app.showroom_name}" was not approved. Reason: ${reason}. Contact us for more information.`,
      type: "error"
    })
    toast.success("Application rejected — dealer notified")
    load()
  }

  async function addBrand(e) {
    e.preventDefault()
    await supabase.from("car_brands").insert({ name:brandForm.name, is_popular:brandForm.is_popular, display_order:brands.length+1 })
    toast.success("Brand added!")
    setBrandForm({ name:"", is_popular:false })
    setShowBrandForm(false)
    load()
  }

  async function toggleBrandPopular(id, is_popular) {
    await supabase.from("car_brands").update({ is_popular:!is_popular }).eq("id",id)
    load()
  }

  async function deleteBrand(id) {
    if (!confirm("Delete this brand?")) return
    await supabase.from("car_brands").delete().eq("id",id)
    load()
  }

  const pending = listings.filter(l=>l.listing_fee_paid&&!l.is_active&&!l.rejection_reason)
  const active = listings.filter(l=>l.is_active)
  const rejected = listings.filter(l=>l.rejection_reason)
  const unpaid = listings.filter(l=>!l.listing_fee_paid)
  const newEnquiries = enquiries.filter(e=>e.status==="new").length
  const converted = enquiries.filter(e=>e.status==="converted").length

  const filtered = tab==="pending" ? pending : tab==="active" ? active : tab==="rejected" ? rejected : tab==="unpaid" ? unpaid : tab==="enquiries" ? enquiries : brands

  return (
    <div>
      <div style={{ fontFamily:"Syne", fontSize:isMobile?16:20, fontWeight:800, color:"#000", marginBottom:"1.5rem" }}>New Car Marketplace</div>

      {/* Stats */}
      <div style={{ display:"grid", gridTemplateColumns:isMobile?"repeat(2,1fr)":"repeat(6,1fr)", gap:8, marginBottom:"1.5rem" }}>
        {[
          { label:"Total listings", value:listings.length, color:"#000" },
          { label:"Pending approval", value:pending.length, color:pending.length>0?"#e6821e":"#555" },
          { label:"Active", value:active.length, color:"#1d9e75" },
          { label:"Unpaid", value:unpaid.length, color:"#e24b4a" },
          { label:"New enquiries", value:newEnquiries, color:newEnquiries>0?"#8b5cf6":"#555" },
          { label:"Converted sales", value:converted, color:"#1d9e75" },
        ].map(s=>(
          <div key={s.label} style={{ background:"#f8f8f8", borderRadius:10, padding:"0.75rem", border:"1px solid #eeeeee", textAlign:"center" }}>
            <div style={{ fontFamily:"Syne", fontSize:isMobile?14:18, fontWeight:800, color:s.color }}>{s.value}</div>
            <div style={{ fontSize:9, color:"#888", marginTop:2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {pending.length>0&&(
        <div style={{ background:"#fff8f0", border:"1px solid #e6821e40", borderRadius:10, padding:"0.75rem", marginBottom:"1rem" }}>
          <div style={{ fontSize:13, color:"#e6821e", fontWeight:600 }}>⚠️ {pending.length} listing{pending.length>1?"s":""} awaiting approval</div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display:"flex", gap:6, marginBottom:"1.25rem", flexWrap:"wrap" }}>
        {[
          {k:"pending",l:`Pending (${pending.length})`},
          {k:"active",l:`Active (${active.length})`},
          {k:"unpaid",l:`Unpaid (${unpaid.length})`},
          {k:"rejected",l:`Rejected (${rejected.length})`},
          {k:"enquiries",l:`Enquiries (${enquiries.length})`},
          {k:"brands",l:`Brands (${brands.length})`},
          {k:"applications",l:`Dealer Applications (${applications.length})`},
        ].map(t=>(
          <button key={t.k} onClick={()=>{ setTab(t.k); setSelected(null) }}
            style={{ padding:"7px 14px", borderRadius:8, border:"none", fontSize:11, cursor:"pointer", background:tab===t.k?"#8b5cf6":"#f8f8f8", color:tab===t.k?"#fff":"#666", fontWeight:tab===t.k?700:400 }}>
            {t.l}
          </button>
        ))}
      </div>

      {loading&&<div style={{ color:"#888", fontSize:13 }}>Loading...</div>}

      {/* Listings tabs */}
      {["pending","active","unpaid","rejected"].includes(tab)&&(
        <div>
          {filtered.length===0&&<div style={{ color:"#888", fontSize:13, textAlign:"center", padding:"2rem" }}>No listings in this category</div>}
          {(filtered).map(l=>(
            <div key={l.id} style={{ background:"#f8f8f8", border:`1px solid ${selected===l.id?"#8b5cf6":"#eeeeee"}`, borderRadius:12, padding:"1rem", marginBottom:10 }}>
              <div style={{ display:"flex", gap:12, alignItems:"flex-start" }}>
                {/* Photos */}
                {l.photos?.length>0&&(
                  <div style={{ flexShrink:0 }}>
                    <div style={{ display:"flex", gap:4 }}>
                      {l.photos.slice(0,3).map((p,i)=>(
                        <img key={i} src={p} alt="" onClick={()=>window.open(p,"_blank")}
                          style={{ width:i===0?90:55, height:65, objectFit:"cover", borderRadius:8, cursor:"pointer", border:"1px solid #eee" }}/>
                      ))}
                      {l.photos.length>3&&<div style={{ width:55, height:65, borderRadius:8, background:"#f0f0f0", display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, color:"#888", fontWeight:700 }}>+{l.photos.length-3}</div>}
                    </div>
                    {l.video_url&&(
                      <div style={{ marginTop:4 }}>
                        <video src={l.video_url} controls style={{ width:"100%", maxHeight:80, borderRadius:8 }}/>
                      </div>
                    )}
                  </div>
                )}
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:6 }}>
                    <div>
                      <div style={{ fontSize:14, fontWeight:700, color:"#000" }}>{l.year} {l.brand} {l.model} {l.variant||""}</div>
                      <div style={{ fontSize:11, color:"#888" }}>🏢 {l.showroom_name} · 📍 {l.showroom_location}</div>
                      <div style={{ fontSize:11, color:"#888" }}>👤 {l.dealer?.first_name} {l.dealer?.last_name}</div>
                      <div style={{ fontSize:10, color:"#aaa", marginTop:2 }}>{new Date(l.created_at).toLocaleString()} · 👁 {l.views||0} · 💬 {l.enquiries||0}</div>
                    </div>
                    <div style={{ textAlign:"right" }}>
                      <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:800, color:"#e6821e" }}>KES {Number(l.price).toLocaleString()}</div>
                      {l.discount_price&&<div style={{ fontSize:11, color:"#1d9e75" }}>Offer: KES {Number(l.discount_price).toLocaleString()}</div>}
                      <div style={{ fontSize:10, marginTop:4 }}>
                        {l.is_active?<span style={{ color:"#1d9e75" }}>✅ Active</span>:l.listing_fee_paid?<span style={{ color:"#e6821e" }}>⏳ Pending</span>:<span style={{ color:"#e24b4a" }}>💳 Unpaid</span>}
                        {l.is_featured&&<span style={{ color:"#e6821e", marginLeft:6 }}>⭐ Featured</span>}
                        {l.is_sold&&<span style={{ color:"#888", marginLeft:6 }}>Sold</span>}
                      </div>
                    </div>
                  </div>
                  {l.rejection_reason&&<div style={{ fontSize:11, color:"#e24b4a", marginBottom:6 }}>Rejected: {l.rejection_reason}</div>}
                  {l.admin_notes&&<div style={{ fontSize:11, color:"#378add", marginBottom:6 }}>Notes: {l.admin_notes}</div>}
                  <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                    {l.listing_fee_paid&&!l.is_active&&!l.rejection_reason&&(
                      <button onClick={()=>{ setSelected(selected===l.id?null:l.id); setAdminNotes("") }}
                        style={{ background:"#f5f3ff", border:"1px solid #8b5cf640", borderRadius:7, color:"#8b5cf6", fontSize:11, padding:"4px 10px", cursor:"pointer" }}>
                        Review
                      </button>
                    )}
                    <button onClick={()=>toggleFeatured(l.id,l.is_featured)}
                      style={{ background:l.is_featured?"#fff8f0":"#f8f8f8", border:"1px solid #e6821e30", borderRadius:7, color:"#e6821e", fontSize:11, padding:"4px 10px", cursor:"pointer" }}>
                      {l.is_featured?"★ Unfeature":"☆ Feature"}
                    </button>
                    {l.is_active&&!l.is_sold&&(
                      <button onClick={()=>markSold(l.id)}
                        style={{ background:"#f0fdf4", border:"1px solid #1d9e7540", borderRadius:7, color:"#1d9e75", fontSize:11, padding:"4px 10px", cursor:"pointer" }}>
                        Mark sold
                      </button>
                    )}
                    {!l.is_active&&l.listing_fee_paid&&(
                      <button onClick={()=>approveListing(l.id)} disabled={processing}
                        style={{ background:"#f0fdf4", border:"1px solid #1d9e7540", borderRadius:7, color:"#1d9e75", fontSize:11, padding:"4px 10px", cursor:"pointer" }}>
                        ✓ Approve
                      </button>
                    )}
                    {l.is_active&&(
                      <button onClick={async()=>{ if(!confirm("Suspend this listing?")) return; await supabase.from("new_car_listings").update({ is_active:false }).eq("id",l.id); load() }}
                        style={{ background:"#fff5f5", border:"1px solid #e24b4a40", borderRadius:7, color:"#e24b4a", fontSize:11, padding:"4px 10px", cursor:"pointer" }}>
                        ⏸ Suspend
                      </button>
                    )}
                    <button onClick={async()=>{ if(!confirm("Delete this listing permanently?")) return; await supabase.from("new_car_listings").delete().eq("id",l.id); load() }}
                      style={{ background:"#fff5f5", border:"1px solid #e24b4a40", borderRadius:7, color:"#e24b4a", fontSize:11, padding:"4px 10px", cursor:"pointer" }}>
                      🗑 Delete
                    </button>
                  </div>

                  {selected===l.id&&(
                    <div style={{ marginTop:10, background:"#ffffff", border:"1px solid #8b5cf630", borderRadius:10, padding:"0.75rem" }}>
                      <textarea value={adminNotes} onChange={e=>setAdminNotes(e.target.value)} placeholder="Admin notes (optional for approval, required for rejection)..."
                        style={{ width:"100%", background:"#f8f8f8", border:"1px solid #eeeeee", borderRadius:8, padding:"8px 10px", fontSize:12, outline:"none", resize:"vertical", minHeight:60, fontFamily:"DM Sans,sans-serif", marginBottom:8 }}/>
                      <div style={{ display:"flex", gap:8 }}>
                        <button onClick={()=>approveListing(l.id)} disabled={processing}
                          style={{ background:"#1d9e75", border:"none", borderRadius:7, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:12, fontWeight:700, padding:"7px 16px", cursor:"pointer" }}>
                          ✓ Approve & activate
                        </button>
                        <button onClick={()=>rejectListing(l.id)} disabled={processing||!adminNotes}
                          style={{ background:"none", border:"1px solid #e24b4a40", borderRadius:7, color:"#e24b4a", fontSize:12, padding:"7px 14px", cursor:"pointer" }}>
                          Reject
                        </button>
                        <button onClick={()=>setSelected(null)} style={{ background:"none", border:"1px solid #ddd", borderRadius:7, color:"#888", fontSize:12, padding:"7px 12px", cursor:"pointer" }}>Cancel</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Enquiries tab */}
      {tab==="enquiries"&&(
        <div>
          {enquiries.length===0&&<div style={{ color:"#888", fontSize:13, textAlign:"center", padding:"2rem" }}>No enquiries yet</div>}
          {enquiries.map(e=>(
            <div key={e.id} style={{ background:"#f8f8f8", border:`1px solid ${e.status==="new"?"#e24b4a20":"#eeeeee"}`, borderRadius:10, padding:"1rem", marginBottom:8 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                <div>
                  <div style={{ fontSize:13, fontWeight:600, color:"#000" }}>{e.customer_name}</div>
                  <div style={{ fontSize:11, color:"#888" }}>📞 {e.customer_phone}</div>
                  <div style={{ fontSize:11, color:"#888" }}>🚗 {e.new_car_listings?.year} {e.new_car_listings?.brand} {e.new_car_listings?.model}</div>
                  <div style={{ fontSize:10, color:"#aaa" }}>{e.enquiry_type?.replace(/_/g," ")} · {new Date(e.created_at).toLocaleString()}</div>
                  {e.message&&<div style={{ fontSize:11, color:"#555", marginTop:4, fontStyle:"italic" }}>&quot;{e.message}&quot;</div>}
                </div>
                <span style={{ fontSize:10, padding:"2px 8px", borderRadius:10, background:e.status==="new"?"#fff5f5":e.status==="converted"?"#f0fdf4":"#eff6ff", color:e.status==="new"?"#e24b4a":e.status==="converted"?"#1d9e75":"#378add", fontWeight:600 }}>
                  {e.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Brands tab */}
      {tab==="brands"&&(
        <div>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"1rem" }}>
            <div style={{ fontSize:13, color:"#888" }}>{brands.length} brands in database</div>
            <button onClick={()=>setShowBrandForm(f=>!f)} style={{ background:"#8b5cf6", border:"none", borderRadius:8, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:12, fontWeight:700, padding:"7px 14px", cursor:"pointer" }}>+ Add brand</button>
          </div>
          {showBrandForm&&(
            <form onSubmit={addBrand} style={{ background:"#f5f3ff", border:"1px solid #8b5cf630", borderRadius:10, padding:"1rem", marginBottom:"1rem", display:"flex", gap:10, alignItems:"flex-end", flexWrap:"wrap" }}>
              <div style={{ flex:1, minWidth:150 }}>
                <label style={{ fontSize:10, color:"#666", display:"block", marginBottom:4 }}>Brand name</label>
                <input value={brandForm.name} onChange={e=>setBrandForm(f=>({...f,name:e.target.value}))} placeholder="e.g. Haval" required
                  style={{ width:"100%", background:"#fff", border:"1px solid #e5e5e5", borderRadius:7, padding:"8px 10px", fontSize:12, outline:"none" }}/>
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:6, paddingBottom:2 }}>
                <input type="checkbox" id="popular" checked={brandForm.is_popular} onChange={e=>setBrandForm(f=>({...f,is_popular:e.target.checked}))}/>
                <label htmlFor="popular" style={{ fontSize:12, color:"#555" }}>Popular brand</label>
              </div>
              <button type="submit" style={{ background:"#8b5cf6", border:"none", borderRadius:7, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:12, fontWeight:700, padding:"8px 16px", cursor:"pointer" }}>Add</button>
              <button type="button" onClick={()=>setShowBrandForm(false)} style={{ background:"none", border:"1px solid #ddd", borderRadius:7, color:"#888", fontSize:12, padding:"8px 12px", cursor:"pointer" }}>Cancel</button>
            </form>
          )}
          <div style={{ display:"grid", gridTemplateColumns:isMobile?"repeat(2,1fr)":"repeat(4,1fr)", gap:8 }}>
            {brands.map(b=>(
              <div key={b.id} style={{ background:"#ffffff", border:`1px solid ${b.is_popular?"#e6821e30":"#eeeeee"}`, borderRadius:10, padding:"0.75rem", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div>
                  <div style={{ fontSize:13, fontWeight:600, color:"#000" }}>{b.name}</div>
                  {b.is_popular&&<span style={{ fontSize:9, color:"#e6821e", background:"#fff8f0", padding:"1px 6px", borderRadius:6 }}>Popular</span>}
                </div>
                <div style={{ display:"flex", gap:4 }}>
                  <button onClick={()=>toggleBrandPopular(b.id,b.is_popular)} style={{ background:"none", border:"none", fontSize:11, color:"#e6821e", cursor:"pointer" }}>{b.is_popular?"★":"☆"}</button>
                  <button onClick={()=>deleteBrand(b.id)} style={{ background:"none", border:"none", fontSize:11, color:"#e24b4a", cursor:"pointer" }}>✕</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    {/* Dealer Applications tab */}
      {tab==="applications"&&(
        <div>
          {applications.length===0&&<div style={{ color:"#888", fontSize:13, textAlign:"center", padding:"2rem" }}>No dealer applications yet</div>}
          {applications.map(app=>(
            <div key={app.id} style={{ background:"#f8f8f8", border:`1px solid ${app.status==="pending"?"#e6821e30":app.status==="approved"?"#1d9e7530":"#e24b4a30"}`, borderRadius:12, padding:"1rem", marginBottom:10 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
                <div>
                  <div style={{ fontSize:14, fontWeight:700, color:"#000", marginBottom:2 }}>{app.showroom_name}</div>
                  <div style={{ fontSize:12, color:"#888" }}>📍 {app.showroom_location} · 📞 {app.showroom_phone}</div>
                  {app.showroom_email&&<div style={{ fontSize:11, color:"#888" }}>✉️ {app.showroom_email}</div>}
                  {app.business_registration&&<div style={{ fontSize:11, color:"#888" }}>🏢 Reg: {app.business_registration}</div>}
                  {app.brands_sold?.length>0&&<div style={{ fontSize:11, color:"#888" }}>🚗 Brands: {app.brands_sold.join(", ")}</div>}
                  {app.monthly_stock&&<div style={{ fontSize:11, color:"#888" }}>📦 Monthly stock: ~{app.monthly_stock} cars</div>}
                  {app.website_url&&<div style={{ fontSize:11, color:"#378add" }}>🌐 {app.website_url}</div>}
                  <div style={{ fontSize:11, color:"#888", marginTop:4 }}>👤 {app.profiles?.first_name} {app.profiles?.last_name} · {app.profiles?.email}</div>
                  <div style={{ fontSize:10, color:"#aaa", marginTop:2 }}>{new Date(app.created_at).toLocaleString()}</div>
                  {app.admin_notes&&<div style={{ fontSize:11, color:"#e24b4a", marginTop:4 }}>Rejection reason: {app.admin_notes}</div>}
                </div>
                <span style={{ fontSize:11, padding:"3px 10px", borderRadius:10, background:app.status==="pending"?"#fff8f0":app.status==="approved"?"#f0fdf4":"#fff5f5", color:app.status==="pending"?"#e6821e":app.status==="approved"?"#1d9e75":"#e24b4a", fontWeight:600 }}>
                  {app.status}
                </span>
              </div>
              {app.status==="pending"&&(
                <div style={{ display:"flex", gap:8 }}>
                  <button onClick={()=>approveApplication(app)} style={{ background:"#f0fdf4", border:"1px solid #1d9e7540", borderRadius:7, color:"#1d9e75", fontSize:12, fontWeight:600, padding:"6px 14px", cursor:"pointer" }}>✓ Approve</button>
                  <button onClick={()=>rejectApplication(app)} style={{ background:"none", border:"1px solid #e24b4a40", borderRadius:7, color:"#e24b4a", fontSize:12, padding:"6px 14px", cursor:"pointer" }}>Reject</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}