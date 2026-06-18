import { Capacitor } from "@capacitor/core"
import { supabase } from "./supabase"
import { initializeApp, getApps } from "firebase/app"
import { getMessaging, getToken, onMessage } from "firebase/messaging"

const firebaseConfig = {
  apiKey: "AIzaSyCWgelL795G6-JQPU0LKz_Bgg3AF2-xGOk",
  authDomain: "car-care-connect-a3bc8.firebaseapp.com",
  projectId: "car-care-connect-a3bc8",
  storageBucket: "car-care-connect-a3bc8.firebasestorage.app",
  messagingSenderId: "62459160532",
  appId: "1:62459160532:web:db2a7d30de20b66c6bd841"
}

const VAPID_KEY = "BK-5U5qRKJUR7YRmtNwaNTWePy-4027VRESlVazfGknB6R0Prp08YuGbUS07F7YAqb5rQfo5Wer-XOPbTCYBIrg"

export async function initPushNotifications(userId) {
  if (!userId) return
  try {
    const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]
    const messaging = getMessaging(app)
    const permission = await Notification.requestPermission()
    console.log("Permission:", permission)
    if (permission !== "granted") return
    const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js")
    console.log("SW registered!")
    const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration })
    console.log("FCM token:", token ? token.substring(0,20) : "none")
    if (!token) return
    const { error } = await supabase.from("device_tokens").upsert({
      user_id: userId,
      token: token,
      platform: "fcm",
      updated_at: new Date().toISOString()
    }, { onConflict: "user_id,token" })
    if (error) console.error("Save error:", error.message)
    else console.log("FCM token saved!")
    onMessage(messaging, (payload) => {
      const { title, body } = payload.notification || {}
      if (title) new Notification(title, { body, icon: "/logo.svg" })
    })
  } catch (err) {
    console.error("FCM init error:", err.message)
  }
}