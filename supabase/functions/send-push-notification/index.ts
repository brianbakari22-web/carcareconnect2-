import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const FIREBASE_PROJECT_ID = Deno.env.get("FIREBASE_PROJECT_ID")
const FIREBASE_CLIENT_EMAIL = Deno.env.get("FIREBASE_CLIENT_EMAIL")
const FIREBASE_PRIVATE_KEY = Deno.env.get("FIREBASE_PRIVATE_KEY")?.replace(/\\n/g, "\n")

async function getAccessToken() {
  const now = Math.floor(Date.now() / 1000)
  const header = { alg: "RS256", typ: "JWT" }
  const payload = {
    iss: FIREBASE_CLIENT_EMAIL,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  }

  const encoder = new TextEncoder()
  const headerB64 = btoa(JSON.stringify(header)).replace(/=/g,"").replace(/\+/g,"-").replace(/\//g,"_")
  const payloadB64 = btoa(JSON.stringify(payload)).replace(/=/g,"").replace(/\+/g,"-").replace(/\//g,"_")
  const unsigned = `${headerB64}.${payloadB64}`

  const pemContents = FIREBASE_PRIVATE_KEY
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s/g, "")
  const binaryDer = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0))

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8", binaryDer, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]
  )

  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", cryptoKey, encoder.encode(unsigned))
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(signature))).replace(/=/g,"").replace(/\+/g,"-").replace(/\//g,"_")

  const jwt = `${unsigned}.${sigB64}`

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  })
  const tokenData = await tokenRes.json()
  return tokenData.access_token
}

Deno.serve(async (req) => {
  try {
    const { user_id, title, body, data } = await req.json()

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    )

    const { data: tokens } = await supabase
      .from("device_tokens")
      .select("token")
      .eq("user_id", user_id)

    if (!tokens || tokens.length === 0) {
      return new Response(JSON.stringify({ success: false, error: "No device tokens found" }), {
        headers: { "Content-Type": "application/json" },
      })
    }

    const accessToken = await getAccessToken()
    const results = []

    for (const { token } of tokens) {
      const res = await fetch(
        `https://fcm.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/messages:send`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: {
              token: token,
              notification: { title, body },
              data: data || {},
              android: { priority: "high" },
            },
          }),
        }
      )
      const result = await res.json()
      results.push(result)
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { "Content-Type": "application/json" },
    })
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
})
