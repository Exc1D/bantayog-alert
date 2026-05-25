import type { createHash as CreateHashFn } from 'node:crypto'
import { z } from 'zod'

interface NodeCryptoModule {
  createHash: typeof CreateHashFn
}

interface ProcessWithBuiltins {
  getBuiltinModule: (id: 'crypto') => unknown
}

function isNodeCryptoModule(value: unknown): value is NodeCryptoModule {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as { createHash?: unknown }
  return typeof candidate.createHash === 'function'
}

function loadNodeCrypto(): { createHash: typeof CreateHashFn } {
  const runtimeGlobal = globalThis as unknown as { process?: unknown }
  const processLike = runtimeGlobal.process
  if (typeof processLike !== 'object' || processLike === null) {
    throw new Error('hashMsisdn requires Node.js crypto — not available in browser')
  }

  const getBuiltinModule = (processLike as { getBuiltinModule?: unknown }).getBuiltinModule
  if (typeof getBuiltinModule !== 'function') {
    throw new Error('hashMsisdn requires Node.js crypto — not available in browser')
  }

  const cryptoModule = (getBuiltinModule as ProcessWithBuiltins['getBuiltinModule']).call(
    processLike,
    'crypto',
  )
  if (!isNodeCryptoModule(cryptoModule)) {
    throw new Error('hashMsisdn requires Node.js crypto — not available in browser')
  }
  return cryptoModule
}

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
  if (/^9\d{9}$/.test(cleaned)) {
    const candidate = `+63${cleaned}`
    if (PH_NORMALIZED_RE.test(candidate)) return candidate
  }
  throw new MsisdnInvalidError(input)
}

export function hashMsisdn(normalizedMsisdn: string, salt: string): string {
  if (!/^\+639\d{9}$/.test(normalizedMsisdn)) {
    throw new Error(`hashMsisdn requires normalized MSISDN, got: ${normalizedMsisdn}`)
  }
  if (typeof salt !== 'string') {
    throw new Error(`hashMsisdn requires a string salt, got type: ${typeof salt}`)
  }
  if (salt.length < 16) {
    throw new Error(
      `hashMsisdn requires a salt of at least 16 characters, got length: ${String(salt.length)}`,
    )
  }
  return loadNodeCrypto()
    .createHash('sha256')
    .update(salt + normalizedMsisdn)
    .digest('hex')
}
