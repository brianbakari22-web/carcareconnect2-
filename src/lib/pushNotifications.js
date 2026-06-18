import { Capacitor } from "@capacitor/core"
import { supabase } from "./supabase"

export async function initPushNotifications(userId) {
  if (!Capacitor.isNativePlatform()) return
  if (!userId) return

  const OneSignal = window.plugins?.OneSignal
  if (!OneSignal) return

  try {
    OneSignal.initialize("8722cee5-c2e2-431c-a15d-2af78773b404")
    const permission = await OneSignal.Notifications.requestPermission(true)
    
    if (permission) {
      OneSignal.login(String(userId))
      
      setTimeout(async () => {
        try {
          const subId = OneSignal.User.pushSubscription.id
          if (subId && subId.includes("-")) {
            // Delete ALL old tokens for this user first
            await supabase.from("device_tokens")
              .delete()
              .eq("user_id", userId)
              .eq("platform", "onesignal")
            
            // Insert fresh token
            await supabase.from("device_tokens").insert({
              user_id: userId,
              token: subId,
              platform: "onesignal",
              updated_at: new Date().toISOString()
            })
            console.log("Fresh OneSignal token saved:", subId)
          }
        } catch(e) { console.error("Save error:", e.message) }
      }, 3000)
    }
  } catch (err) {
    console.error("OneSignal error:", err)
  }
}