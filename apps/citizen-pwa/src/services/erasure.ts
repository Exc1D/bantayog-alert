import { signOut } from 'firebase/auth'
import { auth, fns, httpsCallable } from './firebase.js'

export async function requestDataErasureAndSignOut(): Promise<void> {
  await httpsCallable(fns(), 'requestDataErasure')({})
  await signOut(auth())
}
