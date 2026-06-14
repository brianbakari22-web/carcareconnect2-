import { PushNotifications } from "@capacitor/push-notifications"
import { Capacitor } from "@capacitor/core"
import { supabase } from "./supabase"

export async function initPushNotifications(userId) {
  if (!Capacitor.isNativePlatform()) return

  try {
    let permStatus = await PushNotifications.checkPermissions()

    if (permStatus.receive === "prompt") {
      permStatus = await PushNotifications.requestPermissions()
    }

    if (permStatus.receive !== "granted") {
      console.log("Push notification permission denied")
      return
    }

    await PushNotifications.register()

    PushNotifications.addListener("registration", async (token) => {
      console.log("Push registration success, token: " + token.value)
      if (userId) {
        await supabase.from("device_tokens").upsert({
          user_id: userId,
          token: token.value,
          platform: "android",
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id,token" })
      }
    })

    PushNotifications.addListener("registrationError", (err) => {
      console.error("Push registration error: ", err.error)
    })

    PushNotifications.addListener("pushNotificationReceived", (notification) => {
      console.log("Push notification received: ", notification)
    })

    PushNotifications.addListener("pushNotificationActionPerformed", (notification) => {
      console.log("Push notification action performed: ", notification)
      const data = notification.notification.data
      if (data?.url) {
        window.location.href = data.url
      }
    })
  } catch (err) {
    console.error("Push notification init error:", err)
  }
}
