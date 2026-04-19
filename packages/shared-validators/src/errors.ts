/**
 * Error types and status helpers for Bantayog Alert.
 *
 * BantayogError is a typed error class used across all Cloud Functions and
 * callables. Structured error codes (BantayogErrorCode) enable front-end
 * branch-on-error without string matching.
 */
import type { ReportStatus, DispatchStatus } from '@bantayog/shared-types'
export type { ReportStatus, DispatchStatus }

/**
 * Error codes used across all Bantayog Alert services.
 * These map to user-facing messages and determine retry behavior.
 */
export enum BantayogErrorCode {
  // Validation errors — never retry without fixing input
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_ARGUMENT = 'INVALID_ARGUMENT',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',

  // Quota / rate limit errors — client should back off
  RATE_LIMITED = 'RATE_LIMITED',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',

  // Transient errors — eligible for retry
  DEADLINE_EXCEEDED = 'DEADLINE_EXCEEDED',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  INTERNAL_ERROR = 'INTERNAL_ERROR',

  // Domain-specific codes
  REPORT_NOT_FOUND = 'REPORT_NOT_FOUND',
  DISPATCH_NOT_FOUND = 'DISPATCH_NOT_FOUND',
  MUNICIPALITY_NOT_FOUND = 'MUNICIPALITY_NOT_FOUND',
  UPLOAD_URL_GENERATION_FAILED = 'UPLOAD_URL_GENERATION_FAILED',
  MEDIA_PROCESSING_FAILED = 'MEDIA_PROCESSING_FAILED',
  INVALID_STATUS_TRANSITION = 'INVALID_STATUS_TRANSITION',
  FAILED_PRECONDITION = 'FAILED_PRECONDITION',
  IDEMPOTENCY_KEY_CONFLICT = 'IDEMPOTENCY_KEY_CONFLICT',
}

/**
 * Returns true if the given string is a valid BantayogErrorCode.
 * Useful for narrowing unknown error code values from external sources.
 */
export function isBantayogErrorCode(value: string): value is BantayogErrorCode {
  return Object.values(BantayogErrorCode).includes(value as BantayogErrorCode)
}

/**
 * Returns true if the given report status is terminal (no further transitions
 * are valid — spec §5.3).
 */
export function isTerminalReportStatus(status: ReportStatus): boolean {
  return status === 'closed' || status === 'resolved'
}

/**
 * Returns true if the given dispatch status is terminal (no further transitions
 * are valid for the responder — spec §5.4).
 */
export function isTerminalDispatchStatus(status: DispatchStatus): boolean {
  return status === 'resolved' || status === 'declined'
}

/**
 * BantayogError is a structured error with a machine-readable code, a safe
 * user message, and an optional payload. It serializes safely to JSON and
 * can be thrown across async boundaries without losing context.
 */
export class BantayogError extends Error {
  constructor(
    public readonly code: BantayogErrorCode,
    message: string,
    public readonly data?: Record<string, unknown>,
  ) {
    super(message)
    this.name = 'BantayogError'
    // captureStackTrace is only available in V8; keep conditional for test envs
    if (typeof Error.captureStackTrace === 'function') {
      Error.captureStackTrace(this, BantayogError)
    }
  }

  toJSON(): object {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      ...(this.data ? { data: this.data } : {}),
    }
  }
}

/**
 * Create a BantayogError with a NOT_FOUND code and entity identifiers.
 * Convenience factory used across callables and triggers.
 */
export function notFoundError(
  entity: string,
  id: string,
  data?: Record<string, unknown>,
): BantayogError {
  return new BantayogError(BantayogErrorCode.NOT_FOUND, `${entity} '${id}' not found`, {
    entityId: id,
    entityType: entity,
    ...data,
  })
}

/**
 * Create a BantayogError with a INVALID_STATUS_TRANSITION code.
 */
export function invalidTransitionError(
  from: string,
  to: string,
  context?: Record<string, unknown>,
): BantayogError {
  return new BantayogError(
    BantayogErrorCode.INVALID_STATUS_TRANSITION,
    `Invalid transition: ${from} → ${to}`,
    { from, to, ...context },
  )
}
