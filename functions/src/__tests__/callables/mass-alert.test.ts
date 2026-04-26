import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { setDoc, doc } from 'firebase/firestore'
import { type Firestore } from 'firebase-admin/firestore'

const onCallMock = vi.hoisted(() => vi.fn())
vi.mock('firebase-functions/v2/https', () => ({
  onCall: onCallMock,
  HttpsError: class HttpsError extends Error {
    constructor(
      public code: string,
      message: string,
    ) {
      super(message)
    }
  },
}))
vi.mock('firebase-admin/database', () => ({ getDatabase: vi.fn(() => ({})) }))
let adminDb: Firestore
vi.mock('../../admin-init.js', () => ({
  get adminDb() {
    return adminDb
  },
}))
vi.mock('../../services/fcm-mass-send.js', () => ({
  sendMassAlertFcm: vi.fn().mockResolvedValue({ successCount: 2, failureCount: 0, batchCount: 1 }),
}))

import {
  massAlertReachPlanPreviewCore,
  sendMassAlertCore,
  requestMassAlertEscalationCore,
  forwardMassAlertToNDRRMCCore,
} from '../../callables/mass-alert.js'

const ts = 1713350400000
let testEnv: RulesTestEnvironment
let collectionSpy: { mockRestore(): void } | undefined

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'mass-alert-test',
    firestore: {
      host: 'localhost',
      port: 8081,
      rules:
        'rules_version = "2"; service cloud.firestore { match /{d=**} { allow read, write: if true; } }',
    },
  })
  adminDb = testEnv.unauthenticatedContext().firestore() as unknown as Firestore
  mockCountOnDb(adminDb)
})

beforeEach(async () => {
  await testEnv.clearFirestore()
})

// Firestore emulator doesn't support count() aggregation queries.
// This mock intercepts .where().where().count().get() chains and
// returns snap.docs.length as the count.
function mockCountOnDb(db: Firestore) {
  const originalCollection = db.collection.bind(db)
  collectionSpy = vi.spyOn(db, 'collection').mockImplementation((collectionPath: string) => {
    const collRef = originalCollection(collectionPath)
    const originalWhere = collRef.where.bind(collRef)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.spyOn(collRef, 'where' as any).mockImplementation(
      (fieldPath: unknown, opStr: unknown, value: unknown) => {
        const query = originalWhere(
          fieldPath as string,
          opStr as FirebaseFirestore.WhereFilterOp,
          value,
        )
        const originalWhere2 = query.where.bind(query)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        vi.spyOn(query, 'where' as any).mockImplementation(
          (fieldPath2: unknown, opStr2: unknown, value2: unknown) => {
            const query2 = originalWhere2(
              fieldPath2 as string,
              opStr2 as FirebaseFirestore.WhereFilterOp,
              value2,
            )
            return Object.assign(query2, {
              count() {
                return {
                  async get() {
                    const snap = await query2.get()
                    return { data: () => ({ count: snap.docs.length }) }
                  },
                }
              },
            })
          },
        )
        return query
      },
    )
    return collRef
  })
}
afterAll(async () => {
  if (collectionSpy) collectionSpy.mockRestore()
  await testEnv.cleanup()
})

const muniAdminActor = {
  uid: 'admin-1',
  claims: {
    role: 'municipal_admin',
    municipalityId: 'daet',
    active: true,
    auth_time: Math.floor(ts / 1000),
  },
}
const superAdminActor = {
  uid: 'super-1',
  claims: { role: 'provincial_superadmin', active: true, auth_time: Math.floor(ts / 1000) },
}

async function seedResponder(id: string, hasFcmToken: boolean) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'responders', id), {
      municipalityId: 'daet',
      hasFcmToken,
      fcmTokens: hasFcmToken ? ['token-abc'] : [],
      displayName: 'Test',
      status: 'active',
      schemaVersion: 1,
    })
  })
}

async function seedConsentRecord(
  id: string,
  municipalityId: string,
  followUpConsent: boolean,
  phone?: string,
) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'report_sms_consent', id), {
      reportId: `r-${id}`,
      phone: phone ?? '+639170000001',
      locale: 'tl',
      smsConsent: true,
      municipalityId,
      followUpConsent,
      createdAt: ts,
      schemaVersion: 1,
    })
  })
}

