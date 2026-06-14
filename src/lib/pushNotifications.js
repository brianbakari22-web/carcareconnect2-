import { Capacitor } from "@capacitor/core"
import { supabase } from "./supabase"
import OneSignal from "onesignal-cordova-plugin"

const ONESIGNAL_APP_ID = "8722cee5-c2e2-431c-a15d-2af78773b404"

export async function initPushNotifications(userId) {
  if (!Capacitor.isNativePlatform()) return
  if (!userId) return

  try {
    if (!OneSignal) {
      console.error("OneSignal SDK not available")
      return
    }

    OneSignal.initialize(ONESIGNAL_APP_ID)
    OneSignal.Notifications.requestPermission(true)
    OneSignal.login(userId)

    setTimeout(async () => {
      try {
        const subscriptionId = OneSignal.User.pushSubscription.id
        if (subscriptionId) {
          await supabase.from("device_tokens").upsert({
            user_id: userId,
            token: subscriptionId,
            platform: "onesignal",
            updated_at: new Date().toISOString(),
          }, { onConflict: "user_id,token" })
        }
      } catch (e) {
        console.error("Save subscription error:", e.message)
      }
    }, 3000)

    OneSignal.Notifications.addEventListener("click", (event) => {
      const data = event.notification.additionalData
      if (data?.url) {
        window.location.href = data.url
      }
    })
  } catch (err) {
    console.error("OneSignal init error:", err.message)
  }
}
