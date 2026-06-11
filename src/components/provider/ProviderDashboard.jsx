import { useState, useEffect, useRef } from "react"
import { supabase } from "../../lib/supabase"
import { useAuth } from "../../contexts/AuthContext"
import { useLanguage } from "../../contexts/LanguageContext"
import useIsMobile from "../../lib/useIsMobile"
import toast from "react-hot-toast"

const COMMISSION_RATES = {
  garage:{ platform:10, provider:90 }, garage_premium:{ platform:20, provider:80 },
  parts_dealer:{ platform:5, provider:95 }, accessories_shop:{ platform:8, provider:92 },
  tyre_shop:{ platform:6, provider:94 }, auto_electrician:{ platform:12, provider:88 },
  car_wash:{ platform:10, provider:90 }, panel_beater:{ platform:15, provider:85 }, auto_glass:{ platform:12, provider:88 },
}
const TYPE_CONFIG = {
  garage:          { label:"Garage / Mechanic",   icon:"🔧", color:"#e6821e", focus:"bookings" },
  garage_premium:  { label:"Mobile Mechanic",      icon:"🚗", color:"#378add", focus:"bookings" },
  parts_dealer:    { label:"Parts Dealer",          icon:"⚙️", color:"#8b5cf6", focus:"inventory" },
  accessories_shop:{ label:"Accessories Shop",      icon:"✨", color:"#e6821e", focus:"inventory" },
  tyre_shop:       { label:"Tyre Shop",             icon:"🛞", color:"#1d9e75", focus:"inventory" },
  auto_electrician:{ label:"Auto Electrician",      icon:"⚡", color:"#e6821e", focus:"bookings" },
  car_wash:        { label:"Car Wash",              icon:"🚿", color:"#378add", focus:"bookings" },
  panel_beater:    { label:"Panel Beater",          icon:"🔨", color:"#e24b4a", focus:"bookings" },
  auto_glass:      { label:"Auto Glass",            icon:"🪟", color:"#1d9e75", focus:"bookings" },
}

