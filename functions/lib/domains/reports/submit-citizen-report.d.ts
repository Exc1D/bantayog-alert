import { type Firestore } from 'firebase-admin/firestore';
import { z } from 'zod';
import { type CitizenReportMaterializationResult } from './process-inbox-item.js';
declare const submitCitizenPayloadSchema: z.ZodObject<{
    reportType: z.ZodString;
    description: z.ZodString;
    severity: z.ZodEnum<{
        low: "low";
        medium: "medium";
        high: "high";
    }>;
    source: z.ZodEnum<{
        web: "web";
        sms: "sms";
        responder_witness: "responder_witness";
    }>;
    clientDraftRef: z.ZodOptional<z.ZodString>;
    publicLocation: z.ZodOptional<z.ZodObject<{
        lat: z.ZodNumber;
        lng: z.ZodNumber;
    }, z.core.$strict>>;
    exactLocation: z.ZodOptional<z.ZodObject<{
        lat: z.ZodNumber;
        lng: z.ZodNumber;
    }, z.core.$strict>>;
    pendingMediaIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
    municipalityId: z.ZodOptional<z.ZodString>;
    barangayId: z.ZodOptional<z.ZodString>;
    nearestLandmark: z.ZodOptional<z.ZodString>;
    triage: z.ZodOptional<z.ZodObject<{
        peopleInjured: z.ZodBoolean;
        peopleTrapped: z.ZodBoolean;
        locationConfidence: z.ZodEnum<{
            exact: "exact";
            approximate: "approximate";
            manual: "manual";
        }>;
        urgencyReason: z.ZodOptional<z.ZodString>;
    }, z.core.$strict>>;
    contact: z.ZodOptional<z.ZodObject<{
        phone: z.ZodString;
        smsConsent: z.ZodLiteral<true>;
    }, z.core.$strict>>;
    followUpConsent: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strict>;
export declare const submitCitizenReportSchema: z.ZodObject<{
    clientCreatedAt: z.ZodNumber;
    idempotencyKey: z.ZodString;
    publicRef: z.ZodString;
    secretHash: z.ZodString;
    correlationId: z.ZodUUID;
    payload: z.ZodObject<{
        reportType: z.ZodString;
        description: z.ZodString;
        severity: z.ZodEnum<{
            low: "low";
            medium: "medium";
            high: "high";
        }>;
        source: z.ZodEnum<{
            web: "web";
            sms: "sms";
            responder_witness: "responder_witness";
        }>;
        clientDraftRef: z.ZodOptional<z.ZodString>;
        publicLocation: z.ZodOptional<z.ZodObject<{
            lat: z.ZodNumber;
            lng: z.ZodNumber;
        }, z.core.$strict>>;
        exactLocation: z.ZodOptional<z.ZodObject<{
            lat: z.ZodNumber;
            lng: z.ZodNumber;
        }, z.core.$strict>>;
        pendingMediaIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
        municipalityId: z.ZodOptional<z.ZodString>;
        barangayId: z.ZodOptional<z.ZodString>;
        nearestLandmark: z.ZodOptional<z.ZodString>;
        triage: z.ZodOptional<z.ZodObject<{
            peopleInjured: z.ZodBoolean;
            peopleTrapped: z.ZodBoolean;
            locationConfidence: z.ZodEnum<{
                exact: "exact";
                approximate: "approximate";
                manual: "manual";
            }>;
            urgencyReason: z.ZodOptional<z.ZodString>;
        }, z.core.$strict>>;
        contact: z.ZodOptional<z.ZodObject<{
            phone: z.ZodString;
            smsConsent: z.ZodLiteral<true>;
        }, z.core.$strict>>;
        followUpConsent: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strict>;
}, z.core.$strict>;
export type SubmitCitizenReportPayload = z.infer<typeof submitCitizenPayloadSchema>;
export interface SubmitCitizenReportCoreInput {
    reporterUid: string;
    clientCreatedAt: number;
    idempotencyKey: string;
    publicRef: string;
    secretHash: string;
    correlationId: string;
    payload: SubmitCitizenReportPayload;
    now?: () => number;
}
export declare function submitCitizenReportCore(db: Firestore, input: SubmitCitizenReportCoreInput): Promise<CitizenReportMaterializationResult>;
export declare const submitCitizenReport: import("firebase-functions/https").CallableFunction<unknown, Promise<import("./process-inbox-item.js").ProcessInboxItemCoreResult>, unknown>;
export {};
//# sourceMappingURL=submit-citizen-report.d.ts.map