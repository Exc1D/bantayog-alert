import { useState, useCallback } from 'react'
import { getMessaging, getToken, onMessage } from 'firebase/messaging'
import { auth, hasFirebaseConfig } from '../services/firebase.js'

interface FcmState {
  permission: NotificationPermission
  token: string | null
  enabled: boolean
}

export function useFcmToken() {
  const [state, setState] = useState<FcmState>({
    permission: 'default',
    token: null,
    enabled: false,
  })

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
      const { getFunctions, httpsCallable } = await import('firebase/functions')
      const functions = getFunctions()
      const subscribeToAlerts = httpsCallable(functions, 'subscribeToAlerts')
      await subscribeToAlerts({ token })

      // Listen for incoming messages
      onMessage(messaging, (payload) => {
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
    setState((prev) => ({ ...prev, enabled: false, token: null }))

    // Clear token from user document
    const user = auth().currentUser
    if (user && !user.isAnonymous && state.token) {
      try {
        const { updateDoc, doc, getDoc } = await import('firebase/firestore')
        const { db } = await import('../services/firebase.js')
        const userRef = doc(db(), 'users', user.uid)
        const snap = await getDoc(userRef)

        if (snap.exists()) {
          await updateDoc(userRef, { fcmToken: null })
        }
      } catch (error) {
        console.error('Failed to clear FCM token:', error)
      }
    }
  }, [state.token])

  return {
    ...state,
    requestPermission,
    disable,
  }
}
