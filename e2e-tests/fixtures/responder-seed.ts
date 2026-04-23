import { getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'

const PROJECT_ID = process.env.VITE_FIREBASE_PROJECT_ID ?? 'bantayog-alert-dev'

process.env.FIREBASE_AUTH_EMULATOR_HOST ??= '127.0.0.1:9099'
process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8081'

const app = getApps()[0] ?? initializeApp({ projectId: PROJECT_ID })
const auth = getAuth(app)
const db = getFirestore(app)

async function ensureResponderUser() {
  const email = 'bfp-responder-test-01@test.local'
  const password = 'test123456'
  const uid = 'bfp-responder-test-01'
  const user = await auth.getUserByEmail(email).catch(() => null)
  if (user) {
    await auth.updateUser(user.uid, { password })
  } else {
    await auth.createUser({ uid, email, password })
  }
  await auth.setCustomUserClaims(uid, {
    role: 'responder',
    accountStatus: 'active',
    municipalityId: 'daet',
    agencyId: 'bfp-daet',
  })
  await db.collection('active_accounts').doc(uid).set({
    uid,
    role: 'responder',
    accountStatus: 'active',
    municipalityId: 'daet',
    agencyId: 'bfp-daet',
    permittedMunicipalityIds: [],
    mfaEnrolled: true,
    lastClaimIssuedAt: Date.now(),
    updatedAt: Date.now(),
  })
  return { email, password, uid }
}

async function ensureCitizenUser() {
  const email = 'citizen-test-01@test.local'
  const password = 'test123456'
  const uid = 'citizen-test-01'
  const user = await auth.getUserByEmail(email).catch(() => null)
  if (user) {
    await auth.updateUser(user.uid, { password })
  } else {
    await auth.createUser({ uid, email, password })
  }
  await auth.setCustomUserClaims(uid, {
    role: 'citizen',
    accountStatus: 'active',
    municipalityId: 'daet',
  })
  return { email, password, uid }
}

export async function seedAuthUsers() {
  await ensureResponderUser()
  await ensureCitizenUser()
}

export async function seedResponderDispatch(status: 'pending' | 'cancelled' = 'pending') {
  const { uid } = await ensureResponderUser()
  const now = Timestamp.now()
  const dispatchId = status === 'cancelled' ? 'dispatch-cancelled' : 'dispatch-1'
  const doc = {
    dispatchId,
    reportId: 'report-1',
    status,
    assignedTo: {
      uid,
      agencyId: 'bfp-daet',
      municipalityId: 'daet',
    },
    dispatchedAt: now,
    lastStatusAt: now,
    acknowledgementDeadlineAt: Timestamp.fromMillis(now.toMillis() + 15 * 60 * 1000),
    correlationId: '11111111-1111-4111-8111-111111111111',
    schemaVersion: 1,
    ...(status === 'cancelled' ? { cancelReason: 'Institutional cancel' } : {}),
  }
  await db.collection('dispatches').doc(dispatchId).set(doc)
  return { dispatchId, uid }
}
