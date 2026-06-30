import { Capacitor } from "@capacitor/core"

export async function openExternal(url) {
  try {
    if (Capacitor.isNativePlatform()) {
      const { App } = await import("@capacitor/app")
      await App.openUrl({ url })
    } else {
      window.open(url, "_blank")
    }
  } catch(e) {
    console.error("openExternal error:", e)
    window.open(url, "_blank")
  }
}

export async function callNumber(phone) {
  await openExternal("tel:" + phone)
}

export async function openWhatsApp(phone) {
  const cleaned = phone.replace(/^0/, "")
  await openExternal("https://wa.me/254" + cleaned)
}
