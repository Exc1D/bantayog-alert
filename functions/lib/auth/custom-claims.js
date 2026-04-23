import { asAgencyId, asMunicipalityId } from '@bantayog/shared-types';
export function buildStaffClaims(input) {
    const issuedAt = Date.now();
    const claims = {
        role: input.role,
        accountStatus: 'active',
        mfaEnrolled: input.mfaEnrolled,
        lastClaimIssuedAt: issuedAt,
    };
    if (input.municipalityId) {
        claims.municipalityId = asMunicipalityId(input.municipalityId);
    }
    if (input.agencyId) {
        claims.agencyId = asAgencyId(input.agencyId);
    }
    if (input.permittedMunicipalityIds.length > 0) {
        claims.permittedMunicipalityIds = input.permittedMunicipalityIds.map((id) => asMunicipalityId(id));
    }
    return claims;
}
export function buildActiveAccountDoc(uid, claims, updatedAt) {
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
    };
}
export function buildClaimRevocationDoc(uid, revokedAt, reason) {
    return { uid, revokedAt, reason };
}
//# sourceMappingURL=custom-claims.js.map