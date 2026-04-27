import { Firestore, Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';
export declare const submitResponderWitnessedReportSchema: z.ZodObject<{
    dispatchId: z.ZodString;
    reportType: z.ZodEnum<{
        flood: "flood";
        fire: "fire";
        earthquake: "earthquake";
        typhoon: "typhoon";
        landslide: "landslide";
        storm_surge: "storm_surge";
        medical: "medical";
        accident: "accident";
        structural: "structural";
        security: "security";
        other: "other";
    }>;
    description: z.ZodString;
    severity: z.ZodEnum<{
        high: "high";
        low: "low";
        medium: "medium";
    }>;
    publicLocation: z.ZodObject<{
        lat: z.ZodNumber;
        lng: z.ZodNumber;
    }, z.core.$strict>;
    photoUrl: z.ZodOptional<z.ZodURL>;
    idempotencyKey: z.ZodUUID;
}, z.core.$strict>;
export interface SubmitResponderWitnessedReportCoreDeps {
    dispatchId: string;
    reportType: string;
    description: string;
    severity: 'low' | 'medium' | 'high';
    publicLocation: {
        lat: number;
        lng: number;
    };
    photoUrl?: string;
    idempotencyKey: string;
    actor: {
        uid: string;
        claims: {
            role: string;
            municipalityId?: string;
        };
    };
    now: Timestamp;
}
export declare function submitResponderWitnessedReportCore(db: Firestore, deps: SubmitResponderWitnessedReportCoreDeps): Promise<{
    reportId: string;
    publicTrackingRef: string;
}>;
export declare const submitResponderWitnessedReport: import("firebase-functions/https").CallableFunction<unknown, Promise<{
    reportId: string;
    publicTrackingRef: string;
}>, unknown>;
//# sourceMappingURL=submit-responder-witnessed-report.d.ts.map