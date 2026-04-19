/**
 * useRegisterFcmToken.ts
 *
 * Requests notification permission, acquires an FCM token, and saves it
 * to the responder's Firestore document via arrayUnion.
 */

import { useCallback, useRef } from 'react'
import { doc, updateDoc, arrayUnion, serverTimestamp } from 'firebase/firestore'
import { db } from '../app/firebase'
import { acquireFcmToken, type FcmTokenResult } from '../services/fcm-client.js'

export interface RegisterFcmTokenOptions {
  /** Firestore path to the responder document, e.g. `responders/${uid}` */
  responderDocPath: string
}

export interface UseRegisterFcmTokenReturn {
  register: () => Promise<FcmTokenResult>
  registered: boolean
}

export function useRegisterFcmToken({
  responderDocPath,
}: RegisterFcmTokenOptions): UseRegisterFcmTokenReturn {
  const registeredRef = useRef(false)

  const register = useCallback(async (): Promise<FcmTokenResult> => {
    // Guard against browsers without service worker support.
    const swContainer = Object.hasOwn(navigator, 'serviceWorker') ? navigator.serviceWorker : null
    if (!swContainer) {
      return { token: null, error: 'service_worker_unavailable' }
    }

    const sw = await swContainer.ready
    const result = await acquireFcmToken(sw)

    if (!result.token) {
      return result
    }

    try {
      const ref = doc(db, responderDocPath)
      await updateDoc(ref, {
        fcmTokens: arrayUnion(result.token),
        fcmTokenRegisteredAt: serverTimestamp(),
      })
      registeredRef.current = true
    } catch (err) {
      return { token: null, error: err instanceof Error ? err.message : 'firestore_error' }
    }

    return result
  }, [responderDocPath])

  return { register, registered: registeredRef.current }
}
