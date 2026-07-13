// Client-side rate limiting utility
// Prevents rapid-fire requests from the frontend

const requestCounts = new Map()

export function checkRateLimit(key, maxRequests = 5, windowMs = 60000) {
  const now = Date.now()
  const windowStart = now - windowMs
  
  if (!requestCounts.has(key)) {
    requestCounts.set(key, [])
  }
  
  // Clean old requests outside window
  const requests = requestCounts.get(key).filter(t => t > windowStart)
  
  if (requests.length >= maxRequests) {
    const oldestRequest = requests[0]
    const waitMs = windowMs - (now - oldestRequest)
    const waitSec = Math.ceil(waitMs / 1000)
    return { 
      allowed: false, 
      error: `Too many attempts. Please wait ${waitSec} seconds.`,
      waitMs 
    }
  }
  
  requests.push(now)
  requestCounts.set(key, requests)
  return { allowed: true }
}

// Pre-defined rate limits
export const RATE_LIMITS = {
  LOGIN: { max: 5, window: 60000, key: "login" },           // 5 attempts per minute
  SIGNUP: { max: 3, window: 300000, key: "signup" },         // 3 per 5 minutes
  BOOKING: { max: 10, window: 60000, key: "booking" },       // 10 per minute
  PAYMENT: { max: 3, window: 60000, key: "payment" },        // 3 per minute
  GO_SERVICE: { max: 3, window: 300000, key: "go_service" }, // 3 per 5 minutes
  MESSAGE: { max: 30, window: 60000, key: "message" },       // 30 per minute
  UPLOAD: { max: 10, window: 60000, key: "upload" },         // 10 per minute
  OTP: { max: 3, window: 300000, key: "otp" },               // 3 per 5 minutes
}

export function applyRateLimit(limitConfig, userId = "anonymous") {
  const key = `${limitConfig.key}_${userId}`
  return checkRateLimit(key, limitConfig.max, limitConfig.window)
}
