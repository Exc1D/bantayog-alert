import { z } from 'zod';
declare const reachPlanSchema: z.ZodObject<{
    route: z.ZodEnum<{
        direct: "direct";
        ndrrmc_escalation: "ndrrmc_escalation";
    }>;
    fcmCount: z.ZodNumber;
    smsCount: z.ZodNumber;
    segmentCount: z.ZodNumber;
    unicodeWarning: z.ZodBoolean;
}, z.core.$strip>;
export interface MassAlertActor {
    uid: string;
    claims: {
        role: string;
        municipalityId?: string;
        active: boolean;
        auth_time: number;
    };
}
export declare function massAlertReachPlanPreviewCore(db: FirebaseFirestore.Firestore, input: {
    targetScope: {
        municipalityIds: string[];
    };
    message: string;
}, actor: MassAlertActor): Promise<{
    success: false;
    errorCode: "permission-denied";
    reachPlan?: never;
} | {
    success: true;
    reachPlan: {
        route: string;
        fcmCount: number;
        smsCount: number;
        segmentCount: number;
        unicodeWarning: boolean;
    };
    errorCode?: never;
}>;
export declare function sendMassAlertCore(db: FirebaseFirestore.Firestore, input: {
    reachPlan: z.infer<typeof reachPlanSchema>;
    message: string;
    targetScope: {
        municipalityIds: string[];
    };
    idempotencyKey: string;
}, actor: MassAlertActor): Promise<{
    success: false;
    errorCode: "permission-denied";
    requestId?: never;
} | {
    success: true;
    requestId: `${string}-${string}-${string}-${string}-${string}`;
    errorCode?: never;
}>;
export declare function requestMassAlertEscalationCore(db: FirebaseFirestore.Firestore, input: {
    message: string;
    targetScope: {
        municipalityIds: string[];
    };
    evidencePack: {
        linkedReportIds: string[];
        pagasaSignalRef?: string | undefined;
        notes?: string | undefined;
    };
    idempotencyKey: string;
}, actor: MassAlertActor): Promise<{
    success: true;
    requestId: `${string}-${string}-${string}-${string}-${string}`;
} | {
    success: false;
    errorCode: "permission-denied";
}>;
export declare function forwardMassAlertToNDRRMCCore(db: FirebaseFirestore.Firestore, input: {
    requestId: string;
    forwardMethod: string;
    ndrrrcRecipient: string;
}, actor: MassAlertActor): Promise<{
    success: false;
    errorCode: "permission-denied";
} | {
    success: true;
    errorCode?: never;
} | {
    success: false;
    errorCode: "not-found";
} | {
    success: false;
    errorCode: "failed-precondition";
}>;
export declare const massAlertReachPlanPreview: import("firebase-functions/https").CallableFunction<any, Promise<{
    route: string;
    fcmCount: number;
    smsCount: number;
    segmentCount: number;
    unicodeWarning: boolean;
}>, unknown>;
export declare const sendMassAlert: import("firebase-functions/https").CallableFunction<any, Promise<{
    requestId: `${string}-${string}-${string}-${string}-${string}`;
}>, unknown>;
export declare const requestMassAlertEscalation: import("firebase-functions/https").CallableFunction<any, Promise<{
    requestId: `${string}-${string}-${string}-${string}-${string}`;
}>, unknown>;
export declare const forwardMassAlertToNDRRMC: import("firebase-functions/https").CallableFunction<any, Promise<{
    success: true;
    errorCode?: never;
}>, unknown>;
export {};
//# sourceMappingURL=mass-alert.d.ts.map