import type { CustomClaims } from '@bantayog/shared-types';
interface SetStaffClaimsInput {
    uid: string;
    role: 'responder' | 'municipal_admin' | 'agency_admin' | 'provincial_superadmin';
    municipalityId?: string | undefined;
    agencyId?: string | undefined;
    permittedMunicipalityIds: string[];
    mfaEnrolled: boolean;
}
export declare function buildStaffClaims(input: SetStaffClaimsInput): CustomClaims;
export declare function buildActiveAccountDoc(uid: string, claims: CustomClaims, updatedAt: number): {
    uid: string;
    role: import("@bantayog/shared-types").UserRole;
    accountStatus: import("@bantayog/shared-types").AccountStatus;
    municipalityId: import("@bantayog/shared-types").MunicipalityId | undefined;
    agencyId: import("@bantayog/shared-types").AgencyId | undefined;
    permittedMunicipalityIds: import("@bantayog/shared-types").MunicipalityId[];
    mfaEnrolled: boolean;
    lastClaimIssuedAt: number;
    updatedAt: number;
};
export declare function buildClaimRevocationDoc(uid: string, revokedAt: number, reason: 'suspended' | 'claims_updated' | 'manual_refresh'): {
    uid: string;
    revokedAt: number;
    reason: "suspended" | "claims_updated" | "manual_refresh";
};
export {};
//# sourceMappingURL=custom-claims.d.ts.map