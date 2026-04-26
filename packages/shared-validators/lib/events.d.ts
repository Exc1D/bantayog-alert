import { z } from 'zod';
export declare const reportEventSchema: z.ZodObject<{
    reportId: z.ZodString;
    municipalityId: z.ZodString;
    agencyId: z.ZodOptional<z.ZodString>;
    actor: z.ZodString;
    actorRole: z.ZodEnum<{
        citizen: "citizen";
        responder: "responder";
        municipal_admin: "municipal_admin";
        agency_admin: "agency_admin";
        provincial_superadmin: "provincial_superadmin";
        system: "system";
    }>;
    fromStatus: z.ZodEnum<{
        cancelled: "cancelled";
        acknowledged: "acknowledged";
        en_route: "en_route";
        on_scene: "on_scene";
        resolved: "resolved";
        draft_inbox: "draft_inbox";
        new: "new";
        awaiting_verify: "awaiting_verify";
        verified: "verified";
        assigned: "assigned";
        closed: "closed";
        reopened: "reopened";
        rejected: "rejected";
        cancelled_false_report: "cancelled_false_report";
        merged_as_duplicate: "merged_as_duplicate";
    }>;
    toStatus: z.ZodEnum<{
        cancelled: "cancelled";
        acknowledged: "acknowledged";
        en_route: "en_route";
        on_scene: "on_scene";
        resolved: "resolved";
        draft_inbox: "draft_inbox";
        new: "new";
        awaiting_verify: "awaiting_verify";
        verified: "verified";
        assigned: "assigned";
        closed: "closed";
        reopened: "reopened";
        rejected: "rejected";
        cancelled_false_report: "cancelled_false_report";
        merged_as_duplicate: "merged_as_duplicate";
    }>;
    reason: z.ZodOptional<z.ZodString>;
    createdAt: z.ZodNumber;
    correlationId: z.ZodString;
    schemaVersion: z.ZodNumber;
}, z.core.$strict>;
export declare const dispatchEventSchema: z.ZodObject<{
    dispatchId: z.ZodString;
    reportId: z.ZodString;
    actor: z.ZodString;
    actorRole: z.ZodEnum<{
        responder: "responder";
        municipal_admin: "municipal_admin";
        agency_admin: "agency_admin";
        provincial_superadmin: "provincial_superadmin";
        system: "system";
    }>;
    fromStatus: z.ZodEnum<{
        pending: "pending";
        accepted: "accepted";
        declined: "declined";
        cancelled: "cancelled";
        acknowledged: "acknowledged";
        en_route: "en_route";
        on_scene: "on_scene";
        resolved: "resolved";
        timed_out: "timed_out";
        superseded: "superseded";
        unable_to_complete: "unable_to_complete";
    }>;
    toStatus: z.ZodEnum<{
        pending: "pending";
        accepted: "accepted";
        declined: "declined";
        cancelled: "cancelled";
        acknowledged: "acknowledged";
        en_route: "en_route";
        on_scene: "on_scene";
        resolved: "resolved";
        timed_out: "timed_out";
        superseded: "superseded";
        unable_to_complete: "unable_to_complete";
    }>;
    reason: z.ZodOptional<z.ZodString>;
    createdAt: z.ZodNumber;
    correlationId: z.ZodString;
    schemaVersion: z.ZodNumber;
}, z.core.$strict>;
export type ReportEvent = z.infer<typeof reportEventSchema>;
export type DispatchEvent = z.infer<typeof dispatchEventSchema>;
//# sourceMappingURL=events.d.ts.map