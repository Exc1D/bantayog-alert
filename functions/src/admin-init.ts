import { getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'
import { getDatabase } from 'firebase-admin/database'

function getConfiguredProjectId(): string | undefined {
  if (process.env.GCLOUD_PROJECT) return process.env.GCLOUD_PROJECT
  if (process.env.GCP_PROJECT) return process.env.GCP_PROJECT
  if (!process.env.FIREBASE_CONFIG) return undefined
  try {
    const config = JSON.parse(process.env.FIREBASE_CONFIG) as { projectId?: unknown }
    return typeof config.projectId === 'string' ? config.projectId : undefined
  } catch (err) {
    console.warn('[admin-init] Ignoring malformed FIREBASE_CONFIG project id.', err)
    return undefined
  }
}

function getFallbackAppConfig() {
  const emulatorHost = process.env.FIREBASE_DATABASE_EMULATOR_HOST
  if (emulatorHost) {
    const projectId = getConfiguredProjectId()
    return { databaseURL: `http://${emulatorHost}?ns=${projectId ?? 'demo'}` }
  }
  if (process.env.VITEST) {
    console.warn('[admin-init] VITEST mode: using dummy RTDB URL. Emulator must be running.')
    return { databaseURL: 'http://127.0.0.1:9000?ns=demo' }
  }
  return undefined
}

const app = getApps()[0] ?? initializeApp(getFallbackAppConfig())

export const adminAuth = getAuth(app)
export const adminDb = getFirestore(app)
export const rtdb = getDatabase(app)
