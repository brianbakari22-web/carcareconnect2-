import { createContext, useContext, useEffect, useState } from "react"
import { supabase } from "../lib/supabase"
import { initPushNotifications, initWebPushForAdmin } from "../lib/pushNotifications"

const AuthContext = createContext({})
export const useAuth = () => useContext(AuthContext)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [profileReady, setProfileReady] = useState(false)

  // Initial session load
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user)
        fetchProfile(session.user.id)
      } else {
        setLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        setUser(session.user)
        fetchProfile(session.user.id)
      } else {
        setUser(null)
        setProfile(null)
        setProfileReady(false)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  // Realtime profile updates — single subscription
  useEffect(() => {
    if (!user?.id) return
    const sub = supabase.channel(`profile-live-${user.id}`)
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "profiles",
        filter: `id=eq.${user.id}`
      }, payload => {
        setProfile(prev => ({ ...prev, ...payload.new }))
        // Check if user was suspended or banned
        if (payload.new.is_suspended && !payload.old?.is_suspended) {
          import("react-hot-toast").then(({ default: toast }) => {
            toast.error("Your account has been suspended. Please contact support.")
          })
        }
        if (payload.new.is_banned && !payload.old?.is_banned) {
          import("react-hot-toast").then(({ default: toast }) => {
            toast.error("Your account has been permanently banned. Please contact support.")
          })
        }
        // Show toast if verification status changed
        if (payload.new.documents_verified && !payload.old?.documents_verified) {
          import("react-hot-toast").then(({ default: toast }) => {
            toast.success("Your documents have been verified! You can now go online. 🎉")
          })
        }
        if (!payload.new.documents_verified && payload.old?.documents_verified) {
          import("react-hot-toast").then(({ default: toast }) => {
            toast.error("Your document verification has been revoked. Please check your credentials.")
          })
        }
      })
      .subscribe()
    return () => supabase.removeChannel(sub)
  }, [user?.id])

  // Refresh profile on tab focus
  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState === "visible") {
        supabase.auth.getSession().then(({ data: { session } }) => {
          if (session?.user) {
            setUser(session.user)
            fetchProfile(session.user.id)
          }
        })
      }
    }
    document.addEventListener("visibilitychange", handleVisibility)
    return () => document.removeEventListener("visibilitychange", handleVisibility)
  }, [])

  async function fetchProfile(userId, retries=0) {
    try {      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle()
      // console.log("fetchProfile result", data, error)
      if (error) throw error
      if (data) {
        setProfile(data)
        setProfileReady(true)
      // Initialize push notifications after profile loaded
      initPushNotifications(userId).catch(e => console.log("Push init:", e.message))
      if (data.role === "admin") {
        initWebPushForAdmin(userId).catch(e => console.log("Web push init:", e.message))
      }
      setLoading(false)
      } else if (retries < 3) {
        setTimeout(() => fetchProfile(userId, retries+1), 500)
      } else {
        setLoading(false)
      }
    } catch (err) {
      console.error("fetchProfile error:", err.message, err.code)
      if (retries < 5) {
        setTimeout(() => fetchProfile(userId, retries+1), 1000)
      } else {
        setLoading(false)
      }
    }
  }

  async function signIn({ email, password }) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    // Set light theme on sign in
    try {
      if (data?.user?.id) {
        const themeKey = `ccc_theme_${data.user.id}`
        if (!localStorage.getItem(themeKey) || localStorage.getItem(themeKey) === "dark") {
          localStorage.setItem(themeKey, "light")
        }
      }
    } catch(_) { /* handled */ }
    return data
  }

  async function signUp({ email, password, firstName, lastName, phone, role, businessName, providerType, driverVehicleType }, referralCode="") {
    const driverCategory = driverVehicleType === "none" ? "concierge" : "marketplace"
    let referrerId = null
    if (referralCode) {
      const { data: refProfile } = await supabase.from("profiles").select("id").eq("referral_code", referralCode.toUpperCase()).single()
      if (refProfile) referrerId = refProfile.id
    }
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: {
        data: {
          first_name: firstName,
          last_name: lastName,
          role: role || "customer",
          business_name: businessName || "",
        }
      }
    })
    if (error) throw error
    if (data.user) {
      // Set default light theme for new user
      try {
        const themeKey = `ccc_theme_${data.user.id}`
        if (!localStorage.getItem(themeKey)) {
          localStorage.setItem(themeKey, "light")
        }
      } catch(_) { /* handled */ }
      // Save referral if exists
      if (referrerId && data.user) {
        try {
          await supabase.from("referrals").insert({
            referrer_id: referrerId,
            referred_id: data.user.id,
            referral_code: referralCode?.toUpperCase(),
            status: "completed",
            points_awarded: 100,
            completed_at: new Date().toISOString(),
            created_at: new Date().toISOString()
          })
          const { data: lp } = await supabase.from("loyalty_points").select("points,lifetime_points").eq("user_id", referrerId).maybeSingle()
          await supabase.from("loyalty_points").upsert({
            user_id: referrerId,
            points: (lp?.points||0) + 100,
            lifetime_points: (lp?.lifetime_points||0) + 100
          }, { onConflict: "user_id" })
          // Notify referrer
          await supabase.from("notifications").insert({
            user_id: referrerId,
            title: "Referral reward! 🎉",
            message: firstName+" "+lastName+" joined CCC using your referral link. You earned 100 loyalty points!",
            type: "success"
          })
        } catch(refErr) { console.log("Referral save error:", refErr.message) }
      }
      // Profile created by webhook after email confirmation
    }
      console.log("Signup complete - awaiting email verification for:", data.user.email)
    return data
  }

  async function signOut() {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
  }

  async function updateProfile(updates) {
    const { data, error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", user.id)
      .select()
      .single()
    if (error) throw error
    setProfile(data)
    return data
  }

  return (
    <AuthContext.Provider value={{
      user, profile, loading, profileReady,
      signUp, signIn, signOut, updateProfile,
      refreshProfile: () => fetchProfile(user?.id)
    }}>
      {children}
    </AuthContext.Provider>
  )
}








