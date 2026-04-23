import { z } from 'zod';
export declare const alertDocSchema: z.ZodObject<{
    title: z.ZodString;
    body: z.ZodString;
    severity: z.ZodEnum<{
        low: "low";
        medium: "medium";
        high: "high";
    }>;
    publishedAt: z.ZodNumber;
    publishedBy: z.ZodString;
    sentAt: z.ZodOptional<z.ZodNumber>;
    targetMunicipalityIds: z.ZodArray<z.ZodString>;
    visibility: z.ZodDefault<z.ZodEnum<{
        public: "public";
        internal: "internal";
    }>>;
    schemaVersion: z.ZodDefault<z.ZodNumber>;
}, z.core.$strict>;
export declare const emergencyDocSchema: z.ZodObject<{
    declaredBy: z.ZodString;
    declaredAt: z.ZodNumber;
    title: z.ZodString;
    body: z.ZodString;
    affectedMunicipalityIds: z.ZodArray<z.ZodString>;
    clearsAt: z.ZodOptional<z.ZodNumber>;
    schemaVersion: z.ZodNumber;
}, z.core.$strict>;
export type AlertDoc = z.infer<typeof alertDocSchema>;
export type EmergencyDoc = z.infer<typeof emergencyDocSchema>;
//# sourceMappingURL=alerts-emergencies.d.ts.map