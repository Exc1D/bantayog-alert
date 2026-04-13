import { getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

const adminApp =
  getApps()[0] ??
  initializeApp({
    projectId: process.env.GCLOUD_PROJECT ?? 'bantayog-alert',
  })

export const adminAuth = getAuth(adminApp)
export const adminDb = getFirestore(adminApp)

// IMPORTANT: Connect to Auth emulator BEFORE any auth operations
// The client SDK uses connectAuthEmulator() but Admin SDK uses useEmulator()
const authEmulatorHost = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? 'http://127.0.0.1:9099'
adminAuth.useEmulator(authEmulatorHost)

// Also connect Firestore to emulator (matches client SDK's connectFirestoreEmulator)
adminDb.useEmulator('127.0.0.1', 8080)

export async function deleteAuthUsers(uids: string[]): Promise<void> {
  await Promise.all(
    uids.map(async (uid) => {
      await adminAuth.deleteUser(uid).catch((error) => {
        console.debug(`[firebase-admin] Failed to delete auth user ${uid}:`, error)
        return undefined
      })
    })
  )
}
