export function generateIdempotencyKey(): string {
  try {
    return crypto.randomUUID()
  } catch {
    return `${String(Date.now())}-${Math.random().toString(36).slice(2)}`
  }
}
