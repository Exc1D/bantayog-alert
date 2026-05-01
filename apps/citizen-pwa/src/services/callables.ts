import { httpsCallable } from 'firebase/functions'
import { fns } from './firebase.js'

export async function requestDataExport(): Promise<void> {
  const callable = httpsCallable(fns(), 'requestDataExport')
  await callable()
}

export async function registerCitizen(): Promise<{
  uid: string
  role: string
  accountStatus: string
}> {
  const callable = httpsCallable(fns(), 'registerCitizen')
  const result = await callable()
  return result.data as { uid: string; role: string; accountStatus: string }
}
