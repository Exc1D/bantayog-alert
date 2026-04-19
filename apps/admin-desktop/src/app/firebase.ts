import { initializeApp } from 'firebase/app'
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore'
import { getAuth, connectAuthEmulator } from 'firebase/auth'
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions'
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check'

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access -- Firebase App Check debug token is a browser global
  ;(self as any).FIREBASE_APPCHECK_DEBUG_TOKEN = import.meta.env.VITE_APPCHECK_DEBUG_TOKEN ?? true
}

export const db = getFirestore(firebaseApp)
export const auth = getAuth(firebaseApp)
export const functions = getFunctions(firebaseApp, 'asia-southeast1')

if (useEmulator) {
  connectFirestoreEmulator(db, 'localhost', 8080)
  connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true })
  connectFunctionsEmulator(functions, 'localhost', 5001)
}
