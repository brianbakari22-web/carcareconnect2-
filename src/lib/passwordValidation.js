export function validatePassword(password) {
  if (!password || password.length < 8) {
    return "Password must be at least 8 characters"
  }
  if (!/\d/.test(password)) {
    return "Password must include at least one number"
  }
  return null
}
