import { OrdersIcon, LocationIcon, CheckIcon, CloseIcon, DeliveryIcon } from "../../lib/cccIcons"
import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"
import { useAuth } from "../../contexts/AuthContext"
import { openExternal, openMapsNavigation } from "../../lib/openExternal"
import useIsMobile from "../../lib/useIsMobile"
import toast from "react-hot-toast"

export default function DriverDeliveries() {
  const { user } = useAuth()
  const isMobile = useIsMobile()
  const [deliveries, setDeliveries] = useState([])
  const [available, setAvailable] = useState([])
  const [loading, setLoading] = useState(true)
  const [marketplaceRate, setMarketplaceRate] = useState(0.85)
  const [tab, setTab] = useState("available")
  const [now, setNow] = useState(Date.now())
  const [arrivedOrder, setArrivedOrder] = useState(null)
  const [otpInput, setOtpInput] = useState({})
  const [otpVerifying, setOtpVerifying] = useState(null)
  const [generatingOtp, setGeneratingOtp] = useState(null)

  useEffect(() => {
    const interval = setInterval(()=>setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [])

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
    (async () => {
      const vt = profile?.driver_vehicle_type || "car"
      const { data: vtRate } = await supabase.from("app_settings").select("value").eq("key",`marketplace_driver_commission_rate_${vt}`).maybeSingle()
      if (vtRate) { setMarketplaceRate(Number(vtRate.value)/100); return }
      const { data: fallback } = await supabase.from("app_settings").select("value").eq("key","marketplace_driver_commission_rate").maybeSingle()
      if (fallback) setMarketplaceRate(Number(fallback.value)/100)
    })()
    const [{ data: mine }, { data: avail }] = await Promise.all([
      supabase.from("orders")
        .select("*, order_items(name,quantity), profiles!orders_customer_id_fkey(first_name,last_name,city,latitude,longitude), provider:profiles!orders_provider_id_fkey(first_name,last_name,business_name,city,address,latitude,longitude)")
        .eq("delivery_driver_id", user.id)
        .order("created_at", { ascending:false }),
      supabase.from("orders")
        .select("*, order_items(name,quantity), profiles!orders_customer_id_fkey(first_name,last_name,city,latitude,longitude), provider:profiles!orders_provider_id_fkey(first_name,last_name,business_name,city,address,latitude,longitude)")
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
    try {
    // This delivery was broadcast to every eligible driver at once, not offered to one at a
    // time - the plain update below had no guard against two drivers tapping Accept within
    // moments of each other, letting the second silently overwrite the first with both seeing
    // a success toast. The .is() check makes this an atomic claim: only succeeds if nobody
    // else has already taken it.
    const { data: claimed, error: claimError } = await supabase.from("orders").update({
      delivery_driver_id: user.id,
      delivery_status: "driver_assigned"
    }).eq("id", orderId).is("delivery_driver_id", null).select().maybeSingle()
    if (claimError) { toast.error("Failed to accept delivery"); return }
    if (!claimed) { toast.error("Sorry, another driver already accepted this delivery"); load(); return }
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
    } catch(e) { toast.error("Failed to accept delivery") }
  }

  async function declineDelivery(orderId) {
    if (!confirm("Decline this delivery? It will be reassigned to another driver.")) return
    try {
    const order = deliveries.find(d=>d.id===orderId)
    await supabase.from("orders").update({
      delivery_driver_id: null,
      delivery_status: null,
      delivery_attempt_expires_at: null,
      delivery_declined_drivers: [...(order?.delivery_declined_drivers||[]), user.id]
    }).eq("id", orderId)
    toast.success("Delivery declined")
    load()
    } catch(e) { toast.error("Failed to decline delivery") }
  }
  async function generateDeliveryOTP(orderId) {
    setGeneratingOtp(orderId)
    try {
      const { data, error } = await supabase.functions.invoke("marketplace-generate-delivery-otp", { body: { order_id: orderId, driver_id: user.id } })
      if (error || data?.error) throw new Error(data?.error || error.message)
      setArrivedOrder(orderId)
      toast.success("OTP sent to customer! Ask them for the code.")
    } catch(e) { toast.error(e.message || "Failed to generate OTP") }
    finally { setGeneratingOtp(null) }
  }
  async function verifyDeliveryOTP(order) {
    const entered = otpInput[order.id]
    if (!entered || entered.length !== 4) return toast.error("Enter 4-digit OTP")
    setOtpVerifying(order.id)
    try {
      const { data, error } = await supabase.rpc("verify_delivery_otp", { p_order_id: order.id, p_otp: entered })
      if (error) throw error
      if (!data?.success) throw new Error(data?.error || "Verification failed")
      // Trigger the actual payout release now that delivery is genuinely confirmed - both
      // provider and driver shares get checked and released as far as each is eligible
      await supabase.functions.invoke("release-order-payment", { body: { order_id: order.id } })
      if (order.customer_id) {
        await supabase.from("notifications").insert({
          user_id: order.customer_id,
          title: "Order delivered! 🎉",
          message: "Your order has been delivered and confirmed. Thank you for shopping with CCC!",
          type: "success"
        })
      }
      setArrivedOrder(null)
      setOtpInput(prev => ({ ...prev, [order.id]: "" }))
      toast.success("Delivery confirmed! 🎉")
      load()
    } catch(e) { toast.error(e.message || "Verification failed") }
    finally { setOtpVerifying(null) }
  }

  function formatCountdown(expiresAt) {
    if (!expiresAt) return null
    const diff = new Date(expiresAt).getTime() - now
    if (diff <= 0) return "Expired"
    const mins = Math.floor(diff/60000)
    const secs = Math.floor((diff%60000)/1000)
    return mins+":"+String(secs).padStart(2,"0")
  }

  async function updateDeliveryStatus(orderId, status, customerId) {
    try {
    await supabase.from("orders").update({
      delivery_status: status,
      ...(status==="picked_up"?{ pickup_confirmed_at:new Date().toISOString(), delivery_attempt_expires_at:null }:{}),
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
    } catch(e) { toast.error("Failed to update status: "+e.message) }
  }

  const SC = { driver_assigned:"#378add", picked_up:"#8b5cf6", delivered:"#1d9e75" }
  const activeDeliveries = deliveries.filter(d=>d.delivery_status!=="delivered")
  const completedDeliveries = deliveries.filter(d=>d.delivery_status==="delivered")
  const earnings = completedDeliveries.reduce((s,d)=>s+Number(d.delivery_fee||0)*marketplaceRate,0)

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
            style={{ padding:"7px 14px", borderRadius:8, border:"none", fontSize:12, cursor:"pointer", background:tab===t.k?"#1d9e75":"#555555", color:tab===t.k?"#fff":"#666", fontWeight:tab===t.k?700:400 }}>
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
                  <div style={{ fontSize:11, color:"#777777", display:"flex", alignItems:"center", gap:3 }}><OrdersIcon size={11} color="#777777"/> Pick up from: {o.provider?.business_name||o.provider?.first_name} · {o.provider?.city}</div>
                  {o.provider?.latitude&&o.provider?.longitude&&(
                    <a href={`https://www.google.com/maps/dir/?api=1&destination=${o.provider.latitude},${o.provider.longitude}`} target="_blank" rel="noreferrer" style={{ fontSize:11, color:"#e6821e", textDecoration:"none" }}>🗺️ Navigate to pickup →</a>
                  )}
                  <div style={{ fontSize:11, color:"#777777", display:"flex", alignItems:"center", gap:3 }}><LocationIcon size={11} color="#777777"/> Deliver to: {o.delivery_address}</div>
                  <div style={{ fontSize:11, color:"#378add" }}>Zone: {o.delivery_zone}</div>
                  <div style={{ fontSize:10, color:"#888888" }}>{o.order_items?.length} item(s)</div>
                </div>
                <div style={{ textAlign:"right" }}>
                  <div style={{ fontFamily:"Syne", fontSize:15, fontWeight:800, color:"#1d9e75" }}>KES {(Number(o.delivery_fee||0)*marketplaceRate).toLocaleString()}</div>
                  <div style={{ fontSize:10, color:"#777777" }}>Your earnings (85%)</div>
                </div>
              </div>
              <button onClick={()=>acceptDelivery(o.id)} style={{ width:"100%", background:"#1d9e75", border:"none", borderRadius:9, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:13, fontWeight:700, padding:"10px", cursor:"pointer" }}>
                <><CheckIcon size={13} color="currentColor"/> Accept delivery</>
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
                  {o.provider?.latitude&&o.provider?.longitude&&(
                    <a href={`https://www.google.com/maps/dir/?api=1&destination=${o.provider.latitude},${o.provider.longitude}`} target="_blank" rel="noreferrer" style={{ fontSize:11, color:"#e6821e", textDecoration:"none" }}>🗺️ Navigate to provider →</a>
                  )}
                  <div style={{ fontSize:11, color:"#777777", display:"flex", alignItems:"center", gap:3 }}><LocationIcon size={11} color="#777777"/> Deliver to: {o.delivery_address}</div>
                  {o.profiles?.latitude&&o.profiles?.longitude&&(
                    <a href={`https://www.google.com/maps/dir/?api=1&destination=${o.profiles.latitude},${o.profiles.longitude}`} target="_blank" rel="noreferrer" style={{ fontSize:11, color:"#378add", textDecoration:"none" }}>🗺️ Navigate to customer →</a>
                  )}
                  {o.customer_phone&&(
                    <a href={"tel:"+o.customer_phone} style={{ fontSize:11, color:"#1d9e75", textDecoration:"none", display:"block", marginTop:2 }}>📞 Call customer</a>
                  )}
                  <span style={{ fontSize:10, padding:"2px 8px", borderRadius:8, background:(SC[o.delivery_status]||"#888")+"20", color:SC[o.delivery_status]||"#888", display:"inline-block", marginTop:4 }}>
                    {o.delivery_status?.replace(/_/g," ")||"assigned"}
                  </span>
                </div>
                <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:800, color:"#1d9e75" }}>
                  KES {(Number(o.delivery_fee||0)*marketplaceRate).toLocaleString()}
                </div>
              </div>
              {o.delivery_status==="driver_assigned"&&o.delivery_attempt_expires_at&&(
                <div style={{ background: formatCountdown(o.delivery_attempt_expires_at)==="Expired" ? "#fff5f5" : "#fff8f0", border:"1px solid "+(formatCountdown(o.delivery_attempt_expires_at)==="Expired"?"#e24b4a40":"#e6821e40"), borderRadius:8, padding:"0.6rem 0.85rem", marginBottom:10, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <span style={{ fontSize:12, color: formatCountdown(o.delivery_attempt_expires_at)==="Expired" ? "#e24b4a" : "#e6821e", fontWeight:600 }}>
                    ⏰ {formatCountdown(o.delivery_attempt_expires_at)==="Expired" ? "Time expired - reassigning..." : "Accept within "+formatCountdown(o.delivery_attempt_expires_at)}
                  </span>
                </div>
              )}
              <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                {o.delivery_status==="driver_assigned"&&(
                  <>
                    <button onClick={()=>updateDeliveryStatus(o.id,"picked_up",o.customer_id)} style={{ background:"#faf5ff", border:"1px solid #8b5cf640", borderRadius:7, color:"#8b5cf6", fontSize:11, padding:"6px 14px", cursor:"pointer", fontWeight:600 }}>
                      <><OrdersIcon size={13} color="currentColor"/> Confirm pickup</>
                    </button>
                    <button onClick={()=>declineDelivery(o.id)} style={{ background:"#fff5f5", border:"1px solid #e24b4a40", borderRadius:7, color:"#e24b4a", fontSize:11, padding:"6px 14px", cursor:"pointer", fontWeight:600 }}>
                      <><CloseIcon size={13} color="currentColor"/> Decline</>
                    </button>
                  </>
                )}
                {o.delivery_status==="picked_up"&&arrivedOrder!==o.id&&(
                  <button onClick={()=>generateDeliveryOTP(o.id)} disabled={generatingOtp===o.id} style={{ background:"#fff8f0", border:"1px solid #e6821e40", borderRadius:7, color:"#e6821e", fontSize:11, padding:"6px 14px", cursor:"pointer", fontWeight:600 }}>
                    {generatingOtp===o.id?"...":"📍 I have Arrived"}
                  </button>
                )}
                {o.delivery_status==="picked_up"&&arrivedOrder===o.id&&(
                  <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                    <input type="text" maxLength={4} placeholder="OTP" value={otpInput[o.id]||""}
                      onChange={e=>setOtpInput(prev=>({...prev,[o.id]:e.target.value.replace(/\D/g,"")}))}
                      style={{ width:60, padding:"6px", borderRadius:7, border:"1px solid #ddd", fontSize:14, textAlign:"center", letterSpacing:4 }}/>
                    <button onClick={()=>verifyDeliveryOTP(o)} disabled={otpVerifying===o.id} style={{ background:"#1d9e75", border:"none", borderRadius:7, color:"#fff", fontSize:11, fontWeight:700, padding:"7px 12px", cursor:"pointer" }}>
                      {otpVerifying===o.id?"...":"Verify OTP"}
                    </button>
                  </div>
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
                  <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:800, color:"#1d9e75" }}>KES {(Number(o.delivery_fee||0)*marketplaceRate).toLocaleString()}</div>
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



