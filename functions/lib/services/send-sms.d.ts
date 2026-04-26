import type { Transaction, Firestore } from 'firebase-admin/firestore';
import { type SmsPurpose, type DirectSmsPurpose, type SmsLocale } from '@bantayog/shared-validators';
export interface EnqueueSmsArgs {
    reportId: string;
    dispatchId?: string | undefined;
    purpose: DirectSmsPurpose;
    recipientMsisdn: string;
    locale: SmsLocale;
    publicRef: string;
    salt: string;
    nowMs: number;
    providerId: 'semaphore' | 'globelabs';
}
export interface OutboxPayload {
    providerId: 'semaphore' | 'globelabs';
    recipientMsisdnHash: string;
    recipientMsisdn: string;
    purpose: SmsPurpose;
    predictedEncoding: 'GSM-7' | 'UCS-2';
    predictedSegmentCount: number;
    bodyPreviewHash: string;
    status: 'queued';
    idempotencyKey: string;
    retryCount: number;
    locale: SmsLocale;
    reportId: string;
    createdAt: number;
    queuedAt: number;
    schemaVersion: 2;
}
export declare function buildEnqueueSmsPayload(args: EnqueueSmsArgs): OutboxPayload;
export declare function enqueueSms(db: Firestore, tx: Transaction, args: EnqueueSmsArgs): {
    outboxId: string;
    outboxRef: FirebaseFirestore.DocumentReference;
};
export interface EnqueueBroadcastSmsArgs {
    recipientMsisdn: string;
    salt: string;
    locale: SmsLocale;
    vars: {
        municipalityName: string;
        body: string;
    };
    providerId: 'semaphore' | 'globelabs';
    massAlertRequestId: string;
    nowMs: number;
}
export declare function enqueueBroadcastSms(db: Firestore, tx: Transaction, args: EnqueueBroadcastSmsArgs): {
    outboxId: string;
};
//# sourceMappingURL=send-sms.d.ts.map