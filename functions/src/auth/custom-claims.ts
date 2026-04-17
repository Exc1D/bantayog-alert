import type { CustomClaims } from '@bantayog/shared-types'
import { asAgencyId, asMunicipalityId } from '@bantayog/shared-types'
import { setStaffClaimsInputSchema } from '@bantayog/shared-validators'

export function buildStaffClaims(input: unknown): CustomClaims {
  const parsed = setStaffClaimsInputSchema.parse(input)
  const issuedAt = Date.now()

  const claims: CustomClaims = {
    role: parsed.role,
    accountStatus: 'active',
    mfaEnrolled: parsed.mfaEnrolled,
    lastClaimIssuedAt: issuedAt,
  }

  if (parsed.municipalityId) {
    claims.municipalityId = asMunicipalityId(parsed.municipalityId)
  }

  if (parsed.agencyId) {
    claims.agencyId = asAgencyId(parsed.agencyId)
  }

  if (parsed.permittedMunicipalityIds.length > 0) {
    claims.permittedMunicipalityIds = parsed.permittedMunicipalityIds.map((id) =>
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
