import { z } from 'zod';
const userRoleSchema = z.enum([
    'citizen',
    'responder',
    'municipal_admin',
    'agency_admin',
    'provincial_superadmin',
]);
const accountStatusSchema = z.enum(['active', 'suspended', 'disabled']);
export const setStaffClaimsInputSchema = z
    .object({
    uid: z.string().min(1),
    role: userRoleSchema.exclude(['citizen']),
    municipalityId: z.string().min(1).optional(),
    agencyId: z.string().min(1).optional(),
    permittedMunicipalityIds: z.array(z.string().min(1)).default([]),
    mfaEnrolled: z.boolean().default(false),
})
    .superRefine((value, ctx) => {
    if (value.role === 'municipal_admin' && !value.municipalityId) {
        ctx.addIssue({ code: 'custom', message: 'municipalityId is required' });
    }
    if ((value.role === 'agency_admin' || value.role === 'responder') && !value.agencyId) {
        ctx.addIssue({ code: 'custom', message: 'agencyId is required' });
    }
});
export const suspendStaffAccountInputSchema = z.object({
    uid: z.string().min(1),
    reason: z.enum(['suspended', 'claims_updated', 'manual_refresh']),
});
export const activeAccountSchema = z.object({
    uid: z.string().min(1),
    role: userRoleSchema,
    accountStatus: accountStatusSchema,
    municipalityId: z.string().min(1).optional(),
    agencyId: z.string().min(1).optional(),
    permittedMunicipalityIds: z.array(z.string().min(1)).default([]),
    mfaEnrolled: z.boolean().default(false),
    lastClaimIssuedAt: z.number().int().nonnegative(),
    updatedAt: z.number().int().nonnegative(),
});
export const claimRevocationSchema = z.object({
    uid: z.string().min(1),
    revokedAt: z.number().int().nonnegative(),
    reason: z.enum(['suspended', 'claims_updated', 'manual_refresh']),
});
//# sourceMappingURL=auth.js.map