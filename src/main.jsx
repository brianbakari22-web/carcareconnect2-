import * as Sentry from "@sentry/react"

Sentry.init({
  dsn: "https://bb9b46cfe39fa9487c311d992fb393d8@o4511727971794944.ingest.de.sentry.io/4511727990014032",
  environment: import.meta.env.MODE,
  release: "carcareconnect@1.0.33",
  integrations: [
    Sentry.replayIntegration({ maskAllText: true, blockAllMedia: false }),
  ],
  tracesSampleRate: 0.0,
  replaysSessionSampleRate: 0.0,
  replaysOnErrorSampleRate: 1.0,
  ignoreErrors: [
    "this.i.at is not a function",
    "at is not a function",
    "Non-Error promise rejection",
    "ResizeObserver loop limit exceeded",
    "Network request failed",
  ],
  beforeSend(event) {
    if (import.meta.env.DEV) return null
    return event
  },
})
import React from "react"
import ReactDOM from "react-dom/client"
import App from "./App"
import "./index.css"
ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Sentry.ErrorBoundary fallback={
      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:"100vh", fontFamily:"DM Sans,sans-serif", padding:"2rem", textAlign:"center" }}>
        <div style={{ fontSize:48, marginBottom:16 }}>&#128532;</div>
        <div style={{ fontSize:20, fontWeight:700, marginBottom:8 }}>Something went wrong</div>
        <div style={{ fontSize:14, color:"#888", marginBottom:24 }}>Our team has been notified. Please refresh the page.</div>
        <button onClick={()=>window.location.reload()} style={{ background:"#e6821e", color:"#fff", border:"none", borderRadius:12, padding:"12px 24px", fontSize:14, fontWeight:700, cursor:"pointer" }}>Refresh page</button>
        <div style={{ marginTop:16, fontSize:12, color:"#aaa" }}>Need help? WhatsApp us: <a href="https://wa.me/254113858966" style={{ color:"#e6821e" }}>0113858966</a></div>
      </div>
    }>
      <App />
    </Sentry.ErrorBoundary>
  </React.StrictMode>
)
