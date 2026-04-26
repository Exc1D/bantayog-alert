import './App.module.css'
import { useEffect } from 'react'
import { Capacitor } from '@capacitor/core'
import { AppRouter } from './routes'
import { AuthProvider, useAuth } from '@bantayog/shared-ui'
import { auth } from './app/firebase'
import { useRegisterFcmToken } from './hooks/useRegisterFcmToken'
import { useOwnDispatches } from './hooks/useOwnDispatches'
import { useResponderTelemetry } from './hooks/useResponderTelemetry'

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

function TelemetryProvider() {
  const { user } = useAuth()
  const { groups } = useOwnDispatches(user?.uid)
  const firstActive = groups.active[0]

  useResponderTelemetry(user?.uid, firstActive?.dispatchId, firstActive?.status)

  return null
}

export default function App() {
  return (
    <AuthProvider auth={auth}>
      <FcmSetup />
      <TelemetryProvider />
      <AppRouter />
    </AuthProvider>
  )
}
