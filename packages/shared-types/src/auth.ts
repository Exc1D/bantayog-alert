import type { AgencyId, MunicipalityId, UserUid } from './branded.js'
import type { AccountStatus, UserRole } from './enums.js'

export interface CustomClaims {
  role: UserRole
  municipalityId?: MunicipalityId
  agencyId?: AgencyId
  permittedMunicipalityIds?: MunicipalityId[]
  accountStatus: AccountStatus
  mfaEnrolled: boolean
  lastClaimIssuedAt: number
  breakGlassSession?: boolean
}

export interface ActiveAccountDoc {
  uid: UserUid
  role: UserRole
  accountStatus: AccountStatus
  municipalityId?: MunicipalityId
  agencyId?: AgencyId
  permittedMunicipalityIds: MunicipalityId[]
  mfaEnrolled: boolean
  lastClaimIssuedAt: number
  updatedAt: number
}

export interface ClaimRevocationDoc {
  uid: UserUid
  revokedAt: number
  reason: 'suspended' | 'claims_updated' | 'manual_refresh'
}
