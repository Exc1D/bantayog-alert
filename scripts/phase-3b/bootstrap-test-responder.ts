import { initializeApp, getApp, getApps } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'
import { getDatabase } from 'firebase-admin/database'

const EMU = process.argv.includes('--emulator')
if (EMU) {
  process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080'
  process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099'
  process.env.FIREBASE_DATABASE_EMULATOR_HOST = 'localhost:9000'
}

const PROJECT_ID =
  process.env.GCLOUD_PROJECT ?? process.env.FIREBASE_PROJECT_ID ?? 'bantayog-alert-dev'

if (getApps().length === 0) {
  initializeApp({
    projectId: PROJECT_ID,
    databaseURL: EMU
      ? `http://localhost:9000?ns=${PROJECT_ID}`
      : `https://${PROJECT_ID}.asia-southeast1.firebasedatabase.app`,
  })
}

const TEST_RESPONDER = {
  uid: 'bfp-responder-test-01',
  email: 'bfp-responder-test-01@bantayog.test',
  password: 'Test1234!',
  displayName: 'BFP Test Responder 01',
  agencyId: 'bfp-daet',
  municipalityId: 'daet',
}

async function main() {
  const auth = getAuth(getApp())
  const db = getFirestore(getApp())
  const rtdb = getDatabase(getApp())

  try {
    await auth.createUser({
      uid: TEST_RESPONDER.uid,
      email: TEST_RESPONDER.email,
      password: TEST_RESPONDER.password,
      emailVerified: true,
      displayName: TEST_RESPONDER.displayName,
    })
    console.log('[bootstrap] created auth user')
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('already')) {
      console.log('[bootstrap] auth user already exists')
    } else {
      throw err
    }
  }

  await auth.setCustomUserClaims(TEST_RESPONDER.uid, {
    role: 'responder',
    municipalityId: TEST_RESPONDER.municipalityId,
    agencyId: TEST_RESPONDER.agencyId,
    active: true,
  })
  console.log('[bootstrap] claims set')

  await db.collection('responders').doc(TEST_RESPONDER.uid).set(
    {
      uid: TEST_RESPONDER.uid,
      displayName: TEST_RESPONDER.displayName,
      agencyId: TEST_RESPONDER.agencyId,
      municipalityId: TEST_RESPONDER.municipalityId,
      isActive: true,
      fcmTokens: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      schemaVersion: 1,
    },
    { merge: true },
  )
  console.log('[bootstrap] responders doc written')

  await rtdb.ref(`/responder_index/${TEST_RESPONDER.municipalityId}/${TEST_RESPONDER.uid}`).set({
    isOnShift: true,
    updatedAt: Date.now(),
  })
  console.log('[bootstrap] responder shift index set')

  console.log(`[bootstrap] done — responder uid=${TEST_RESPONDER.uid}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
