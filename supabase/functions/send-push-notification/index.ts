import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const ONESIGNAL_APP_ID = Deno.env.get("ONESIGNAL_APP_ID") || "8722cee5-c2e2-431c-a15d-2af78773b404"
const ONESIGNAL_API_KEY = Deno.env.get("ONESIGNAL_REST_API_KEY")

Deno.serve(async (req) => {
  try {
    const { user_id, title, body, data, url } = await req.json()

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    )

    // Get OneSignal subscription IDs for this user
    const { data: tokens } = await supabase
      .from("device_tokens")
      .select("token")
      .eq("user_id", user_id)
      .eq("platform", "onesignal")

    if (!tokens || tokens.length === 0) {
      // Fallback: send by external user ID (OneSignal user login)
      const payload: any = {
        app_id: ONESIGNAL_APP_ID,
        target_channel: "push",
        include_aliases: { external_id: [user_id] },
        headings: { en: title },
        contents: { en: body },
      }
      if (url) payload.url = url
      if (data) payload.data = data

      const res = await fetch("https://onesignal.com/api/v1/notifications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Basic ${ONESIGNAL_API_KEY}`,
        },
        body: JSON.stringify(payload),
      })
      const result = await res.json()
      return new Response(JSON.stringify({ success: true, result }), {
        headers: { "Content-Type": "application/json" },
      })
    }

    // Send to specific subscription IDs
    const subscriptionIds = tokens.map(t => t.token)
    const payload: any = {
      app_id: ONESIGNAL_APP_ID,
      target_channel: "push",
      include_subscription_ids: subscriptionIds,
      headings: { en: title },
      contents: { en: body },
    }
    if (url) payload.url = url
    if (data) payload.data = data

    const res = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Basic ${ONESIGNAL_API_KEY}`,
      },
      body: JSON.stringify(payload),
    })
    const result = await res.json()

    return new Response(JSON.stringify({ success: true, result }), {
      headers: { "Content-Type": "application/json" },
    })
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
})