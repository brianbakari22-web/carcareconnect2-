// Review content filter - flags bad words, contact details, abuse
const BAD_WORDS = [
  "stupid","idiot","fool","moron","dumb","useless","trash","rubbish",
  "scam","fraud","cheat","liar","thief","steal","fake","con",
  "hate","kill","die","damn","hell","ass","crap","shit","fuck","bitch",
  "washenzi","mjinga","mwizi","tapeli","upuuzi","bure kabisa"
]

const CONTACT_PATTERNS = [
  /\b07\d{8}\b/g,           // Kenyan phone 07xx
  /\b01\d{8}\b/g,           // Kenyan phone 01xx
  /\b\+254\d{9}\b/g,       // +254 format
  /\b254\d{9}\b/g,          // 254 format
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,  // email
  /\bwhatsapp\b/gi,
  /\btelegram\b/gi,
  /\binstagram\b/gi,
  /\bfacebook\b/gi,
  /\btwitter\b/gi,
  /\bdm me\b/gi,
  /\bcontact me\b/gi,
  /\bcall me\b/gi,
  /\btext me\b/gi,
]

export function filterReviewContent(text) {
  if (!text) return { clean: true, flags: [] }
  const lower = text.toLowerCase()
  const flags = []

  // Check bad words
  BAD_WORDS.forEach(word => {
    if (lower.includes(word)) flags.push({ type: "bad_word", word })
  })

  // Check contact details
  CONTACT_PATTERNS.forEach(pattern => {
    if (pattern.test(text)) flags.push({ type: "contact_info", pattern: pattern.toString() })
    pattern.lastIndex = 0
  })

  return {
    clean: flags.length === 0,
    flags,
    hasBadWords: flags.some(f => f.type === "bad_word"),
    hasContactInfo: flags.some(f => f.type === "contact_info"),
    shouldAutoFlag: flags.length > 0,
    shouldAutoHide: flags.some(f => f.type === "contact_info"),
  }
}

export function sanitizeReviewText(text) {
  if (!text) return text
  // Mask phone numbers
  let clean = text
  CONTACT_PATTERNS.forEach(pattern => {
    clean = clean.replace(pattern, "***")
    pattern.lastIndex = 0
  })
  return clean
}