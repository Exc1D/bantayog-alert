import { initializeApp, type FirebaseApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getFunctions } from 'firebase/functions'
import { getDatabase } from 'firebase/database'

const USE_EMULATOR = import.meta.env.VITE_USE_EMULATOR === 'true'
const PROJECT_ID = import.meta.env.VITE_FIREBASE_PROJECT_ID ?? 'bantayog-alert-dev'
const API_KEY = import.meta.env.VITE_FIREBASE_API_KEY ?? 'AIzaSyAK6DSYrFfqFAGelsn7ugAZP4ue1gWKudc'

let _app: FirebaseApp | undefined

export function getFirebaseApp(): FirebaseApp {
  _app ??= initializeApp({ apiKey: API_KEY, projectId: PROJECT_ID })
  return _app
}

export const app = getFirebaseApp()
export const db = getFirestore(app)
export const auth = getAuth(app)
export const functions = getFunctions(app)
export const rtdb = getDatabase(app)

if (USE_EMULATOR) {
  const FIRESTORE_EMULATOR_PORT = import.meta.env.VITE_FIRESTORE_EMULATOR_PORT ?? '8081'
  void import('firebase/firestore').then(({ connectFirestoreEmulator }) => {
    connectFirestoreEmulator(db, 'localhost', Number(FIRESTORE_EMULATOR_PORT))
  })
  void import('firebase/auth').then(({ connectAuthEmulator }) => {
    connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true })
  })
  void import('firebase/functions').then(({ connectFunctionsEmulator }) => {
    connectFunctionsEmulator(functions, 'localhost', 5001)
  })
  void import('firebase/database').then(({ connectDatabaseEmulator }) => {
    connectDatabaseEmulator(rtdb, 'localhost', 9000)
  })
}
