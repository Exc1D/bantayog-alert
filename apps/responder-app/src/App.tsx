import './App.module.css'
import { useEffect } from 'react'
import { Capacitor } from '@capacitor/core'
import { AppRouter } from './routes'
import { AuthProvider, useAuth } from '@bantayog/shared-ui'
import { auth } from './app/firebase'
import { useRegisterFcmToken } from './hooks/useRegisterFcmToken'
import { subscribeForegroundPush, subscribeNotificationTap } from './services/push-client'

function FcmSetup() {
  const { user } = useAuth()
  const { register } = useRegisterFcmToken({
    responderDocPath: user ? `responders/${user.uid}` : '',
  })

  useEffect(() => {
    if (!user) return

    if (Capacitor.isNativePlatform()) {
      register().catch((err: unknown) => {
        console.warn('Native push registration failed:', err)
      })
      return
    }

    if (!('serviceWorker' in navigator)) return
    navigator.serviceWorker
      .register('/firebase-messaging-sw.js')
      .then(() => register())
      .catch((err: unknown) => {
        console.warn('SW registration failed:', err)
      })
  }, [user, register])

  return null
}

function NotificationRouter() {
  useEffect(() => {
    const unsubscribeTap = subscribeNotificationTap((dispatchId) => {
      window.location.assign(`/dispatches/${dispatchId}`)
    })

    const unsubscribeForeground = subscribeForegroundPush((payload) => {
      console.warn('Foreground push received:', payload)
    })

    return () => {
      unsubscribeTap()
      unsubscribeForeground()
    }
  }, [])

  return null
}

export default function App() {
  return (
    <AuthProvider auth={auth}>
      <FcmSetup />
      <NotificationRouter />
      <AppRouter />
    </AuthProvider>
  )
}
