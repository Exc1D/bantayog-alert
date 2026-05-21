import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest'
import { type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { guardInitTestEnvironment } from '../../../__tests__/helpers/emulator-guard.js'
const itif = (condition: boolean) => (condition ? it : it.skip)
import { initializeApp, deleteApp, type App } from 'firebase-admin/app'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'

vi.mock('firebase-admin/database', () => ({
  getDatabase: vi.fn(() => ({})),
}))

import { listScopedOperationsMapCore } from '../scoped-operations.js'
import { seedReportAtStatus } from '../../../__tests__/helpers/seed-factories.js'

const ts = 1713350400000
let testEnv: RulesTestEnvironment | undefined
let available = false
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
  const guarded = await guardInitTestEnvironment(
    {
      projectId: 'list-scoped-operations-map-test',
      firestore: {
        host: 'localhost',
        port: 8081,
        rules:
          'rules_version = "2"; service cloud.firestore { match /{d=**} { allow read, write: if true; } }',
      },
    },
    'list-scoped-operations-map',
  )
  testEnv = guarded.env
  available = guarded.available
  if (!available) return
  adminApp = initializeApp({ projectId: 'list-scoped-operations-map-test' }, 'list-scoped-ops')
  adminDb = getFirestore(adminApp)
})

beforeEach(async () => {
  if (!available || !testEnv) return
  await testEnv.clearFirestore()
})

afterAll(async () => {
  await testEnv?.cleanup()
  await deleteApp(adminApp)
  if (originalEmulatorHost === undefined) {
    delete process.env.FIRESTORE_EMULATOR_HOST
  } else {
    process.env.FIRESTORE_EMULATOR_HOST = originalEmulatorHost
  }
})

describe('listScopedOperationsMapCore', () => {
  itif(available)(
    'returns municipal scoped incidents and excludes out-of-scope reports',
    async () => {
      await seedScopedReport({
        reportId: 'rep-muni',
        municipalityId: 'daet',
        municipalityLabel: 'Daet',
        agencyIds: ['bfp-daet'],
      })
      await seedScopedReport({
        reportId: 'rep-other-muni',
        municipalityId: 'mercedes',
        municipalityLabel: 'Mercedes',
        agencyIds: ['bfp-mercedes'],
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
    },
  )

  itif(available)('returns agency scoped incidents and excludes out-of-scope reports', async () => {
    await seedScopedReport({
      reportId: 'rep-agency',
      municipalityId: 'mercedes',
      municipalityLabel: 'Mercedes',
      agencyIds: ['bfp-daet'],
    })
    await seedScopedReport({
      reportId: 'rep-other-agency',
      municipalityId: 'mercedes',
      municipalityLabel: 'Mercedes',
      agencyIds: ['bfp-not-daet'],
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

  itif(available)('rejects a caller without a scoped admin role', async () => {
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

  itif(available)('rejects a municipal_admin missing municipalityId', async () => {
    await expect(
      listScopedOperationsMapCore(adminDb, {
        uid: 'muni-admin-1',
        claims: {
          role: 'municipal_admin',
          accountStatus: 'active',
        },
      }),
    ).rejects.toMatchObject({ code: 'permission-denied' })
  })

  itif(available)('rejects an agency_admin missing agencyId', async () => {
    await expect(
      listScopedOperationsMapCore(adminDb, {
        uid: 'agency-admin-1',
        claims: {
          role: 'agency_admin',
          accountStatus: 'active',
        },
      }),
    ).rejects.toMatchObject({ code: 'permission-denied' })
  })
})
