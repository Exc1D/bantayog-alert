import { getFunctions, httpsCallable, connectFunctionsEmulator } from 'firebase/functions'
import { getStorage, connectStorageEmulator } from 'firebase/storage'
import type { FirebaseStorage } from 'firebase/storage'
import type { Functions } from 'firebase/functions'
import type { Auth } from 'firebase/auth'
import type { Firestore } from 'firebase/firestore'
import { connectAuthEmulator } from 'firebase/auth'
import { connectFirestoreEmulator } from 'firebase/firestore'
import {
  createFirebaseWebApp,
  createAppCheck,
  ensurePseudonymousSignIn,
  getFirebaseAuth,
  getFirebaseDb,
  parseFirebaseWebEnv,
} from '@bantayog/shared-firebase'

export const FIREBASE_ENV_ERROR_MESSAGE =
  'Firebase is not configured for this environment. Set the VITE_FIREBASE_* env vars to use live data.'

let _app: ReturnType<typeof createFirebaseWebApp> | null = null
let _auth: Auth | null = null
let _db: Firestore | null = null
let _fns: Functions | null = null
let _storage: FirebaseStorage | null = null
let _firebaseEnv: ReturnType<typeof parseFirebaseWebEnv> | null | undefined = undefined
let _firebaseEnvParseError: unknown = null

function getFirebaseEnv(): ReturnType<typeof parseFirebaseWebEnv> | null {
  if (_firebaseEnv !== undefined) return _firebaseEnv
  try {
    _firebaseEnv = parseFirebaseWebEnv(import.meta.env)
    _firebaseEnvParseError = null
  } catch (err: unknown) {
    _firebaseEnv = null
    _firebaseEnvParseError = err
  }
  return _firebaseEnv
}

export function hasFirebaseConfig(): boolean {
  return getFirebaseEnv() !== null
}

function requireFirebaseEnv(): ReturnType<typeof parseFirebaseWebEnv> {
  const env = getFirebaseEnv()
  if (!env) {
    const error = new Error(FIREBASE_ENV_ERROR_MESSAGE)
    ;(error as Error & { cause?: unknown }).cause = _firebaseEnvParseError
    throw error
  }
  return env
}

export function getFirebaseApp() {
  if (_app) return _app
  const env = requireFirebaseEnv()
  _app = createFirebaseWebApp(env)
  const isEmulator = import.meta.env.VITE_USE_EMULATOR === 'true'
  createAppCheck(_app, env, isEmulator)
  return _app
}

export function auth(): Auth {
  if (_auth) return _auth
  _auth = getFirebaseAuth(getFirebaseApp())
  if (import.meta.env.VITE_USE_EMULATOR === 'true') {
    connectAuthEmulator(_auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  }
  return _auth
}

export function db(): Firestore {
  if (_db) return _db
  _db = getFirebaseDb(getFirebaseApp())
  if (import.meta.env.VITE_USE_EMULATOR === 'true') {
    connectFirestoreEmulator(_db, '127.0.0.1', 8081)
  }
  return _db
}

export function fns(): Functions {
  if (_fns) return _fns
  _fns = getFunctions(getFirebaseApp(), 'asia-southeast1')
  if (import.meta.env.VITE_USE_EMULATOR === 'true') {
    connectFunctionsEmulator(_fns, '127.0.0.1', 5001)
  }
  return _fns
}

export function storage(): FirebaseStorage {
  if (_storage) return _storage
  _storage = getStorage(getFirebaseApp())
  if (import.meta.env.VITE_USE_EMULATOR === 'true') {
    connectStorageEmulator(_storage, '127.0.0.1', 9199)
  }
  return _storage
}

export async function ensureSignedIn(): Promise<string> {
  const a = auth()
  if (a.currentUser) return a.currentUser.uid
  const cred = await ensurePseudonymousSignIn(a)
  return cred.uid
}

export { httpsCallable }
