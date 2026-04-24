/**
 * Storage error type guards for localStorage/sessionStorage operations.
 * Handles browser private mode and quota exceeded scenarios.
 */

/**
 * Checks if an error is a QuotaExceededError.
 * This occurs when localStorage/sessionStorage is full.
 *
 * @param err - The error to check
 * @returns true if the error is a QuotaExceededError
 */
export function isQuotaExceededError(err: unknown): boolean {
  return (
    err instanceof DOMException &&
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    (err.name === 'QuotaExceededError' || err.code === 22)
  )
}

/**
 * Checks if an error is a SecurityError.
 * This typically occurs in browser private/incognito mode.
 *
 * @param err - The error to check
 * @returns true if the error is a SecurityError
 */
export function isSecurityError(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'SecurityError'
}
