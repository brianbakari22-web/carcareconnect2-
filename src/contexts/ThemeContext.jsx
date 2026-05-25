import { createContext, useContext, useState, useEffect } from "react"
import { supabase } from "../lib/supabase"

const ThemeContext = createContext({})

export const THEMES = {
  dark: { name:"Dark", icon:"🌙", bg:"#0a0a0a", bgSecondary:"#0f0f0f", bgCard:"#111", bgCardHover:"#161616", border:"#1e1e1e", borderLight:"#2a2a2a", text:"#f0ede6", textMuted:"#888", textFaint:"#555", textVeryFaint:"#444", primary:"#e6821e", primaryBg:"#1a1208", primaryBorder:"#e6821e40" },
  light: { name:"Light", icon:"☀️", bg:"#f5f5f5", bgSecondary:"#efefef", bgCard:"#ffffff", bgCardHover:"#f9f9f9", border:"#e5e5e5", borderLight:"#d5d5d5", text:"#1a1a1a", textMuted:"#555", textFaint:"#888", textVeryFaint:"#aaa", primary:"#e6821e", primaryBg:"#fff3e6", primaryBorder:"#e6821e40" },
  ocean: { name:"Ocean", icon:"🌊", bg:"#0a1628", bgSecondary:"#0d1e35", bgCard:"#112240", bgCardHover:"#1a3050", border:"#1e3a5f", borderLight:"#2a4a70", text:"#e2e8f0", textMuted:"#94a3b8", textFaint:"#64748b", textVeryFaint:"#475569", primary:"#0ea5e9", primaryBg:"#0c2340", primaryBorder:"#0ea5e940" },
  forest: { name:"Forest", icon:"🌿", bg:"#0a1a0f", bgSecondary:"#0d2014", bgCard:"#112918", bgCardHover:"#1a3a22", border:"#1e4028", borderLight:"#2a5035", text:"#e2f0e8", textMuted:"#86b896", textFaint:"#5a8a6a", textVeryFaint:"#4a7a5a", primary:"#10b981", primaryBg:"#0a2818", primaryBorder:"#10b98140" },
  royal: { name:"Royal", icon:"👑", bg:"#0f0a1a", bgSecondary:"#140e22", bgCard:"#1a1230", bgCardHover:"#221840", border:"#2a1e50", borderLight:"#3a2a60", text:"#ede8f5", textMuted:"#a890c8", textFaint:"#7860a0", textVeryFaint:"#604880", primary:"#8b5cf6", primaryBg:"#1a0f35", primaryBorder:"#8b5cf640" },
  sunset: { name:"Sunset", icon:"🌅", bg:"#1a0a0f", bgSecondary:"#220d14", bgCard:"#2a1018", bgCardHover:"#381520", border:"#501828", borderLight:"#602030", text:"#f5e8ea", textMuted:"#c89098", textFaint:"#a06070", textVeryFaint:"#804858", primary:"#f43f5e", primaryBg:"#2a0a14", primaryBorder:"#f43f5e40" },
}

function getUserThemeKey() {
  try {
    const raw = localStorage.getItem("sb-gcnefnqtjxtqbhynyoxe-auth-token")
    if (!raw) return "ccc_theme_guest"
    const session = JSON.parse(raw)
    const userId = session?.user?.id
    return userId ? `ccc_theme_${userId}` : "ccc_theme_guest"
  } catch {
    return "ccc_theme_guest"
  }
}

export function ThemeProvider({ children }) {
  const [themeName, setThemeNameState] = useState(() => {
    const key = getUserThemeKey()
    return localStorage.getItem(key) || "dark"
  })

  const theme = THEMES[themeName] || THEMES.dark

  function setThemeName(name) {
    const key = getUserThemeKey()
    localStorage.setItem(key, name)
    setThemeNameState(name)
  }

  useEffect(() => {
    const root = document.documentElement
    Object.entries(theme).forEach(([key, value]) => {
      root.style.setProperty(`--${key}`, value)
    })
    root.style.background = theme.bg
  }, [theme])

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") {
        const key = getUserThemeKey()
        const saved = localStorage.getItem(key) || "dark"
        setThemeNameState(saved)
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  return (
    <ThemeContext.Provider value={{ theme, themeName, setThemeName, themes: THEMES }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
