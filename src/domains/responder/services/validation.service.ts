/**
 * Validation Service for Responder Dispatch Workflow
 *
 * Provides pre-flight validation checks before sensitive operations.
 * These functions are synchronous where possible to avoid async pitfalls
 * in critical paths.
 */

import type { QuickStatus } from '../types'
import type { RichLocation } from '../types'

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean
  message?: string
  code?: string
}

/**
 * Check if SOS can be activated
 */
export async function canActivateSOS(): Promise<ValidationResult> {
  // Check network connectivity (SOS requires network)
  if (!navigator.onLine) {
    return {
      valid: false,
      message: 'SOS activation requires internet connection',
      code: 'SOS_OFFLINE',
    }
  }

  // Additional pre-flight checks can go here
  return { valid: true }
}

/**
 * Check if status update is valid
 */
export async function canUpdateStatus(
  _dispatchId: string,
  _status: QuickStatus
): Promise<ValidationResult> {
  // Check if dispatcher is assigned to this dispatch
  // (This would check Firestore in real implementation)

  // For now, always valid - actual check in hook
  return { valid: true }
}

/**
 * Validate GPS coordinates
 */
export function validateGPSLocation(location: RichLocation): ValidationResult {
  if (location.latitude === 0 && location.longitude === 0) {
    return {
      valid: false,
      message: 'Invalid GPS coordinates (0,0)',
      code: 'INVALID_COORDS',
    }
  }

  if (Math.abs(location.latitude) > 90 || Math.abs(location.longitude) > 180) {
    return {
      valid: false,
      message: 'Coordinates out of valid range',
      code: 'OUT_OF_RANGE',
    }
  }

  return { valid: true }
}
