/**
 * Responder Authentication Service
 *
 * Handles authentication for responders (emergency response personnel).
 * Responders are deployed by municipal admins to handle incidents.
 *
 * Requirements:
 * - Email/password authentication
 * - Phone number MANDATORY (admins call responders directly)
 * - Phone verification via OTP REQUIRED
 * - Email verification required
 */

import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  ApplicationVerifier,
} from 'firebase/auth'
import { auth } from '@/app/firebase/config'
import { registerBase, loginBase } from '@/shared/services/auth.service'
import {
  doc,
  setDoc,
  serverTimestamp,
  where,
} from 'firebase/firestore'
import { db } from '@/app/firebase/config'
import { getCollection } from '@/shared/services/firestore.service'
import type {
  AuthResult,
  ResponderCredentials,
  UserProfile,
  Responder,
} from '@/shared/types'

/**
 * Register a new responder
 *
 * Creates Firebase Auth user and Firestore profile.
 * Phone number is MANDATORY for responders.
 *
 * Note: Phone verification must be completed separately using verifyResponderPhone()
 */
export async function registerResponder(
  credentials: ResponderCredentials
): Promise<AuthResult> {
  // Validate phone number is present
  if (!credentials.phoneNumber) {
    throw new Error('Phone number is required for responders')
  }

  // CRITICAL: Check phone number uniqueness
  const existingUsers = await getCollection<UserProfile>('users', [
    where('phoneNumber', '==', credentials.phoneNumber),
  ])

  if (existingUsers.length > 0) {
    throw new Error(
      'This phone number is already registered to another responder. Please use a different phone number or contact administrator.',
      { cause: { code: 'PHONE_ALREADY_IN_USE' } }
    )
  }

  const additionalData: Partial<UserProfile> = {
    displayName: credentials.displayName,
    phoneNumber: credentials.phoneNumber,
    phoneVerified: false, // Must complete phone verification
  }

  const result = await registerBase(credentials, 'responder', additionalData)

  // Create responder-specific profile
  await createResponderProfile(result.user.uid, credentials.phoneNumber)

  return {
    ...result,
    requiresPhoneVerification: true,
  }
}

/**
 * Create responder-specific profile
 *
 * Extends the user profile with responder-specific fields.
 */
export async function createResponderProfile(
  uid: string,
  phoneNumber: string
): Promise<void> {
  const responderProfile: Responder = {
    uid,
    phoneNumber,
    phoneVerified: false, // Will be set to true after OTP verification
    isOnDuty: false,
    isAvailable: false,
    capabilities: [], // Will be assigned by admin
    totalAssignments: 0,
    completedAssignments: 0,
  }

  await setDoc(doc(db, 'responders', uid), responderProfile)
}

/**
 * Initiate phone verification via OTP
 *
 * Sends a one-time password to the responder's phone number.
 * Uses Firebase Phone Auth with reCAPTCHA verification.
 *
 * Returns a confirmation result that should be passed to verifyResponderPhoneOTP()
 *
 * @param phoneNumber - Phone number in E.164 format (e.g., +639123456789)
 * @param recaptchaVerifier - ReCAPTCHA verifier instance
 */
export async function initiateResponderPhoneVerification(
  phoneNumber: string,
  recaptchaVerifier: ApplicationVerifier
): Promise<unknown> {
  try {
    const confirmationResult = await signInWithPhoneNumber(
      auth,
      phoneNumber,
      recaptchaVerifier
    )

    return confirmationResult
  } catch (error) {
    throw new Error('Failed to send verification code', { cause: error })
  }
}

/**
 * Verify phone number with OTP code
 *
 * Completes phone verification using the code sent via SMS.
 * Updates the responder profile to mark phone as verified.
 *
 * @param confirmationResult - Result from initiateResponderPhoneVerification()
 * @param code - 6-digit OTP code from SMS
 */
export async function verifyResponderPhoneOTP(
  confirmationResult: unknown,
  code: string
): Promise<void> {
  try {
    // @ts-expect-error - confirmationResult is opaque Firebase type
    await confirmationResult.confirm(code)

    const user = auth.currentUser
    if (!user) {
      throw new Error('No authenticated user')
    }

    // Update responder profile to mark phone as verified
    const responderRef = doc(db, 'responders', user.uid)
    await setDoc(
      responderRef,
      {
        phoneVerified: true,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    )

    // CRITICAL: Also update UserProfile to enforce login check
    const userRef = doc(db, 'users', user.uid)
    await setDoc(
      userRef,
      {
        phoneVerified: true,
        updatedAt: Date.now(),
      },
      { merge: true }
    )
  } catch (error) {
    throw new Error('Invalid verification code', { cause: error })
  }
}

/**
 * Responder login
 *
 * Standard email/password login for responders.
 * Phone must have been verified during registration.
 *
 * @throws {Error} If phone number is not verified
 */
export async function loginResponder(
  email: string,
  password: string
): Promise<AuthResult> {
  const result = await loginBase(email, password)

  // CRITICAL: Enforce phone verification requirement
  if (!result.user.phoneVerified) {
    throw new Error(
      'Phone verification required. Please complete phone verification before logging in.',
      { cause: { code: 'PHONE_NOT_VERIFIED' } }
    )
  }

  return result
}

/**
 * Create reCAPTCHA verifier
 *
 * Creates a reCAPTCHA verifier instance for phone verification.
 * Call this before initiating phone verification.
 *
 * @param containerId - ID of the container element for reCAPTCHA widget
 */
export function createRecaptchaVerifier(
  containerId: string
): ApplicationVerifier {
  return new RecaptchaVerifier(auth, containerId, {
    size: 'normal',
  })
}
