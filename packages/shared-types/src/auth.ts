import type { AccountStatus, ResponderType, Role } from './enums'

/** §4.2 — Firebase Auth custom claims */
export interface CustomClaims {
  role: Role
  municipalityId?: string
  agencyId?: string
  permittedMunicipalityIds?: string[]
  mfaVerified: boolean
  claimsVersion: number
  accountStatus: AccountStatus
  responderType?: ResponderType
  breakGlassSession?: boolean
}

/** §4.3 — active_accounts/{uid} */
export interface ActiveAccount {
  accountStatus: AccountStatus
  lastUpdatedAt: FirestoreTimestamp
}

/** §4.3 — claim_revocations/{uid} */
export interface ClaimRevocation {
  revokedAt: FirestoreTimestamp
  reason: string
  revokedBy: string
}

/**
 * Placeholder for Firestore Timestamp — packages importing this
 * type from shared-types don't need the firebase SDK dependency.
 * The actual Firestore Timestamp is substituted at runtime via converters.
 */
export type FirestoreTimestamp = {
  seconds: number
  nanoseconds: number
}
