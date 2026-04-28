import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'
import * as bcrypt from 'bcryptjs'
import type { Auth } from 'firebase-admin/auth'
import type { Firestore } from 'firebase-admin/firestore'

const mockBigQuery = vi.hoisted(() => {
  const tables = new Map<string, Record<string, unknown>[]>()
  return {
    tables,
    reset() {
      tables.clear()
    },
    rowsFor(tableKey: string) {
      return tables.get(tableKey) ?? []
    },
  }
})

const mockSendMassAlertFcm = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ successCount: 0, failureCount: 0, batchCount: 0 }),
)

const dbState = vi.hoisted(() => ({
  current: undefined as Firestore | undefined,
}))
const authState = vi.hoisted(() => ({
  current: undefined as MemoryAuth | undefined,
}))

vi.mock('firebase-functions/v2/https', () => ({
  onCall: vi.fn((_opts: unknown, fn: unknown) => fn),
  HttpsError: class HttpsError extends Error {
    code: string
    constructor(code: string, message: string) {
      super(message)
      this.code = code
    }
  },
}))

vi.mock('firebase-functions/v2/scheduler', () => ({
  onSchedule: vi.fn((_opts: unknown, fn: unknown) => fn),
}))

vi.mock('firebase-admin/database', () => ({
  getDatabase: vi.fn(() => ({})),
}))

vi.mock('../../admin-init.js', () => ({
  get adminDb() {
    return dbState.current
  },
}))

vi.mock('firebase-admin/firestore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('firebase-admin/firestore')>()
  return {
    ...actual,
    getFirestore: vi.fn(() => dbState.current),
  }
})

vi.mock('firebase-admin/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('firebase-admin/auth')>()
  return {
    ...actual,
    getAuth: vi.fn(() => authState.current),
  }
})

vi.mock('../../services/fcm-mass-send.js', () => ({
  sendMassAlertFcm: mockSendMassAlertFcm,
}))

vi.mock('@google-cloud/bigquery', () => ({
  BigQuery: class {
    dataset(datasetName: string) {
      return {
        table(tableName: string) {
          const key = `${datasetName}.${tableName}`
          return {
            insert(rows: Record<string, unknown>[]) {
              const existing = mockBigQuery.tables.get(key) ?? []
              existing.push(...rows)
              mockBigQuery.tables.set(key, existing)
              return Promise.resolve()
            },
            query() {
              return Promise.resolve([mockBigQuery.rowsFor(key)])
            },
          }
        },
      }
    }
  },
}))

import { declareEmergency } from '../../callables/declare-emergency.js'
import { initiateBreakGlassCore, deactivateBreakGlassCore } from '../../callables/break-glass.js'
import { forwardMassAlertToNDRRMCCore } from '../../callables/mass-alert.js'
import { sweepExpiredBreakGlassSessions } from '../../triggers/sweep-expired-break-glass-sessions.js'
import { streamAuditEvent } from '../../services/audit-stream.js'
import { CAMARINES_NORTE_MUNICIPALITIES } from '@bantayog/shared-validators'

const CODE_A = 'alpha-bravo-123'
const CODE_B = 'charlie-delta-456'
const SALT = 'phase7-drill-salt'
const TS = 1713350400000

let hashedA: string
let hashedB: string

type DocData = Record<string, unknown>
type QueryOp = '==' | '<' | '<=' | '>' | '>=' | 'in'
interface Filter {
  field: string
  op: QueryOp
  value: unknown
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function matchesFilter(data: DocData, filter: Filter): boolean {
  const current = data[filter.field]
  switch (filter.op) {
    case '==':
      return current === filter.value
    case '<':
      return (
        typeof current === 'number' && typeof filter.value === 'number' && current < filter.value
      )
    case '<=':
      return (
        typeof current === 'number' && typeof filter.value === 'number' && current <= filter.value
      )
    case '>':
      return (
        typeof current === 'number' && typeof filter.value === 'number' && current > filter.value
      )
    case '>=':
      return (
        typeof current === 'number' && typeof filter.value === 'number' && current >= filter.value
      )
    case 'in':
      return Array.isArray(filter.value) && filter.value.includes(current)
    default:
      return false
  }
}

class MemoryDocRef {
  constructor(
    private readonly store: MemoryFirestore,
    public readonly collectionName: string,
    public readonly id: string,
  ) {}

