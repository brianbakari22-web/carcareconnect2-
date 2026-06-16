import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"
import { useAuth } from "../../contexts/AuthContext"
import toast from "react-hot-toast"

export default function InspectionRequest({ listing, onSuccess }) {
  const { user, profile } = useAuth()
  const [paying, setPaying] = useState(false)
  const [scheduled, setScheduled] = useState("")
  const [existing, setExisting] = useState(null)

  useEffect(() => {
    supabase.from("inspection_requests").select("*").eq("listing_id",listing.id).maybeSingle()
      .then(({ data }) => setExisting(data))
  }, [listing.id])

  async function requestInspection() {
    if (!scheduled) return toast.error("Please select a preferred date")
    setPaying(true)
    try {
      // Create inspection request first
      const { data: insp, error } = await supabase.from("inspection_requests").insert({
        listing_id: listing.id,
        seller_id: user.id,
        status: "pending_payment",
        fee: 500,
        scheduled_date: scheduled,
      }).select("id").single()

      if (error) throw error

      // Pay via Pesapal
      const res = await fetch("https://gcnefnqtjxtqbhynyoxe.supabase.co/functions/v1/pesapal-payment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdjbmVmbnF0anh0cWJoeW55b3hlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2MDg0MzIsImV4cCI6MjA5NTE4NDQzMn0.Ybyce3psBj2I-hdoF95H5UAklr6hsgQi-mciI9uMIgc"
        },
        body: JSON.stringify({
          amount: 500,
          bookingId: insp.id,
          customerEmail: user.email,
          customerPhone: profile?.phone || "",
          customerName: (profile?.first_name||"") + " " + (profile?.last_name||"")
        })
      })

      const order = await res.json()
      if (order.redirect_url) {
        window.location.href = order.redirect_url
      } else {
        throw new Error(order.error || "Payment failed")
      }
    } catch(e) {
      toast.error(e.message || "Failed to initiate payment")
      setPaying(false)
    }
  }

  if (existing && existing.status !== "pending_payment") return (
    <div style={{ background:"#f0fdf4", border:"1px solid #1d9e7540", borderRadius:10, padding:"1rem" }}>
      <div style={{ fontSize:13, color:"#1d9e75", fontWeight:600, marginBottom:4 }}>✓ Inspection requested</div>
      <div style={{ fontSize:11, color:"#777777" }}>Status: {existing.status}</div>
      {existing.scheduled_date&&<div style={{ fontSize:11, color:"#777777" }}>Scheduled: {existing.scheduled_date}</div>}
      {existing.result&&<div style={{ fontSize:12, color:existing.result==="passed"?"#1d9e75":"#e24b4a", marginTop:4, fontWeight:600 }}>Result: {existing.result}</div>}
    </div>
  )

  return (
    <div style={{ background:"#ffffff", border:"1px solid #eeeeee", borderRadius:12, padding:"1.25rem" }}>
      <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:800, color:"#000000", marginBottom:4 }}>🔍 CCC Vehicle Inspection</div>
      <div style={{ fontSize:12, color:"#777777", marginBottom:16, lineHeight:1.6 }}>
        Get your vehicle inspected by a CCC certified mechanic. Once passed, your listing will show a verified badge and buyers can make offers.
      </div>

      <div style={{ background:"#ffffff", borderRadius:8, padding:"0.75rem", marginBottom:16 }}>
        <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, color:"#555555", marginBottom:4 }}>
          <span>Inspection fee</span><span>KES 500</span>
        </div>
        <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, color:"#555555" }}>
          <span>Processing fee (2.5%)</span><span>KES 13</span>
        </div>
        <div style={{ height:1, background:"#f0f0f0", margin:"6px 0" }}/>
        <div style={{ display:"flex", justifyContent:"space-between", fontSize:13, color:"#e6821e", fontWeight:700 }}>
          <span>Total</span><span>KES 513</span>
        </div>
      </div>

      <div style={{ marginBottom:16 }}>
        <label style={{ fontSize:11, color:"#666", display:"block", marginBottom:4 }}>Preferred inspection date</label>
        <input type="date" value={scheduled} onChange={e=>setScheduled(e.target.value)}
          min={new Date().toISOString().split("T")[0]}
          style={{ width:"100%", background:"#ffffff", border:"1px solid #e5e5e5", borderRadius:8, padding:"9px 12px", color:"#000000", fontSize:12, outline:"none" }}/>
      </div>

      <button onClick={requestInspection} disabled={paying||!scheduled}
        style={{ width:"100%", background:paying||!scheduled?"#555555":"#e6821e", border:"none", borderRadius:10, color:paying||!scheduled?"#555":"#fff", fontFamily:"Syne,sans-serif", fontSize:13, fontWeight:700, padding:"12px", cursor:paying||!scheduled?"not-allowed":"pointer" }}>
        {paying?"Connecting to Pesapal...":"Pay KES 513 & Request Inspection →"}
      </button>
    </div>
  )
}

