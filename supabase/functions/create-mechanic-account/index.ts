import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }
  try {
    const { first_name, last_name, phone, email, provider_id } = await req.json()
    if (!first_name || !provider_id) {
      return new Response(JSON.stringify({ success: false, error: "Missing required fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
      })
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    )
    // Create auth user with email confirmed
    const authEmail = email || `mechanic-${crypto.randomUUID()}@internal.carcareconnect.care`
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: authEmail,
      email_confirm: true,
      user_metadata: { role: "mechanic", first_name, last_name, phone }
    })
    if (authError) {
      console.error("Auth error:", authError.message)
      return new Response(JSON.stringify({ success: false, error: authError.message }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
      })
    }
    const userId = authData.user.id
    // Wait for webhook to fire and create profile
    await new Promise(resolve => setTimeout(resolve, 1000))
    // Upsert profile directly (mechanic accounts bypass email verification flow)
    const { error: profileError } = await supabase.from("profiles").upsert({
      id: userId,
      first_name,
      last_name: last_name || "",
      role: "mechanic",
      is_active: true,
    })
    if (profileError) console.error("Profile error:", profileError.message)
    // Upsert profile_sensitive
    const { error: sensitiveError } = await supabase.from("profile_sensitive").upsert({
      id: userId,
      phone: phone || null,
      email: authEmail,
    })
    if (sensitiveError) console.error("Sensitive error:", sensitiveError.message)
    console.log("Mechanic account created:", userId, first_name, last_name)
    return new Response(JSON.stringify({ success: true, user_id: userId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    })
  } catch (err: any) {
    console.error("Error:", err.message)
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    })
  }
})