  get(): Promise<MemoryDocSnap> {
    return Promise.resolve(
      new MemoryDocSnap(this, this.store.readDoc(this.collectionName, this.id)),
    )
  }

  set(data: DocData, options?: { merge?: boolean }): Promise<void> {
    this.store.writeDoc(this.collectionName, this.id, data, options?.merge === true)
    return Promise.resolve()
  }

  update(data: DocData): Promise<void> {
    this.store.updateDoc(this.collectionName, this.id, data)
    return Promise.resolve()
  }
}

class MemoryDocSnap {
  constructor(
    public readonly ref: MemoryDocRef,
    private readonly dataValue: DocData | undefined,
  ) {}

  get exists(): boolean {
    return this.dataValue !== undefined
  }

  data(): DocData | undefined {
    return this.dataValue === undefined ? undefined : clone(this.dataValue)
  }
}

class MemoryQuerySnap {
  constructor(public readonly docs: MemoryDocSnap[]) {}
}

class MemoryQuery {
  constructor(
    protected readonly store: MemoryFirestore,
    protected readonly collectionName: string,
    protected readonly filters: Filter[] = [],
  ) {}

  where(field: string, op: QueryOp, value: unknown): MemoryQuery {
    return new MemoryQuery(this.store, this.collectionName, [...this.filters, { field, op, value }])
  }

  get(): Promise<MemoryQuerySnap> {
    const docs = this.store.findDocs(this.collectionName, this.filters).map(({ id, data }) => {
      const ref = new MemoryDocRef(this.store, this.collectionName, id)
      return new MemoryDocSnap(ref, data)
    })
    return Promise.resolve(new MemoryQuerySnap(docs))
  }
}

class MemoryCollectionRef extends MemoryQuery {
  doc(id: string): MemoryDocRef {
    return new MemoryDocRef(this.store, this.collectionName, id)
  }

  override get(): Promise<MemoryQuerySnap> {
    return super.get()
  }
}

class MemoryTransaction {
  constructor(private readonly store: MemoryFirestore) {}

  get(refOrQuery: MemoryDocRef | MemoryQuery): Promise<MemoryDocSnap | MemoryQuerySnap> {
    return refOrQuery.get()
  }

  set(ref: MemoryDocRef, data: DocData, options?: { merge?: boolean }): Promise<void> {
    return ref.set(data, options)
  }

  update(ref: MemoryDocRef, data: DocData): Promise<void> {
    return ref.update(data)
  }
}

class MemoryFirestore {
  private readonly collections = new Map<string, Map<string, DocData>>()

  collection(name: string): MemoryCollectionRef {
    return new MemoryCollectionRef(this, name)
  }

  doc(path: string): MemoryDocRef {
    const parts = path.split('/')
    if (parts.length !== 2) {
      throw new Error(`Unsupported doc path: ${path}`)
    }
    return this.collection(parts[0] ?? '').doc(parts[1] ?? '')
  }

  runTransaction<T>(callback: (tx: MemoryTransaction) => Promise<T>): Promise<T> {
    return callback(new MemoryTransaction(this))
  }

  readDoc(collectionName: string, id: string): DocData | undefined {
    return this.collections.get(collectionName)?.get(id)
  }

  writeDoc(collectionName: string, id: string, data: DocData, merge: boolean): void {
    let collection = this.collections.get(collectionName)
    if (!collection) {
      collection = new Map<string, DocData>()
      this.collections.set(collectionName, collection)
    }
    const next = merge ? { ...(collection.get(id) ?? {}), ...clone(data) } : clone(data)
    collection.set(id, next)
  }

