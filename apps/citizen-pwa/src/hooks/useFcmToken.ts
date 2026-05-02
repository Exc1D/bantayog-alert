import { useState, useCallback, useEffect, useRef } from 'react'
import { getMessaging, getToken, onMessage, deleteToken } from 'firebase/messaging'
import { auth, hasFirebaseConfig, fns, httpsCallable } from '../services/firebase.js'
import { getAlertSoundsEnabled } from '../lib/userSettings.js'

function playAlertSound(): void {
  if (!getAlertSoundsEnabled()) return
  try {
    const audio = new Audio('/notification.wav')
    audio.volume = 0.6
    void audio.play().catch(() => {
      // Autoplay may be blocked without user gesture; silently no-op
    })
  } catch {
    // Audio constructor not available
  }
}

interface FcmState {
  permission: NotificationPermission
  token: string | null
  enabled: boolean
}

export function useFcmToken() {
  const [state, setState] = useState<FcmState>(() => {
    if (!('Notification' in window)) {
      return { permission: 'denied', token: null, enabled: false }
    }
    return { permission: Notification.permission, token: null, enabled: false }
  })
  const fcmUnsubscribeRef = useRef<(() => void) | null>(null)

  // Rehydrate token on mount
  useEffect(() => {
    if (!('Notification' in window) || Notification.permission !== 'granted') {
      return
    }

    const messaging = getMessaging()
    getToken(messaging, {
      vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
    })
      .then((token) => {
        setState({ permission: 'granted', token: token || null, enabled: Boolean(token) })
      })
      .catch((error: unknown) => {
        console.error('Failed to rehydrate FCM token:', error)
        // Clear token on rehydration failure to avoid stale state
        setState((prev) => ({ ...prev, token: null, enabled: false }))
      })
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (fcmUnsubscribeRef.current) {
        fcmUnsubscribeRef.current()
        fcmUnsubscribeRef.current = null
      }
    }
  }, [])

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!('Notification' in window)) {
      console.warn('Notifications not supported')
      setState((prev) => ({ ...prev, permission: 'denied' }))
      return false
    }

    if (!hasFirebaseConfig()) {
      console.warn('Firebase not configured')
      return false
    }

    let issuedToken = false
    let issuedTokenValue: string | null = null
    try {
      const permission = await Notification.requestPermission()
      setState((prev) => ({ ...prev, permission }))

      if (permission !== 'granted') {
        return false
      }

      const messaging = getMessaging()
      const token = await getToken(messaging, {
        vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
      })

      if (!token) {
        console.error('Failed to get FCM token')
        return false
      }

      issuedToken = true
      issuedTokenValue = token
      setState((prev) => ({ ...prev, token, enabled: true }))

      // Save token to user document in Firestore — single merge write avoids
      // the read-then-write race and removes the silent "doc missing" branch.
      const user = auth().currentUser
      if (user && !user.isAnonymous) {
        const { setDoc, doc } = await import('firebase/firestore')
        const { db } = await import('../services/firebase.js')
        await setDoc(
          doc(db(), 'users', user.uid),
          { fcmToken: token, fcmTokenUpdatedAt: Date.now() },
          { merge: true },
        )
      }

      // Subscribe to alerts topic
      const subscribeToAlerts = httpsCallable(fns(), 'subscribeToAlerts')
      await subscribeToAlerts({ token })

      // Unsubscribe from previous listener before creating new one
      if (fcmUnsubscribeRef.current) {
        fcmUnsubscribeRef.current()
        fcmUnsubscribeRef.current = null
      }

      // Listen for incoming messages
      fcmUnsubscribeRef.current = onMessage(messaging, (payload) => {
        // eslint-disable-next-line no-console
        console.log('Received FCM message:', payload)
        playAlertSound()
      })

      return true
    } catch (error) {
      console.error('FCM setup error:', error)
      if (issuedToken) {
        try {
          const messaging = getMessaging()
          await deleteToken(messaging)
        } catch (rollbackError) {
          console.error('Failed to roll back FCM token:', rollbackError)
        }
        // Best-effort topic + Firestore cleanup so we don't leak a half-subscribed
        // token when registration fails partway through.
        if (issuedTokenValue) {
          try {
            const unsubscribeFromAlerts = httpsCallable(fns(), 'unsubscribeFromAlerts')
            await unsubscribeFromAlerts({ token: issuedTokenValue })
          } catch (unsubErr) {
            console.error('Failed to unsubscribe from topic during rollback:', unsubErr)
          }
        }
        try {
          const user = auth().currentUser
          if (user && !user.isAnonymous) {
            const { setDoc, doc } = await import('firebase/firestore')
            const { db } = await import('../services/firebase.js')
            await setDoc(
              doc(db(), 'users', user.uid),
              { fcmToken: null, fcmTokenUpdatedAt: null },
              { merge: true },
            )
          }
        } catch (firestoreErr) {
          console.error('Failed to clear Firestore fcmToken during rollback:', firestoreErr)
        }
      }
      // Cleanup the foreground message listener if it was attached before failure.
      if (fcmUnsubscribeRef.current) {
        fcmUnsubscribeRef.current()
        fcmUnsubscribeRef.current = null
      }
      setState((prev) => ({ ...prev, enabled: false, token: null }))
      return false
    }
  }, [])

  const disable = useCallback(async () => {
    const tokenToRevoke = state.token
    if (!tokenToRevoke) {
      setState((prev) => ({ ...prev, enabled: false, token: null }))
      return
    }

    try {
      // Revoke the browser FCM token
      const messaging = getMessaging()
      await deleteToken(messaging)

      // Unsubscribe from foreground message listener and update state immediately
      if (fcmUnsubscribeRef.current) {
        fcmUnsubscribeRef.current()
        fcmUnsubscribeRef.current = null
      }
      setState((prev) => ({ ...prev, enabled: false, token: null }))

      // Call backend to remove topic subscription
      const unsubscribeFromAlerts = httpsCallable(fns(), 'unsubscribeFromAlerts')
      await unsubscribeFromAlerts({ token: tokenToRevoke })

      // Clear token from user document via merge — single write, no probe.
      const user = auth().currentUser
      if (user && !user.isAnonymous) {
        try {
          const { setDoc, doc } = await import('firebase/firestore')
          const { db } = await import('../services/firebase.js')
          await setDoc(
            doc(db(), 'users', user.uid),
            { fcmToken: null, fcmTokenUpdatedAt: null },
            { merge: true },
          )
        } catch (error) {
          console.error('Failed to clear FCM token from Firestore:', error)
        }
      }
    } catch (error) {
      console.error('Failed to revoke FCM token or unsubscribe:', error)
      // Keep state as-is so UI reflects the actual subscription status
    }
  }, [state.token])

  return {
    ...state,
    requestPermission,
    disable,
  }
}