export default function ProviderDashboard() {
  const { user, profile, updateProfile } = useAuth()
  const { t, language } = useLanguage()
  const isMobile = useIsMobile()
  const fileRef = useRef(null)
  const [bookings, setBookings] = useState([])
  const [bookingStats, setBookingStats] = useState({ pending:0, confirmed:0, completed:0, earnings:0 })
  const [inventory, setInventory] = useState([])
  const [orders, setOrders] = useState([])
  const [orderStats, setOrderStats] = useState({ pending:0, revenue:0, items:0, lowStock:0 })
  const [loading, setLoading] = useState(true)
  const [showPolicy, setShowPolicy] = useState(!localStorage.getItem("ccc_policy_acknowledged"))
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const providerType = profile?.provider_type || "garage"
  const config = TYPE_CONFIG[providerType] || TYPE_CONFIG.garage
  const isInventoryFocus = config.focus === "inventory"
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
    const b = bks||[]; const i = inv||[]; const o = ords||[]
    setBookings(b); setInventory(i); setOrders(o)
    setBookingStats({ pending:b.filter(x=>x.status==="pending").length, confirmed:b.filter(x=>x.status==="confirmed").length, completed:b.filter(x=>x.status==="completed").length, earnings:b.filter(x=>x.status==="completed").reduce((s,x)=>s+Number(x.provider_earnings||0),0) })
    setOrderStats({ pending:o.filter(x=>x.status==="pending").length, revenue:o.filter(x=>x.status==="delivered").reduce((s,x)=>s+Number(x.provider_earnings||0),0), items:i.length, lowStock:i.filter(x=>x.stock_quantity<=5&&x.is_active).length })
    setLoading(false)
  }

  async function updateBookingStatus(id, status) {
    const { error } = await supabase.from("bookings").update({ status }).eq("id",id).eq("provider_id",user.id)
    if (error) return toast.error(error.message)
    toast.success("Booking "+status); load()
  }

  async function updateOrderStatus(id, status) {
    await supabase.from("orders").update({ status }).eq("id",id)
    toast.success("Order "+status); load()
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
  const businessName = profile?.business_name||`${profile?.first_name||""} ${profile?.last_name||""}`

  return (
    <div style={{ margin:"-1rem", fontFamily:"DM Sans,sans-serif" }}>

      {/* STYLE 1 - Colored header */}
      <div style={{ background:config.color, padding:"1.25rem 1.25rem 2.5rem" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:11, color:"rgba(255,255,255,0.75)", marginBottom:2 }}>
              {new Date().toLocaleDateString("en-KE",{weekday:"long",day:"numeric",month:"long"})}
            </div>
            <div style={{ fontFamily:"Syne", fontSize:18, fontWeight:800, color:"#fff", marginBottom:2 }}>
              {businessName}
            </div>
            <div style={{ fontSize:11, color:"rgba(255,255,255,0.85)" }}>
              {config.icon} {config.label} · Keep {commission.provider}%
            </div>
            {profile?.is_verified&&(
              <div style={{ fontSize:10, color:"#fff", marginTop:4, background:"rgba(255,255,255,0.2)", borderRadius:20, padding:"2px 10px", display:"inline-block" }}>
                ✓ Verified
              </div>
            )}
          </div>
          {/* Profile photo */}
          <div onClick={()=>fileRef.current?.click()} style={{ width:52, height:52, borderRadius:12, background:"rgba(255,255,255,0.2)", border:"2px solid rgba(255,255,255,0.4)", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", overflow:"hidden", flexShrink:0 }}>
            {profile?.profile_photo_url
              ? <img src={profile.profile_photo_url} alt="Profile" style={{ width:"100%", height:"100%", objectFit:"cover" }}/>
              : <span style={{ fontFamily:"Syne", fontSize:18, fontWeight:800, color:"#fff" }}>{initials||config.icon}</span>
            }
          </div>
          <input ref={fileRef} type="file" accept="image/*" onChange={uploadPhoto} style={{ display:"none" }}/>
        </div>
      </div>

      {/* Floating stats card */}
      <div style={{ margin:"-1.25rem 1rem 1rem", background:"#fff", borderRadius:16, padding:"1rem", boxShadow:"0 4px 20px rgba(0,0,0,0.08)", border:"1px solid #f0f0f0" }}>
        {isInventoryFocus ? (
          <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:8 }}>
            {[
              { label:"Pending orders", value:orderStats.pending, color:orderStats.pending>0?"#e6821e":"#555", icon:"🛒" },
              { label:"Inventory items", value:orderStats.items, color:"#378add", icon:"📦" },
              { label:"Low stock", value:orderStats.lowStock, color:orderStats.lowStock>0?"#e24b4a":"#555", icon:"⚠️" },
              { label:"Revenue", value:"KES "+orderStats.revenue.toLocaleString(), color:"#1d9e75", icon:"💰" },
            ].map(s=>(
              <div key={s.label} style={{ background:"#f8f8f8", borderRadius:10, padding:"0.75rem", display:"flex", alignItems:"center", gap:8 }}>
                <div style={{ fontSize:20 }}>{s.icon}</div>
                <div>
                  <div style={{ fontFamily:"Syne", fontSize:16, fontWeight:800, color:s.color }}>{s.value}</div>
                  <div style={{ fontSize:10, color:"#888" }}>{s.label}</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:8 }}>
            {[
              { label:"Pending", value:bookingStats.pending, color:"#e6821e", icon:"⏳" },
              { label:"Confirmed", value:bookingStats.confirmed, color:"#378add", icon:"✅" },
              { label:"Completed", value:bookingStats.completed, color:"#1d9e75", icon:"🎉" },
              { label:"Earnings", value:"KES "+Number(bookingStats.earnings).toLocaleString(), color:"#8b5cf6", icon:"💰" },
            ].map(s=>(
              <div key={s.label} style={{ background:"#f8f8f8", borderRadius:10, padding:"0.75rem", display:"flex", alignItems:"center", gap:8 }}>
                <div style={{ fontSize:20 }}>{s.icon}</div>
                <div>
                  <div style={{ fontFamily:"Syne", fontSize:16, fontWeight:800, color:s.color }}>{s.value}</div>
                  <div style={{ fontSize:10, color:"#888" }}>{s.label}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ padding:"0 1rem" }}>

        {/* SERVICE GUARANTEE POLICY */}
        {showPolicy&&(
          <div style={{ background:"#fff5f5", border:"2px solid #e24b4a", borderRadius:12, padding:"1.25rem", marginBottom:"1rem" }}>
            <div style={{ fontFamily:"Syne", fontSize:15, fontWeight:800, color:"#e24b4a", marginBottom:8 }}>🛡️ Service Guarantee Policy</div>
            <div style={{ fontSize:12, color:"#555", lineHeight:1.8, marginBottom:"1rem" }}>
              Car Care Connect operates a <strong>Service Guarantee</strong> for all customers. As a provider, you must be aware:
            </div>
            {[
              { icon:"⚠️", text:"1st approved claim — Warning + full cost deducted from earnings" },
              { icon:"🚫", text:"2nd approved claim — 7 day suspension + cost deducted" },
              { icon:"❗", text:"3rd approved claim — Permanent ban from platform" },
              { icon:"✅", text:"Always deliver excellent, professional service to avoid claims" },
            ].map(item=>(
              <div key={item.icon} style={{ display:"flex", gap:10, alignItems:"flex-start", marginBottom:6 }}>
                <span style={{ fontSize:14, flexShrink:0 }}>{item.icon}</span>
                <span style={{ fontSize:12, color:"#555", lineHeight:1.5 }}>{item.text}</span>
              </div>
            ))}
            <div style={{ display:"flex", gap:8, marginTop:"1rem" }}>
              <button onClick={()=>{ localStorage.setItem("ccc_policy_acknowledged","true"); setShowPolicy(false) }}
                style={{ background:"#e24b4a", border:"none", borderRadius:8, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:12, fontWeight:700, padding:"9px 18px", cursor:"pointer" }}>
                I understand
              </button>
              <button onClick={()=>window.open("/terms","_blank")}
                style={{ background:"none", border:"1px solid #e24b4a40", borderRadius:8, color:"#e24b4a", fontSize:12, padding:"9px 14px", cursor:"pointer" }}>
                Read policy
              </button>
            </div>
          </div>
        )}

        {/* Guarantee reminder */}
        {!showPolicy&&(
          <div style={{ background:"#fff5f5", border:"1px solid #e24b4a20", borderRadius:10, padding:"0.75rem", marginBottom:"1rem", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <div style={{ fontSize:11, color:"#888" }}>🛡️ Service Guarantee active — deliver quality service</div>
            <button onClick={()=>setShowPolicy(true)} style={{ background:"none", border:"none", color:"#e24b4a", fontSize:11, cursor:"pointer" }}>View policy</button>
          </div>
        )}

        {/* INVENTORY FOCUS */}
        {isInventoryFocus&&(
          <>
            {orderStats.lowStock>0&&(
              <div style={{ background:"#fff5f5", border:"1px solid #e24b4a40", borderRadius:10, padding:"0.75rem", marginBottom:"1rem", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div style={{ fontSize:13, color:"#e24b4a", fontWeight:600 }}>⚠️ {orderStats.lowStock} item{orderStats.lowStock>1?"s":""} low on stock</div>
                <a href="/dashboard/inventory" style={{ fontSize:11, color:"#e6821e", textDecoration:"none" }}>Manage →</a>
              </div>
            )}
            {orderStats.pending>0&&(
              <div style={{ background:"#fff8f0", border:"1px solid #e6821e40", borderRadius:10, padding:"0.75rem", marginBottom:"1rem", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div style={{ fontSize:13, color:"#e6821e", fontWeight:600 }}>🛒 {orderStats.pending} order{orderStats.pending>1?"s":""} waiting</div>
                <a href="/dashboard/orders" style={{ fontSize:11, color:"#e6821e", textDecoration:"none" }}>View →</a>
              </div>
            )}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:"1rem" }}>
              {[
                { href:"/dashboard/inventory", icon:"📦", label:"Inventory", desc:"Add, edit, update stock", color:config.color },
                { href:"/dashboard/orders", icon:"🛒", label:"Orders", desc:"Confirm, pack, dispatch", color:"#1d9e75" },
              ].map(q=>(
                <a key={q.label} href={q.href} style={{ background:"#f8f8f8", border:`1px solid ${q.color}20`, borderRadius:12, padding:"1rem", textDecoration:"none", display:"block" }}>
                  <div style={{ fontSize:24, marginBottom:6 }}>{q.icon}</div>
                  <div style={{ fontFamily:"Syne", fontSize:13, fontWeight:700, color:q.color, marginBottom:2 }}>{q.label}</div>
                  <div style={{ fontSize:11, color:"#888" }}>{q.desc}</div>
                </a>
              ))}
            </div>
            <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:700, color:"#000", marginBottom:"0.75rem" }}>Recent orders</div>
            {loading&&<div style={{ color:"#888", fontSize:13 }}>Loading...</div>}
            {!loading&&orders.length===0&&(
              <div style={{ color:"#888", fontSize:13, textAlign:"center", padding:"2rem", background:"#f8f8f8", borderRadius:12 }}>
                <div style={{ fontSize:32, marginBottom:8 }}>📭</div>
                No orders yet — add inventory to start selling
              </div>
            )}
            {orders.slice(0,5).map(o=>(
              <div key={o.id} style={{ background:"#fff", border:"0.5px solid #eee", borderRadius:12, padding:"0.85rem", marginBottom:8 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                  <div>
                    <div style={{ fontSize:13, fontWeight:600, color:"#000" }}>#{o.order_number}</div>
                    <div style={{ fontSize:11, color:"#888" }}>{o.fulfillment_type==="delivery"?"🚚 Delivery":"🏪 Pickup"} · {new Date(o.created_at).toLocaleDateString()}</div>
                    <div style={{ fontSize:11, color:"#888" }}>{o.order_items?.length||0} item(s)</div>
                  </div>
                  <div style={{ textAlign:"right" }}>
                    <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:800, color:"#e6821e" }}>KES {Number(o.subtotal||0).toLocaleString()}</div>
                    <span style={{ fontSize:10, padding:"2px 8px", borderRadius:8, background:"#f5f5f5", color:"#555" }}>{o.status}</span>
                  </div>
                </div>
                {o.status==="pending"&&(
                  <div style={{ display:"flex", gap:8, marginTop:8 }}>
                    <button onClick={()=>updateOrderStatus(o.id,"confirmed")} style={{ background:"#f0fdf4", border:"1px solid #1d9e7540", borderRadius:7, color:"#1d9e75", fontSize:11, padding:"5px 12px", cursor:"pointer", fontWeight:600 }}>Confirm</button>
                    <button onClick={()=>updateOrderStatus(o.id,"cancelled")} style={{ background:"none", border:"1px solid #e24b4a30", borderRadius:7, color:"#e24b4a", fontSize:11, padding:"5px 10px", cursor:"pointer" }}>Cancel</button>
                  </div>
                )}
              </div>
            ))}
            <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:700, color:"#000", margin:"1rem 0 0.75rem" }}>Your inventory</div>
            {inventory.slice(0,5).map(item=>(
              <div key={item.id} style={{ background:"#fff", border:"0.5px solid #eee", borderRadius:10, padding:"0.75rem 1rem", marginBottom:6, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div>
                  <div style={{ fontSize:12, fontWeight:600, color:"#000" }}>{item.name}</div>
                  <div style={{ fontSize:10, color:"#888" }}>{item.category} · {item.stock_quantity} {item.unit}s in stock</div>
                </div>
                <div style={{ textAlign:"right" }}>
                  <div style={{ fontSize:13, fontWeight:700, color:"#e6821e" }}>KES {Number(item.price).toLocaleString()}</div>
                  {item.stock_quantity<=5&&<div style={{ fontSize:9, color:"#e24b4a" }}>⚠️ Low stock</div>}
                </div>
              </div>
            ))}
            {inventory.length===0&&!loading&&(
              <div style={{ color:"#888", fontSize:12, textAlign:"center", padding:"1rem" }}>
                No inventory yet — <a href="/dashboard/inventory" style={{ color:config.color }}>add items</a>
              </div>
            )}
          </>
        )}

        {/* BOOKING FOCUS */}
        {!isInventoryFocus&&(
          <>
            <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:700, color:"#000", marginBottom:"0.75rem" }}>
              Recent bookings
            </div>
            {loading&&<div style={{ color:"#888", fontSize:13 }}>Loading...</div>}
            {!loading&&bookings.length===0&&(
              <div style={{ color:"#888", fontSize:13, textAlign:"center", padding:"2rem", background:"#f8f8f8", borderRadius:12 }}>
                <div style={{ fontSize:32, marginBottom:8 }}>📭</div>
                No bookings yet
              </div>
            )}
            {bookings.map(b=>(
              <div key={b.id} style={{ background:"#fff", border:"0.5px solid #eee", borderRadius:12, padding:"0.85rem", marginBottom:8 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
                  <div style={{ flex:1, minWidth:0, marginRight:8 }}>
                    <div style={{ fontSize:13, fontWeight:500, color:"#000", marginBottom:2 }}>{b.service_name}</div>
                    <div style={{ fontSize:11, color:"#888" }}>{b.booking_date} · {b.booking_time?.slice(0,5)}</div>
                    {b.booking_number&&<div style={{ fontSize:10, color:"#aaa", marginTop:2 }}>#{b.booking_number}</div>}
                  </div>
                  <div style={{ textAlign:"right", flexShrink:0 }}>
                    <span style={{ fontSize:10, fontWeight:500, padding:"2px 8px", borderRadius:20, background:`${SC[b.status]||"#888"}15`, color:SC[b.status]||"#888", border:`1px solid ${SC[b.status]||"#888"}30` }}>
                      {b.status}
                    </span>
                    <div style={{ fontFamily:"Syne", fontSize:13, fontWeight:700, color:"#e6821e", marginTop:4 }}>
                      KES {Number(b.total_amount||0).toLocaleString()}
                    </div>
                  </div>
                </div>
                <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                  {b.status==="pending"&&<button onClick={()=>updateBookingStatus(b.id,"confirmed")} style={{ background:"#f0fdf4", border:"1px solid #1d9e7540", borderRadius:7, color:"#1d9e75", fontSize:11, padding:"5px 10px", cursor:"pointer" }}>Confirm</button>}
                  {b.status==="confirmed"&&<button onClick={()=>updateBookingStatus(b.id,"in-progress")} style={{ background:"#eff6ff", border:"1px solid #378add40", borderRadius:7, color:"#378add", fontSize:11, padding:"5px 10px", cursor:"pointer" }}>Start service</button>}
                  {b.status==="in-progress"&&<button onClick={()=>updateBookingStatus(b.id,"completed")} style={{ background:"#f0fdf4", border:"1px solid #1d9e7540", borderRadius:7, color:"#1d9e75", fontSize:11, padding:"5px 10px", cursor:"pointer" }}>Complete</button>}
                  {(b.status==="pending"||b.status==="confirmed")&&<button onClick={()=>updateBookingStatus(b.id,"cancelled")} style={{ background:"none", border:"1px solid #e24b4a30", borderRadius:7, color:"#e24b4a", fontSize:11, padding:"5px 10px", cursor:"pointer" }}>Cancel</button>}
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}
