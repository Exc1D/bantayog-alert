import type { createHash as CreateHashFn } from 'node:crypto'
import { z } from 'zod'

// node:crypto is server-only (hashMsisdn). Static import crashes in browser via Vite.
const _nodeCrypto: { createHash: typeof CreateHashFn } | null = (() => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('node:crypto') as { createHash: typeof CreateHashFn }
  } catch (_err: unknown) {
    void _err
    return null
  }
})()

export class MsisdnInvalidError extends Error {
  constructor(input: string) {
    super(`Invalid PH MSISDN: ${input.slice(0, 20)}`)
    this.name = 'MsisdnInvalidError'
  }
}

const PH_NORMALIZED_RE = /^\+639\d{9}$/

export const msisdnPhSchema = z.string().regex(PH_NORMALIZED_RE, 'Must be normalized +63 PH MSISDN')

export function normalizeMsisdn(input: string): string {
  const cleaned = input.replace(/[\s-]/g, '')
  if (cleaned.startsWith('+63')) {
    if (PH_NORMALIZED_RE.test(cleaned)) return cleaned
    throw new MsisdnInvalidError(input)
  }
  if (cleaned.startsWith('09') && cleaned.length === 11 && /^\d+$/.test(cleaned)) {
    const candidate = `+63${cleaned.slice(1)}`
    if (PH_NORMALIZED_RE.test(candidate)) return candidate
  }
  if (cleaned.startsWith('639') && cleaned.length === 12 && /^\d+$/.test(cleaned)) {
    const candidate = `+63${cleaned.slice(2)}`
    if (PH_NORMALIZED_RE.test(candidate)) return candidate
  }
  throw new MsisdnInvalidError(input)
}

export function hashMsisdn(normalizedMsisdn: string, salt: string): string {
  if (!_nodeCrypto) {
    throw new Error('hashMsisdn requires Node.js crypto — not available in browser')
  }
  if (!/^\+639\d{9}$/.test(normalizedMsisdn)) {
    throw new Error(`hashMsisdn requires normalized MSISDN, got: ${normalizedMsisdn}`)
  }
  if (typeof salt !== 'string' || salt.length < 16) {
    throw new Error(
      `hashMsisdn requires a salt of at least 16 characters, got length: ${String(salt.length)}`,
    )
  }
  return _nodeCrypto
    .createHash('sha256')
    .update(salt + normalizedMsisdn)
    .digest('hex')
}
