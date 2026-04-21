import { initializeApp, getApp, getApps } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

const EMU = process.argv.includes('--emulator')
if (EMU) {
  process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080'
  process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099'
}

const PROJECT_ID =
  process.env.GCLOUD_PROJECT ?? process.env.FIREBASE_PROJECT_ID ?? 'bantayog-alert-dev'

if (getApps().length === 0) {
  initializeApp({ projectId: PROJECT_ID })
}

const TEST_USERS = [
  {
    uid: 'citizen-4a-test-01',
    email: 'citizen-4a@test.local',
    password: 'test123456',
    role: 'citizen',
    claims: { role: 'citizen', active: true },
  },
  {
    uid: 'admin-4a-test-01',
    email: 'admin-4a@test.local',
    password: 'test123456',
    role: 'municipal_admin',
    claims: { role: 'municipal_admin', municipalityId: 'm1', active: true },
  },
  {
    uid: 'responder-4a-test-01',
    email: 'responder-4a@test.local',
    password: 'test123456',
    role: 'responder',
    claims: { role: 'responder', municipalityId: 'm1', active: true },
  },
]

async function main() {
  const auth = getAuth(getApp())
  const db = getFirestore(getApp())

  // Seed municipality
  await db.collection('municipalities').doc('m1').set(
    {
      name: 'Test Municipality',
      defaultSmsLocale: 'tl',
      schemaVersion: 1,
    },
    { merge: true },
  )
  console.log('[bootstrap] municipality m1 seeded')

  // Seed test users idempotently
  for (const user of TEST_USERS) {
    try {
      await auth.createUser({
        uid: user.uid,
        email: user.email,
        password: user.password,
        emailVerified: true,
      })
      console.log(`[bootstrap] created user ${user.email}`)
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes('already')) {
        console.log(`[bootstrap] user ${user.email} already exists`)
      } else {
        throw err
      }
    }
    await auth.setCustomUserClaims(user.uid, user.claims)
    console.log(`[bootstrap] claims set for ${user.email}`)
  }

  console.log('Phase 4a bootstrap complete')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
