import { getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import { dispatchDocSchema } from '../../packages/shared-validators/lib/index.js'

const PROJECT_ID = process.env.VITE_FIREBASE_PROJECT_ID ?? 'bantayog-alert-dev'

process.env.FIREBASE_AUTH_EMULATOR_HOST ??= '127.0.0.1:9099'
process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8081'

const app = getApps()[0] ?? initializeApp({ projectId: PROJECT_ID })
const auth = getAuth(app)
const db = getFirestore(app)

function isUserNotFoundError(err: unknown): boolean {
  return (
    err instanceof Error &&
    (err.message.includes('auth/user-not-found') ||
      err.message.includes('user not found') ||
      err.message.includes('There is no user record corresponding to the provided identifier'))
  )
}

async function getUserByEmailOrNull(email: string) {
  return auth.getUserByEmail(email).catch((err: unknown) => {
    if (isUserNotFoundError(err)) return null
    throw err
  })
}

async function ensureResponderUser() {
  const email = 'bfp-responder-test-01@test.local'
  const password = 'test123456'
  const uid = 'bfp-responder-test-01'
  const user = await getUserByEmailOrNull(email)
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
  const user = await getUserByEmailOrNull(email)
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

  const validationDoc = dispatchDocSchema.parse({
    reportId: 'report-1',
    status,
    assignedTo: {
      uid,
      agencyId: 'bfp-daet',
      municipalityId: 'daet',
    },
    dispatchedBy: 'seed-admin',
    dispatchedByRole: 'municipal_admin',
    dispatchedAt: now.toMillis(),
    statusUpdatedAt: now.toMillis(),
    acknowledgementDeadlineAt: now.toMillis() + 15 * 60 * 1000,
    idempotencyKey: '11111111-1111-4111-8111-111111111111',
    idempotencyPayloadHash: 'a'.repeat(64),
    schemaVersion: 1,
    ...(status === 'cancelled'
      ? {
          cancelledAt: now.toMillis(),
          cancelReason: 'Institutional cancel',
        }
      : {}),
  })

  const doc = {
    dispatchId,
    ...validationDoc,
    lastStatusAt: now,
    dispatchedAt: now,
    statusUpdatedAt: now,
    acknowledgementDeadlineAt: Timestamp.fromMillis(now.toMillis() + 15 * 60 * 1000),
    correlationId: '11111111-1111-4111-8111-111111111111',
    ...(status === 'cancelled'
      ? {
          cancelledAt: now,
          cancelReason: 'Institutional cancel',
        }
      : {}),
  }
  await db.collection('dispatches').doc(dispatchId).set(doc)
  return { dispatchId, uid }
}
