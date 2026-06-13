import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"
import useIsMobile from "../../lib/useIsMobile"
import toast from "react-hot-toast"

const SC = { pending:"#e6821e", confirmed:"#378add", processing:"#8b5cf6", ready:"#1d9e75", delivered:"#1d9e75", cancelled:"#e24b4a" }

export default function AdminOrders() {
  const isMobile = useIsMobile()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState("all")
  const [zones, setZones] = useState([])
  const [showZones, setShowZones] = useState(false)
  const [zoneForm, setZoneForm] = useState({ name:"", base_fee:"", per_km_fee:"" })

  useEffect(() => { load(); loadZones() }, [])

  async function load() {
    const { data } = await supabase.from("orders")
      .select("*, order_items(name,quantity,unit_price), profiles!orders_customer_id_fkey(first_name,last_name), provider:profiles!orders_provider_id_fkey(first_name,last_name,business_name), driver:profiles!orders_delivery_driver_id_fkey(first_name,last_name,driver_vehicle_type)")
      .order("created_at", { ascending:false })
    setOrders(data||[])
    setLoading(false)
  }

  async function loadZones() {
    const { data } = await supabase.from("delivery_zones").select("*").order("name")
    setZones(data||[])
  }

  async function addZone(e) {
    e.preventDefault()
    await supabase.from("delivery_zones").insert({
      name: zoneForm.name,
      base_fee: Number(zoneForm.base_fee),
      per_km_fee: Number(zoneForm.per_km_fee),
    })
    toast.success("Zone added")
    setZoneForm({ name:"", base_fee:"", per_km_fee:"" })
    loadZones()
  }

  async function toggleZone(id, active) {
    await supabase.from("delivery_zones").update({ is_active:!active }).eq("id", id)
    loadZones()
  }

  async function assignDriver(orderId) {
    const order = orders.find(o=>o.id===orderId)
    const itemCount = order?.order_items?.length||1
    const preferredType = itemCount<=3?"motorcycle":itemCount<=6?"tuktuk":"van"
    const { data: drivers } = await supabase.from("profiles")
      .select("id,first_name,last_name,driver_vehicle_type")
      .eq("role","driver")
      .eq("is_active",true)
      .eq("documents_verified",true)
    if (!drivers?.length) return toast.error("No verified drivers available")
    const preferred = drivers.filter(d=>d.driver_vehicle_type===preferredType)
    const driver = preferred.length>0 ? preferred[0] : drivers[0]
    await supabase.from("orders").update({ delivery_driver_id:driver.id, delivery_status:"driver_assigned" }).eq("id", orderId)
    await supabase.from("notifications").insert({
      user_id: driver.id,
      title: "🚚 Delivery assigned by admin!",
      message: "New delivery: "+itemCount+" item(s) to "+order?.delivery_address+". Zone: "+order?.delivery_zone,
      type: "success"
    })
    toast.success("Smart match: "+driver.first_name+" ("+driver.driver_vehicle_type+")")
    load()
  }

  const filtered = filter==="all" ? orders : orders.filter(o=>o.status===filter)
  const totalRevenue = orders.filter(o=>o.status==="delivered").reduce((s,o)=>s+Number(o.platform_commission||0),0)
  const pendingOrders = orders.filter(o=>o.status==="pending").length
  const todayOrders = orders.filter(o=>new Date(o.created_at).toDateString()===new Date().toDateString()).length

  const inp = { width:"100%", background:"#ffffff", border:"1px solid #222", borderRadius:8, padding:"9px 12px", color:"#000000", fontSize:12, outline:"none", fontFamily:"DM Sans,sans-serif", marginBottom:8 }

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"1.25rem", flexWrap:"wrap", gap:10 }}>
        <div>
          <div style={{ fontFamily:"Syne", fontSize:isMobile?16:20, fontWeight:800, color:"#000000" }}>Orders Management</div>
          <div style={{ fontSize:12, color:"#888" }}>Parts and accessories orders across platform</div>
        </div>
        <button onClick={()=>setShowZones(!showZones)}
          style={{ background:"#f5f3ff", border:"1px solid #8b5cf640", borderRadius:9, color:"#8b5cf6", fontFamily:"Syne,sans-serif", fontSize:13, fontWeight:700, padding:"9px 16px", cursor:"pointer" }}>
          📍 Delivery zones
        </button>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:"1.5rem" }}>
        {[
          { label:"Total orders", value:orders.length, color:"#000000" },
          { label:"Pending", value:pendingOrders, color:pendingOrders>0?"#e6821e":"#555" },
          { label:"Today", value:todayOrders, color:"#378add" },
          { label:"Platform revenue", value:"KES "+totalRevenue.toLocaleString(), color:"#1d9e75" },
        ].map(s=>(
          <div key={s.label} style={{ background:"#f8f8f8", borderRadius:10, padding:"0.75rem", border:"1px solid #eeeeee", textAlign:"center" }}>
            <div style={{ fontFamily:"Syne", fontSize:isMobile?13:17, fontWeight:800, color:s.color }}>{s.value}</div>
            <div style={{ fontSize:9, color:"#888", marginTop:2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {showZones&&(
        <div style={{ background:"#f8f8f8", border:"1px solid #8b5cf630", borderRadius:12, padding:"1.25rem", marginBottom:"1.5rem" }}>
          <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:700, color:"#8b5cf6", marginBottom:"1rem" }}>📍 Delivery Zones</div>
          <form onSubmit={addZone} style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr auto", gap:8, marginBottom:"1rem", alignItems:"end" }}>
            <div><label style={{ fontSize:10, color:"#888", display:"block", marginBottom:3 }}>Zone name</label><input style={inp} value={zoneForm.name} onChange={e=>setZoneForm(f=>({...f,name:e.target.value}))} placeholder="e.g. Westlands" required/></div>
            <div><label style={{ fontSize:10, color:"#888", display:"block", marginBottom:3 }}>Base fee (KES)</label><input type="number" style={inp} value={zoneForm.base_fee} onChange={e=>setZoneForm(f=>({...f,base_fee:e.target.value}))} required/></div>
            <div><label style={{ fontSize:10, color:"#888", display:"block", marginBottom:3 }}>Per km (KES)</label><input type="number" style={inp} value={zoneForm.per_km_fee} onChange={e=>setZoneForm(f=>({...f,per_km_fee:e.target.value}))} required/></div>
            <button type="submit" style={{ background:"#8b5cf6", border:"none", borderRadius:8, color:"#fff", fontSize:12, fontWeight:700, padding:"9px 16px", cursor:"pointer", marginBottom:8 }}>Add</button>
          </form>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))", gap:8 }}>
            {zones.map(z=>(
              <div key={z.id} style={{ background:"#ffffff", borderRadius:8, padding:"0.75rem", border:"1px solid "+(z.is_active?"#1d9e7530":"#eeeeee"), opacity:z.is_active?1:0.6 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <div style={{ fontSize:12, fontWeight:600, color:"#000000" }}>{z.name}</div>
                  <button onClick={()=>toggleZone(z.id,z.is_active)} style={{ background:"none", border:"none", fontSize:10, color:z.is_active?"#e24b4a":"#1d9e75", cursor:"pointer" }}>{z.is_active?"Disable":"Enable"}</button>
                </div>
                <div style={{ fontSize:11, color:"#888", marginTop:4 }}>Base: KES {Number(z.base_fee).toLocaleString()} · Per km: KES {Number(z.per_km_fee).toLocaleString()}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display:"flex", gap:6, marginBottom:"1rem", flexWrap:"wrap" }}>
        {["all","pending","confirmed","processing","ready","delivered","cancelled"].map(f=>(
          <button key={f} onClick={()=>setFilter(f)}
            style={{ padding:"5px 12px", borderRadius:7, border:"none", fontSize:11, cursor:"pointer", background:filter===f?(SC[f]||"#8b5cf6"):"#f8f8f8", color:filter===f?"#fff":"#666" }}>
            {f} ({f==="all"?orders.length:orders.filter(o=>o.status===f).length})
          </button>
        ))}
      </div>

      {loading&&<div style={{ color:"#888", fontSize:13 }}>Loading...</div>}
      {!loading&&filtered.length===0&&<div style={{ color:"#888", fontSize:13, textAlign:"center", padding:"2rem" }}>No orders found</div>}

      {filtered.map(o=>(
        <div key={o.id} style={{ background:"#f8f8f8", border:"1px solid "+(SC[o.status]||"#eeeeee")+"30", borderRadius:10, padding:"1rem", marginBottom:8 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
            <div>
              <div style={{ fontSize:13, fontWeight:600, color:"#000000" }}>#{o.order_number}</div>
              <div style={{ fontSize:11, color:"#888" }}>👤 {o.profiles?.first_name} {o.profiles?.last_name}</div>
              <div style={{ fontSize:11, color:"#888" }}>🏪 {o.provider?.business_name||o.provider?.first_name}</div>
              {o.delivery_driver_id&&<div style={{ fontSize:11, color:"#378add" }}>🚚 Driver: {o.driver?.first_name} {o.driver?.last_name} ({o.driver?.driver_vehicle_type})</div>}
              <div style={{ fontSize:11, color:"#888" }}>{o.fulfillment_type==="delivery"?"🚚 "+o.delivery_address:"🏪 Pickup"}</div>
              {o.delivery_zone&&<div style={{ fontSize:10, color:"#378add" }}>Zone: {o.delivery_zone}</div>}
              <div style={{ fontSize:10, color:"#888" }}>{new Date(o.created_at).toLocaleString()}</div>
            </div>
            <div style={{ textAlign:"right" }}>
              <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:800, color:"#e6821e" }}>KES {Number(o.subtotal||0).toLocaleString()}</div>
              <div style={{ fontSize:10, color:"#1d9e75" }}>Commission: KES {Number(o.platform_commission||0).toLocaleString()}</div>
              <span style={{ fontSize:10, padding:"2px 8px", borderRadius:10, background:(SC[o.status]||"#888")+"20", color:SC[o.status]||"#888", display:"inline-block", marginTop:4 }}>{o.status}</span>
            </div>
          </div>
          <div style={{ background:"#ffffff", borderRadius:8, padding:"0.6rem", marginBottom:8 }}>
            {o.order_items?.map((oi,i)=>(
              <div key={i} style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:"#888", padding:"2px 0" }}>
                <span>{oi.name} × {oi.quantity}</span>
                <span>KES {Number(oi.unit_price*oi.quantity).toLocaleString()}</span>
              </div>
            ))}
          </div>
          {o.status==="ready"&&o.fulfillment_type==="delivery"&&!o.delivery_driver_id&&(
            <button onClick={()=>assignDriver(o.id)} style={{ background:"#eff6ff", border:"1px solid #378add40", borderRadius:7, color:"#378add", fontSize:11, padding:"5px 12px", cursor:"pointer" }}>
              🚚 Assign driver
            </button>
          )}
        </div>
      ))}
    </div>
  )
}

