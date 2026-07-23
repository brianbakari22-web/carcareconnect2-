import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
  try {
    const payload = await req.json()
    console.log("Auth hook payload:", JSON.stringify(payload).substring(0, 200))

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    )

    // Only create profile when email is confirmed
    const event = payload.type
    const user = payload.record || payload.user

    if (event === "UPDATE" && user?.email_confirmed_at && !payload.old_record?.email_confirmed_at) {
      // Email just confirmed - create profile now
      const meta = user.raw_user_meta_data || {}
      console.log("Email confirmed for:", user.email, "meta:", JSON.stringify(meta))

      // Create profile
      const { error: profileError } = await supabase.from("profiles").upsert({
        id: user.id,
        first_name: meta.first_name || "",
        last_name: meta.last_name || "",
        role: meta.role || "customer",
        business_name: meta.business_name || "",
        provider_type: meta.provider_type || "garage",
        driver_vehicle_type: meta.driver_vehicle_type === "none" ? null : (meta.driver_vehicle_type || null),
        driver_category: meta.role === "driver" ? meta.driver_category : null,
        is_active: true,
      })
      if (profileError) console.error("Profile error:", profileError)

      // Create profile_sensitive
      await supabase.from("profile_sensitive").upsert({
        id: user.id,
        email: user.email,
        phone: meta.phone || "",
      })

      // Generate referral code
      const refCode = user.id.substring(0,8).toUpperCase()
      await supabase.from("profiles").update({ referral_code: refCode }).eq("id", user.id)

      // Handle referral if exists
      if (meta.referred_by) {
        try {
          const { data: refProfile } = await supabase.from("profiles")
            .select("id").eq("referral_code", meta.referred_by.toUpperCase()).maybeSingle()
          if (refProfile) {
            await supabase.from("referrals").insert({
              referrer_id: refProfile.id,
              referred_id: user.id,
              referral_code: meta.referred_by.toUpperCase(),
              status: "completed",
              points_awarded: 100,
              completed_at: new Date().toISOString(),
            })
            // Award loyalty points
            const { data: lp } = await supabase.from("loyalty_points")
              .select("points,lifetime_points").eq("user_id", refProfile.id).maybeSingle()
            await supabase.from("loyalty_points").upsert({
              user_id: refProfile.id,
              points: (lp?.points||0) + 100,
              lifetime_points: (lp?.lifetime_points||0) + 100
            }, { onConflict: "user_id" })
            // Notify referrer
            await supabase.from("notifications").insert({
              user_id: refProfile.id,
              title: "Referral reward! 🎉",
              message: (meta.first_name||"Someone") + " joined CCC using your referral link. You earned 100 loyalty points!",
              type: "success"
            })
          }
        } catch(refErr) { console.error("Referral error:", refErr) }
      }

      // Notify admin of new verified user
      const { data: admins } = await supabase.from("profiles").select("id").eq("role","admin")
      if(admins?.length) {
        await supabase.from("notifications").insert({
          user_id: admins[0].id,
          title: "New verified user! 👤",
          message: (meta.first_name||"") + " " + (meta.last_name||"") + " joined as " + (meta.role||"customer") + " (" + user.email + ")",
          type: "success"
        })
      }

      console.log("Profile created for verified user:", user.email)
    }

    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } })
  } catch(error: any) {
    console.error("Auth hook error:", error.message)
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})
