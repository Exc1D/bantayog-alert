/**
 * fcm-send.ts
 *
 * FCM send helpers for sending push notifications to responder and citizen
 * devices. Uses Firebase Admin Messaging SDK with multicast send and retry.
 */

import { defineSecret } from 'firebase-functions/params'
import { getMessaging, type BatchResponse, type MulticastMessage } from 'firebase-admin/messaging'
import { FieldValue } from 'firebase-admin/firestore'
import { logDimension } from '@bantayog/shared-validators'
import { adminDb } from '../../admin-init.js'

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
  let tokens: string[] | undefined
  try {
    const responderSnap = await adminDb.collection('responders').doc(uid).get()
    if (!responderSnap.exists) {
      return { warnings: ['fcm_no_token'] }
    }
    tokens = responderSnap.data()?.fcmTokens as string[] | undefined
  } catch (err: unknown) {
    console.error('FCM responder token lookup failed:', err)
    return { warnings: ['fcm_network_error'] }
  }
  if (!tokens || tokens.length === 0) {
    return { warnings: ['fcm_no_token'] }
  }

  // Step 2: Send with one retry on transport failure.
  let result: BatchResponse
  try {
    const messaging = getMessaging()
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    const msg: MulticastMessage = {
      tokens,
      notification: { title, body },
    }
    if (data) msg.data = data
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    result = await messaging.sendEachForMulticast(msg)
  } catch {
    // Retry once on transport failure.
    try {
      const messaging = getMessaging()
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      const msg: MulticastMessage = {
        tokens,
        notification: { title, body },
      }
      if (data) msg.data = data
      // eslint-disable-next-line @typescript-eslint/no-deprecated
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

export interface FcmCitizenSendPayload {
  reportId: string
  title: string
  body: string
  data?: Record<string, string>
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
export async function sendFcmToCitizen(payload: FcmCitizenSendPayload): Promise<FcmSendResult> {
  const { reportId, title, body, data } = payload
  const warnings: string[] = []

  let reporterUid: string | undefined
  try {
    const privateSnap = await adminDb.collection('report_private').doc(reportId).get()
    reporterUid = privateSnap.exists ? privateSnap.data()?.reporterUid : undefined
  } catch (err: unknown) {
    console.error('FCM citizen reporterUid lookup failed:', err)
    return { warnings: ['fcm_network_error'] }
  }
  if (typeof reporterUid !== 'string' || reporterUid.length === 0) {
    return { warnings: ['fcm_no_token'] }
  }

  let token: string | undefined
  const userRef = adminDb.collection('users').doc(reporterUid)
  try {
    const userSnap = await userRef.get()
    token = userSnap.exists ? userSnap.data()?.fcmToken : undefined
  } catch (err: unknown) {
    console.error('FCM citizen token lookup failed:', err)
    return { warnings: ['fcm_network_error'] }
  }
  if (typeof token !== 'string' || token.length === 0) {
    return { warnings: ['fcm_no_token'] }
  }

  // eslint-disable-next-line @typescript-eslint/no-deprecated
  const msg: MulticastMessage = {
    tokens: [token],
    notification: { title, body },
  }
  if (data) msg.data = data

  let result: BatchResponse
  try {
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    result = await getMessaging().sendEachForMulticast(msg)
  } catch {
    try {
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      result = await getMessaging().sendEachForMulticast(msg)
    } catch (err: unknown) {
      console.error('FCM citizen send failed after retry:', err)
      return { warnings: ['fcm_network_error'] }
    }
  }

  const response = result.responses[0]
  if (response && !response.success) {
    const code = response.error?.code
    if (
      code === 'messaging/invalid-registration-token' ||
      code === 'messaging/registration-token-not-registered'
    ) {
      try {
        // Mirror the client convention (useFcmToken clears with null).
        await userRef.update({ fcmToken: null })
      } catch (err) {
        log({
          severity: 'WARNING',
          code: 'fcm.citizen_cleanup.failed',
          message: err instanceof Error ? err.message : 'Citizen FCM token cleanup failed',
        })
      }
      warnings.push('fcm_one_token_invalid')
    } else {
      // Any other per-message failure (e.g. server unavailable) is a warning.
      warnings.push('fcm_send_failed')
    }
  }

  return { warnings }
}
