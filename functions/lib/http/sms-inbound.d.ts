import { type Firestore } from 'firebase-admin/firestore';
export interface SmsInboundWebhookCoreDeps {
    db: Firestore;
    body: unknown;
    headers: Record<string, string | undefined>;
    ip: string;
    now: () => number;
    method?: string;
}
export interface SmsInboundWebhookCoreResult {
    status: 200 | 400 | 403 | 405;
    body?: {
        ok: boolean;
    };
}
export declare function smsInboundWebhookCore(deps: SmsInboundWebhookCoreDeps): Promise<SmsInboundWebhookCoreResult>;
export declare const smsInboundWebhook: import("firebase-functions/https").HttpsFunction;
//# sourceMappingURL=sms-inbound.d.ts.map