  updateDoc(collectionName: string, id: string, data: DocData): void {
    const collection = this.collections.get(collectionName)
    if (!collection?.has(id)) {
      throw new Error(`Missing document: ${collectionName}/${id}`)
    }
    collection.set(id, { ...(collection.get(id) ?? {}), ...clone(data) })
  }

  findDocs(collectionName: string, filters: Filter[]): { id: string; data: DocData }[] {
    const collection = this.collections.get(collectionName)
    if (!collection) return []
    const rows: { id: string; data: DocData }[] = []
    for (const [id, data] of collection.entries()) {
      if (filters.every((filter) => matchesFilter(data, filter))) {
        rows.push({ id, data })
      }
    }
    return rows
  }
}

interface AuthUser {
  uid: string
  customClaims?: Record<string, unknown>
}

class MemoryAuth {
  private readonly users = new Map<string, AuthUser>()

  seedUser(uid: string, customClaims: Record<string, unknown>): void {
    this.users.set(uid, { uid, customClaims: clone(customClaims) })
  }

  getUser(uid: string): Promise<AuthUser> {
    const user = this.users.get(uid)
    if (!user) {
      throw new Error(`Missing user: ${uid}`)
    }
    return Promise.resolve(clone(user))
  }

  setCustomUserClaims(uid: string, customClaims: Record<string, unknown>): Promise<void> {
    const existing = this.users.get(uid)
    if (!existing) {
      throw new Error(`Missing user: ${uid}`)
    }
    this.users.set(uid, { uid, customClaims: clone(customClaims) })
    return Promise.resolve()
  }
}

function makeHarness(): { db: MemoryFirestore; auth: MemoryAuth } {
  const db = new MemoryFirestore()
  const auth = new MemoryAuth()
  dbState.current = db as unknown as Firestore
  authState.current = auth
  return { db, auth }
}

function seedBreakGlassConfig(db: MemoryFirestore): Promise<void> {
  return db.doc('system_config/break_glass_config').set({ hashedCodes: [hashedA, hashedB] })
}

function seedConsent(
  db: MemoryFirestore,
  id: string,
  municipalityId: string,
  phone: string,
  followUpConsent: boolean,
  locale: 'en' | 'tl' = 'tl',
): Promise<void> {
  return db
    .collection('report_sms_consent')
    .doc(id)
    .set({
      reportId: `report-${id}`,
      phone,
      locale,
      smsConsent: true,
      municipalityId,
      followUpConsent,
      createdAt: TS,
      schemaVersion: 1,
    })
}

function seedBreakGlassUser(auth: MemoryAuth, uid: string): void {
  auth.seedUser(uid, {
    role: 'superadmin',
    municipalityId: 'daet',
    active: true,
  })
}

beforeAll(async () => {
  hashedA = await bcrypt.hash(CODE_A, 10)
  hashedB = await bcrypt.hash(CODE_B, 10)
})

beforeEach(() => {
  mockBigQuery.reset()
  mockSendMassAlertFcm.mockClear()
  process.env.SMS_MSISDN_HASH_SALT = SALT
})

describe('Phase 7.C drill', () => {
  it('covers break-glass initiation, audit stream, auto-expiry, and manual deactivate', async () => {
    const { db, auth } = makeHarness()
    await seedBreakGlassConfig(db)
    seedBreakGlassUser(auth, 'u1')
    seedBreakGlassUser(auth, 'u2')

    const initial = await initiateBreakGlassCore(
      db as unknown as Firestore,
      auth as unknown as Auth,
      { codeA: CODE_A, codeB: CODE_B, reason: 'tabletop drill' },
      { uid: 'u1' },
    )

    const initiatedSnap = await db.collection('breakglass_events').doc(initial.sessionId).get()
    expect(initiatedSnap.exists).toBe(true)
    expect(initiatedSnap.data()?.action).toBe('initiated')
    expect(mockBigQuery.rowsFor('bantayog_audit.streaming_events')).toHaveLength(1)
    expect(mockBigQuery.rowsFor('bantayog_audit.streaming_events')[0]?.eventType).toBe(
      'break_glass_initiated',
    )

    await db
      .collection('breakglass_events')
      .doc(initial.sessionId)
      .update({
        expiresAt: TS - 1000,
      })
    const sweepStart = Date.now()
    await sweepExpiredBreakGlassSessions(undefined as never, undefined as never)
    const sweepEnd = Date.now()

    const expiredSnap = await db.collection('breakglass_events').doc(initial.sessionId).get()
    expect(expiredSnap.data()?.action).toBe('auto_expired')
    expect(expiredSnap.data()?.expiredAt).toBeGreaterThanOrEqual(sweepStart)
    expect(expiredSnap.data()?.expiredAt).toBeLessThanOrEqual(sweepEnd)
    expect((await auth.getUser('u1')).customClaims?.breakGlassSession).toBeUndefined()
    expect((await auth.getUser('u1')).customClaims?.breakGlassSessionId).toBeUndefined()

    const second = await initiateBreakGlassCore(
      db as unknown as Firestore,
      auth as unknown as Auth,
      { codeA: CODE_A, codeB: CODE_B, reason: 'manual deactivate drill' },
      { uid: 'u2' },
    )
    const deactivateStart = Date.now()
    await deactivateBreakGlassCore(db as unknown as Firestore, auth as unknown as Auth, {
      uid: 'u2',
      claims: (await auth.getUser('u2')).customClaims ?? {},
    })
    const deactivateEnd = Date.now()

    const deactivatedSnap = await db.collection('breakglass_events').doc(second.sessionId).get()
    expect(deactivatedSnap.data()?.action).toBe('deactivated')
    expect(deactivatedSnap.data()?.deactivatedAt).toBeGreaterThanOrEqual(deactivateStart)
    expect(deactivatedSnap.data()?.deactivatedAt).toBeLessThanOrEqual(deactivateEnd)
    expect((await auth.getUser('u2')).customClaims?.breakGlassSession).toBeUndefined()
  })

  it('covers the NDRRMC escalation tabletop transition', async () => {
    const { db } = makeHarness()
    const requestId = 'req-1'
    await db
      .collection('mass_alert_requests')
      .doc(requestId)
      .set({
        requestedByMunicipality: 'daet',
        requestedByUid: 'u1',
        body: 'Need escalation',
        targetType: 'municipality',
        targetGeometryRef: JSON.stringify({ municipalityIds: ['daet'] }),
        severity: 'high',
        estimatedReach: 0,
        evidencePack: { linkedReportIds: ['r-1'] },
        status: 'pending_ndrrmc_review',
        createdAt: TS,
        schemaVersion: 1,
      })

    const result = await forwardMassAlertToNDRRMCCore(
      db as unknown as Firestore,
      { requestId, forwardMethod: 'email', ndrrmcRecipient: 'ndrrmc@example.com' },
      {
        uid: 'super-1',
        claims: { role: 'provincial_superadmin', active: true, auth_time: Math.floor(TS / 1000) },
      },
    )

    expect(result.success).toBe(true)
    const snap = await db.collection('mass_alert_requests').doc(requestId).get()
    expect(snap.data()?.status).toBe('forwarded_to_ndrrmc')
    expect(snap.data()?.forwardMethod).toBe('email')
    expect(snap.data()?.ndrrmcRecipient).toBe('ndrrmc@example.com')
  })

  it('covers declareEmergency alert write and SMS outbox transaction', async () => {
    const { db } = makeHarness()
    await seedConsent(db, 'c1', CAMARINES_NORTE_MUNICIPALITIES[0]!.id, '+639170000001', true, 'tl')
    await seedConsent(db, 'c2', CAMARINES_NORTE_MUNICIPALITIES[1]!.id, '+639170000002', true, 'en')
    await seedConsent(db, 'c3', CAMARINES_NORTE_MUNICIPALITIES[0]!.id, '+639170000003', false, 'tl')

    const request = {
      auth: {
        uid: 'super-1',
        token: {
          role: 'superadmin',
          firebase: { sign_in_second_factor: 'totp' },
        },
      },
      data: {
        hazardType: 'typhoon',
        affectedMunicipalityIds: [
          CAMARINES_NORTE_MUNICIPALITIES[0]!.id,
          CAMARINES_NORTE_MUNICIPALITIES[1]!.id,
        ],
        message: 'Signal no. 3 raised',
      },
    }

    await declareEmergency(request as never, undefined as never)
    const alertDocs = await db.collection('alerts').get()
    expect(alertDocs.docs).toHaveLength(1)
    const alertDoc = alertDocs.docs[0]!
    const alertId = alertDoc.data()?.alertId as string
    expect(alertDoc.data()?.alertType).toBe('emergency')
    expect(alertDoc.data()?.hazardType).toBe('typhoon')
    expect(mockSendMassAlertFcm).toHaveBeenCalledWith(db, {
      municipalityIds: [
        CAMARINES_NORTE_MUNICIPALITIES[0]!.id,
        CAMARINES_NORTE_MUNICIPALITIES[1]!.id,
      ],
      title: 'Emergency: typhoon',
      body: 'Signal no. 3 raised',
    })

    const outboxSnap = await db
      .collection('sms_outbox')
      .where('massAlertRequestId', '==', alertId)
      .get()

    expect(outboxSnap.docs).toHaveLength(2)
    const recipients = outboxSnap.docs.map((doc) => doc.data()?.recipientMsisdn)
    expect(recipients).toEqual(expect.arrayContaining(['+639170000001', '+639170000002']))
  })

  it('streams audit events into the mocked BigQuery table', async () => {
    const now = Date.now()
    await streamAuditEvent({
      eventType: 'phase7_drill_audit',
      actorUid: 'super-1',
      sessionId: 'session-1',
      targetDocumentId: 'doc-1',
      metadata: { drill: true },
      occurredAt: now,
    })

    const rows = mockBigQuery.rowsFor('bantayog_audit.streaming_events')
    expect(rows).toHaveLength(1)
    expect(rows[0]).toEqual(
      expect.objectContaining({
        eventType: 'phase7_drill_audit',
        actorUid: 'super-1',
        sessionId: 'session-1',
        targetDocumentId: 'doc-1',
        occurredAt: now,
      }),
    )
  })

  it('enforces MFA on the declareEmergency callable', async () => {
    const { db } = makeHarness()

    await expect(
      declareEmergency(
        {
          auth: {
            uid: 'super-1',
            token: {
              role: 'superadmin',
            },
          },
          data: {
            hazardType: 'typhoon',
            affectedMunicipalityIds: [CAMARINES_NORTE_MUNICIPALITIES[0]!.id],
            message: 'Signal no. 1',
          },
        } as never,
        undefined as never,
      ),
    ).rejects.toThrow('mfa_required')

    await declareEmergency(
      {
        auth: {
          uid: 'super-1',
          token: {
            role: 'superadmin',
            firebase: { sign_in_second_factor: 'totp' },
          },
        },
        data: {
          hazardType: 'typhoon',
          affectedMunicipalityIds: [CAMARINES_NORTE_MUNICIPALITIES[0]!.id],
          message: 'Signal no. 1',
        },
      } as never,
      undefined as never,
    )

    const snap = await db.collection('alerts').get()
    expect(snap.docs).toHaveLength(1)
    expect(snap.docs[0]!.data()?.alertType).toBe('emergency')
  })
})
