import { initializeApp } from 'firebase/app'
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore'
import { getAuth, connectAuthEmulator } from 'firebase/auth'
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions'
import { getDatabase, connectDatabaseEmulator } from 'firebase/database'
import { initializeAppCheck, ReCaptchaV3Provider, CustomProvider } from 'firebase/app-check'

const useEmulator = import.meta.env.VITE_USE_EMULATOR === 'true'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MSG_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

export const firebaseApp = initializeApp(firebaseConfig)

const recaptchaKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY

if (!useEmulator) {
  if (recaptchaKey) {
    initializeAppCheck(firebaseApp, {
      provider: new ReCaptchaV3Provider(recaptchaKey as string),
      isTokenAutoRefreshEnabled: true,
    })
  } else {
    console.warn(
      '[firebase] VITE_RECAPTCHA_SITE_KEY not set — App Check disabled. DO NOT USE IN PRODUCTION.',
    )
  }
} else if (typeof window !== 'undefined') {
  initializeAppCheck(firebaseApp, {
    provider: new CustomProvider({
      getToken: () =>
        Promise.resolve({
          token: import.meta.env.VITE_APPCHECK_DEBUG_TOKEN ?? 'admin-desktop-emulator-app-check',
          expireTimeMillis: Date.now() + 60 * 60 * 1000,
        }),
    }),
    isTokenAutoRefreshEnabled: false,
  })
}

export const db = getFirestore(firebaseApp)
export function getFirestoreInstance() {
  return db
}
// Keep eager SDK initialization explicit: tests that import this module must mock it.
export const auth = getAuth(firebaseApp)
export const functions = getFunctions(firebaseApp, 'asia-southeast1')
export const rtdb = getDatabase(firebaseApp)

if (useEmulator) {
  connectFirestoreEmulator(db, '127.0.0.1', 8081)
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  connectFunctionsEmulator(functions, '127.0.0.1', 5001)
  connectDatabaseEmulator(rtdb, '127.0.0.1', 9000)
}
