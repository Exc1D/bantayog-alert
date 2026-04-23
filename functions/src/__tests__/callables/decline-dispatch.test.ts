/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from 'vitest'
import { Timestamp, type Firestore } from 'firebase-admin/firestore'

vi.mock('firebase-admin/database', () => ({
  getDatabase: vi.fn(() => ({})),
}))

import { declineDispatchCore } from '../../callables/decline-dispatch.js'

type DocData = Record<string, any>

class MemorySnapshot {
  constructor(
    public readonly exists: boolean,
    private readonly value: DocData | undefined,
  ) {}

  data(): DocData | undefined {
    return this.value
  }
}

class MemoryDocumentReference {
  constructor(
    private readonly db: MemoryFirestore,
    private readonly path: string,
  ) {}

  get(): Promise<MemorySnapshot> {
    const value = this.db.store.get(this.path)
    return Promise.resolve(new MemorySnapshot(value !== undefined, value))
  }

  set(data: DocData): Promise<void> {
    this.db.store.set(this.path, { ...data })
    return Promise.resolve()
  }

  update(patch: DocData): Promise<void> {
    const current = this.db.store.get(this.path)
    if (current === undefined) {
      throw new Error(`Missing document at ${this.path}`)
    }
    this.db.store.set(this.path, { ...current, ...patch })
    return Promise.resolve()
  }
}

class MemoryQuery {
  constructor(
    private readonly db: MemoryFirestore,
    private readonly collectionName: string,
    private readonly field: string,
    private readonly op: string,
    private readonly value: unknown,
  ) {}

  get(): Promise<{ docs: { data: () => DocData | undefined }[] }> {
    if (this.op !== '==') {
      throw new Error(`Unsupported operator ${this.op}`)
    }

    const prefix = `${this.collectionName}/`
    const docs = [...this.db.store.entries()]
      .filter(([path, data]) => path.startsWith(prefix) && data[this.field] === this.value)
      .map(([, data]) => ({ data: () => data }))

    return Promise.resolve({ docs })
  }
}

class MemoryCollectionReference {
  constructor(
    private readonly db: MemoryFirestore,
    private readonly name: string,
  ) {}

  doc(id?: string): MemoryDocumentReference {
    return new MemoryDocumentReference(this.db, `${this.name}/${id ?? crypto.randomUUID()}`)
  }

  where(field: string, op: string, value: unknown): MemoryQuery {
    return new MemoryQuery(this.db, this.name, field, op, value)
  }
}

class MemoryTransaction {
  constructor(private readonly db: MemoryFirestore) {}

  get(ref: MemoryDocumentReference): Promise<MemorySnapshot> {
    return ref.get()
  }

  set(ref: MemoryDocumentReference, data: DocData): Promise<void> {
    return ref.set(data)
  }

  update(ref: MemoryDocumentReference, patch: DocData): Promise<void> {
    return ref.update(patch)
  }
}

class MemoryFirestore {
  readonly store = new Map<string, DocData>()

  collection(name: string): MemoryCollectionReference {
    return new MemoryCollectionReference(this, name)
  }

  async runTransaction<T>(op: (tx: MemoryTransaction) => Promise<T>): Promise<T> {
    return await op(new MemoryTransaction(this))
  }
}

function createDb(): Firestore {
  return new MemoryFirestore() as unknown as Firestore
}

async function seedPendingDispatch(
  db: Firestore,
  dispatchId: string,
  responderUid: string,
): Promise<void> {
  await db
    .collection('dispatches')
    .doc(dispatchId)
    .set({
      dispatchId,
      reportId: 'report-1',
      status: 'pending',
      assignedTo: {
        uid: responderUid,
        agencyId: 'bfp-daet',
        municipalityId: 'daet',
      },
      dispatchedAt: 1713350400000,
      lastStatusAt: 1713350400000,
      schemaVersion: 1,
    })
}

describe('declineDispatchCore', () => {
  it('declines a pending dispatch with a required reason', async () => {
    const db = createDb()
    await seedPendingDispatch(db, 'dispatch-1', 'r1')

    const result = await declineDispatchCore(db, {
      dispatchId: 'dispatch-1',
      declineReason: 'Already handling another incident',
      idempotencyKey: crypto.randomUUID(),
      actor: { uid: 'r1', claims: { role: 'responder', municipalityId: 'daet' } },
      now: Timestamp.now(),
    })

    expect(result.status).toBe('declined')

    const dispatch = (await db.collection('dispatches').doc('dispatch-1').get()).data()
    expect(dispatch).toMatchObject({
      status: 'declined',
      declineReason: 'Already handling another incident',
    })

    const evts = await db
      .collection('dispatch_events')
      .where('dispatchId', '==', 'dispatch-1')
      .get()
    expect(evts.docs).toHaveLength(1)
    const [firstEvt] = evts.docs
    expect(firstEvt).toBeDefined()
    expect(firstEvt!.data()).toMatchObject({
      from: 'pending',
      to: 'declined',
      actorUid: 'r1',
    })
  })

  it('rejects when declineReason is blank', async () => {
    const db = createDb()
    await seedPendingDispatch(db, 'dispatch-2', 'r1')

    await expect(
      declineDispatchCore(db, {
        dispatchId: 'dispatch-2',
        declineReason: '   ',
        idempotencyKey: crypto.randomUUID(),
        actor: { uid: 'r1', claims: { role: 'responder', municipalityId: 'daet' } },
        now: Timestamp.now(),
      }),
    ).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' })
  })

  it('rejects when dispatch is not pending', async () => {
    const db = createDb()
    await db
      .collection('dispatches')
      .doc('dispatch-3')
      .set({
        dispatchId: 'dispatch-3',
        reportId: 'report-1',
        status: 'accepted',
        assignedTo: {
          uid: 'r1',
          agencyId: 'bfp-daet',
          municipalityId: 'daet',
        },
        dispatchedAt: 1713350400000,
        lastStatusAt: 1713350400000,
        schemaVersion: 1,
      })

    await expect(
      declineDispatchCore(db, {
        dispatchId: 'dispatch-3',
        declineReason: 'Too far away',
        idempotencyKey: crypto.randomUUID(),
        actor: { uid: 'r1', claims: { role: 'responder', municipalityId: 'daet' } },
        now: Timestamp.now(),
      }),
    ).rejects.toMatchObject({ code: 'INVALID_STATUS_TRANSITION' })
  })
})
