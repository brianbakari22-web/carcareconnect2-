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

  async function load() {
    const { data } = await supabase.from("orders")
      .select("*, order_items(*, inventory(name,unit,category)), profiles!orders_customer_id_fkey(first_name,last_name,city)")
      .eq("provider_id", user.id)
      .order("created_at", { ascending:false })
    setOrders(data||[])
    setLoading(false)
  }

  async function updateStatus(orderId, status) {
    const order = orders.find(o=>o.id===orderId)
    await supabase.from("orders").update({ status, updated_at:new Date().toISOString() }).eq("id", orderId)
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
    if (!drivers?.length) return toast.error("No verified drivers available")
    const preferred = drivers.filter(d=>d.driver_vehicle_type===preferredType)
    const driver = preferred.length>0 ? preferred[0] : drivers[0]
    await supabase.from("orders").update({ delivery_driver_id:driver.id, delivery_status:"driver_assigned", delivery_attempt_expires_at:new Date(Date.now()+15*60*1000).toISOString() }).eq("id", orderId)
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

      {/* Gradient stats header */}
      <div style={{ background: newOrderAlert ? "linear-gradient(135deg,#1d9e75,#22c98f)" : "linear-gradient(135deg,#e6821e,#f09840)", borderRadius:14, padding:"1rem 1.25rem", marginBottom:"1.25rem", display:"flex", justifyContent:"space-between", alignItems:"center", transition:"background 0.5s" }}>
        <div>
          <div style={{ fontFamily:"Syne", fontSize:22, fontWeight:800, color:"#fff" }}>{newOrderAlert ? "🛒 New order!" : today+" orders today"}</div>
          <div style={{ fontSize:11, color:"rgba(255,255,255,0.8)", marginTop:2 }}>KES {revenue.toLocaleString()} earned from delivered orders</div>
        </div>
        <div style={{ textAlign:"center" }}>
          <div style={{ fontFamily:"Syne", fontSize:24, fontWeight:800, color:pending>0?"#fde68a":"rgba(255,255,255,0.9)" }}>{pending}</div>
          <div style={{ fontSize:10, color:"rgba(255,255,255,0.7)" }}>Pending</div>
        </div>
      </div>

      {pending>0&&(
        <div style={{ background:"#fff8f0", border:"1px solid #e6821e40", borderRadius:10, padding:"0.75rem 1rem", marginBottom:"1rem", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div style={{ fontSize:13, color:"#e6821e", fontWeight:600 }}>⚠️ {pending} order{pending>1?"s":""} waiting for confirmation</div>
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
            {STATUS_ICONS[f]||"📋"} {f==="all"?"All":STATUS_LABELS[f]} ({f==="all"?orders.length:orders.filter(o=>o.status===f).length})
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
          <div style={{ fontSize:36, marginBottom:8 }}>📦</div>
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
                  <div style={{ fontSize:11, color:"#777" }}>👤 {o.customer_name||o.profiles?.first_name+" "+o.profiles?.last_name}</div>
                  <div style={{ fontSize:11, color:"#777" }}>{o.fulfillment_type==="delivery"?"🚚 Delivery to "+o.delivery_address:"🏪 Customer pickup"}</div>
                  {o.delivery_zone&&<div style={{ fontSize:11, color:"#378add" }}>📍 Zone: {o.delivery_zone}</div>}
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


