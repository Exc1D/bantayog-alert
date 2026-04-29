import { signOut } from 'firebase/auth'
import { auth, fns, httpsCallable } from './firebase.js'

export async function requestDataErasureAndSignOut(): Promise<void> {
  try {
    await httpsCallable(fns(), 'requestDataErasure')({})
  } catch (err: unknown) {
    const code = (err as { code?: string }).code
    if (code !== 'already-exists') throw err
  }
  await signOut(auth())
}
