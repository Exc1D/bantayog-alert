import type { UserRole } from '@bantayog/shared-types'

export interface FirebaseWebEnv {
  apiKey: string
  authDomain: string
  projectId: string
  appId: string
  messagingSenderId: string
  storageBucket: string
  databaseURL: string
  appCheckSiteKey: string
}

function requireEnvVar(source: Record<string, string | undefined>, key: string): string {
  const value = source[key]
  if (!value) {
    throw new Error(`Missing required Firebase env var: ${key}`)
  }
  return value
}

export function parseFirebaseWebEnv(source: Record<string, string | undefined>): FirebaseWebEnv {
  return {
    apiKey: requireEnvVar(source, 'VITE_FIREBASE_API_KEY'),
    authDomain: requireEnvVar(source, 'VITE_FIREBASE_AUTH_DOMAIN'),
    projectId: requireEnvVar(source, 'VITE_FIREBASE_PROJECT_ID'),
    appId: requireEnvVar(source, 'VITE_FIREBASE_APP_ID'),
    messagingSenderId: requireEnvVar(source, 'VITE_FIREBASE_MESSAGING_SENDER_ID'),
    storageBucket: requireEnvVar(source, 'VITE_FIREBASE_STORAGE_BUCKET'),
    databaseURL: requireEnvVar(source, 'VITE_FIREBASE_DATABASE_URL'),
    appCheckSiteKey: requireEnvVar(source, 'VITE_FIREBASE_APP_CHECK_SITE_KEY'),
  }
}

export function getSessionTimeoutMs(role: UserRole): number | null {
  if (role === 'provincial_superadmin') return 4 * 60 * 60 * 1000
  if (role === 'municipal_admin' || role === 'agency_admin') return 8 * 60 * 60 * 1000
  if (role === 'responder') return 12 * 60 * 60 * 1000
  return null
}
