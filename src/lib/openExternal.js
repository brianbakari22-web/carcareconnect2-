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

export async function openMapsNavigation(lat, lng, label) {
  try {
    if (Capacitor.isNativePlatform()) {
      const { App } = await import("@capacitor/app")
      // Use geo: URI scheme which Android handles natively - opens maps app directly
      const geoUrl = "geo:" + lat + "," + lng + "?q=" + lat + "," + lng + (label ? "(" + encodeURIComponent(label) + ")" : "")
      await App.openUrl({ url: geoUrl })
    } else {
      window.open("https://www.google.com/maps/dir/?api=1&destination=" + lat + "," + lng, "_blank")
    }
  } catch(e) {
    // Fallback to google maps URL
    window.open("https://www.google.com/maps/dir/?api=1&destination=" + lat + "," + lng, "_blank")
  }
}

export async function callNumber(phone) {
  await openExternal("tel:" + phone)
}

export async function openWhatsApp(phone) {
  const cleaned = phone.replace(/^0/, "")
  await openExternal("https://wa.me/254" + cleaned)
}
