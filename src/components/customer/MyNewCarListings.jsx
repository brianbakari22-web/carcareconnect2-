import { useEffect, useState, useRef } from "react"
import { supabase } from "../../lib/supabase"
import { useAuth } from "../../contexts/AuthContext"
import useIsMobile from "../../lib/useIsMobile"
import toast from "react-hot-toast"

const BODY_TYPES = ["sedan","suv","hatchback","pickup","van","crossover","coupe","convertible","minivan","wagon"]
const TRANSMISSIONS = ["automatic","manual","cvt","dct"]
const FUEL_TYPES = ["petrol","diesel","hybrid","electric","lpg"]
const DRIVE_TYPES = ["2wd","4wd","awd"]

const EMPTY = {
  brand:"", model:"", variant:"", year:new Date().getFullYear(), body_type:"sedan",
  engine_cc:"", transmission:"automatic", fuel_type:"petrol", drive_type:"2wd",
  color:"", interior_color:"", seats:5, doors:4,
  price:"", discount_price:"", price_negotiable:false,
  description:"", features:"", photos:[], video_url:"",
  showroom_name:"", showroom_location:"", showroom_phone:"", showroom_email:"",
  stock_count:1
}

export default function MyNewCarListings() {
  const { user, profile } = useAuth()
  const isMobile = useIsMobile()
  const [listings, setListings] = useState([])
  const [enquiries, setEnquiries] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState("listings")
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [uploadingVideo, setUploadingVideo] = useState(false)
  const [fees, setFees] = useState({ listing_fee:2000, duration_days:30 })
  const photoRef = useRef(null)

  useEffect(() => {
    if (!user) return
    load()
    supabase.from("app_settings").select("key,value").in("key",["new_car_listing_fee","new_car_listing_duration_days"])
      .then(({ data }) => {
        const map = {}
        data?.forEach(r => { map[r.key] = Number(r.value) })
        setFees({ listing_fee: map.new_car_listing_fee||2000, duration_days: map.new_car_listing_duration_days||30 })
      })
  }, [user])

  async function load() {
    const [{ data: lst }, { data: enq }] = await Promise.all([
      supabase.from("new_car_listings").select("*").eq("dealer_id", user.id).order("created_at",{ascending:false}),
      supabase.from("car_enquiries").select("*, new_car_listings(brand,model,year)").eq("dealer_id", user.id).order("created_at",{ascending:false})
    ])
    setListings(lst||[])
    setEnquiries(enq||[])
    setLoading(false)
  }

  async function uploadPhoto(file) {
    setUploadingPhoto(true)
    try {
      const ext = file.name.split(".").pop()
      const path = `new-cars/${user.id}/${Date.now()}.${ext}`
      const { error } = await supabase.storage.from("marketplace").upload(path, file, { upsert:true })
      if (error) throw error
      const { data } = supabase.storage.from("marketplace").getPublicUrl(path)
      setForm(f=>({...f, photos:[...f.photos, data.publicUrl]}))
      toast.success("Photo uploaded!")
    } catch(e) { toast.error(e.message) }
    finally { setUploadingPhoto(false) }
  }

  async function save(e) {
    e.preventDefault()
    if (!form.brand||!form.model||!form.price||!form.showroom_name||!form.showroom_location) {
      return toast.error("Brand, model, price and showroom details required")
    }
    setSaving(true)
    try {
      const payload = {
        dealer_id: user.id,
        brand: form.brand,
        model: form.model,
        variant: form.variant||null,
        year: Number(form.year),
        body_type: form.body_type,
        engine_cc: form.engine_cc?Number(form.engine_cc):null,
        transmission: form.transmission,
        fuel_type: form.fuel_type,
        drive_type: form.drive_type,
        color: form.color||null,
        interior_color: form.interior_color||null,
        seats: Number(form.seats)||5,
        doors: Number(form.doors)||4,
        price: Number(form.price),
        discount_price: form.discount_price?Number(form.discount_price):null,
        price_negotiable: form.price_negotiable,
        description: form.description||null,
        features: form.features ? form.features.split(",").map(f=>f.trim()).filter(Boolean) : [],
        photos: form.photos,
        video_url: form.video_url||null,
        showroom_name: form.showroom_name,
        showroom_location: form.showroom_location,
        showroom_phone: form.showroom_phone||null,
        showroom_email: form.showroom_email||null,
        stock_count: Number(form.stock_count)||1,
        listing_fee_amount: fees.listing_fee,
        updated_at: new Date().toISOString()
      }

      if (editing) {
        await supabase.from("new_car_listings").update(payload).eq("id",editing).eq("dealer_id",user.id)
        toast.success("Listing updated!")
      } else {
        await supabase.from("new_car_listings").insert(payload)
        toast.success("Listing created! Pay the listing fee to activate it.")
      }
      setShowForm(false); setEditing(null); setForm(EMPTY); load()
    } catch(e) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  async function payListingFee(listing) {
    try {
      const res = await fetch("https://gcnefnqtjxtqbhynyoxe.supabase.co/functions/v1/pesapal-payment", {
        method:"POST",
        headers:{ "Content-Type":"application/json", "Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdjbmVmbnF0anh0cWJoeW55b3hlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2MDg0MzIsImV4cCI6MjA5NTE4NDQzMn0.Ybyce3psBj2I-hdoF95H5UAklr6hsgQi-mciI9uMIgc" },
        body: JSON.stringify({
          amount: fees.listing_fee,
          bookingId: listing.id,
          customerEmail: profile?.email||user.email||"",
          customerPhone: listing.showroom_phone||"",
          customerName: listing.showroom_name,
          description: `New car listing fee - ${listing.brand} ${listing.model}`
        })
      })
      const data = await res.json()
      if (data.redirect_url) window.location.href = data.redirect_url
      else toast.error("Payment initiation failed")
    } catch(e) { toast.error(e.message) }
  }

  async function updateEnquiryStatus(id, status) {
    await supabase.from("car_enquiries").update({ status, contacted_at: status==="contacted"?new Date().toISOString():undefined }).eq("id",id)
    toast.success("Status updated")
    load()
  }

  async function deleteListing(id) {
    if (!confirm("Delete this listing?")) return
    await supabase.from("new_car_listings").delete().eq("id",id).eq("dealer_id",user.id)
    toast.success("Listing deleted")
    load()
  }

  function startEdit(l) {
    setEditing(l.id)
    setForm({
      brand:l.brand, model:l.model, variant:l.variant||"", year:l.year, body_type:l.body_type,
      engine_cc:l.engine_cc||"", transmission:l.transmission, fuel_type:l.fuel_type, drive_type:l.drive_type,
      color:l.color||"", interior_color:l.interior_color||"", seats:l.seats||5, doors:l.doors||4,
      price:l.price, discount_price:l.discount_price||"", price_negotiable:l.price_negotiable||false,
      description:l.description||"", features:(l.features||[]).join(", "), photos:l.photos||[],
      showroom_name:l.showroom_name, showroom_location:l.showroom_location,
      showroom_phone:l.showroom_phone||"", showroom_email:l.showroom_email||"",
      stock_count:l.stock_count||1
    })
    setShowForm(true)
  }

  const inp = { width:"100%", background:"#ffffff", border:"1px solid #e5e5e5", borderRadius:8, padding:"10px 12px", color:"#000", fontSize:12, outline:"none", fontFamily:"DM Sans,sans-serif", marginBottom:8 }
  const lbl = { fontSize:10, color:"#666", textTransform:"uppercase", display:"block", marginBottom:3 }
  const newEnquiries = enquiries.filter(e=>e.status==="new").length

  return (
    <div>
      <div style={{ fontFamily:"Syne", fontSize:isMobile?16:20, fontWeight:800, color:"#000", marginBottom:4 }}>My Car Listings</div>
      <div style={{ fontSize:12, color:"#777", marginBottom:"1.25rem" }}>Manage your new car listings and enquiries</div>

      {/* Stats */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8, marginBottom:"1.25rem" }}>
        {[
          { label:"Total listings", value:listings.length, color:"#000" },
          { label:"Active", value:listings.filter(l=>l.is_active).length, color:"#1d9e75" },
          { label:"Pending payment", value:listings.filter(l=>!l.listing_fee_paid).length, color:"#e6821e" },
          { label:"New enquiries", value:newEnquiries, color:newEnquiries>0?"#e24b4a":"#555" },
        ].map(s=>(
          <div key={s.label} style={{ background:"#f8f8f8", borderRadius:10, padding:"0.75rem", border:"1px solid #eeeeee", textAlign:"center" }}>
            <div style={{ fontFamily:"Syne", fontSize:isMobile?14:18, fontWeight:800, color:s.color }}>{s.value}</div>
            <div style={{ fontSize:9, color:"#888", marginTop:2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display:"flex", gap:6, marginBottom:"1.25rem" }}>
        {[{k:"listings",l:"My Listings"},{k:"enquiries",l:`Enquiries (${enquiries.length})`}].map(t=>(
          <button key={t.k} onClick={()=>setTab(t.k)}
            style={{ padding:"8px 16px", borderRadius:8, border:"none", fontSize:12, cursor:"pointer", background:tab===t.k?"#e6821e":"#f8f8f8", color:tab===t.k?"#fff":"#666", fontWeight:tab===t.k?700:400 }}>
            {t.l}
          </button>
        ))}
        <button onClick={()=>{ setShowForm(true); setEditing(null); setForm(EMPTY) }}
          style={{ marginLeft:"auto", background:"#e6821e", border:"none", borderRadius:8, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:12, fontWeight:700, padding:"8px 16px", cursor:"pointer" }}>
          + Add listing
        </button>
      </div>

      {/* Add/Edit form */}
      {showForm&&(
        <div style={{ background:"#f8f8f8", border:"1px solid #eeeeee", borderRadius:12, padding:"1.25rem", marginBottom:"1.5rem" }}>
          <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:700, color:"#000", marginBottom:"1rem" }}>{editing?"Edit listing":"Add new car listing"}</div>
          <form onSubmit={save}>
            <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:10, marginBottom:8 }}>
              <div><label style={lbl}>Brand *</label><input style={inp} placeholder="e.g. Toyota" value={form.brand} onChange={e=>setForm(f=>({...f,brand:e.target.value}))} required/></div>
              <div><label style={lbl}>Model *</label><input style={inp} placeholder="e.g. Fortuner" value={form.model} onChange={e=>setForm(f=>({...f,model:e.target.value}))} required/></div>
              <div><label style={lbl}>Variant</label><input style={inp} placeholder="e.g. 2.8L GD-6 4WD" value={form.variant} onChange={e=>setForm(f=>({...f,variant:e.target.value}))}/></div>
              <div><label style={lbl}>Year *</label><input style={inp} type="number" min="2000" max={new Date().getFullYear()+2} value={form.year} onChange={e=>setForm(f=>({...f,year:e.target.value}))} required/></div>
            </div>

            <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"repeat(3,1fr)", gap:10, marginBottom:8 }}>
              <div><label style={lbl}>Body type</label>
                <select style={inp} value={form.body_type} onChange={e=>setForm(f=>({...f,body_type:e.target.value}))}>
                  {BODY_TYPES.map(b=><option key={b} value={b}>{b.charAt(0).toUpperCase()+b.slice(1)}</option>)}
                </select>
              </div>
              <div><label style={lbl}>Transmission</label>
                <select style={inp} value={form.transmission} onChange={e=>setForm(f=>({...f,transmission:e.target.value}))}>
                  {TRANSMISSIONS.map(t=><option key={t} value={t}>{t.toUpperCase()}</option>)}
                </select>
              </div>
              <div><label style={lbl}>Fuel type</label>
                <select style={inp} value={form.fuel_type} onChange={e=>setForm(f=>({...f,fuel_type:e.target.value}))}>
                  {FUEL_TYPES.map(f=><option key={f} value={f}>{f.charAt(0).toUpperCase()+f.slice(1)}</option>)}
                </select>
              </div>
              <div><label style={lbl}>Drive type</label>
                <select style={inp} value={form.drive_type} onChange={e=>setForm(f=>({...f,drive_type:e.target.value}))}>
                  {DRIVE_TYPES.map(d=><option key={d} value={d}>{d.toUpperCase()}</option>)}
                </select>
              </div>
              <div><label style={lbl}>Engine (cc)</label><input style={inp} type="number" placeholder="e.g. 2800" value={form.engine_cc} onChange={e=>setForm(f=>({...f,engine_cc:e.target.value}))}/></div>
              <div><label style={lbl}>Seats</label><input style={inp} type="number" min="2" max="15" value={form.seats} onChange={e=>setForm(f=>({...f,seats:e.target.value}))}/></div>
            </div>

            <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:10, marginBottom:8 }}>
              <div><label style={lbl}>Exterior color</label><input style={inp} placeholder="e.g. Pearl White" value={form.color} onChange={e=>setForm(f=>({...f,color:e.target.value}))}/></div>
              <div><label style={lbl}>Interior color</label><input style={inp} placeholder="e.g. Black leather" value={form.interior_color} onChange={e=>setForm(f=>({...f,interior_color:e.target.value}))}/></div>
              <div><label style={lbl}>Price (KES) *</label><input style={inp} type="number" placeholder="e.g. 4500000" value={form.price} onChange={e=>setForm(f=>({...f,price:e.target.value}))} required/></div>
              <div><label style={lbl}>Discount price (KES)</label><input style={inp} type="number" placeholder="Leave blank if no discount" value={form.discount_price} onChange={e=>setForm(f=>({...f,discount_price:e.target.value}))}/></div>
              <div><label style={lbl}>Stock available</label><input style={inp} type="number" min="1" value={form.stock_count} onChange={e=>setForm(f=>({...f,stock_count:e.target.value}))}/></div>
              <div style={{ display:"flex", alignItems:"center", gap:8, paddingTop:20 }}>
                <input type="checkbox" id="negotiable" checked={form.price_negotiable} onChange={e=>setForm(f=>({...f,price_negotiable:e.target.checked}))}/>
                <label htmlFor="negotiable" style={{ fontSize:12, color:"#555" }}>Price negotiable</label>
              </div>
            </div>

            <div style={{ marginBottom:8 }}>
              <label style={lbl}>Features (comma separated)</label>
              <input style={inp} placeholder="e.g. Sunroof, Android Auto, Leather seats, Reverse camera" value={form.features} onChange={e=>setForm(f=>({...f,features:e.target.value}))}/>
            </div>
            <div style={{ marginBottom:8 }}>
              <label style={lbl}>Description</label>
              <textarea style={{...inp, resize:"vertical", minHeight:80}} placeholder="Describe the vehicle..." value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))}/>
            </div>

            <div style={{ fontFamily:"Syne", fontSize:13, fontWeight:700, color:"#000", marginBottom:8, marginTop:8 }}>Showroom Details</div>
            <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:10, marginBottom:8 }}>
              <div><label style={lbl}>Showroom name *</label><input style={inp} placeholder="e.g. Toyota Kenya Westlands" value={form.showroom_name} onChange={e=>setForm(f=>({...f,showroom_name:e.target.value}))} required/></div>
              <div><label style={lbl}>Location *</label><input style={inp} placeholder="e.g. Westlands, Nairobi" value={form.showroom_location} onChange={e=>setForm(f=>({...f,showroom_location:e.target.value}))} required/></div>
              <div><label style={lbl}>Phone</label><input style={inp} type="tel" placeholder="0712 345 678" value={form.showroom_phone} onChange={e=>setForm(f=>({...f,showroom_phone:e.target.value}))}/></div>
              <div><label style={lbl}>Email</label><input style={inp} type="email" placeholder="showroom@dealer.co.ke" value={form.showroom_email} onChange={e=>setForm(f=>({...f,showroom_email:e.target.value}))}/></div>
            </div>

            {/* Photos */}
            <div style={{ marginBottom:"1rem" }}>
              <label style={lbl}>Photos ({form.photos.length} uploaded)</label>
            {/* Video upload */}
            <div style={{ marginBottom:12 }}>
              <label style={lbl}>Video walkthrough (optional)</label>
              {form.video_url&&(
                <div style={{ position:"relative", marginBottom:8 }}>
                  <video src={form.video_url} controls style={{ width:"100%", maxHeight:200, borderRadius:10 }}/>
                  <button type="button" onClick={()=>setForm(f=>({...f,video_url:""}))}
                    style={{ position:"absolute", top:6, right:6, background:"rgba(0,0,0,0.5)", border:"none", borderRadius:"50%", width:24, height:24, color:"#fff", fontSize:12, cursor:"pointer" }}>×</button>
                </div>
              )}
              <label style={{ display:"block", width:"100%", background:"#f8f8f8", border:"2px dashed #e5e5e5", borderRadius:10, padding:"12px", color:"#888", fontSize:12, cursor:"pointer", textAlign:"center" }}>
                {uploadingVideo?"⏳ Uploading video...":"🎥 "+(form.video_url?"Change video":"Upload video walkthrough (max 50MB)")}
                <input type="file" accept="video/*" style={{ display:"none" }} onChange={async e=>{
                  const file = e.target.files[0]
                  if (!file) return
                  if (file.size > 50*1024*1024) return toast.error("Video must be under 50MB")
                  setUploadingVideo(true)
                  try {
                    const ext = file.name.split(".").pop()
                    const path = user.id+"/car-video-"+Date.now()+"."+ext
                    const { error } = await supabase.storage.from("marketplace").upload(path, file, { upsert:true })
                    if (error) throw error
                    const { data } = supabase.storage.from("marketplace").getPublicUrl(path)
                    setForm(f=>({...f,video_url:data.publicUrl}))
                    toast.success("Video uploaded!")
                  } catch(e) { toast.error(e.message) }
                  finally { setUploadingVideo(false) }
                }}/>
              </label>
            </div>
              <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:8 }}>
                {form.photos.map((p,i)=>(
                  <div key={i} style={{ position:"relative" }}>
                    <img src={p} alt="" style={{ width:80, height:60, objectFit:"cover", borderRadius:6 }}/>
                    <button type="button" onClick={()=>setForm(f=>({...f,photos:f.photos.filter((_,j)=>j!==i)}))}
                      style={{ position:"absolute", top:-6, right:-6, background:"#e24b4a", border:"none", borderRadius:"50%", width:18, height:18, color:"#fff", fontSize:10, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>×</button>
                  </div>
                ))}
                <label style={{ width:80, height:60, background:"#f0f0f0", borderRadius:6, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", border:"1px dashed #ccc", fontSize:20, color:"#888" }}>
                  {uploadingPhoto?"⏳":"+"}
                  <input type="file" accept="image/*" style={{ display:"none" }} ref={photoRef} onChange={e=>e.target.files[0]&&uploadPhoto(e.target.files[0])} disabled={uploadingPhoto}/>
                </label>
              </div>
            </div>

            <div style={{ background:"#fff8f0", border:"1px solid #e6821e30", borderRadius:8, padding:"0.75rem", marginBottom:"1rem" }}>
              <div style={{ fontSize:11, color:"#e6821e", fontWeight:600, marginBottom:4 }}>💳 Listing fee: KES {fees.listing_fee.toLocaleString()}/month</div>
              <div style={{ fontSize:11, color:"#555" }}>After saving, pay the listing fee to activate your listing for {fees.duration_days} days. Admin will review and approve within 24 hours.</div>
            </div>

            <div style={{ display:"flex", gap:8 }}>
              <button type="submit" disabled={saving} style={{ background:saving?"#ccc":"#e6821e", border:"none", borderRadius:9, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:13, fontWeight:700, padding:"11px 24px", cursor:saving?"not-allowed":"pointer" }}>
                {saving?"Saving...":editing?"Update listing":"Save listing"}
              </button>
              <button type="button" onClick={()=>{ setShowForm(false); setEditing(null); setForm(EMPTY) }} style={{ background:"none", border:"1px solid #ddd", borderRadius:9, color:"#666", fontSize:12, padding:"11px 16px", cursor:"pointer" }}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Listings tab */}
      {tab==="listings"&&(
        <div>
          {loading&&<div style={{ color:"#888", fontSize:13 }}>Loading...</div>}
          {!loading&&listings.length===0&&(
            <div style={{ textAlign:"center", padding:"3rem", color:"#888" }}>
              <div style={{ fontSize:40, marginBottom:12 }}>🚗</div>
              <div>No listings yet. Add your first car listing above.</div>
            </div>
          )}
          {listings.map(l=>(
            <div key={l.id} style={{ background:"#ffffff", border:`1px solid ${l.is_active?"#1d9e7530":l.listing_fee_paid?"#e6821e30":"#eeeeee"}`, borderRadius:12, padding:"1rem", marginBottom:10 }}>
              <div style={{ display:"flex", gap:12, alignItems:"flex-start" }}>
                {l.photos?.[0]&&<img src={l.photos[0]} alt="" style={{ width:80, height:60, objectFit:"cover", borderRadius:8, flexShrink:0 }}/>}
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:6 }}>
                    <div>
                      <div style={{ fontSize:14, fontWeight:700, color:"#000" }}>{l.year} {l.brand} {l.model}</div>
                      <div style={{ fontSize:11, color:"#888" }}>{l.showroom_name} · {l.showroom_location}</div>
                    </div>
                    <div style={{ textAlign:"right" }}>
                      <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:800, color:"#e6821e" }}>KES {Number(l.price).toLocaleString()}</div>
                      <span style={{ fontSize:10, padding:"2px 7px", borderRadius:10, background:l.is_active?"#f0fdf4":l.listing_fee_paid?"#fff8f0":"#f5f5f5", color:l.is_active?"#1d9e75":l.listing_fee_paid?"#e6821e":"#888" }}>
                        {l.is_active?"✅ Active":l.listing_fee_paid?"⏳ Pending approval":"💳 Fee required"}
                      </span>
                    </div>
                  </div>
                  <div style={{ fontSize:10, color:"#aaa", marginBottom:8 }}>👁 {l.views||0} views · 💬 {l.enquiries||0} enquiries · Expires: {l.listing_expires_at?new Date(l.listing_expires_at).toLocaleDateString():"—"}</div>
                  <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                    {!l.listing_fee_paid&&(
                      <button onClick={()=>payListingFee(l)} style={{ background:"#e6821e", border:"none", borderRadius:7, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:11, fontWeight:700, padding:"5px 12px", cursor:"pointer" }}>
                        💳 Pay KES {fees.listing_fee.toLocaleString()} to activate
                      </button>
                    )}
                    <button onClick={()=>startEdit(l)} style={{ background:"#eff6ff", border:"1px solid #378add40", borderRadius:7, color:"#378add", fontSize:11, padding:"5px 10px", cursor:"pointer" }}>Edit</button>
                    <button onClick={()=>deleteListing(l.id)} style={{ background:"none", border:"1px solid #e24b4a30", borderRadius:7, color:"#e24b4a", fontSize:11, padding:"5px 10px", cursor:"pointer" }}>Delete</button>
                  </div>
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
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
                <div>
                  <div style={{ fontSize:13, fontWeight:600, color:"#000" }}>{e.customer_name}</div>
                  <div style={{ fontSize:11, color:"#888" }}>📞 {e.customer_phone} {e.customer_email?`· ✉️ ${e.customer_email}`:""}</div>
                  <div style={{ fontSize:11, color:"#888" }}>🚗 {e.new_car_listings?.year} {e.new_car_listings?.brand} {e.new_car_listings?.model}</div>
                  <div style={{ fontSize:10, color:"#888" }}>{e.enquiry_type?.replace(/_/g," ")} · Prefers: {e.preferred_contact}</div>
                  {e.message&&<div style={{ fontSize:11, color:"#555", marginTop:4, fontStyle:"italic" }}>&quot;{e.message}&quot;</div>}
                  <div style={{ fontSize:10, color:"#aaa", marginTop:4 }}>{new Date(e.created_at).toLocaleString()}</div>
                </div>
                <span style={{ fontSize:10, padding:"2px 8px", borderRadius:10, background:e.status==="new"?"#fff5f5":e.status==="contacted"?"#eff6ff":e.status==="converted"?"#f0fdf4":"#f5f5f5", color:e.status==="new"?"#e24b4a":e.status==="contacted"?"#378add":e.status==="converted"?"#1d9e75":"#888", fontWeight:600 }}>
                  {e.status}
                </span>
              </div>
              <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                {e.status==="new"&&<button onClick={()=>updateEnquiryStatus(e.id,"contacted")} style={{ background:"#eff6ff", border:"1px solid #378add40", borderRadius:7, color:"#378add", fontSize:11, padding:"4px 10px", cursor:"pointer" }}>✓ Mark contacted</button>}
                {e.status==="contacted"&&<button onClick={()=>updateEnquiryStatus(e.id,"converted")} style={{ background:"#f0fdf4", border:"1px solid #1d9e7540", borderRadius:7, color:"#1d9e75", fontSize:11, padding:"4px 10px", cursor:"pointer" }}>🎉 Mark sold</button>}
                {e.customer_phone&&<a href={`tel:${e.customer_phone}`} style={{ background:"#f0fdf4", border:"1px solid #1d9e7540", borderRadius:7, color:"#1d9e75", fontSize:11, padding:"4px 10px", textDecoration:"none" }}>📞 Call</a>}
                {e.customer_phone&&<a href={`https://wa.me/254${e.customer_phone.replace(/^0/,"")}`} target="_blank" rel="noreferrer" style={{ background:"#f0fdf4", border:"1px solid #1d9e7540", borderRadius:7, color:"#1d9e75", fontSize:11, padding:"4px 10px", textDecoration:"none" }}>💚 WhatsApp</a>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}