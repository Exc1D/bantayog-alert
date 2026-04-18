import { getFunctions, httpsCallable } from 'firebase/functions'
import { getStorage } from 'firebase/storage'
import type { FirebaseStorage } from 'firebase/storage'
import type { Functions } from 'firebase/functions'
import type { Auth } from 'firebase/auth'
import type { Firestore } from 'firebase/firestore'
import {
  createFirebaseWebApp,
  createAppCheck,
  ensurePseudonymousSignIn,
  getFirebaseAuth,
  getFirebaseDb,
  parseFirebaseWebEnv,
} from '@bantayog/shared-firebase'

let _app: ReturnType<typeof createFirebaseWebApp> | null = null
let _auth: Auth | null = null
let _db: Firestore | null = null
let _fns: Functions | null = null
let _storage: FirebaseStorage | null = null

export function getFirebaseApp() {
  if (_app) return _app
  const env = parseFirebaseWebEnv(import.meta.env)
  _app = createFirebaseWebApp(env)
  createAppCheck(_app, env)
  return _app
}

export function auth(): Auth {
  if (_auth) return _auth
  _auth = getFirebaseAuth(getFirebaseApp())
  return _auth
}

export function db(): Firestore {
  if (_db) return _db
  _db = getFirebaseDb(getFirebaseApp())
  return _db
}

export function fns(): Functions {
  if (_fns) return _fns
  _fns = getFunctions(getFirebaseApp(), 'asia-southeast1')
  return _fns
}

export function storage(): FirebaseStorage {
  if (_storage) return _storage
  _storage = getStorage(getFirebaseApp())
  return _storage
}

export async function ensureSignedIn(): Promise<string> {
  const a = auth()
  if (a.currentUser) return a.currentUser.uid
  const cred = await ensurePseudonymousSignIn(a)
  return cred.uid
}

export { httpsCallable }
