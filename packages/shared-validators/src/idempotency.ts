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
export async function canonicalPayloadHash(payload: unknown): Promise<string> {
  // Runtime check for Web Crypto API availability (may be missing in older Node.js or non-browser environments)
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- TypeScript types don't reflect runtime reality
  const subtle = globalThis.crypto?.subtle
  // Check for null/undefined AND that digest method exists (typeof null === 'object' is a JS quirk)
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- subtle can be null at runtime despite types
  if (!subtle || typeof subtle.digest !== 'function') {
    throw new Error(
      'Web Crypto API (globalThis.crypto.subtle) is not available in this environment. ' +
        'This function requires a modern browser or Node.js 19+ with --experimental-global-webcrypto.',
    )
  }
  const canonical = canonicalize(payload)
  const json = JSON.stringify(canonical)
  let digest: ArrayBuffer
  try {
    digest = await subtle.digest('SHA-256', new TextEncoder().encode(json))
  } catch (err: unknown) {
    const detail = err instanceof Error ? ` Cause: ${err.message}` : ''
    throw new Error(
      'Web Crypto API (globalThis.crypto.subtle.digest) failed. ' +
        'This may indicate an unsupported environment or misconfigured crypto provider.' +
        detail,
    )
  }
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function canonicalize(value: unknown, seen = new WeakSet()): unknown {
  if (value === undefined) {
    throw new TypeError('undefined is not supported in idempotency payloads')
  }
  if (value === null || typeof value !== 'object') {
    return value
  }
  if (seen.has(value)) {
    throw new TypeError('Circular reference detected in idempotency payload')
  }
  seen.add(value)
  if (Array.isArray(value)) {
    const result = value.map((item) => canonicalize(item, seen))
    seen.delete(value)
    return result
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
    result[key] = canonicalize(record[key], seen)
  }
  seen.delete(value)
  return result
}
