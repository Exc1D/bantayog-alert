import { initializeApp, type FirebaseApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getFunctions } from 'firebase/functions'
import { getDatabase } from 'firebase/database'
import { initializeAppCheck, ReCaptchaV3Provider, CustomProvider } from 'firebase/app-check'

const USE_EMULATOR = import.meta.env.VITE_USE_EMULATOR === 'true'
const PROJECT_ID = import.meta.env.VITE_FIREBASE_PROJECT_ID ?? 'bantayog-alert-dev'
const API_KEY = import.meta.env.VITE_FIREBASE_API_KEY ?? 'AIzaSyAK6DSYrFfqFAGelsn7ugAZP4ue1gWKudc'

let _app: FirebaseApp | undefined

export function getFirebaseApp(): FirebaseApp {
  _app ??= initializeApp({ apiKey: API_KEY, projectId: PROJECT_ID })
  return _app
}

export const app = getFirebaseApp()

const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY as string | undefined

if (RECAPTCHA_SITE_KEY) {
  initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(RECAPTCHA_SITE_KEY),
    isTokenAutoRefreshEnabled: true,
  })
} else if (USE_EMULATOR) {
  initializeAppCheck(app, {
    provider: new CustomProvider({
      getToken: () =>
        Promise.resolve({
          token: 'responder-emulator-app-check',
          expireTimeMillis: Date.now() + 60 * 60 * 1000,
        }),
    }),
    isTokenAutoRefreshEnabled: false,
  })
} else {
  console.warn(
    '[firebase] VITE_RECAPTCHA_SITE_KEY not set - App Check disabled. DO NOT USE IN PRODUCTION.',
  )
}

export const db = getFirestore(app)
export const auth = getAuth(app)
export const functions = getFunctions(app, 'asia-southeast1')
export const rtdb = getDatabase(app)

if (USE_EMULATOR) {
  const FIRESTORE_EMULATOR_PORT = import.meta.env.VITE_FIRESTORE_EMULATOR_PORT ?? '8081'
  void import('firebase/firestore')
    .then(({ connectFirestoreEmulator }) => {
      connectFirestoreEmulator(db, 'localhost', Number(FIRESTORE_EMULATOR_PORT))
    })
    .catch((err: unknown) => {
      console.error('[firebase] firestore emulator connect failed:', err)
    })
  void import('firebase/auth')
    .then(({ connectAuthEmulator }) => {
      connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true })
    })
    .catch((err: unknown) => {
      console.error('[firebase] auth emulator connect failed:', err)
    })
  void import('firebase/functions')
    .then(({ connectFunctionsEmulator }) => {
      connectFunctionsEmulator(functions, 'localhost', 5001)
    })
    .catch((err: unknown) => {
      console.error('[firebase] functions emulator connect failed:', err)
    })
  void import('firebase/database')
    .then(({ connectDatabaseEmulator }) => {
      connectDatabaseEmulator(rtdb, 'localhost', 9000)
    })
    .catch((err: unknown) => {
      console.error('[firebase] database emulator connect failed:', err)
    })
}
