import { Capacitor } from "@capacitor/core"

export async function initPushNotifications(userId) {
  if (!Capacitor.isNativePlatform()) return
  if (!userId) return

  const OneSignal = window.plugins?.OneSignal
  if (!OneSignal) {
    console.log("OneSignal not available")
    return
  }

  try {
    OneSignal.initialize("8722cee5-c2e2-431c-a15d-2af78773b404")
    const permission = await OneSignal.Notifications.requestPermission(true)
    if (permission) {
      OneSignal.login(String(userId))
      console.log("Push ready:", userId)
    }
  } catch (err) {
    console.error("OneSignal error:", err)
  }
}