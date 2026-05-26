import { initializeApp, getApp, getApps } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'

const EMU = process.argv.includes('--emulator')
const ALLOW_PROD = process.argv.includes('--allow-prod')
if (!EMU && !ALLOW_PROD) {
  console.error('Bootstrap script must run with --emulator or --allow-prod flag')
  process.exit(1)
}
if (EMU) {
  process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8081'
  process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099'
  process.env.DATABASE_EMULATOR_HOST = 'localhost:9000'
}

const PROJECT_ID =
  process.env.GCLOUD_PROJECT ?? process.env.FIREBASE_PROJECT_ID ?? 'bantayog-alert-dev'

if (getApps().length === 0) {
  initializeApp({
    projectId: PROJECT_ID,
    databaseURL: EMU
      ? `http://127.0.0.1:9000?ns=${PROJECT_ID}`
      : `https://${PROJECT_ID}.asia-southeast1.firebasedatabase.app`,
  })
}

const TEST_USERS = [
  {
    uid: 'superadmin-4a-test-01',
    email: 'superadmin@test.local',
    password: 'test123456',
    role: 'provincial_superadmin',
    claims: {
      role: 'provincial_superadmin',
      accountStatus: 'active',
      mfaEnrolled: false,
      lastClaimIssuedAt: Date.now(),
      permittedMunicipalityIds: [],
    },
  },
  {
    uid: 'citizen-4a-test-01',
    email: 'citizen-4a@test.local',
    password: 'test123456',
    role: 'citizen',
    claims: { role: 'citizen', accountStatus: 'active' },
  },
  {
    uid: 'admin-4a-test-01',
    email: 'admin-4a@test.local',
    password: 'test123456',
    role: 'municipal_admin',
    claims: { role: 'municipal_admin', accountStatus: 'active', municipalityId: 'm1' },
  },
  {
    uid: 'responder-4a-test-01',
    email: 'responder-4a@test.local',
    password: 'test123456',
    role: 'responder',
    claims: { role: 'responder', accountStatus: 'active', municipalityId: 'm1' },
  },
]

async function main() {
  const auth = getAuth(getApp())
  const db = getFirestore(getApp())
  const now = Date.now()

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
      if (err instanceof Error && (err as any).code === 'auth/uid-already-exists') {
        console.log(`[bootstrap] user ${user.email} already exists, fetching uid`)
        const existing = await auth.getUserByEmail(user.email)
        // Update seed UID constant so downstream writes reference the real uid
        user.uid = existing.uid
      } else {
        throw err
      }
    }
    await auth.setCustomUserClaims(user.uid, user.claims)
    console.log(`[bootstrap] claims set for ${user.email}`)
  }

  // Seed active_accounts for all staff users (idempotent)
  for (const user of TEST_USERS) {
    if (user.role === 'citizen') continue
    const data: Record<string, unknown> = {
      uid: user.uid,
      role: user.role,
      accountStatus: 'active',
      updatedAt: Timestamp.fromMillis(now),
    }
    if ('municipalityId' in user.claims) {
      data.municipalityId = user.claims.municipalityId
    }
    if (user.role === 'provincial_superadmin') {
      data.municipalityId = null
      data.agencyId = null
      data.permittedMunicipalityIds = []
      data.mfaEnrolled = false
      data.lastClaimIssuedAt = Timestamp.fromMillis(now)
    }
    await db.collection('active_accounts').doc(user.uid).set(data, { merge: true })
    console.log(`[bootstrap] active_accounts/${user.uid} seeded`)
  }

  console.log('Phase 4a bootstrap complete')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
