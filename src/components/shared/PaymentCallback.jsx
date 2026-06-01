import { useEffect, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { supabase } from "../../lib/supabase"
import toast from "react-hot-toast"

export default function PaymentCallback() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [status, setStatus] = useState("processing")

  useEffect(() => {
    const trackingId = searchParams.get("OrderTrackingId")
    const merchantRef = searchParams.get("OrderMerchantReference")

    if (trackingId && merchantRef) {
      verifyPayment(trackingId, merchantRef)
    } else {
      setStatus("failed")
    }
  }, [])

  async function verifyPayment(trackingId, merchantRef) {
    try {
      // Check if this is a GO callout payment
      const goBookingId = sessionStorage.getItem("go_booking_id")
      const goProviderId = sessionStorage.getItem("go_provider_id")
      const isGoPayment = goBookingId === merchantRef

      const res = await fetch("https://gcnefnqtjxtqbhynyoxe.supabase.co/functions/v1/pesapal-verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdjbmVmbnF0anh0cWJoeW55b3hlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2MDg0MzIsImV4cCI6MjA5NTE4NDQzMn0.Ybyce3psBj2I-hdoF95H5UAklr6hsgQi-mciI9uMIgc"
        },
        body: JSON.stringify({ trackingId, merchantRef })
      })
      const data = await res.json()

      if (data.payment_status_description === "Completed") {
        if (isGoPayment) {
          // GO callout payment - mark paid and create go_service_request
          await supabase.from("bookings").update({
            go_callout_paid: true,
            pesapal_tracking_id: trackingId,
            payment_status: "partial"
          }).eq("id", merchantRef)

          await supabase.from("go_service_requests").insert({
            booking_id: merchantRef,
            provider_id: goProviderId,
            status: "pending",
            attempt_number: 1,
          })

          // Notify provider
          const { data: bk } = await supabase.from("bookings").select("emergency_type, emergency_location_address, profiles!bookings_customer_id_fkey(first_name,last_name)").eq("id", merchantRef).single()
          await supabase.from("notifications").insert({
            user_id: goProviderId,
            title: "🚨 Emergency GO Service request!",
            message: "Emergency: "+(bk?.emergency_type||"").replace(/_/g," ")+" at "+(bk?.emergency_location_address||"").slice(0,60)+". Callout fee paid.",
            type: "error"
          })

          sessionStorage.removeItem("go_booking_id")
          sessionStorage.removeItem("go_provider_id")
          setStatus("success")
          toast.success("Payment successful! Finding mechanic...")
          setTimeout(() => navigate("/dashboard/emergency"), 3000)
        } else {
          await supabase.from("bookings").update({
            payment_status: "paid",
            pesapal_tracking_id: trackingId
          }).eq("id", merchantRef)
          setStatus("success")
          toast.success("Payment successful!")
          setTimeout(() => navigate("/dashboard/bookings"), 3000)
        }
      } else {
        setStatus("failed")
        toast.error("Payment not completed")
        setTimeout(() => navigate("/dashboard/bookings"), 3000)
      }
    } catch(e) {
      setStatus("failed")
      setTimeout(() => navigate("/dashboard/bookings"), 3000)
    }
  }

  return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"#0a0a0a", padding:"1rem" }}>
      <div style={{ textAlign:"center", maxWidth:400 }}>
        {status==="processing"&&(
          <>
            <div style={{ fontSize:48, marginBottom:16 }}>⏳</div>
            <div style={{ fontFamily:"Syne", fontSize:20, fontWeight:800, color:"#f0ede6", marginBottom:8 }}>Verifying payment...</div>
            <div style={{ fontSize:13, color:"#555" }}>Please wait while we confirm your payment</div>
          </>
        )}
        {status==="success"&&(
          <>
            <div style={{ fontSize:48, marginBottom:16 }}>✅</div>
            <div style={{ fontFamily:"Syne", fontSize:20, fontWeight:800, color:"#1d9e75", marginBottom:8 }}>Payment successful!</div>
            <div style={{ fontSize:13, color:"#555" }}>Redirecting to your bookings...</div>
          </>
        )}
        {status==="failed"&&(
          <>
            <div style={{ fontSize:48, marginBottom:16 }}>❌</div>
            <div style={{ fontFamily:"Syne", fontSize:20, fontWeight:800, color:"#e24b4a", marginBottom:8 }}>Payment failed</div>
            <div style={{ fontSize:13, color:"#555" }}>Redirecting to your bookings...</div>
          </>
        )}
      </div>
    </div>
  )
}

