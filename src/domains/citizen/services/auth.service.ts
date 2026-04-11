/**
 * Citizen Authentication Service
 *
 * Handles authentication for citizens (general public).
 * Citizens can submit disaster reports anonymously or with registration.
 *
 * Requirements:
 * - Email/password authentication
 * - Optional phone number (for contact about reports)
 * - Email verification required
 */

import { registerBase, loginBase } from '@/shared/services/auth.service'
import type { AuthResult, AuthCredentials, UserProfile } from '@/shared/types'

/**
 * Citizen registration
 *
 * Registers a new citizen account. Phone number is optional.
 * Citizens can submit reports anonymously, but registration provides:
 * - Track their own reports
 * - Receive updates on their reports
 * - Better credibility for reports
 */
export async function registerCitizen(
  credentials: AuthCredentials & { phoneNumber?: string }
): Promise<AuthResult> {
  const additionalData: Partial<UserProfile> = {
    displayName: credentials.displayName,
    phoneNumber: credentials.phoneNumber,
  }

  return registerBase(credentials, 'citizen', additionalData)
}

/**
 * Citizen login
 *
 * Standard email/password login for citizens.
 */
export async function loginCitizen(email: string, password: string): Promise<AuthResult> {
  return loginBase(email, password)
}
