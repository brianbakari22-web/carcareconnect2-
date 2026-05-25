import { supabase } from "./supabase"

// Ping Supabase every 4 minutes to prevent free tier pausing
export function startKeepAlive() {
  const ping = async () => {
    try {
      await supabase.from("profiles").select("id").limit(1)
    } catch {}
  }
  ping()
  return setInterval(ping, 4 * 60 * 1000)
}
