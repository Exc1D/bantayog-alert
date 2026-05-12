import { getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'
import { getDatabase } from 'firebase-admin/database'

function getFallbackAppConfig() {
  if (process.env.VITEST) {
    console.warn('[admin-init] VITEST mode: using dummy RTDB URL. Emulator must be running.')
    return { databaseURL: 'http://localhost:9000?ns=demo' }
  }
  throw new Error('Firebase Admin not configured')
}

const app = getApps()[0] ?? initializeApp(getFallbackAppConfig())

export const adminAuth = getAuth(app)
export const adminDb = getFirestore(app)
export const rtdb = getDatabase(app)
