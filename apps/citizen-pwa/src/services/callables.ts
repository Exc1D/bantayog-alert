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
    const data = result.data as Record<string, unknown>
    if (
      typeof data.uid !== 'string' ||
      typeof data.role !== 'string' ||
      typeof data.accountStatus !== 'string'
    ) {
      throw new Error('invalid server response')
    }
    return { uid: data.uid, role: data.role, accountStatus: data.accountStatus }
  } catch (err) {
    throw new Error(
      `Citizen registration failed: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err },
    )
  }
}
