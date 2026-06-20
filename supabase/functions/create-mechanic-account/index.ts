import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

Deno.serve(async (req) => {
  try {
    const { first_name, last_name, phone, email, provider_id } = await req.json()

    if (!first_name || !provider_id) {
      return new Response(JSON.stringify({ success: false, error: "Missing required fields" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      })
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    )

    const authEmail = email || `mechanic-${crypto.randomUUID()}@internal.carcareconnect.care`

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: authEmail,
      email_confirm: true,
      user_metadata: { role: "mechanic", first_name, last_name }
    })

    if (authError) {
      console.error("Auth user creation error:", authError.message)
      return new Response(JSON.stringify({ success: false, error: authError.message }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      })
    }

    const userId = authData.user.id

    // A database trigger auto-creates the profiles row from user_metadata on auth.users insert.
    // Give it a brief moment, then update it with any fields the trigger might not set (business_name).
    await new Promise(resolve => setTimeout(resolve, 500))

    const { error: profileError } = await supabase.from("profiles")
      .update({ business_name: first_name + " " + last_name })
      .eq("id", userId)

    if (profileError) {
      console.error("Profile update error:", profileError.message)
    }

    // Save phone to profile_sensitive
    const { error: sensitiveError } = await supabase.from("profile_sensitive").upsert({
      id: userId,
      phone: phone || null,
      email: email || null,
    })

    if (sensitiveError) {
      console.error("profile_sensitive error:", sensitiveError.message)
    }

    return new Response(JSON.stringify({ success: true, user_id: userId }), {
      headers: { "Content-Type": "application/json" }
    })
  } catch (err) {
    console.error("Error:", err.message)
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    })
  }
})