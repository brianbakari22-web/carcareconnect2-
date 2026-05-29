import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext({})
export const useAuth = () => useContext(AuthContext)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Refresh session when tab becomes visible again
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        supabase.auth.getSession().then(({ data: { session } }) => {
          if (session?.user) {
            setUser(session.user)
            fetchProfile(session.user.id)
          }
        })
      }
    }
    document.addEventListener("visibilitychange", handleVisibilityChange)
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange)
  }, [])

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

  useEffect(() => {
    if (!user) return
    const sub = supabase.channel(`profile-${user.id}`)
      .on("postgres_changes", { event:"UPDATE", schema:"public", table:"profiles", filter:`id=eq.${user.id}` },
        payload => { setProfile(prev=>({...prev,...payload.new})) })
      .subscribe()
    return () => supabase.removeChannel(sub)
  }, [user?.id])

  async function fetchProfile(userId) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (error || !data) {
        const { data: { user: u } } = await supabase.auth.getUser()
        const meta = u?.user_metadata || {}
        const { data: created } = await supabase
          .from('profiles')
          .insert({
            id: userId,
            first_name: meta.first_name || 'User',
            last_name: meta.last_name || '',
            role: meta.role || 'customer',
            business_name: meta.business_name || null,
          })
          .select()
          .single()
        setProfile(created)
      } else {
        setProfile(data)
      }
    } catch (err) {
      console.error('fetchProfile error:', err)
    } finally {
      setLoading(false)
    }
  }

  async function signUp({ email, password, firstName, lastName, phone, role, businessName }, referralCode="") {
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
          phone,
          role: role || 'customer',
          business_name: businessName || null,
        }
      }
    })
    if (error) throw error
    return data
  }

  async function signIn({ email, password }) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data
  }

  async function signOut() {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
  }

  async function updateProfile(updates) {
    console.log("updateProfile called with:", updates)
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id)
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








