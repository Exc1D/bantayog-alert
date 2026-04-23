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
//# sourceMappingURL=incident-response.d.ts.map