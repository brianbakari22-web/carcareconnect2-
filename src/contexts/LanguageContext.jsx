import { createContext, useContext, useState, useEffect } from "react"
import { translations, t as translate } from "../lib/translations"

const LanguageContext = createContext({})

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState(() => localStorage.getItem("ccc_language") || "en")

  useEffect(() => {
    localStorage.setItem("ccc_language", language)
  }, [language])

  function t(key) {
    return translate(key, language)
  }

  function toggleLanguage() {
    setLanguage(l => l === "en" ? "sw" : "en")
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage, toggleLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  return useContext(LanguageContext)
}
