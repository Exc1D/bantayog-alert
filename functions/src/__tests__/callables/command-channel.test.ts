import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest'
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { setDoc, doc } from 'firebase/firestore'
import { Timestamp, type Firestore } from 'firebase-admin/firestore'

vi.mock('firebase-admin/database', () => ({ getDatabase: vi.fn(() => ({})) }))
let adminDb: Firestore
vi.mock('../../admin-init.js', () => ({
  get adminDb() {
    return adminDb
  },
}))

import { addCommandChannelMessageCore } from '../../callables/add-command-channel-message.js'

const ts = 1713350400000
let testEnv: RulesTestEnvironment

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'command-channel-test',
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
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  await testEnv?.cleanup()
})

async function seedThread(id: string, participants: string[]) {
  const participantUids = Object.fromEntries(participants.map((u) => [u, true]))
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'command_channel_threads', id), {
      threadId: id,
      reportId: 'r1',
      threadType: 'agency_assistance',
      subject: 'Test thread',
      participantUids,
      createdBy: 'daet-admin',
      createdAt: ts,
      updatedAt: ts,
      schemaVersion: 1,
    })
  })
}

const actor = {
  uid: 'daet-admin',
  claims: { role: 'municipal_admin', accountStatus: 'active', municipalityId: 'daet' },
}

describe('addCommandChannelMessage', () => {
  it('rejects a caller whose UID is not in thread participantUids', async () => {
    await seedThread('th1', ['bfp-admin'])
    await expect(
      addCommandChannelMessageCore(adminDb, {
        threadId: 'th1',
        body: 'Hello',
        actor,
        idempotencyKey: crypto.randomUUID(),
        now: Timestamp.fromMillis(ts),
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('rejects an empty body', async () => {
    await seedThread('th1', ['daet-admin'])
    await expect(
      addCommandChannelMessageCore(adminDb, {
        threadId: 'th1',
        body: '   ',
        actor,
        idempotencyKey: crypto.randomUUID(),
        now: Timestamp.fromMillis(ts),
      }),
    ).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' })
  })

  it('rejects body over 2000 chars', async () => {
    await seedThread('th1', ['daet-admin'])
    await expect(
      addCommandChannelMessageCore(adminDb, {
        threadId: 'th1',
        body: 'x'.repeat(2001),
        actor,
        idempotencyKey: crypto.randomUUID(),
        now: Timestamp.fromMillis(ts),
      }),
    ).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' })
  })

  it('writes message and updates thread.lastMessageAt', async () => {
    await seedThread('th1', ['daet-admin', 'bfp-admin'])
    await addCommandChannelMessageCore(adminDb, {
      threadId: 'th1',
      body: 'Units dispatched',
      actor,
      idempotencyKey: crypto.randomUUID(),
      now: Timestamp.fromMillis(ts),
    })
    const msgs = await adminDb
      .collection('command_channel_messages')
      .where('threadId', '==', 'th1')
      .get()
    expect(msgs.empty).toBe(false)
    expect(msgs.docs[0]?.data().body).toBe('Units dispatched')
    const thread = await adminDb.collection('command_channel_threads').doc('th1').get()
    expect(thread.data()?.lastMessageAt).toBe(ts)
  })
})
