import './App.module.css'
import { useEffect } from 'react'
import { Capacitor } from '@capacitor/core'
import { AppRouter } from './routes'
import { AuthProvider, useAuth } from '@bantayog/shared-ui'
import { auth } from './app/firebase'
import { useRegisterFcmToken } from './hooks/useRegisterFcmToken'
import { useOwnDispatches } from './hooks/useOwnDispatches'
import { useResponderTelemetry } from './hooks/useResponderTelemetry'
import { VersionGate } from './components/VersionGate'
import { PrivacyNoticeModal } from './components/PrivacyNoticeModal'

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

function PrivacyGate() {
  const { user } = useAuth()
  if (!user) return null
  return <PrivacyNoticeModal uid={user.uid} />
}

export default function App() {
  return (
    <VersionGate>
      <AuthProvider auth={auth}>
        <PrivacyGate />
        <FcmSetup />
        <TelemetryProvider />
        <AppRouter />
      </AuthProvider>
    </VersionGate>
  )
}
