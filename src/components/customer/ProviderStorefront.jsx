import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"
import { useAuth } from "../../contexts/AuthContext"
import { useNavigate } from "react-router-dom"
import useIsMobile from "../../lib/useIsMobile"
import toast from "react-hot-toast"

export default function ProviderStorefront({ provider, onClose, onBook }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const [services, setServices] = useState([])
  const [inventory, setInventory] = useState([])
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [activePhoto, setActivePhoto] = useState(0)
  const [tab, setTab] = useState("about")
  const [bundles, setBundles] = useState([])
  const [bookingBundle, setBookingBundle] = useState(null)
  const [bundleForm, setBundleForm] = useState({ date:"", time:"", notes:"", payment_method:"mpesa" })
  const [bundleLoading, setBundleLoading] = useState(false)
  const [bookingService, setBookingService] = useState(null)
  const [bookForm, setBookForm] = useState({ date:"", time:"", notes:"", payment_method:"mpesa" })
  const [bookingLoading, setBookingLoading] = useState(false)

  useEffect(() => { load() }, [provider.id])

  async function bookService(e) {
    e.preventDefault()
    if (!bookingService) return
    setBookingLoading(true)
    try {
      const serviceAmount = Number(bookingService.discounted_price||bookingService.price||0)
      const { data: rateRow } = await supabase.from("commission_rates")
        .select("platform_rate,provider_rate")
        .eq("provider_type", ({"garage":"garage_shop_standard","garage_premium":"garage_shop_premium","panel_beater":"panel_beater_shop_standard","auto_electrician":"auto_electrician_shop_standard","auto_glass":"auto_glass_shop_standard","car_wash":"car_wash_standard_wash"}[provider.provider_type] || (provider.provider_type||"garage_shop_standard")+"_"+(bookingService.category||"shop_standard")))
        .maybeSingle()
      const platformRate = rateRow ? Number(rateRow.platform_rate) : 0.10
      const providerRate = rateRow ? Number(rateRow.provider_rate) : 0.90
      const { data: feeRow } = await supabase.from("app_settings").select("value").eq("key","marketplace_processing_fee_rate").maybeSingle()
      const custFeeRate = feeRow ? Number(feeRow.value)/100 : 0.01
      const processingFee = Math.round(serviceAmount * custFeeRate)
      const totalAmount = serviceAmount + processingFee
      const bookingNumber = "BK-"+Math.random().toString(36).substring(2,10).toUpperCase()
      const { data: booking, error } = await supabase.from("bookings").insert({
        customer_id: user.id, provider_id: provider.id,
        service_id: bookingService.id, service_name: bookingService.name,
        service_category: bookingService.category||"shop_standard",
        booking_date: bookForm.date, booking_time: bookForm.time,
        booking_number: bookingNumber,
        amount: serviceAmount, processing_fee: processingFee, total_amount: totalAmount,
        platform_commission: serviceAmount*platformRate, provider_earnings: serviceAmount*providerRate,
        platform_commission_rate: platformRate, provider_commission_rate: providerRate,
        payment_method: bookForm.payment_method, payment_status: "pending", status: "pending",
        notes: bookForm.notes,
      }).select().single()
      if (error) throw error
      if(bookForm.payment_method==="mpesa") {
        const { data: cp } = await supabase.from("profile_sensitive").select("mpesa_number").eq("id", user.id).maybeSingle()
        if(cp?.mpesa_number) {
          try {
            await fetch(import.meta.env.VITE_SUPABASE_URL+"/functions/v1/daraja-stk-push", {
              method:"POST",
              headers:{"Content-Type":"application/json","Authorization":"Bearer "+import.meta.env.VITE_SUPABASE_ANON_KEY},
              body:JSON.stringify({ booking_id:booking.id, amount:serviceAmount, phone:cp.mpesa_number, customer_id:user.id, provider_id:provider.id, service_name:bookingService.name })
            })
          } catch(e) {}
        }
      }
      await supabase.from("notifications").insert({ user_id:provider.id, title:"New booking! 📅", message:"New booking for "+bookingService.name+" on "+bookForm.date+" #"+bookingNumber, type:"success" })
      try { await fetch(import.meta.env.VITE_SUPABASE_URL+"/functions/v1/send-push", { method:"POST", headers:{"Content-Type":"application/json","Authorization":"Bearer "+import.meta.env.VITE_SUPABASE_ANON_KEY}, body:JSON.stringify({ user_id:provider.id, title:"New Booking! 📅", message:"New booking for "+bookingService.name }) }) } catch(e) {}
      toast.success("Booking submitted! Check your M-Pesa for payment prompt 📱")
      setBookingService(null)
      setBookForm({ date:"", time:"", notes:"", payment_method:"mpesa" })
    } catch(err) { toast.error(err.message) }
    finally { setBookingLoading(false) }
  }

  async function bookBundle(e) {
    e.preventDefault()
    if(!bookingBundle) return
    setBundleLoading(true)
    try {
      const amount = Number(bookingBundle.bundle_price)
      const { data: feeRow } = await supabase.from("app_settings").select("value").eq("key","marketplace_processing_fee_rate").maybeSingle()
      const custFeeRate = feeRow ? Number(feeRow.value)/100 : 0.01
      const processingFee = Math.round(amount * custFeeRate)
      const totalAmount = amount + processingFee
      const bookingNumber = "BK-"+Math.random().toString(36).substring(2,10).toUpperCase()
      const commRate = Number(bookingBundle.platform_commission_rate||0.10)
      const { data: booking, error } = await supabase.from("bookings").insert({
        customer_id: user.id, provider_id: provider.id,
        bundle_id: bookingBundle.id,
        service_name: bookingBundle.name+" (Bundle)",
        booking_date: bundleForm.date, booking_time: bundleForm.time,
        booking_number: bookingNumber,
        amount, processing_fee: processingFee, total_amount: totalAmount,
        platform_commission: amount*commRate,
        provider_earnings: amount*(1-commRate),
        platform_commission_rate: commRate,
        provider_commission_rate: 1-commRate,
        payment_method: bundleForm.payment_method,
        payment_status: "pending", status: "pending",
        notes: bundleForm.notes,
      }).select().single()
      if(error) throw error
      let stkFailed = false
      if(bundleForm.payment_method==="mpesa") {
        const { data: cp } = await supabase.from("profile_sensitive").select("mpesa_number").eq("id", user.id).maybeSingle()
        if(cp?.mpesa_number) {
          try {
            // Send totalAmount (bundle price + processing fee) - the booking record's
            // own total_amount already includes the fee, so charging just "amount" here
            // would genuinely undercharge the customer relative to what's tracked.
            const stkRes = await fetch(import.meta.env.VITE_SUPABASE_URL+"/functions/v1/daraja-stk-push", {
              method:"POST",
              headers:{"Content-Type":"application/json","Authorization":"Bearer "+import.meta.env.VITE_SUPABASE_ANON_KEY},
              body:JSON.stringify({ booking_id:booking.id, amount:totalAmount, phone:cp.mpesa_number, customer_id:user.id, provider_id:provider.id, service_name:bookingBundle.name+" Bundle" })
            })
            if (!stkRes.ok) stkFailed = true
          } catch(e) { stkFailed = true }
        } else {
          stkFailed = true
        }
      }
      await supabase.from("notifications").insert({ user_id:provider.id, title:"New bundle booking! 📦", message:"New bundle booking: "+bookingBundle.name+" on "+bundleForm.date+" #"+bookingNumber, type:"success" })
      if (stkFailed) {
        toast.error("Booking saved, but we couldn't send the M-Pesa prompt. Please contact support or try paying again from My Bookings.")
      } else {
        toast.success("Bundle booked! Check your M-Pesa 📱")
      }
      setBookingBundle(null)
      setBundleForm({ date:"", time:"", notes:"", payment_method:"mpesa" })
    } catch(err) { toast.error(err.message) }
    finally { setBundleLoading(false) }
  }
  async function load() {
    const [{ data: svcs }, { data: bds }, { data: inv }, { data: revs }] = await Promise.all([
      supabase.from("services").select("*").eq("provider_id", provider.id).eq("is_active", true),
      supabase.from("service_bundles").select("*").eq("provider_id", provider.id).eq("is_active", true).order("created_at",{ascending:false}),
      supabase.from("inventory").select("*").eq("provider_id", provider.id).eq("is_active", true).gt("stock_quantity", 0),
      supabase.from("reviews").select("*, profiles!reviews_customer_id_fkey(first_name,last_name)").eq("provider_id", provider.id).order("created_at",{ascending:false}).limit(5),
    ])
    setServices(svcs||[])
    setBundles(bds||[])
    setInventory(inv||[])
    setReviews(revs||[])
    setLoading(false)
  }

  const photos = provider.business_photos?.length > 0 ? provider.business_photos : []
  const avgRating = reviews.length ? (reviews.reduce((s,r)=>s+Number(r.provider_rating||0),0)/reviews.length).toFixed(1) : "—"
  const isInventoryProvider = ["parts_dealer","accessories_shop","tyre_shop"].includes(provider.provider_type)
  const PROVIDER_TYPE_ICONS = { garage:"🔧", garage_premium:"🚗", parts_dealer:"⚙️", accessories_shop:"✨", tyre_shop:"🛞", auto_electrician:"⚡", car_wash:"🚿", panel_beater:"🔨", auto_glass:"🪟" }

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.9)", zIndex:300, overflowY:"auto" }}>
      <div style={{ maxWidth:600, margin:"0 auto", background:"#ffffff", minHeight:"100vh" }}>
        
        {/* Header */}
        <div style={{ position:"sticky", top:0, zIndex:10, background:"#ffffff", padding:"0.75rem 1rem", display:"flex", justifyContent:"space-between", alignItems:"center", borderBottom:"1px solid #eeeeee" }}>
          <button onClick={onClose} style={{ background:"none", border:"none", color:"#555555", fontSize:22, cursor:"pointer", padding:"0 8px" }}>←</button>
          <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:700, color:"#000000" }}>{provider.business_name||`${provider.first_name} ${provider.last_name}`}</div>
          <div style={{ width:40 }}/>
        </div>

        {/* Photo Gallery */}
        {photos.length > 0 ? (
          <div style={{ position:"relative", height:220, overflow:"hidden" }}>
            <img src={photos[activePhoto]} alt="Business" style={{ width:"100%", height:"100%", objectFit:"cover" }}/>
            {photos.length > 1 && (
              <>
                <button onClick={()=>setActivePhoto(p=>Math.max(0,p-1))} style={{ position:"absolute", left:8, top:"50%", transform:"translateY(-50%)", background:"rgba(0,0,0,0.6)", border:"none", borderRadius:"50%", width:32, height:32, color:"#fff", cursor:"pointer", fontSize:16 }}>‹</button>
                <button onClick={()=>setActivePhoto(p=>Math.min(photos.length-1,p+1))} style={{ position:"absolute", right:8, top:"50%", transform:"translateY(-50%)", background:"rgba(0,0,0,0.6)", border:"none", borderRadius:"50%", width:32, height:32, color:"#fff", cursor:"pointer", fontSize:16 }}>›</button>
                <div style={{ position:"absolute", bottom:8, left:0, right:0, display:"flex", gap:4, justifyContent:"center" }}>
                  {photos.map((_,i)=>(
                    <div key={i} onClick={()=>setActivePhoto(i)} style={{ width:6, height:6, borderRadius:"50%", background:i===activePhoto?"#e6821e":"#666", cursor:"pointer" }}/>
                  ))}
                </div>
              </>
            )}
          </div>
        ) : (
          <div style={{ height:120, background:`linear-gradient(135deg,#fff8f0,#111)`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:48 }}>
            {PROVIDER_TYPE_ICONS[provider.provider_type]||"🔧"}
          </div>
        )}

        {/* Provider Info */}
        <div style={{ padding:"1.25rem" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:12 }}>
            <div>
              <div style={{ fontFamily:"Syne", fontSize:20, fontWeight:800, color:"#000000", marginBottom:4 }}>
                {provider.business_name||`${provider.first_name} ${provider.last_name}`}
              </div>
              <div style={{ display:"flex", gap:8, flexWrap:"wrap", alignItems:"center" }}>
                <span style={{ fontSize:12, color:"#e6821e", background:"#fff8f0", padding:"2px 8px", borderRadius:8 }}>
                  {PROVIDER_TYPE_ICONS[provider.provider_type]} {provider.provider_type?.replace(/_/g," ")}
                </span>
                {provider.is_verified&&<span style={{ fontSize:11, color:"#1d9e75" }}>✓ Verified</span>}
                {provider.city&&<span style={{ fontSize:11, color:"#777777" }}>📍 {provider.city}</span>}
              </div>
            </div>
            <div style={{ textAlign:"right" }}>
              <div style={{ fontFamily:"Syne", fontSize:22, fontWeight:800, color:"#e6821e" }}>{avgRating}</div>
              <div style={{ fontSize:10, color:"#777777" }}>⭐ {reviews.length} reviews</div>
            </div>
          </div>

          {/* CTA Buttons */}
          <div style={{ display:"flex", gap:8, marginBottom:"1.5rem" }}>
            {!isInventoryProvider&&(
              <button onClick={()=>setTab("services")}
                style={{ flex:1, background:"#e6821e", border:"none", borderRadius:10, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:14, fontWeight:700, padding:"12px", cursor:"pointer" }}>
                Book service
              </button>
            )}
            {isInventoryProvider&&(
              <button onClick={()=>{ onClose(); navigate("/dashboard/parts") }}
                style={{ flex:1, background:"#8b5cf6", border:"none", borderRadius:10, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:14, fontWeight:700, padding:"12px", cursor:"pointer" }}>
                Order parts
              </button>
            )}
            <button onClick={()=>{ onClose(); navigate("/dashboard/chat") }}
              style={{ background:"#ffffff", border:"1px solid #dddddd", borderRadius:10, color:"#555555", fontFamily:"Syne,sans-serif", fontSize:13, fontWeight:700, padding:"12px 16px", cursor:"pointer" }}>
              💬 Chat
            </button>
          </div>

          {/* Tabs */}
          <div style={{ display:"flex", gap:6, marginBottom:"1.25rem" }}>
            {[
              { k:"about", l:"About" },
              { k:"services", l:`Services (${services.length})` },
              ...(isInventoryProvider?[{ k:"inventory", l:`Products (${inventory.length})` }]:[]),
              ...(!isInventoryProvider&&bundles.length>0?[{ k:"bundles", l:`Bundles (${bundles.length})` }]:[]),
              { k:"reviews", l:`Reviews (${reviews.length})` },
            ].map(t=>(
              <button key={t.k} onClick={()=>setTab(t.k)}
                style={{ padding:"7px 14px", borderRadius:8, border:"none", fontSize:12, cursor:"pointer", background:tab===t.k?"#e6821e":"#555555", color:tab===t.k?"#fff":"#666", fontWeight:tab===t.k?700:400 }}>
                {t.l}
              </button>
            ))}
          </div>

          {/* About */}
          {tab==="about"&&(
            <div>
              {provider.bio&&<p style={{ fontSize:13, color:"#555555", lineHeight:1.7, marginBottom:12 }}>{provider.bio}</p>}
              <div style={{ background:"#ffffff", borderRadius:10, padding:"1rem" }}>
                {[
                  { label:"Business type", value:(PROVIDER_TYPE_ICONS[provider.provider_type]||"")+" "+(provider.provider_type?.replace(/_/g," ")||"—") },
                  { label:"Location", value:provider.city||"—" },
                  { label:"Rating", value:`${avgRating} ⭐ (${reviews.length} reviews)` },
                  { label:"Services", value:services.length+" services listed" },
                  { label:"Verified", value:provider.is_verified?"✓ Yes":"Pending" },
                ].map(f=>(
                  <div key={f.label} style={{ display:"flex", justifyContent:"space-between", padding:"8px 0", borderBottom:"1px solid #eeeeee" }}>
                    <span style={{ fontSize:12, color:"#777777" }}>{f.label}</span>
                    <span style={{ fontSize:12, color:"#000000" }}>{f.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Services */}
          {tab==="services"&&(
            <div>
              {services.length===0&&<div style={{ color:"#888888", fontSize:13, textAlign:"center", padding:"2rem" }}>No services listed yet</div>}
              {services.map(s=>(
                <div key={s.id} style={{ background:"#ffffff", border:"1px solid #eeeeee", borderRadius:10, padding:"1rem", marginBottom:8 }}>
                  {s.photos?.[0]&&<img src={s.photos[0]} alt={s.name} style={{ width:"100%", height:120, objectFit:"cover", borderRadius:8, marginBottom:8 }}/>}
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                    <div>
                      <div style={{ fontSize:14, fontWeight:600, color:"#000000", marginBottom:2 }}>{s.name}</div>
                      {s.description&&<div style={{ fontSize:11, color:"#666", marginBottom:4 }}>{s.description}</div>}
                      <div style={{ fontSize:11, color:"#777777" }}>⏱ {s.duration_minutes||60} min</div>
                    </div>
                    <div style={{ textAlign:"right" }}>
                        {s.discounted_price ? (
                        <div>
                          <span style={{ fontFamily:"Syne", fontSize:12, color:"#888", textDecoration:"line-through", marginRight:6 }}>KES {Number(s.price||0).toLocaleString()}</span>
                          <span style={{ fontFamily:"Syne", fontSize:15, fontWeight:800, color:"#1d9e75" }}>KES {Number(s.discounted_price).toLocaleString()}</span>
                          <span style={{ fontSize:10, color:"#1d9e75", background:"#f0fdf4", padding:"1px 6px", borderRadius:10, marginLeft:4 }}>{Math.round((1-s.discounted_price/s.price)*100)}% OFF</span>
                        </div>
                      ) : (
                        <div style={{ fontFamily:"Syne", fontSize:15, fontWeight:800, color:"#e6821e" }}>KES {Number(s.price||0).toLocaleString()}</div>
                      )}
                      <button onClick={()=>setBookingService(s)}
                        style={{ marginTop:6, background:"#e6821e", border:"none", borderRadius:7, color:"#fff", fontSize:11, fontWeight:700, padding:"5px 12px", cursor:"pointer" }}>
                        Book
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Inventory */}
          {tab==="inventory"&&(
            <div>
              {inventory.length===0&&<div style={{ color:"#888888", fontSize:13, textAlign:"center", padding:"2rem" }}>No products listed yet</div>}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                {inventory.map(item=>(
                  <div key={item.id} style={{ background:"#ffffff", border:"1px solid #eeeeee", borderRadius:10, padding:"0.75rem", cursor:"pointer" }}
                    onClick={()=>{ onClose(); navigate("/dashboard/parts") }}>
                    {item.photos?.[0]&&<img src={item.photos[0]} alt={item.name} style={{ width:"100%", height:90, objectFit:"cover", borderRadius:6, marginBottom:6 }}/>}
                    <div style={{ fontSize:12, fontWeight:600, color:"#000000", marginBottom:2 }}>{item.name}</div>
                    {item.brand&&<div style={{ fontSize:10, color:"#555555", marginBottom:2 }}>{item.brand}</div>}
                    <div style={{ fontFamily:"Syne", fontSize:13, fontWeight:800, color:"#e6821e" }}>KES {Number(item.price).toLocaleString()}</div>
                    <div style={{ fontSize:10, color:item.stock_quantity>5?"#1d9e75":"#e24b4a" }}>{item.stock_quantity} in stock</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Bundles */}
          {tab==="bundles"&&(
            <div>
              {bundles.map(b=>{
                const savings = Number(b.original_price)-Number(b.bundle_price)
                const savingsPct = Math.round(savings/Number(b.original_price)*100)
                const bundleServices = services.filter(s=>b.service_ids?.includes(s.id))
                return (
                  <div key={b.id} style={{ background:"#fff", border:"1px solid #eee", borderRadius:12, padding:"1rem", marginBottom:10 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
                      <div style={{ flex:1 }}>
                        <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:800 }}>{b.name}</div>
                        {b.description&&<div style={{ fontSize:11, color:"#666", marginTop:2, lineHeight:1.5 }}>{b.description}</div>}
                      </div>
                      <span style={{ fontSize:11, background:"#f0fdf4", color:"#1d9e75", padding:"2px 8px", borderRadius:10, fontWeight:700, flexShrink:0, marginLeft:8 }}>Save {savingsPct}%</span>
                    </div>
                    <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:10 }}>
                      {bundleServices.map(s=>(
                        <span key={s.id} style={{ fontSize:11, background:"#f8f8f8", border:"1px solid #eee", borderRadius:6, padding:"3px 8px", color:"#555" }}>✓ {s.name}</span>
                      ))}
                    </div>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                      <div>
                        <span style={{ fontSize:12, color:"#888", textDecoration:"line-through", marginRight:6 }}>KES {Number(b.original_price).toLocaleString()}</span>
                        <span style={{ fontFamily:"Syne", fontSize:16, fontWeight:800, color:"#1d9e75" }}>KES {Number(b.bundle_price).toLocaleString()}</span>
                      </div>
                      <button onClick={()=>setBookingBundle(b)} style={{ background:"#1d9e75", border:"none", borderRadius:8, color:"#fff", fontSize:12, fontWeight:700, padding:"8px 16px", cursor:"pointer" }}>Book Bundle</button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          {/* Bundle booking modal */}
      {bookingBundle&&(
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", zIndex:300, display:"flex", alignItems:"flex-end", justifyContent:"center" }}>
          <div style={{ background:"#fff", borderRadius:"20px 20px 0 0", padding:"1.5rem", width:"100%", maxWidth:480, maxHeight:"80vh", overflowY:"auto" }}>
            <div style={{ fontFamily:"Syne", fontSize:16, fontWeight:800, marginBottom:4 }}>{bookingBundle.name}</div>
            <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:"1.25rem" }}>
              <span style={{ fontSize:13, color:"#888", textDecoration:"line-through" }}>KES {Number(bookingBundle.original_price).toLocaleString()}</span>
              <span style={{ fontFamily:"Syne", fontSize:18, fontWeight:800, color:"#1d9e75" }}>KES {Number(bookingBundle.bundle_price).toLocaleString()}</span>
              <span style={{ fontSize:11, background:"#f0fdf4", color:"#1d9e75", padding:"2px 8px", borderRadius:10 }}>Save {Math.round((1-bookingBundle.bundle_price/bookingBundle.original_price)*100)}%</span>
            </div>
            <form onSubmit={bookBundle}>
              <label style={{ fontSize:11, color:"#666", display:"block", marginBottom:4 }}>Date *</label>
              <input type="date" required value={bundleForm.date} onChange={e=>setBundleForm(f=>({...f,date:e.target.value}))} min={new Date().toISOString().split("T")[0]}
                style={{ width:"100%", background:"#f8f8f8", border:"1px solid #eee", borderRadius:8, padding:"10px 12px", fontSize:13, outline:"none", marginBottom:10, boxSizing:"border-box" }}/>
              <label style={{ fontSize:11, color:"#666", display:"block", marginBottom:4 }}>Time *</label>
              <input type="time" required value={bundleForm.time} onChange={e=>setBundleForm(f=>({...f,time:e.target.value}))}
                style={{ width:"100%", background:"#f8f8f8", border:"1px solid #eee", borderRadius:8, padding:"10px 12px", fontSize:13, outline:"none", marginBottom:10, boxSizing:"border-box" }}/>
              <label style={{ fontSize:11, color:"#666", display:"block", marginBottom:4 }}>Notes (optional)</label>
              <textarea value={bundleForm.notes} onChange={e=>setBundleForm(f=>({...f,notes:e.target.value}))} rows={2}
                style={{ width:"100%", background:"#f8f8f8", border:"1px solid #eee", borderRadius:8, padding:"10px 12px", fontSize:13, outline:"none", resize:"none", marginBottom:10, boxSizing:"border-box" }}/>
              <div style={{ display:"flex", gap:8 }}>
                <button type="submit" disabled={bundleLoading} style={{ flex:1, background:"#1d9e75", border:"none", borderRadius:8, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:14, fontWeight:700, padding:"12px", cursor:"pointer" }}>{bundleLoading?"Booking...":"Confirm Bundle Booking"}</button>
                <button type="button" onClick={()=>setBookingBundle(null)} style={{ background:"#f0f0f0", border:"none", borderRadius:8, color:"#555", fontSize:13, padding:"12px 16px", cursor:"pointer" }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Reviews */}
          {tab==="reviews"&&(
            <div>
              {reviews.length===0&&<div style={{ color:"#888888", fontSize:13, textAlign:"center", padding:"2rem" }}>No reviews yet</div>}
              {reviews.map(r=>(
                <div key={r.id} style={{ background:"#ffffff", border:"1px solid #eeeeee", borderRadius:10, padding:"1rem", marginBottom:8 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
                    <div style={{ fontSize:12, fontWeight:600, color:"#000000" }}>{r.profiles?.first_name} {r.profiles?.last_name?.[0]}.</div>
                    <div style={{ fontSize:12, color:"#e6821e" }}>{"⭐".repeat(Math.round(r.provider_rating||0))}</div>
                  </div>
                  {r.provider_comment&&<div style={{ fontSize:12, color:"#555555", lineHeight:1.6 }}>{r.provider_comment}</div>}
                  <div style={{ fontSize:10, color:"#888888", marginTop:4 }}>{new Date(r.created_at).toLocaleDateString()}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}




