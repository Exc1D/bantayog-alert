import { z } from 'zod';
export declare const incidentResponseEventSchema: z.ZodObject<{
    incidentId: z.ZodString;
    phase: z.ZodEnum<{
        closed: "closed";
        declared: "declared";
        contained: "contained";
        preserved: "preserved";
        assessed: "assessed";
        notified_npc: "notified_npc";
        notified_subjects: "notified_subjects";
        post_report: "post_report";
    }>;
    actor: z.ZodString;
    discoveredAt: z.ZodOptional<z.ZodNumber>;
    notes: z.ZodOptional<z.ZodString>;
    createdAt: z.ZodNumber;
    correlationId: z.ZodString;
}, z.core.$strict>;
export type IncidentResponseEvent = z.infer<typeof incidentResponseEventSchema>;
export declare const dataIncidentDocSchema: z.ZodObject<{
    incidentType: z.ZodEnum<{
        unauthorized_access: "unauthorized_access";
        data_loss: "data_loss";
        data_corruption: "data_corruption";
        system_breach: "system_breach";
        accidental_disclosure: "accidental_disclosure";
    }>;
    severity: z.ZodEnum<{
        low: "low";
        medium: "medium";
        high: "high";
        critical: "critical";
    }>;
    affectedCollections: z.ZodArray<z.ZodString>;
    affectedDataClasses: z.ZodArray<z.ZodString>;
    estimatedAffectedSubjects: z.ZodOptional<z.ZodNumber>;
    summary: z.ZodString;
    status: z.ZodEnum<{
        closed: "closed";
        declared: "declared";
        contained: "contained";
        preserved: "preserved";
        assessed: "assessed";
        notified_npc: "notified_npc";
        notified_subjects: "notified_subjects";
        post_report: "post_report";
    }>;
    declaredAt: z.ZodNumber;
    declaredBy: z.ZodString;
    closedAt: z.ZodOptional<z.ZodNumber>;
    retentionExempt: z.ZodBoolean;
    schemaVersion: z.ZodNumber;
}, z.core.$strict>;
export type DataIncidentDoc = z.infer<typeof dataIncidentDocSchema>;
//# sourceMappingURL=incident-response.d.ts.map