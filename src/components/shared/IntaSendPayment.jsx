import { useState } from "react"
import { supabase } from "../../lib/supabase"
import { useAuth } from "../../contexts/AuthContext"
import toast from "react-hot-toast"
export default function IntaSendPayment({ amount, bookingId, orderId, providerId, description, onSuccess, onClose }) {
  const { user, profile } = useAuth()
  const [phone, setPhone] = useState(profile?.phone || "")
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState("input")
  const processingFeeRate = 0.01
  const processingFee = Math.ceil(amount * processingFeeRate)
  const totalAmount = amount + processingFee
  async function initiatePayment() {
    if (!phone || phone.length < 10) return toast.error("Please enter a valid M-Pesa number")
    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke("daraja-stk-push", {
        body: {
          booking_id: bookingId,
          amount: totalAmount,
          phone,
          account_ref: bookingId?.substring(0, 12) || "CCC",
          description: description || "Car Care Connect service",
        }
      })
      if (error) throw error
      if (data.error) throw new Error(data.error)
      const checkoutRequestId = data.checkout_request_id
      setStep("waiting")
      toast.success("Check your phone for M-Pesa prompt!")
      // Poll for payment status every 5 seconds
      const interval = setInterval(async () => {
        try {
          // First check DB
          const { data: txn } = await supabase
            .from("payment_transactions")
            .select("status, mpesa_code")
            .eq("checkout_request_id", checkoutRequestId)
            .eq("status", "completed")
            .maybeSingle()
          if (txn) {
            clearInterval(interval)
            setStep("success")
            setTimeout(() => onSuccess && onSuccess(), 2000)
            return
          }
          // Also query Daraja directly
          const { data: queryData } = await supabase.functions.invoke("daraja-stk-query", {
            body: { checkout_request_id: checkoutRequestId, booking_id: bookingId }
          })
          if (queryData?.status === "completed") {
            clearInterval(interval)
            setStep("success")
            setTimeout(() => onSuccess && onSuccess(), 2000)
          } else if (queryData?.status === "cancelled") {
            clearInterval(interval)
            setStep("failed")
          }
        } catch(e) {}
      }, 5000)
      setTimeout(() => {
        clearInterval(interval)
        if (step === "waiting") setStep("failed")
      }, 120000)
    } catch (e) {
      toast.error(e.message || "Payment failed. Please try again.")
      setStep("input")
    } finally {
      setLoading(false)
    }
  }
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:"1rem" }}>
      <div style={{ background:"#fff", borderRadius:16, padding:"1.5rem", width:"100%", maxWidth:380, fontFamily:"DM Sans,sans-serif" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"1.25rem" }}>
          <div>
            <div style={{ fontFamily:"Syne", fontSize:16, fontWeight:800 }}>Pay with M-Pesa</div>
            <div style={{ fontSize:12, color:"#888" }}>Secure payment via Safaricom Daraja</div>
          </div>
          <button onClick={onClose} style={{ background:"none", border:"none", fontSize:20, cursor:"pointer", color:"#888" }}>×</button>
        </div>
        <div style={{ background:"#f8f8f8", borderRadius:10, padding:"1rem", marginBottom:"1.25rem" }}>
          <div style={{ display:"flex", justifyContent:"space-between", fontSize:13, marginBottom:4 }}>
            <span style={{ color:"#666" }}>{description||"Service amount"}</span>
            <span>KES {amount.toLocaleString()}</span>
          </div>
          <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, marginBottom:4 }}>
            <span style={{ color:"#888" }}>M-Pesa processing fee (1%)</span>
            <span style={{ color:"#888" }}>KES {processingFee.toLocaleString()}</span>
          </div>
          <div style={{ borderTop:"1px solid #eee", paddingTop:8, marginTop:4, display:"flex", justifyContent:"space-between", fontWeight:700, fontSize:15 }}>
            <span>Total</span>
            <span style={{ color:"#e6821e" }}>KES {totalAmount.toLocaleString()}</span>
          </div>
        </div>
        {step === "input" && (
          <div>
            <label style={{ fontSize:12, color:"#666", display:"block", marginBottom:4 }}>M-Pesa Phone Number</label>
            <input
              type="tel"
              placeholder="07XX XXX XXX"
              value={phone}
              onChange={e=>setPhone(e.target.value)}
              style={{ width:"100%", padding:"12px", borderRadius:8, border:"1px solid #ddd", fontSize:14, marginBottom:"1rem", boxSizing:"border-box" }}
            />
            <button onClick={initiatePayment} disabled={loading}
              style={{ width:"100%", background:loading?"#ccc":"#e6821e", border:"none", borderRadius:10, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:14, fontWeight:700, padding:"14px", cursor:loading?"not-allowed":"pointer" }}>
              {loading ? "Sending prompt..." : `Pay KES ${totalAmount.toLocaleString()}`}
            </button>
            <div style={{ fontSize:11, color:"#aaa", textAlign:"center", marginTop:8 }}>
              You will receive an M-Pesa STK Push on your phone
            </div>
          </div>
        )}
        {step === "waiting" && (
          <div style={{ textAlign:"center", padding:"1rem" }}>
            <div style={{ fontSize:40, marginBottom:12 }}>📱</div>
            <div style={{ fontFamily:"Syne", fontSize:15, fontWeight:700, marginBottom:8 }}>Check your phone</div>
            <div style={{ fontSize:13, color:"#666", marginBottom:16 }}>Enter your M-Pesa PIN to complete payment of KES {totalAmount.toLocaleString()}</div>
            <div style={{ fontSize:12, color:"#aaa" }}>Waiting for confirmation...</div>
          </div>
        )}
        {step === "success" && (
          <div style={{ textAlign:"center", padding:"1rem" }}>
            <div style={{ fontSize:40, marginBottom:12 }}>✅</div>
            <div style={{ fontFamily:"Syne", fontSize:15, fontWeight:700, marginBottom:8 }}>Payment successful!</div>
            <div style={{ fontSize:13, color:"#666" }}>Your booking is confirmed.</div>
          </div>
        )}
        {step === "failed" && (
          <div style={{ textAlign:"center", padding:"1rem" }}>
            <div style={{ fontSize:40, marginBottom:12 }}>❌</div>
            <div style={{ fontFamily:"Syne", fontSize:15, fontWeight:700, marginBottom:8 }}>Payment not received</div>
            <div style={{ fontSize:13, color:"#666", marginBottom:16 }}>Please try again or use a different number.</div>
            <button onClick={()=>setStep("input")}
              style={{ background:"#e6821e", border:"none", borderRadius:8, color:"#fff", fontSize:13, fontWeight:700, padding:"10px 24px", cursor:"pointer" }}>
              Try again
            </button>
          </div>
        )}
        <div style={{ fontSize:10, color:"#bbb", textAlign:"center", marginTop:"1rem" }}>
          Powered by Safaricom M-Pesa Daraja API
        </div>
      </div>
    </div>
  )
}


