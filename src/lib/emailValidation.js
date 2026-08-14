// Curated list of common disposable/temporary email domains
const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com", "tempmail.com", "temp-mail.org", "10minutemail.com",
  "guerrillamail.com", "guerrillamail.info", "guerrillamail.biz", "guerrillamail.de",
  "throwawaymail.com", "yopmail.com", "trashmail.com", "fakeinbox.com",
  "getnada.com", "maildrop.cc", "mintemail.com", "mailnesia.com",
  "dispostable.com", "mailcatch.com", "spamgourmet.com", "tempinbox.com",
  "sharklasers.com", "grr.la", "guerrillamailblock.com", "pokemail.net",
  "spam4.me", "tempr.email", "moakt.com", "emailondeck.com",
  "33mail.com", "mytemp.email", "temp-mail.io", "burnermail.io",
  "mohmal.com", "harakirimail.com", "mailtemp.info", "tempemail.co",
  "mailbox52.ml", "mailbox92.biz", "inboxbear.com", "10minemail.com",
])

export function isDisposableEmail(email) {
  if (!email || !email.includes("@")) return false
  const domain = email.split("@")[1]?.toLowerCase().trim()
  return DISPOSABLE_DOMAINS.has(domain)
}

export async function checkEmailBlocked(supabase, email) {
  const normalized = (email || "").toLowerCase().trim()
  if (isDisposableEmail(normalized)) {
    return "Disposable/temporary email addresses are not allowed. Please use a permanent email address."
  }
  const { data } = await supabase.from("blocked_emails").select("reason").eq("email", normalized).maybeSingle()
  if (data) {
    return "This email address cannot be used to create an account. Please contact support if you believe this is an error."
  }
  return null
}
