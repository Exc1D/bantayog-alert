/**
 * Unique idempotency key. crypto.randomUUID() is available in every browser
 * this app supports (secure context; Safari 15.4+/Chrome 92+).
 */
export function generateIdempotencyKey(): string {
  return crypto.randomUUID()
}
