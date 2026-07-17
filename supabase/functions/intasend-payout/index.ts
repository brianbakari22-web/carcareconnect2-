import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })

  try {
    const { booking_id, provider_id, amount, phone, narrative } = await req.json()

    const INTASEND_SECRET_KEY = Deno.env.get("INTASEND_SECRET_KEY")
    const INTASEND_ENV = Deno.env.get("INTASEND_ENV") || "sandbox"
    const BASE_URL = INTASEND_ENV === "production"
      ? "https://payment.intasend.com"
      : "https://sandbox.intasend.com"

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    )

    // Format phone
    let formattedPhone = phone.replace(/\s/g, "")
    if (formattedPhone.startsWith("0")) formattedPhone = "254" + formattedPhone.slice(1)
    if (formattedPhone.startsWith("+")) formattedPhone = formattedPhone.slice(1)

    // Send B2C payout via IntaSend
    const response = await fetch(`${BASE_URL}/api/v1/send-money/mpesa/`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${INTASEND_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        currency: "KES",
        transactions: [{
          name: "Provider",
          account: formattedPhone,
          amount: amount,
          narrative: narrative || `CCC payout for booking ${booking_id}`,
        }]
      })
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.detail || "Payout failed")
    }

    // Log payout
    await supabase.from("payment_transactions").insert({
      booking_id,
      provider_id,
      amount,
      payment_method: "intasend_b2c",
      status: "pending",
      intasend_ref: data.tracking_id || data.id,
      raw_response: data,
      type: "payout",
    })

    console.log("Payout initiated:", data)

    return new Response(JSON.stringify({
      success: true,
      tracking_id: data.tracking_id || data.id,
      message: `Payout of KES ${amount} initiated to ${formattedPhone}`,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } })

  } catch (error) {
    console.error("Payout error:", error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    })
  }
})
