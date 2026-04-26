/**
 * useRegisterFcmToken.ts
 *
 * Requests notification permission, acquires a push token, and saves it
 * to the responder's Firestore document via arrayUnion.
 */

import { useCallback } from 'react'
import { doc, setDoc, arrayUnion, serverTimestamp } from 'firebase/firestore'
import { db } from '../app/firebase'
import { acquirePushToken, type FcmTokenResult } from '../services/push-client.js'

export interface RegisterFcmTokenOptions {
  /** Firestore path to the responder document, e.g. `responders/${uid}` */
  responderDocPath: string
}

export interface UseRegisterFcmTokenReturn {
  register: () => Promise<FcmTokenResult>
}

export function useRegisterFcmToken({
  responderDocPath,
}: RegisterFcmTokenOptions): UseRegisterFcmTokenReturn {
  const register = useCallback(async (): Promise<FcmTokenResult> => {
    const result = await acquirePushToken()

    if (!result.token) {
      return result
    }

    try {
      const ref = doc(db, responderDocPath)
      await setDoc(
        ref,
        {
          fcmTokens: arrayUnion(result.token),
          fcmTokenRegisteredAt: serverTimestamp(),
          hasFcmToken: true,
        },
        { merge: true },
      )
    } catch (err: unknown) {
      return { token: null, error: err instanceof Error ? err.message : 'firestore_error' }
    }

    return result
  }, [responderDocPath])

  return { register }
}
