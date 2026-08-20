// Shared file upload validation utility
// Used across all file upload points in the platform

// Allowed MIME types per category
const ALLOWED_TYPES = {
  image: ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"],
  document: ["image/jpeg", "image/jpg", "image/png", "application/pdf"],
  video: ["video/mp4", "video/webm", "video/quicktime"],
}

// Max file sizes
const MAX_SIZES = {
  image: 5 * 1024 * 1024,    // 5MB
  document: 10 * 1024 * 1024, // 10MB
  video: 200 * 1024 * 1024,   // 200MB
}

// Validate file before upload
export function validateFile(file, type = "image") {
  if (!file) return { valid: false, error: "No file selected" }

  // Check file size
  const maxSize = MAX_SIZES[type] || MAX_SIZES.image
  if (file.size > maxSize) {
    const maxMB = maxSize / (1024 * 1024)
    return { valid: false, error: `File too large. Maximum size is ${maxMB}MB` }
  }

  // Check MIME type
  const allowedTypes = ALLOWED_TYPES[type] || ALLOWED_TYPES.image
  if (!allowedTypes.includes(file.type)) {
    return { valid: false, error: `Invalid file type. Allowed: ${allowedTypes.join(", ")}` }
  }

  // Check file name for malicious patterns
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_")
  const ext = safeName.split(".").pop()?.toLowerCase()
  const dangerousExts = ["exe","bat","sh","php","js","html","svg","xml","zip","rar"]
  if (dangerousExts.includes(ext)) {
    return { valid: false, error: "File type not allowed" }
  }

  return { valid: true, safeName }
}

// Sanitize file path to prevent path traversal
export function sanitizeFilePath(userId, filename) {
  const clean = filename.replace(/[^a-zA-Z0-9._-]/g, "_")
  const timestamp = Date.now()
  return `${userId}/${timestamp}_${clean}`
}

// Check image dimensions (optional - for images only)
export async function checkImageDimensions(file, maxWidth = 4000, maxHeight = 4000) {
  return new Promise((resolve) => {
    if (!file.type.startsWith("image/")) { resolve({ valid: true }); return }
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      if (img.width > maxWidth || img.height > maxHeight) {
        resolve({ valid: false, error: `Image too large. Max ${maxWidth}x${maxHeight}px` })
      } else {
        resolve({ valid: true })
      }
    }
    img.onerror = () => { URL.revokeObjectURL(url); resolve({ valid: false, error: "Invalid image" }) }
    img.src = url
  })
}
