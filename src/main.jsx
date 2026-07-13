import * as Sentry from "@sentry/react"

Sentry.init({
  dsn: "https://bb9b46cfe39fa9487c311d992fb393d8@o4511727971794944.ingest.de.sentry.io/4511727990014032",
  environment: import.meta.env.MODE,
  release: "carcareconnect@1.0.0",
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: false,
    }),
  ],
  // Performance monitoring
  tracesSampleRate: 0.1, // 10% of transactions
  // Session replay - only on errors
  replaysSessionSampleRate: 0.0,
  replaysOnErrorSampleRate: 1.0,
  // Filter out noise
  ignoreErrors: [
    "ResizeObserver loop limit exceeded",
    "Non-Error promise rejection captured",
    "Load failed",
    "Failed to fetch",
    "NetworkError",
  ],
  beforeSend(event) {
    // Dont send events in development
    if (import.meta.env.DEV) return null
    return event
  },
})

import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { startKeepAlive } from './lib/keepAlive'
startKeepAlive()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)

// force deploy 05/27/2026 22:03:27
// cache bust 2026-05-29 04:16:40
// cache bust 2026-05-29 04:22
// force redeploy 05/29/2026 10:42:28
// cache bust 05/30/2026 16:09:29

// bust 20260530164845

// bust 20260530205021

// 20260531194122
