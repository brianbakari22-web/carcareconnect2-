import { useState } from "react"
import { supabase } from "../../lib/supabase"
import toast from "react-hot-toast"

export default function PesapalPayment({ amount, bookingId, customerEmail, customerPhone, customerName, onSuccess, onCancel }) {
  const [loading, setLoading] = useState(false)

  async function initiatePayment() {
    setLoading(true)
    try {
      const res = await fetch("https://gcnefnqtjxtqbhynyoxe.supabase.co/functions/v1/pesapal-payment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdjbmVmbnF0anh0cWJoeW55b3hlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2MDg0MzIsImV4cCI6MjA5NTE4NDQzMn0.Ybyce3psBj2I-hdoF95H5UAklr6hsgQi-mciI9uMIgc"
        },
        body: JSON.stringify({ amount, bookingId, customerEmail, customerPhone, customerName })
      })
      const order = await res.json()

      if (order.redirect_url) {
        await supabase.from("bookings").update({
          pesapal_tracking_id: order.order_tracking_id,
          payment_status: "processing"
        }).eq("id", bookingId)
        window.location.href = order.redirect_url
      } else {
        throw new Error(typeof order.error === "object" ? JSON.stringify(order.error) : order.error || "Payment initiation failed")
      }
    } catch(e) {
      toast.error(e.message || "Payment failed. Please try again.")
      setLoading(false)
    }
  }

  return (
    <div style={{ background:"#ffffff", border:"1px solid #eeeeee", borderRadius:12, padding:"1.25rem" }}>
      <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:800, color:"#000000", marginBottom:12 }}>
        💳 Complete Payment
      </div>
      <div style={{ background:"#ffffff", borderRadius:8, padding:"0.75rem", marginBottom:16 }}>
        <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, color:"#555555", marginBottom:4 }}>
          <span>Service amount</span>
          <span>KES {Number(amount).toLocaleString()}</span>
        </div>
        <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, color:"#555555", marginBottom:4 }}>
          <span>Processing fee (2.5%)</span>
          <span>KES {(Number(amount)*0.025).toFixed(0)}</span>
        </div>
        <div style={{ height:1, background:"#f0f0f0", margin:"6px 0" }}/>
        <div style={{ display:"flex", justifyContent:"space-between", fontSize:14, color:"#e6821e", fontWeight:700 }}>
          <span>Total</span>
          <span>KES {(Number(amount)*1.025).toFixed(0)}</span>
        </div>
      </div>
      <div style={{ fontSize:11, color:"#777777", marginBottom:16, lineHeight:1.6 }}>
        You will be redirected to Pesapal to complete payment via M-Pesa, card, or bank transfer.
      </div>
      <button onClick={initiatePayment} disabled={loading}
        style={{ width:"100%", background:loading?"#333":"#e6821e", border:"none", borderRadius:10, color:loading?"#555":"#fff", fontFamily:"Syne,sans-serif", fontSize:14, fontWeight:700, padding:"13px", cursor:loading?"not-allowed":"pointer", marginBottom:8 }}>
        {loading?"Connecting to Pesapal...":"Pay KES "+(Number(amount)*1.025).toFixed(0)+" →"}
      </button>
      <button onClick={onCancel}
        style={{ width:"100%", background:"none", border:"1px solid #dddddd", borderRadius:10, color:"#666", fontSize:13, padding:"11px", cursor:"pointer" }}>
        Cancel
      </button>
    </div>
  )
}


