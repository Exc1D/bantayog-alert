import { HttpsError, type FunctionsErrorCode } from 'firebase-functions/v2/https'
import type { BantayogError } from '@bantayog/shared-validators'

export const BANTAYOG_TO_HTTPS_CODE: Record<string, FunctionsErrorCode> = {
  UNAUTHORIZED: 'unauthenticated',
  FORBIDDEN: 'permission-denied',
  NOT_FOUND: 'not-found',
  INVALID_ARGUMENT: 'invalid-argument',
  CONFLICT: 'already-exists',
  RATE_LIMITED: 'resource-exhausted',
}

export function bantayogErrorToHttps(err: BantayogError): HttpsError {
  return new HttpsError(BANTAYOG_TO_HTTPS_CODE[err.code] ?? 'internal', err.message, err.data)
}
