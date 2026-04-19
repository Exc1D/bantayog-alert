import { HttpsError, type FunctionsErrorCode } from 'firebase-functions/v2/https'
import { BantayogErrorCode, type BantayogError } from '@bantayog/shared-validators'

export const BANTAYOG_TO_HTTPS_CODE: Record<BantayogErrorCode, FunctionsErrorCode> = {
  // Validation errors — never retry without fixing input
  VALIDATION_ERROR: 'invalid-argument',
  INVALID_ARGUMENT: 'invalid-argument',
  UNAUTHORIZED: 'unauthenticated',
  FORBIDDEN: 'permission-denied',
  NOT_FOUND: 'not-found',
  CONFLICT: 'already-exists',

  // Quota / rate limit errors — client should back off
  RATE_LIMITED: 'resource-exhausted',
  QUOTA_EXCEEDED: 'resource-exhausted',

  // Transient errors — eligible for retry
  DEADLINE_EXCEEDED: 'deadline-exceeded',
  SERVICE_UNAVAILABLE: 'unavailable',
  INTERNAL_ERROR: 'internal',

  // Domain-specific codes
  REPORT_NOT_FOUND: 'not-found',
  DISPATCH_NOT_FOUND: 'not-found',
  MUNICIPALITY_NOT_FOUND: 'not-found',
  UPLOAD_URL_GENERATION_FAILED: 'internal',
  MEDIA_PROCESSING_FAILED: 'internal',
  INVALID_STATUS_TRANSITION: 'failed-precondition',
  FAILED_PRECONDITION: 'failed-precondition',
  IDEMPOTENCY_KEY_CONFLICT: 'already-exists',
}

export function bantayogErrorToHttps(err: BantayogError): HttpsError {
  return new HttpsError(BANTAYOG_TO_HTTPS_CODE[err.code], err.message, err.data)
}
