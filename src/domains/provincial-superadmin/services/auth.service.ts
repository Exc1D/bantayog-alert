/**
 * Provincial Superadmin Authentication Service
 *
 * Handles authentication for provincial superadmins.
 * Provincial superadmins have full visibility and control across the province.
 *
 * Requirements:
 * - Email/password authentication
 * - Multi-Factor Authentication (MFA) MANDATORY
 * - MFA must be enrolled before accessing the system
 * - Can view all data province-wide
 * - Can promote/demote municipal admins
 * - Sole authority to declare emergencies
 */

import {
  multiFactor,
  PhoneMultiFactorGenerator,
  TotpMultiFactorGenerator,
  MultiFactorUser,
  MultiFactorAssertion,
  MultiFactorInfo,
  MultiFactorSession,
  getMultiFactorResolver,
} from 'firebase/auth'
import { auth } from '@/app/firebase/config'
import { registerBase, loginBase } from '@/shared/services/auth.service'
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/app/firebase/config'
import type { AuthResult, ProvincialSuperadminCredentials, UserProfile } from '@/shared/types'

/**
 * Register a new provincial superadmin
 *
 * Creates Firebase Auth user and Firestore profile.
 * MFA enrollment is required before accessing the system.
 */
export async function registerProvincialSuperadmin(
  credentials: ProvincialSuperadminCredentials
): Promise<AuthResult> {
  const additionalData: Partial<UserProfile> = {
    displayName: credentials.displayName,
    mfaSettings: {
      enabled: false, // Must enroll in MFA before accessing system
      enrollmentTime: undefined,
      lastVerified: undefined,
    },
  }

  const result = await registerBase(credentials, 'provincial_superadmin', additionalData)

  return {
    ...result,
    requiresMFAEnrollment: true,
  }
}

/**
 * Enroll in TOTP-based MFA (recommended)
 *
 * Enrolls the user in Time-based One-Time Password (TOTP) authentication.
 * User must scan a QR code with an authenticator app (Google Authenticator, Authy, etc.).
 *
 * Note: This is a simplified implementation. In production, use Firebase Cloud Functions
 * to generate TOTP secrets securely and handle enrollment.
 *
 * @returns { secretKey, qrCodeUrl } - Data for displaying QR code and completing enrollment
 */
export async function enrollTOTP(): Promise<{
  secretKey: string
  qrCodeUrl: string
}> {
  try {
    const user = auth.currentUser
    if (!user) {
      throw new Error('No authenticated user')
    }

    // Note: Firebase's TOTP enrollment requires Cloud Functions in production
    // This is a placeholder that returns mock data
    // In production, this would call a Cloud Function to generate the TOTP secret

    throw new Error('TOTP enrollment requires Firebase Cloud Functions. Not yet implemented.')

    // Placeholder return type
    return {
      secretKey: 'mock-secret-key',
      qrCodeUrl: 'otpauth://totp/Bantayog%20Alert:user@example.com?secret=mock-secret',
    }
  } catch (error) {
    throw new Error('Failed to generate TOTP secret', { cause: error })
  }
}

/**
 * Finalize TOTP enrollment
 *
 * Completes TOTP enrollment after user scans QR code and enters verification code.
 *
 * @param verificationCode - 6-digit code from authenticator app
 */
export async function finalizeTOTPEnrollment(verificationCode: string): Promise<void> {
  try {
    const user = auth.currentUser
    if (!user) {
      throw new Error('No authenticated user')
    }

    // Note: This requires Firebase Cloud Functions to handle TOTP enrollment securely
    throw new Error('TOTP enrollment requires Firebase Cloud Functions. Not yet implemented.')
  } catch (error) {
    throw new Error('Failed to complete TOTP enrollment', { cause: error })
  }
}

/**
 * Enroll in SMS-based MFA (backup option)
 *
 * Enrolls the user in SMS-based MFA as a backup to TOTP.
 * User will receive SMS codes for verification.
 *
 * @param phoneNumber - Phone number in E.164 format
 */
export async function enrollSMS(phoneNumber: string): Promise<void> {
  try {
    const user = auth.currentUser
    if (!user) {
      throw new Error('No authenticated user')
    }

    // Note: Firebase Phone Auth requires reCAPTCHA verification
    // This is a simplified implementation
    throw new Error('SMS MFA enrollment requires reCAPTCHA setup. Not yet implemented.')
  } catch (error) {
    throw new Error('Failed to complete SMS enrollment', { cause: error })
  }
}

/**
 * Verify MFA during login
 *
 * Completes MFA verification after user enters code from authenticator app or SMS.
 *
 * Note: This is a placeholder. In production, use Firebase's built-in MFA flow
 * with proper error handling and multi-factor session management.
 *
 * @param verificationCode - 6-digit verification code
 */
export async function verifyMFA(verificationCode: string): Promise<void> {
  try {
    // Note: This requires proper integration with Firebase Auth's MFA flow
    // The actual implementation depends on the MFA factor (TOTP or SMS)
    throw new Error('MFA verification requires Firebase Cloud Functions. Not yet implemented.')
  } catch (error) {
    throw new Error('Invalid verification code', { cause: error })
  }
}

/**
 * Provincial superadmin login
 *
 * Email/password login followed by MFA verification.
 * MFA is MANDATORY for provincial superadmins.
 *
 * @throws {Error} If MFA is not enrolled
 * @throws {Error} If MFA verification is required during login
 */
export async function loginProvincialSuperadmin(
  email: string,
  password: string
): Promise<AuthResult> {
  try {
    // First factor: email/password
    const result = await loginBase(email, password)

    // CRITICAL: Enforce MFA enrollment requirement
    const profile = result.user
    if (!profile.mfaSettings?.enabled) {
      throw new Error(
        'Multi-factor authentication (MFA) is required for provincial superadmins. Please enroll in MFA before logging in.',
        { cause: { code: 'MFA_ENROLLMENT_REQUIRED' } }
      )
    }

    // If MFA is enrolled, Firebase will automatically trigger MFA challenge
    // The caller must handle the MFA_REQUIRED exception and complete verification
    return result
  } catch (error: unknown) {
    // Check if error is due to MFA requirement (from Firebase Auth)
    if ((error as { code?: string })?.code === 'auth/multi-factor-auth-required') {
      const resolver = getMultiFactorResolver(error)

      // Throw special error indicating MFA verification is needed
      const mfaError = new Error('MFA verification required') as Error & {
        code: string
        resolver: typeof resolver
      }
      mfaError.code = 'MFA_REQUIRED'
      mfaError.resolver = resolver
      throw mfaError
    }

    throw error
  }
}

/**
 * Unenroll from MFA
 *
 * Removes an MFA factor from the user's account.
 * Should require re-verification before allowing removal.
 *
 * @param factorUid - UID of the factor to remove
 */
export async function unenrollMFA(factorUid: string): Promise<void> {
  try {
    const user = auth.currentUser
    if (!user) {
      throw new Error('No authenticated user')
    }

    // Note: Firebase's unenroll API requires proper multi-factor user handling
    throw new Error('MFA unenrollment requires Firebase Cloud Functions. Not yet implemented.')
  } catch (error) {
    throw new Error('Failed to unenroll MFA factor', { cause: error })
  }
}
