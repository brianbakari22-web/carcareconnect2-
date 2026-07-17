import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })

  try {
    const { booking_id, amount, phone, customer_id, provider_id, service_name } = await req.json()

    const INTASEND_SECRET_KEY = Deno.env.get("INTASEND_SECRET_KEY")
    const INTASEND_ENV = Deno.env.get("INTASEND_ENV") || "sandbox"
    const BASE_URL = INTASEND_ENV === "production" 
      ? "https://payment.intasend.com" 
      : "https://sandbox.intasend.com"

    // Format phone - ensure it starts with 254
    let formattedPhone = phone.replace(/\s/g, "")
    if (formattedPhone.startsWith("0")) formattedPhone = "254" + formattedPhone.slice(1)
    if (formattedPhone.startsWith("+")) formattedPhone = formattedPhone.slice(1)

    // Get commission rates
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    )

    const { data: rates } = await supabase
      .from("commission_rates")
      .select("*")
      .single()

    const processingFeeRate = rates?.processing_fee_rate || 0.01
    const customerFee = Math.ceil(amount * processingFeeRate)
    const totalAmount = amount + customerFee

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
        api_ref: `CCC-${booking_id}`,
        narrative: `Payment for ${service_name || "Car Care Connect service"}`,
      })
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.detail || "STK Push failed")
    }

    // Save transaction to DB
    await supabase.from("payment_transactions").insert({
      booking_id,
      customer_id,
      provider_id,
      amount,
      processing_fee: customerFee,
      total_amount: totalAmount,
      phone: formattedPhone,
      payment_method: "intasend_mpesa",
      status: "pending",
      intasend_invoice_id: data.invoice?.invoice_id,
      intasend_ref: data.invoice?.api_ref,
      raw_response: data,
    })

    return new Response(JSON.stringify({
      success: true,
      invoice_id: data.invoice?.invoice_id,
      message: "STK Push sent. Please check your phone.",
      total_amount: totalAmount,
      processing_fee: customerFee,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    })
  }
})
