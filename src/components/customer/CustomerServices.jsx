import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"
import { useAuth } from "../../contexts/AuthContext"
import { useLanguage } from "../../contexts/LanguageContext"
import useIsMobile from "../../lib/useIsMobile"
import toast from "react-hot-toast"
import PesapalPayment from "../shared/PesapalPayment"

const CATEGORIES = [
  { key:"shop_standard", label:"Shop Standard", icon:"🏪", desc:"You bring your car to the shop", color:"#378add", bg:"#0c1f2e", border:"#378add40" },
  { key:"shop_premium", label:"Shop Premium", icon:"🏡", desc:"Mechanic comes to your home", color:"#8b5cf6", bg:"#160a2e", border:"#8b5cf640" },
  { key:"go_service", label:"GO Service", icon:"🚨", desc:"Emergency roadside assistance", color:"#e24b4a", bg:"#1a0808", border:"#e24b4a40" },
]

export default function CustomerServices() {
  const isMobile = useIsMobile()
  const { user, profile } = useAuth()
  const { t } = useLanguage()
  const [services, setServices] = useState([])
  const [providers, setProviders] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState("all")
  const [search, setSearch] = useState("")
  const [booking, setBooking] = useState(null)
  const [bookForm, setBookForm] = useState({ date:"", time:"", notes:"", payment_method:"mpesa", is_concierge:false, problem_description:"", parts_needed:false, parts_description:"" })
  const [bookingLoading, setBookingLoading] = useState(false)
  const [pendingBooking, setPendingBooking] = useState(null)
  const [showPayment, setShowPayment] = useState(false)
  const [voucherCode, setVoucherCode] = useState("")
  const [voucherData, setVoucherData] = useState(null)
  const [voucherLoading, setVoucherLoading] = useState(false)
  const [vehicles, setVehicles] = useState([])
  const [selectedVehicle, setSelectedVehicle] = useState("")

  useEffect(() => { if (user) load() }, [user])

  async function load() {
    const [{ data: svcs }, { data: provs }, { data: vehs }] = await Promise.all([
      supabase.from("services").select("*").eq("is_active", true).order("created_at", { ascending:false }),
      supabase.from("profiles").select("id,first_name,last_name,business_name,city,latitude,longitude,is_verified").eq("role","provider"),
      supabase.from("vehicles").select("*").eq("user_id", user.id),
    ])
    setServices(svcs||[])
    setProviders(provs||[])
    setVehicles(vehs||[])
    setLoading(false)
  }

  async function validateVoucher() {
    if (!voucherCode.trim()) return
    setVoucherLoading(true)
    try {
      const { data, error } = await supabase.from("vouchers")
        .select("*")
        .eq("code", voucherCode.trim().toUpperCase())
        .eq("customer_id", user.id)
        .eq("is_used", false)
        .gte("expires_at", new Date().toISOString())
        .single()
      if (error || !data) {
        toast.error("Invalid or expired voucher code")
        setVoucherData(null)
      } else {
        setVoucherData(data)
        toast.success(`Voucher applied — KES ${Number(data.value).toLocaleString()} discount!`)
      }
    } catch(err) {
      toast.error("Could not validate voucher")
    } finally {
      setVoucherLoading(false)
    }
  }

  async function bookService(e) {
    e.preventDefault()
    if (!booking) return
    setBookingLoading(true)
    try {
      const cat = CATEGORIES.find(c=>c.key===booking.category)||CATEGORIES[0]
      const commissionRates = { shop_standard:0.10, shop_premium:0.20, go_service:0.15 }
      const platformRate = commissionRates[booking.category]||0.10
      const providerRate = 1 - platformRate
      const platformAmount = Number(booking.price) * platformRate
      const providerAmount = Number(booking.price) * providerRate

      const finalAmount = Math.max(0, Number(booking.price)*(bookForm.is_concierge?1.15:1) - (voucherData?Number(voucherData.value):0))
        const { data, error } = await supabase.from("bookings").insert({
        customer_id: user.id,
        provider_id: booking.provider_id,
        service_id: booking.id,
        service_name: booking.name,
        service_category: booking.category,
        booking_date: bookForm.date,
        booking_time: bookForm.time,
        total_amount: Number(booking.price),
        platform_commission: platformAmount,
        provider_earnings: providerAmount,
        platform_commission_rate: platformRate,
        provider_commission_rate: providerRate,
        payment_method: bookForm.payment_method,
        payment_status: "pending",
        status: "pending",
        notes: bookForm.notes,
        problem_description: bookForm.problem_description,
        parts_needed: bookForm.parts_needed||false,
        parts_description: bookForm.parts_description||"",
        is_concierge: bookingLoading.is_concierge||false,
      }).select("id")

      if (error) throw error
      if (bookForm.payment_method !== "cash" && data?.[0]?.id) {
        setPendingBooking({ id: data[0].id, amount: finalAmount })
        setShowPayment(true)
        setBooking(null)
      } else {
        toast.success("Booking submitted! 🎉")
        setBooking(null)
      }
      setBookForm({ date:"", time:"", notes:"", payment_method:"mpesa", is_concierge:false, problem_description:"", parts_needed:false, parts_description:"" })
      toast.error(err.message)
    } finally {
      setBookingLoading(false)
    }
  }

  const filtered = services.filter(s => {
    const matchCat = activeCategory==="all" || s.category===activeCategory
    const matchSearch = s.name.toLowerCase().includes(search.toLowerCase())
    return matchCat && matchSearch
  })

  const inp = { width:"100%", background:"#ffffff", border:"1px solid #e5e5e5", borderRadius:8, padding:"11px 12px", color:"#000000", fontSize:13, outline:"none", fontFamily:"'DM Sans',sans-serif" }
  const lbl = { fontSize:11, color:"#666", textTransform:"uppercase", letterSpacing:"0.05em", display:"block", marginBottom:4 }

  return (
    <div>
      {/* Category cards */}
      <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"repeat(3,1fr)", gap:10, marginBottom:"1.5rem" }}>
        {CATEGORIES.map(c=>(
          <div key={c.key}
            onClick={()=>setActiveCategory(activeCategory===c.key?"all":c.key)}
            style={{ background:activeCategory===c.key?c.bg:"#111", border:`1px solid ${activeCategory===c.key?c.color:"#1e1e1e"}`, borderRadius:12, padding:"1rem", cursor:"pointer", transition:"all 0.15s" }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
              <span style={{ fontSize:22 }}>{c.icon}</span>
              <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:800, color:activeCategory===c.key?c.color:"#000000" }}>{c.label}</div>
            </div>
            <div style={{ fontSize:11, color:"#666" }}>{c.desc}</div>
            <div style={{ fontSize:10, color:c.color, marginTop:4, fontWeight:600 }}>
              {services.filter(s=>s.category===c.key).length} available
            </div>
          </div>
        ))}
      </div>

      {/* Search */}
      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search services..."
        style={{ ...inp, marginBottom:"1rem" }}/>

      {/* Filter tabs */}
      <div style={{ display:"flex", gap:6, marginBottom:"1rem", flexWrap:"wrap" }}>
        {["all",...CATEGORIES.map(c=>c.key)].map(k=>(
          <button key={k} onClick={()=>setActiveCategory(k)}
            style={{ padding:"6px 12px", borderRadius:7, border:"none", fontSize:11, cursor:"pointer", background:activeCategory===k?"#e6821e":"#111", color:activeCategory===k?"#fff":"#666", fontFamily:"'DM Sans',sans-serif" }}>
            {k==="all"?"All services":CATEGORIES.find(c=>c.key===k)?.label}
          </button>
        ))}
      </div>

      {loading&&<div style={{ color:"#777777", fontSize:13 }}>Loading services...</div>}
      {!loading&&filtered.length===0&&<div style={{ color:"#888888", fontSize:13, textAlign:"center", padding:"2rem" }}>No services found</div>}

      {filtered.map(s=>{
        const cat = CATEGORIES.find(c=>c.key===s.category)||CATEGORIES[0]
        const provider = providers.find(p=>p.id===s.provider_id)
        return (
          <div key={s.id} style={{ background:"#ffffff", border:`1px solid ${cat.border}`, borderRadius:12, padding:isMobile?"0.9rem":"1.1rem", marginBottom:10 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:10 }}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6, flexWrap:"wrap" }}>
                  <span style={{ fontSize:18 }}>{cat.icon}</span>
                  <div style={{ fontFamily:"Syne", fontSize:isMobile?14:15, fontWeight:800, color:"#000000" }}>{s.name}</div>
                  <span style={{ fontSize:10, padding:"2px 8px", borderRadius:10, background:cat.bg, color:cat.color, border:`1px solid ${cat.border}` }}>{cat.label}</span>
                </div>
                {s.description&&<div style={{ fontSize:12, color:"#666", marginBottom:6, lineHeight:1.5 }}>{s.description}</div>}
                <div style={{ display:"flex", gap:12, flexWrap:"wrap", alignItems:"center" }}>
                  <span style={{ fontFamily:"Syne", fontSize:15, fontWeight:800, color:"#e6821e" }}>KES {Number(s.price).toLocaleString()}</span>
                  <span style={{ fontSize:11, color:"#777777" }}>⏱ {s.duration_minutes||60} min</span>
                  {provider&&<span style={{ fontSize:11, color:"#777777" }}>🏪 {provider.business_name||`${provider.first_name} ${provider.last_name}`}{provider.city?` · ${provider.city}`:""}</span>}
                  {provider?.is_verified&&<span style={{ fontSize:10, color:"#1d9e75" }}>✓ Verified</span>}
                </div>
              </div>
              <button onClick={()=>{ setBooking(s); setBookForm({ date:"", time:"", notes:"", payment_method:"mpesa", is_concierge:false }) }}
                style={{ background:"#e6821e", border:"none", borderRadius:9, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:12, fontWeight:700, padding:"9px 16px", cursor:"pointer", flexShrink:0 }}>
                Book
              </button>
            </div>

            {booking?.id===s.id&&(
              <div style={{ marginTop:"1rem", paddingTop:"1rem", borderTop:`1px solid ${cat.border}` }}>
                <div style={{ fontFamily:"Syne", fontSize:13, fontWeight:700, marginBottom:"0.75rem", color:"#000000" }}>Book — {s.name}</div>

                {s.category==="go_service"&&(
                  <div style={{ background:"#1a0808", border:"1px solid #e24b4a30", borderRadius:8, padding:"0.75rem", marginBottom:12 }}>
                    <div style={{ fontSize:12, color:"#e24b4a", fontWeight:600, marginBottom:2 }}>🚨 Emergency GO Service</div>
                    <div style={{ fontSize:11, color:"#666" }}>A mechanic will be dispatched to your location. Online payment required. Provider has 15 minutes to accept.</div>
                  </div>
                )}

                {s.category==="shop_premium"&&(
                  <div style={{ background:"#160a2e", border:"1px solid #8b5cf630", borderRadius:8, padding:"0.75rem", marginBottom:12 }}>
                    <div style={{ fontSize:12, color:"#8b5cf6", fontWeight:600, marginBottom:2 }}>🏡 Premium Home Service</div>
                    <div style={{ fontSize:11, color:"#666" }}>A mechanic will come to your home or office. Please provide your address in the notes.</div>
                  </div>
                )}

                <form onSubmit={bookService}>
                  <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:10, marginBottom:10 }}>
                    <div>
                      <label style={lbl}>Date</label>
                      <input type="date" value={bookForm.date} onChange={e=>setBookForm(f=>({...f,date:e.target.value}))} required min={new Date().toISOString().split("T")[0]} style={inp}/>
                    </div>
                    <div>
                      <label style={lbl}>Time</label>
                      <select value={bookForm.time} onChange={e=>setBookForm(f=>({...f,time:e.target.value}))} required style={inp}>
                        <option value="">Select time</option>
                        {["07:00","08:00","09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00"].map(t=><option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                  </div>

                  {vehicles.length>0&&(
                    <div style={{ marginBottom:10 }}>
                      <label style={lbl}>Select vehicle (optional)</label>
                      <select value={selectedVehicle} onChange={e=>setSelectedVehicle(e.target.value)} style={inp}>
                        <option value="">Select a vehicle</option>
                        {vehicles.map(v=><option key={v.id} value={v.id}>{v.make} {v.model} {v.year} — {v.license_plate}</option>)}
                      </select>
                    </div>
                  )}

                  <div style={{ marginBottom:10 }}>
                    <label style={lbl}>Payment method</label>
                    <select value={bookForm.payment_method} onChange={e=>setBookForm(f=>({...f,payment_method:e.target.value}))} style={inp}>
                      <option value="mpesa">M-Pesa</option>
                      <option value="card">Card</option>
                      {s.category!=="go_service"&&<option value="cash">Cash</option>}
                    </select>
                  </div>

                  <div style={{ marginBottom:14 }}>
                    <div style={{ marginBottom:10 }}>
                    <label style={lbl}>Describe your problem <span style={{ color:"#e24b4a" }}>*</span></label>
                    <textarea value={bookForm.problem_description} onChange={e=>setBookForm(f=>({...f,problem_description:e.target.value}))}
                      placeholder="e.g. My car makes a grinding noise when braking, brake pads may need replacing..."
                      style={{ ...inp, resize:"vertical", minHeight:70 }} required/>
                  </div>
                  {(s.category==="shop_premium"||s.category==="go_service")&&(
                    <label style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10, cursor:"pointer" }}>
                      <input type="checkbox" checked={bookForm.parts_needed} onChange={e=>setBookForm(f=>({...f,parts_needed:e.target.checked}))} style={{ accentColor:"#e6821e" }}/>
                      <span style={{ fontSize:12, color:"#666" }}>I think parts/materials may be needed</span>
                    </label>
                  )}
                  {bookForm.parts_needed&&(
                    <div style={{ marginBottom:10 }}>
                      <label style={lbl}>What parts might be needed?</label>
                      <input style={inp} placeholder="e.g. brake pads, battery, oil filter..." value={bookForm.parts_description} onChange={e=>setBookForm(f=>({...f,parts_description:e.target.value}))}/>
                    </div>
                  )}
                  <label style={lbl}>Additional notes {s.category==="shop_premium"?"(include your address)":""}</label>
                    <textarea value={bookForm.notes} onChange={e=>setBookForm(f=>({...f,notes:e.target.value}))} placeholder={s.category==="shop_premium"?"Your home/office address...":s.category==="go_service"?"Your exact location and emergency details...":"Any special instructions..."} style={{ ...inp, resize:"vertical", minHeight:60 }}/>
                  </div>

                  {s.category!=="go_service"&&(
                    <label style={{ display:"flex", alignItems:"center", gap:8, marginBottom:14, cursor:"pointer" }}>
                      <input type="checkbox" checked={bookForm.is_concierge} onChange={e=>setBookForm(f=>({...f,is_concierge:e.target.checked}))} style={{ accentColor:"#e6821e" }}/>
                      <span style={{ fontSize:12, color:"#666" }}>Add concierge driver (pick up & drop off my car) — extra 15%</span>
                    </label>
                  )}

                  <div style={{ marginBottom:14 }}>
                    <label style={lbl}>Voucher code (optional)</label>
                    <div style={{ display:"flex", gap:6 }}>
                      <input value={voucherCode} onChange={e=>setVoucherCode(e.target.value.toUpperCase())}
                        placeholder="CCC-XXXX-XXXX-XXXX"
                        style={{ ...inp, flex:1, marginBottom:0 }}/>
                      <button type="button" onClick={validateVoucher} disabled={voucherLoading||!voucherCode.trim()}
                        style={{ background:"#1d9e75", border:"none", borderRadius:8, color:"#fff", fontSize:12, padding:"0 14px", cursor:"pointer", flexShrink:0 }}>
                        {voucherLoading?"...":"Apply"}
                      </button>
                    </div>
                    {voucherData&&(
                      <div style={{ marginTop:6, background:"#071a12", border:"1px solid #1d9e7540", borderRadius:8, padding:"0.5rem 0.75rem", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                        <div style={{ fontSize:11, color:"#1d9e75" }}>✅ Voucher applied — KES {Number(voucherData.value).toLocaleString()} off</div>
                        <button type="button" onClick={()=>{ setVoucherData(null); setVoucherCode("") }} style={{ background:"none", border:"none", color:"#e24b4a", cursor:"pointer", fontSize:12 }}>×</button>
                      </div>
                    )}
                  </div>

                  <div style={{ background:"#ffffff", borderRadius:8, padding:"0.75rem", marginBottom:14 }}>
                    <div style={{ fontSize:11, color:"#777777", marginBottom:4 }}>Booking summary</div>
                    <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, color:"#555555", marginBottom:2 }}>
                      <span>{s.name}</span><span>KES {Number(s.price).toLocaleString()}</span>
                    </div>
                    {bookForm.is_concierge&&(
                      <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, color:"#555555", marginBottom:2 }}>
                        <span>Concierge fee</span><span>KES {(Number(s.price)*0.15).toFixed(0)}</span>
                      </div>
                    )}
                    <div style={{ height:1, background:"#f0f0f0", margin:"6px 0" }}/>
                    {voucherData&&(
                      <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, color:"#1d9e75", marginBottom:2 }}>
                        <span>Voucher discount</span><span>- KES {Number(voucherData.value).toLocaleString()}</span>
                      </div>
                    )}
                    <div style={{ display:"flex", justifyContent:"space-between", fontSize:13, color:"#e6821e", fontWeight:700 }}>
                      <span>Total</span>
                      <span>KES {Math.max(0,(Number(s.price)*(bookForm.is_concierge?1.15:1))-(voucherData?Number(voucherData.value):0)).toFixed(0)}</span>
                    </div>
                  </div>

                  <div style={{ display:"flex", gap:8 }}>
                    <button type="submit" disabled={bookingLoading}
                      style={{ background:bookingLoading?"#333":"#e6821e", border:"none", borderRadius:9, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:13, fontWeight:700, padding:"11px 24px", cursor:bookingLoading?"not-allowed":"pointer" }}>
                      {bookingLoading?"Booking...":"Confirm booking"}
                    </button>
                    <button type="button" onClick={()=>setBooking(null)}
                      style={{ background:"none", border:"1px solid #dddddd", borderRadius:9, color:"#666", fontSize:13, padding:"11px 16px", cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}>
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        )
      })}

      {/* Pesapal Payment Modal */}
      {showPayment&&pendingBooking&&(
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.8)", zIndex:200, display:"flex", alignItems:"center", justifyContent:"center", padding:"1rem" }}>
          <div style={{ width:"100%", maxWidth:420 }}>
            <PesapalPayment
              amount={pendingBooking.amount}
              bookingId={pendingBooking.id}
              customerEmail={user?.email}
              customerPhone={profile?.phone}
              customerName={profile?.first_name+" "+profile?.last_name}
              onSuccess={()=>{ setShowPayment(false); setPendingBooking(null); toast.success("Payment successful!") }}
              onCancel={()=>{ setShowPayment(false); setPendingBooking(null) }}
            />
          </div>
        </div>
      )}
    </div>
  )
}






















