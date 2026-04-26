/**
 * fcm-send.ts
 *
 * FCM send helper for sending push notifications to responder devices.
 * Uses Firebase Admin Messaging SDK with multicast send and retry.
 */

import { defineSecret } from 'firebase-functions/params'
import { getMessaging, type BatchResponse } from 'firebase-admin/messaging'
import { FieldValue } from 'firebase-admin/firestore'
import { logDimension } from '@bantayog/shared-validators'
import { adminDb } from '../admin-init.js'

const log = logDimension('fcmSend')

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
  let result: BatchResponse
  try {
    const messaging = getMessaging()
    const msg: Parameters<typeof messaging.sendEachForMulticast>[0] = {
      tokens,
      notification: { title, body },
    }
    if (data) msg.data = data
    result = await messaging.sendEachForMulticast(msg)
  } catch {
    // Retry once on transport failure.
    try {
      const messaging = getMessaging()
      const msg: Parameters<typeof messaging.sendEachForMulticast>[0] = {
        tokens,
        notification: { title, body },
      }
      if (data) msg.data = data
      result = await messaging.sendEachForMulticast(msg)
    } catch (err: unknown) {
      // Log full error server-side for debugging; keep warnings as stable codes
      console.error('FCM send failed after retry:', err)
      warnings.push('fcm_network_error')
      return { warnings }
    }
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
        const token = tokens[i]
        if (token) invalidTokens.push(token)
      }
    }
  })

  // Step 4: Remove invalid tokens from the responder's document.
  if (invalidTokens.length > 0) {
    const ref = adminDb.collection('responders').doc(uid)
    try {
      await adminDb.runTransaction(async (tx) => {
        const snap = await tx.get(ref)
        if (!snap.exists) return
        const rawData = snap.data()
        const rawTokens: unknown[] = Array.isArray(rawData?.fcmTokens) ? rawData.fcmTokens : []
        const currentTokens = rawTokens.filter((t): t is string => typeof t === 'string')
        const invalidSet = new Set(invalidTokens)
        const remainingTokens = currentTokens.filter((t) => !invalidSet.has(t))
        if (
          remainingTokens.length < currentTokens.length ||
          rawTokens.length !== currentTokens.length
        ) {
          const tokensToRemove = invalidTokens.filter((t) => typeof t === 'string')
          tx.update(ref, {
            fcmTokens: FieldValue.arrayRemove(...tokensToRemove),
            hasFcmToken: remainingTokens.length > 0,
          })
        }
      })
    } catch (err) {
      log({
        severity: 'WARNING',
        code: 'fcm.cleanup.failed',
        message: err instanceof Error ? err.message : 'FCM token cleanup failed',
      })
    }
    warnings.push('fcm_one_token_invalid')
  }

  return { warnings }
}
