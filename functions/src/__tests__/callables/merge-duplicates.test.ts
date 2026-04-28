import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { setDoc, doc } from 'firebase/firestore'
import { type Firestore, Timestamp, getFirestore } from 'firebase-admin/firestore'
import { initializeApp, deleteApp, type App } from 'firebase-admin/app'
import type { UserRole } from '@bantayog/shared-types'

const onCallMock = vi.hoisted(() => vi.fn())
vi.mock('firebase-functions/v2/https', () => ({ onCall: onCallMock }))
vi.mock('firebase-admin/database', () => ({ getDatabase: vi.fn(() => ({})) }))
let adminApp: App
let adminDb: Firestore
vi.mock('../../admin-init.js', () => ({
  get adminDb() {
    return adminDb
  },
}))

import {
  mergeDuplicatesCore,
  type MergeDuplicatesResult,
} from '../../callables/merge-duplicates.js'

const uuid = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`
const ts = 1713350400000
const CLUSTER_ID = 'cluster-uuid-1'
let testEnv: RulesTestEnvironment

beforeAll(async () => {
  process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8081'
  testEnv = await initializeTestEnvironment({
    projectId: 'merge-dup-test',
    firestore: {
      host: 'localhost',
      port: 8081,
      rules:
        'rules_version = "2"; service cloud.firestore { match /{d=**} { allow read, write: if true; } }',
    },
  })
  adminApp = initializeApp({ projectId: 'merge-dup-test' }, 'merge-dup-test')
  adminDb = getFirestore(adminApp)
})

beforeEach(async () => {
  await testEnv.clearFirestore()
})
afterAll(async () => {
  await testEnv.cleanup()
  await deleteApp(adminApp)
})

async function seedReport(id: string, overrides: Record<string, unknown> = {}) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'reports', id), {
      municipalityId: 'daet',
      reportType: 'flood',
      status: 'new',
      severity: 'high',
      barangayId: 'brgy1',
      mediaRefs: [],
      createdAt: ts,
      updatedAt: ts,
      schemaVersion: 1,
      ...overrides,
    })
    await setDoc(doc(ctx.firestore(), 'report_ops', id), {
      municipalityId: 'daet',
      reportType: 'flood',
      status: 'new',
      severity: 'high',
      createdAt: ts,
      updatedAt: ts,
      agencyIds: [],
      activeResponderCount: 0,
      requiresLocationFollowUp: false,
      duplicateClusterId: CLUSTER_ID,
      visibility: { scope: 'municipality', sharedWith: [] },
      schemaVersion: 1,
      ...overrides,
    })
  })
}

function expectError(result: MergeDuplicatesResult, code: string) {
  expect(result.success).toBe(false)
  if (!result.success) {
    expect(result.errorCode).toBe(code)
  }
}

const muniAdminActor = {
  uid: 'admin-1',
  claims: {
    role: 'municipal_admin' as UserRole,
    municipalityId: 'daet',
    active: true,
    auth_time: Math.floor(ts / 1000),
  },
}

describe('mergeDuplicates', () => {
  it('rejects a non-muni-admin caller', async () => {
    const result = await mergeDuplicatesCore(
      adminDb,
      {
        primaryReportId: 'r1',
        duplicateReportIds: ['r2'],
        idempotencyKey: uuid(1),
      },
      {
        uid: 'citizen-1',
        claims: { role: 'citizen', active: true, auth_time: Math.floor(ts / 1000) },
      },
    )
    expectError(result, 'permission-denied')
  })

  it('rejects inactive admin', async () => {
    await seedReport('r1')
    await seedReport('r2')
    const result = await mergeDuplicatesCore(
      adminDb,
      {
        primaryReportId: 'r1',
        duplicateReportIds: ['r2'],
        idempotencyKey: uuid(99),
      },
      {
        uid: 'admin-1',
        claims: {
          role: 'municipal_admin',
          municipalityId: 'daet',
          active: false,
          auth_time: Math.floor(ts / 1000),
        },
      },
    )
    expectError(result, 'permission-denied')
  })

  it('rejects report IDs from different municipalities', async () => {
    await seedReport('r1')
    await seedReport('r2', { municipalityId: 'labo' })
    const result = await mergeDuplicatesCore(
      adminDb,
      {
        primaryReportId: 'r1',
        duplicateReportIds: ['r2'],
        idempotencyKey: uuid(2),
      },
      muniAdminActor,
    )
    expectError(result, 'invalid-argument')
  })

  it('rejects report IDs that do not share a duplicateClusterId', async () => {
    await seedReport('r1', { duplicateClusterId: 'cluster-a' })
    await seedReport('r2', { duplicateClusterId: 'cluster-b' })
    const result = await mergeDuplicatesCore(
      adminDb,
      {
        primaryReportId: 'r1',
        duplicateReportIds: ['r2'],
        idempotencyKey: uuid(3),
      },
      muniAdminActor,
    )
    expectError(result, 'failed-precondition')
  })

  it('sets status merged_as_duplicate on all non-primary reports', async () => {
    await seedReport('r-primary')
    await seedReport('r-dup1')
    await seedReport('r-dup2')
    await mergeDuplicatesCore(
      adminDb,
      {
        primaryReportId: 'r-primary',
        duplicateReportIds: ['r-dup1', 'r-dup2'],
        idempotencyKey: uuid(4),
      },
      muniAdminActor,
    )
    const dup1 = await adminDb.collection('reports').doc('r-dup1').get()
    const dup2 = await adminDb.collection('reports').doc('r-dup2').get()
    expect(dup1.data()?.status).toBe('merged_as_duplicate')
    expect(dup2.data()?.status).toBe('merged_as_duplicate')
  })

  it('sets mergedInto on all non-primary reports', async () => {
    await seedReport('r-primary')
    await seedReport('r-dup1')
    await mergeDuplicatesCore(
      adminDb,
      {
        primaryReportId: 'r-primary',
        duplicateReportIds: ['r-dup1'],
        idempotencyKey: uuid(5),
      },
      muniAdminActor,
    )
    const dup1 = await adminDb.collection('reports').doc('r-dup1').get()
    expect(dup1.data()?.mergedInto).toBe('r-primary')
  })

  it('aggregates unique mediaRefs from duplicates onto the primary', async () => {
    await seedReport('r-primary', { mediaRefs: ['media-a', 'media-b'] })
    await seedReport('r-dup1', { mediaRefs: ['media-b', 'media-c'] })
    await mergeDuplicatesCore(
      adminDb,
      {
        primaryReportId: 'r-primary',
        duplicateReportIds: ['r-dup1'],
        idempotencyKey: uuid(6),
      },
      muniAdminActor,
    )
    const primary = await adminDb.collection('reports').doc('r-primary').get()
    const refs = primary.data()?.mediaRefs as string[]
    expect(refs).toContain('media-a')
    expect(refs).toContain('media-b')
    expect(refs).toContain('media-c')
    expect(new Set(refs).size).toBe(refs.length)
  })

  it('is idempotent', async () => {
    await seedReport('r-primary')
    await seedReport('r-dup1')
    const result1 = await mergeDuplicatesCore(
      adminDb,
      {
        primaryReportId: 'r-primary',
        duplicateReportIds: ['r-dup1'],
        idempotencyKey: uuid(7),
      },
      muniAdminActor,
    )
    const result2 = await mergeDuplicatesCore(
      adminDb,
      {
        primaryReportId: 'r-primary',
        duplicateReportIds: ['r-dup1'],
        idempotencyKey: uuid(7),
      },
      muniAdminActor,
    )

    // Assert first call succeeded
    expect(result1.success).toBe(true)
    if (result1.success) {
      expect(result1.mergedCount).toBe(1)
    }

    // Assert replay returns same result
    expect(result2.success).toBe(true)
    if (result2.success) {
      expect(result2.mergedCount).toBe(1)
    }

    const dup1 = await adminDb.collection('reports').doc('r-dup1').get()
    expect(dup1.data()?.status).toBe('merged_as_duplicate')

    const mergeEvents = await adminDb
      .collection('report_events')
      .where('reportId', '==', 'r-primary')
      .get()
    expect(mergeEvents.size).toBe(1)
  })

  it('rejects when primary report does not exist', async () => {
    await seedReport('r-dup1')
    const result = await mergeDuplicatesCore(
      adminDb,
      {
        primaryReportId: 'r-missing',
        duplicateReportIds: ['r-dup1'],
        idempotencyKey: uuid(8),
      },
      muniAdminActor,
    )
    expectError(result, 'not-found')
  })

  it('updates report_ops for primary and duplicates', async () => {
    await seedReport('r-primary')
    await seedReport('r-dup1')
    await mergeDuplicatesCore(
      adminDb,
      {
        primaryReportId: 'r-primary',
        duplicateReportIds: ['r-dup1'],
        idempotencyKey: uuid(9),
      },
      muniAdminActor,
    )
    const primaryOps = await adminDb.collection('report_ops').doc('r-primary').get()
    const dupOps = await adminDb.collection('report_ops').doc('r-dup1').get()
    expect(dupOps.data()?.status).toBe('merged_as_duplicate')
    expect((primaryOps.data()?.updatedAt as Timestamp).toMillis()).toBeGreaterThan(ts)
    expect((dupOps.data()?.updatedAt as Timestamp).toMillis()).toBeGreaterThan(ts)
  })
})
