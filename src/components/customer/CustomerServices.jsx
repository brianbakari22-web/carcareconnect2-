import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"
import { useAuth } from "../../contexts/AuthContext"
import { initFlutterwavePayment } from "../../lib/flutterwave"
import { useLanguage } from "../../contexts/LanguageContext"
import { sendBookingConfirmation } from "../../lib/email"
import toast from "react-hot-toast"

const CATEGORIES = ["All","Oil Change","Brake Repair","Tire Service","Engine Repair","AC Repair","Transmission","Detailing","Maintenance","Electrical","Body Repair"]
const TIMES = ["07:00","07:30","08:00","08:30","09:00","09:30","10:00","10:30","11:00","11:30","12:00","12:30","13:00","13:30","14:00","14:30","15:00","15:30","16:00","16:30","17:00","17:30","18:00"]

function Calendar({ selected, onChange }) {
  const [current, setCurrent] = useState(new Date())
  const today = new Date(); today.setHours(0,0,0,0)
  const year = current.getFullYear(), month = current.getMonth()
  const firstDay = new Date(year,month,1).getDay()
  const daysInMonth = new Date(year,month+1,0).getDate()
  const cells = []
  for (let i=0;i<firstDay;i++) cells.push(null)
  for (let d=1;d<=daysInMonth;d++) cells.push(d)
  const fmt = d => `${year}-${String(month+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`
  const isPast = d => d && new Date(year,month,d) < today
  const isSelected = d => d && fmt(d) === selected
  const isToday = d => d && d===today.getDate()&&month===today.getMonth()&&year===today.getFullYear()
  return (
    <div style={{background:"#0f0f0f",borderRadius:10,padding:"1rem",border:"1px solid #222"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <button onClick={()=>setCurrent(new Date(year,month-1,1))} style={{background:"none",border:"none",color:"#888",cursor:"pointer",fontSize:18,padding:"4px 8px"}}>&#8249;</button>
        <div style={{fontSize:13,fontWeight:500,color:"#f0ede6"}}>{current.toLocaleString("default",{month:"long",year:"numeric"})}</div>
        <button onClick={()=>setCurrent(new Date(year,month+1,1))} style={{background:"none",border:"none",color:"#888",cursor:"pointer",fontSize:18,padding:"4px 8px"}}>&#8250;</button>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2,marginBottom:6}}>
        {["Su","Mo","Tu","We","Th","Fr","Sa"].map(d=><div key={d} style={{textAlign:"center",fontSize:10,color:"#555",padding:"4px 0"}}>{d}</div>)}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2}}>
        {cells.map((d,i)=>(
          <div key={i} onClick={()=>d&&!isPast(d)&&onChange(fmt(d))}
            style={{textAlign:"center",padding:"7px 4px",borderRadius:6,fontSize:12,cursor:d&&!isPast(d)?"pointer":"default",background:isSelected(d)?"#e6821e":isToday(d)?"#1a1208":"transparent",color:isSelected(d)?"#fff":isPast(d)?"#333":d?"#f0ede6":"transparent",fontWeight:isSelected(d)||isToday(d)?700:400,border:isToday(d)&&!isSelected(d)?"1px solid #e6821e40":"1px solid transparent"}}>
            {d||""}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function CustomerServices() {
  const { user, profile } = useAuth()
  const { t } = useLanguage()
  const [services, setServices] = useState([])
  const [vehicles, setVehicles] = useState([])
  const [search, setSearch] = useState("")
  const [category, setCategory] = useState("All")
  const [loading, setLoading] = useState(true)
  const [booking, setBooking] = useState(null)
  const [step, setStep] = useState(1)
  const [bookForm, setBookForm] = useState({ date:"", time:"", vehicleId:"", notes:"", concierge:false, pickupAddress:"", promoCode:"", paymentMethod:t("cash") })
  const [submitting, setSubmitting] = useState(false)
  const [promoValid, setPromoValid] = useState(null)
  const [discount, setDiscount] = useState(0)

  useEffect(()=>{ fetchServices(); if(user) fetchVehicles() },[user])

  async function checkDateAvailability(providerId, date) {
    if (!date || !providerId) return { available:true, slots:null }
    const { data: avail } = await supabase.from("provider_availability")
      .select("*").eq("provider_id", providerId).eq("date", date).single()
    if (avail?.is_blocked) return { available:false, reason:`Not available — ${avail.block_reason||"blocked"}`, slots:0 }
    const { data: count } = await supabase.rpc("get_provider_booking_count", { p_provider_id:providerId, p_date:date })
    const max = avail?.max_bookings ?? 5
    const booked = count || 0
    if (booked >= max) return { available:false, reason:"Fully booked for this date", slots:0 }
    return { available:true, slots:max-booked, reason:`${max-booked} slot${max-booked!==1?"s":""} available` }
  }

  async function fetchServices() {
    const {data} = await supabase.from("services").select("*, profile_public(id,first_name,last_name,business_name)").eq("is_active",true).order("created_at",{ascending:false})
    setServices(data||[]); setLoading(false)
  }

  async function fetchVehicles() {
    const {data} = await supabase.from("vehicles").select("*").eq("user_id",user.id).order("is_default",{ascending:false})
    setVehicles(data||[])
  }

  async function validatePromo() {
    if (!bookForm.promoCode) return
    const {data:promo} = await supabase.from("promo_codes").select("*").eq("code",bookForm.promoCode.toUpperCase()).eq("is_active",true).single()
    if (!promo) { setPromoValid(false); setDiscount(0); return }
    if (promo.valid_until&&new Date(promo.valid_until)<new Date()) { setPromoValid(false); setDiscount(0); return }
    if (promo.usage_limit&&promo.used_count>=promo.usage_limit) { setPromoValid(false); setDiscount(0); return }
    const price = Number(booking?.discounted_price||booking?.price||0)
    if (price<Number(promo.min_purchase)) { toast.error(`Min purchase $${promo.min_purchase}`); setPromoValid(false); return }
    const d = promo.discount_type==="percentage"?price*(promo.discount_value/100):Number(promo.discount_value)
    setDiscount(d); setPromoValid(true); toast.success(`Promo applied — saving $${d.toFixed(2)}`)
  }

  function getTotal() {
    return Math.max(0, Number(booking?.discounted_price||booking?.price||0)-discount)+(bookForm.concierge?20:0)
  }

  function getCommissions(total) {
    const platform = +(total*0.15).toFixed(2)
    const driver = bookForm.concierge ? +(total*0.15).toFixed(2) : 0
    const provider = +(total-platform-driver).toFixed(2)
    return { platform, provider, driver }
  }

  async function createBookingRecord(paymentStatus) {
    const total = getTotal()
    const { platform, provider, driver } = getCommissions(total)
    if (bookForm.promoCode&&promoValid) {
      const {data:promo} = await supabase.from("promo_codes").select("used_count").eq("code",bookForm.promoCode.toUpperCase()).single()
      if (promo) await supabase.from("promo_codes").update({used_count:promo.used_count+1}).eq("code",bookForm.promoCode.toUpperCase())
    }
    const { error } = await supabase.from("bookings").insert({
      customer_id:user.id, provider_id:booking.provider_id, service_id:booking.id,
      service_name:booking.name, vehicle_id:bookForm.vehicleId,
      booking_date:bookForm.date, booking_time:bookForm.time,
      total_amount:total, payment_status:paymentStatus,
      is_concierge:bookForm.concierge, pickup_address:bookForm.pickupAddress||null,
      notes:bookForm.notes||null, promo_code:bookForm.promoCode||null,
      discount_amount:discount, platform_commission:platform,
      provider_earnings:provider, driver_earnings:driver,
    })
    if (error) throw error
    const { data: custSensitive } = await supabase.from("profile_sensitive").select("email").eq("id", user.id).single()
    const { data: provProfile } = await supabase.from("profile_public").select("first_name,last_name,business_name").eq("id", booking.provider_id).single()
    if (custSensitive?.email) {
      const providerName = provProfile?.business_name || `${provProfile?.first_name} ${provProfile?.last_name}`
      await sendBookingConfirmation(custSensitive.email, { ...booking, service_name:booking.name, booking_date:bookForm.date, booking_time:bookForm.time, booking_number:"New booking", total_amount:getTotal() }, providerName)
    }
    await supabase.from("notifications").insert({user_id:booking.provider_id,title:"New booking received",message:`New booking for ${booking.name} on ${bookForm.date} at ${bookForm.time}`,type:"info"})
    const pointsEarned = Math.floor(total*10)
    const {data:existing} = await supabase.from("loyalty_points").select("points,lifetime_points").eq("user_id",user.id).single()
    if (existing) await supabase.from("loyalty_points").update({points:existing.points+pointsEarned,lifetime_points:existing.lifetime_points+pointsEarned}).eq("user_id",user.id)
    else await supabase.from("loyalty_points").insert({user_id:user.id,points:pointsEarned,lifetime_points:pointsEarned})
  }

  async function submitBooking() {
    if (!bookForm.vehicleId) return toast.error("Please select a vehicle")
    if (!bookForm.date) return toast.error("Please select a date")
    if (!bookForm.time) return toast.error("Please select a time")

    if (bookForm.paymentMethod === t("cash")) {
      setSubmitting(true)
      try {
        await createBookingRecord("pending")
        toast.success("Booking confirmed! Pay at the shop.")
        closeModal()
      } catch(err) { toast.error(err.message) }
      finally { setSubmitting(false) }
      return
    }

    // Online payment via Flutterwave
    const total = getTotal()
    const { data: authData } = await supabase.auth.getUser()
    const { data: sensitive } = await supabase.from("profile_sensitive").select("email,phone").eq("id",user.id).single()
    const email = sensitive?.email || authData?.user?.email || "customer@carcareconnect.com"
    const phone = sensitive?.phone || "0700000000"
    const name = `${profile?.first_name||""} ${profile?.last_name||""}`.trim() || "Customer"

    setSubmitting(true)

    try {
      await initFlutterwavePayment({
        amount: total,
        currency: "KES",
        customer: { email, phone, name },
        bookingId: `${user.id.slice(0,8)}-${Date.now()}`,
        onSuccess: async (response) => {
          try {
            await createBookingRecord("paid")
            toast.success("Payment successful! Booking confirmed.")
            closeModal()
          } catch(err) { toast.error(err.message) }
          finally { setSubmitting(false) }
        },
        onClose: () => {
          toast("Payment window closed", { icon: "⚠️" })
          setSubmitting(false)
        }
      })
    } catch(err) {
      toast.error("Could not open payment window. Try again.")
      setSubmitting(false)
    }
  }

  function closeModal() {
    setBooking(null); setStep(1); setDiscount(0); setPromoValid(null)
    setBookForm({ date:"", time:"", vehicleId:"", notes:"", concierge:false, pickupAddress:"", promoCode:"", paymentMethod:t("cash") })
  }

  function openBooking(s) {
    setBooking(s); setStep(1); setDiscount(0); setPromoValid(null)
    setBookForm({ date:"", time:"", vehicleId:vehicles.find(v=>v.is_default)?.id||"", notes:"", concierge:false, pickupAddress:"", promoCode:"", paymentMethod:t("cash") })
  }

  const filtered = services.filter(s=>(category==="All"||s.category===category)&&(s.name.toLowerCase().includes(search.toLowerCase())||s.category.toLowerCase().includes(search.toLowerCase())))
  const inp = { width:"100%", background:"#0f0f0f", border:"1px solid #222", borderRadius:8, padding:"10px 12px", color:"#f0ede6", fontSize:13, outline:"none", fontFamily:"'DM Sans',sans-serif" }
  const vehicle = vehicles.find(v=>v.id===bookForm.vehicleId)
  const total = getTotal()
  const { platform, provider, driver } = getCommissions(total)

  return (
    <div>
      <div style={{ display:"flex", gap:10, marginBottom:"1rem", flexWrap:"wrap" }}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder={t("searchServices")} style={{flex:1,minWidth:180,...inp}}/>
        <select value={category} onChange={e=>setCategory(e.target.value)} style={{...inp,width:"auto"}}>
          {CATEGORIES.map(c=><option key={c}>{c}</option>)}
        </select>
      </div>
      {loading&&<div style={{color:"#555",fontSize:13}}>Loading services...</div>}
      {!loading&&filtered.length===0&&<div style={{color:"#444",textAlign:"center",padding:"2rem",fontSize:13}}>{services.length===0?"No services available yet.":"No services match your search."}</div>}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))",gap:10}}>
        {filtered.map(s=>(
          <div key={s.id} style={{background:"#111",border:"1px solid #1e1e1e",borderRadius:10,padding:"1rem",cursor:"pointer",transition:"border-color 0.12s"}} onMouseEnter={e=>e.currentTarget.style.borderColor="#e6821e40"} onMouseLeave={e=>e.currentTarget.style.borderColor="#1e1e1e"}>
            <div style={{fontSize:11,color:"#555",marginBottom:6}}>{s.category}</div>
            <div style={{fontSize:14,fontWeight:500,color:"#f0ede6",marginBottom:4}}>{s.name}</div>
            <div style={{fontSize:11,color:"#666",marginBottom:8,lineHeight:1.4}}>{s.description?.slice(0,60)}{s.description?.length>60?"...":""}</div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
              <span style={{fontFamily:"Syne",fontSize:16,fontWeight:800,color:"#e6821e"}}>${Number(s.discounted_price||s.price).toFixed(2)}</span>
              <span style={{fontSize:11,color:"#555"}}>{s.duration}min</span>
            </div>
            <div style={{fontSize:11,color:"#666",marginBottom:10}}>{s.profile_public?.business_name||`${s.profile_public?.first_name||""} ${s.profile_public?.last_name||""}`}</div>
            <button onClick={()=>openBooking(s)} style={{width:"100%",background:"#e6821e",border:"none",borderRadius:7,color:"#fff",fontSize:12,fontWeight:700,padding:"8px",cursor:"pointer",fontFamily:"Syne,sans-serif"}}>Book Now</button>
          </div>
        ))}
      </div>

      {booking&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.9)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:"1rem"}}>
          <div style={{background:"#111",border:"1px solid #2a2a2a",borderRadius:14,width:"100%",maxWidth:480,maxHeight:"92vh",overflowY:"auto"}}>
            <div style={{padding:"1.25rem 1.25rem 0",display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
              <div>
                <div style={{fontFamily:"Syne",fontSize:16,fontWeight:800,color:"#f0ede6"}}>{booking.name}</div>
                <div style={{fontSize:12,color:"#555",marginTop:2}}>{booking.profile_public?.business_name||`${booking.profile_public?.first_name} ${booking.profile_public?.last_name}`}</div>
              </div>
              <button onClick={closeModal} style={{background:"none",border:"none",color:"#555",fontSize:22,cursor:"pointer",lineHeight:1}}>x</button>
            </div>
            <div style={{display:"flex",padding:"1rem 1.25rem 0"}}>
              {["Date","Vehicle","Payment","Confirm"].map((s,i)=>(
                <div key={s} style={{flex:1,textAlign:"center"}}>
                  <div style={{width:24,height:24,borderRadius:"50%",background:step>i+1?"#1d9e75":step===i+1?"#e6821e":"#222",color:step>=i+1?"#fff":"#555",fontSize:11,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 4px"}}>
                    {step>i+1?"v":i+1}
                  </div>
                  <div style={{fontSize:9,color:step===i+1?"#e6821e":"#555"}}>{s}</div>
                </div>
              ))}
            </div>
            <div style={{padding:"1.25rem"}}>

              {step===1&&(
                <div>
                  <div style={{fontFamily:"Syne",fontSize:13,fontWeight:700,marginBottom:10,color:"#f0ede6"}}>Pick a date</div>
                  <Calendar selected={bookForm.date} onChange={d=>setBookForm(f=>({...f,date:d}))}/>
                  {bookForm.date&&(
                    <>
                      <div style={{fontFamily:"Syne",fontSize:13,fontWeight:700,margin:"1rem 0 10px",color:"#f0ede6"}}>Pick a time</div>
                      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6}}>
                        {TIMES.map(t=>(
                          <button key={t} onClick={()=>setBookForm(f=>({...f,time:t}))} style={{padding:"8px 4px",borderRadius:7,border:`1px solid ${bookForm.time===t?"#e6821e":"#222"}`,background:bookForm.time===t?"#1a1208":"#0f0f0f",color:bookForm.time===t?"#e6821e":"#888",fontSize:12,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>
                            {t}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                  <button disabled={!bookForm.date||!bookForm.time} onClick={()=>setStep(2)} style={{width:"100%",marginTop:"1rem",background:bookForm.date&&bookForm.time?"#e6821e":"#333",border:"none",borderRadius:9,color:bookForm.date&&bookForm.time?"#fff":"#666",fontFamily:"Syne,sans-serif",fontSize:14,fontWeight:700,padding:"13px",cursor:bookForm.date&&bookForm.time?"pointer":"not-allowed"}}>
                    Next
                  </button>
                </div>
              )}

              {step===2&&(
                <div>
                  <div style={{fontFamily:"Syne",fontSize:13,fontWeight:700,marginBottom:12,color:"#f0ede6"}}>Select your vehicle</div>
                  {vehicles.length===0?(
                    <div style={{background:"#1a1208",border:"1px solid #e6821e30",borderRadius:10,padding:"1rem",textAlign:"center",marginBottom:"1rem"}}>
                      <div style={{fontSize:13,color:"#e6821e",marginBottom:4}}>No vehicles added yet</div>
                      <div style={{fontSize:11,color:"#666"}}>Go to My Vehicles to add one first</div>
                    </div>
                  ):(
                    <div style={{display:"grid",gap:8,marginBottom:"1rem"}}>
                      {vehicles.map(v=>(
                        <div key={v.id} onClick={()=>setBookForm(f=>({...f,vehicleId:v.id}))} style={{background:"#0f0f0f",border:`1px solid ${bookForm.vehicleId===v.id?"#e6821e":"#222"}`,borderRadius:10,padding:"0.9rem",cursor:"pointer",display:"flex",alignItems:"center",gap:12}}>
                          <div style={{width:36,height:36,background:"#1a1208",borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>*</div>
                          <div style={{flex:1}}>
                            <div style={{fontSize:13,fontWeight:500,color:"#f0ede6"}}>{v.make} {v.model}</div>
                            <div style={{fontSize:11,color:"#555"}}>{v.year} · {v.color} · {v.license_plate}</div>
                          </div>
                          {bookForm.vehicleId===v.id&&<div style={{color:"#e6821e",fontSize:16}}>OK</div>}
                          {v.is_default&&bookForm.vehicleId!==v.id&&<div style={{fontSize:10,color:"#555"}}>Default</div>}
                        </div>
                      ))}
                    </div>
                  )}
                  <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",marginBottom:"1rem",fontSize:13,color:"#ccc"}}>
                    <input type="checkbox" checked={bookForm.concierge} onChange={e=>setBookForm(f=>({...f,concierge:e.target.checked}))}/>
                    Concierge pickup/delivery <span style={{color:"#e6821e",marginLeft:4}}>+$20</span>
                  </label>
                  {bookForm.concierge&&<input placeholder="Your pickup address" value={bookForm.pickupAddress} onChange={e=>setBookForm(f=>({...f,pickupAddress:e.target.value}))} style={{...inp,marginBottom:"1rem"}}/>}
                  <textarea placeholder="Notes for provider (optional)" value={bookForm.notes} onChange={e=>setBookForm(f=>({...f,notes:e.target.value}))} rows={2} style={{...inp,marginBottom:"1rem",resize:"vertical"}}/>
                  <div style={{display:"flex",gap:8}}>
                    <button onClick={()=>setStep(1)} style={{flex:1,background:"none",border:"1px solid #333",borderRadius:9,color:"#888",fontSize:13,padding:"12px",cursor:"pointer"}}>Back</button>
                    <button disabled={!bookForm.vehicleId} onClick={()=>setStep(3)} style={{flex:2,background:bookForm.vehicleId?"#e6821e":"#333",border:"none",borderRadius:9,color:bookForm.vehicleId?"#fff":"#666",fontFamily:"Syne,sans-serif",fontSize:14,fontWeight:700,padding:"12px",cursor:bookForm.vehicleId?"pointer":"not-allowed"}}>Next</button>
                  </div>
                </div>
              )}

              {step===3&&(
                <div>
                  <div style={{fontFamily:"Syne",fontSize:13,fontWeight:700,marginBottom:12,color:"#f0ede6"}}>Payment method</div>
                  <div style={{display:"grid",gap:8,marginBottom:"1rem"}}>
                    {[
                      {key:t("cash"),label:t("cash"),desc:"Pay at the shop on arrival",icon:"$"},
                      {key:"mpesa",label:"M-Pesa",desc:"STK push to your phone",icon:"M"},
                      {key:"card",label:"Card",desc:"Visa or Mastercard",icon:"C"},
                    ].map(m=>(
                      <div key={m.key} onClick={()=>setBookForm(f=>({...f,paymentMethod:m.key}))} style={{background:"#0f0f0f",border:`1px solid ${bookForm.paymentMethod===m.key?"#e6821e":"#222"}`,borderRadius:10,padding:"0.9rem",cursor:"pointer",display:"flex",alignItems:"center",gap:12}}>
                        <div style={{width:38,height:38,background:"#1a1208",borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,color:"#e6821e",fontWeight:700}}>{m.icon}</div>
                        <div style={{flex:1}}>
                          <div style={{fontSize:13,fontWeight:500,color:"#f0ede6"}}>{m.label}</div>
                          <div style={{fontSize:11,color:"#555"}}>{m.desc}</div>
                        </div>
                        {bookForm.paymentMethod===m.key&&<div style={{color:"#e6821e",fontSize:14,fontWeight:700}}>OK</div>}
                      </div>
                    ))}
                  </div>
                  <div style={{marginBottom:"1rem"}}>
                    <div style={{fontSize:11,color:"#666",textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:6}}>Promo code</div>
                    <div style={{display:"flex",gap:8}}>
                      <input placeholder="Enter code" value={bookForm.promoCode} onChange={e=>{setBookForm(f=>({...f,promoCode:e.target.value}));setPromoValid(null);setDiscount(0)}} style={{...inp,flex:1}}/>
                      <button onClick={validatePromo} style={{background:"#1a1208",border:"1px solid #e6821e40",borderRadius:8,color:"#e6821e",fontSize:12,padding:"0 14px",cursor:"pointer",whiteSpace:"nowrap"}}>Apply</button>
                    </div>
                    {promoValid===true&&<div style={{fontSize:11,color:"#1d9e75",marginTop:4}}>Promo applied — saving ${discount.toFixed(2)}</div>}
                    {promoValid===false&&<div style={{fontSize:11,color:"#e24b4a",marginTop:4}}>Invalid or expired promo code</div>}
                  </div>
                  <div style={{display:"flex",gap:8}}>
                    <button onClick={()=>setStep(2)} style={{flex:1,background:"none",border:"1px solid #333",borderRadius:9,color:"#888",fontSize:13,padding:"12px",cursor:"pointer"}}>Back</button>
                    <button onClick={()=>setStep(4)} style={{flex:2,background:"#e6821e",border:"none",borderRadius:9,color:"#fff",fontFamily:"Syne,sans-serif",fontSize:14,fontWeight:700,padding:"12px",cursor:"pointer"}}>Next</button>
                  </div>
                </div>
              )}

              {step===4&&(
                <div>
                  <div style={{fontFamily:"Syne",fontSize:13,fontWeight:700,marginBottom:12,color:"#f0ede6"}}>Booking summary</div>
                  <div style={{background:"#0f0f0f",border:"1px solid #222",borderRadius:10,padding:"1rem",marginBottom:"1rem"}}>
                    {[
                      {label:"Service",value:booking.name},
                      {label:"Provider",value:booking.profile_public?.business_name||`${booking.profile_public?.first_name} ${booking.profile_public?.last_name}`},
                      {label:"Date",value:new Date(bookForm.date+"T00:00:00").toLocaleDateString("default",{weekday:"long",year:"numeric",month:"long",day:"numeric"})},
                      {label:"Time",value:bookForm.time},
                      {label:"Vehicle",value:vehicle?`${vehicle.make} ${vehicle.model} — ${vehicle.license_plate}`:""},
                      {label:"Payment",value:bookForm.paymentMethod===t("cash")?"Cash at shop":bookForm.paymentMethod==="mpesa"?"M-Pesa":"Card"},
                      ...(bookForm.concierge?[{label:"Concierge",value:`+$20 · ${bookForm.pickupAddress||"Address TBD"}`}]:[]),
                      ...(discount>0?[{label:"Discount",value:`-$${discount.toFixed(2)}`,color:"#1d9e75"}]:[]),
                    ].map(f=>(
                      <div key={f.label} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:"1px solid #1a1a1a"}}>
                        <div style={{fontSize:12,color:"#555"}}>{f.label}</div>
                        <div style={{fontSize:12,color:f.color||"#f0ede6",textAlign:"right",maxWidth:"60%"}}>{f.value}</div>
                      </div>
                    ))}
                    <div style={{marginTop:10,paddingTop:6,borderTop:"1px solid #2a2a2a"}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                        <div style={{fontFamily:"Syne",fontSize:15,fontWeight:700,color:"#f0ede6"}}>Total</div>
                        <div style={{fontFamily:"Syne",fontSize:20,fontWeight:800,color:"#e6821e"}}>${total.toFixed(2)}</div>
                      </div>
                      <div style={{fontSize:10,color:"#444",display:"flex",gap:12,flexWrap:"wrap"}}>
                        <span>Platform 15%: ${platform.toFixed(2)}</span>
                        <span>Provider 70%: ${provider.toFixed(2)}</span>
                        {bookForm.concierge&&<span>Driver 15%: ${driver.toFixed(2)}</span>}
                      </div>
                    </div>
                  </div>
                  <div style={{display:"flex",gap:8}}>
                    <button onClick={()=>setStep(3)} style={{flex:1,background:"none",border:"1px solid #333",borderRadius:9,color:"#888",fontSize:13,padding:"12px",cursor:"pointer"}}>Back</button>
                    <button onClick={submitBooking} disabled={submitting} style={{flex:2,background:submitting?"#333":"#e6821e",border:"none",borderRadius:9,color:submitting?"#666":"#fff",fontFamily:"Syne,sans-serif",fontSize:14,fontWeight:700,padding:"12px",cursor:submitting?"not-allowed":"pointer"}}>
                      {submitting?"Processing...":`${bookForm.paymentMethod===t("cash")?"Confirm booking":bookForm.paymentMethod==="mpesa"?"Pay with M-Pesa":"Pay with Card"} — $${total.toFixed(2)}`}
                    </button>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      )}
    </div>
  )
}
