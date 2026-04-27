import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { setDoc, doc } from 'firebase/firestore'
import { type Firestore, Timestamp } from 'firebase-admin/firestore'

vi.mock('firebase-admin/database', () => ({ getDatabase: vi.fn(() => ({})) }))
let adminDb: Firestore
let collectionSpy: ReturnType<typeof vi.spyOn>
vi.mock('../../admin-init.js', () => ({
  get adminDb() {
    return adminDb
  },
}))
vi.mock('firebase-functions/v2/scheduler', () => ({
  onSchedule: vi.fn((_opts: unknown, fn: unknown) => fn),
}))

import { analyticsSnapshotWriterCore } from '../../scheduled/analytics-snapshot-writer.js'

const ts = 1713350400000
let testEnv: RulesTestEnvironment

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'analytics-test',
    firestore: {
      host: 'localhost',
      port: 8081,
      rules:
        'rules_version = "2"; service cloud.firestore { match /{d=**} { allow read, write: if true; } }',
    },
  })
  adminDb = testEnv.unauthenticatedContext().firestore() as unknown as Firestore

  // Intercept all .collection() calls — return mock for report_ops,
  // pass through everything else (analytics_snapshots writes need real path).
  const originalCollection = adminDb.collection.bind(adminDb)
  collectionSpy = vi.spyOn(adminDb, 'collection').mockImplementation((collectionPath: string) => {
    const collRef = originalCollection(collectionPath)
    if (collectionPath !== 'report_ops') return collRef

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
})

beforeEach(async () => {
  await testEnv.clearFirestore()
})
afterAll(async () => {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  if (collectionSpy) collectionSpy.mockRestore()
  await testEnv.cleanup()
})

async function seedReportOp({
  id,
  municipalityId,
  status,
  severity,
}: {
  id: string
  municipalityId: string
  status: string
  severity: string
}) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'report_ops', id), {
      municipalityId,
      status,
      severity,
      reportType: 'flood',
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

const dateStr = '2026-04-24'

describe('analyticsSnapshotWriter', () => {
  it('writes a snapshot doc for each municipality', async () => {
    await analyticsSnapshotWriterCore(adminDb, { date: dateStr, now: Timestamp.fromMillis(ts) })
    const snap = await adminDb
      .collection('analytics_snapshots')
      .doc(dateStr)
      .collection('daet')
      .doc('summary')
      .get()
    expect(snap.exists).toBe(true)
  })

  it('counts reports by status correctly', async () => {
    await seedReportOp({ id: 'r1', municipalityId: 'daet', status: 'new', severity: 'high' })
    await seedReportOp({ id: 'r2', municipalityId: 'daet', status: 'new', severity: 'medium' })
    await seedReportOp({ id: 'r3', municipalityId: 'daet', status: 'verified', severity: 'high' })
    await analyticsSnapshotWriterCore(adminDb, { date: dateStr, now: Timestamp.fromMillis(ts) })
    const snap = await adminDb
      .collection('analytics_snapshots')
      .doc(dateStr)
      .collection('daet')
      .doc('summary')
      .get()
    const data = snap.data() as unknown as {
      reportsByStatus: Record<string, number>
      reportsBySeverity: Record<string, number>
    }
    expect(data.reportsByStatus.new).toBe(2)
    expect(data.reportsByStatus.verified).toBe(1)
  })

  it('counts reports by severity correctly', async () => {
    await seedReportOp({ id: 'r1', municipalityId: 'daet', status: 'new', severity: 'high' })
    await seedReportOp({ id: 'r2', municipalityId: 'daet', status: 'new', severity: 'medium' })
    await seedReportOp({
      id: 'r3',
      municipalityId: 'daet',
      status: 'verified',
      severity: 'critical',
    })
    await analyticsSnapshotWriterCore(adminDb, { date: dateStr, now: Timestamp.fromMillis(ts) })
    const snap = await adminDb
      .collection('analytics_snapshots')
      .doc(dateStr)
      .collection('daet')
      .doc('summary')
      .get()
    const data = snap.data() as unknown as {
      reportsByStatus: Record<string, number>
      reportsBySeverity: Record<string, number>
    }
    expect(data.reportsBySeverity.high).toBe(1)
    expect(data.reportsBySeverity.medium).toBe(1)
    expect(data.reportsBySeverity.critical).toBe(1)
  })

  it('writes a province-wide aggregate for superadmin scope', async () => {
    await analyticsSnapshotWriterCore(adminDb, { date: dateStr, now: Timestamp.fromMillis(ts) })
    const provinceSnap = await adminDb
      .collection('analytics_snapshots')
      .doc(dateStr)
      .collection('province')
      .doc('summary')
      .get()
    expect(provinceSnap.exists).toBe(true)
  })

  it('is idempotent — re-running overwrites, not duplicates', async () => {
    await seedReportOp({ id: 'r1', municipalityId: 'daet', status: 'new', severity: 'high' })
    await analyticsSnapshotWriterCore(adminDb, { date: dateStr, now: Timestamp.fromMillis(ts) })
    await analyticsSnapshotWriterCore(adminDb, { date: dateStr, now: Timestamp.fromMillis(ts) })
    const snap = await adminDb
      .collection('analytics_snapshots')
      .doc(dateStr)
      .collection('daet')
      .doc('summary')
      .get()
    const data = snap.data() as unknown as {
      reportsByStatus: Record<string, number>
    }
    expect(data.reportsByStatus.new).toBe(1)
  })

  it('handles a municipality with zero reports without erroring', async () => {
    await expect(
      analyticsSnapshotWriterCore(adminDb, { date: dateStr, now: Timestamp.fromMillis(ts) }),
    ).resolves.not.toThrow()
  })

  it('computes resolvedToday and avgResponseTimeMinutes for province summary', async () => {
    const dayStart = new Date(`${dateStr}T00:00:00.000Z`).getTime()
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'report_ops', 'resolved-r1'), {
        municipalityId: 'daet',
        status: 'resolved',
        severity: 'high',
        reportType: 'flood',
        createdAt: dayStart + 3600000,
        updatedAt: dayStart + 7200000,
        resolvedAt: dayStart + 7200000,
        agencyIds: [],
        activeResponderCount: 0,
        requiresLocationFollowUp: false,
        visibility: { scope: 'municipality', sharedWith: [] },
        schemaVersion: 1,
      })
      await setDoc(doc(ctx.firestore(), 'report_ops', 'resolved-r2'), {
        municipalityId: 'daet',
        status: 'resolved',
        severity: 'medium',
        reportType: 'flood',
        createdAt: dayStart + 7200000,
        updatedAt: dayStart + 18000000,
        resolvedAt: dayStart + 18000000,
        agencyIds: [],
        activeResponderCount: 0,
        requiresLocationFollowUp: false,
        visibility: { scope: 'municipality', sharedWith: [] },
        schemaVersion: 1,
      })
    })

    await analyticsSnapshotWriterCore(adminDb, { date: dateStr, now: Timestamp.fromMillis(ts) })

    const provinceSnap = await adminDb
      .collection('analytics_snapshots')
      .doc(dateStr)
      .collection('province')
      .doc('summary')
      .get()
    const data = provinceSnap.data()!
    expect(data.resolvedToday).toBe(2)
    expect(data.avgResponseTimeMinutes).toBeCloseTo(120, 0)
  })
})
