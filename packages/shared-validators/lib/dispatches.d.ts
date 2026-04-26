import { z } from 'zod';
export declare const dispatchStatusSchema: z.ZodEnum<{
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
export type DispatchStatus = z.infer<typeof dispatchStatusSchema>;
export declare const dispatchDocSchema: z.ZodObject<{
    reportId: z.ZodString;
    assignedTo: z.ZodObject<{
        uid: z.ZodString;
        agencyId: z.ZodString;
        municipalityId: z.ZodString;
    }, z.core.$strip>;
    dispatchedBy: z.ZodString;
    dispatchedByRole: z.ZodEnum<{
        municipal_admin: "municipal_admin";
        agency_admin: "agency_admin";
    }>;
    dispatchedAt: z.ZodNumber;
    status: z.ZodEnum<{
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
    statusUpdatedAt: z.ZodNumber;
    acknowledgementDeadlineAt: z.ZodNumber;
    acknowledgedAt: z.ZodOptional<z.ZodNumber>;
    enRouteAt: z.ZodOptional<z.ZodNumber>;
    onSceneAt: z.ZodOptional<z.ZodNumber>;
    resolvedAt: z.ZodOptional<z.ZodNumber>;
    cancelledAt: z.ZodOptional<z.ZodNumber>;
    cancelledBy: z.ZodOptional<z.ZodString>;
    cancelReason: z.ZodOptional<z.ZodString>;
    timeoutReason: z.ZodOptional<z.ZodString>;
    declineReason: z.ZodOptional<z.ZodString>;
    resolutionSummary: z.ZodOptional<z.ZodString>;
    proofPhotoUrl: z.ZodOptional<z.ZodString>;
    requestedByMunicipalAdmin: z.ZodOptional<z.ZodBoolean>;
    requestId: z.ZodOptional<z.ZodString>;
    idempotencyKey: z.ZodString;
    idempotencyPayloadHash: z.ZodString;
    schemaVersion: z.ZodNumber;
}, z.core.$strict>;
declare const advanceDispatchTargetSchema: z.ZodEnum<{
    acknowledged: "acknowledged";
    en_route: "en_route";
    on_scene: "on_scene";
    resolved: "resolved";
}>;
export declare const advanceDispatchRequestSchema: z.ZodObject<{
    dispatchId: z.ZodString;
    to: z.ZodEnum<{
        acknowledged: "acknowledged";
        en_route: "en_route";
        on_scene: "on_scene";
        resolved: "resolved";
    }>;
    resolutionSummary: z.ZodOptional<z.ZodString>;
    idempotencyKey: z.ZodUUID;
}, z.core.$strict>;
export type AdvanceDispatchTarget = z.infer<typeof advanceDispatchTargetSchema>;
export type AdvanceDispatchRequest = z.infer<typeof advanceDispatchRequestSchema>;
export type DispatchDoc = z.infer<typeof dispatchDocSchema>;
export {};
//# sourceMappingURL=dispatches.d.ts.map