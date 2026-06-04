import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app'
import {
  initializeAppCheck,
  ReCaptchaV3Provider,
  CustomProvider,
  type AppCheck,
} from 'firebase/app-check'
import type { FirebaseWebEnv } from './env.js'

export function createFirebaseWebApp(env: FirebaseWebEnv): FirebaseApp {
  if (getApps().length > 0) {
    return getApp()
  }

  return initializeApp({
    apiKey: env.apiKey,
    authDomain: env.authDomain,
    projectId: env.projectId,
    appId: env.appId,
    messagingSenderId: env.messagingSenderId,
    storageBucket: env.storageBucket,
    databaseURL: env.databaseURL,
  })
}

export function createAppCheck(
  app: FirebaseApp,
  env: FirebaseWebEnv,
  isEmulator = false,
): AppCheck | null {
  if (isEmulator) {
    return initializeAppCheck(app, {
      provider: new CustomProvider({
        getToken: () =>
          Promise.resolve({
            token: 'citizen-pwa-emulator-app-check',
            expireTimeMillis: Date.now() + 60 * 60 * 1000,
          }),
      }),
      isTokenAutoRefreshEnabled: false,
    })
  }
  const siteKey = env.appCheckSiteKey
  if (!siteKey) return null
  return initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(siteKey),
    isTokenAutoRefreshEnabled: true,
  })
}
