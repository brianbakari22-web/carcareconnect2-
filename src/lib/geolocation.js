import { Capacitor } from "@capacitor/core"

export async function getCurrentPosition() {
  if (Capacitor.isNativePlatform()) {
    const { Geolocation } = await import("@capacitor/geolocation")
    // Request permissions first
    const perm = await Geolocation.requestPermissions()
    if (perm.location !== "granted" && perm.coarseLocation !== "granted") {
      throw new Error("Location permission denied. Please enable location in your phone settings.")
    }
    const pos = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 15000,
    })
    return {
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
      accuracy: pos.coords.accuracy,
    }
  } else {
    // Web fallback
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation is not supported by your browser"))
        return
      }
      navigator.geolocation.getCurrentPosition(
        pos => resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        }),
        err => {
          if (err.code === 1) reject(new Error("Location permission denied. Please allow location access."))
          else if (err.code === 2) reject(new Error("Location unavailable. Please check your GPS."))
          else if (err.code === 3) reject(new Error("Location request timed out. Please try again."))
          else reject(new Error("Could not get your location."))
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
      )
    })
  }
}

export async function watchPosition(callback) {
  if (Capacitor.isNativePlatform()) {
    const { Geolocation } = await import("@capacitor/geolocation")
    const watchId = await Geolocation.watchPosition(
      { enableHighAccuracy: true },
      (pos, err) => {
        if (err) { console.error("Watch error:", err); return }
        callback({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        })
      }
    )
    return watchId
  } else {
    return navigator.geolocation.watchPosition(
      pos => callback({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
      }),
      err => console.error("Watch error:", err),
      { enableHighAccuracy: true, maximumAge: 10000 }
    )
  }
}

export async function clearWatch(watchId) {
  if (Capacitor.isNativePlatform()) {
    const { Geolocation } = await import("@capacitor/geolocation")
    await Geolocation.clearWatch({ id: watchId })
  } else {
    navigator.geolocation.clearWatch(watchId)
  }
}
