export interface FirebaseWebEnv {
  apiKey: string
  authDomain: string
  projectId: string
  appId: string
  messagingSenderId: string
  storageBucket: string
  databaseURL: string
  measurementId?: string
  appCheckSiteKey?: string
}

function requireEnvVar(source: Record<string, string | undefined>, key: string): string {
  const value = source[key]
  if (!value) {
    throw new Error(`Missing required Firebase env var: ${key}`)
  }
  return value
}

export function parseFirebaseWebEnv(source: Record<string, string | undefined>): FirebaseWebEnv {
  const siteKey = source.VITE_FIREBASE_APP_CHECK_SITE_KEY
  const measurementId = source.VITE_FIREBASE_MEASUREMENT_ID
  return {
    apiKey: requireEnvVar(source, 'VITE_FIREBASE_API_KEY'),
    authDomain: requireEnvVar(source, 'VITE_FIREBASE_AUTH_DOMAIN'),
    projectId: requireEnvVar(source, 'VITE_FIREBASE_PROJECT_ID'),
    appId: requireEnvVar(source, 'VITE_FIREBASE_APP_ID'),
    messagingSenderId: requireEnvVar(source, 'VITE_FIREBASE_MESSAGING_SENDER_ID'),
    storageBucket: requireEnvVar(source, 'VITE_FIREBASE_STORAGE_BUCKET'),
    databaseURL: requireEnvVar(source, 'VITE_FIREBASE_DATABASE_URL'),
    ...(measurementId ? { measurementId } : {}),
    ...(siteKey ? { appCheckSiteKey: siteKey } : {}),
  }
}
