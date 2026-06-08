import { useEffect, useState, useRef } from "react"
import { supabase } from "../../lib/supabase"
import { useAuth } from "../../contexts/AuthContext"
import { useLanguage } from "../../contexts/LanguageContext"
import useIsMobile from "../../lib/useIsMobile"
import toast from "react-hot-toast"

const COMMISSION_RATES = {
  garage: { platform:10, provider:90 },
  garage_premium: { platform:20, provider:80 },
  parts_dealer: { platform:5, provider:95 },
  accessories_shop: { platform:8, provider:92 },
  tyre_shop: { platform:6, provider:94 },
  auto_electrician: { platform:12, provider:88 },
  car_wash: { platform:10, provider:90 },
  panel_beater: { platform:15, provider:85 },
  auto_glass: { platform:12, provider:88 },
}

const TYPE_CONFIG = {
  garage:          { label:"Garage / Mechanic",   icon:"🔧", color:"#e6821e", bg:"#1a1208", focus:"bookings" },
  garage_premium:  { label:"Mobile Mechanic",      icon:"🚗", color:"#378add", bg:"#0c1f2e", focus:"bookings" },
  parts_dealer:    { label:"Parts Dealer",          icon:"⚙️", color:"#8b5cf6", bg:"#160a2e", focus:"inventory" },
  accessories_shop:{ label:"Accessories Shop",      icon:"✨", color:"#e6821e", bg:"#1a1208", focus:"inventory" },
  tyre_shop:       { label:"Tyre Shop",             icon:"🛞", color:"#1d9e75", bg:"#071a12", focus:"inventory" },
  auto_electrician:{ label:"Auto Electrician",      icon:"⚡", color:"#e6821e", bg:"#1a1208", focus:"bookings" },
  car_wash:        { label:"Car Wash",              icon:"🚿", color:"#378add", bg:"#0c1f2e", focus:"bookings" },
  panel_beater:    { label:"Panel Beater",          icon:"⚙️", color:"#e24b4a", bg:"#1a0808", focus:"bookings" },
  auto_glass:      { label:"Auto Glass",            icon:"🪟", color:"#1d9e75", bg:"#071a12", focus:"bookings" },
}

