import { Capacitor } from "@capacitor/core"
import { supabase } from "./supabase"

export async function initPushNotifications(userId) {
  if (!Capacitor.isNativePlatform()) return
  if (!userId) return

  try {
    const { FirebaseMessaging } = await import("@capacitor-firebase/messaging")
    
    // Request permission
    const { receive } = await FirebaseMessaging.requestPermissions()
    if (receive !== "granted") return
    
    // Get FCM token
    const { token } = await FirebaseMessaging.getToken()
    if (!token) return
    
    // Save token to database
    await supabase.from("device_tokens").upsert({
      user_id: userId,
      token: token,
      platform: "fcm",
      updated_at: new Date().toISOString()
    }, { onConflict: "user_id,token" })
    
    console.log("FCM token saved!")

    // Listen for notifications
    await FirebaseMessaging.addListener("notificationReceived", notification => {
      console.log("Notification received:", notification)
    })

    await FirebaseMessaging.addListener("notificationActionPerformed", event => {
      const url = event.notification?.data?.url
      if (url) window.location.href = url
    })

  } catch (err) {
    console.error("FCM init error:", err.message)
  }
}