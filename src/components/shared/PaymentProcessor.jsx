import { useState } from "react"
import { supabase } from "../../lib/supabase"
import { useAuth } from "../../contexts/AuthContext"
import toast from "react-hot-toast"

export default function PaymentProcessor({ 
  amount, 
  bookingId = null, 
  orderId = null,
  description = "Car Care Connect Payment",
  onSuccess,
  onCancel
}) {
  const { user, profile } = useAuth()
  const [loading, setLoading] = useState(false)
  const [phone, setPhone] = useState(profile?.phone || "")
  const [step, setStep] = useState("input") // input | waiting | success | failed

  async function initiatePay() {
    if (!phone) return toast.error("Please enter your M-Pesa phone number")
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch("https://gcnefnqtjxtqbhynyoxe.supabase.co/functions/v1/daraja-stk-push", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ phone, amount, bookingId, orderId, description })
      })
      const data = await res.json()

      if (data.ResponseCode === "0") {
        setStep("waiting")
        toast.success("Check your phone for M-Pesa prompt!")
        // Poll for payment status
        pollPaymentStatus(data.CheckoutRequestID)
      } else {
        toast.error(data.errorMessage || data.ResponseDescription || "Payment failed to initiate")
        setStep("failed")
      }
    } catch (err) {
      toast.error("Payment error: " + err.message)
      setStep("failed")
    } finally {
      setLoading(false)
    }
  }

  async function pollPaymentStatus(checkoutRequestId, attempts = 0) {
    if (attempts > 20) {
      toast.error("Payment timeout. Please check your M-Pesa messages.")
      setStep("failed")
      return
    }
    await new Promise(r => setTimeout(r, 3000)) // Wait 3 seconds
    const { data } = await supabase
      .from("payment_transactions")
      .select("status, mpesa_code, amount_paid")
      .eq("checkout_request_id", checkoutRequestId)
      .single()

    if (data?.status === "completed") {
      setStep("success")
      toast.success(`Payment confirmed! M-Pesa code: ${data.mpesa_code}`)
      if (onSuccess) onSuccess({ mpesaCode: data.mpesa_code, amount: data.amount_paid })
    } else if (data?.status === "failed" || data?.status === "cancelled") {
      setStep("failed")
      toast.error(data.status === "cancelled" ? "Payment cancelled" : "Payment failed")
    } else {
      pollPaymentStatus(checkoutRequestId, attempts + 1)
    }
  }

  return (
    <div style={{ fontFamily:"DM Sans,sans-serif" }}>
      {step === "input" && (
        <div>
          <div style={{ background:"#f0fdf4", border:"1px solid #1d9e7540", borderRadius:12, padding:"1rem", marginBottom:"1rem", display:"flex", alignItems:"center", gap:10 }}>
            <span style={{ fontSize:24 }}>📱</span>
            <div>
              <div style={{ fontSize:13, fontWeight:700, color:"#1d9e75" }}>Pay via M-Pesa</div>
              <div style={{ fontSize:11, color:"#555" }}>You will receive a prompt on your phone</div>
            </div>
          </div>
          <div style={{ marginBottom:"1rem" }}>
            <label style={{ fontSize:12, color:"#666", display:"block", marginBottom:4 }}>M-Pesa Phone Number</label>
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="07XX XXX XXX"
              style={{ width:"100%", padding:"12px 14px", border:"1px solid #e0e0e0", borderRadius:9, fontSize:15, outline:"none", fontFamily:"DM Sans,sans-serif" }}
            />
          </div>
          <div style={{ background:"#fff8f0", border:"1px solid #e6821e30", borderRadius:10, padding:"0.75rem", marginBottom:"1rem", display:"flex", justifyContent:"space-between" }}>
            <span style={{ fontSize:13, color:"#666" }}>Amount to pay</span>
            <span style={{ fontSize:15, fontWeight:800, color:"#e6821e", fontFamily:"Syne,sans-serif" }}>KES {parseFloat(amount).toLocaleString()}</span>
          </div>
          <button onClick={initiatePay} disabled={loading}
            style={{ width:"100%", background:loading?"#ccc":"#e6821e", border:"none", borderRadius:10, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:15, fontWeight:700, padding:"14px", cursor:loading?"not-allowed":"pointer" }}>
            {loading ? "Initiating..." : `Pay KES ${parseFloat(amount).toLocaleString()} via M-Pesa`}
          </button>
          {onCancel && (
            <button onClick={onCancel} style={{ width:"100%", background:"none", border:"1px solid #ddd", borderRadius:10, color:"#555", fontSize:13, padding:"11px", cursor:"pointer", marginTop:8 }}>
              Cancel
            </button>
          )}
        </div>
      )}

      {step === "waiting" && (
        <div style={{ textAlign:"center", padding:"2rem" }}>
          <div style={{ fontSize:48, marginBottom:16 }}>📱</div>
          <div style={{ fontFamily:"Syne,sans-serif", fontSize:18, fontWeight:800, marginBottom:8 }}>Check your phone</div>
          <div style={{ fontSize:13, color:"#666", marginBottom:16, lineHeight:1.6 }}>
            An M-Pesa payment request of <strong>KES {parseFloat(amount).toLocaleString()}</strong> has been sent to <strong>{phone}</strong>.<br/>
            Enter your M-Pesa PIN to complete payment.
          </div>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:8, color:"#888", fontSize:12 }}>
            <div style={{ width:8, height:8, borderRadius:"50%", background:"#e6821e", animation:"pulse 1s infinite" }}/>
            Waiting for payment confirmation...
          </div>
          <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}`}</style>
        </div>
      )}

      {step === "success" && (
        <div style={{ textAlign:"center", padding:"2rem" }}>
          <div style={{ fontSize:48, marginBottom:16 }}>✅</div>
          <div style={{ fontFamily:"Syne,sans-serif", fontSize:18, fontWeight:800, color:"#1d9e75", marginBottom:8 }}>Payment Confirmed!</div>
          <div style={{ fontSize:13, color:"#666" }}>Your M-Pesa payment was successful.</div>
        </div>
      )}

      {step === "failed" && (
        <div style={{ textAlign:"center", padding:"2rem" }}>
          <div style={{ fontSize:48, marginBottom:16 }}>❌</div>
          <div style={{ fontFamily:"Syne,sans-serif", fontSize:18, fontWeight:800, color:"#e24b4a", marginBottom:8 }}>Payment Failed</div>
          <div style={{ fontSize:13, color:"#666", marginBottom:16 }}>Please try again.</div>
          <button onClick={()=>setStep("input")}
            style={{ background:"#e6821e", border:"none", borderRadius:10, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:14, fontWeight:700, padding:"12px 24px", cursor:"pointer" }}>
            Try Again
          </button>
        </div>
      )}
    </div>
  )
}
