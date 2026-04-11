/**
 * Shared Authentication Service
 *
 * Provides common authentication operations used across all user roles.
 * Wraps Firebase Auth SDK with application-specific error handling.
 *
 * This service handles the generic Firebase Auth operations.
 * Role-specific authentication logic is in domain-specific services.
 */

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithCustomToken,
  signOut as firebaseSignOut,
  sendEmailVerification,
  sendPasswordResetEmail,
  updateProfile,
  User as FirebaseUser,
  UserCredential,
} from 'firebase/auth'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '@/app/firebase/config'
import type { UserProfile, AuthResult, AuthCredentials, AuthErrorCode } from '@/shared/types'

/**
 * Map Firebase Auth errors to application-specific error codes
 */
function getAuthErrorCode(error: unknown): AuthErrorCode {
  const code = (error as { code?: string })?.code || ''

  switch (code) {
    case 'auth/email-already-in-use':
      return 'EMAIL_ALREADY_IN_USE'
    case 'auth/invalid-email':
      return 'INVALID_EMAIL'
    case 'auth/weak-password':
      return 'WEAK_PASSWORD'
    case 'auth/user-disabled':
      return 'ACCOUNT_SUSPENDED'
    case 'auth/user-not-found':
    case 'auth/wrong-password':
      return 'UNAUTHORIZED'
    case 'auth/network-request-failed':
      return 'NETWORK_ERROR'
    default:
      return 'UNKNOWN_ERROR'
  }
}

/**
 * Get user profile from Firestore
 *
 * Fetches the user profile document. Returns null if it doesn't exist.
 */
export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  try {
    const docRef = doc(db, 'users', uid)
    const docSnap = await getDoc(docRef)

    if (docSnap.exists()) {
      return docSnap.data() as UserProfile
    }

    return null
  } catch (error) {
    throw new Error('Failed to fetch user profile', { cause: error })
  }
}

/**
 * Create user profile in Firestore
 *
 * Called after successful Firebase Auth registration.
 * Creates the user document with role and profile data.
 */
export async function createUserProfile(
  uid: string,
  email: string,
  role: UserProfile['role'],
  additionalData?: Partial<UserProfile>
): Promise<UserProfile> {
  try {
    const now = Date.now()

    const profile: UserProfile = {
      uid,
      email,
      role,
      emailVerified: false,
      createdAt: now,
      updatedAt: now,
      isActive: true,
      ...additionalData,
    }

    await setDoc(doc(db, 'users', uid), profile)

    return profile
  } catch (error) {
    throw new Error('Failed to create user profile', { cause: error })
  }
}

/**
 * Generic registration handler
 *
 * Base registration logic used by all role-specific registration functions.
 * Creates Firebase Auth user and Firestore profile.
 */
export async function registerBase(
  credentials: AuthCredentials,
  role: UserProfile['role'],
  additionalData?: Partial<UserProfile>
): Promise<AuthResult> {
  try {
    // Create Firebase Auth user
    const userCredential: UserCredential = await createUserWithEmailAndPassword(
      auth,
      credentials.email,
      credentials.password
    )

    const { user } = userCredential

    // Update display name if provided
    if (credentials.displayName) {
      await updateProfile(user, {
        displayName: credentials.displayName,
      })
    }

    // Create Firestore profile
    const profile = await createUserProfile(user.uid, user.email!, role, additionalData)

    // Send email verification
    await sendEmailVerification(user)

    return {
      user: profile,
      requiresEmailVerification: true,
    }
  } catch (error) {
    const errorCode = getAuthErrorCode(error)
    throw new Error(`Registration failed: ${(error as Error).message}`, { cause: error })
  }
}

/**
 * Generic login handler
 *
 * Base login logic used by all role-specific login functions.
 * Authenticates with Firebase Auth and fetches user profile.
 */
export async function loginBase(email: string, password: string): Promise<AuthResult> {
  try {
    // Sign in with Firebase Auth
    const userCredential: UserCredential = await signInWithEmailAndPassword(auth, email, password)

    const { user } = userCredential

    // Fetch user profile from Firestore
    const profile = await getUserProfile(user.uid)

    if (!profile) {
      throw new Error('User profile not found')
    }

    // Check if account is active
    if (!profile.isActive) {
      throw new Error(`Account suspended: ${profile.suspendedReason || 'Contact administrator'}`)
    }

    // Update last login
    // Note: This will be done by a Firebase Function in production
    // to ensure custom claims are set

    const result: AuthResult = { user: profile }

    if (!user.emailVerified) {
      result.requiresEmailVerification = true
    }

    return result
  } catch (error) {
    throw new Error(`Login failed: ${(error as Error).message}`, {
      cause: error,
    })
  }
}

/**
 * Sign out current user
 *
 * Signs out from Firebase Auth and clears local state.
 */
export async function signOut(): Promise<void> {
  try {
    await firebaseSignOut(auth)
  } catch (error) {
    throw new Error('Sign out failed', { cause: error })
  }
}

/**
 * Send password reset email
 *
 * Initiates password reset flow for a given email address.
 */
export async function sendPasswordReset(email: string): Promise<void> {
  try {
    await sendPasswordResetEmail(auth, email)
  } catch (error) {
    throw new Error('Failed to send password reset email', { cause: error })
  }
}

/**
 * Refresh ID token
 *
 * Forces token refresh to pick up new custom claims.
 * Call this after role changes or permission updates.
 */
export async function refreshIdToken(): Promise<string | null> {
  try {
    const user = auth.currentUser

    if (!user) {
      return null
    }

    // Force token refresh
    const idToken = await user.getIdToken(true)

    return idToken
  } catch (error) {
    throw new Error('Failed to refresh ID token', { cause: error })
  }
}

/**
 * Get current Firebase user
 *
 * Returns the currently authenticated Firebase user or null.
 */
export function getCurrentUser(): FirebaseUser | null {
  return auth.currentUser
}

/**
 * Check if user is authenticated
 *
 * Returns true if a user is currently signed in.
 */
export function isAuthenticated(): boolean {
  return auth.currentUser !== null
}

/**
 * Get ID token
 *
 * Returns the current ID token (JWT) with custom claims.
 * Use this for API calls to Firebase Functions or other backends.
 */
export async function getIdToken(): Promise<string | null> {
  try {
    const user = auth.currentUser

    if (!user) {
      return null
    }

    return await user.getIdToken()
  } catch (error) {
    throw new Error('Failed to get ID token', { cause: error })
  }
}
