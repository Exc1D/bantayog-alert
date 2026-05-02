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

export function FcmSetup() {
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
      .then((registration) => {
        const config = {
          apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
          authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
          projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
          storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
          messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
          appId: import.meta.env.VITE_FIREBASE_APP_ID,
        }

        const requiredFields = [
          'apiKey',
          'authDomain',
          'projectId',
          'storageBucket',
          'messagingSenderId',
          'appId',
        ] as const
        for (const field of requiredFields) {
          if (!config[field]) {
            console.warn(`[FcmSetup] Missing Firebase config field: ${field}`)
            return
          }
        }

        let configSentPromise: Promise<void>

        if (registration.active) {
          registration.active.postMessage({
            type: 'FIREBASE_CONFIG',
            config,
          })
          configSentPromise = Promise.resolve()
        } else if (registration.installing) {
          const installingWorker = registration.installing
          configSentPromise = new Promise<void>((resolve) => {
            installingWorker.addEventListener('statechange', (event) => {
              const worker = event.target as ServiceWorker
              if (worker.state === 'activated') {
                worker.postMessage({ type: 'FIREBASE_CONFIG', config })
                resolve()
              }
            })
          })
        } else if (registration.waiting) {
          const waitingWorker = registration.waiting
          configSentPromise = new Promise<void>((resolve) => {
            waitingWorker.addEventListener('statechange', (event) => {
              const worker = event.target as ServiceWorker
              if (worker.state === 'activated') {
                worker.postMessage({ type: 'FIREBASE_CONFIG', config })
                resolve()
              }
            })
          })
        } else {
          configSentPromise = new Promise<void>((resolve) => {
            registration.addEventListener('updatefound', () => {
              const newWorker = registration.installing
              newWorker?.addEventListener('statechange', (event) => {
                const worker = event.target as ServiceWorker
                if (worker.state === 'activated') {
                  worker.postMessage({ type: 'FIREBASE_CONFIG', config })
                  resolve()
                }
              })
            })
          })
        }

        return configSentPromise.then(() => register())
      })
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
