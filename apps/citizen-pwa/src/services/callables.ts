import { httpsCallable } from 'firebase/functions'
import { fns } from './firebase.js'

export async function requestDataExport(): Promise<void> {
  const callable = httpsCallable(fns(), 'requestDataExport')
  await callable()
}
