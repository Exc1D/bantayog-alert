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
  } catch {
    // Malformed FIREBASE_CONFIG — fall through to undefined
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

// Fail fast if project ID is missing or mismatched in production.
// Skipped in emulator, vitest, and test environments to allow ADC fallback.
const projectId = getConfiguredProjectId()
if (
  process.env.FUNCTIONS_EMULATOR !== 'true' &&
  !process.env.VITEST &&
  process.env.NODE_ENV !== 'test' &&
  !projectId
) {
  throw new Error(
    '[admin-init] CRITICAL: GCLOUD_PROJECT is not set and FIREBASE_CONFIG has no projectId. ' +
      'Refusing to initialize — this could connect to the wrong project.',
  )
}

export const adminAuth = getAuth(app)
export const adminDb = getFirestore(app)
export const rtdb = getDatabase(app)
