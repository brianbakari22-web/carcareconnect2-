import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"
import { useAuth } from "../../contexts/AuthContext"
import useIsMobile from "../../lib/useIsMobile"
import toast from "react-hot-toast"
import ChatWindow from "../shared/ChatWindow"
import PhotoLightbox from "../shared/PhotoLightbox"

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

const SC = { pending:"#e6821e", confirmed:"#378add", processing:"#8b5cf6", ready:"#1d9e75", delivered:"#1d9e75", cancelled:"#e24b4a" }

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
  const [reviewOrder, setReviewOrder] = useState(null)
  const [reviewRating, setReviewRating] = useState(5)
  const [reviewText, setReviewText] = useState("")
  const [submittingReview, setSubmittingReview] = useState(false)
  const [myReviews, setMyReviews] = useState({})
  const [checkoutStep, setCheckoutStep] = useState("cart") // cart, details, payment
  const [customerDetails, setCustomerDetails] = useState({ name:"", phone:"", email:"" })
  const [paymentMethod, setPaymentMethod] = useState("pesapal")
  const [lightbox, setLightbox] = useState({ open:false, photos:[], index:0 })

  useEffect(() => {
    if (!user) return
    load()
    loadOrders()
    loadMyReviews()
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

  async function loadMyReviews() {
    const { data } = await supabase.from("reviews").select("order_id,provider_rating").eq("customer_id", user.id).not("order_id","is",null)
    const map = {}
    ;(data||[]).forEach(r => { map[r.order_id] = r.provider_rating })
    setMyReviews(map)
  }

  async function submitOrderReview() {
    if (!reviewOrder) return
    setSubmittingReview(true)
    try {
      await supabase.from("reviews").insert({
        order_id: reviewOrder.id,
        customer_id: user.id,
        provider_id: reviewOrder.provider_id,
        provider_rating: reviewRating,
        provider_review: reviewText||null
      })
      await supabase.from("notifications").insert({
        user_id: reviewOrder.provider_id,
        title: "New review received! ⭐",
        message: reviewRating+" star review for order #"+reviewOrder.order_number+(reviewText?": \""+reviewText+"\"":""),
        type: "info"
      })
      toast.success("Thank you for your review!")
      setReviewOrder(null)
      setReviewRating(5)
      setReviewText("")
      loadMyReviews()
    } catch(e) { toast.error(e.message) }
    finally { setSubmittingReview(false) }
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

      const { data: rateRow } = await supabase.from("commission_rates").select("platform_rate").eq("provider_type","parts_dealer").maybeSingle()
      const commissionRate = rateRow ? Number(rateRow.platform_rate) : 0.05

      const byProvider = {}
      cart.forEach(item => {
        if (!byProvider[item.provider_id]) byProvider[item.provider_id] = []
        byProvider[item.provider_id].push(item)
      })

      let firstOrderId = null
      let firstOrderTotal = 0

      for (const [providerId, items] of Object.entries(byProvider)) {
        const subtotal = items.reduce((s, i) => s + Number(i.price) * i.qty, 0)
        const commission = subtotal * commissionRate
        const providerEarnings = subtotal - commission
        const orderDeliveryFee = Object.keys(byProvider).length === 1 ? deliveryFee : 0

        const { data: order, error } = await supabase.from("orders").insert({
          customer_id: user.id,
          provider_id: providerId,
          subtotal,
          delivery_fee: orderDeliveryFee,
          platform_commission: commission,
          provider_earnings: providerEarnings,
          fulfillment_type: fulfillment,
          delivery_zone: zone?.name || null,
          delivery_address: deliveryAddress || null,
          customer_name: customerDetails.name,
          customer_phone: customerDetails.phone,
          payment_method: paymentMethod,
          payment_status: paymentMethod === "cash" ? "pending" : "awaiting_payment",
          status: "pending",
        }).select("id").single()
        if (error) throw error

        for (const item of items) {
          await supabase.from("order_items").insert({
            order_id: order.id,
            inventory_id: item.id,
            name: item.name,
            quantity: item.qty,
            unit_price: Number(item.price),
          })
          // Decrement stock immediately to prevent overselling
          await supabase.from("inventory").update({ stock_quantity: item.stock_quantity - item.qty }).eq("id", item.id)
        }

        await supabase.from("notifications").insert({
          user_id: providerId,
          title: "New order received! 📦",
          message: `${customerDetails.name} ordered ${items.length} item(s) — KES ${subtotal.toLocaleString()} (${paymentMethod === "cash" ? "Cash on delivery" : "Paid online"})`,
          type: "success",
        })
        // Notify customer
        await supabase.from("notifications").insert({ user_id: user.id, title: "Order placed! 🛒", message: `Your order of ${items.length} item(s) worth KES ${subtotal.toLocaleString()} has been placed successfully.`, type: "success" })

        // Cash orders: accrue platform commission owed by provider, payable monthly
        if (paymentMethod === "cash") {
          const { data: prov } = await supabase.from("profiles").select("cash_commission_balance").eq("id", providerId).single()
          const newBalance = Number(prov?.cash_commission_balance || 0) + commission
          await supabase.from("profiles").update({
            cash_commission_balance: newBalance,
            cash_commission_due_date: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 5).toISOString().split("T")[0],
          }).eq("id", providerId)
        }

        if (!firstOrderId) {
          firstOrderId = order.id
          firstOrderTotal = subtotal + orderDeliveryFee
        }
      }

      setCart([])
      setShowCart(false)
      setCheckoutStep("cart")
      setCustomerDetails({ name: "", phone: "", email: "" })
      setDeliveryAddress("")
      setSelectedZone("")

      if (paymentMethod === "cash") {
        toast.success("Order placed! Pay cash on delivery/pickup. 🎉")
        loadOrders()
      } else {
        toast.success("Order placed! Redirecting to payment...")
        const res = await fetch("https://gcnefnqtjxtqbhynyoxe.supabase.co/functions/v1/pesapal-payment", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdjbmVmbnF0anh0cWJoeW55b3hlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2MDg0MzIsImV4cCI6MjA5NTE4NDQzMn0.Ybyce3psBj2I-hdoF95H5UAklr6hsgQi-mciI9uMIgc" },
          body: JSON.stringify({ amount: firstOrderTotal, bookingId: firstOrderId, customerEmail: user.email || "", customerPhone: customerDetails.phone, customerName: customerDetails.name })
        })
        const payRes = await res.json()
        if (payRes.redirect_url) {
          sessionStorage.setItem("parts_order_id", firstOrderId)
          window.location.href = payRes.redirect_url
        } else {
          setTab("orders")
          loadOrders()
        }
      }
    } catch(err) { toast.error(err.message) }
    finally { setOrdering(false) }
  }


  const filtered = items.filter(item => {
    if (!item.is_active) return false
    if (category !== "all" && item.category !== category) return false
    if (search) {
      const q = search.toLowerCase()
      const matchName = item.name?.toLowerCase().includes(q)
      const matchBrand = item.brand?.toLowerCase().includes(q)
      const matchDesc = item.description?.toLowerCase().includes(q)
      if (!matchName && !matchBrand && !matchDesc) return false
    }
    return true
  })

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

          {!loading&&filtered.length>0&&<div style={{ fontSize:11, color:"#888", marginBottom:"0.75rem" }}>{filtered.length} item{filtered.length!==1?"s":""} found</div>}
          {loading&&<div style={{ color:"#777777", fontSize:13 }}>Loading...</div>}
          {!loading&&filtered.length===0&&(
            <div style={{ textAlign:"center", padding:"3rem", color:"#888" }}>
              <div style={{ fontSize:40, marginBottom:10 }}>🔍</div>
              <div style={{ fontSize:14, fontWeight:600, color:"#555", marginBottom:6 }}>No items found</div>
              <div style={{ fontSize:12 }}>Try a different search or category</div>
            </div>
          )}

          {/* Category rows when browsing all, grid when filtered */}
          {category === "all" ? (
            <div>
              {CATEGORIES.filter(cat => cat.key !== "all" && filtered.some(i => i.category === cat.key)).map(cat => (
                <div key={cat.key} style={{ marginBottom:"1.5rem" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                    <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:800, color:"#000" }}>{cat.icon} {cat.label}</div>
                    <button onClick={()=>setCategory(cat.key)} style={{ fontSize:11, color:"#e6821e", background:"none", border:"none", cursor:"pointer", fontWeight:600 }}>See all →</button>
                  </div>
                  <div style={{ display:"flex", gap:10, overflowX:"auto", paddingBottom:8, scrollbarWidth:"none", WebkitOverflowScrolling:"touch" }}>
                    {filtered.filter(i => i.category === cat.key).map(item=>(
                      <div key={item.id} style={{ flexShrink:0, width:160, background:"#ffffff", border:"1px solid #eeeeee", borderRadius:12, overflow:"hidden", boxShadow:"0 1px 4px rgba(0,0,0,0.05)" }}>
                        {item.photos?.[0] ? (
                          <img src={item.photos[0]} alt={item.name} style={{ width:"100%", height:110, objectFit:"cover", cursor:"zoom-in" }} onClick={()=>setLightbox({ open:true, photos:item.photos, index:0 })}/>
                        ):(
                          <div style={{ width:"100%", height:110, background:"linear-gradient(135deg,#f8f8f8,#f0f0f0)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:32 }}>{cat.icon}</div>
                        )}
                        <div style={{ padding:"0.65rem" }}>
                          <div style={{ fontSize:12, fontWeight:600, color:"#000", marginBottom:2, lineHeight:1.3 }}>{item.name.length>28?item.name.substring(0,28)+"...":item.name}</div>
                          {item.brand&&<div style={{ fontSize:10, color:"#888", marginBottom:3 }}>{item.brand}</div>}
                          <div style={{ fontFamily:"Syne", fontSize:13, fontWeight:800, color:"#e6821e", marginBottom:6 }}>KES {Number(item.price).toLocaleString()}</div>
                          <div style={{ display:"flex", gap:5 }}>
                            <button onClick={()=>addToCart(item)} disabled={item.stock_quantity===0}
                              style={{ flex:1, background:item.stock_quantity===0?"#f0f0f0":"#e6821e", border:"none", borderRadius:7, color:item.stock_quantity===0?"#aaa":"#fff", fontSize:10, fontWeight:700, padding:"6px 4px", cursor:item.stock_quantity===0?"not-allowed":"pointer" }}>
                              {item.stock_quantity===0?"Out of stock":"+ Cart"}
                            </button>
                            <button onClick={()=>setChatItem(item)} style={{ background:"#eff6ff", border:"1px solid #378add40", borderRadius:7, color:"#378add", fontSize:11, padding:"6px 8px", cursor:"pointer" }}>💬</button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"repeat(2,1fr)", gap:12 }}>
              {filtered.map(item=>(
                <div key={item.id} style={{ background:"#ffffff", border:"1px solid #eeeeee", borderRadius:12, overflow:"hidden", boxShadow:"0 1px 4px rgba(0,0,0,0.05)" }}>
                  {item.photos?.[0] ? (
                    <img src={item.photos[0]} alt={item.name} style={{ width:"100%", height:140, objectFit:"cover", cursor:"zoom-in" }} onClick={()=>setLightbox({ open:true, photos:item.photos, index:0 })}/>
                  ):(
                    <div style={{ width:"100%", height:110, background:"linear-gradient(135deg,#f8f8f8,#f0f0f0)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:36 }}>
                      {CATEGORIES.find(cat=>cat.key===item.category)?.icon||"📦"}
                    </div>
                  )}
                  <div style={{ padding:"0.85rem" }}>
                    <div style={{ fontSize:13, fontWeight:600, color:"#000", marginBottom:3 }}>{item.name}</div>
                    {item.brand&&<div style={{ fontSize:10, color:"#888", marginBottom:2 }}>Brand: {item.brand}</div>}
                    {item.compatible_cars?.length>0&&<div style={{ fontSize:10, color:"#777", marginBottom:4 }}>🚗 {item.compatible_cars.slice(0,2).join(", ")}</div>}
                    <div style={{ fontSize:11, color:"#888", marginBottom:6 }}>🏪 {item.profiles?.business_name||item.profiles?.first_name} {item.profiles?.is_verified&&"✓"}</div>
                    {item.video_url&&<video src={item.video_url} controls style={{ width:"100%", borderRadius:7, marginBottom:6, maxHeight:130 }}/>}
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                      <div style={{ fontFamily:"Syne", fontSize:15, fontWeight:800, color:"#e6821e" }}>KES {Number(item.price).toLocaleString()}</div>
                      <div style={{ fontSize:10, color:item.stock_quantity<=5?"#e24b4a":"#1d9e75" }}>{item.stock_quantity} in stock</div>
                    </div>
                    <div style={{ display:"flex", gap:6 }}>
                      <button onClick={()=>addToCart(item)} disabled={item.stock_quantity===0}
                        style={{ flex:1, background:item.stock_quantity===0?"#f0f0f0":"#e6821e", border:"none", borderRadius:8, color:item.stock_quantity===0?"#aaa":"#fff", fontFamily:"Syne,sans-serif", fontSize:12, fontWeight:700, padding:"9px", cursor:item.stock_quantity===0?"not-allowed":"pointer" }}>
                        {item.stock_quantity===0?"Out of stock":"+ Add to cart"}
                      </button>
                      <button onClick={()=>setChatItem(item)} style={{ background:"#eff6ff", border:"1px solid #378add40", borderRadius:8, color:"#378add", fontSize:12, padding:"9px 12px", cursor:"pointer" }}>💬</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
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
                  <span style={{ fontSize:10, padding:"3px 10px", borderRadius:20, background:(SC[o.status]||"#888")+"20", color:SC[o.status]||"#888", fontWeight:600, border:"1px solid "+(SC[o.status]||"#888")+"30" }}>{o.status?.toUpperCase()}</span>
                </div>
              </div>
              {o.order_items?.map(oi=>(
                <div key={oi.id} style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:"#666", padding:"4px 0", borderTop:"1px solid #eeeeee" }}>
                  <span>{oi.name} x{oi.quantity}</span>
                  <span>KES {Number(oi.unit_price*oi.quantity).toLocaleString()}</span>
                </div>
              ))}
              {o.delivery_zone&&<div style={{ fontSize:11, color:"#378add", marginTop:4 }}>📍 Delivery: {o.delivery_zone} · KES {Number(o.delivery_fee||0).toLocaleString()}</div>}
              {o.status==="delivered"&&!myReviews[o.id]&&(
                <button onClick={()=>{ setReviewOrder(o); setReviewRating(5); setReviewText("") }}
                  style={{ width:"100%", marginTop:8, background:"#fff8f0", border:"1px solid #e6821e40", borderRadius:8, color:"#e6821e", fontSize:12, fontWeight:600, padding:"8px", cursor:"pointer" }}>
                  ⭐ Rate this order
                </button>
              )}
              {o.status==="delivered"&&myReviews[o.id]&&(
                <div style={{ marginTop:8, fontSize:11, color:"#1d9e75", textAlign:"center" }}>
                  ✓ You rated this {myReviews[o.id]} star{myReviews[o.id]!==1?"s":""}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {reviewOrder&&(
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", zIndex:300, display:"flex", alignItems:"flex-end", justifyContent:"center" }} onClick={()=>setReviewOrder(null)}>
          <div style={{ width:"100%", maxWidth:500, background:"#fff", borderRadius:"20px 20px 0 0", padding:"1.5rem" }} onClick={e=>e.stopPropagation()}>
            <div style={{ display:"flex", justifyContent:"center", marginBottom:12 }}><div style={{ width:36, height:4, borderRadius:2, background:"#e0e0e0" }}/></div>
            <div style={{ fontFamily:"Syne", fontSize:16, fontWeight:800, color:"#000", marginBottom:4, textAlign:"center" }}>Rate your order</div>
            <div style={{ fontSize:12, color:"#888", marginBottom:"1.25rem", textAlign:"center" }}>#{reviewOrder.order_number} from {reviewOrder.profiles?.business_name||reviewOrder.profiles?.first_name}</div>
            <div style={{ display:"flex", justifyContent:"center", gap:8, marginBottom:"1.25rem" }}>
              {[1,2,3,4,5].map(n=>(
                <button key={n} onClick={()=>setReviewRating(n)} style={{ background:"none", border:"none", fontSize:32, cursor:"pointer", filter:n<=reviewRating?"none":"grayscale(1) opacity(0.3)" }}>⭐</button>
              ))}
            </div>
            <textarea value={reviewText} onChange={e=>setReviewText(e.target.value)} placeholder="How was the quality and service? (optional)"
              style={{ width:"100%", background:"#f8f8f8", border:"1px solid #e5e5e5", borderRadius:10, padding:"10px 12px", fontSize:13, outline:"none", resize:"vertical", minHeight:80, marginBottom:"1rem", fontFamily:"DM Sans,sans-serif" }}/>
            <div style={{ display:"flex", gap:8 }}>
              <button onClick={submitOrderReview} disabled={submittingReview}
                style={{ flex:1, background:submittingReview?"#ccc":"linear-gradient(135deg,#e6821e,#f09840)", border:"none", borderRadius:10, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:14, fontWeight:700, padding:"13px", cursor:submittingReview?"not-allowed":"pointer" }}>
                {submittingReview?"Submitting...":"Submit review"}
              </button>
              <button onClick={()=>setReviewOrder(null)} style={{ background:"none", border:"1px solid #ddd", borderRadius:10, color:"#888", fontSize:13, padding:"13px 20px", cursor:"pointer" }}>Cancel</button>
            </div>
          </div>
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
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", zIndex:200, display:"flex", alignItems:"flex-end", justifyContent:"center" }} onClick={()=>{ setShowCart(false); setCheckoutStep("cart") }}>
          <div style={{ width:"100%", maxWidth:500, background:"#ffffff", borderRadius:"20px 20px 0 0", padding:"1.5rem", maxHeight:"85vh", overflowY:"auto" }} onClick={e=>e.stopPropagation()}>
            <div style={{ display:"flex", justifyContent:"center", marginBottom:8 }}><div style={{ width:36, height:4, borderRadius:2, background:"#e0e0e0" }}/></div>
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

                <div style={{ marginBottom:"1rem", borderTop:"1px solid #eeeeee", paddingTop:"1rem" }}>
                  <div style={{ fontSize:11, color:"#666", marginBottom:6, fontWeight:600 }}>Payment method</div>
                  <div style={{ display:"flex", gap:8 }}>
                    <button type="button" onClick={()=>setPaymentMethod("pesapal")}
                      style={{ flex:1, background:paymentMethod==="pesapal"?"#e6821e":"#ffffff", border:(paymentMethod==="pesapal"?"1px solid #e6821e":"1px solid #e5e5e5"), borderRadius:8, color:paymentMethod==="pesapal"?"#fff":"#666", fontSize:12, fontWeight:600, padding:"10px", cursor:"pointer" }}>
                      💳 Pay online (Pesapal)
                    </button>
                    <button type="button" onClick={()=>setPaymentMethod("cash")}
                      style={{ flex:1, background:paymentMethod==="cash"?"#e6821e":"#ffffff", border:(paymentMethod==="cash"?"1px solid #e6821e":"1px solid #e5e5e5"), borderRadius:8, color:paymentMethod==="cash"?"#fff":"#666", fontSize:12, fontWeight:600, padding:"10px", cursor:"pointer" }}>
                      💵 Cash on {fulfillment==="delivery"?"delivery":"pickup"}
                    </button>
                  </div>
                </div>

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
      {lightbox.open&&<PhotoLightbox photos={lightbox.photos} currentIndex={lightbox.index} onClose={()=>setLightbox(l=>({...l,open:false}))} onPrev={()=>setLightbox(l=>({...l,index:Math.max(0,l.index-1)}))} onNext={()=>setLightbox(l=>({...l,index:Math.min(l.photos.length-1,l.index+1)}))}/>}
    </div>
  )
}