describe('massAlertReachPlanPreview', () => {
  it('rejects citizens and responders', async () => {
    const result = await massAlertReachPlanPreviewCore(
      adminDb,
      {
        targetScope: { municipalityIds: ['daet'] },
        message: 'test',
      },
      { uid: 'c1', claims: { role: 'citizen', active: true, auth_time: Math.floor(ts / 1000) } },
    )
    expect(result.success).toBe(false)
    expect(result.errorCode).toBe('permission-denied')
  })

  it('rejects a muni admin scoping to a different municipality', async () => {
    const result = await massAlertReachPlanPreviewCore(
      adminDb,
      {
        targetScope: { municipalityIds: ['labo'] },
        message: 'test',
      },
      muniAdminActor,
    )
    expect(result.success).toBe(false)
    expect(result.errorCode).toBe('permission-denied')
  })

  it('returns fcmCount as count of responders with hasFcmToken true in scope municipality', async () => {
    await seedResponder('r1', true)
    await seedResponder('r2', true)
    await seedResponder('r3', false)
    const result = await massAlertReachPlanPreviewCore(
      adminDb,
      {
        targetScope: { municipalityIds: ['daet'] },
        message: 'Hello world',
      },
      muniAdminActor,
    )
    expect(result.success).toBe(true)
    expect(result.reachPlan?.fcmCount).toBe(2)
  })

  it('returns smsCount as count of report_sms_consent with followUpConsent true in scope', async () => {
    await seedConsentRecord('c1', 'daet', true)
    await seedConsentRecord('c2', 'daet', true)
    await seedConsentRecord('c3', 'daet', false)
    const result = await massAlertReachPlanPreviewCore(
      adminDb,
      {
        targetScope: { municipalityIds: ['daet'] },
        message: 'Hello world',
      },
      muniAdminActor,
    )
    expect(result.success).toBe(true)
    expect(result.reachPlan?.smsCount).toBe(2)
  })

  it('returns route direct when totalEstimate <= 5000 and scope is single muni', async () => {
    const result = await massAlertReachPlanPreviewCore(
      adminDb,
      {
        targetScope: { municipalityIds: ['daet'] },
        message: 'Hello world',
      },
      muniAdminActor,
    )
    expect(result.reachPlan?.route).toBe('direct')
  })

  it('returns route ndrrmc_escalation when scope spans multiple municipalities', async () => {
    const result = await massAlertReachPlanPreviewCore(
      adminDb,
      {
        targetScope: { municipalityIds: ['daet', 'labo'] },
        message: 'Hello world',
      },
      superAdminActor,
    )
    expect(result.reachPlan?.route).toBe('ndrrmc_escalation')
  })

  it('returns unicodeWarning true when message contains UCS-2 characters', async () => {
    const result = await massAlertReachPlanPreviewCore(
      adminDb,
      {
        targetScope: { municipalityIds: ['daet'] },
        message: 'Alerto sa ñ lugar',
      },
      muniAdminActor,
    )
    expect(result.reachPlan?.unicodeWarning).toBe(true)
  })

  it('returns correct segmentCount for GSM-7 messages', async () => {
    const result = await massAlertReachPlanPreviewCore(
      adminDb,
      {
        targetScope: { municipalityIds: ['daet'] },
        message: 'ALERT: Typhoon warning',
      },
      muniAdminActor,
    )
    expect(result.reachPlan?.segmentCount).toBeGreaterThanOrEqual(1)
  })
})

describe('sendMassAlert', () => {
  it('rejects when reachPlan.route is ndrrmc_escalation', async () => {
    const result = await sendMassAlertCore(
      adminDb,
      {
        reachPlan: {
          route: 'ndrrmc_escalation',
          fcmCount: 100,
          smsCount: 100,
          segmentCount: 1,
          unicodeWarning: false,
        },
        message: 'test',
        targetScope: { municipalityIds: ['daet'] },
        idempotencyKey: crypto.randomUUID(),
      },
      muniAdminActor,
    )
    expect(result.success).toBe(false)
    expect(result.errorCode).toBe('permission-denied')
  })

  it('creates mass_alert_requests doc with status sent and server-computed reach', async () => {
    await seedResponder('r1', true)
    await seedResponder('r2', true)
    const result = await sendMassAlertCore(
      adminDb,
      {
        reachPlan: {
          route: 'direct',
          fcmCount: 9999,
          smsCount: 9999,
          segmentCount: 1,
          unicodeWarning: false,
        },
        message: 'Typhoon alert',
        targetScope: { municipalityIds: ['daet'] },
        idempotencyKey: crypto.randomUUID(),
      },
      muniAdminActor,
    )
    expect(result.success).toBe(true)
    expect(result.requestId).toBeDefined()
    const created = await adminDb.collection('mass_alert_requests').doc(result.requestId!).get()
    expect(created.data()?.status).toBe('sent')
    // estimatedReach must come from server preview, not the malicious client input.
    expect(created.data()?.estimatedReach).toBe(2)
  })

  it('refuses to send to a different municipality than the caller claim', async () => {
    const result = await sendMassAlertCore(
      adminDb,
      {
        reachPlan: {
          route: 'direct',
          fcmCount: 5,
          smsCount: 3,
          segmentCount: 1,
          unicodeWarning: false,
        },
        message: 'Alert',
        targetScope: { municipalityIds: ['labo'] },
        idempotencyKey: crypto.randomUUID(),
      },
      muniAdminActor,
    )
    expect(result.success).toBe(false)
    expect(result.errorCode).toBe('permission-denied')
  })

  it('is idempotent', async () => {
    const key = crypto.randomUUID()
    const r1 = await sendMassAlertCore(
      adminDb,
      {
        reachPlan: {
          route: 'direct',
          fcmCount: 5,
          smsCount: 3,
          segmentCount: 1,
          unicodeWarning: false,
        },
        message: 'Alert',
        targetScope: { municipalityIds: ['daet'] },
        idempotencyKey: key,
      },
      muniAdminActor,
    )
    const r2 = await sendMassAlertCore(
      adminDb,
      {
        reachPlan: {
          route: 'direct',
          fcmCount: 5,
          smsCount: 3,
          segmentCount: 1,
          unicodeWarning: false,
        },
        message: 'Alert',
        targetScope: { municipalityIds: ['daet'] },
        idempotencyKey: key,
      },
      muniAdminActor,
    )
    expect(r1.requestId).toBe(r2.requestId)
  })

  it('queues SMS outbox entries when smsCount > 0', async () => {
    process.env.SMS_MSISDN_HASH_SALT = 'test-salt-at-least-16-chars'
    await seedConsentRecord('sms-1', 'daet', true, '+639170000001')
    await seedConsentRecord('sms-2', 'daet', true, '+639170000002')
    const result = await sendMassAlertCore(
      adminDb,
      {
        reachPlan: {
          route: 'direct',
          fcmCount: 0,
          smsCount: 2,
          segmentCount: 1,
          unicodeWarning: false,
        },
        message: 'Typhoon alert',
        targetScope: { municipalityIds: ['daet'] },
        idempotencyKey: crypto.randomUUID(),
      },
      muniAdminActor,
    )
    expect(result.success).toBe(true)
    const outboxSnaps = await adminDb.collection('sms_outbox').get()
    expect(outboxSnaps.size).toBe(2)
  })
})

