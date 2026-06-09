import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"
import { useAuth } from "../../contexts/AuthContext"
import useIsMobile from "../../lib/useIsMobile"
import toast from "react-hot-toast"
import ChatWindow from "../shared/ChatWindow"

const CATEGORIES = [
  { key:"all", label:"All", icon:"🔍" },
  { key:"parts", label:"Parts", icon:"⚙️" },
  { key:"accessories", label:"Accessories", icon:"✨" },
  { key:"tyres", label:"Tyres", icon:"🛞" },
  { key:"oils", label:"Oils & Fluids", icon:"🛢️" },
  { key:"electrical", label:"Electrical", icon:"⚡" },
  { key:"body", label:"Body Parts", icon:"🚗" },
  { key:"tools", label:"Tools", icon:"🔧" },
  { key:"other", label:"Other", icon:"📦" },
]

export default function CustomerPartsMarketplace() {
  const { user } = useAuth()
  const isMobile = useIsMobile()
  const [items, setItems] = useState([])
  const [providers, setProviders] = useState({})
  const [zones, setZones] = useState([])
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState("all")
  const [search, setSearch] = useState("")
  const [cart, setCart] = useState([])
  const [showCart, setShowCart] = useState(false)
  const [selectedItem, setSelectedItem] = useState(null)
  const [fulfillment, setFulfillment] = useState("pickup")
  const [selectedZone, setSelectedZone] = useState("")
  const [deliveryAddress, setDeliveryAddress] = useState("")
  const [ordering, setOrdering] = useState(false)
  const [orders, setOrders] = useState([])
  const [tab, setTab] = useState("browse")
  const [chatItem, setChatItem] = useState(null)
  const [checkoutStep, setCheckoutStep] = useState("cart") // cart, details, payment
  const [customerDetails, setCustomerDetails] = useState({ name:"", phone:"", email:"" })

  useEffect(() => {
    if (!user) return
    load()
    loadOrders()
    // Real-time inventory updates
    const sub = supabase.channel("marketplace-inventory")
      .on("postgres_changes", { event:"*", schema:"public", table:"inventory" }, () => load())
      .on("postgres_changes", { event:"*", schema:"public", table:"orders", filter:`customer_id=eq.${user.id}` }, () => loadOrders())
      .subscribe()
    return () => supabase.removeChannel(sub)
  }, [user])

  async function load() {
    const { data: inv } = await supabase.from("inventory")
      .select("*, profiles!inventory_provider_id_fkey(id,business_name,first_name,last_name,city,provider_type,is_verified)")
      .eq("is_active", true)
      .gt("stock_quantity", 0)
      .order("created_at", { ascending:false })
    const { data: zns } = await supabase.from("delivery_zones").select("*").eq("is_active", true)
    setItems(inv||[])
    setZones(zns||[])
    setLoading(false)
  }

  async function loadOrders() {
    const { data } = await supabase.from("orders")
      .select("*, order_items(*, inventory(name,unit)), profiles!orders_provider_id_fkey(business_name,first_name,last_name)")
      .eq("customer_id", user.id)
      .order("created_at", { ascending:false })
    setOrders(data||[])
  }

  function addToCart(item) {
    setCart(prev => {
      const existing = prev.find(c=>c.id===item.id)
      if (existing) return prev.map(c=>c.id===item.id?{...c,qty:c.qty+1}:c)
      return [...prev, {...item, qty:1}]
    })
    toast.success(item.name+" added to cart")
  }

  function removeFromCart(id) { setCart(prev=>prev.filter(c=>c.id!==id)) }
  function updateQty(id, qty) {
    if (qty<=0) return removeFromCart(id)
    setCart(prev=>prev.map(c=>c.id===id?{...c,qty}:c))
  }

  const cartTotal = cart.reduce((s,c)=>s+Number(c.price)*c.qty, 0)
  const zone = zones.find(z=>z.id===selectedZone)
  const deliveryFee = zone ? Number(zone.base_fee) : 0
  const orderTotal = cartTotal + (fulfillment==="delivery"?deliveryFee:0)

  // Group cart by provider
  const cartByProvider = cart.reduce((acc,item)=>{
    const pid = item.provider_id
    if (!acc[pid]) acc[pid] = []
    acc[pid].push(item)
    return acc
  }, {})

  async function loadOrders() {
    const { data } = await supabase.from("orders").select("*, order_items(*, inventory(name,unit))").eq("customer_id", user.id).order("created_at", { ascending:false })
    setOrders(data||[])
  }

  async function placeOrder() {
    if (cart.length===0) return toast.error("Cart is empty")
    if (fulfillment==="delivery"&&!selectedZone) return toast.error("Please select delivery zone")
    if (fulfillment==="delivery"&&!deliveryAddress) return toast.error("Please enter delivery address")
    setOrdering(true)
    try {
      for (const [providerId, providerItems] of Object.entries(cartByProvider)) {
        const subtotal = providerItems.reduce((s,i)=>s+Number(i.price)*i.qty,0)
        const commission = subtotal * 0.08
        const providerEarnings = subtotal - commission

        const { data: order, error } = await supabase.from("orders").insert({
          customer_id: user.id,
          provider_id: providerId,
          status: "pending",
          fulfillment_type: fulfillment,
          delivery_address: deliveryAddress||null,
          delivery_zone: zone?.name||null,
          subtotal,
          delivery_fee: fulfillment==="delivery"?deliveryFee:0,
          platform_commission: commission,
          provider_earnings: providerEarnings,
          payment_status: "pending",
        }).select().single()
        if (error) throw error

        await supabase.from("order_items").insert(
          providerItems.map(i=>({
            order_id: order.id,
            inventory_id: i.id,
            name: i.name,
            quantity: i.qty,
            unit_price: Number(i.price),
          }))
        )

        // Update stock
        for (const item of providerItems) {
          await supabase.from("inventory").update({
            stock_quantity: item.stock_quantity - item.qty
          }).eq("id", item.id)
        }

        // Notify provider
        await supabase.from("notifications").insert({
          user_id: providerId,
          title: "New order received! 🛒",
          message: `${providerItems.length} item(s) ordered. Total: KES ${subtotal.toLocaleString()}. ${fulfillment==="delivery"?"Delivery to "+deliveryAddress:"Customer pickup"}`,
          type: "success"
        })
      }

      toast.success("Order placed! Redirecting to payment...")
      setCart([])
      setShowCart(false)
      // Pay via Pesapal for first order
      const firstOrderId = Object.keys(cartByProvider)[0]
      const res = await fetch("https://gcnefnqtjxtqbhynyoxe.supabase.co/functions/v1/pesapal-payment", {
        method:"POST",
        headers:{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdjbmVmbnF0anh0cWJoeW55b3hlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2MDg0MzIsImV4cCI6MjA5NTE4NDQzMn0.Ybyce3psBj2I-hdoF95H5UAklr6hsgQi-mciI9uMIgc"},
        body:JSON.stringify({ amount:orderTotal, bookingId:firstOrderId, customerEmail:user.email||"", customerPhone:"", customerName:"" })
      })
      const order = await res.json()
      if (order.redirect_url) {
        sessionStorage.setItem("parts_order_id", firstOrderId)
        window.location.href = order.redirect_url
      } else {
        setTab("orders")
        loadOrders()
        load()
      }
    } catch(e) { toast.error(e.message) }
    finally { setOrdering(false) }
  }

  const filtered = items.filter(i=>{
    const matchCat = category==="all"||i.category===category
    const matchSearch = i.name.toLowerCase().includes(search.toLowerCase())||
      (i.brand||"").toLowerCase().includes(search.toLowerCase())||
      (i.compatible_cars||[]).some(c=>c.toLowerCase().includes(search.toLowerCase()))
    return matchCat&&matchSearch
  })

  const SC = { pending:"#e6821e", confirmed:"#378add", processing:"#8b5cf6", ready:"#1d9e75", delivered:"#1d9e75", cancelled:"#e24b4a" }
  async function loadOrders() {
    const { data } = await supabase.from("orders").select("*, order_items(*, inventory(name,unit))").eq("customer_id", user.id).order("created_at", { ascending:false })
    setOrders(data||[])
  }

  async function placeOrder() {
    if (cart.length === 0) return toast.error("Cart is empty")
    if (checkoutStep === "cart") { setCheckoutStep("details"); return }
    if (checkoutStep === "details") {
      if (!customerDetails.name) return toast.error("Please enter your name")
      if (!customerDetails.phone) return toast.error("Please enter your phone")
      if (fulfillment === "delivery" && !selectedZone) return toast.error("Please select a delivery zone")
      if (fulfillment === "delivery" && !deliveryAddress) return toast.error("Please enter delivery address")
      setCheckoutStep("payment"); return
    }
    setOrdering(true)
    try {
      const zone = zones.find(z => z.id === selectedZone)
      const deliveryFee = fulfillment === "delivery" && zone ? Number(zone.base_fee) : 0
      const subtotal = cart.reduce((s, i) => s + Number(i.price) * i.qty, 0)
      const total = subtotal + deliveryFee
      // Group cart by provider
      const byProvider = {}
      cart.forEach(item => {
        if (!byProvider[item.provider_id]) byProvider[item.provider_id] = []
        byProvider[item.provider_id].push(item)
      })
      for (const [providerId, items] of Object.entries(byProvider)) {
        const providerTotal = items.reduce((s, i) => s + Number(i.price) * i.qty, 0)
        const { data: order, error } = await supabase.from("orders").insert({
          customer_id: user.id,
          provider_id: providerId,
          total_amount: providerTotal + (Object.keys(byProvider).length === 1 ? deliveryFee : 0),
          fulfillment_type: fulfillment,
          delivery_zone_id: selectedZone || null,
          delivery_address: deliveryAddress || null,
          delivery_fee: deliveryFee,
          customer_name: customerDetails.name,
          customer_phone: customerDetails.phone,
          payment_method: "cash",
          status: "pending",
        }).select("id").single()
        if (error) throw error
        for (const item of items) {
          await supabase.from("order_items").insert({
            order_id: order.id,
            inventory_id: item.id,
            quantity: item.qty,
            unit_price: Number(item.price),
            total_price: Number(item.price) * item.qty,
          })
          await supabase.from("inventory").update({ stock_quantity: item.stock_quantity - item.qty }).eq("id", item.id)
        }
        await supabase.from("notifications").insert({
          user_id: providerId,
          title: "New order received! 📦",
          message: `${customerDetails.name} ordered ${items.length} item(s) — KES ${providerTotal.toLocaleString()}`,
          type: "success",
        })
      }
      toast.success("Order placed successfully! 🎉")
      setCart([])
      setShowCart(false)
      setCheckoutStep("cart")
      setCustomerDetails({ name: "", phone: "", email: "" })
      setDeliveryAddress("")
      setSelectedZone("")
      loadOrders()
    } catch(err) { toast.error(err.message) }
    finally { setOrdering(false) }
  }


  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"1.25rem", flexWrap:"wrap", gap:10 }}>
        <div>
          <div style={{ fontFamily:"Syne", fontSize:isMobile?16:20, fontWeight:800, color:"#000000" }}>Parts & Accessories</div>
          <div style={{ fontSize:12, color:"#777777" }}>Order from verified CCC shops</div>
        </div>
        <button onClick={()=>setShowCart(true)} style={{ background:cart.length>0?"#e6821e":"#f5f5f5", border:"1px solid #e0e0e0", borderRadius:9, color:cart.length>0?"#fff":"#666", fontFamily:"Syne,sans-serif", fontSize:13, fontWeight:700, padding:"9px 16px", cursor:"pointer", position:"relative" }}>
          🛒 Cart {cart.length>0&&`(${cart.length})`}
          {cart.length>0&&<span style={{ position:"absolute", top:-6, right:-6, width:16, height:16, borderRadius:"50%", background:"#e24b4a", fontSize:9, color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:800 }}>{cart.reduce((s,c)=>s+c.qty,0)}</span>}
        </button>
      </div>

      <div style={{ display:"flex", gap:6, marginBottom:"1rem" }}>
        {[{k:"browse",l:"Browse"},{k:"orders",l:"My Orders"}].map(t=>(
          <button key={t.k} onClick={()=>setTab(t.k)}
            style={{ padding:"7px 16px", borderRadius:8, border:"none", fontSize:12, cursor:"pointer", background:tab===t.k?"#e6821e":"#f0f0f0", color:tab===t.k?"#fff":"#555", fontWeight:tab===t.k?700:400 }}>
            {t.l} {t.k==="orders"&&orders.length>0&&`(${orders.length})`}
          </button>
        ))}
      </div>

      {tab==="browse"&&(
        <>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search parts, accessories, brand, car model..."
            style={{ width:"100%", background:"#ffffff", border:"1px solid #e5e5e5", borderRadius:8, padding:"9px 12px", color:"#000000", fontSize:12, outline:"none", marginBottom:"1rem" }}/>
          <div style={{ display:"flex", gap:6, marginBottom:"1rem", flexWrap:"wrap" }}>
            {CATEGORIES.map(c=>(
              <button key={c.key} onClick={()=>setCategory(c.key)}
                style={{ padding:"5px 10px", borderRadius:7, border:"none", fontSize:11, cursor:"pointer", background:category===c.key?"#e6821e":"#f0f0f0", color:category===c.key?"#fff":"#555" }}>
                {c.icon} {c.label}
              </button>
            ))}
          </div>

          {loading&&<div style={{ color:"#777777", fontSize:13 }}>Loading...</div>}
          {!loading&&filtered.length===0&&<div style={{ color:"#888888", fontSize:13, textAlign:"center", padding:"2rem" }}>No items found</div>}

          <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"repeat(2,1fr)", gap:12 }}>
            {filtered.map(item=>(
              <div key={item.id} style={{ background:"#ffffff", border:"1px solid #eeeeee", borderRadius:12, overflow:"hidden" }}>
                {item.photos?.[0]&&(
                  <img src={item.photos[0]} alt={item.name} style={{ width:"100%", height:140, objectFit:"cover" }}/>
                )}
                <div style={{ padding:"1rem" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:10, marginBottom:8 }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13, fontWeight:600, color:"#000000", marginBottom:4 }}>{item.name}</div>
                    {item.brand&&<div style={{ fontSize:11, color:"#555555", marginBottom:2 }}>Brand: {item.brand}</div>}
                    {item.compatible_cars?.length>0&&<div style={{ fontSize:10, color:"#777777", marginBottom:2 }}>🚗 {item.compatible_cars.slice(0,3).join(", ")}{item.compatible_cars.length>3?"...":""}</div>}
                    {item.description&&<div style={{ fontSize:11, color:"#777777", marginBottom:4, lineHeight:1.5 }}>{item.description}</div>}
                    <div style={{ fontSize:11, color:"#777777" }}>
                      🏪 {item.profiles?.business_name||`${item.profiles?.first_name} ${item.profiles?.last_name}`}
                      {item.profiles?.city?` · ${item.profiles.city}`:""}
                      {item.profiles?.is_verified&&<span style={{ color:"#1d9e75", marginLeft:4 }}>✓</span>}
                    </div>
                  </div>
                  <div style={{ textAlign:"right", flexShrink:0 }}>
                    <div style={{ fontFamily:"Syne", fontSize:15, fontWeight:800, color:"#e6821e" }}>KES {Number(item.price).toLocaleString()}</div>
                    <div style={{ fontSize:10, color:"#777777" }}>/{item.unit}</div>
                    <div style={{ fontSize:10, color:item.stock_quantity<=5?"#e24b4a":"#1d9e75", marginTop:4 }}>{item.stock_quantity} in stock</div>
                  </div>
                </div>
                <button onClick={()=>addToCart(item)} disabled={item.stock_quantity===0}
                  style={{ width:"100%", background:item.stock_quantity===0?"#333":"#e6821e", border:"none", borderRadius:8, color:item.stock_quantity===0?"#555":"#fff", fontFamily:"Syne,sans-serif", fontSize:12, fontWeight:700, padding:"9px", cursor:item.stock_quantity===0?"not-allowed":"pointer" }}>
                  {item.stock_quantity===0?"Out of stock":"+ Add to cart"}
                </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {tab==="orders"&&(
        <div>
          {orders.length===0&&<div style={{ color:"#888888", fontSize:13, textAlign:"center", padding:"2rem" }}>No orders yet</div>}
          {orders.map(o=>(
            <div key={o.id} style={{ background:"#ffffff", border:"1px solid #eeeeee", borderRadius:10, padding:"1rem", marginBottom:8 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
                <div>
                  <div style={{ fontSize:13, fontWeight:600, color:"#000000" }}>#{o.order_number}</div>
                  <div style={{ fontSize:11, color:"#777777" }}>{o.profiles?.business_name||o.profiles?.first_name} · {o.fulfillment_type}</div>
                  <div style={{ fontSize:10, color:"#888888" }}>{new Date(o.created_at).toLocaleString()}</div>
                </div>
                <div style={{ textAlign:"right" }}>
                  <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:800, color:"#e6821e" }}>KES {Number(o.subtotal||0).toLocaleString()}</div>
                  <span style={{ fontSize:10, padding:"2px 8px", borderRadius:10, background:(SC[o.status]||"#888")+"20", color:SC[o.status]||"#888" }}>{o.status}</span>
                </div>
              </div>
              {o.order_items?.map(oi=>(
                <div key={oi.id} style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:"#666", padding:"4px 0", borderTop:"1px solid #eeeeee" }}>
                  <span>{oi.name} x{oi.quantity}</span>
                  <span>KES {Number(oi.unit_price*oi.quantity).toLocaleString()}</span>
                </div>
              ))}
              {o.delivery_zone&&<div style={{ fontSize:11, color:"#378add", marginTop:4 }}>📍 Delivery: {o.delivery_zone} · KES {Number(o.delivery_fee||0).toLocaleString()}</div>}
            </div>
          ))}
        </div>
      )}

      {chatItem&&(
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", zIndex:200, display:"flex", alignItems:"flex-end", justifyContent:"center" }}>
          <div style={{ width:"100%", maxWidth:500, background:"#fff", borderRadius:"16px 16px 0 0", height:"70vh", display:"flex", flexDirection:"column", overflow:"hidden" }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"1rem", borderBottom:"1px solid #eee", flexShrink:0 }}>
              <div>
                <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:800, color:"#000" }}>{chatItem.name}</div>
                <div style={{ fontSize:11, color:"#888" }}>Chat with {chatItem.profiles?.business_name||chatItem.profiles?.first_name}</div>
              </div>
              <button onClick={()=>setChatItem(null)} style={{ background:"#f5f5f5", border:"none", borderRadius:"50%", width:32, height:32, cursor:"pointer", fontSize:18 }}>×</button>
            </div>
            <div style={{ flex:1, minHeight:0 }}>
              <ChatWindow
                listingId={chatItem.id}
                otherUserId={chatItem.provider_id}
                otherUserName={chatItem.profiles?.business_name||chatItem.profiles?.first_name||"Seller"}
                onClose={()=>setChatItem(null)}
              />
            </div>
          </div>
        </div>
      )}
      {showCart&&(
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.85)", zIndex:200, display:"flex", alignItems:"flex-end", justifyContent:"center" }}>
          <div style={{ width:"100%", maxWidth:500, background:"#ffffff", borderRadius:"16px 16px 0 0", padding:"1.5rem", maxHeight:"85vh", overflowY:"auto" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"1.25rem" }}>
              <div>
              <div style={{ fontFamily:"Syne", fontSize:16, fontWeight:800, color:"#000000" }}>
                {checkoutStep==="cart"?"🛒 Your cart":checkoutStep==="details"?"📋 Delivery details":"💳 Payment"}
              </div>
              <div style={{ display:"flex", gap:4, marginTop:4 }}>
                {["cart","details","payment"].map((s,i)=>(
                  <div key={s} style={{ flex:1, height:3, borderRadius:2, background:checkoutStep===s||["details","payment"].includes(checkoutStep)&&i===0||checkoutStep==="payment"&&i===1?"#e6821e":"#e0e0e0" }}/>
                ))}
              </div>
            </div>
              <button onClick={()=>{ setShowCart(false); setCheckoutStep("cart") }} style={{ background:"none", border:"none", color:"#777777", fontSize:22, cursor:"pointer" }}>×</button>
            </div>

            {cart.length===0&&<div style={{ color:"#888888", textAlign:"center", padding:"2rem" }}>Cart is empty</div>}

            {cart.map(item=>(
              <div key={item.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 0", borderBottom:"1px solid #eeeeee" }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, color:"#000000" }}>{item.name}</div>
                  <div style={{ fontSize:11, color:"#777777" }}>KES {Number(item.price).toLocaleString()} / {item.unit}</div>
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <button onClick={()=>updateQty(item.id,item.qty-1)} style={{ background:"#f5f5f5", border:"none", borderRadius:6, color:"#000000", width:26, height:26, cursor:"pointer", fontSize:14 }}>−</button>
                  <span style={{ fontSize:13, color:"#000000", minWidth:20, textAlign:"center" }}>{item.qty}</span>
                  <button onClick={()=>updateQty(item.id,item.qty+1)} style={{ background:"#f5f5f5", border:"none", borderRadius:6, color:"#000000", width:26, height:26, cursor:"pointer", fontSize:14 }}>+</button>
                  <span style={{ fontSize:12, color:"#e6821e", fontWeight:600, minWidth:60, textAlign:"right" }}>KES {(Number(item.price)*item.qty).toLocaleString()}</span>
                </div>
              </div>
            ))}

            {cart.length>0&&(
              <>
                <div style={{ marginTop:"1rem", marginBottom:"1rem" }}>
                  <div style={{ fontSize:12, color:"#666", marginBottom:8 }}>Fulfillment</div>
                  <div style={{ display:"flex", gap:8 }}>
                    {["pickup","delivery"].map(f=>(
                      <button key={f} onClick={()=>setFulfillment(f)}
                        style={{ flex:1, padding:"8px", borderRadius:8, border:"1px solid "+(fulfillment===f?"#e6821e":"#e0e0e0"), background:fulfillment===f?"#fff8f0":"#f5f5f5", color:fulfillment===f?"#e6821e":"#555", fontSize:12, cursor:"pointer", fontWeight:fulfillment===f?700:400 }}>
                        {f==="pickup"?"🏪 Pickup from shop":"🚚 Delivery to me"}
                      </button>
                    ))}
                  </div>
                </div>

                {checkoutStep==="details"&&(
                  <div style={{ marginBottom:12 }}>
                    <div style={{ fontFamily:"Syne", fontSize:13, fontWeight:700, color:"#000000", marginBottom:10 }}>Your details</div>
                    <div style={{ marginBottom:8 }}>
                      <div style={{ fontSize:11, color:"#666", marginBottom:4 }}>Full name</div>
                      <input value={customerDetails.name} onChange={e=>setCustomerDetails(d=>({...d,name:e.target.value}))}
                        placeholder="Your full name"
                        style={{ width:"100%", background:"#ffffff", border:"1px solid #e5e5e5", borderRadius:8, padding:"9px 12px", color:"#000000", fontSize:12, outline:"none" }}/>
                    </div>
                    <div style={{ marginBottom:8 }}>
                      <div style={{ fontSize:11, color:"#666", marginBottom:4 }}>Phone number</div>
                      <input value={customerDetails.phone} onChange={e=>setCustomerDetails(d=>({...d,phone:e.target.value}))}
                        placeholder="0712 345 678"
                        style={{ width:"100%", background:"#ffffff", border:"1px solid #e5e5e5", borderRadius:8, padding:"9px 12px", color:"#000000", fontSize:12, outline:"none" }}/>
                    </div>
                  </div>
                )}
                {fulfillment==="delivery"&&(
                  <>
                    <div style={{ marginBottom:8 }}>
                      <div style={{ fontSize:11, color:"#666", marginBottom:4 }}>Delivery zone</div>
                      <select value={selectedZone} onChange={e=>setSelectedZone(e.target.value)}
                        style={{ width:"100%", background:"#ffffff", border:"1px solid #e5e5e5", borderRadius:8, padding:"9px 12px", color:"#000000", fontSize:12, outline:"none" }}>
                        <option value="">Select zone...</option>
                        {zones.map(z=><option key={z.id} value={z.id}>{z.name} — KES {Number(z.base_fee).toLocaleString()}</option>)}
                      </select>
                    </div>
                    <div style={{ marginBottom:8 }}>
                      <div style={{ fontSize:11, color:"#666", marginBottom:4 }}>Delivery address</div>
                      <input value={deliveryAddress} onChange={e=>setDeliveryAddress(e.target.value)} placeholder="Your full delivery address..."
                        style={{ width:"100%", background:"#ffffff", border:"1px solid #e5e5e5", borderRadius:8, padding:"9px 12px", color:"#000000", fontSize:12, outline:"none" }}/>
                    </div>
                  </>
                )}

                <div style={{ borderTop:"1px solid #eeeeee", paddingTop:"1rem", marginTop:"0.5rem" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, color:"#666", marginBottom:4 }}>
                    <span>Subtotal</span><span>KES {cartTotal.toLocaleString()}</span>
                  </div>
                  {fulfillment==="delivery"&&zone&&(
                    <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, color:"#666", marginBottom:4 }}>
                      <span>Delivery fee</span><span>KES {deliveryFee.toLocaleString()}</span>
                    </div>
                  )}
                  <div style={{ display:"flex", justifyContent:"space-between", fontFamily:"Syne", fontSize:15, fontWeight:800, color:"#e6821e", marginBottom:"1rem" }}>
                    <span>Total</span><span>KES {orderTotal.toLocaleString()}</span>
                  </div>
                  <button onClick={placeOrder} disabled={ordering}
                    style={{ width:"100%", background:ordering?"#ccc":"#e6821e", border:"none", borderRadius:10, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:14, fontWeight:700, padding:"14px", cursor:ordering?"not-allowed":"pointer" }}>
                    {ordering?"Placing order...":"Place order →"}
                  </button>
                  <div style={{ fontSize:11, color:"#888888", textAlign:"center", marginTop:8 }}>Payment collected on delivery/pickup</div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}









