import { httpsCallable } from 'firebase/functions'
import { fns } from './firebase.js'

export async function requestDataExport(): Promise<void> {
  const callable = httpsCallable(fns(), 'requestDataExport')
  try {
    await callable()
  } catch (err) {
    throw new Error(
      `Data export request failed: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err },
    )
  }
}

export async function registerCitizen(): Promise<{
  uid: string
  role: string
  accountStatus: string
}> {
  const callable = httpsCallable(fns(), 'registerCitizen')
  try {
    const result = await callable()
    return result.data as { uid: string; role: string; accountStatus: string }
  } catch (err) {
    throw new Error(
      `Citizen registration failed: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err },
    )
  }
}
