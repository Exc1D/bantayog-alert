import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest'
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { initializeApp, deleteApp, type App } from 'firebase-admin/app'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'

vi.mock('firebase-admin/database', () => ({
  getDatabase: vi.fn(() => ({})),
}))

import { listScopedOperationsMapCore } from '../../callables/list-scoped-operations-map.js'
import { seedReportAtStatus } from '../helpers/seed-factories.js'

const ts = 1713350400000
let testEnv: RulesTestEnvironment
let adminApp: App
let adminDb: Firestore
const originalEmulatorHost = process.env.FIRESTORE_EMULATOR_HOST

async function seedScopedReport(opts: {
  reportId: string
  municipalityId: string
  municipalityLabel: string
  agencyIds: string[]
}) {
  await seedReportAtStatus(adminDb, 'verified', {
    reportId: opts.reportId,
    municipalityId: opts.municipalityId,
    municipalityLabel: opts.municipalityLabel,
  })

  await adminDb
    .collection('reports')
    .doc(opts.reportId)
    .set(
      {
        reportId: opts.reportId,
        municipalityId: opts.municipalityId,
        municipalityLabel: opts.municipalityLabel,
        reportType: 'fire',
        severityDerived: 'high',
        status: 'verified',
        description: 'Scoped map incident',
        publicLocation: { lat: 14.11, lng: 122.95 },
        submittedAt: ts,
        updatedAt: ts,
        lastStatusAt: ts,
      },
      { merge: true },
    )

  await adminDb
    .collection('report_ops')
    .doc(opts.reportId)
    .set({
      reportId: opts.reportId,
      municipalityId: opts.municipalityId,
      status: 'verified',
      severity: 'high',
      createdAt: ts,
      agencyIds: opts.agencyIds,
      activeResponderCount: 2,
      requiresLocationFollowUp: false,
      visibility: { scope: 'municipality', sharedWith: [] },
      updatedAt: ts,
      schemaVersion: 1,
    })
}

beforeAll(async () => {
  process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8081'
  testEnv = await initializeTestEnvironment({
    projectId: 'list-scoped-operations-map-test',
    firestore: {
      host: 'localhost',
      port: 8081,
      rules:
        'rules_version = "2"; service cloud.firestore { match /{d=**} { allow read, write: if true; } }',
    },
  })
  adminApp = initializeApp({ projectId: 'list-scoped-operations-map-test' }, 'list-scoped-ops')
  adminDb = getFirestore(adminApp)
})

beforeEach(async () => {
  await testEnv.clearFirestore()
})

afterAll(async () => {
  await testEnv.cleanup()
  await deleteApp(adminApp)
  if (originalEmulatorHost === undefined) {
    delete process.env.FIRESTORE_EMULATOR_HOST
  } else {
    process.env.FIRESTORE_EMULATOR_HOST = originalEmulatorHost
  }
})

describe('listScopedOperationsMapCore', () => {
  it('returns municipal scoped incidents', async () => {
    await seedScopedReport({
      reportId: 'rep-muni',
      municipalityId: 'daet',
      municipalityLabel: 'Daet',
      agencyIds: ['bfp-daet'],
    })

    const result = await listScopedOperationsMapCore(adminDb, {
      uid: 'daet-admin',
      claims: {
        role: 'municipal_admin',
        accountStatus: 'active',
        municipalityId: 'daet',
      },
    })

    expect(result.incidents).toHaveLength(1)
    expect(result.incidents[0]).toMatchObject({
      reportId: 'rep-muni',
      report: {
        municipalityId: 'daet',
        municipalityLabel: 'Daet',
        description: 'Scoped map incident',
        activeResponderCount: 2,
      },
    })
  })

  it('returns agency scoped incidents', async () => {
    await seedScopedReport({
      reportId: 'rep-agency',
      municipalityId: 'mercedes',
      municipalityLabel: 'Mercedes',
      agencyIds: ['bfp-daet'],
    })

    const result = await listScopedOperationsMapCore(adminDb, {
      uid: 'bfp-admin',
      claims: {
        role: 'agency_admin',
        accountStatus: 'active',
        agencyId: 'bfp-daet',
      },
    })

    expect(result.incidents).toHaveLength(1)
    expect(result.incidents[0]).toMatchObject({
      reportId: 'rep-agency',
      report: {
        municipalityId: 'mercedes',
        municipalityLabel: 'Mercedes',
        description: 'Scoped map incident',
        activeResponderCount: 2,
      },
    })
  })

  it('rejects a caller without a scoped admin role', async () => {
    await expect(
      listScopedOperationsMapCore(adminDb, {
        uid: 'citizen-1',
        claims: {
          role: 'citizen',
          accountStatus: 'active',
        },
      }),
    ).rejects.toMatchObject({ code: 'permission-denied' })
  })
})
