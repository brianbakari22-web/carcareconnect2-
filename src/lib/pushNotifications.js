import { Capacitor } from "@capacitor/core"
import { supabase } from "./supabase"

export async function initPushNotifications(userId) {
  if (!Capacitor.isNativePlatform()) return
  if (!userId) return

  try {
    const OneSignal = window.plugins?.OneSignal
    if (!OneSignal) {
      console.log("OneSignal not available")
      return
    }

    OneSignal.initialize("8722cee5-c2e2-431c-a15d-2af78773b404")
    await OneSignal.Notifications.requestPermission(true)
    OneSignal.login(userId)

    // Wait for subscription token
    setTimeout(async () => {
      try {
        const pushToken = OneSignal.User.pushSubscription.token
        const subId = OneSignal.User.pushSubscription.id
        console.log("Push token:", pushToken)
        console.log("Sub ID:", subId)

        if (pushToken) {
          await supabase.from("device_tokens").upsert({
            user_id: userId,
            token: pushToken,
            platform: "onesignal",
            updated_at: new Date().toISOString()
          }, { onConflict: "user_id,token" })
          console.log("Push TOKEN saved!")
        } else if (subId) {
          await supabase.from("device_tokens").upsert({
            user_id: userId,
            token: subId,
            platform: "onesignal",
            updated_at: new Date().toISOString()
          }, { onConflict: "user_id,token" })
          console.log("Sub ID saved!")
        }
      } catch(e) {
        console.error("Save token error:", e.message)
      }
    }, 5000)

  } catch (err) {
    console.error("Push init error:", err.message)
  }
}