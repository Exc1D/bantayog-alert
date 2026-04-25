import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { setDoc, doc } from 'firebase/firestore'
import { type Firestore } from 'firebase-admin/firestore'

const onCallMock = vi.hoisted(() => vi.fn())
vi.mock('firebase-functions/v2/https', () => ({ onCall: onCallMock }))
vi.mock('firebase-admin/database', () => ({ getDatabase: vi.fn(() => ({})) }))
let adminDb: Firestore
vi.mock('../../admin-init.js', () => ({
  get adminDb() {
    return adminDb
  },
}))

import { mergeDuplicatesCore } from '../../callables/merge-duplicates.js'

const ts = 1713350400000
const CLUSTER_ID = 'cluster-uuid-1'
let testEnv: RulesTestEnvironment

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'merge-dup-test',
    firestore: {
      host: 'localhost',
      port: 8081,
      rules:
        'rules_version = "2"; service cloud.firestore { match /{d=**} { allow read, write: if true; } }',
    },
  })
  adminDb = testEnv.unauthenticatedContext().firestore() as unknown as Firestore
})

beforeEach(async () => {
  await testEnv.clearFirestore()
})
afterAll(async () => {
  await testEnv.cleanup()
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

const muniAdminActor = {
  uid: 'admin-1',
  claims: {
    role: 'municipal_admin',
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
        idempotencyKey: 'key-1',
      },
      {
        uid: 'citizen-1',
        claims: { role: 'citizen', active: true, auth_time: Math.floor(ts / 1000) },
      },
    )
    expect(result.success).toBe(false)
    expect(result.errorCode).toBe('permission-denied')
  })

  it('rejects report IDs from different municipalities', async () => {
    await seedReport('r1')
    await seedReport('r2', { municipalityId: 'labo' })
    const result = await mergeDuplicatesCore(
      adminDb,
      {
        primaryReportId: 'r1',
        duplicateReportIds: ['r2'],
        idempotencyKey: 'key-2',
      },
      muniAdminActor,
    )
    expect(result.success).toBe(false)
    expect(result.errorCode).toBe('invalid-argument')
  })

  it('rejects report IDs that do not share a duplicateClusterId', async () => {
    await seedReport('r1', { duplicateClusterId: 'cluster-a' })
    await seedReport('r2', { duplicateClusterId: 'cluster-b' })
    const result = await mergeDuplicatesCore(
      adminDb,
      {
        primaryReportId: 'r1',
        duplicateReportIds: ['r2'],
        idempotencyKey: 'key-3',
      },
      muniAdminActor,
    )
    expect(result.success).toBe(false)
    expect(result.errorCode).toBe('failed-precondition')
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
        idempotencyKey: 'key-4',
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
        idempotencyKey: 'key-5',
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
        idempotencyKey: 'key-6',
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
    await mergeDuplicatesCore(
      adminDb,
      {
        primaryReportId: 'r-primary',
        duplicateReportIds: ['r-dup1'],
        idempotencyKey: 'key-7',
      },
      muniAdminActor,
    )
    await mergeDuplicatesCore(
      adminDb,
      {
        primaryReportId: 'r-primary',
        duplicateReportIds: ['r-dup1'],
        idempotencyKey: 'key-7',
      },
      muniAdminActor,
    )
    const dup1 = await adminDb.collection('reports').doc('r-dup1').get()
    expect(dup1.data()?.status).toBe('merged_as_duplicate')
  })
})
