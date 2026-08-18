import { ClockIcon, CheckIcon, OrdersIcon, SuccessIcon, CloseIcon, MarketplaceIcon, PaymentsIcon, DeliveryIcon, LocationIcon, MovingCarIcon, ProfileIcon, WarningIcon, NoteIcon, PhoneCallIcon, ShareIcon, ServicesIcon, TripReportIcon } from "../../lib/cccIcons"
import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"
import { useAuth } from "../../contexts/AuthContext"
import useIsMobile from "../../lib/useIsMobile"
import { callNumber, openWhatsApp } from "../../lib/openExternal"
import toast from "react-hot-toast"

const STATUS_COLORS = { pending:"#e6821e", confirmed:"#378add", processing:"#8b5cf6", ready:"#1d9e75", delivered:"#1d9e75", cancelled:"#e24b4a" }
const STATUS_FLOW = ["pending","confirmed","processing","ready","delivered"]
const STATUS_LABELS = { pending:"Pending", confirmed:"Confirmed", processing:"Packing", ready:"Ready", delivered:"Delivered", cancelled:"Cancelled" }
const STATUS_ICONS = { pending:"🕐", confirmed:"✓", processing:"📦", ready:"✅", delivered:"🎉", cancelled:"✗" }

export default function ProviderOrders() {
  const { user } = useAuth()
  const isMobile = useIsMobile()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [goPartsRequests, setGoPartsRequests] = useState([])
  const [riderInfo, setRiderInfo] = useState({}) // {id: {name, phone}}
  const [showRiderForm, setShowRiderForm] = useState(null)
  const [goPartsTab, setGoPartsTab] = useState(false)
  const [filter, setFilter] = useState("pending")
  const [search, setSearch] = useState("")
  const [selectedIds, setSelectedIds] = useState([])
  const [newOrderAlert, setNewOrderAlert] = useState(false)

  useEffect(() => {
    if (!user) return
    load()
    const sub = supabase.channel("provider-orders")
      .on("postgres_changes", { event:"INSERT", schema:"public", table:"orders", filter:"provider_id=eq."+user.id },
        () => {
          setNewOrderAlert(true)
          playNotificationSound()
          toast("🛒 New order received!", { duration:8000, icon:"🛒" })
          load()
          setTimeout(()=>setNewOrderAlert(false), 4000)
        })
      .subscribe()
    return () => supabase.removeChannel(sub)
  }, [user])

  function playNotificationSound() {
    try {
      const audio = new Audio("data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQoAAAAAAAAAAAAA")
      audio.volume = 0.3
      audio.play().catch(()=>{})
    } catch(e) {}
  }

  async function acceptGoPartsRequest(id) {
    const req = goPartsRequests.find(r=>r.id===id)
    if(!req) return
    const rider = riderInfo[id] || {}
    // Calculate payouts
    const partsCut = await supabase.from("app_settings").select("value").eq("key","go_parts_provider_rate").single()
    const provRate = Number(partsCut.data?.value||90)/100
    const provPayout = Math.round(req.total_amount * provRate)
    const platformComm = req.total_amount - provPayout
    await supabase.from("go_parts_requests").update({
      status:"accepted", delivery_status:"accepted",
      rider_name: rider.name||null, rider_phone: rider.phone||null,
      provider_payout: provPayout, platform_commission: platformComm
    }).eq("id", id)
    // Notify mechanic
    await supabase.from("notifications").insert({ user_id: req.mechanic_id, title: "Part accepted! 📦", message: "Supplier accepted. Rider: "+(rider.name||"on the way")+" "+( rider.phone||""), type: "success" })
    // Notify customer - request payment
    await supabase.from("notifications").insert({ user_id: req.customer_id, title: "Part approved — pay now 💳", message: "Your mechanic needs a "+req.inventory?.name+" — KES "+Number(req.total_amount).toLocaleString()+". Check app to approve payment.", type: "info" })
    setGoPartsRequests(prev=>prev.map(r=>r.id===id?{...r,status:"accepted",delivery_status:"accepted",rider_name:rider.name,rider_phone:rider.phone}:r))
    // Send STK push immediately so customer pays fast
    await supabase.functions.invoke("daraja-stk-push", { body: { amount: req.total_amount, booking_id: req.booking_id, customer_id: req.customer_id, provider_id: req.provider_id, service_name: "GO Parts: "+(req.inventory?.name||"Part") } }).catch(e=>console.warn("Parts STK:",e.message))
    setShowRiderForm(null)
    toast.success("Part request accepted! Customer notified to pay.")
  }
  async function updatePartsDeliveryStatus(id, newStatus) {
    await supabase.from("go_parts_requests").update({ delivery_status: newStatus, status: newStatus==="delivered"?"delivered":"accepted" }).eq("id", id)
    setGoPartsRequests(prev=>prev.map(r=>r.id===id?{...r,delivery_status:newStatus,status:newStatus==="delivered"?"delivered":"accepted"}:r))
    const req = goPartsRequests.find(r=>r.id===id)
    if(req) {
      const msgs = { picked_up:"Rider has picked up the part and is heading to you.", on_the_way:"Your part is on the way! Rider: "+(req.rider_name||"")+" "+(req.rider_phone||""), delivered:"Part has been delivered to your mechanic!" }
      await supabase.from("notifications").insert([
        { user_id: req.mechanic_id, title: newStatus.replace(/_/g," ")+" ✅", message: msgs[newStatus]||newStatus, type: "info" },
        { user_id: req.customer_id, title: newStatus.replace(/_/g," ")+" ✅", message: msgs[newStatus]||newStatus, type: "info" }
      ])
    }
    toast.success("Status updated: "+newStatus.replace(/_/g," "))
  }
  async function markGoPartsDelivered(id) {
    const req = goPartsRequests.find(r=>r.id===id)
    if(!req) return
    // Update status
    await supabase.from("go_parts_requests").update({ status:"delivered", delivery_status:"delivered", payment_released:false }).eq("id", id)
    // Decrement stock
    await supabase.rpc("decrement_stock", { inv_id: req.inventory_id, qty: req.quantity })
    // Notify mechanic + customer
    await supabase.from("notifications").insert([
      { user_id: req.mechanic_id, title: "Part delivered! ✅", message: "Your part has been delivered. Fit it and complete the job.", type: "success" },
      { user_id: req.customer_id, title: "Part delivered! 💳 Pay now", message: `Your mechanic received the ${req.inventory?.name}. Please pay KES ${Number(req.total_amount).toLocaleString()} for the part.`, type: "info" }
    ])
    // Payment released by customer when they confirm receipt
    setGoPartsRequests(prev=>prev.map(r=>r.id===id?{...r,status:"delivered",delivery_status:"delivered"}:r))
    toast.success("Marked as delivered! Customer will be prompted to confirm receipt.")
  }
  async function load() {
    const { data } = await supabase.from("orders")
      .select("*, order_items(*, inventory(name,unit,category)), profiles!orders_customer_id_fkey(first_name,last_name,city)")
      .eq("provider_id", user.id)
      .neq("status","pending_payment")
      .order("created_at", { ascending:false })
    setOrders(data||[])
    setLoading(false)
  }

  async function updateStatus(orderId, status) {
    const order = orders.find(o=>o.id===orderId)
    const { error } = await supabase.from("orders").update({ status, updated_at:new Date().toISOString() }).eq("id", orderId)
    if (error) { toast.error("Failed to update order: "+error.message); return }
    // For pickup orders (no driver involved), the provider marking it delivered/complete
    // themselves is the confirmation - trigger the payout release right here. Delivery
    // orders release separately, only once the customer's OTP genuinely confirms receipt.
    if (status==="delivered" && order?.fulfillment_type!=="delivery") {
      await supabase.functions.invoke("release-order-payment", { body: { order_id: orderId } })
    }
    if (order?.customer_id) {
      const messages = {
        confirmed: "Your order has been confirmed! We are preparing your items.",
        processing: "Your order is being processed and packed.",
        ready: order.fulfillment_type==="delivery"?"Your order is ready — driver will pick up soon!":"Your order is ready for pickup!",
        delivered: "Your order has been delivered. Thank you! 🎉",
        cancelled: "Your order has been cancelled. Contact support for refund."
      }
      await supabase.from("notifications").insert({
        user_id: order.customer_id,
        title: "Order update 📦",
        message: messages[status]||"Order status updated to "+status,
        type: status==="cancelled"?"error":"success"
      })
    }
    toast.success("Order "+status)
    load()
  }

  async function bulkConfirm() {
    if (selectedIds.length===0) return
    for (const id of selectedIds) {
      await updateStatus(id, "confirmed")
    }
    setSelectedIds([])
    toast.success(selectedIds.length+" orders confirmed")
  }

  function toggleSelect(id) {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i=>i!==id) : [...prev, id])
  }

  async function assignDriver(orderId) {
    const order = orders.find(o=>o.id===orderId)
    const itemCount = order?.order_items?.length||1
    const preferredType = itemCount<=3?"motorcycle":itemCount<=6?"tuktuk":"van"
    const { data: drivers } = await supabase.from("profiles")
      .select("id,first_name,last_name,driver_vehicle_type,city")
      .eq("role","driver")
      .eq("is_active",true)
      .eq("documents_verified",true)
      .eq("driver_category","marketplace")
    if (!drivers?.length) return toast.error("No verified drivers available")
    const preferred = drivers.filter(d=>d.driver_vehicle_type===preferredType)
    const driver = preferred.length>0 ? preferred[0] : drivers[0]
    const { error: assignError } = await supabase.from("orders").update({ delivery_driver_id:driver.id, delivery_status:"driver_assigned", delivery_attempt_expires_at:new Date(Date.now()+15*60*1000).toISOString() }).eq("id", orderId)
    if (assignError) { toast.error("Failed to assign driver: "+assignError.message); return }
    await supabase.from("notifications").insert({
      user_id: driver.id,
      title: "🚚 New delivery job!",
      message: "New delivery assigned: "+order?.order_items?.length+" item(s) to "+order?.delivery_address+". Zone: "+order?.delivery_zone+". You have 15 minutes to accept!",
      type: "success"
    })
    toast.success("Driver assigned: "+driver.first_name+" "+driver.last_name+" ("+driver.driver_vehicle_type+")")
    load()
  }

  function shareReceipt(o) {
    const items = o.order_items?.map(oi=>oi.name+" x"+oi.quantity+" - KES "+Number(oi.unit_price*oi.quantity).toLocaleString()).join("\n")
    const text = "CCC Order #"+o.order_number+"\n\nCustomer: "+o.customer_name+"\n\n"+items+"\n\nSubtotal: KES "+Number(o.subtotal).toLocaleString()+(o.delivery_fee>0?"\nDelivery: KES "+Number(o.delivery_fee).toLocaleString():"")+"\n\nStatus: "+o.status
    if (navigator.share) {
      navigator.share({ title:"Order #"+o.order_number, text }).catch(()=>{})
    } else {
      navigator.clipboard.writeText(text)
      toast.success("Receipt copied to clipboard")
    }
  }

  const filtered = (filter==="all" ? orders : orders.filter(o=>o.status===filter))
    .filter(o => !search || o.customer_name?.toLowerCase().includes(search.toLowerCase()) || o.order_number?.toLowerCase().includes(search.toLowerCase()))

  const pending = orders.filter(o=>o.status==="pending").length
  const today = orders.filter(o=>new Date(o.created_at).toDateString()===new Date().toDateString()).length
  const revenue = orders.filter(o=>o.status==="delivered").reduce((s,o)=>s+Number(o.provider_earnings||0),0)

  return (
    <div>
      <div style={{ marginBottom:"1.25rem" }}>
        <div style={{ fontFamily:"Syne", fontSize:isMobile?16:20, fontWeight:800, color:"#000" }}>Orders</div>
        <div style={{ fontSize:12, color:"#777" }}>Manage parts and accessories orders</div>
      </div>
      {/* GO Parts Requests */}
        {goPartsRequests.filter(r=>r.status==="pending"||r.status==="accepted").length > 0 && (
        <div style={{ background:"#f3f0ff", border:"1px solid #8b5cf640", borderRadius:12, padding:"1rem", marginBottom:"1.25rem" }}>
          <div style={{ fontFamily:"Syne", fontSize:13, fontWeight:700, color:"#8b5cf6", marginBottom:8, display:"flex", alignItems:"center", gap:6 }}><ServicesIcon size={14} color="#8b5cf6"/> GO Service Part Requests</div>
          {goPartsRequests.filter(r=>r.status==="pending"||r.status==="accepted").map(r=>(
            <div key={r.id} style={{ background:"#fff", borderRadius:10, padding:"0.75rem", marginBottom:8 }}>
              <div style={{ marginBottom:8 }}>
                <div style={{ fontSize:13, fontWeight:600 }}>{r.inventory?.name} x{r.quantity}</div>
                <div style={{ fontSize:11, color:"#888" }}>KES {Number(r.total_amount).toLocaleString()} · Your cut: KES {Number(r.provider_payout||r.total_amount*0.9).toLocaleString()}</div>
                <div style={{ fontSize:11, color:"#555", marginTop:2, display:"flex", alignItems:"center", gap:3 }}><LocationIcon size={11} color="#555"/> {r.delivery_location_address}</div>
                {r.delivery_location_lat&&r.delivery_location_lng&&<a href={`https://www.google.com/maps/dir/?api=1&destination=${r.delivery_location_lat},${r.delivery_location_lng}`} target="_blank" rel="noopener noreferrer" style={{ fontSize:11, color:"#4285f4", fontWeight:600 }}><TripReportIcon size={13} color="#4285f4"/> Navigate to customer</a>}
                <div style={{ fontSize:11, color:"#888" }}>Mechanic: {r.mechanic?.first_name}</div>
                {r.rider_name&&<div style={{ fontSize:11, color:"#555", display:"flex", alignItems:"center", gap:3 }}><MovingCarIcon size={11} color="#555"/> Rider: {r.rider_name} {r.rider_phone&&<a href={"tel:"+r.rider_phone} style={{ color:"#1d9e75" }}>{r.rider_phone}</a>}</div>}
                <div style={{ display:"flex", gap:4, marginTop:6, marginBottom:4 }}>{["accepted","picked_up","on_the_way","delivered"].map((s,i)=>(<div key={s} style={{ flex:1, height:3, borderRadius:3, background:["accepted","picked_up","on_the_way","delivered"].indexOf(r.delivery_status||"accepted")>=i?"#8b5cf6":"#eee" }}/>))}</div>
                <div style={{ fontSize:10, padding:"2px 8px", borderRadius:8, display:"inline-block", marginTop:4, background:r.delivery_status==="delivered"?"#f0fdf4":r.delivery_status==="on_the_way"?"#eff6ff":r.delivery_status==="picked_up"?"#fff8f0":"#f3f0ff", color:r.delivery_status==="delivered"?"#1d9e75":r.delivery_status==="on_the_way"?"#378add":r.delivery_status==="picked_up"?"#e6821e":"#8b5cf6", fontWeight:600 }}>{r.delivery_status?.replace(/_/g," ")||"pending"}</div>
              </div>
              {/* Pending - show accept with optional rider info */}
              {r.status==="pending"&&(
                <div>
                  {showRiderForm===r.id&&(
                    <div style={{ marginBottom:8 }}>
                      <input placeholder="Rider name (optional)" value={riderInfo[r.id]?.name||""} onChange={e=>setRiderInfo(p=>({...p,[r.id]:{...p[r.id],name:e.target.value}}))} style={{ width:"100%", padding:"6px 8px", borderRadius:7, border:"1px solid #ddd", fontSize:11, marginBottom:4, boxSizing:"border-box" }}/>
                      <input placeholder="Rider phone (optional)" value={riderInfo[r.id]?.phone||""} onChange={e=>setRiderInfo(p=>({...p,[r.id]:{...p[r.id],phone:e.target.value}}))} style={{ width:"100%", padding:"6px 8px", borderRadius:7, border:"1px solid #ddd", fontSize:11, boxSizing:"border-box" }}/>
                    </div>
                  )}
                  <div style={{ display:"flex", gap:6 }}>
                    <button onClick={()=>setShowRiderForm(showRiderForm===r.id?null:r.id)} style={{ flex:1, background:"#f3f0ff", border:"1px solid #8b5cf640", borderRadius:8, color:"#8b5cf6", fontSize:11, padding:"6px 10px", cursor:"pointer" }}>🚴 {showRiderForm===r.id?"Hide":"Add rider"}</button>
                    <button onClick={()=>acceptGoPartsRequest(r.id)} style={{ flex:1, background:"#8b5cf6", border:"none", borderRadius:8, color:"#fff", fontSize:11, fontWeight:700, padding:"6px 10px", cursor:"pointer" }}>✓ Accept</button>
                  </div>
                </div>
              )}
              {/* Accepted - show delivery status buttons */}
              {r.status==="accepted"&&(
                <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                  {r.delivery_status==="accepted"&&<button onClick={()=>updatePartsDeliveryStatus(r.id,"picked_up")} style={{ background:"#e6821e", border:"none", borderRadius:8, color:"#fff", fontSize:10, fontWeight:700, padding:"5px 10px", cursor:"pointer" }}>📦 Picked Up</button>}
                  {r.delivery_status==="picked_up"&&<button onClick={()=>updatePartsDeliveryStatus(r.id,"on_the_way")} style={{ background:"#378add", border:"none", borderRadius:8, color:"#fff", fontSize:10, fontWeight:700, padding:"5px 10px", cursor:"pointer" }}>🚚 On the Way</button>}
                  {r.delivery_status==="on_the_way"&&<button onClick={()=>markGoPartsDelivered(r.id)} style={{ background:"#1d9e75", border:"none", borderRadius:8, color:"#fff", fontSize:10, fontWeight:700, padding:"5px 10px", cursor:"pointer" }}>✅ Mark Delivered</button>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {/* Gradient stats header */}
      <div style={{ background: newOrderAlert ? "linear-gradient(135deg,#1d9e75,#22c98f)" : "linear-gradient(135deg,#e6821e,#f09840)", borderRadius:14, padding:"1rem 1.25rem", marginBottom:"1.25rem", display:"flex", justifyContent:"space-between", alignItems:"center", transition:"background 0.5s" }}>
        <div>
          <div style={{ fontFamily:"Syne", fontSize:22, fontWeight:800, color:"#fff", display:"flex", alignItems:"center", gap:8 }}>{newOrderAlert ? "🛒 New order!" : today+" orders today"}</div>
          <div style={{ fontSize:11, color:"rgba(255,255,255,0.8)", marginTop:2 }}>KES {revenue.toLocaleString()} earned from delivered orders</div>
        </div>
        <div style={{ textAlign:"center" }}>
          <div style={{ fontFamily:"Syne", fontSize:24, fontWeight:800, color:pending>0?"#fde68a":"rgba(255,255,255,0.9)" }}>{pending}</div>
          <div style={{ fontSize:10, color:"rgba(255,255,255,0.7)" }}>Pending</div>
        </div>
      </div>

      {pending>0&&(
        <div style={{ background:"#fff8f0", border:"1px solid #e6821e40", borderRadius:10, padding:"0.75rem 1rem", marginBottom:"1rem", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div style={{ fontSize:13, color:"#e6821e", fontWeight:600, display:"flex", alignItems:"center", gap:4 }}><WarningIcon size={13} color="#e6821e"/> {pending} order{pending>1?"s":""} waiting for confirmation</div>
        </div>
      )}

      {/* Search */}
      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by customer name or order number..."
        style={{ width:"100%", background:"#ffffff", border:"1px solid #e5e5e5", borderRadius:10, padding:"9px 14px", color:"#000", fontSize:13, outline:"none", marginBottom:10 }}/>

      {/* Status filter */}
      <div style={{ display:"flex", gap:6, marginBottom:"1rem", flexWrap:"wrap" }}>
        {["pending","confirmed","processing","ready","delivered","cancelled","all"].map(f=>(
          <button key={f} onClick={()=>setFilter(f)}
            style={{ padding:"6px 12px", borderRadius:8, border:"none", fontSize:11, cursor:"pointer", background:filter===f?(STATUS_COLORS[f]||"#8b5cf6"):"#f0f0f0", color:filter===f?"#fff":"#555", fontWeight:filter===f?700:400 }}>
            {f==="all"?<MarketplaceIcon size={14} color="currentColor"/>:STATUS_ICONS[f]==="clock"?<ClockIcon size={14} color="currentColor"/>:STATUS_ICONS[f]==="check"?<CheckIcon size={14} color="currentColor"/>:STATUS_ICONS[f]==="orders"?<OrdersIcon size={14} color="currentColor"/>:STATUS_ICONS[f]==="success"?<SuccessIcon size={14} color="currentColor"/>:<CloseIcon size={14} color="currentColor"/>} {f==="all"?"All":STATUS_LABELS[f]} ({f==="all"?orders.length:orders.filter(o=>o.status===f).length})
          </button>
        ))}
      </div>

      {/* Bulk actions */}
      {filter==="pending"&&filtered.length>0&&(
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10, background:"#f8f8f8", borderRadius:8, padding:"0.5rem 0.75rem" }}>
          <label style={{ display:"flex", alignItems:"center", gap:6, fontSize:12, color:"#555", cursor:"pointer" }}>
            <input type="checkbox" checked={selectedIds.length===filtered.length&&filtered.length>0} onChange={e=>setSelectedIds(e.target.checked?filtered.map(o=>o.id):[])}/>
            Select all ({selectedIds.length} selected)
          </label>
          {selectedIds.length>0&&(
            <button onClick={bulkConfirm} style={{ background:"#1d9e75", border:"none", borderRadius:7, color:"#fff", fontSize:11, fontWeight:700, padding:"6px 14px", cursor:"pointer" }}>
              ✓ Confirm {selectedIds.length} order{selectedIds.length>1?"s":""}
            </button>
          )}
        </div>
      )}

      {loading&&<div style={{ color:"#777", fontSize:13 }}>Loading...</div>}
      {!loading&&filtered.length===0&&(
        <div style={{ textAlign:"center", padding:"2rem", color:"#888" }}>
          <div style={{ marginBottom:8, display:"flex", justifyContent:"center" }}><OrdersIcon size={36} color="#e6821e"/></div>
          <div style={{ fontSize:13 }}>No orders found</div>
        </div>
      )}

      {filtered.map(o=>{
        const flowIdx = STATUS_FLOW.indexOf(o.status)
        return (
          <div key={o.id} style={{ background:"#ffffff", border:"1px solid "+(STATUS_COLORS[o.status]||"#eeeeee")+"30", borderRadius:14, padding:"1rem", marginBottom:10, boxShadow:"0 1px 4px rgba(0,0,0,0.04)" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
              <div style={{ display:"flex", gap:8, alignItems:"flex-start" }}>
                {o.status==="pending"&&(
                  <input type="checkbox" checked={selectedIds.includes(o.id)} onChange={()=>toggleSelect(o.id)} style={{ marginTop:3 }}/>
                )}
                <div>
                  <div style={{ fontSize:13, fontWeight:700, color:"#000", marginBottom:2 }}>#{o.order_number}</div>
                  <div style={{ fontSize:11, color:"#777", display:"flex", alignItems:"center", gap:3 }}><ProfileIcon size={11} color="#777"/> {o.customer_name||o.profiles?.first_name+" "+o.profiles?.last_name}</div>
                  <div style={{ fontSize:11, color:"#777" }}>{o.fulfillment_type==="delivery"?<><DeliveryIcon size={11} color="#378add"/> Delivery to {o.delivery_address}</>:<><MarketplaceIcon size={11} color="#888"/> Customer pickup</>}</div>
                  {o.delivery_zone&&<div style={{ fontSize:11, color:"#378add", display:"flex", alignItems:"center", gap:3 }}><LocationIcon size={11} color="#378add"/> Zone: {o.delivery_zone}</div>}
                  <div style={{ fontSize:10, color:"#888" }}>{new Date(o.created_at).toLocaleString()}</div>
                </div>
              </div>
              <div style={{ textAlign:"right" }}>
                <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:800, color:"#e6821e" }}>KES {Number(o.subtotal||0).toLocaleString()}</div>
                <div style={{ fontSize:10, color:"#1d9e75" }}>Your cut: KES {Number(o.provider_earnings||0).toLocaleString()}</div>
                <span style={{ fontSize:10, padding:"3px 10px", borderRadius:20, background:(STATUS_COLORS[o.status]||"#888")+"20", color:STATUS_COLORS[o.status]||"#888", display:"inline-block", marginTop:4, fontWeight:600 }}>{STATUS_ICONS[o.status]} {STATUS_LABELS[o.status]}</span>
              </div>
            </div>

            {/* Progress bar */}
            {o.status!=="cancelled"&&(
              <div style={{ display:"flex", alignItems:"center", marginBottom:10, padding:"0 4px" }}>
                {STATUS_FLOW.map((s,i)=>(
                  <div key={s} style={{ display:"flex", alignItems:"center", flex:i<STATUS_FLOW.length-1?1:0 }}>
                    <div style={{ width:18, height:18, borderRadius:"50%", background:i<=flowIdx?STATUS_COLORS[s]:"#e5e5e5", display:"flex", alignItems:"center", justifyContent:"center", fontSize:9, color:"#fff", flexShrink:0 }}>
                      {i<flowIdx?"✓":i+1}
                    </div>
                    {i<STATUS_FLOW.length-1&&<div style={{ flex:1, height:2, background:i<flowIdx?STATUS_COLORS[s]:"#e5e5e5" }}/>}
                  </div>
                ))}
              </div>
            )}

            <div style={{ background:"#f8f8f8", borderRadius:8, padding:"0.75rem", marginBottom:10 }}>
              {o.order_items?.map(oi=>(
                <div key={oi.id} style={{ display:"flex", justifyContent:"space-between", fontSize:12, color:"#555", padding:"3px 0" }}>
                  <span>{oi.name} × {oi.quantity} {oi.inventory?.unit||""}</span>
                  <span>KES {Number(oi.unit_price*oi.quantity).toLocaleString()}</span>
                </div>
              ))}
              {o.delivery_fee>0&&(
                <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:"#777", borderTop:"1px solid #eeeeee", paddingTop:4, marginTop:4 }}>
                  <span>Delivery fee</span><span>KES {Number(o.delivery_fee).toLocaleString()}</span>
                </div>
              )}
            </div>

            <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
              {o.status==="pending"&&(
                <>
                  <button onClick={()=>updateStatus(o.id,"confirmed")} style={{ background:"#f0fdf4", border:"1px solid #1d9e7540", borderRadius:7, color:"#1d9e75", fontSize:11, padding:"6px 12px", cursor:"pointer", fontWeight:600 }}>✓ Confirm order</button>
                  <button onClick={()=>updateStatus(o.id,"cancelled")} style={{ background:"none", border:"1px solid #e24b4a40", borderRadius:7, color:"#e24b4a", fontSize:11, padding:"6px 10px", cursor:"pointer" }}>Cancel</button>
                </>
              )}
              {o.status==="confirmed"&&(
                <button onClick={()=>updateStatus(o.id,"processing")} style={{ background:"#faf5ff", border:"1px solid #8b5cf640", borderRadius:7, color:"#8b5cf6", fontSize:11, padding:"6px 12px", cursor:"pointer" }}>📦 Start packing</button>
              )}
              {o.status==="processing"&&(
                <button onClick={()=>updateStatus(o.id,"ready")} style={{ background:"#f0fdf4", border:"1px solid #1d9e7540", borderRadius:7, color:"#1d9e75", fontSize:11, padding:"6px 12px", cursor:"pointer" }}>✅ Mark ready</button>
              )}
              {o.status==="ready"&&o.fulfillment_type==="delivery"&&!o.delivery_driver_id&&(
                <button onClick={()=>assignDriver(o.id)} style={{ background:"#eff6ff", border:"1px solid #378add40", borderRadius:7, color:"#378add", fontSize:11, padding:"6px 12px", cursor:"pointer" }}>🚚 Assign driver</button>
              )}
              {o.status==="ready"&&o.fulfillment_type==="pickup"&&(
                <button onClick={()=>updateStatus(o.id,"delivered")} style={{ background:"#f0fdf4", border:"1px solid #1d9e7540", borderRadius:7, color:"#1d9e75", fontSize:11, padding:"6px 12px", cursor:"pointer" }}>✓ Customer picked up</button>
              )}
              {o.customer_phone&&(
                <button onClick={()=>callNumber(o.customer_phone)} style={{ background:"#f0fdf4", border:"1px solid #1d9e7540", borderRadius:7, color:"#1d9e75", fontSize:11, padding:"6px 12px", cursor:"pointer" }}>📞 Call</button>
              )}
              {o.customer_phone&&(
                <button onClick={()=>openWhatsApp(o.customer_phone)} style={{ background:"#f0fdf4", border:"1px solid #1d9e7540", borderRadius:7, color:"#1d9e75", fontSize:11, padding:"6px 12px", cursor:"pointer" }}>💚 WhatsApp</button>
              )}
              <button onClick={()=>shareReceipt(o)} style={{ background:"#f5f3ff", border:"1px solid #8b5cf640", borderRadius:7, color:"#8b5cf6", fontSize:11, padding:"6px 12px", cursor:"pointer" }}>📤 Share receipt</button>
            </div>
          </div>
        )
      })}
    </div>
  )
}








