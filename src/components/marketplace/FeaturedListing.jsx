import { useState, useEffect } from "react"
import { supabase } from "../../lib/supabase"
import { useAuth } from "../../contexts/AuthContext"
import toast from "react-hot-toast"

const DURATIONS = [
  { key:"day", label:"1 Day", days:1 },
  { key:"week", label:"1 Week", days:7 },
  { key:"month", label:"1 Month", days:30 },
]

export default function FeaturedListing({ listingId, onSuccess }) {
  const { user, profile } = useAuth()
  const [duration, setDuration] = useState("week")
  const [tier, setTier] = useState("standard")
  const [paying, setPaying] = useState(false)
  const [listing, setListing] = useState(null)
  const [prices, setPrices] = useState({
    standard_day: 50, standard_week: 200, standard_month: 600,
    premium_day: 150, premium_week: 500, premium_month: 1500,
  })

  useEffect(() => {
    if (!listingId) return
    Promise.all([
      supabase.from("marketplace_listings").select("id,title,is_featured,featured_until,featured_tier").eq("id", listingId).single(),
      supabase.from("app_settings").select("key,value").in("key", [
        "featured_standard_day_price","featured_standard_week_price","featured_standard_month_price",
        "featured_premium_day_price","featured_premium_week_price","featured_premium_month_price"
      ])
    ]).then(([{ data: lst }, { data: settings }]) => {
      setListing(lst)
      if (settings) {
        const p = {}
        settings.forEach(s => {
          if (s.key === "featured_standard_day_price") p.standard_day = Number(s.value)
          if (s.key === "featured_standard_week_price") p.standard_week = Number(s.value)
          if (s.key === "featured_standard_month_price") p.standard_month = Number(s.value)
          if (s.key === "featured_premium_day_price") p.premium_day = Number(s.value)
          if (s.key === "featured_premium_week_price") p.premium_week = Number(s.value)
          if (s.key === "featured_premium_month_price") p.premium_month = Number(s.value)
        })
        setPrices(prev => ({...prev, ...p}))
      }
    })
  }, [listingId])

  const amount = prices[`${tier}_${duration}`] || 0
  const days = DURATIONS.find(d=>d.key===duration)?.days || 7

  const isFeatured = listing?.is_featured && listing?.featured_until && new Date(listing.featured_until) > new Date()
  const daysLeft = isFeatured ? Math.ceil((new Date(listing.featured_until)-new Date())/(1000*60*60*24)) : 0

  async function payToFeature() {
    if (!listing) return
    setPaying(true)
    try {
      const { data: payment, error: paymentError } = await supabase.from("featured_payments").insert({
        listing_id: listing.id,
        seller_id: user.id,
        amount,
        weeks: Math.ceil(days/7),
        status: "pending",
      }).select("id").single()
      if (paymentError) throw paymentError

      // Store tier and days in sessionStorage for callback
      sessionStorage.setItem("featured_tier", tier)
      sessionStorage.setItem("featured_days", days)

      const res = await fetch("https://gcnefnqtjxtqbhynyoxe.supabase.co/functions/v1/pesapal-payment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdjbmVmbnF0anh0cWJoeW55b3hlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2MDg0MzIsImV4cCI6MjA5NTE4NDQzMn0.Ybyce3psBj2I-hdoF95H5UAklr6hsgQi-mciI9uMIgc"
        },
        body: JSON.stringify({
          amount,
          bookingId: payment.id,
          customerEmail: user.email,
          customerPhone: profile?.phone || "",
          customerName: (profile?.first_name||"") + " " + (profile?.last_name||""),
          description: `${tier==="premium"?"⭐ PREMIUM":"Standard"} Featured listing for ${days} day(s): "${listing.title}"`
        })
      })
      const order = await res.json()
      if (order.redirect_url) {
        await supabase.from("featured_payments").update({
          pesapal_tracking_id: order.order_tracking_id,
          status: "processing"
        }).eq("id", payment.id)
        window.location.href = order.redirect_url
      } else {
        throw new Error(order.error || "Payment initiation failed")
      }
    } catch(err) { toast.error(err.message); setPaying(false) }
  }

  if (!listing) return <div style={{ color:"#888", fontSize:13 }}>Loading...</div>

  if (isFeatured) return (
    <div style={{ background: listing.featured_tier==="premium"?"#faf5ff":"#fff8f0", border:`1px solid ${listing.featured_tier==="premium"?"#8b5cf640":"#e6821e40"}`, borderRadius:12, padding:"1rem" }}>
      <div style={{ fontFamily:"Syne", fontSize:13, fontWeight:700, color:listing.featured_tier==="premium"?"#8b5cf6":"#e6821e", marginBottom:4 }}>
        {listing.featured_tier==="premium"?"⭐ PREMIUM Featured":"⭐ Featured"}
      </div>
      <div style={{ fontSize:11, color:"#777777" }}>{daysLeft} day{daysLeft!==1?"s":""} remaining</div>
    </div>
  )

  return (
    <div style={{ background:"#ffffff", border:"1px solid #eeeeee", borderRadius:12, padding:"1.25rem" }}>
      <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:800, color:"#000000", marginBottom:4 }}>⭐ Feature this listing</div>
      <div style={{ fontSize:12, color:"#777777", marginBottom:16 }}>Boost your listing visibility and get more buyers.</div>

      {/* Tier selector */}
      <div style={{ marginBottom:16 }}>
        <div style={{ fontSize:11, color:"#666", marginBottom:8, fontWeight:600, textTransform:"uppercase", letterSpacing:"0.05em" }}>Choose tier</div>
        <div style={{ display:"flex", gap:8 }}>
          <button onClick={()=>setTier("standard")} style={{ flex:1, background:tier==="standard"?"#fff8f0":"#ffffff", border:`2px solid ${tier==="standard"?"#e6821e":"#eeeeee"}`, borderRadius:10, padding:"10px 8px", cursor:"pointer", textAlign:"center" }}>
            <div style={{ fontSize:16, marginBottom:4 }}>⭐</div>
            <div style={{ fontFamily:"Syne", fontSize:12, fontWeight:700, color:tier==="standard"?"#e6821e":"#555" }}>Standard</div>
            <div style={{ fontSize:10, color:"#888", marginTop:2 }}>Above regular listings</div>
          </button>
          <button onClick={()=>setTier("premium")} style={{ flex:1, background:tier==="premium"?"#faf5ff":"#ffffff", border:`2px solid ${tier==="premium"?"#8b5cf6":"#eeeeee"}`, borderRadius:10, padding:"10px 8px", cursor:"pointer", textAlign:"center" }}>
            <div style={{ fontSize:16, marginBottom:4 }}>👑</div>
            <div style={{ fontFamily:"Syne", fontSize:12, fontWeight:700, color:tier==="premium"?"#8b5cf6":"#555" }}>Premium</div>
            <div style={{ fontSize:10, color:"#888", marginTop:2 }}>Above ALL featured listings</div>
          </button>
        </div>
      </div>

      {/* Duration selector */}
      <div style={{ marginBottom:16 }}>
        <div style={{ fontSize:11, color:"#666", marginBottom:8, fontWeight:600, textTransform:"uppercase", letterSpacing:"0.05em" }}>Choose duration</div>
        <div style={{ display:"flex", gap:8 }}>
          {DURATIONS.map(d=>(
            <button key={d.key} onClick={()=>setDuration(d.key)}
              style={{ flex:1, background:duration===d.key?(tier==="premium"?"#faf5ff":"#fff8f0"):"#ffffff", border:`2px solid ${duration===d.key?(tier==="premium"?"#8b5cf6":"#e6821e"):"#eeeeee"}`, borderRadius:10, padding:"10px 4px", cursor:"pointer", textAlign:"center" }}>
              <div style={{ fontFamily:"Syne", fontSize:11, fontWeight:700, color:duration===d.key?(tier==="premium"?"#8b5cf6":"#e6821e"):"#555" }}>{d.label}</div>
              <div style={{ fontSize:11, color:duration===d.key?(tier==="premium"?"#8b5cf6":"#e6821e"):"#888", marginTop:4, fontWeight:600 }}>KES {(prices[`${tier}_${d.key}`]||0).toLocaleString()}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Benefits */}
      <div style={{ background: tier==="premium"?"#faf5ff":"#fff8f0", borderRadius:8, padding:"0.75rem", marginBottom:16 }}>
        {tier==="premium" ? (
          <>
            <div style={{ fontSize:11, color:"#8b5cf6", fontWeight:700, marginBottom:6 }}>👑 Premium benefits</div>
            {["Appears ABOVE all standard featured listings","👑 Premium crown badge","Maximum visibility to buyers","Priority position guaranteed"].map((b,i)=>(
              <div key={i} style={{ fontSize:11, color:"#555", marginBottom:3 }}>✓ {b}</div>
            ))}
          </>
        ) : (
          <>
            <div style={{ fontSize:11, color:"#e6821e", fontWeight:700, marginBottom:6 }}>⭐ Standard benefits</div>
            {["Appears above all regular listings","⭐ Featured badge","3x more visibility","Highlighted in browse"].map((b,i)=>(
              <div key={i} style={{ fontSize:11, color:"#555", marginBottom:3 }}>✓ {b}</div>
            ))}
          </>
        )}
      </div>

      <button onClick={payToFeature} disabled={paying||!amount}
        style={{ width:"100%", background:paying?"#e0e0e0":tier==="premium"?"#8b5cf6":"#e6821e", border:"none", borderRadius:9, color:paying?"#555":"#fff", fontFamily:"Syne,sans-serif", fontSize:13, fontWeight:700, padding:"12px", cursor:paying?"not-allowed":"pointer" }}>
        {paying?"Redirecting to payment...":`Pay KES ${amount.toLocaleString()} — ${tier==="premium"?"👑 Premium":"⭐ Standard"} for ${DURATIONS.find(d=>d.key===duration)?.label}`}
      </button>
    </div>
  )
}
