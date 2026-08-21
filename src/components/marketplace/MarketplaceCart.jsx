import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"
import { getCurrentPosition } from "../../lib/geolocation"
import toast from "react-hot-toast"

// Cart/checkout modal used directly from the main Marketplace page (browse to cart, no
// navigation away to a separate screen). Mirrors the exact, already-working checkout flow
// from CustomerPartsMarketplace.jsx (delivery zones, per-provider order splitting, commission
// and platform fee calculation, M-Pesa STK push) - cart state itself lives in Marketplace.jsx
// since "Add to Cart" buttons live on its listing grid, not here.
export default function MarketplaceCart({ cart, setCart, showCart, setShowCart, user, profile, onOrderComplete }) {
  const [zones, setZones] = useState([])
  const [feeMultipliers, setFeeMultipliers] = useState({ motorcycle:1, tuktuk:1.5, van:3, car:1.5 })
  const [platformFeeRateDisplay, setPlatformFeeRateDisplay] = useState({ rate:0.02, cap:200 })
  const [fulfillment, setFulfillment] = useState("pickup")
  const [selectedZone, setSelectedZone] = useState("")
  const [deliveryAddress, setDeliveryAddress] = useState("")
  const [deliveryLat, setDeliveryLat] = useState(null)
  const [deliveryLng, setDeliveryLng] = useState(null)
  const [detectingLocation, setDetectingLocation] = useState(false)
  const [ordering, setOrdering] = useState(false)
  const [checkoutStep, setCheckoutStep] = useState("cart") // cart, details, payment
  const [customerDetails, setCustomerDetails] = useState({ name:"", phone:"" })
  const [pendingOrder, setPendingOrder] = useState(null)
  const [showOrderPayment, setShowOrderPayment] = useState(false)
  const [paying, setPaying] = useState(false)

  useEffect(() => {
    supabase.from("delivery_zones").select("*").eq("is_active", true)
      .then(({ data }) => setZones(data||[]))
    supabase.from("app_settings").select("key,value")
      .in("key",["marketplace_delivery_fee_multiplier_motorcycle","marketplace_delivery_fee_multiplier_tuktuk","marketplace_delivery_fee_multiplier_van","marketplace_delivery_fee_multiplier_car"])
      .then(({ data }) => {
        const m = {}
        data?.forEach(r => {
          if (r.key.endsWith("motorcycle")) m.motorcycle = Number(r.value)
          if (r.key.endsWith("tuktuk")) m.tuktuk = Number(r.value)
          if (r.key.endsWith("van")) m.van = Number(r.value)
          if (r.key.endsWith("car")) m.car = Number(r.value)
        })
        setFeeMultipliers(prev => ({ ...prev, ...m }))
      })
    supabase.from("commission_rates").select("platform_fee_rate,platform_fee_cap").eq("provider_type","parts_dealer").maybeSingle()
      .then(({ data }) => { if (data) setPlatformFeeRateDisplay({ rate: Number(data.platform_fee_rate), cap: Number(data.platform_fee_cap) }) })
  }, [])

  useEffect(() => {
    if (user && profile) setCustomerDetails({ name: (profile.first_name||"")+" "+(profile.last_name||""), phone: profile.phone||"" })
  }, [user, profile])

  function removeFromCart(id) { setCart(prev=>prev.filter(c=>c.id!==id)) }
  function updateQty(id, qty) {
    if (qty<=0) return removeFromCart(id)
    setCart(prev=>prev.map(c=>c.id===id?{...c,qty}:c))
  }

  const cartTotal = cart.reduce((s,c)=>s+Number(c.price)*c.qty, 0)
  const zone = zones.find(z => z.id === selectedZone)
  const cartItemCount = cart.reduce((s,i)=>s+i.qty,0)
  const predictedVehicleType = cartItemCount<=3?"motorcycle":cartItemCount<=6?"tuktuk":"van"
  const deliveryFee = fulfillment === "delivery" && zone ? Math.round(Number(zone.base_fee) * (feeMultipliers[predictedVehicleType]||1)) : 0
  const platformFeeDisplay = Math.min(Math.round(cartTotal * platformFeeRateDisplay.rate), platformFeeRateDisplay.cap)
  const orderTotal = cartTotal + deliveryFee + platformFeeDisplay

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
      const { data: rateRow } = await supabase.from("commission_rates").select("platform_rate,platform_fee_rate,platform_fee_cap").eq("provider_type","parts_dealer").maybeSingle()
      const commissionRate = rateRow ? Number(rateRow.platform_rate) : 0.05
      const platformFeeRate = rateRow ? Number(rateRow.platform_fee_rate) : 0.02
      const platformFeeCap = rateRow ? Number(rateRow.platform_fee_cap) : 200
      const byProvider = {}
      cart.forEach(item => {
        if (!byProvider[item.provider_id]) byProvider[item.provider_id] = []
        byProvider[item.provider_id].push(item)
      })
      let firstOrderId = null
      let firstOrderNumber = null
      let firstOrderTotal = 0
      for (const [providerId, items] of Object.entries(byProvider)) {
        const subtotal = items.reduce((s, i) => s + Number(i.price) * i.qty, 0)
        const commission = subtotal * commissionRate
        const platformFee = Math.min(Math.round(subtotal * platformFeeRate), platformFeeCap)
        const providerEarnings = subtotal - commission
        const orderDeliveryFee = Object.keys(byProvider).length === 1 ? deliveryFee : 0
        const { data: order, error } = await supabase.from("orders").insert({
          customer_id: user.id,
          provider_id: providerId,
          subtotal,
          delivery_fee: orderDeliveryFee,
          platform_commission: commission,
          // No platform_fee column exists on orders - platformFee is still folded into
          // firstOrderTotal below so the amount actually charged stays correct.
          provider_earnings: providerEarnings,
          fulfillment_type: fulfillment,
          delivery_zone: zone?.name || null,
          delivery_address: deliveryAddress || null,
          delivery_latitude: deliveryLat || null,
          delivery_longitude: deliveryLng || null,
          customer_name: customerDetails.name,
          customer_phone: customerDetails.phone,
          payment_method: "mpesa",
          payment_status: "awaiting_payment",
          status: "pending_payment",
        }).select("id, order_number").single()
        if (error) throw error
        for (const item of items) {
          await supabase.from("order_items").insert({
            order_id: order.id,
            inventory_id: item.id,
            name: item.name,
            quantity: item.qty,
            unit_price: Number(item.price),
          })
          await supabase.from("inventory").update({ stock_quantity: item.stock_quantity - item.qty }).eq("id", item.id)
        }
        await supabase.from("notifications").insert({
          user_id: providerId,
          title: "New order received!",
          message: customerDetails.name + " ordered " + items.length + " item(s) - KES " + subtotal.toLocaleString() + " (Paid online via M-Pesa)",
          type: "success",
        })
        if (!firstOrderId) {
          firstOrderId = order.id
          firstOrderNumber = order.order_number
          firstOrderTotal = subtotal + orderDeliveryFee + platformFee
        }
      }
      setCart([])
      setShowCart(false)
      setCheckoutStep("cart")
      setDeliveryAddress("")
      setDeliveryLat(null)
      setDeliveryLng(null)
      setSelectedZone("")
      setPendingOrder({ id: firstOrderId, order_number: firstOrderNumber, amount: firstOrderTotal })
      setShowOrderPayment(true)
    } catch(err) { toast.error(err.message) }
    finally { setOrdering(false) }
  }

  if (!showCart) return null

  return (
    <>
      <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", zIndex:200, display:"flex", alignItems:"flex-end", justifyContent:"center" }} onClick={()=>{ setShowCart(false); setCheckoutStep("cart") }}>
        <div style={{ width:"100%", maxWidth:500, background:"#ffffff", borderRadius:"20px 20px 0 0", padding:"1.5rem", maxHeight:"85vh", overflowY:"auto" }} onClick={e=>e.stopPropagation()}>
          <div style={{ display:"flex", justifyContent:"center", marginBottom:8 }}><div style={{ width:36, height:4, borderRadius:2, background:"#e0e0e0" }}/></div>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"1.25rem" }}>
            <div>
              <div style={{ fontFamily:"Syne", fontSize:16, fontWeight:800, color:"#000000" }}>
                {checkoutStep==="cart"?"Your cart":checkoutStep==="details"?"Delivery details":"Payment"}
              </div>
              <div style={{ display:"flex", gap:4, marginTop:4 }}>
                {["cart","details","payment"].map((s,i)=>(
                  <div key={s} style={{ flex:1, height:3, borderRadius:2, background:checkoutStep===s||(["details","payment"].includes(checkoutStep)&&i===0)||(checkoutStep==="payment"&&i===1)?"#e6821e":"#e0e0e0" }}/>
                ))}
              </div>
            </div>
            <button onClick={()=>{ setShowCart(false); setCheckoutStep("cart") }} style={{ background:"none", border:"none", color:"#777777", fontSize:22, cursor:"pointer" }}>&times;</button>
          </div>
          {cart.length===0&&<div style={{ color:"#888888", textAlign:"center", padding:"2rem" }}>Cart is empty</div>}
          {checkoutStep==="cart"&&cart.map(item=>(
            <div key={item.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 0", borderBottom:"1px solid #eeeeee" }}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:13, color:"#000000" }}>{item.name}</div>
                <div style={{ fontSize:11, color:"#777777" }}>KES {Number(item.price).toLocaleString()} / {item.unit||"unit"}</div>
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <button onClick={()=>updateQty(item.id,item.qty-1)} style={{ background:"#f5f5f5", border:"none", borderRadius:6, color:"#000000", width:26, height:26, cursor:"pointer", fontSize:14 }}>-</button>
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
                      {f==="pickup"?"Pickup from shop":"Delivery to me"}
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
                      style={{ width:"100%", background:"#ffffff", border:"1px solid #e5e5e5", borderRadius:8, padding:"9px 12px", color:"#000000", fontSize:12, outline:"none", boxSizing:"border-box" }}/>
                  </div>
                  <div style={{ marginBottom:8 }}>
                    <div style={{ fontSize:11, color:"#666", marginBottom:4 }}>Phone number</div>
                    <input value={customerDetails.phone} onChange={e=>setCustomerDetails(d=>({...d,phone:e.target.value}))}
                      placeholder="0712 345 678"
                      style={{ width:"100%", background:"#ffffff", border:"1px solid #e5e5e5", borderRadius:8, padding:"9px 12px", color:"#000000", fontSize:12, outline:"none", boxSizing:"border-box" }}/>
                  </div>
                  {fulfillment==="delivery"&&(
                    <>
                      <div style={{ marginBottom:8 }}>
                        <div style={{ fontSize:11, color:"#666", marginBottom:4 }}>Delivery zone</div>
                        <select value={selectedZone} onChange={e=>setSelectedZone(e.target.value)}
                          style={{ width:"100%", background:"#ffffff", border:"1px solid #e5e5e5", borderRadius:8, padding:"9px 12px", color:"#000000", fontSize:12, outline:"none", boxSizing:"border-box" }}>
                          <option value="">Select zone...</option>
                          {zones.map(z=><option key={z.id} value={z.id}>{z.name} - KES {Number(z.base_fee).toLocaleString()}</option>)}
                        </select>
                      </div>
                      <div style={{ marginBottom:8 }}>
                        <div style={{ fontSize:11, color:"#666", marginBottom:4 }}>Delivery address</div>
                        <div style={{ display:"flex", gap:6 }}>
                          <input value={deliveryAddress} onChange={e=>setDeliveryAddress(e.target.value)} placeholder="Your full delivery address..."
                            style={{ flex:1, background:"#ffffff", border:"1px solid #e5e5e5", borderRadius:8, padding:"9px 12px", color:"#000000", fontSize:12, outline:"none" }}/>
                          <button type="button" disabled={detectingLocation} onClick={()=>{ setDetectingLocation(true); Promise.resolve().then(async ()=>{ const pos = await getCurrentPosition(); return pos }).then(async pos=>{ setDeliveryLat(pos.latitude); setDeliveryLng(pos.longitude); const r=await fetch("https://nominatim.openstreetmap.org/reverse?lat="+pos.latitude+"&lon="+pos.longitude+"&format=json"); const d=await r.json(); setDeliveryAddress(d.display_name||"Location detected") }).catch(()=>{}).finally(()=>setDetectingLocation(false)) }} style={{ background:"#e6821e", border:"none", borderRadius:8, color:"#fff", fontSize:11, fontWeight:700, padding:"0 12px", cursor:"pointer", flexShrink:0 }}>
                            {detectingLocation?"...":"Detect"}
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
              <div style={{ borderTop:"1px solid #eeeeee", paddingTop:"1rem", marginTop:"0.5rem" }}>
                <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, color:"#666", marginBottom:4 }}>
                  <span>Subtotal</span><span>KES {cartTotal.toLocaleString()}</span>
                </div>
                {fulfillment==="delivery"&&selectedZone&&(
                  <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, color:"#666", marginBottom:4 }}>
                    <span>Delivery fee</span><span>KES {deliveryFee.toLocaleString()}</span>
                  </div>
                )}
                <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, color:"#888", marginBottom:8, paddingBottom:8, borderBottom:"1px dashed #eee" }}>
                  <span>Platform fee <span style={{ fontSize:10, color:"#bbb" }}>({Math.round(platformFeeRateDisplay.rate*100)}%, max KES {platformFeeRateDisplay.cap})</span></span>
                  <span>KES {platformFeeDisplay.toLocaleString()}</span>
                </div>
                <div style={{ display:"flex", justifyContent:"space-between", fontFamily:"Syne", fontSize:15, fontWeight:800, color:"#e6821e", marginBottom:"1rem" }}>
                  <span>Total</span><span>KES {orderTotal.toLocaleString()}</span>
                </div>
                <button onClick={placeOrder} disabled={ordering}
                  style={{ width:"100%", background:ordering?"#ccc":"#e6821e", border:"none", borderRadius:10, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:14, fontWeight:700, padding:"14px", cursor:ordering?"not-allowed":"pointer" }}>
                  {ordering?"Placing order...":checkoutStep==="cart"?"Continue":checkoutStep==="details"?"Continue to payment":"Place order"}
                </button>
                <div style={{ fontSize:11, color:"#888888", textAlign:"center", marginTop:8 }}>Secure payment via M-Pesa</div>
              </div>
            </>
          )}
        </div>
      </div>
      {showOrderPayment&&pendingOrder&&(
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.8)", zIndex:210, display:"flex", alignItems:"center", justifyContent:"center", padding:"1rem" }}>
          <div style={{ width:"100%", maxWidth:420, background:"#fff", borderRadius:16, padding:"1.5rem" }}>
            <div style={{ fontFamily:"Syne", fontSize:16, fontWeight:800, marginBottom:4 }}>Complete Payment</div>
            <div style={{ fontSize:13, color:"#888", marginBottom:"1.25rem" }}>Order #{pendingOrder.order_number}</div>
            <div style={{ background:"#f8f8f8", borderRadius:10, padding:"1rem", marginBottom:"1.25rem" }}>
              <div style={{ fontSize:12, color:"#888", marginBottom:4 }}>Amount to pay</div>
              <div style={{ fontFamily:"Syne", fontSize:24, fontWeight:800, color:"#e6821e" }}>KES {Number(pendingOrder.amount||0).toLocaleString()}</div>
            </div>
            <button disabled={paying} onClick={async()=>{
              setPaying(true)
              try {
                const { data: sens } = await supabase.from("profile_sensitive").select("mpesa_number").eq("id", user.id).maybeSingle()
                const phone = sens?.mpesa_number || profile?.phone
                if(!phone) { toast.error("Please add your M-Pesa number in Profile settings"); setPaying(false); return }
                const { data, error } = await supabase.functions.invoke("daraja-stk-push", {
                  body: { booking_id: pendingOrder.id, amount: Number(pendingOrder.amount||0), phone, account_ref: pendingOrder.order_number?.substring(0,12)||"CCC", description: "Parts Order #"+pendingOrder.order_number }
                })
                if (error) throw error
                if (data?.error) throw new Error(data.error)
                toast.success("Check your phone for M-Pesa payment prompt")
                setShowOrderPayment(false); setPendingOrder(null)
                if (onOrderComplete) onOrderComplete()
              } catch(err) { toast.error(err.message) }
              finally { setPaying(false) }
            }} style={{ width:"100%", background:paying?"#ccc":"#e6821e", border:"none", borderRadius:10, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:15, fontWeight:700, padding:"14px", cursor:paying?"not-allowed":"pointer", marginBottom:10 }}>
              {paying?"Sending payment request...":"Pay via M-Pesa"}
            </button>
            <button onClick={()=>{ setShowOrderPayment(false); setPendingOrder(null) }} style={{ width:"100%", background:"none", border:"1px solid #eee", borderRadius:10, color:"#888", fontSize:13, padding:"12px", cursor:"pointer" }}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  )
}
