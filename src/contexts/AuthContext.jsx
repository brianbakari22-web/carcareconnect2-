import { createContext, useContext, useEffect, useState } from "react"
import { supabase } from "../lib/supabase"

const AuthContext = createContext({})
export const useAuth = () => useContext(AuthContext)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

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
    try {
      console.log("fetchProfile attempt", retries, userId)
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle()
      console.log("fetchProfile result", data, error)
      if (error) throw error
      if (data) {
        setProfile(data)
        setLoading(false)
      } else if (retries < 10) {
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
    } catch(_) {}
    return data
  }

  async function signUp({ email, password, firstName, lastName, phone, role, businessName, providerType, driverVehicleType }, referralCode="") {
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
      } catch(_) {}
      const { error: profileError } = await supabase.from("profiles").upsert({
        id: data.user.id,
        first_name: firstName,
        last_name: lastName,
        role: role || "customer",
        business_name: businessName || "",
        provider_type: providerType || "garage",
        driver_vehicle_type: driverVehicleType || "car",
        referred_by: referrerId,
        is_active: true,
      })
      if (profileError) console.error("Profile upsert error:", profileError)
      await supabase.from("profile_sensitive").upsert({
        id: data.user.id,
        email, phone: phone || "",
      })
    }
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
      user, profile, loading,
      signUp, signIn, signOut, updateProfile,
      refreshProfile: () => fetchProfile(user?.id)
    }}>
      {children}
    </AuthContext.Provider>
  )
}






