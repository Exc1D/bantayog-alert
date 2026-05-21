import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest'
import { type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { guardInitTestEnvironment } from '../../../__tests__/helpers/emulator-guard.js'
const itif = (condition: boolean) => (condition ? it : it.skip)
import { setDoc, doc } from 'firebase/firestore'
import { Timestamp, type Firestore } from 'firebase-admin/firestore'

vi.mock('firebase-admin/database', () => ({
  getDatabase: vi.fn(() => ({})),
}))

const { onCallMock } = vi.hoisted(() => ({
  onCallMock: vi.fn((_config: unknown, handler: unknown) => handler),
}))

vi.mock('firebase-functions/v2/https', async () => {
  const actual = await vi.importActual<typeof import('firebase-functions/v2/https')>(
    'firebase-functions/v2/https',
  )
  return {
    ...actual,
    onCall: onCallMock,
  }
})

let adminDb: Firestore
vi.mock('../../admin-init.js', () => ({
  get adminDb() {
    return adminDb
  },
}))

import { shareReportCore } from '../share-report.js'

const ts = 1713350400000
let testEnv: RulesTestEnvironment | undefined
let available = false

beforeAll(async () => {
  const guarded = await guardInitTestEnvironment(
    {
      projectId: 'share-report-test',
      firestore: {
        host: 'localhost',
        port: 8081,
        rules:
          'rules_version = "2"; service cloud.firestore { match /{d=**} { allow read, write: if true; } }',
      },
    },
    'share-report',
  )
  testEnv = guarded.env
  available = guarded.available
  if (!available) return
  adminDb = testEnv!.unauthenticatedContext().firestore() as unknown as Firestore
})

beforeEach(async () => {
  if (!available || !testEnv) return
  await testEnv.clearFirestore()
})

afterAll(async () => {
  await testEnv?.cleanup()
})

async function seedReportOps(id: string, muni: string) {
  await testEnv!.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'report_ops', id), {
      municipalityId: muni,
      status: 'verified',
      severity: 'high',
      createdAt: ts,
      updatedAt: ts,
      agencyIds: [],
      activeResponderCount: 0,
      requiresLocationFollowUp: false,
      visibility: { scope: 'municipality', sharedWith: [] },
      schemaVersion: 1,
    })
  })
}

const daetAdmin = {
  uid: 'daet-admin',
  claims: { role: 'municipal_admin', accountStatus: 'active', municipalityId: 'daet' },
}

const daetAdminMissingMuniId = {
  uid: 'daet-admin-missing',
  claims: { role: 'municipal_admin', accountStatus: 'active' },
}

describe('shareReport', () => {
  itif(available)('rejects caller from a different municipality than the report', async () => {
    await seedReportOps('r1', 'mercedes')
    await expect(
      shareReportCore(adminDb, {
        reportId: 'r1',
        targetMunicipalityId: 'labo',
        actor: daetAdmin,
        idempotencyKey: crypto.randomUUID(),
        now: Timestamp.fromMillis(ts),
      }),
    ).rejects.toMatchObject({ code: 'permission-denied' })
  })

  itif(available)('rejects municipal_admin missing municipalityId claim', async () => {
    await seedReportOps('r1', 'mercedes')
    await expect(
      shareReportCore(adminDb, {
        reportId: 'r1',
        targetMunicipalityId: 'labo',
        actor: daetAdminMissingMuniId,
        idempotencyKey: crypto.randomUUID(),
        now: Timestamp.fromMillis(ts),
      }),
    ).rejects.toMatchObject({ code: 'permission-denied' })
  })

  itif(available)('creates report_sharing doc with source manual and appends event', async () => {
    await seedReportOps('r1', 'daet')
    await shareReportCore(adminDb, {
      reportId: 'r1',
      targetMunicipalityId: 'mercedes',
      reason: 'Border incident',
      actor: daetAdmin,
      idempotencyKey: crypto.randomUUID(),
      now: Timestamp.fromMillis(ts),
    })
    const sharingSnap = await adminDb.collection('report_sharing').doc('r1').get()
    expect(sharingSnap.data()?.sharedWith).toContain('mercedes')

    const events = await adminDb.collection('report_sharing').doc('r1').collection('events').get()
    expect(events.empty).toBe(false)
    expect(events.docs[0]?.data().source).toBe('manual')
    expect(events.docs[0]?.data().sharedBy).toBe('daet-admin')
  })

  itif(available)('creates a command_channel_thread with threadType border_share', async () => {
    await seedReportOps('r1', 'daet')
    await shareReportCore(adminDb, {
      reportId: 'r1',
      targetMunicipalityId: 'mercedes',
      actor: daetAdmin,
      idempotencyKey: crypto.randomUUID(),
      now: Timestamp.fromMillis(ts),
    })
    const threads = await adminDb
      .collection('command_channel_threads')
      .where('reportId', '==', 'r1')
      .where('threadType', '==', 'border_share')
      .get()
    expect(threads.empty).toBe(false)
  })

  itif(available)('is idempotent — sharing same muni twice does not duplicate', async () => {
    await seedReportOps('r1', 'daet')
    const key = crypto.randomUUID()
    await shareReportCore(adminDb, {
      reportId: 'r1',
      targetMunicipalityId: 'mercedes',
      actor: daetAdmin,
      idempotencyKey: key,
      now: Timestamp.fromMillis(ts),
    })
    await shareReportCore(adminDb, {
      reportId: 'r1',
      targetMunicipalityId: 'mercedes',
      actor: daetAdmin,
      idempotencyKey: key,
      now: Timestamp.fromMillis(ts),
    })
    const events = await adminDb.collection('report_sharing').doc('r1').collection('events').get()
    expect(events.size).toBe(1)
  })
})
