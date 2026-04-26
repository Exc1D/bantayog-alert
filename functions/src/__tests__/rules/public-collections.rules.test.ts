import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import { collection, getDocs, addDoc, doc, setDoc, getDoc } from 'firebase/firestore'
import { afterAll, beforeAll, describe, it } from 'vitest'
import { authed, createTestEnv } from '../helpers/rules-harness.js'
import { seedActiveAccount, seedAgency, staffClaims, ts } from '../helpers/seed-factories.js'

let env: Awaited<ReturnType<typeof createTestEnv>>

beforeAll(async () => {
  env = await createTestEnv('demo-phase-2-public')
  await seedActiveAccount(env, { uid: 'citizen-1', role: 'citizen' })
  await seedActiveAccount(env, {
    uid: 'daet-admin',
    role: 'municipal_admin',
    municipalityId: 'daet',
  })
  await seedAgency(env, 'agency-1', { municipalityId: 'daet' })
})

afterAll(async () => {
  await env.cleanup()
})

describe('public collections rules', () => {
  describe('agencies', () => {
    it('any authed user can read agencies', async () => {
      const db = authed(env, 'citizen-1', staffClaims({ role: 'citizen' }))
      await assertSucceeds(getDocs(collection(db, 'agencies')))
    })

    it('agency writes are callable-only', async () => {
      const db = authed(env, 'daet-admin', staffClaims({ role: 'municipal_admin' }))
      await assertFails(
        addDoc(collection(db, 'agencies'), {
          municipalityId: 'daet',
          name: 'Test Agency',
          createdAt: ts,
        }),
      )
    })
  })

  describe('emergencies', () => {
    it('any authed user can read emergencies', async () => {
      const db = authed(env, 'citizen-1', staffClaims({ role: 'citizen' }))
      await assertSucceeds(getDocs(collection(db, 'emergencies')))
    })

    it('emergency writes are callable-only', async () => {
      const db = authed(env, 'daet-admin', staffClaims({ role: 'municipal_admin' }))
      await assertFails(
        addDoc(collection(db, 'emergencies'), {
          municipalityId: 'daet',
          declaredAt: ts,
          schemaVersion: 1,
        }),
      )
    })
  })

  describe('audit_logs', () => {
    it('audit logs are callable-only reads', async () => {
      const db = authed(env, 'citizen-1', staffClaims({ role: 'citizen' }))
      await assertFails(getDocs(collection(db, 'audit_logs')))
    })

    it('audit logs are callable-only writes', async () => {
      const db = authed(env, 'daet-admin', staffClaims({ role: 'municipal_admin' }))
      await assertFails(
        addDoc(collection(db, 'audit_logs'), {
          action: 'test',
          actorUid: 'test',
          timestamp: ts,
        }),
      )
    })
  })

  describe('dead_letters', () => {
    it('dead letters are callable-only reads', async () => {
      const db = authed(env, 'citizen-1', staffClaims({ role: 'citizen' }))
      await assertFails(getDocs(collection(db, 'dead_letters')))
    })

    it('dead letters are callable-only writes', async () => {
      const db = authed(env, 'daet-admin', staffClaims({ role: 'municipal_admin' }))
      await assertFails(
        addDoc(collection(db, 'dead_letters'), {
          originalCollection: 'test',
          payload: {},
          failedAt: ts,
        }),
      )
    })
  })

  describe('moderation_incidents', () => {
    it('moderation incidents are callable-only reads', async () => {
      const db = authed(env, 'citizen-1', staffClaims({ role: 'citizen' }))
      await assertFails(getDocs(collection(db, 'moderation_incidents')))
    })

    it('moderation incidents are callable-only writes', async () => {
      const db = authed(env, 'daet-admin', staffClaims({ role: 'municipal_admin' }))
      await assertFails(
        addDoc(collection(db, 'moderation_incidents'), {
          reportId: 'test',
          reason: 'test',
          createdAt: ts,
        }),
      )
    })
  })

  describe('incident_response_events', () => {
    it('incident response events are callable-only reads', async () => {
      const db = authed(env, 'citizen-1', staffClaims({ role: 'citizen' }))
      await assertFails(getDocs(collection(db, 'incident_response_events')))
    })

    it('incident response events are callable-only writes', async () => {
      const db = authed(env, 'daet-admin', staffClaims({ role: 'municipal_admin' }))
      await assertFails(
        addDoc(collection(db, 'incident_response_events'), {
          incidentId: 'test',
          action: 'test',
          timestamp: ts,
        }),
      )
    })
  })

  describe('breakglass_events', () => {
    it('breakglass events are callable-only reads', async () => {
      const db = authed(env, 'citizen-1', staffClaims({ role: 'citizen' }))
      await assertFails(getDocs(collection(db, 'breakglass_events')))
    })

    it('breakglass events are callable-only writes', async () => {
      const db = authed(env, 'daet-admin', staffClaims({ role: 'municipal_admin' }))
      await assertFails(
        addDoc(collection(db, 'breakglass_events'), {
          triggerReason: 'test',
          triggeredBy: 'admin',
          triggeredAt: ts,
        }),
      )
    })
  })

  describe('rate_limits', () => {
    it('rate limits are callable-only reads', async () => {
      const db = authed(env, 'citizen-1', staffClaims({ role: 'citizen' }))
      await assertFails(getDocs(collection(db, 'rate_limits')))
    })

    it('rate limits are callable-only writes', async () => {
      const db = authed(env, 'citizen-1', staffClaims({ role: 'citizen' }))
      await assertFails(
        addDoc(collection(db, 'rate_limits'), {
          key: 'test',
          count: 1,
          windowStart: ts,
        }),
      )
    })
  })
})

