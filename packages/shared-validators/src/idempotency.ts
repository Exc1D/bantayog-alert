import { createHash } from 'node:crypto'

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
 * `undefined` values are dropped by JSON.stringify (matching its default behavior).
 */
export function canonicalPayloadHash(payload: unknown): string {
  const canonical = canonicalize(payload)
  const json = JSON.stringify(canonical)
  return createHash('sha256').update(json).digest('hex')
}

function canonicalize(value: unknown): unknown {
  if (value === null || typeof value !== 'object') {
    return value
  }
  if (Array.isArray(value)) {
    return value.map(canonicalize)
  }
  const record = value as Record<string, unknown>
  const sortedKeys = Object.keys(record).sort()
  const result: Record<string, unknown> = {}
  for (const key of sortedKeys) {
    result[key] = canonicalize(record[key])
  }
  return result
}
