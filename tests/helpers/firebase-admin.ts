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

export async function deleteAuthUsers(uids: string[]): Promise<void> {
  await Promise.all(
    uids.map(async (uid) => {
      await adminAuth.deleteUser(uid).catch(() => undefined)
    })
  )
}
