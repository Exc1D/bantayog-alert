/**
 * fcm-send.ts
 *
 * FCM send helper for sending push notifications to responder devices.
 * Uses Firebase Admin Messaging SDK with multicast send and retry.
 */
export declare const FCM_VAPID_PRIVATE_KEY: import("firebase-functions/params").SecretParam;
export interface FcmSendPayload {
    uid: string;
    title: string;
    body: string;
    data?: Record<string, string>;
    collapseKey?: string;
}
export interface FcmSendResult {
    warnings: string[];
}
/**
 * Send a push notification to all FCM tokens registered for a responder.
 *
 * - Returns `{ warnings: ['fcm_no_token'] }` if the responder has no tokens.
 * - Cleans up invalid tokens via arrayRemove after sending.
 * - Retries once on transport-level failures.
 * - Never throws; always returns a result object.
 */
export declare function sendFcmToResponder(payload: FcmSendPayload): Promise<FcmSendResult>;
//# sourceMappingURL=fcm-send.d.ts.map