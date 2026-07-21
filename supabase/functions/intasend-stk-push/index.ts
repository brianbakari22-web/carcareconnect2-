import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
  try {
    const body = await req.json()
    const { booking_id, amount, phone, customer_id, provider_id, service_name } = body
    
    console.log("STK Push request:", JSON.stringify({ booking_id, amount, phone: phone?.substring(0,6)+"***", customer_id, provider_id, service_name }))
    
    if (!phone) throw new Error("Phone number is required")
    if (!amount || amount <= 0) throw new Error("Valid amount is required")
    
    const INTASEND_SECRET_KEY = Deno.env.get("INTASEND_SECRET_KEY")
    if (!INTASEND_SECRET_KEY) throw new Error("INTASEND_SECRET_KEY not configured")
    
    const INTASEND_ENV = Deno.env.get("INTASEND_ENV") || "sandbox"
    const BASE_URL = INTASEND_ENV === "production" 
      ? "https://payment.intasend.com" 
      : "https://sandbox.intasend.com"

    // Format phone
    let formattedPhone = String(phone).replace(/\s/g, "")
    if (formattedPhone.startsWith("0")) formattedPhone = "254" + formattedPhone.slice(1)
    if (formattedPhone.startsWith("+")) formattedPhone = formattedPhone.slice(1)
    if (!formattedPhone.startsWith("254")) formattedPhone = "254" + formattedPhone

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    )

    // Fetch processing fee rates
    const { data: settings } = await supabase
      .from("app_settings").select("key,value")
      .in("key", ["customer_processing_fee_rate", "ccc_processing_fee_rate", "provider_processing_fee_rate"])
    const S: Record<string, number> = {}
    settings?.forEach((s: any) => { S[s.key] = Number(s.value) / 100 })

    const customerFeeRate = S.customer_processing_fee_rate || 0.01
    const customerFee = Math.ceil(Number(amount) * customerFeeRate)
    const totalAmount = Number(amount) + customerFee

    console.log(`Amount: ${amount}, Fee: ${customerFee}, Total: ${totalAmount}, Phone: ${formattedPhone}`)

    // Initiate STK Push
    const response = await fetch(`${BASE_URL}/api/v1/payment/mpesa-stk-push/`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${INTASEND_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: totalAmount,
        phone_number: formattedPhone,
        api_ref: `CCC-${booking_id || Date.now()}`,
        narrative: `Payment for ${service_name || "Car Care Connect service"}`,
      })
    })

    const data = await response.json()
    console.log("IntaSend response:", JSON.stringify(data))
    
    if (!response.ok) throw new Error(data.detail || data.message || "STK Push failed")

    // Save transaction
    await supabase.from("payment_transactions").insert({
      user_id: customer_id,
      booking_id: booking_id || null,
      customer_id,
      provider_id,
      amount: Number(amount),
      processing_fee: customerFee,
      total_amount: totalAmount,
      phone: formattedPhone,
      payment_method: "intasend_mpesa",
      status: "pending",
      intasend_invoice_id: data.invoice?.invoice_id,
      intasend_ref: data.invoice?.api_ref,
      raw_response: data,
      metadata: {
        customer_fee_rate: customerFeeRate,
        intasend_total_fee_rate: 0.03
      }
    })

    return new Response(JSON.stringify({
      success: true,
      invoice_id: data.invoice?.invoice_id,
      message: "STK Push sent. Please check your phone.",
      total_amount: totalAmount,
      processing_fee: customerFee,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } })

  } catch (error) {
    console.error("STK Push error:", error.message)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    })
  }
})
