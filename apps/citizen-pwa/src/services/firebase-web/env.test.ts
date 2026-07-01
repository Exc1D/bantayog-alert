import { describe, expect, it } from 'vitest'
import { parseFirebaseWebEnv } from './env.js'

describe('parseFirebaseWebEnv', () => {
  it('reads the required Vite env values', () => {
    expect(
      parseFirebaseWebEnv({
        VITE_FIREBASE_API_KEY: 'api-key',
        VITE_FIREBASE_AUTH_DOMAIN: 'demo.firebaseapp.com',
        VITE_FIREBASE_PROJECT_ID: 'demo-project',
        VITE_FIREBASE_APP_ID: '1:123:web:abc',
        VITE_FIREBASE_MESSAGING_SENDER_ID: '123',
        VITE_FIREBASE_STORAGE_BUCKET: 'demo-project.appspot.com',
        VITE_FIREBASE_DATABASE_URL: 'https://demo-project-default-rtdb.firebaseio.com',
        VITE_FIREBASE_APP_CHECK_SITE_KEY: 'site-key',
      }),
    ).toMatchObject({
      projectId: 'demo-project',
      databaseURL: 'https://demo-project-default-rtdb.firebaseio.com',
    })
  })

  it('throws on missing env vars', () => {
    expect(() =>
      parseFirebaseWebEnv({
        VITE_FIREBASE_API_KEY: 'api-key',
        // missing others
      }),
    ).toThrow(/Missing required Firebase env var/)
  })
})
