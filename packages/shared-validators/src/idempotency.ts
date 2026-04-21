import type { createHash as CreateHashFn } from 'node:crypto'

// node:crypto is server-only. Static import crashes in browser via Vite.
const _nodeCrypto: { createHash: typeof CreateHashFn } | null = (() => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('node:crypto') as { createHash: typeof CreateHashFn }
  } catch {
    return null
  }
})()

/**
 * Canonical payload hash per spec §6.2.
 * Used as the key half of idempotency guards for all write callables.
 *
 * Algorithm:
 *   1. Recursively sort object keys at every nesting level.
 *   2. JSON.stringify with no whitespace.
 *   3. SHA-256 the result; return hex.
 *
 * Arrays are NOT reordered — element order is semantic.
 * `undefined` values are rejected with TypeError (JSON.stringify would silently
 * drop them, causing hash collisions between `{ a: 1 }` and `{ a: 1, b: undefined }`).
 *
 * @throws TypeError for unsupported types (Map, Set, RegExp)
 * @throws Error for circular references
 */
export function canonicalPayloadHash(payload: unknown): string {
  if (!_nodeCrypto) {
    throw new Error('canonicalPayloadHash requires Node.js crypto — not available in browser')
  }
  const canonical = canonicalize(payload)
  const json = JSON.stringify(canonical)
  return _nodeCrypto.createHash('sha256').update(json).digest('hex')
}

function canonicalize(value: unknown): unknown {
  if (value === undefined) {
    throw new TypeError('undefined is not supported in idempotency payloads')
  }
  if (value === null || typeof value !== 'object') {
    return value
  }
  if (Array.isArray(value)) {
    return value.map(canonicalize)
  }
  // Reject non-plain objects to prevent silent hash collisions.
  // Map, Set, and RegExp all return [] from Object.keys() and would
  // produce the same hash as {}, making them undetectable failures.
  if (value instanceof Map || value instanceof Set || value instanceof RegExp) {
    throw new TypeError(`canonicalPayloadHash does not support ${value.constructor.name}`)
  }
  const record = value as Record<string, unknown>
  const sortedKeys = Object.keys(record).sort()
  const result: Record<string, unknown> = {}
  for (const key of sortedKeys) {
    result[key] = canonicalize(record[key])
  }
  return result
}
