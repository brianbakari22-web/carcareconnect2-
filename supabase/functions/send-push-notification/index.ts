import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const ONESIGNAL_APP_ID = "8722cee5-c2e2-431c-a15d-2af78773b404"
const ONESIGNAL_API_KEY = Deno.env.get("ONESIGNAL_REST_API_KEY")

Deno.serve(async (req) => {
  try {
    const { user_id, title, body } = await req.json()
    console.log("Sending to:", user_id, "Title:", title)

    const res = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Basic " + ONESIGNAL_API_KEY
      },
      body: JSON.stringify({
        app_id: ONESIGNAL_APP_ID,
        include_external_user_ids: [user_id],
        headings: { en: title },
        contents: { en: body }
      })
    })

    const result = await res.json()
    console.log("OneSignal result:", JSON.stringify(result))

    return new Response(JSON.stringify({ success: true, result }), {
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