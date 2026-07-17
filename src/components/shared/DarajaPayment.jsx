import { useState } from "react"
import { supabase } from "../../lib/supabase"
import { useAuth } from "../../contexts/AuthContext"
import toast from "react-hot-toast"

export default function DarajaPayment({ amount, bookingId, orderId, customerPhone, customerName, description, onSuccess, onClose }) {
  const { user } = useAuth()
  const [phone, setPhone] = useState(customerPhone || "")
  const [loading, setLoading] = useState(false)
  const [waiting, setWaiting] = useState(false)
  const [checkoutRequestId, setCheckoutRequestId] = useState(null)

  async function handlePay() {
    if (!phone) return toast.error("Enter your M-Pesa phone number")
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const { data: res, error: resErr } = await supabase.functions.invoke("intasend-stk-push", {
        body: { phone, amount, bookingId, orderId, description: description || "Car Care Connect Payment" }
      })
      const data = await res.json()
      if (data.ResponseCode === "0") {
        setCheckoutRequestId(data.CheckoutRequestID)
        setWaiting(true)
        toast.success("Check your phone for M-Pesa prompt!")
        // Poll for payment status
        pollPaymentStatus(data.CheckoutRequestID)
      } else {
        toast.error(data.errorMessage || data.ResponseDescription || "Payment failed. Try again.")
      }
    } catch(e) {
      toast.error("Payment failed. Check your connection.")
    } finally {
      setLoading(false)
    }
  }

  async function pollPaymentStatus(checkoutId, attempts = 0) {
    if (attempts > 10) {
      toast.error("Payment timeout. Check your M-Pesa messages.")
      setWaiting(false)
      return
    }
    await new Promise(r => setTimeout(r, 5000)) // Wait 5 seconds
    const { data } = await supabase.from("payment_transactions")
      .select("status, mpesa_code, amount_paid")
      .eq("checkout_request_id", checkoutId)
      .single()
    if (data?.status === "completed") {
      toast.success("Payment confirmed! M-Pesa code: " + data.mpesa_code)
      setWaiting(false)
      if (onSuccess) onSuccess({ mpesaCode: data.mpesa_code, amount: data.amount_paid })
    } else if (data?.status === "failed" || data?.status === "cancelled") {
      toast.error(data.status === "cancelled" ? "Payment cancelled." : "Payment failed.")
      setWaiting(false)
    } else {
      pollPaymentStatus(checkoutId, attempts + 1)
    }
  }

  return (
    <div style={{ padding:"1.5rem", maxWidth:400, margin:"0 auto" }}>
      <div style={{ textAlign:"center", marginBottom:"1.5rem" }}>
        <div style={{ fontSize:36, marginBottom:8 }}>📱</div>
        <div style={{ fontFamily:"Syne", fontSize:18, fontWeight:800, color:"#000" }}>Pay with M-Pesa</div>
        <div style={{ fontSize:13, color:"#666", marginTop:4 }}>KES {Number(amount).toLocaleString()}</div>
      </div>

      {waiting ? (
        <div style={{ textAlign:"center", padding:"2rem" }}>
          <div style={{ fontSize:48, marginBottom:16 }}>📲</div>
          <div style={{ fontFamily:"Syne", fontSize:16, fontWeight:700, marginBottom:8 }}>Check your phone</div>
          <div style={{ fontSize:13, color:"#666", marginBottom:16 }}>Enter your M-Pesa PIN to complete payment</div>
          <div style={{ display:"flex", gap:6, justifyContent:"center", marginBottom:16 }}>
            {[0,1,2].map(i => (
              <div key={i} style={{ width:10, height:10, borderRadius:"50%", background:"#4CAF50", animation:`pulse 1.4s ease-in-out ${i*0.2}s infinite` }}/>
            ))}
          </div>
          <div style={{ fontSize:11, color:"#999" }}>Waiting for confirmation...</div>
          <button onClick={()=>setWaiting(false)}
            style={{ marginTop:16, background:"none", border:"1px solid #ddd", borderRadius:8, padding:"8px 16px", color:"#888", cursor:"pointer", fontSize:12 }}>
            Cancel
          </button>
        </div>
      ) : (
        <>
          <div style={{ marginBottom:16 }}>
            <label style={{ fontSize:12, color:"#666", display:"block", marginBottom:6 }}>M-Pesa Phone Number</label>
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="07XX XXX XXX"
              style={{ width:"100%", padding:"12px 14px", borderRadius:10, border:"1px solid #e0e0e0", fontSize:15, outline:"none", boxSizing:"border-box" }}
            />
            <div style={{ fontSize:11, color:"#999", marginTop:4 }}>Format: 07XX XXX XXX or 254XXXXXXXXX</div>
          </div>

          <button onClick={handlePay} disabled={loading || !phone}
            style={{ width:"100%", background:loading||!phone?"#ccc":"#4CAF50", border:"none", borderRadius:12, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:15, fontWeight:700, padding:"15px", cursor:loading||!phone?"not-allowed":"pointer", marginBottom:12 }}>
            {loading ? "Sending prompt..." : `Pay KES ${Number(amount).toLocaleString()} via M-Pesa`}
          </button>

          <div style={{ textAlign:"center", fontSize:11, color:"#999" }}>
            🔒 Secured by Safaricom M-Pesa · CBK Regulated
          </div>

          {onClose && (
            <button onClick={onClose}
              style={{ width:"100%", background:"none", border:"1px solid #ddd", borderRadius:10, color:"#888", fontSize:13, padding:"10px", cursor:"pointer", marginTop:8 }}>
              Cancel
            </button>
          )}
        </>
      )}

      <style>{`
        @keyframes pulse {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.3; }
          40% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  )
}