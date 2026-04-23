import { z } from 'zod';
export declare const setStaffClaimsInputSchema: z.ZodObject<{
    uid: z.ZodString;
    role: z.ZodEnum<{
        responder: "responder";
        municipal_admin: "municipal_admin";
        agency_admin: "agency_admin";
        provincial_superadmin: "provincial_superadmin";
    }>;
    municipalityId: z.ZodOptional<z.ZodString>;
    agencyId: z.ZodOptional<z.ZodString>;
    permittedMunicipalityIds: z.ZodDefault<z.ZodArray<z.ZodString>>;
    mfaEnrolled: z.ZodDefault<z.ZodBoolean>;
}, z.core.$strip>;
export declare const suspendStaffAccountInputSchema: z.ZodObject<{
    uid: z.ZodString;
    reason: z.ZodEnum<{
        suspended: "suspended";
        claims_updated: "claims_updated";
        manual_refresh: "manual_refresh";
    }>;
}, z.core.$strip>;
export declare const activeAccountSchema: z.ZodObject<{
    uid: z.ZodString;
    role: z.ZodEnum<{
        citizen: "citizen";
        responder: "responder";
        municipal_admin: "municipal_admin";
        agency_admin: "agency_admin";
        provincial_superadmin: "provincial_superadmin";
    }>;
    accountStatus: z.ZodEnum<{
        active: "active";
        suspended: "suspended";
        disabled: "disabled";
    }>;
    municipalityId: z.ZodOptional<z.ZodString>;
    agencyId: z.ZodOptional<z.ZodString>;
    permittedMunicipalityIds: z.ZodDefault<z.ZodArray<z.ZodString>>;
    mfaEnrolled: z.ZodDefault<z.ZodBoolean>;
    lastClaimIssuedAt: z.ZodNumber;
    updatedAt: z.ZodNumber;
}, z.core.$strip>;
export declare const claimRevocationSchema: z.ZodObject<{
    uid: z.ZodString;
    revokedAt: z.ZodNumber;
    reason: z.ZodEnum<{
        suspended: "suspended";
        claims_updated: "claims_updated";
        manual_refresh: "manual_refresh";
    }>;
}, z.core.$strip>;
//# sourceMappingURL=auth.d.ts.map