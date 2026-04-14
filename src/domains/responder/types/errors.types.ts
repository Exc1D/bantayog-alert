/**
 * Formal error taxonomy for logging/monitoring infrastructure.
 * Domain-specific errors (DispatchesError, QuickStatusError, SOSError) use
 * simpler discriminated unions — these are complementary, not replacements.
 */
export interface BaseError {
  code: string
  message: string
  timestamp: number
  context?: Record<string, unknown>
}

/**
 * Fatal errors require user intervention
 */
export type FatalError = BaseError & {
  type: 'FATAL'
  category: 'PERMISSION_DENIED' | 'VALIDATION_ERROR' | 'AUTH_EXPIRED'
  userAction: 'RELOGIN' | 'CONTACT_ADMIN' | 'UPDATE_APP'
}

/**
 * Recoverable errors can auto-retry
 */
export type RecoverableError = BaseError & {
  type: 'RECOVERABLE'
  category: 'NETWORK_ERROR' | 'TIMEOUT' | 'SERVER_ERROR'
  retryable: boolean
  retryAfter?: number  // milliseconds
}

/**
 * Union of all responder errors
 */
export type ResponderError = FatalError | RecoverableError
