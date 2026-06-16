import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"
import { useAuth } from "../../contexts/AuthContext"
import useIsMobile from "../../lib/useIsMobile"
import toast from "react-hot-toast"

const STATUS_COLORS = { pending:"#e6821e", confirmed:"#378add", processing:"#8b5cf6", ready:"#1d9e75", delivered:"#1d9e75", cancelled:"#e24b4a" }
const STATUS_FLOW = ["pending","confirmed","processing","ready","delivered"]

export default function ProviderOrders() {
  const { user } = useAuth()
  const isMobile = useIsMobile()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState("pending")

  useEffect(() => {
    if (!user) return
    load()
    const sub = supabase.channel("provider-orders")
      .on("postgres_changes", { event:"INSERT", schema:"public", table:"orders", filter:`provider_id=eq.${user.id}` },
        payload => {
          toast("🛒 New order received!", { duration:8000, icon:"🛒" })
          load()
        })
      .subscribe()
    return () => supabase.removeChannel(sub)
  }, [user])

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

  async function assignDriver(orderId) {
    const order = orders.find(o=>o.id===orderId)
    // Smart matching - prefer boda boda for small orders, van for large
    const itemCount = order?.order_items?.length||1
    const preferredType = itemCount<=3?"motorcycle":itemCount<=6?"tuktuk":"van"
    const { data: drivers } = await supabase.from("profiles")
      .select("id,first_name,last_name,driver_vehicle_type,city")
      .eq("role","driver")
      .eq("is_active",true)
      .eq("documents_verified",true)
    if (!drivers?.length) return toast.error("No verified drivers available")
    // Try preferred vehicle type first, fallback to any
    const preferred = drivers.filter(d=>d.driver_vehicle_type===preferredType)
    const driver = preferred.length>0 ? preferred[0] : drivers[0]
    await supabase.from("orders").update({ delivery_driver_id:driver.id, delivery_status:"driver_assigned" }).eq("id", orderId)
    await supabase.from("notifications").insert({
      user_id: driver.id,
      title: "🚚 New delivery job!",
      message: "New delivery assigned: "+order?.order_items?.length+" item(s) to "+order?.delivery_address+". Zone: "+order?.delivery_zone+". Check your deliveries now!",
      type: "success"
    })
    toast.success("Driver assigned: "+driver.first_name+" "+driver.last_name+" ("+driver.driver_vehicle_type+")")
    load()
  }

  const filtered = filter==="all" ? orders : orders.filter(o=>o.status===filter)
  const pending = orders.filter(o=>o.status==="pending").length
  const today = orders.filter(o=>new Date(o.created_at).toDateString()===new Date().toDateString()).length
  const revenue = orders.filter(o=>o.status==="delivered").reduce((s,o)=>s+Number(o.provider_earnings||0),0)

  return (
    <div>
      <div style={{ marginBottom:"1.25rem" }}>
        <div style={{ fontFamily:"Syne", fontSize:isMobile?16:20, fontWeight:800, color:"#000000" }}>Orders</div>
        <div style={{ fontSize:12, color:"#777777" }}>Manage parts and accessories orders</div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10, marginBottom:"1.5rem" }}>
        {[
          { label:"Pending", value:pending, color:pending>0?"#e6821e":"#555" },
          { label:"Today", value:today, color:"#378add" },
          { label:"Revenue", value:"KES "+revenue.toLocaleString(), color:"#1d9e75" },
        ].map(s=>(
          <div key={s.label} style={{ background:"#ffffff", borderRadius:10, padding:"0.75rem", border:"1px solid #eeeeee", textAlign:"center" }}>
            <div style={{ fontFamily:"Syne", fontSize:isMobile?14:18, fontWeight:800, color:s.color }}>{s.value}</div>
            <div style={{ fontSize:10, color:"#777777", marginTop:2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {pending>0&&(
        <div style={{ background:"#fff8f0", border:"1px solid #e6821e40", borderRadius:10, padding:"0.75rem", marginBottom:"1rem" }}>
          <div style={{ fontSize:13, color:"#e6821e", fontWeight:600 }}>⚠️ {pending} order{pending>1?"s":""} waiting for confirmation</div>
        </div>
      )}

      <div style={{ display:"flex", gap:6, marginBottom:"1rem", flexWrap:"wrap" }}>
        {["pending","confirmed","processing","ready","delivered","cancelled","all"].map(f=>(
          <button key={f} onClick={()=>setFilter(f)}
            style={{ padding:"5px 12px", borderRadius:7, border:"none", fontSize:11, cursor:"pointer", background:filter===f?(STATUS_COLORS[f]||"#8b5cf6"):"#555555", color:filter===f?"#fff":"#666" }}>
            {f} ({f==="all"?orders.length:orders.filter(o=>o.status===f).length})
          </button>
        ))}
      </div>

      {loading&&<div style={{ color:"#777777", fontSize:13 }}>Loading...</div>}
      {!loading&&filtered.length===0&&<div style={{ color:"#888888", fontSize:13, textAlign:"center", padding:"2rem" }}>No orders found</div>}

      {filtered.map(o=>(
        <div key={o.id} style={{ background:"#ffffff", border:"1px solid "+(STATUS_COLORS[o.status]||"#eeeeee")+"30", borderRadius:12, padding:"1rem", marginBottom:10 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
            <div>
              <div style={{ fontSize:13, fontWeight:600, color:"#000000", marginBottom:2 }}>#{o.order_number}</div>
              <div style={{ fontSize:11, color:"#777777" }}>👤 {o.profiles?.first_name} {o.profiles?.last_name}</div>
              <div style={{ fontSize:11, color:"#777777" }}>{o.fulfillment_type==="delivery"?"🚚 Delivery to "+o.delivery_address:"🏪 Customer pickup"}</div>
              {o.delivery_zone&&<div style={{ fontSize:11, color:"#378add" }}>📍 Zone: {o.delivery_zone}</div>}
              <div style={{ fontSize:10, color:"#888888" }}>{new Date(o.created_at).toLocaleString()}</div>
            </div>
            <div style={{ textAlign:"right" }}>
              <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:800, color:"#e6821e" }}>KES {Number(o.subtotal||0).toLocaleString()}</div>
              <div style={{ fontSize:10, color:"#1d9e75" }}>Your cut: KES {Number(o.provider_earnings||0).toLocaleString()}</div>
              <span style={{ fontSize:10, padding:"2px 8px", borderRadius:10, background:(STATUS_COLORS[o.status]||"#888")+"20", color:STATUS_COLORS[o.status]||"#888", display:"inline-block", marginTop:4 }}>{o.status}</span>
            </div>
          </div>

          <div style={{ background:"#ffffff", borderRadius:8, padding:"0.75rem", marginBottom:10 }}>
            {o.order_items?.map(oi=>(
              <div key={oi.id} style={{ display:"flex", justifyContent:"space-between", fontSize:12, color:"#555555", padding:"3px 0" }}>
                <span>{oi.name} × {oi.quantity} {oi.inventory?.unit||""}</span>
                <span>KES {Number(oi.unit_price*oi.quantity).toLocaleString()}</span>
              </div>
            ))}
            {o.delivery_fee>0&&(
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:"#777777", borderTop:"1px solid #eeeeee", paddingTop:4, marginTop:4 }}>
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
          </div>
        </div>
      ))}
    </div>
  )
}




