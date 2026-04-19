import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import { collection, doc, getDocs, setDoc, addDoc } from 'firebase/firestore'
import { afterAll, beforeAll, describe, it } from 'vitest'
import { authed, createTestEnv } from '../helpers/rules-harness.js'
import { seedActiveAccount, staffClaims, ts } from '../helpers/seed-factories.js'

let env: Awaited<ReturnType<typeof createTestEnv>>

beforeAll(async () => {
  env = await createTestEnv('demo-phase-2-coordination')
  await seedActiveAccount(env, {
    uid: 'daet-admin',
    role: 'municipal_admin',
    municipalityId: 'daet',
  })
})

afterAll(async () => {
  await env.cleanup()
})

describe('coordination collections rules', () => {
  describe('command_threads', () => {
    it('command threads are callable-only reads', async () => {
      const db = authed(env, 'daet-admin', staffClaims({ role: 'municipal_admin' }))
      await assertFails(getDocs(collection(db, 'command_threads')))
    })

    it('command threads are callable-only writes', async () => {
      const db = authed(env, 'daet-admin', staffClaims({ role: 'municipal_admin' }))
      await assertFails(
        addDoc(collection(db, 'command_threads'), {
          municipalityId: 'daet',
          initiatedBy: 'admin',
          initiatedAt: ts,
          schemaVersion: 1,
        }),
      )
    })
  })

  describe('shift_handoffs', () => {
    it('shift handoffs are callable-only reads', async () => {
      const db = authed(env, 'daet-admin', staffClaims({ role: 'municipal_admin' }))
      await assertFails(getDocs(collection(db, 'shift_handoffs')))
    })

    it('shift handoffs are callable-only writes', async () => {
      const db = authed(env, 'daet-admin', staffClaims({ role: 'municipal_admin' }))
      await assertFails(
        addDoc(collection(db, 'shift_handoffs'), {
          municipalityId: 'daet',
          fromResponderUid: 'resp-1',
          toResponderUid: 'resp-2',
          handedOffAt: ts,
        }),
      )
    })
  })

  describe('mass_alert_requests', () => {
    it('mass alert requests are callable-only reads', async () => {
      const db = authed(env, 'daet-admin', staffClaims({ role: 'municipal_admin' }))
      await assertFails(getDocs(collection(db, 'mass_alert_requests')))
    })

    it('mass alert requests are callable-only writes', async () => {
      const db = authed(env, 'daet-admin', staffClaims({ role: 'municipal_admin' }))
      await assertFails(
        addDoc(collection(db, 'mass_alert_requests'), {
          requestedBy: 'admin',
          scope: 'municipality',
          targetIds: ['daet'],
          message: 'Test alert',
          requestedAt: ts,
        }),
      )
    })
  })

  describe('command_channel_threads (callable)', () => {
    it('command channel threads are callable-only reads', async () => {
      const db = authed(env, 'daet-admin', staffClaims({ role: 'municipal_admin' }))
      await assertFails(getDocs(collection(db, 'command_channel_threads')))
    })

    it('command channel threads are callable-only writes', async () => {
      const db = authed(env, 'daet-admin', staffClaims({ role: 'municipal_admin' }))
      await assertFails(
        addDoc(collection(db, 'command_channel_threads'), {
          threadId: 'thread-1',
          municipalityId: 'daet',
          createdAt: ts,
        }),
      )
    })
  })

  describe('command_channel_messages (callable)', () => {
    it('command channel messages are callable-only reads', async () => {
      const db = authed(env, 'daet-admin', staffClaims({ role: 'municipal_admin' }))
      await assertFails(getDocs(collection(db, 'command_channel_messages')))
    })

    it('command channel messages are callable-only writes', async () => {
      const db = authed(env, 'daet-admin', staffClaims({ role: 'municipal_admin' }))
      await assertFails(
        addDoc(collection(db, 'command_channel_messages'), {
          threadId: 'thread-1',
          message: 'test',
          sentBy: 'admin',
          sentAt: ts,
        }),
      )
    })
  })

  describe('agency_assistance_requests (callable)', () => {
    it('agency assistance requests are callable-only reads', async () => {
      const db = authed(env, 'daet-admin', staffClaims({ role: 'municipal_admin' }))
      await assertFails(getDocs(collection(db, 'agency_assistance_requests')))
    })

    it('agency assistance requests are callable-only writes', async () => {
      const db = authed(env, 'daet-admin', staffClaims({ role: 'municipal_admin' }))
      await assertFails(
        addDoc(collection(db, 'agency_assistance_requests'), {
          dispatchId: 'dispatch-1',
          agencyId: 'bfp',
          requestType: 'BFP',
          requestedAt: ts,
        }),
      )
    })

    it('muni admin can read own municipality requests', async () => {
      const unauthed = env.unauthenticatedContext().firestore()
      await setDoc(doc(unauthed, 'agency_assistance_requests/req-1'), {
        requestedByMunicipality: 'daet',
        targetAgencyId: 'bfp-daet',
        dispatchId: 'd-1',
        requestType: 'BFP',
        requestedAt: ts,
      })
      const db = authed(
        env,
        'daet-admin',
        staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
      )
      await assertSucceeds(getDocs(collection(db, 'agency_assistance_requests')))
    })
  })
})
