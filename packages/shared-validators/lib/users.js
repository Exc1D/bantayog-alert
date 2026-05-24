import { z } from 'zod';
export const userDocSchema = z
    .object({
    uid: z.string().min(1),
    role: z.enum([
        'citizen',
        'responder',
        'municipal_admin',
        'agency_admin',
        'provincial_superadmin',
    ]),
    displayName: z.string().optional(),
    phone: z.string().optional(),
    barangayId: z.string().optional(),
    municipalityId: z.string().optional(),
    agencyId: z.string().optional(),
    isPseudonymous: z.boolean(),
    followUpConsent: z.boolean().default(false),
    schemaVersion: z.number().int().positive(),
    createdAt: z.number().int(),
    updatedAt: z.number().int(),
})
    .strict();
//# sourceMappingURL=users.js.map