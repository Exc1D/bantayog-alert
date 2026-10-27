import { Timestamp } from 'firebase-admin/firestore'
import { dispatchDocSchema } from '../../packages/shared-validators/lib/index.js'
import { db, ensureUser } from './admin-seed.js'

const RESPONDER_CLAIMS = {
  role: 'responder',
  accountStatus: 'active',
  municipalityId: 'daet',
  agencyId: 'bfp-daet',
}

async function ensureResponderUser() {
  const uid = 'bfp-responder-test-01'
  return ensureUser({
    uid,
    email: 'bfp-responder-test-01@test.local',
    password: 'test123456',
    claims: RESPONDER_CLAIMS,
    activeAccount: { uid, ...RESPONDER_CLAIMS, permittedMunicipalityIds: [], mfaEnrolled: true },
  })
}

async function ensureCitizenUser() {
  return ensureUser({
    uid: 'citizen-test-01',
    email: 'citizen-test-01@test.local',
    password: 'test123456',
    claims: { role: 'citizen', accountStatus: 'active', municipalityId: 'daet' },
  })
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

// Auto-seed when run directly via `npx tsx fixtures/responder-seed.ts`
if (process.argv[1] === new URL(import.meta.url).pathname) {
  seedAuthUsers()
    .then(() => {
      console.log('Responder/citizen accounts seeded')
    })
    .catch((err: unknown) => {
      console.error('Seed failed:', err)
      process.exit(1)
    })
}
