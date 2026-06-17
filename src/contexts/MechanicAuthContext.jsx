import { useState, useEffect, createContext, useContext } from "react"
import { supabase } from "../lib/supabase"

const MechanicAuthContext = createContext({})

export function MechanicAuthProvider({ children }) {
  const [mechanic, setMechanic] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check for saved mechanic session
    const saved = localStorage.getItem("ccc_mechanic_session")
    if (saved) {
      try {
        const session = JSON.parse(saved)
        // Verify session is still valid
        supabase.from("mechanics")
          .select("*, profiles!mechanics_provider_id_fkey(business_name, city)")
          .eq("id", session.mechanic_id)
          .eq("is_active", true)
          .single()
          .then(({ data }) => {
            if (data) setMechanic({ ...session, ...data })
            else localStorage.removeItem("ccc_mechanic_session")
            setLoading(false)
          })
      } catch {
        localStorage.removeItem("ccc_mechanic_session")
        setLoading(false)
      }
    } else {
      setLoading(false)
    }
  }, [])

  async function loginMechanic(phone, pin) {
    const { data, error } = await supabase.rpc("verify_mechanic_pin", {
      p_phone: phone,
      p_pin: pin
    })
    if (error) throw error
    if (!data || data.length === 0) throw new Error("Invalid phone number or PIN")
    const session = data[0]
    localStorage.setItem("ccc_mechanic_session", JSON.stringify(session))
    setMechanic(session)
    return session
  }

  function logoutMechanic() {
    localStorage.removeItem("ccc_mechanic_session")
    setMechanic(null)
  }

  return (
    <MechanicAuthContext.Provider value={{ mechanic, loading, loginMechanic, logoutMechanic }}>
      {children}
    </MechanicAuthContext.Provider>
  )
}

export function useMechanicAuth() {
  return useContext(MechanicAuthContext)
}
