import { z } from 'zod';
export declare const userDocSchema: z.ZodObject<{
    uid: z.ZodString;
    role: z.ZodEnum<{
        citizen: "citizen";
        responder: "responder";
        municipal_admin: "municipal_admin";
        agency_admin: "agency_admin";
        provincial_superadmin: "provincial_superadmin";
    }>;
    displayName: z.ZodOptional<z.ZodString>;
    phone: z.ZodOptional<z.ZodString>;
    barangayId: z.ZodOptional<z.ZodString>;
    municipalityId: z.ZodOptional<z.ZodString>;
    agencyId: z.ZodOptional<z.ZodString>;
    isPseudonymous: z.ZodBoolean;
    followUpConsent: z.ZodDefault<z.ZodBoolean>;
    schemaVersion: z.ZodNumber;
    createdAt: z.ZodNumber;
    updatedAt: z.ZodNumber;
}, z.core.$strict>;
export declare const reportSmsConsentDocSchema: z.ZodObject<{
    reportId: z.ZodString;
    phone: z.ZodString;
    locale: z.ZodString;
    smsConsent: z.ZodLiteral<true>;
    municipalityId: z.ZodString;
    followUpConsent: z.ZodDefault<z.ZodBoolean>;
    createdAt: z.ZodNumber;
    schemaVersion: z.ZodNumber;
}, z.core.$strict>;
export type UserDoc = z.infer<typeof userDocSchema>;
export type ReportSmsConsentDoc = z.infer<typeof reportSmsConsentDocSchema>;
//# sourceMappingURL=users.d.ts.map