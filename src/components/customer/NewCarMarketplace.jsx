import { useEffect, useState, useRef } from "react"
import { supabase } from "../../lib/supabase"
import { useAuth } from "../../contexts/AuthContext"
import useIsMobile from "../../lib/useIsMobile"
import toast from "react-hot-toast"

const BODY_TYPES = [
  { key:"all", label:"All", icon:"🚗" },
  { key:"sedan", label:"Sedan", icon:"🚗" },
  { key:"suv", label:"SUV", icon:"🚙" },
  { key:"hatchback", label:"Hatchback", icon:"🚘" },
  { key:"pickup", label:"Pickup", icon:"🛻" },
  { key:"van", label:"Van", icon:"🚐" },
  { key:"crossover", label:"Crossover", icon:"🚙" },
  { key:"coupe", label:"Coupe", icon:"🏎️" },
  { key:"convertible", label:"Convertible", icon:"🚘" },
  { key:"minivan", label:"Minivan", icon:"🚐" },
  { key:"wagon", label:"Wagon", icon:"🚗" },
]

export default function NewCarMarketplace() {
  const { user, profile } = useAuth()
  const isMobile = useIsMobile()
  const [cars, setCars] = useState([])
  const [brands, setBrands] = useState([])
  const [loading, setLoading] = useState(true)
  const [bodyType, setBodyType] = useState("all")
  const [selectedBrand, setSelectedBrand] = useState("all")
  const [search, setSearch] = useState("")
  const [sortBy, setSortBy] = useState("featured")
  const [selected, setSelected] = useState(null)
  const [tab, setTab] = useState("browse") // browse, my_listings
  const [enquiryForm, setEnquiryForm] = useState({ name:"", phone:"", email:"", message:"", enquiry_type:"general", preferred_contact:"phone" })
  const [submittingEnquiry, setSubmittingEnquiry] = useState(false)
  const [showEnquiry, setShowEnquiry] = useState(false)
  const [showDealerReg, setShowDealerReg] = useState(false)
  const [dealerForm, setDealerForm] = useState({ showroom_name:"", showroom_location:"", showroom_phone:"", showroom_email:"", business_registration:"", brands_sold:"", monthly_stock:"", website_url:"" })
  const [submittingDealer, setSubmittingDealer] = useState(false)
  const featuredRef = useRef(null)

  useEffect(() => { load() }, [])

  async function load() {
    const [{ data: carData }, { data: brandData }] = await Promise.all([
      supabase.from("new_car_listings").select("*, dealer:profiles!new_car_listings_dealer_id_fkey(first_name,last_name,avatar_url)").order("is_featured", { ascending:false }).order("created_at", { ascending:false }),
      supabase.from("car_brands").select("*").order("display_order")
    ])
    setCars(carData||[])
    setBrands(brandData||[])
    setLoading(false)
  }

  async function submitEnquiry() {
    if (!enquiryForm.name||!enquiryForm.phone) return toast.error("Name and phone required")
    if (!user) return toast.error("Please login to enquire")
    setSubmittingEnquiry(true)
    try {
      await supabase.from("car_enquiries").insert({
        listing_id: selected.id,
        customer_id: user.id,
        dealer_id: selected.dealer_id,
        customer_name: enquiryForm.name,
        customer_phone: enquiryForm.phone,
        customer_email: enquiryForm.email,
        message: enquiryForm.message,
        enquiry_type: enquiryForm.enquiry_type,
        preferred_contact: enquiryForm.preferred_contact,
      })
      // Notify dealer
      await supabase.from("notifications").insert({
        user_id: selected.dealer_id,
        title: "New car enquiry! 🚗",
        message: `${enquiryForm.name} is interested in your ${selected.year} ${selected.brand} ${selected.model}. Phone: ${enquiryForm.phone}`,
        type: "success"
      })
      // Increment enquiry count
      await supabase.from("new_car_listings").update({ enquiries: (selected.enquiries||0)+1 }).eq("id", selected.id)
      toast.success("Enquiry sent! The dealer will contact you shortly.")
      setShowEnquiry(false)
      setEnquiryForm({ name:"", phone:"", email:"", message:"", enquiry_type:"general", preferred_contact:"phone" })
    } catch(e) { toast.error(e.message) }
    finally { setSubmittingEnquiry(false) }
  }

  async function submitDealerApplication() {
    if (!dealerForm.showroom_name||!dealerForm.showroom_location||!dealerForm.showroom_phone) return toast.error("Showroom name, location and phone required")
    if (!user) return toast.error("Please login to register as a dealer")
    setSubmittingDealer(true)
    try {
      await supabase.from("dealer_applications").insert({
        user_id: user.id,
        showroom_name: dealerForm.showroom_name,
        showroom_location: dealerForm.showroom_location,
        showroom_phone: dealerForm.showroom_phone,
        showroom_email: dealerForm.showroom_email||null,
        business_registration: dealerForm.business_registration||null,
        brands_sold: dealerForm.brands_sold ? dealerForm.brands_sold.split(",").map(b=>b.trim()).filter(Boolean) : [],
        monthly_stock: dealerForm.monthly_stock ? Number(dealerForm.monthly_stock) : null,
        website_url: dealerForm.website_url||null,
      })
      // Notify admin
      const { data: admins } = await supabase.from("profiles").select("id").eq("role","admin").limit(1)
      if (admins?.[0]) {
        await supabase.from("notifications").insert({
          user_id: admins[0].id,
          title: "New dealer application! 🏢",
          message: `${dealerForm.showroom_name} from ${dealerForm.showroom_location} has applied to list cars on CCC. Phone: ${dealerForm.showroom_phone}`,
          type: "info"
        })
      }
      toast.success("Application submitted! We will contact you within 24 hours.")
      setShowDealerReg(false)
      setDealerForm({ showroom_name:"", showroom_location:"", showroom_phone:"", showroom_email:"", business_registration:"", brands_sold:"", monthly_stock:"", website_url:"" })
    } catch(e) { toast.error(e.message) }
    finally { setSubmittingDealer(false) }
  }

  async function incrementView(car) {
    setSelected(car)
    await supabase.from("new_car_listings").update({ views:(car.views||0)+1 }).eq("id", car.id)
  }

  const featured = cars.filter(c=>c.is_featured)
  const newArrivals = [...cars].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)).slice(0,8)

  const filtered = cars.filter(c => {
    const matchBody = bodyType==="all" || c.body_type===bodyType
    const matchBrand = selectedBrand==="all" || c.brand===selectedBrand
    const matchSearch = !search || `${c.brand} ${c.model} ${c.variant||""} ${c.showroom_name}`.toLowerCase().includes(search.toLowerCase())
    return matchBody && matchBrand && matchSearch
  }).sort((a,b) => {
    if (sortBy==="price_asc") return Number(a.price)-Number(b.price)
    if (sortBy==="price_desc") return Number(b.price)-Number(a.price)
    if (sortBy==="newest") return new Date(b.created_at)-new Date(a.created_at)
    if (sortBy==="enquiries") return (b.enquiries||0)-(a.enquiries||0)
    return (b.is_featured?1:0)-(a.is_featured?1:0)
  })

  const inp = { width:"100%", background:"#ffffff", border:"1px solid #e5e5e5", borderRadius:8, padding:"10px 12px", color:"#000", fontSize:13, outline:"none", fontFamily:"DM Sans,sans-serif", marginBottom:10 }
  const lbl = { fontSize:11, color:"#666", textTransform:"uppercase", display:"block", marginBottom:4 }

  if (selected) return (
    <div>
      <button onClick={()=>{ setSelected(null); setShowEnquiry(false) }} style={{ background:"none", border:"none", color:"#e6821e", cursor:"pointer", fontSize:13, marginBottom:"1rem", padding:0, fontFamily:"DM Sans,sans-serif" }}>
        ← Back to listings
      </button>

      {/* Photo gallery */}
      <div style={{ marginBottom:"1.5rem" }}>
        {selected.photos?.[0] ? (
          <div>
            <img src={selected.photos[0]} alt={selected.brand+" "+selected.model} style={{ width:"100%", height:isMobile?220:380, objectFit:"cover", borderRadius:12, marginBottom:8 }}/>
            {selected.photos.length>1&&(
              <div style={{ display:"flex", gap:6, overflowX:"auto" }}>
                {selected.photos.slice(1).map((p,i)=>(
                  <img key={i} src={p} alt="" style={{ width:80, height:60, objectFit:"cover", borderRadius:8, flexShrink:0 }}/>
                ))}
              </div>
            )}
          </div>
        ):(
          <div style={{ height:220, background:"#f5f5f5", borderRadius:12, display:"flex", alignItems:"center", justifyContent:"center", fontSize:48 }}>🚗</div>
        )}
      </div>

      <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 360px", gap:"1.5rem" }}>
        {/* Car details */}
        <div>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
            <div>
              {selected.is_featured&&<span style={{ fontSize:10, background:"#e6821e", color:"#fff", padding:"2px 8px", borderRadius:10, fontWeight:700, marginBottom:6, display:"inline-block" }}>⭐ FEATURED</span>}
              <div style={{ fontFamily:"Syne", fontSize:isMobile?20:26, fontWeight:800, color:"#000", marginTop:4 }}>{selected.year} {selected.brand} {selected.model}</div>
              {selected.variant&&<div style={{ fontSize:13, color:"#666", marginTop:2 }}>{selected.variant}</div>}
            </div>
            <div style={{ textAlign:"right" }}>
              {selected.discount_price ? (
                <>
                  <div style={{ fontFamily:"Syne", fontSize:22, fontWeight:800, color:"#1d9e75" }}>KES {Number(selected.discount_price).toLocaleString()}</div>
                  <div style={{ fontSize:13, color:"#888", textDecoration:"line-through" }}>KES {Number(selected.price).toLocaleString()}</div>
                  <div style={{ fontSize:11, color:"#1d9e75", fontWeight:600 }}>Save KES {(Number(selected.price)-Number(selected.discount_price)).toLocaleString()}</div>
                </>
              ):(
                <div style={{ fontFamily:"Syne", fontSize:22, fontWeight:800, color:"#e6821e" }}>KES {Number(selected.price).toLocaleString()}</div>
              )}
              {selected.price_negotiable&&<div style={{ fontSize:11, color:"#888", marginTop:2 }}>Price negotiable</div>}
            </div>
          </div>

          {/* Specs grid */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8, marginBottom:"1.5rem" }}>
            {[
              { icon:"⚙️", label:"Engine", value:selected.engine_cc?selected.engine_cc+"cc":"—" },
              { icon:"🔄", label:"Transmission", value:selected.transmission?.replace(/_/g," ")||"—" },
              { icon:"⛽", label:"Fuel", value:selected.fuel_type||"—" },
              { icon:"🚗", label:"Drive", value:selected.drive_type?.toUpperCase()||"—" },
              { icon:"💺", label:"Seats", value:selected.seats||5 },
              { icon:"🚪", label:"Doors", value:selected.doors||4 },
              { icon:"🎨", label:"Exterior", value:selected.color||"—" },
              { icon:"🪑", label:"Interior", value:selected.interior_color||"—" },
              { icon:"📦", label:"Stock", value:selected.stock_count+" available" },
            ].map(s=>(
              <div key={s.label} style={{ background:"#f8f8f8", borderRadius:8, padding:"0.6rem 0.75rem" }}>
                <div style={{ fontSize:9, color:"#888", textTransform:"uppercase", marginBottom:2 }}>{s.icon} {s.label}</div>
                <div style={{ fontSize:12, fontWeight:600, color:"#000", textTransform:"capitalize" }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Features */}
          {selected.features?.length>0&&(
            <div style={{ marginBottom:"1.5rem" }}>
              <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:700, color:"#000", marginBottom:10 }}>Features & Extras</div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                {selected.features.map((f,i)=>(
                  <span key={i} style={{ fontSize:11, background:"#f0fdf4", color:"#1d9e75", padding:"4px 10px", borderRadius:20, border:"1px solid #1d9e7530" }}>✓ {f}</span>
                ))}
              </div>
            </div>
          )}

          {/* Description */}
          {selected.description&&(
            <div style={{ marginBottom:"1.5rem" }}>
              <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:700, color:"#000", marginBottom:8 }}>About this vehicle</div>
              <div style={{ fontSize:13, color:"#555", lineHeight:1.8 }}>{selected.description}</div>
            </div>
          )}

          {/* Showroom */}
          <div style={{ background:"#f8f8f8", borderRadius:12, padding:"1rem" }}>
            <div style={{ fontFamily:"Syne", fontSize:13, fontWeight:700, color:"#000", marginBottom:8 }}>🏢 Showroom</div>
            <div style={{ fontSize:13, fontWeight:600, color:"#000", marginBottom:4 }}>{selected.showroom_name}</div>
            <div style={{ fontSize:12, color:"#666", marginBottom:4 }}>📍 {selected.showroom_location}</div>
            {selected.showroom_phone&&<div style={{ fontSize:12, color:"#666", marginBottom:4 }}>📞 {selected.showroom_phone}</div>}
            {selected.showroom_email&&<div style={{ fontSize:12, color:"#666" }}>✉️ {selected.showroom_email}</div>}
            <div style={{ fontSize:11, color:"#888", marginTop:8 }}>👁 {selected.views||0} views · 💬 {selected.enquiries||0} enquiries</div>
          </div>
        </div>

        {/* Enquiry panel */}
        <div>
          <div style={{ background:"#ffffff", border:"1px solid #eeeeee", borderRadius:12, padding:"1.25rem", position:"sticky", top:80 }}>
            <div style={{ fontFamily:"Syne", fontSize:15, fontWeight:800, color:"#000", marginBottom:4 }}>Interested in this car?</div>
            <div style={{ fontSize:12, color:"#777", marginBottom:"1.25rem" }}>Send an enquiry and the dealer will contact you directly</div>

            {!showEnquiry ? (
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                <button onClick={()=>setShowEnquiry(true)} style={{ background:"#e6821e", border:"none", borderRadius:10, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:14, fontWeight:700, padding:"13px", cursor:"pointer" }}>
                  💬 Send Enquiry
                </button>
                {selected.showroom_phone&&(
                  <a href={`tel:${selected.showroom_phone}`} style={{ display:"block", textAlign:"center", background:"#f0fdf4", border:"1px solid #1d9e7540", borderRadius:10, color:"#1d9e75", fontFamily:"Syne,sans-serif", fontSize:13, fontWeight:700, padding:"12px", textDecoration:"none" }}>
                    📞 Call Showroom
                  </a>
                )}
                {selected.showroom_phone&&(
                  <a href={`https://wa.me/254${selected.showroom_phone.replace(/^0/,"")}`} target="_blank" rel="noreferrer" style={{ display:"block", textAlign:"center", background:"#f0fdf4", border:"1px solid #1d9e7540", borderRadius:10, color:"#1d9e75", fontFamily:"Syne,sans-serif", fontSize:13, fontWeight:700, padding:"12px", textDecoration:"none" }}>
                    💚 WhatsApp Dealer
                  </a>
                )}
                <div style={{ background:"#fff8f0", border:"1px solid #e6821e30", borderRadius:8, padding:"0.75rem", marginTop:4 }}>
                  <div style={{ fontSize:11, color:"#e6821e", fontWeight:600, marginBottom:4 }}>🛡️ CCC Guarantee</div>
                  <div style={{ fontSize:11, color:"#555", lineHeight:1.5 }}>All listed dealers are verified by Car Care Connect. Transactions happen at the showroom — CCC is not liable for the sale but guarantees dealer authenticity.</div>
                </div>
              </div>
            ):(
              <div>
                <label style={lbl}>Your name *</label>
                <input style={inp} placeholder="Full name" value={enquiryForm.name} onChange={e=>setEnquiryForm(f=>({...f,name:e.target.value}))}/>
                <label style={lbl}>Phone number *</label>
                <input style={inp} type="tel" placeholder="0712 345 678" value={enquiryForm.phone} onChange={e=>setEnquiryForm(f=>({...f,phone:e.target.value}))}/>
                <label style={lbl}>Email (optional)</label>
                <input style={inp} type="email" placeholder="your@email.com" value={enquiryForm.email} onChange={e=>setEnquiryForm(f=>({...f,email:e.target.value}))}/>
                <label style={lbl}>Enquiry type</label>
                <select style={inp} value={enquiryForm.enquiry_type} onChange={e=>setEnquiryForm(f=>({...f,enquiry_type:e.target.value}))}>
                  <option value="general">General enquiry</option>
                  <option value="test_drive">Schedule test drive</option>
                  <option value="price_check">Price / financing</option>
                  <option value="trade_in">Trade-in my current car</option>
                </select>
                <label style={lbl}>Message (optional)</label>
                <textarea style={{...inp, resize:"vertical", minHeight:70}} placeholder="Any specific questions..." value={enquiryForm.message} onChange={e=>setEnquiryForm(f=>({...f,message:e.target.value}))}/>
                <div style={{ display:"flex", gap:8 }}>
                  <button onClick={submitEnquiry} disabled={submittingEnquiry}
                    style={{ flex:2, background:submittingEnquiry?"#ccc":"#e6821e", border:"none", borderRadius:9, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:13, fontWeight:700, padding:"11px", cursor:submittingEnquiry?"not-allowed":"pointer" }}>
                    {submittingEnquiry?"Sending...":"Send enquiry"}
                  </button>
                  <button onClick={()=>setShowEnquiry(false)} style={{ flex:1, background:"none", border:"1px solid #ddd", borderRadius:9, color:"#777", fontSize:12, padding:"11px", cursor:"pointer" }}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div>
      <div style={{ fontFamily:"Syne", fontSize:isMobile?18:24, fontWeight:800, color:"#000", marginBottom:4 }}>🚗 New Cars</div>
      <div style={{ fontSize:12, color:"#777", marginBottom:"1.5rem" }}>Browse brand new vehicles from verified dealerships across Nairobi</div>

      {/* Search */}
      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by brand, model, showroom..."
        style={{ width:"100%", background:"#ffffff", border:"1px solid #e5e5e5", borderRadius:10, padding:"12px 16px", fontSize:13, outline:"none", marginBottom:"1.25rem", fontFamily:"DM Sans,sans-serif" }}/>

      {/* Body type filter - icon grid */}
      <div style={{ marginBottom:"1.5rem" }}>
        <div style={{ fontFamily:"Syne", fontSize:13, fontWeight:700, color:"#000", marginBottom:10 }}>Browse by type</div>
        <div style={{ display:"grid", gridTemplateColumns:isMobile?"repeat(4,1fr)":"repeat(6,1fr)", gap:8 }}>
          {BODY_TYPES.map(bt=>(
            <button key={bt.key} onClick={()=>setBodyType(bt.key)}
              style={{ background:bodyType===bt.key?"#e6821e":"#f8f8f8", border:`1px solid ${bodyType===bt.key?"#e6821e":"#eeeeee"}`, borderRadius:10, padding:"0.75rem 0.5rem", cursor:"pointer", textAlign:"center" }}>
              <div style={{ fontSize:22, marginBottom:4 }}>{bt.icon}</div>
              <div style={{ fontSize:10, color:bodyType===bt.key?"#fff":"#555", fontWeight:bodyType===bt.key?700:400 }}>{bt.label}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Featured vehicles - horizontal scroll */}
      {featured.length>0&&(
        <div style={{ marginBottom:"2rem" }}>
          <div style={{ fontFamily:"Syne", fontSize:15, fontWeight:800, color:"#000", marginBottom:10 }}>⭐ Featured Vehicles</div>
          <div ref={featuredRef} style={{ display:"flex", gap:12, overflowX:"auto", paddingBottom:8, scrollbarWidth:"none" }}>
            {featured.map(car=>(
              <div key={car.id} onClick={()=>incrementView(car)}
                style={{ flexShrink:0, width:isMobile?240:280, background:"#ffffff", border:"1px solid #eeeeee", borderRadius:14, overflow:"hidden", cursor:"pointer" }}>
                <div style={{ position:"relative" }}>
                  {car.photos?.[0] ? (
                    <img src={car.photos[0]} alt={car.brand} style={{ width:"100%", height:160, objectFit:"cover" }}/>
                  ):(
                    <div style={{ height:160, background:"linear-gradient(135deg,#fff8f0,#e6821e20)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:48 }}>🚗</div>
                  )}
                  <span style={{ position:"absolute", top:8, left:8, background:"#e6821e", color:"#fff", fontSize:9, fontWeight:700, padding:"2px 7px", borderRadius:8 }}>⭐ FEATURED</span>
                  {car.discount_price&&<span style={{ position:"absolute", top:8, right:8, background:"#1d9e75", color:"#fff", fontSize:9, fontWeight:700, padding:"2px 7px", borderRadius:8 }}>🏷️ OFFER</span>}
                </div>
                <div style={{ padding:"0.75rem" }}>
                  <div style={{ fontSize:13, fontWeight:700, color:"#000", marginBottom:2 }}>{car.year} {car.brand} {car.model}</div>
                  {car.variant&&<div style={{ fontSize:10, color:"#888", marginBottom:4 }}>{car.variant}</div>}
                  <div style={{ display:"flex", gap:6, marginBottom:6, flexWrap:"wrap" }}>
                    {car.engine_cc&&<span style={{ fontSize:10, color:"#555", background:"#f5f5f5", padding:"2px 6px", borderRadius:6 }}>{car.engine_cc}cc</span>}
                    <span style={{ fontSize:10, color:"#555", background:"#f5f5f5", padding:"2px 6px", borderRadius:6 }}>{car.transmission}</span>
                    <span style={{ fontSize:10, color:"#555", background:"#f5f5f5", padding:"2px 6px", borderRadius:6 }}>{car.fuel_type}</span>
                  </div>
                  <div style={{ fontFamily:"Syne", fontSize:15, fontWeight:800, color:car.discount_price?"#1d9e75":"#e6821e" }}>
                    KES {Number(car.discount_price||car.price).toLocaleString()}
                  </div>
                  {car.discount_price&&<div style={{ fontSize:10, color:"#888", textDecoration:"line-through" }}>KES {Number(car.price).toLocaleString()}</div>}
                  <div style={{ fontSize:10, color:"#888", marginTop:4 }}>🏢 {car.showroom_name}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* New arrivals */}
      {newArrivals.length>0&&(
        <div style={{ marginBottom:"2rem" }}>
          <div style={{ fontFamily:"Syne", fontSize:15, fontWeight:800, color:"#000", marginBottom:10 }}>🆕 New Arrivals</div>
          <div style={{ display:"flex", gap:10, overflowX:"auto", paddingBottom:8, scrollbarWidth:"none" }}>
            {newArrivals.map(car=>(
              <div key={car.id} onClick={()=>incrementView(car)}
                style={{ flexShrink:0, width:isMobile?180:200, background:"#f8f8f8", border:"1px solid #eeeeee", borderRadius:12, overflow:"hidden", cursor:"pointer" }}>
                {car.photos?.[0] ? (
                  <img src={car.photos[0]} alt={car.brand} style={{ width:"100%", height:110, objectFit:"cover" }}/>
                ):(
                  <div style={{ height:110, background:"#f0f0f0", display:"flex", alignItems:"center", justifyContent:"center", fontSize:36 }}>🚗</div>
                )}
                <div style={{ padding:"0.6rem" }}>
                  <div style={{ fontSize:12, fontWeight:700, color:"#000" }}>{car.brand} {car.model}</div>
                  <div style={{ fontSize:10, color:"#888" }}>{car.year}</div>
                  <div style={{ fontSize:12, fontWeight:700, color:"#e6821e", marginTop:4 }}>KES {Number(car.discount_price||car.price).toLocaleString()}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Browse by brand */}
      <div style={{ marginBottom:"2rem" }}>
        <div style={{ fontFamily:"Syne", fontSize:15, fontWeight:800, color:"#000", marginBottom:10 }}>🏭 Browse by Brand</div>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
          <button onClick={()=>setSelectedBrand("all")}
            style={{ padding:"6px 14px", borderRadius:20, border:`1px solid ${selectedBrand==="all"?"#e6821e":"#eeeeee"}`, background:selectedBrand==="all"?"#e6821e":"#ffffff", color:selectedBrand==="all"?"#fff":"#555", fontSize:12, cursor:"pointer", fontWeight:selectedBrand==="all"?700:400 }}>
            All Brands
          </button>
          {brands.filter(b=>b.is_popular).map(brand=>(
            <button key={brand.id} onClick={()=>setSelectedBrand(selectedBrand===brand.name?"all":brand.name)}
              style={{ padding:"6px 14px", borderRadius:20, border:`1px solid ${selectedBrand===brand.name?"#e6821e":"#eeeeee"}`, background:selectedBrand===brand.name?"#e6821e":"#ffffff", color:selectedBrand===brand.name?"#fff":"#555", fontSize:12, cursor:"pointer", fontWeight:selectedBrand===brand.name?700:400 }}>
              {brand.name}
            </button>
          ))}
        </div>
      </div>

      {/* Sort */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"1rem", flexWrap:"wrap", gap:8 }}>
        <div style={{ fontSize:12, color:"#888" }}>{filtered.length} car{filtered.length!==1?"s":""} found</div>
        <select value={sortBy} onChange={e=>setSortBy(e.target.value)}
          style={{ background:"#f8f8f8", border:"1px solid #eeeeee", borderRadius:8, padding:"7px 12px", fontSize:12, outline:"none", color:"#000" }}>
          <option value="featured">Featured first</option>
          <option value="newest">Newest first</option>
          <option value="price_asc">Price: Low to high</option>
          <option value="price_desc">Price: High to low</option>
          <option value="enquiries">Most popular</option>
        </select>
      </div>

      {/* Cars grid */}
      {loading&&<div style={{ color:"#777", fontSize:13 }}>Loading...</div>}
      {!loading&&filtered.length===0&&(
        <div style={{ textAlign:"center", padding:"3rem", color:"#888" }}>
          <div style={{ fontSize:40, marginBottom:12 }}>🚗</div>
          <div style={{ fontSize:14 }}>No cars found matching your search</div>
          <button onClick={()=>{ setBodyType("all"); setSelectedBrand("all"); setSearch("") }} style={{ marginTop:12, background:"#e6821e", border:"none", borderRadius:8, color:"#fff", fontSize:12, padding:"8px 16px", cursor:"pointer" }}>Clear filters</button>
        </div>
      )}

      <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"repeat(2,1fr)", gap:12 }}>
        {filtered.map(car=>(
          <div key={car.id} onClick={()=>incrementView(car)}
            style={{ background:"#ffffff", border:"1px solid #eeeeee", borderRadius:14, overflow:"hidden", cursor:"pointer" }}>
            <div style={{ position:"relative" }}>
              {car.photos?.[0] ? (
                <img src={car.photos[0]} alt={car.brand} style={{ width:"100%", height:180, objectFit:"cover" }}/>
              ):(
                <div style={{ height:180, background:"linear-gradient(135deg,#f8f8f8,#e6821e10)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:56 }}>🚗</div>
              )}
              {car.is_featured&&<span style={{ position:"absolute", top:8, left:8, background:"#e6821e", color:"#fff", fontSize:9, fontWeight:700, padding:"2px 7px", borderRadius:8 }}>⭐ FEATURED</span>}
              {car.discount_price&&<span style={{ position:"absolute", top:8, right:8, background:"#1d9e75", color:"#fff", fontSize:9, fontWeight:700, padding:"2px 7px", borderRadius:8 }}>🏷️ SALE</span>}
            </div>
            <div style={{ padding:"1rem" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
                <div style={{ flex:1, minWidth:0, marginRight:8 }}>
                  <div style={{ fontSize:14, fontWeight:700, color:"#000", marginBottom:2 }}>{car.year} {car.brand} {car.model}</div>
                  {car.variant&&<div style={{ fontSize:11, color:"#888", marginBottom:4 }}>{car.variant}</div>}
                  <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                    {car.engine_cc&&<span style={{ fontSize:10, color:"#555", background:"#f5f5f5", padding:"2px 6px", borderRadius:6 }}>{car.engine_cc}cc</span>}
                    <span style={{ fontSize:10, color:"#555", background:"#f5f5f5", padding:"2px 6px", borderRadius:6 }}>{car.transmission}</span>
                    <span style={{ fontSize:10, color:"#555", background:"#f5f5f5", padding:"2px 6px", borderRadius:6, textTransform:"capitalize" }}>{car.body_type}</span>
                  </div>
                </div>
                <div style={{ textAlign:"right", flexShrink:0 }}>
                  <div style={{ fontFamily:"Syne", fontSize:15, fontWeight:800, color:car.discount_price?"#1d9e75":"#e6821e" }}>
                    KES {Number(car.discount_price||car.price).toLocaleString()}
                  </div>
                  {car.discount_price&&<div style={{ fontSize:10, color:"#888", textDecoration:"line-through" }}>KES {Number(car.price).toLocaleString()}</div>}
                </div>
              </div>
              <div style={{ fontSize:11, color:"#888" }}>🏢 {car.showroom_name} · 📍 {car.showroom_location}</div>
              <div style={{ fontSize:10, color:"#aaa", marginTop:4 }}>👁 {car.views||0} views · 💬 {car.enquiries||0} enquiries</div>
            </div>
          </div>
        ))}
      </div>

      {/* List your car CTA */}
      <div style={{ marginTop:"2rem", background:"linear-gradient(135deg,#fff8f0,#e6821e10)", border:"1px solid #e6821e30", borderRadius:16, padding:"1.5rem", textAlign:"center" }}>
        <div style={{ fontFamily:"Syne", fontSize:16, fontWeight:800, color:"#000", marginBottom:6 }}>Are you a car dealer? 🏢</div>
        <div style={{ fontSize:13, color:"#555", marginBottom:"1rem", lineHeight:1.6 }}>List your vehicles on CCC and reach thousands of car buyers in Nairobi. KES 2,000/month per dealership.</div>
        <button onClick={()=>setShowDealerReg(true)}
          style={{ background:"#e6821e", border:"none", borderRadius:10, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:13, fontWeight:700, padding:"11px 24px", cursor:"pointer" }}>
          Register as a Dealer →
        </button>
      </div>

      {/* Dealer Registration Modal */}
      {showDealerReg&&(
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:"1rem" }}>
          <div style={{ background:"#ffffff", borderRadius:16, padding:"1.5rem", width:"100%", maxWidth:480, maxHeight:"90vh", overflowY:"auto" }}>
            <div style={{ fontFamily:"Syne", fontSize:18, fontWeight:800, color:"#000", marginBottom:4 }}>Register as a Car Dealer 🏢</div>
            <div style={{ fontSize:12, color:"#777", marginBottom:"1.25rem" }}>Fill in your showroom details and we will contact you within 24 hours to activate your account.</div>

            <div style={{ marginBottom:10 }}>
              <label style={{ fontSize:11, color:"#666", textTransform:"uppercase", display:"block", marginBottom:4 }}>Showroom name *</label>
              <input value={dealerForm.showroom_name} onChange={e=>setDealerForm(f=>({...f,showroom_name:e.target.value}))} placeholder="e.g. Toyota Kenya Westlands"
                style={{ width:"100%", background:"#f8f8f8", border:"1px solid #e5e5e5", borderRadius:8, padding:"10px 12px", fontSize:13, outline:"none", fontFamily:"DM Sans,sans-serif" }}/>
            </div>
            <div style={{ marginBottom:10 }}>
              <label style={{ fontSize:11, color:"#666", textTransform:"uppercase", display:"block", marginBottom:4 }}>Location *</label>
              <input value={dealerForm.showroom_location} onChange={e=>setDealerForm(f=>({...f,showroom_location:e.target.value}))} placeholder="e.g. Westlands, Nairobi"
                style={{ width:"100%", background:"#f8f8f8", border:"1px solid #e5e5e5", borderRadius:8, padding:"10px 12px", fontSize:13, outline:"none", fontFamily:"DM Sans,sans-serif" }}/>
            </div>
            <div style={{ marginBottom:10 }}>
              <label style={{ fontSize:11, color:"#666", textTransform:"uppercase", display:"block", marginBottom:4 }}>Phone number *</label>
              <input type="tel" value={dealerForm.showroom_phone} onChange={e=>setDealerForm(f=>({...f,showroom_phone:e.target.value}))} placeholder="0712 345 678"
                style={{ width:"100%", background:"#f8f8f8", border:"1px solid #e5e5e5", borderRadius:8, padding:"10px 12px", fontSize:13, outline:"none", fontFamily:"DM Sans,sans-serif" }}/>
            </div>
            <div style={{ marginBottom:10 }}>
              <label style={{ fontSize:11, color:"#666", textTransform:"uppercase", display:"block", marginBottom:4 }}>Email</label>
              <input type="email" value={dealerForm.showroom_email} onChange={e=>setDealerForm(f=>({...f,showroom_email:e.target.value}))} placeholder="showroom@dealer.co.ke"
                style={{ width:"100%", background:"#f8f8f8", border:"1px solid #e5e5e5", borderRadius:8, padding:"10px 12px", fontSize:13, outline:"none", fontFamily:"DM Sans,sans-serif" }}/>
            </div>
            <div style={{ marginBottom:10 }}>
              <label style={{ fontSize:11, color:"#666", textTransform:"uppercase", display:"block", marginBottom:4 }}>Business registration number</label>
              <input value={dealerForm.business_registration} onChange={e=>setDealerForm(f=>({...f,business_registration:e.target.value}))} placeholder="e.g. CPR/2021/123456"
                style={{ width:"100%", background:"#f8f8f8", border:"1px solid #e5e5e5", borderRadius:8, padding:"10px 12px", fontSize:13, outline:"none", fontFamily:"DM Sans,sans-serif" }}/>
            </div>
            <div style={{ marginBottom:10 }}>
              <label style={{ fontSize:11, color:"#666", textTransform:"uppercase", display:"block", marginBottom:4 }}>Brands you sell (comma separated)</label>
              <input value={dealerForm.brands_sold} onChange={e=>setDealerForm(f=>({...f,brands_sold:e.target.value}))} placeholder="e.g. Toyota, Mazda, Suzuki"
                style={{ width:"100%", background:"#f8f8f8", border:"1px solid #e5e5e5", borderRadius:8, padding:"10px 12px", fontSize:13, outline:"none", fontFamily:"DM Sans,sans-serif" }}/>
            </div>
            <div style={{ marginBottom:10 }}>
              <label style={{ fontSize:11, color:"#666", textTransform:"uppercase", display:"block", marginBottom:4 }}>Average monthly stock (number of cars)</label>
              <input type="number" value={dealerForm.monthly_stock} onChange={e=>setDealerForm(f=>({...f,monthly_stock:e.target.value}))} placeholder="e.g. 20"
                style={{ width:"100%", background:"#f8f8f8", border:"1px solid #e5e5e5", borderRadius:8, padding:"10px 12px", fontSize:13, outline:"none", fontFamily:"DM Sans,sans-serif" }}/>
            </div>
            <div style={{ marginBottom:"1.25rem" }}>
              <label style={{ fontSize:11, color:"#666", textTransform:"uppercase", display:"block", marginBottom:4 }}>Website (optional)</label>
              <input value={dealerForm.website_url} onChange={e=>setDealerForm(f=>({...f,website_url:e.target.value}))} placeholder="https://yourshowroom.co.ke"
                style={{ width:"100%", background:"#f8f8f8", border:"1px solid #e5e5e5", borderRadius:8, padding:"10px 12px", fontSize:13, outline:"none", fontFamily:"DM Sans,sans-serif" }}/>
            </div>

            <div style={{ background:"#fff8f0", border:"1px solid #e6821e30", borderRadius:8, padding:"0.75rem", marginBottom:"1.25rem" }}>
              <div style={{ fontSize:11, color:"#e6821e", fontWeight:600, marginBottom:4 }}>💳 Listing fee: KES 2,000/month</div>
              <div style={{ fontSize:11, color:"#555", lineHeight:1.6 }}>After approval, you will pay KES 2,000/month to list unlimited cars. Our team will contact you within 24 hours to complete onboarding.</div>
            </div>

            <div style={{ display:"flex", gap:8 }}>
              <button onClick={submitDealerApplication} disabled={submittingDealer}
                style={{ flex:2, background:submittingDealer?"#ccc":"#e6821e", border:"none", borderRadius:10, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:14, fontWeight:700, padding:"13px", cursor:submittingDealer?"not-allowed":"pointer" }}>
                {submittingDealer?"Submitting...":"Submit Application"}
              </button>
              <button onClick={()=>setShowDealerReg(false)}
                style={{ flex:1, background:"none", border:"1px solid #ddd", borderRadius:10, color:"#777", fontSize:13, padding:"13px", cursor:"pointer" }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}