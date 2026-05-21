import type { CustomClaims } from '@bantayog/shared-types'
import { asAgencyId, asMunicipalityId } from '@bantayog/shared-types'

interface SetStaffClaimsInput {
  uid: string
  role: 'responder' | 'municipal_admin' | 'agency_admin' | 'provincial_superadmin'
  municipalityId?: string | undefined
  agencyId?: string | undefined
  permittedMunicipalityIds: string[]
  mfaEnrolled: boolean
}

export function buildStaffClaims(input: SetStaffClaimsInput): CustomClaims {
  const issuedAt = Date.now()

  const claims: CustomClaims = {
    role: input.role,
    accountStatus: 'active',
    mfaEnrolled: input.mfaEnrolled,
    lastClaimIssuedAt: issuedAt,
  }

  if (input.municipalityId) {
    claims.municipalityId = asMunicipalityId(input.municipalityId)
  }

  if (input.agencyId) {
    claims.agencyId = asAgencyId(input.agencyId)
  }

  if (input.permittedMunicipalityIds.length > 0) {
    claims.permittedMunicipalityIds = input.permittedMunicipalityIds.map((id) =>
      asMunicipalityId(id),
    )
  }

  return claims
}

export function buildActiveAccountDoc(uid: string, claims: CustomClaims, updatedAt: number) {
  return {
    uid,
    role: claims.role,
    accountStatus: claims.accountStatus,
    municipalityId: claims.municipalityId,
    agencyId: claims.agencyId,
    permittedMunicipalityIds: claims.permittedMunicipalityIds ?? [],
    mfaEnrolled: claims.mfaEnrolled,
    lastClaimIssuedAt: claims.lastClaimIssuedAt,
    updatedAt,
  }
}

export function buildClaimRevocationDoc(
  uid: string,
  revokedAt: number,
  reason: 'suspended' | 'claims_updated' | 'manual_refresh',
) {
  return { uid, revokedAt, reason }
}
