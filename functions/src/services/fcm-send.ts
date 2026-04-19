/**
 * fcm-send.ts
 *
 * FCM send helper for sending push notifications to responder devices.
 * Uses Firebase Admin Messaging SDK with multicast send and retry.
 */

import { defineSecret } from 'firebase-functions/params'
import { getMessaging, type BatchResponse } from 'firebase-admin/messaging'
import { FieldValue } from 'firebase-admin/firestore'
import { adminDb } from '../admin-init.js'

export const FCM_VAPID_PRIVATE_KEY = defineSecret('FCM_VAPID_PRIVATE_KEY')

export interface FcmSendPayload {
  uid: string
  title: string
  body: string
  data?: Record<string, string>
  collapseKey?: string
}

export interface FcmSendResult {
  warnings: string[]
}

/**
 * Send a push notification to all FCM tokens registered for a responder.
 *
 * - Returns `{ warnings: ['fcm_no_token'] }` if the responder has no tokens.
 * - Cleans up invalid tokens via arrayRemove after sending.
 * - Retries once on transport-level failures.
 * - Never throws; always returns a result object.
 */
export async function sendFcmToResponder(payload: FcmSendPayload): Promise<FcmSendResult> {
  const { uid, title, body, data } = payload
  const warnings: string[] = []

  // Step 1: Read the responder's FCM tokens.
  const responderSnap = await adminDb.collection('responders').doc(uid).get()
  if (!responderSnap.exists) {
    return { warnings: ['fcm_no_token'] }
  }
  const tokens = responderSnap.data()?.fcmTokens as string[] | undefined
  if (!tokens || tokens.length === 0) {
    return { warnings: ['fcm_no_token'] }
  }

  // Step 2: Send with one retry on transport failure.
  let result: BatchResponse | null = null
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const messaging = getMessaging()
      const msg: Parameters<typeof messaging.sendEachForMulticast>[0] = {
        tokens,
        notification: { title, body },
      }
      if (data) msg.data = data
      result = await messaging.sendEachForMulticast(msg)
      break // success — exit retry loop
    } catch {
      const isLastAttempt = attempt === 1
      if (isLastAttempt) {
        warnings.push('fcm_network_error')
        return { warnings }
      }
      // else retry
    }
  }

  if (!result) {
    warnings.push('fcm_network_error')
    return { warnings }
  }

  // Step 3: Collect invalid tokens for cleanup.
  const invalidTokens: string[] = []
  result.responses.forEach((resp, i) => {
    if (!resp.success) {
      const code = resp.error?.code
      if (
        code === 'messaging/invalid-registration-token' ||
        code === 'messaging/registration-token-not-registered'
      ) {
        invalidTokens.push(tokens[i])
      }
    }
  })

  // Step 4: Remove invalid tokens from the responder's document.
  if (invalidTokens.length > 0) {
    await adminDb
      .collection('responders')
      .doc(uid)
      .update({
        fcmTokens: FieldValue.arrayRemove(...invalidTokens),
      })
    warnings.push('fcm_one_token_invalid')
  }

  return { warnings }
}
