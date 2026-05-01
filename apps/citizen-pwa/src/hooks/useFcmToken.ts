import { useState, useCallback, useEffect, useRef } from 'react'
import { getMessaging, getToken, onMessage, deleteToken } from 'firebase/messaging'
import { auth, hasFirebaseConfig, fns, httpsCallable } from '../services/firebase.js'

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
    if (
      !('Notification' in window) ||
      Notification.permission !== 'granted' ||
      !hasFirebaseConfig()
    ) {
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

      setState((prev) => ({ ...prev, token, enabled: true }))

      // Save token to user document in Firestore
      const user = auth().currentUser
      if (user && !user.isAnonymous) {
        const { updateDoc, doc, getDoc } = await import('firebase/firestore')
        const { db } = await import('../services/firebase.js')
        const userRef = doc(db(), 'users', user.uid)

        // Check if user doc exists
        const snap = await getDoc(userRef)
        if (snap.exists()) {
          await updateDoc(userRef, { fcmToken: token, fcmTokenUpdatedAt: Date.now() })
        }
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
        // Could trigger toast, sound, etc. here
      })

      return true
    } catch (error) {
      console.error('FCM setup error:', error)
      setState((prev) => ({ ...prev, enabled: false }))
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

      // Call backend to remove topic subscription
      const unsubscribeFromAlerts = httpsCallable(fns(), 'unsubscribeFromAlerts')
      await unsubscribeFromAlerts({ token: tokenToRevoke })

      // Unsubscribe from foreground message listener
      if (fcmUnsubscribeRef.current) {
        fcmUnsubscribeRef.current()
        fcmUnsubscribeRef.current = null
      }

      // Clear state only after successful revoke
      setState((prev) => ({ ...prev, enabled: false, token: null }))

      // Clear token from user document
      const user = auth().currentUser
      if (user && !user.isAnonymous) {
        try {
          const { updateDoc, doc, getDoc } = await import('firebase/firestore')
          const { db } = await import('../services/firebase.js')
          const userRef = doc(db(), 'users', user.uid)
          const snap = await getDoc(userRef)

          if (snap.exists()) {
            await updateDoc(userRef, { fcmToken: null })
          }
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
