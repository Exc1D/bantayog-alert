import { useEffect, useState, useRef } from 'react'
import {
  createAppCheck,
  createFirebaseWebApp,
  ensurePseudonymousSignIn,
  getFirebaseAuth,
  getFirebaseDb,
  parseFirebaseWebEnv,
  subscribeAlerts,
  subscribeMinAppVersion,
} from '@bantayog/shared-firebase'
import type { AlertDoc, MinAppVersionDoc } from '@bantayog/shared-types'

interface ShellState {
  status: 'booting' | 'ready' | 'error'
  authState: 'signed-out' | 'signed-in'
  appCheckState: 'pending' | 'active' | 'failed'
  user: { uid: string } | null
  minAppVersion: MinAppVersionDoc | null
  alerts: AlertDoc[]
  error: string | null
}

const initialState: ShellState = {
  status: 'booting',
  authState: 'signed-out',
  appCheckState: 'pending',
  user: null,
  minAppVersion: null,
  alerts: [],
  error: null,
}

export function useCitizenShell(): ShellState {
  const [state, setState] = useState<ShellState>(initialState)

  // Guard against state updates on unmounted component
  const unmountedRef = useRef(false)

  // Cleanup ref holds unsubscribe functions; initialized as no-ops in case
  // unmount happens before subscriptions are established (Firestore onSnapshot
  // returns unsubscribe only after subscription is created)
  const cleanupRef = useRef<{ stopAlerts: () => void; stopVersion: () => void }>({
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    stopAlerts: () => {},
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    stopVersion: () => {},
  })

  useEffect(() => {
    unmountedRef.current = false

    let env
    let app
    let db
    let auth

    try {
      env = parseFirebaseWebEnv(import.meta.env)
      app = createFirebaseWebApp(env)
      db = getFirebaseDb(app)
      auth = getFirebaseAuth(app)
    } catch (error) {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (!unmountedRef.current) {
        setState({
          ...initialState,
          status: 'error',
          appCheckState: 'failed',
          error: error instanceof Error ? error.message : 'Firebase initialization failed',
        })
      }
      return
    }

    // Capture refs in local variables to avoid exhaustive-deps warning in cleanup
    const unmounted = unmountedRef
    const cleanup = cleanupRef

    try {
      createAppCheck(app, env)
      if (!unmounted.current) {
        setState((current) => ({ ...current, appCheckState: 'active' }))
      }
    } catch (error) {
      if (!unmounted.current) {
        setState((current) => ({
          ...current,
          appCheckState: 'failed',
          error: error instanceof Error ? error.message : 'App Check initialization failed',
        }))
      }
    }

    void ensurePseudonymousSignIn(auth)
      .then((user) => {
        cleanup.current.stopVersion = subscribeMinAppVersion(db, (minAppVersion) => {
          if (!unmounted.current) {
            setState((current) => ({
              ...current,
              status: 'ready',
              authState: 'signed-in',
              user: { uid: user.uid },
              minAppVersion,
            }))
          }
        })

        cleanup.current.stopAlerts = subscribeAlerts(db, (alerts) => {
          if (!unmounted.current) {
            setState((current) => ({
              ...current,
              status: 'ready',
              authState: 'signed-in',
              user: { uid: user.uid },
              alerts,
            }))
          }
        })
      })
      .catch((error: unknown) => {
        if (!unmounted.current) {
          setState({
            ...initialState,
            status: 'error',
            appCheckState: 'failed',
            error: error instanceof Error ? error.message : 'Pseudonymous sign-in failed',
          })
        }
      })

    return () => {
      unmounted.current = true
      cleanup.current.stopAlerts()
      cleanup.current.stopVersion()
    }
  }, [])

  return state
}
