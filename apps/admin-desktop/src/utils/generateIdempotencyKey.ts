/**
 * Generate a unique idempotency key that works across all browsers.
 * Falls back from crypto.randomUUID() to a crypto.getRandomValues-based
 * implementation for older browsers (Safari < 15.4, Chrome < 92).
 */

let counter = 0
const sessionSalt = Math.random().toString(16).slice(2, 10)

export function generateIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  // Fallback: use crypto.getRandomValues if available
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(16)
    crypto.getRandomValues(bytes)
    const b6 = ((bytes[6] ?? 0) & 0x0f) | 0x40
    const b8 = ((bytes[8] ?? 0) & 0x3f) | 0x80
    bytes.set([b6], 6)
    bytes.set([b8], 8)
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
  }

  // Last resort: timestamp + counter + session salt (unique per tab)
  counter += 1
  return `${sessionSalt}-${Date.now().toString(16)}-${counter.toString(16).padStart(8, '0')}`
}
