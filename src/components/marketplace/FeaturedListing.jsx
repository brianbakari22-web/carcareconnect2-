import { useState, useEffect } from "react"
import { supabase } from "../../lib/supabase"
import { useAuth } from "../../contexts/AuthContext"
import toast from "react-hot-toast"

export default function FeaturedListing({ listingId, onSuccess }) {
  const { user, profile } = useAuth()
  const [weeks, setWeeks] = useState(1)
  const [paying, setPaying] = useState(false)
  const [listing, setListing] = useState(null)
  const amount = weeks * 200

  useEffect(() => {
    if (!listingId) return
    supabase.from("marketplace_listings").select("id,title,is_featured,featured_until").eq("id", listingId).single()
      .then(({ data }) => setListing(data))
  }, [listingId])

  const isFeatured = listing?.is_featured && listing?.featured_until && new Date(listing.featured_until) > new Date()
  const daysLeft = isFeatured ? Math.ceil((new Date(listing.featured_until)-new Date())/(1000*60*60*24)) : 0

  async function payToFeature() {
    if (!listing) return
    setPaying(true)
    try {
      // Create a feature payment record first
      const { data: payment, error: paymentError } = await supabase.from("featured_payments").insert({
        listing_id: listing.id,
        seller_id: user.id,
        amount,
        weeks,
        status: "pending",
      }).select("id").single()
      if (paymentError) throw paymentError

      // Call Pesapal edge function
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
          customerName: (profile?.first_name || "") + " " + (profile?.last_name || ""),
          description: `Feature "${listing.title}" for ${weeks} week(s)`
        })
      })
      const order = await res.json()
      if (order.redirect_url) {
        // Update payment record with Pesapal tracking ID
        await supabase.from("featured_payments").update({
          pesapal_tracking_id: order.order_tracking_id,
          status: "processing"
        }).eq("id", payment.id)
        // Redirect to Pesapal
        window.location.href = order.redirect_url
      } else {
        throw new Error(order.error || "Payment initiation failed")
      }
    } catch(err) { toast.error(err.message); setPaying(false) }
  }

  if (!listing) return <div style={{ color:"#888", fontSize:13 }}>Loading...</div>

  if (isFeatured) return (
    <div style={{ background:"#fff8f0", border:"1px solid #e6821e40", borderRadius:12, padding:"1rem" }}>
      <div style={{ fontFamily:"Syne", fontSize:13, fontWeight:700, color:"#e6821e", marginBottom:4 }}>⭐ Currently featured</div>
      <div style={{ fontSize:11, color:"#777777" }}>{daysLeft} day{daysLeft!==1?"s":""} remaining</div>
    </div>
  )

  return (
    <div style={{ background:"#ffffff", border:"1px solid #e6821e30", borderRadius:12, padding:"1.25rem" }}>
      <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:800, color:"#000000", marginBottom:4 }}>⭐ Feature this listing</div>
      <div style={{ fontSize:12, color:"#777777", marginBottom:12 }}>Featured listings appear at the top of browse and get 3x more views.</div>

      {[
        { icon:"⭐", text:"Pinned at top of all marketplace listings" },
        { icon:"📢", text:"Highlighted with Featured badge" },
        { icon:"👁", text:"3x more visibility than standard listings" },
      ].map((item,i)=>(
        <div key={i} style={{ display:"flex", gap:8, marginBottom:4 }}>
          <span style={{ flexShrink:0 }}>{item.icon}</span>
          <span style={{ fontSize:11, color:"#555555" }}>{item.text}</span>
        </div>
      ))}

      <div style={{ margin:"12px 0" }}>
        <div style={{ fontSize:11, color:"#666", marginBottom:8 }}>Select duration:</div>
        <div style={{ display:"flex", gap:8 }}>
          {[1,2,4].map(w=>(
            <button key={w} onClick={()=>setWeeks(w)}
              style={{ flex:1, background:weeks===w?"#e6821e":"#ffffff", border:`1px solid ${weeks===w?"#e6821e":"#555555"}`, borderRadius:8, color:weeks===w?"#fff":"#666", fontSize:12, padding:"8px 0", cursor:"pointer" }}>
              <div style={{ fontFamily:"Syne", fontWeight:700 }}>{w}wk</div>
              <div style={{ fontSize:10 }}>KES {w*200}</div>
            </button>
          ))}
        </div>
      </div>

      <button onClick={payToFeature} disabled={paying}
        style={{ width:"100%", background:paying?"#e0e0e0":"#e6821e", border:"none", borderRadius:9, color:paying?"#555":"#fff", fontFamily:"Syne,sans-serif", fontSize:13, fontWeight:700, padding:"12px", cursor:paying?"not-allowed":"pointer" }}>
        {paying?"Redirecting to payment...":"Pay KES "+amount+" — Feature listing"}
      </button>
    </div>
  )
}
