/**
 * Authentication types for Bantayog Alert
 *
 * Defines the contract for all authentication operations across the platform.
 * Supports 4 user roles with different authentication requirements.
 */

/**
 * User roles in the Bantayog Alert system
 *
 * Each role has specific permissions and authentication requirements:
 * - citizen: Basic email/password auth, can submit reports
 * - responder: Email/password + phone verification (OTP required)
 * - municipal_admin: Email/password + municipality assignment
 * - provincial_superadmin: Email/password + MFA (TOTP mandatory)
 */
export type UserRole =
  | 'citizen'
  | 'responder'
  | 'municipal_admin'
  | 'provincial_superadmin'

/**
 * Authentication credentials for registration
 *
 * Base credentials required for all roles. Each role extends this
 * with additional requirements (phone, municipality, MFA settings).
 */
export interface AuthCredentials {
  email: string
  password: string
  displayName?: string
}

/**
 * Responder-specific credentials
 *
 * Responders MUST provide a phone number for OTP verification.
 * Municipal admins call responders directly, so phone is required.
 */
export interface ResponderCredentials extends AuthCredentials {
  phoneNumber: string
}

/**
 * Municipal Admin credentials
 *
 * Municipal admins are bound to a specific municipality.
 * They can only manage data within their assigned municipality.
 */
export interface MunicipalAdminCredentials extends AuthCredentials {
  municipality: string
}

/**
 * Provincial Superadmin credentials
 *
 * Provincial superadmins MUST enable MFA before they can access the system.
 * MFA enrollment can be completed during or after registration.
 */
export interface ProvincialSuperadminCredentials extends AuthCredentials {
  mfaRequired: boolean // Always true for this role
}

/**
 * Multi-Factor Authentication settings
 *
 * Required for provincial superadmins. Supports TOTP authenticator apps
 * (recommended) with SMS and hardware key as backup options.
 */
export interface MFASettings {
  enabled: boolean
  factorId?: string // Firebase multi-factor ID
  enrollmentTime?: number
  lastVerified?: number
}

/**
 * User profile data stored in Firestore
 *
 * This extends Firebase Auth user data with application-specific fields.
 * Stored in the `users` collection with document ID = Firebase Auth UID.
 */
export interface UserProfile {
  uid: string // Firebase Auth UID
  email: string
  displayName?: string
  role: UserRole
  emailVerified: boolean
  createdAt: number
  updatedAt: number
  lastLoginAt?: number

  // Role-specific fields
  phoneNumber?: string // For responders
  municipality?: string // For municipal admins
  mfaSettings?: MFASettings // For provincial superadmins

  // Account status
  isActive: boolean
  suspendedReason?: string

  // Session management
  lastActiveAt?: number
  forceLogout?: boolean // Admin can force logout by setting this to true
}

/**
 * Authentication result
 *
 * Returned by all authentication operations (register, login).
 * Contains the user credential and profile data.
 */
export interface AuthResult {
  user: UserProfile
  requiresEmailVerification?: boolean
  requiresPhoneVerification?: boolean
  requiresMFAEnrollment?: boolean
}

/**
 * Custom JWT claims set by Firebase Functions
 *
 * These claims are attached to the Firebase ID token and used for
 * authorization in Firestore security rules and client-side checks.
 */
export interface CustomClaims {
  role: UserRole
  municipality?: string // For municipal admins
  emailVerified: boolean
  isActive: boolean
}

/**
 * Session information for session management
 *
 * Users can view their active sessions and administrators can force logout.
 */
export interface UserSession {
  id: string
  uid: string
  createdAt: number
  lastActiveAt: number
  deviceInfo?: {
    userAgent?: string
    platform?: string
  }
  location?: {
    ip?: string
    city?: string
    country?: string
  }
}

/**
 * Account recovery request
 *
 * Used when a user loses access to their account (forgot password, lost MFA device).
 * For provincial superadmins, requires verification by another superadmin.
 */
export interface AccountRecoveryRequest {
  id: string
  uid: string
  requestedAt: number
  reason: string
  status: 'pending' | 'approved' | 'denied'
  verifiedBy?: string // UID of the superadmin who approved (for superadmin recovery)
  resolvedAt?: number
}

/**
 * Error types for authentication operations
 */
export class AuthError extends Error {
  constructor(
    message: string,
    public code: AuthErrorCode,
    public originalError?: unknown
  ) {
    super(message)
    this.name = 'AuthError'
  }
}

export type AuthErrorCode =
  | 'EMAIL_ALREADY_IN_USE'
  | 'INVALID_EMAIL'
  | 'WEAK_PASSWORD'
  | 'PHONE_ALREADY_IN_USE'
  | 'INVALID_PHONE'
  | 'MUNICIPALITY_REQUIRED'
  | 'MFA_ENROLLMENT_REQUIRED'
  | 'MFA_VERIFICATION_FAILED'
  | 'PERMISSION_DENIED'
  | 'ACCOUNT_SUSPENDED'
  | 'UNAUTHORIZED'
  | 'NETWORK_ERROR'
  | 'UNKNOWN_ERROR'
