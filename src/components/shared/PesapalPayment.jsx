import { useState } from 'react'
import { getPesapalToken, registerIPN, submitOrder } from '../../lib/pesapal'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'

export default function PesapalPayment({ amount, bookingId, customerEmail, customerPhone, customerName, onSuccess, onCancel }) {
  const [loading, setLoading] = useState(false)

  async function initiatePayment() {
    setLoading(true)
    try {
      // Get token
      const token = await getPesapalToken()
      if (!token) throw new Error('Could not connect to payment gateway')

      // Register IPN
      const ipnId = await registerIPN(token)

      // Submit order
      const order = await submitOrder(token, ipnId, {
        amount,
        currency: 'KES',
        description: 'Car Care Connect booking payment',
        bookingId,
        customerEmail,
        customerPhone,
        customerName
      })

      if (order.redirect_url) {
        // Update booking with tracking ID
        await supabase.from('bookings').update({
          pesapal_tracking_id: order.order_tracking_id,
          payment_status: 'processing'
        }).eq('id', bookingId)

        // Redirect to Pesapal payment page
        window.location.href = order.redirect_url
      } else {
        throw new Error(order.error?.message || 'Payment initiation failed')
      }
    } catch(err) {
      toast.error(err.message || 'Payment failed. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div style={{ background:'#111', border:'1px solid #1e1e1e', borderRadius:12, padding:'1.25rem' }}>
      <div style={{ fontFamily:'Syne', fontSize:14, fontWeight:800, color:'#f0ede6', marginBottom:12 }}>
        💳 Complete Payment
      </div>

      <div style={{ background:'#0f0f0f', borderRadius:8, padding:'0.75rem', marginBottom:16 }}>
        <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:'#888', marginBottom:4 }}>
          <span>Service amount</span>
          <span>KES {Number(amount).toLocaleString()}</span>
        </div>
        <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:'#888', marginBottom:4 }}>
          <span>Processing fee (2.5%)</span>
          <span>KES {(Number(amount)*0.025).toFixed(0)}</span>
        </div>
        <div style={{ height:1, background:'#1e1e1e', margin:'6px 0' }}/>
        <div style={{ display:'flex', justifyContent:'space-between', fontSize:14, color:'#e6821e', fontWeight:700 }}>
          <span>Total</span>
          <span>KES {(Number(amount)*1.025).toFixed(0)}</span>
        </div>
      </div>

      <div style={{ fontSize:11, color:'#555', marginBottom:16, lineHeight:1.6 }}>
        You will be redirected to Pesapal to complete payment via M-Pesa, card, or bank transfer.
      </div>

      <button onClick={initiatePayment} disabled={loading}
        style={{ width:'100%', background:loading?'#333':'#e6821e', border:'none', borderRadius:10, color:loading?'#555':'#fff', fontFamily:'Syne,sans-serif', fontSize:14, fontWeight:700, padding:'13px', cursor:loading?'not-allowed':'pointer', marginBottom:8 }}>
        {loading?'Connecting to Pesapal...':'Pay KES '+(Number(amount)*1.025).toFixed(0)+' →'}
      </button>

      <button onClick={onCancel}
        style={{ width:'100%', background:'none', border:'1px solid #333', borderRadius:10, color:'#666', fontSize:13, padding:'11px', cursor:'pointer' }}>
        Cancel
      </button>
    </div>
  )
}

