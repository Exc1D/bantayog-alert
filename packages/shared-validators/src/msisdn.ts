import { createHash } from 'node:crypto'
import { z } from 'zod'

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
  throw new MsisdnInvalidError(input)
}

export function hashMsisdn(normalizedMsisdn: string, salt: string): string {
  if (!/^\+639\d{9}$/.test(normalizedMsisdn)) {
    throw new Error(`hashMsisdn requires normalized MSISDN, got: ${normalizedMsisdn}`)
  }
  return createHash('sha256')
    .update(salt + normalizedMsisdn)
    .digest('hex')
}
