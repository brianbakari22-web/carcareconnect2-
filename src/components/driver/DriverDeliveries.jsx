import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"
import { useAuth } from "../../contexts/AuthContext"
import useIsMobile from "../../lib/useIsMobile"
import toast from "react-hot-toast"

export default function DriverDeliveries() {
  const { user } = useAuth()
  const isMobile = useIsMobile()
  const [deliveries, setDeliveries] = useState([])
  const [available, setAvailable] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState("available")

  useEffect(() => {
    if (!user) return
    load()
    const sub = supabase.channel("driver-deliveries")
      .on("postgres_changes", { event:"UPDATE", schema:"public", table:"orders", filter:`delivery_driver_id=eq.${user.id}` },
        () => load())
      .subscribe()
    return () => supabase.removeChannel(sub)
  }, [user])

  async function load() {
    const [{ data: mine }, { data: avail }] = await Promise.all([
      supabase.from("orders")
        .select("*, order_items(name,quantity), profiles!orders_customer_id_fkey(first_name,last_name,city), provider:profiles!orders_provider_id_fkey(first_name,last_name,business_name,city)")
        .eq("delivery_driver_id", user.id)
        .order("created_at", { ascending:false }),
      supabase.from("orders")
        .select("*, order_items(name,quantity), profiles!orders_customer_id_fkey(first_name,last_name,city), provider:profiles!orders_provider_id_fkey(first_name,last_name,business_name,city)")
        .eq("fulfillment_type","delivery")
        .eq("status","ready")
        .is("delivery_driver_id",null)
        .order("created_at", { ascending:false })
    ])
    setDeliveries(mine||[])
    setAvailable(avail||[])
    setLoading(false)
  }

  async function acceptDelivery(orderId) {
    await supabase.from("orders").update({
      delivery_driver_id: user.id,
      delivery_status: "driver_assigned"
    }).eq("id", orderId)
    const order = available.find(o=>o.id===orderId)
    if (order?.customer_id) {
      await supabase.from("notifications").insert({
        user_id: order.customer_id,
        title: "Driver assigned! 🚚",
        message: "A driver has been assigned to deliver your order. They will pick up from the shop shortly.",
        type: "success"
      })
    }
    toast.success("Delivery accepted!")
    load()
  }

  async function updateDeliveryStatus(orderId, status, customerId) {
    await supabase.from("orders").update({
      delivery_status: status,
      ...(status==="picked_up"?{ pickup_confirmed_at:new Date().toISOString() }:{}),
      ...(status==="delivered"?{ delivered_at:new Date().toISOString(), status:"delivered" }:{})
    }).eq("id", orderId)
    const messages = {
      picked_up: "Your order has been picked up and is on the way! 🚚",
      delivered: "Your order has been delivered! Please confirm receipt. 🎉"
    }
    if (messages[status] && customerId) {
      await supabase.from("notifications").insert({
        user_id: customerId,
        title: "Order update 📦",
        message: messages[status],
        type: "success"
      })
    }
    toast.success("Status updated")
    load()
  }

  const SC = { driver_assigned:"#378add", picked_up:"#8b5cf6", delivered:"#1d9e75" }
  const activeDeliveries = deliveries.filter(d=>d.delivery_status!=="delivered")
  const completedDeliveries = deliveries.filter(d=>d.delivery_status==="delivered")
  const earnings = completedDeliveries.reduce((s,d)=>s+Number(d.delivery_fee||0)*0.85,0)

  return (
    <div>
      <div style={{ marginBottom:"1.25rem" }}>
        <div style={{ fontFamily:"Syne", fontSize:isMobile?16:20, fontWeight:800, color:"#000000" }}>Deliveries</div>
        <div style={{ fontSize:12, color:"#777777" }}>CCC parts and accessories deliveries</div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10, marginBottom:"1.5rem" }}>
        {[
          { label:"Available", value:available.length, color:available.length>0?"#e6821e":"#555" },
          { label:"Active", value:activeDeliveries.length, color:activeDeliveries.length>0?"#378add":"#555" },
          { label:"Earnings", value:"KES "+earnings.toLocaleString(), color:"#1d9e75" },
        ].map(s=>(
          <div key={s.label} style={{ background:"#ffffff", borderRadius:10, padding:"0.75rem", border:"1px solid #eeeeee", textAlign:"center" }}>
            <div style={{ fontFamily:"Syne", fontSize:isMobile?14:18, fontWeight:800, color:s.color }}>{s.value}</div>
            <div style={{ fontSize:10, color:"#777777", marginTop:2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display:"flex", gap:6, marginBottom:"1rem" }}>
        {[{k:"available",l:"Available jobs"},{k:"active",l:"My deliveries"},{k:"completed",l:"Completed"}].map(t=>(
          <button key={t.k} onClick={()=>setTab(t.k)}
            style={{ padding:"7px 14px", borderRadius:8, border:"none", fontSize:12, cursor:"pointer", background:tab===t.k?"#1d9e75":"#111", color:tab===t.k?"#fff":"#666", fontWeight:tab===t.k?700:400 }}>
            {t.l}
          </button>
        ))}
      </div>

      {loading&&<div style={{ color:"#777777", fontSize:13 }}>Loading...</div>}

      {tab==="available"&&(
        <div>
          {available.length===0&&<div style={{ color:"#888888", fontSize:13, textAlign:"center", padding:"2rem" }}>No delivery jobs available right now</div>}
          {available.map(o=>(
            <div key={o.id} style={{ background:"#ffffff", border:"1px solid #e6821e30", borderRadius:12, padding:"1rem", marginBottom:10 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
                <div>
                  <div style={{ fontSize:13, fontWeight:600, color:"#000000", marginBottom:2 }}>#{o.order_number}</div>
                  <div style={{ fontSize:11, color:"#777777" }}>📦 Pick up from: {o.provider?.business_name||o.provider?.first_name} · {o.provider?.city}</div>
                  <div style={{ fontSize:11, color:"#777777" }}>📍 Deliver to: {o.delivery_address}</div>
                  <div style={{ fontSize:11, color:"#378add" }}>Zone: {o.delivery_zone}</div>
                  <div style={{ fontSize:10, color:"#888888" }}>{o.order_items?.length} item(s)</div>
                </div>
                <div style={{ textAlign:"right" }}>
                  <div style={{ fontFamily:"Syne", fontSize:15, fontWeight:800, color:"#1d9e75" }}>KES {(Number(o.delivery_fee||0)*0.85).toLocaleString()}</div>
                  <div style={{ fontSize:10, color:"#777777" }}>Your earnings (85%)</div>
                </div>
              </div>
              <button onClick={()=>acceptDelivery(o.id)} style={{ width:"100%", background:"#1d9e75", border:"none", borderRadius:9, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:13, fontWeight:700, padding:"10px", cursor:"pointer" }}>
                ✓ Accept delivery
              </button>
            </div>
          ))}
        </div>
      )}

      {tab==="active"&&(
        <div>
          {activeDeliveries.length===0&&<div style={{ color:"#888888", fontSize:13, textAlign:"center", padding:"2rem" }}>No active deliveries</div>}
          {activeDeliveries.map(o=>(
            <div key={o.id} style={{ background:"#ffffff", border:"1px solid #378add30", borderRadius:12, padding:"1rem", marginBottom:10 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
                <div>
                  <div style={{ fontSize:13, fontWeight:600, color:"#000000", marginBottom:2 }}>#{o.order_number}</div>
                  <div style={{ fontSize:11, color:"#777777" }}>📦 {o.provider?.business_name||o.provider?.first_name} · {o.provider?.city}</div>
                  <div style={{ fontSize:11, color:"#777777" }}>📍 {o.delivery_address}</div>
                  <span style={{ fontSize:10, padding:"2px 8px", borderRadius:8, background:(SC[o.delivery_status]||"#888")+"20", color:SC[o.delivery_status]||"#888", display:"inline-block", marginTop:4 }}>
                    {o.delivery_status?.replace(/_/g," ")||"assigned"}
                  </span>
                </div>
                <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:800, color:"#1d9e75" }}>
                  KES {(Number(o.delivery_fee||0)*0.85).toLocaleString()}
                </div>
              </div>
              <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                {o.delivery_status==="driver_assigned"&&(
                  <button onClick={()=>updateDeliveryStatus(o.id,"picked_up",o.customer_id)} style={{ background:"#160a2e", border:"1px solid #8b5cf640", borderRadius:7, color:"#8b5cf6", fontSize:11, padding:"6px 14px", cursor:"pointer", fontWeight:600 }}>
                    📦 Confirm pickup
                  </button>
                )}
                {o.delivery_status==="picked_up"&&(
                  <button onClick={()=>updateDeliveryStatus(o.id,"delivered",o.customer_id)} style={{ background:"#071a12", border:"1px solid #1d9e7540", borderRadius:7, color:"#1d9e75", fontSize:11, padding:"6px 14px", cursor:"pointer", fontWeight:600 }}>
                    ✅ Confirm delivery
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab==="completed"&&(
        <div>
          {completedDeliveries.length===0&&<div style={{ color:"#888888", fontSize:13, textAlign:"center", padding:"2rem" }}>No completed deliveries yet</div>}
          {completedDeliveries.map(o=>(
            <div key={o.id} style={{ background:"#ffffff", border:"1px solid #1d9e7530", borderRadius:10, padding:"1rem", marginBottom:8 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div>
                  <div style={{ fontSize:13, fontWeight:600, color:"#000000" }}>#{o.order_number}</div>
                  <div style={{ fontSize:11, color:"#777777" }}>{o.delivery_zone} · {new Date(o.created_at).toLocaleDateString()}</div>
                </div>
                <div style={{ textAlign:"right" }}>
                  <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:800, color:"#1d9e75" }}>KES {(Number(o.delivery_fee||0)*0.85).toLocaleString()}</div>
                  <div style={{ fontSize:10, color:"#777777" }}>earned</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