describe('requestMassAlertEscalation', () => {
  it('creates mass_alert_requests doc with status pending_ndrrmc_review', async () => {
    const result = await requestMassAlertEscalationCore(
      adminDb,
      {
        message: 'Typhoon signal 3',
        targetScope: { municipalityIds: ['daet'] },
        evidencePack: { linkedReportIds: ['r1'], notes: 'Verified by weather station' },
        idempotencyKey: crypto.randomUUID(),
      },
      muniAdminActor,
    )
    expect(result.success).toBe(true)
    const created = await adminDb
      .collection('mass_alert_requests')
      .doc((result as { success: true; requestId: string }).requestId)
      .get()
    expect(created.data()?.status).toBe('pending_ndrrmc_review')
  })

  it('does not send responder FCM during escalation (reviewer channel TBD)', async () => {
    const { sendMassAlertFcm } = await import('../../services/fcm-mass-send.js')
    const mockFcm = vi.mocked(sendMassAlertFcm)
    mockFcm.mockClear()
    await requestMassAlertEscalationCore(
      adminDb,
      {
        message: 'Alert',
        targetScope: { municipalityIds: ['daet'] },
        evidencePack: { linkedReportIds: [] },
        idempotencyKey: crypto.randomUUID(),
      },
      muniAdminActor,
    )
    expect(mockFcm).not.toHaveBeenCalled()
  })
})

describe('forwardMassAlertToNDRRMC', () => {
  async function createPendingRequest(id: string) {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'mass_alert_requests', id), {
        requestedByMunicipality: 'daet',
        status: 'pending_ndrrmc_review',
        body: 'Alert',
        targetType: 'municipality',
        requestedByUid: 'admin-1',
        createdAt: ts,
        schemaVersion: 1,
      })
    })
  }

  it('rejects non-superadmin callers', async () => {
    await createPendingRequest('req-1')
    const result = await forwardMassAlertToNDRRMCCore(
      adminDb,
      {
        requestId: 'req-1',
        forwardMethod: 'email',
        ndrrmcRecipient: 'ndrrmc@gov.ph',
      },
      muniAdminActor,
    )
    expect(result.success).toBe(false)
    expect(result.errorCode).toBe('permission-denied')
  })

  it('updates status to forwarded_to_ndrrmc', async () => {
    await createPendingRequest('req-2')
    const result = await forwardMassAlertToNDRRMCCore(
      adminDb,
      {
        requestId: 'req-2',
        forwardMethod: 'email',
        ndrrmcRecipient: 'ndrrmc@gov.ph',
      },
      superAdminActor,
    )
    expect(result.success).toBe(true)
    const updated = await adminDb.collection('mass_alert_requests').doc('req-2').get()
    expect(updated.data()?.status).toBe('forwarded_to_ndrrmc')
    expect(updated.data()?.forwardMethod).toBe('email')
    expect(updated.data()?.ndrrmcRecipient).toBe('ndrrmc@gov.ph')
  })

  it('rejects forwarding a request that is not pending_ndrrmc_review', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'mass_alert_requests', 'req-3'), {
        requestedByMunicipality: 'daet',
        status: 'sent',
        body: 'Alert',
        targetType: 'municipality',
        requestedByUid: 'admin-1',
        createdAt: ts,
        schemaVersion: 1,
      })
    })
    const result = await forwardMassAlertToNDRRMCCore(
      adminDb,
      {
        requestId: 'req-3',
        forwardMethod: 'email',
        ndrrmcRecipient: 'ndrrmc@gov.ph',
      },
      superAdminActor,
    )
    expect(result.success).toBe(false)
    expect(result.errorCode).toBe('failed-precondition')
  })
})
