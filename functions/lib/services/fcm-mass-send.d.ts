import type { Firestore } from 'firebase-admin/firestore';
export interface MassSendResult {
    successCount: number;
    failureCount: number;
    batchCount: number;
}
/**
 * Send a mass FCM notification to all responders with hasFcmToken == true
 * within a given set of municipality IDs.
 *
 * Batches tokens in groups of 500 (Firebase sendEachForMulticast limit).
 * Hard cap: 10 batches = 5000 tokens maximum per call.
 */
export declare function sendMassAlertFcm(db: Firestore, opts: {
    municipalityIds: string[];
    title: string;
    body: string;
    data?: Record<string, string>;
}): Promise<MassSendResult>;
//# sourceMappingURL=fcm-mass-send.d.ts.map