export default function ProviderDashboard() {
  const { user, profile, updateProfile } = useAuth()
  const { t, language } = useLanguage()
  const isMobile = useIsMobile()
  const fileRef = useRef(null)

  // Bookings state
  const [bookings, setBookings] = useState([])
  const [bookingStats, setBookingStats] = useState({ pending:0, confirmed:0, completed:0, earnings:0 })

  // Inventory/Orders state (for parts/accessories/tyres)
  const [inventory, setInventory] = useState([])
  const [orders, setOrders] = useState([])
  const [orderStats, setOrderStats] = useState({ pending:0, revenue:0, items:0, lowStock:0 })

  const [loading, setLoading] = useState(true)
  const [showPolicy, setShowPolicy] = useState(!localStorage.getItem("ccc_policy_acknowledged"))
  const [uploadingPhoto, setUploadingPhoto] = useState(false)

  const providerType = profile?.provider_type || "garage"
  const config = TYPE_CONFIG[providerType] || TYPE_CONFIG.garage
  const isInventoryFocus = config.focus === "inventory"
  const isMixedProvider = providerType === "tyre_shop" || providerType === "auto_glass"
  const commission = COMMISSION_RATES[providerType] || COMMISSION_RATES.garage

  useEffect(() => {
    if (!user) return
    load()
    const sub = supabase.channel("prov-dash-v2")
      .on("postgres_changes", { event:"*", schema:"public", table:"bookings", filter:`provider_id=eq.${user.id}` }, () => load())
      .on("postgres_changes", { event:"*", schema:"public", table:"orders", filter:`provider_id=eq.${user.id}` }, () => load())
      .subscribe()
    return () => supabase.removeChannel(sub)
  }, [user])

  async function load() {
    setLoading(true)
    const [{ data: bks }, { data: inv }, { data: ords }] = await Promise.all([
      supabase.from("bookings").select("*").eq("provider_id", user.id).order("created_at",{ascending:false}).limit(10),
      supabase.from("inventory").select("*").eq("provider_id", user.id).order("created_at",{ascending:false}),
      supabase.from("orders").select("*, order_items(*)").eq("provider_id", user.id).order("created_at",{ascending:false}).limit(10),
    ])
    const b = bks||[]
    const i = inv||[]
    const o = ords||[]
    setBookings(b)
    setInventory(i)
    setOrders(o)
    setBookingStats({
      pending: b.filter(x=>x.status==="pending").length,
      confirmed: b.filter(x=>x.status==="confirmed").length,
      completed: b.filter(x=>x.status==="completed").length,
      earnings: b.filter(x=>x.status==="completed").reduce((s,x)=>s+Number(x.provider_earnings||0),0)
    })
    setOrderStats({
      pending: o.filter(x=>x.status==="pending").length,
      revenue: o.filter(x=>x.status==="delivered").reduce((s,x)=>s+Number(x.provider_earnings||0),0),
      items: i.length,
      lowStock: i.filter(x=>x.stock_quantity<=5&&x.is_active).length
    })
    setLoading(false)
  }

  async function updateBookingStatus(id, status) {
    const { error } = await supabase.from("bookings").update({ status }).eq("id",id).eq("provider_id",user.id)
    if (error) return toast.error(error.message)
    toast.success("Booking "+status)
    load()
  }

  async function updateOrderStatus(id, status) {
    await supabase.from("orders").update({ status }).eq("id",id)
    toast.success("Order "+status)
    load()
  }

  async function uploadPhoto(e) {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 5*1024*1024) return toast.error("Photo must be under 5MB")
    setUploadingPhoto(true)
    try {
      const ext = file.name.split(".").pop()
      const path = `${user.id}/profile-${Date.now()}.${ext}`
      const { error } = await supabase.storage.from("provider-photos").upload(path, file, { upsert:true })
      if (error) throw error
      const { data } = supabase.storage.from("provider-photos").getPublicUrl(path)
      await updateProfile({ profile_photo_url: data.publicUrl })
      toast.success("Photo updated!")
    } catch(e) { toast.error(e.message) }
    finally { setUploadingPhoto(false) }
  }

  const SC = { pending:"#e6821e", confirmed:"#378add", "in-progress":"#8b5cf6", completed:"#1d9e75", cancelled:"#e24b4a" }
  const initials = `${profile?.first_name?.[0]||""}${profile?.last_name?.[0]||""}`.toUpperCase()

  return (
    <div>
      {/* SERVICE GUARANTEE POLICY */}
      {showPolicy&&(
        <div style={{ background:"#1a0808", border:"2px solid #e24b4a", borderRadius:12, padding:"1.25rem", marginBottom:"1.5rem" }}>
          <div style={{ fontFamily:"Syne", fontSize:15, fontWeight:800, color:"#e24b4a", marginBottom:8 }}>🚗 Important — Service Guarantee Policy</div>
          <div style={{ fontSize:12, color:"#555555", lineHeight:1.8, marginBottom:"1rem" }}>
            Car Care Connect operates a <strong style={{ color:"#000000" }}>Service Guarantee</strong> for all customers. As a provider, you must be aware of the following:
          </div>
          {[
            { icon:"1️⃣", text:"If a customer is unhappy with your service, they can submit a Service Guarantee claim within 7 days." },
            { icon:"2️⃣", text:"If the claim is approved, the full service cost is deducted from your earnings and a voucher is issued to the customer." },
            { icon:"3️⃣", text:"1st approved claim → Warning + cost deduction." },
            { icon:"4️⃣", text:"2nd approved claim → 7 day suspension + cost deduction." },
            { icon:"5️⃣", text:"3rd approved claim → Permanent ban from the platform." },
            { icon:"✅", text:"The best protection is to always deliver excellent, professional service." },
          ].map(item=>(
            <div key={item.icon} style={{ display:"flex", gap:10, alignItems:"flex-start", marginBottom:6 }}>
              <span style={{ fontSize:14, flexShrink:0 }}>{item.icon}</span>
              <span style={{ fontSize:12, color:"#555555", lineHeight:1.5 }}>{item.text}</span>
            </div>
          ))}
          <div style={{ display:"flex", gap:8, marginTop:"1rem" }}>
            <button onClick={()=>{ localStorage.setItem("ccc_policy_acknowledged","true"); setShowPolicy(false) }}
              style={{ background:"#e24b4a", border:"none", borderRadius:8, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:12, fontWeight:700, padding:"9px 18px", cursor:"pointer" }}>
              I understand — got it
            </button>
            <button onClick={()=>window.open("/terms","_blank")}
              style={{ background:"none", border:"1px solid #e24b4a40", borderRadius:8, color:"#e24b4a", fontSize:12, padding:"9px 14px", cursor:"pointer" }}>
              Read full policy
            </button>
          </div>
        </div>
      )}

      {/* PROVIDER IDENTITY HEADER */}
      <div style={{ background:`linear-gradient(135deg,${config.bg},#111)`, border:`1px solid ${config.color}30`, borderRadius:16, padding:"1.5rem", marginBottom:"1.5rem" }}>
        <div style={{ display:"flex", alignItems:"center", gap:16, flexWrap:"wrap" }}>
          {/* Profile Photo */}
          <div style={{ position:"relative", flexShrink:0 }}>
            <div onClick={()=>fileRef.current?.click()} style={{ width:72, height:72, borderRadius:16, background:config.bg, border:`2px solid ${config.color}60`, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", overflow:"hidden", position:"relative" }}>
              {profile?.profile_photo_url ? (
                <img src={profile.profile_photo_url} alt="Profile" style={{ width:"100%", height:"100%", objectFit:"cover" }}/>
              ) : (
                <span style={{ fontFamily:"Syne", fontSize:24, fontWeight:800, color:config.color }}>{initials||config.icon}</span>
              )}
              <div style={{ position:"absolute", bottom:0, left:0, right:0, background:"rgba(0,0,0,0.6)", fontSize:9, color:"#fff", textAlign:"center", padding:"2px 0" }}>
                {uploadingPhoto?"...":"📷"}
              </div>
            </div>
            <input ref={fileRef} type="file" accept="image/*" onChange={uploadPhoto} style={{ display:"none" }}/>
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4, flexWrap:"wrap" }}>
              <div style={{ fontFamily:"Syne", fontSize:isMobile?16:20, fontWeight:800, color:"#000000" }}>
                {profile?.business_name||`${profile?.first_name||""} ${profile?.last_name||""}`}
              </div>
              {profile?.is_verified&&<span style={{ fontSize:10, color:"#1d9e75", background:"#071a12", padding:"2px 8px", borderRadius:10, border:"1px solid #1d9e7540" }}>✓ Verified</span>}
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
              <span style={{ fontSize:12, padding:"3px 10px", borderRadius:20, background:config.bg, color:config.color, border:`1px solid ${config.color}40`, fontWeight:600 }}>
                {config.icon} {config.label}
              </span>
              {profile?.city&&<span style={{ fontSize:11, color:"#777777" }}>📍 {profile.city}</span>}
            </div>
            <div style={{ fontSize:12, color:config.color, marginTop:6, fontWeight:600 }}>
              Keep {commission.provider}% · Platform {commission.platform}%
            </div>
          </div>
        </div>
      </div>

      {/* STATS — different per type */}
      {isInventoryFocus ? (
        <div style={{ display:"grid", gridTemplateColumns:isMobile?"repeat(2,1fr)":"repeat(4,1fr)", gap:10, marginBottom:"1.5rem" }}>
          {[
            { label:"Pending orders", value:orderStats.pending, color:orderStats.pending>0?"#e6821e":"#555" },
            { label:"Inventory items", value:orderStats.items, color:"#378add" },
            { label:"Low stock", value:orderStats.lowStock, color:orderStats.lowStock>0?"#e24b4a":"#555" },
            { label:"Parts revenue", value:"KES "+orderStats.revenue.toLocaleString(), color:"#1d9e75" },
          ].map(s=>(
            <div key={s.label} style={{ background:"#ffffff", borderRadius:10, padding:isMobile?"0.6rem":"1rem", border:"1px solid #eeeeee", textAlign:"center" }}>
              <div style={{ fontFamily:"Syne", fontSize:isMobile?14:20, fontWeight:800, color:s.color }}>{s.value}</div>
              <div style={{ fontSize:9, color:"#777777", marginTop:2 }}>{s.label}</div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display:"grid", gridTemplateColumns:isMobile?"repeat(2,1fr)":"repeat(4,1fr)", gap:10, marginBottom:"1.5rem" }}>
          {[
            { label:t("pending"), value:bookingStats.pending, color:"#e6821e" },
            { label:"Confirmed", value:bookingStats.confirmed, color:"#378add" },
            { label:t("completed"), value:bookingStats.completed, color:"#1d9e75" },
            { label:"Earnings", value:"KES "+Number(bookingStats.earnings).toLocaleString(), color:"#8b5cf6" },
          ].map(s=>(
            <div key={s.label} style={{ background:"#ffffff", borderRadius:10, padding:isMobile?"0.6rem":"1rem", border:"1px solid #eeeeee", textAlign:"center" }}>
              <div style={{ fontFamily:"Syne", fontSize:isMobile?14:20, fontWeight:800, color:s.color }}>{s.value}</div>
              <div style={{ fontSize:9, color:"#777777", marginTop:2 }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* PARTS/ACCESSORIES/TYRES FOCUS — show orders and inventory */}
      {isInventoryFocus&&(
        <>
          {/* Low stock alert */}
          {orderStats.lowStock>0&&(
            <div style={{ background:"#1a0808", border:"1px solid #e24b4a40", borderRadius:10, padding:"0.75rem", marginBottom:"1rem", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div style={{ fontSize:13, color:"#e24b4a", fontWeight:600 }}>⚠️ {orderStats.lowStock} item{orderStats.lowStock>1?"s":""} low on stock</div>
              <a href="/dashboard/inventory" style={{ fontSize:11, color:"#e6821e", textDecoration:"none" }}>Manage inventory →</a>
            </div>
          )}

          {/* Pending orders */}
          {orderStats.pending>0&&(
            <div style={{ background:"#1a1208", border:"1px solid #e6821e40", borderRadius:10, padding:"0.75rem", marginBottom:"1rem", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div style={{ fontSize:13, color:"#e6821e", fontWeight:600 }}>🛒 {orderStats.pending} order{orderStats.pending>1?"s":""} waiting for confirmation</div>
              <a href="/dashboard/orders" style={{ fontSize:11, color:"#e6821e", textDecoration:"none" }}>View orders →</a>
            </div>
          )}

          {/* Quick links */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:"1.5rem" }}>
            {[
              { href:"/dashboard/inventory", icon:"📦", label:"Manage Inventory", desc:"Add, edit, update stock", color:config.color },
              { href:"/dashboard/orders", icon:"🛒", label:"Manage Orders", desc:"Confirm, pack, dispatch", color:"#1d9e75" },
            ].map(q=>(
              <a key={q.label} href={q.href} style={{ background:"#ffffff", border:`1px solid ${q.color}30`, borderRadius:12, padding:"1rem", textDecoration:"none", display:"block" }}>
                <div style={{ fontSize:24, marginBottom:6 }}>{q.icon}</div>
                <div style={{ fontFamily:"Syne", fontSize:13, fontWeight:700, color:q.color, marginBottom:2 }}>{q.label}</div>
                <div style={{ fontSize:11, color:"#777777" }}>{q.desc}</div>
              </a>
            ))}
          </div>

          {/* Recent orders */}
          <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:700, color:"#000000", marginBottom:"1rem" }}>Recent orders</div>
          {loading&&<div style={{ color:"#777777", fontSize:13 }}>Loading...</div>}
          {!loading&&orders.length===0&&(
            <div style={{ color:"#888888", fontSize:13, textAlign:"center", padding:"2rem" }}>
              <div style={{ fontSize:32, marginBottom:10 }}>📦</div>
              No orders yet — add inventory to start selling
            </div>
          )}
          {orders.slice(0,5).map(o=>(
            <div key={o.id} style={{ background:"#ffffff", border:"1px solid #eeeeee", borderRadius:10, padding:"1rem", marginBottom:8 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                <div>
                  <div style={{ fontSize:13, fontWeight:600, color:"#000000" }}>#{o.order_number}</div>
                  <div style={{ fontSize:11, color:"#777777" }}>{o.fulfillment_type==="delivery"?"🚚 Delivery":"🏪 Pickup"} · {new Date(o.created_at).toLocaleDateString()}</div>
                  <div style={{ fontSize:11, color:"#777777" }}>{o.order_items?.length||0} item(s)</div>
                </div>
                <div style={{ textAlign:"right" }}>
                  <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:800, color:"#e6821e" }}>KES {Number(o.subtotal||0).toLocaleString()}</div>
                  <span style={{ fontSize:10, padding:"2px 8px", borderRadius:8, background:"#f5f5f5", color:"#555555" }}>{o.status}</span>
                </div>
              </div>
              {o.status==="pending"&&(
                <div style={{ display:"flex", gap:8, marginTop:8 }}>
                  <button onClick={()=>updateOrderStatus(o.id,"confirmed")} style={{ background:"#071a12", border:"1px solid #1d9e7540", borderRadius:7, color:"#1d9e75", fontSize:11, padding:"5px 12px", cursor:"pointer", fontWeight:600 }}>✓ Confirm</button>
                  <button onClick={()=>updateOrderStatus(o.id,"cancelled")} style={{ background:"none", border:"1px solid #e24b4a30", borderRadius:7, color:"#e24b4a", fontSize:11, padding:"5px 10px", cursor:"pointer" }}>Cancel</button>
                </div>
              )}
            </div>
          ))}

          {/* Recent inventory */}
          <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:700, color:"#000000", margin:"1.5rem 0 1rem" }}>Your inventory</div>
          {inventory.slice(0,5).map(item=>(
            <div key={item.id} style={{ background:"#ffffff", border:"1px solid #eeeeee", borderRadius:10, padding:"0.75rem 1rem", marginBottom:6, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div>
                <div style={{ fontSize:12, fontWeight:600, color:"#000000" }}>{item.name}</div>
                <div style={{ fontSize:10, color:"#777777" }}>{item.category} · {item.stock_quantity} {item.unit}s in stock</div>
              </div>
              <div style={{ textAlign:"right" }}>
                <div style={{ fontSize:13, fontWeight:700, color:"#e6821e" }}>KES {Number(item.price).toLocaleString()}</div>
                {item.stock_quantity<=5&&<div style={{ fontSize:9, color:"#e24b4a" }}>⚠️ Low stock</div>}
              </div>
            </div>
          ))}
          {inventory.length===0&&!loading&&(
            <div style={{ color:"#888888", fontSize:12, textAlign:"center", padding:"1rem" }}>
              No inventory yet — <a href="/dashboard/inventory" style={{ color:config.color }}>add items</a>
            </div>
          )}
        </>
      )}

      {/* GARAGE/SERVICE FOCUS — show bookings */}
      {!isInventoryFocus&&(
        <>
          {!showPolicy&&(
            <div style={{ background:"#ffffff", border:"1px solid #e24b4a20", borderRadius:10, padding:"0.75rem", marginBottom:"1.25rem", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div style={{ fontSize:11, color:"#777777" }}>🚨 Service Guarantee active — deliver quality service to avoid claims</div>
              <button onClick={()=>setShowPolicy(true)} style={{ background:"none", border:"none", color:"#e24b4a", fontSize:11, cursor:"pointer" }}>View policy</button>
            </div>
          )}

          <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:700, color:"#000000", marginBottom:"1rem" }}>
            {language==="sw"?"Miadi ya hivi karibuni":"Recent bookings"}
          </div>
          {loading&&<div style={{ color:"#777777", fontSize:13 }}>{t("loading")}</div>}
          {!loading&&bookings.length===0&&(
            <div style={{ color:"#888888", fontSize:13, textAlign:"center", padding:"2rem" }}>
              <div style={{ fontSize:32, marginBottom:10 }}>📅</div>
              {language==="sw"?"Hakuna miadi bado":"No bookings yet"}
            </div>
          )}
          {bookings.map(b=>(
            <div key={b.id} style={{ background:"#ffffff", border:"1px solid #eeeeee", borderRadius:10, padding:isMobile?"0.75rem":"1rem", marginBottom:8 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
                <div style={{ flex:1, minWidth:0, marginRight:8 }}>
                  <div style={{ fontSize:isMobile?13:14, fontWeight:500, color:"#000000", marginBottom:4 }}>{b.service_name}</div>
                  <div style={{ fontSize:11, color:"#777777" }}>{b.booking_date} · {b.booking_time?.slice(0,5)}</div>
                  {b.booking_number&&<div style={{ fontSize:10, color:"#888888", marginTop:2 }}>#{b.booking_number}</div>}
                </div>
                <div style={{ textAlign:"right", flexShrink:0 }}>
                  <span style={{ fontSize:10, fontWeight:500, padding:"2px 8px", borderRadius:20, background:`${SC[b.status]||"#888"}20`, color:SC[b.status]||"#888", border:`1px solid ${SC[b.status]||"#888"}40`, display:"inline-block" }}>
                    {b.status}
                  </span>
                  <div style={{ fontFamily:"Syne", fontSize:13, fontWeight:700, color:"#e6821e", marginTop:4 }}>
                    KES {Number(b.total_amount||0).toLocaleString()}
                  </div>
                </div>
              </div>
              <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                {b.status==="pending"&&<button onClick={()=>updateBookingStatus(b.id,"confirmed")} style={{ background:"#071a12", border:"1px solid #1d9e7540", borderRadius:7, color:"#1d9e75", fontSize:11, padding:"5px 10px", cursor:"pointer" }}>✓ Confirm</button>}
                {b.status==="confirmed"&&<button onClick={()=>updateBookingStatus(b.id,"in-progress")} style={{ background:"#0c1f2e", border:"1px solid #378add40", borderRadius:7, color:"#378add", fontSize:11, padding:"5px 10px", cursor:"pointer" }}>Start service</button>}
                {b.status==="in-progress"&&<button onClick={()=>updateBookingStatus(b.id,"completed")} style={{ background:"#071a12", border:"1px solid #1d9e7540", borderRadius:7, color:"#1d9e75", fontSize:11, padding:"5px 10px", cursor:"pointer" }}>Complete</button>}
                {(b.status==="pending"||b.status==="confirmed")&&<button onClick={()=>updateBookingStatus(b.id,"cancelled")} style={{ background:"none", border:"1px solid #e24b4a30", borderRadius:7, color:"#e24b4a", fontSize:11, padding:"5px 10px", cursor:"pointer" }}>Cancel</button>}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  )
}










