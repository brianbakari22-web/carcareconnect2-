import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const ONESIGNAL_APP_ID = "8722cee5-c2e2-431c-a15d-2af78773b404"
const ONESIGNAL_API_KEY = Deno.env.get("ONESIGNAL_REST_API_KEY")

Deno.serve(async (req) => {
  try {
    const body = await req.json()
    console.log("Request:", JSON.stringify(body))
    const { user_id, title, body: msgBody, data } = body

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    )

    const { data: tokens, error } = await supabase
      .from("device_tokens")
      .select("token, platform")
      .eq("user_id", user_id)

    console.log("Tokens:", JSON.stringify(tokens), "Error:", error?.message)

    if (!tokens || tokens.length === 0) {
      // Try sending by external_id (OneSignal login userId)
      console.log("No tokens - trying external_id")
      const payload = {
        app_id: ONESIGNAL_APP_ID,
        include_aliases: { external_id: [user_id] },
        target_channel: "push",
        headings: { en: title },
        contents: { en: msgBody },
        data: data || {}
      }
      const res = await fetch("https://onesignal.com/api/v1/notifications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Basic " + ONESIGNAL_API_KEY,
        },
        body: JSON.stringify(payload),
      })
      const result = await res.json()
      console.log("OneSignal external_id result:", JSON.stringify(result))
      return new Response(JSON.stringify({ success: true, result }), {
        headers: { "Content-Type": "application/json" },
      })
    }

    const results = []
    for (const { token, platform } of tokens) {
      if (platform === "onesignal") {
        const payload = {
          app_id: ONESIGNAL_APP_ID,
          include_aliases: { external_id: [user_id] },
          target_channel: "push",
          headings: { en: title },
          contents: { en: msgBody },
          data: data || {}
        }
        const res = await fetch("https://onesignal.com/api/v1/notifications", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": "Basic " + ONESIGNAL_API_KEY,
          },
          body: JSON.stringify(payload),
        })
        const result = await res.json()
        console.log("OneSignal result:", JSON.stringify(result))
        results.push(result)
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { "Content-Type": "application/json" },
    })
  } catch (err) {
    console.error("Error:", err.message)
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
})