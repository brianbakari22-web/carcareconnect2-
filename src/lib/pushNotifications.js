import { Capacitor } from "@capacitor/core"
import { supabase } from "./supabase"

const ONESIGNAL_APP_ID = "8722cee5-c2e2-431c-a15d-2af78773b404"

export async function initPushNotifications(userId) {
  if (!Capacitor.isNativePlatform()) return
  if (!userId) return

  try {
    const { OneSignal } = await import("onesignal-cordova-plugin")

    OneSignal.initialize(ONESIGNAL_APP_ID)

    // Request permission
    OneSignal.Notifications.requestPermission(true)

    // Set external user ID so we can target this user from Supabase/OneSignal API
    OneSignal.login(userId)

    // Save the OneSignal player/subscription ID for reference
    const subscriptionId = OneSignal.User.pushSubscription.id
    if (subscriptionId) {
      await supabase.from("device_tokens").upsert({
        user_id: userId,
        token: subscriptionId,
        platform: "onesignal",
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id,token" })
    }

    // Listen for notification clicks
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
