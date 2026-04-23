import { type Firestore } from 'firebase-admin/firestore';
export interface SmsDeliveryReportArgs {
    db: Firestore;
    headers: Record<string, string | undefined>;
    body: unknown;
    now: () => number;
    expectedSecret: string;
}
export interface SmsDeliveryReportResult {
    status: 200 | 401 | 400;
    body?: {
        ok: boolean;
    } | {
        error: string;
    };
}
export declare function smsDeliveryReportCore(args: SmsDeliveryReportArgs): Promise<SmsDeliveryReportResult>;
export declare const smsDeliveryReport: import("firebase-functions/https").HttpsFunction;
//# sourceMappingURL=sms-delivery-report.d.ts.map