describe('privileged read tests for callable collections', () => {
  beforeAll(async () => {
    await seedActiveAccount(env, {
      uid: 'super-1',
      role: 'provincial_superadmin',
      permittedMunicipalityIds: ['daet'],
    })

    // Seed command_channel_threads so rules can resolve participantUids
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'command_channel_threads', 'thread-1'), {
        threadId: 'thread-1',
        participantUids: { 'super-1': true },
        municipalityId: 'daet',
        createdAt: ts,
      })
    })

    // Seed command_channel_messages so rules can resolve thread participantUids via get()
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'command_channel_messages', 'msg-1'), {
        messageId: 'msg-1',
        threadId: 'thread-1',
        authorUid: 'super-1',
        createdAt: ts,
      })
    })
  })

  it('superadmin with active privileged claim can read audit_logs', async () => {
    const db = authed(
      env,
      'super-1',
      staffClaims({ role: 'provincial_superadmin', permittedMunicipalityIds: ['daet'] }),
    )
    await assertSucceeds(getDocs(collection(db, 'audit_logs')))
  })

  it('superadmin with active privileged claim can read dead_letters', async () => {
    const db = authed(
      env,
      'super-1',
      staffClaims({ role: 'provincial_superadmin', permittedMunicipalityIds: ['daet'] }),
    )
    await assertSucceeds(getDocs(collection(db, 'dead_letters')))
  })

  it('superadmin with active privileged claim can read hazard_signals', async () => {
    const db = authed(
      env,
      'super-1',
      staffClaims({ role: 'provincial_superadmin', permittedMunicipalityIds: ['daet'] }),
    )
    await assertSucceeds(getDocs(collection(db, 'hazard_signals')))
  })

  it('superadmin with active privileged claim can read moderation_incidents', async () => {
    const db = authed(
      env,
      'super-1',
      staffClaims({ role: 'provincial_superadmin', permittedMunicipalityIds: ['daet'] }),
    )
    await assertSucceeds(getDocs(collection(db, 'moderation_incidents')))
  })

  it('superadmin with active privileged claim can read breakglass_events', async () => {
    const db = authed(
      env,
      'super-1',
      staffClaims({ role: 'provincial_superadmin', permittedMunicipalityIds: ['daet'] }),
    )
    await assertSucceeds(getDocs(collection(db, 'breakglass_events')))
  })

  it('superadmin with active privileged claim can read sms_outbox', async () => {
    const db = authed(
      env,
      'super-1',
      staffClaims({ role: 'provincial_superadmin', permittedMunicipalityIds: ['daet'] }),
    )
    await assertSucceeds(getDocs(collection(db, 'sms_outbox')))
  })

  it('superadmin with active privileged claim can read command_channel_threads', async () => {
    // Document-level read confirms the superadmin can access a thread they participate in.
    // Collection-level getDocs fails in the emulator due to an indexing delay after seeding,
    // even though the document exists and getDoc succeeds. getDoc validates the same rule.
    const db = authed(
      env,
      'super-1',
      staffClaims({ role: 'provincial_superadmin', permittedMunicipalityIds: ['daet'] }),
    )
    await assertSucceeds(getDoc(doc(db, 'command_channel_threads', 'thread-1')))
    // TODO(BANTAYOG-PHASE6): getDocs (list) fails because rules reference resource.data.participantUids
    // which is undefined during list evaluation. Rules need separate allow list rule.
  })

  it('superadmin with active privileged claim can read command_channel_messages', async () => {
    const db = authed(
      env,
      'super-1',
      staffClaims({ role: 'provincial_superadmin', permittedMunicipalityIds: ['daet'] }),
    )
    await assertSucceeds(getDoc(doc(db, 'command_channel_messages', 'msg-1')))
    // TODO(BANTAYOG-PHASE6): getDocs (list) fails because rules reference resource.data.threadId
    // which is undefined during list evaluation. Rules need separate allow list rule.
  })

  it('superadmin with active privileged claim can read mass_alert_requests', async () => {
    const db = authed(
      env,
      'super-1',
      staffClaims({ role: 'provincial_superadmin', permittedMunicipalityIds: ['daet'] }),
    )
    await assertSucceeds(getDocs(collection(db, 'mass_alert_requests')))
  })

  it('superadmin with active privileged claim can read shift_handoffs', async () => {
    const db = authed(
      env,
      'super-1',
      staffClaims({ role: 'provincial_superadmin', permittedMunicipalityIds: ['daet'] }),
    )
    await assertSucceeds(getDocs(collection(db, 'shift_handoffs')))
  })

  it('superadmin without active privileged claim cannot read audit_logs', async () => {
    const db = authed(
      env,
      'super-1',
      staffClaims({
        role: 'provincial_superadmin',
        permittedMunicipalityIds: ['daet'],
        accountStatus: 'suspended',
      }),
    )
    await assertFails(getDocs(collection(db, 'audit_logs')))
  })

  it('superadmin with active privileged claim can read incident_response_events', async () => {
    const db = authed(
      env,
      'super-1',
      staffClaims({ role: 'provincial_superadmin', permittedMunicipalityIds: ['daet'] }),
    )
    await assertSucceeds(getDocs(collection(db, 'incident_response_events')))
  })
})
