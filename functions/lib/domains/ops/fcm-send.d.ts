/**
 * fcm-send.ts
 *
 * FCM send helpers for sending push notifications to responder and citizen
 * devices. Uses Firebase Admin Messaging SDK with multicast send and retry.
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
export interface FcmCitizenSendPayload {
    reportId: string;
    title: string;
    body: string;
    data?: Record<string, string>;
}
/**
 * Send a push notification to the citizen who reported `reportId`.
 *
 * Resolves the target via `report_private/{reportId}.reporterUid` →
 * `users/{uid}.fcmToken` (single token — only registered citizens persist
 * one; anonymous reporters yield `fcm_no_token` by design, see agent-task
 * 3A-06).
 *
 * - Retries once on transport-level failures (`fcm_network_error`).
 * - Clears an invalid stored token best-effort (`fcm_one_token_invalid`).
 * - Never throws; a push failure must never fail the calling command.
 */
export declare function sendFcmToCitizen(payload: FcmCitizenSendPayload): Promise<FcmSendResult>;
//# sourceMappingURL=fcm-send.d.ts.map