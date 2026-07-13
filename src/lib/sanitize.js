// Input sanitization utility for Car Care Connect

export function sanitizeText(input) {
  if (!input || typeof input !== "string") return ""
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/javascript:/gi, "")
    .replace(/on\w+=/gi, "")
    .trim()
}

export function sanitizePhone(phone) {
  if (!phone) return ""
  const cleaned = phone.replace(/[^0-9+]/g, "")
  if (/^(\+?254|0)[17]\d{8}$/.test(cleaned)) return cleaned
  return ""
}

export function sanitizeEmail(email) {
  if (!email) return ""
  const cleaned = email.toLowerCase().trim()
  if (/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(cleaned)) return cleaned
  return ""
}

export function sanitizeName(name) {
  if (!name) return ""
  return name.replace(/[^a-zA-Z\s\-\'\.]/g, "").trim().substring(0, 100)
}

export function sanitizeAmount(amount) {
  const num = parseFloat(amount)
  if (isNaN(num) || num < 0) return 0
  return Math.round(num * 100) / 100
}

export function sanitizeFreeText(text, maxLength = 1000) {
  if (!text) return ""
  return sanitizeText(text).substring(0, maxLength)
}
