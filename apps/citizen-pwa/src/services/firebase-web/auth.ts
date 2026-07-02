import {
  browserLocalPersistence,
  getAuth,
  setPersistence,
  signInAnonymously,
  type Auth,
  type User,
} from 'firebase/auth'
import type { FirebaseApp } from 'firebase/app'

export async function ensurePseudonymousSignIn(auth: Auth): Promise<User> {
  if (auth.currentUser) return auth.currentUser
  // Keep one pseudonymous account per browser profile when storage is available.
  await setPersistence(auth, browserLocalPersistence).catch(() => undefined)
  const credential = await signInAnonymously(auth)
  return credential.user
}

export function getFirebaseAuth(app: FirebaseApp): Auth {
  return getAuth(app)
}
