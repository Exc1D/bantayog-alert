import { getAuth, onAuthStateChanged, signInAnonymously, type Auth, type User } from 'firebase/auth'
import type { FirebaseApp } from 'firebase/app'

export async function ensurePseudonymousSignIn(auth: Auth): Promise<User> {
  if (auth.currentUser) return auth.currentUser
  const credential = await signInAnonymously(auth)
  return credential.user
}

export function getFirebaseAuth(app: FirebaseApp): Auth {
  return getAuth(app)
}

export function subscribeAuth(auth: Auth, callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, callback)
}
