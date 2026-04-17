import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app'
import { initializeAppCheck, ReCaptchaV3Provider, type AppCheck } from 'firebase/app-check'
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
  })
}

export function createAppCheck(app: FirebaseApp, env: FirebaseWebEnv): AppCheck {
  return initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(env.appCheckSiteKey),
    isTokenAutoRefreshEnabled: true,
  })
}
