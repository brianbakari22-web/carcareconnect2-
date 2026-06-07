import { useState } from "react"
import { supabase } from "../../lib/supabase"
import { useAuth } from "../../contexts/AuthContext"
import toast from "react-hot-toast"

export default function FeaturedListing({ listing, onSuccess }) {
  const { user, profile } = useAuth()
  const [weeks, setWeeks] = useState(1)
  const [paying, setPaying] = useState(false)
  const amount = weeks * 200

  const isFeatured = listing.is_featured && listing.featured_until && new Date(listing.featured_until) > new Date()
  const daysLeft = isFeatured ? Math.ceil((new Date(listing.featured_until)-new Date())/(1000*60*60*24)) : 0

  async function payToFeature() {
    setPaying(true)
    try {
      const ref = `FEAT-${Date.now()}-${user.id.slice(0,8)}`
      window.FlutterwaveCheckout({
        public_key: "FLWPUBK_TEST-7cc800b81b21b4d7075e716052932f32-X",
        tx_ref: ref,
        amount,
        currency: "KES",
        payment_options: "card,mpesa",
        customer: {
          email: user.email,
          name: `${profile?.first_name} ${profile?.last_name}`,
        },
        customizations: {
          title: "Feature your listing",
          description: `Feature "${listing.title}" for ${weeks} week(s)`,
        },
        callback: async (response) => {
          if (response.status==="successful") {
            await activateFeature(ref, response.transaction_id)
          } else {
            toast.error("Payment failed")
            setPaying(false)
          }
        },
        onclose: () => setPaying(false),
      })
    } catch(err) { toast.error(err.message); setPaying(false) }
  }

  async function activateFeature(ref, flwTxId) {
    try {
      const featuredUntil = new Date(Date.now()+weeks*7*24*60*60*1000).toISOString()
      await Promise.all([
        supabase.from("marketplace_listings").update({ is_featured:true, featured_until:featuredUntil }).eq("id",listing.id),
        supabase.from("featured_payments").insert({
          listing_id:listing.id, seller_id:user.id, amount, weeks,
          flw_transaction_id:flwTxId, flw_reference:ref, status:"paid",
        }),
      ])
      toast.success(`Listing featured for ${weeks} week(s)!`)
      if (onSuccess) onSuccess()
    } catch(err) { toast.error(err.message); setPaying(false) }
  }

  if (isFeatured) return (
    <div style={{ background:"#1a1208", border:"1px solid #e6821e40", borderRadius:12, padding:"1rem" }}>
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
              style={{ flex:1, background:weeks===w?"#e6821e":"#0f0f0f", border:`1px solid ${weeks===w?"#e6821e":"#333"}`, borderRadius:8, color:weeks===w?"#fff":"#666", fontSize:12, padding:"8px 0", cursor:"pointer" }}>
              <div style={{ fontFamily:"Syne", fontWeight:700 }}>{w}wk</div>
              <div style={{ fontSize:10 }}>KES {w*200}</div>
            </button>
          ))}
        </div>
      </div>

      <button onClick={payToFeature} disabled={paying}
        style={{ width:"100%", background:paying?"#333":"#e6821e", border:"none", borderRadius:9, color:paying?"#555":"#fff", fontFamily:"Syne,sans-serif", fontSize:13, fontWeight:700, padding:"12px", cursor:paying?"not-allowed":"pointer" }}>
        {paying?"Processing...":"Pay KES "+amount+" — Feature listing"}
      </button>
    </div>
  )
}

