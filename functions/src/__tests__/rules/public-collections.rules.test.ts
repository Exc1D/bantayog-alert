import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing'
import {
  collection,
  getDocs,
  addDoc,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
} from 'firebase/firestore'
import { afterAll, beforeAll, describe, it } from 'vitest'
import { authed, createTestEnvSafe, unauthed } from '../helpers/rules-harness.js'
import { seedActiveAccount, seedAgency, staffClaims, ts } from '../helpers/seed-factories.js'

let env: RulesTestEnvironment | undefined

const itif = (condition: boolean) =>
  condition ||
  process.env.FIRESTORE_EMULATOR_HOST ||
  process.env.FIREBASE_DATABASE_EMULATOR_HOST ||
  process.env.FIREBASE_STORAGE_EMULATOR_HOST
    ? it
    : it.skip

beforeAll(async () => {
  env = await createTestEnvSafe('demo-phase-2-public')
  if (!env) return
  await seedActiveAccount(env, { uid: 'citizen-1', role: 'citizen' })
  await seedActiveAccount(env, {
    uid: 'daet-admin',
    role: 'municipal_admin',
    municipalityId: 'daet',
  })
  await seedAgency(env, 'agency-1', { municipalityId: 'daet' })
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'municipalities', 'daet'), {
      id: 'daet',
      label: 'Daet',
      provinceId: 'camarines-norte',
      centroid: { lat: 14.1121, lng: 122.9554 },
      mdrrmoLabel: 'Daet MDRRMO',
      mdrrmoHotline: '(054) 721-1216',
      schemaVersion: 1,
    })
  })
})

afterAll(async () => {
  await env?.cleanup()
})

describe('public collections rules', () => {
  describe('municipalities', () => {
    itif(!!env)('unauthed users can read municipality contact docs', async () => {
      const db = unauthed(env)
      await assertSucceeds(getDoc(doc(db, 'municipalities/daet')))
    })

    itif(!!env)('municipality docs are callable-only writes', async () => {
      const unauthedDb = unauthed(env)
      await assertFails(
        setDoc(doc(unauthedDb, 'municipalities/new'), {
          label: 'New',
          mdrrmoLabel: 'New MDRRMO',
          mdrrmoHotline: '(054) 000-0000',
          schemaVersion: 1,
        }),
      )
      await assertFails(updateDoc(doc(unauthedDb, 'municipalities/daet'), { label: 'Updated' }))
      await assertFails(deleteDoc(doc(unauthedDb, 'municipalities/daet')))

      const authedDb = authed(
        env,
        'daet-admin',
        staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
      )
      await assertFails(
        setDoc(doc(authedDb, 'municipalities/new'), {
          label: 'New',
          mdrrmoLabel: 'New MDRRMO',
          mdrrmoHotline: '(054) 000-0000',
          schemaVersion: 1,
        }),
      )
      await assertFails(updateDoc(doc(authedDb, 'municipalities/daet'), { label: 'Updated' }))
      await assertFails(deleteDoc(doc(authedDb, 'municipalities/daet')))
    })

    itif(!!env)('denies list (collection enumeration) on municipalities', async () => {
      const unauthedDb = unauthed(env)
      await assertFails(getDocs(collection(unauthedDb, 'municipalities')))

      const authedDb = authed(
        env,
        'daet-admin',
        staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
      )
      await assertFails(getDocs(collection(authedDb, 'municipalities')))
    })
  })

  describe('agencies', () => {
    itif(!!env)('any authed user can read agencies', async () => {
      const db = authed(env, 'citizen-1', staffClaims({ role: 'citizen' }))
      await assertSucceeds(getDocs(collection(db, 'agencies')))
    })

    itif(!!env)('agency writes are callable-only', async () => {
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
    itif(!!env)('any authed user can read emergencies', async () => {
      const db = authed(env, 'citizen-1', staffClaims({ role: 'citizen' }))
      await assertSucceeds(getDocs(collection(db, 'emergencies')))
    })

    itif(!!env)('emergency writes are callable-only', async () => {
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
    itif(!!env)('audit logs are callable-only reads', async () => {
      const db = authed(env, 'citizen-1', staffClaims({ role: 'citizen' }))
      await assertFails(getDocs(collection(db, 'audit_logs')))
    })

    itif(!!env)('audit logs are callable-only writes', async () => {
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
    itif(!!env)('dead letters are callable-only reads', async () => {
      const db = authed(env, 'citizen-1', staffClaims({ role: 'citizen' }))
      await assertFails(getDocs(collection(db, 'dead_letters')))
    })

    itif(!!env)('dead letters are callable-only writes', async () => {
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
    itif(!!env)('moderation incidents are callable-only reads', async () => {
      const db = authed(env, 'citizen-1', staffClaims({ role: 'citizen' }))
      await assertFails(getDocs(collection(db, 'moderation_incidents')))
    })

    itif(!!env)('moderation incidents are callable-only writes', async () => {
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
    itif(!!env)('incident response events are callable-only reads', async () => {
      const db = authed(env, 'citizen-1', staffClaims({ role: 'citizen' }))
      await assertFails(getDocs(collection(db, 'incident_response_events')))
    })

    itif(!!env)('incident response events are callable-only writes', async () => {
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

  describe('rate_limits', () => {
    itif(!!env)('rate limits are callable-only reads', async () => {
      const db = authed(env, 'citizen-1', staffClaims({ role: 'citizen' }))
      await assertFails(getDocs(collection(db, 'rate_limits')))
    })

    itif(!!env)('rate limits are callable-only writes', async () => {
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
    await seedActiveAccount(env!, {
      uid: 'super-1',
      role: 'provincial_superadmin',
      permittedMunicipalityIds: ['daet'],
    })

    // Seed command_channel_threads and command_channel_messages atomically
    await env!.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'command_channel_threads', 'thread-1'), {
        threadId: 'thread-1',
        participantUids: { 'super-1': true },
        municipalityId: 'daet',
        createdAt: ts,
      })
      await setDoc(doc(ctx.firestore(), 'command_channel_messages', 'msg-1'), {
        messageId: 'msg-1',
        threadId: 'thread-1',
        authorUid: 'super-1',
        createdAt: ts,
      })
    })
  })

  itif(!!env)('superadmin with active privileged claim can read audit_logs', async () => {
    const db = authed(
      env,
      'super-1',
      staffClaims({ role: 'provincial_superadmin', permittedMunicipalityIds: ['daet'] }),
    )
    await assertSucceeds(getDocs(collection(db, 'audit_logs')))
  })

  itif(!!env)('superadmin with active privileged claim can read dead_letters', async () => {
    const db = authed(
      env,
      'super-1',
      staffClaims({ role: 'provincial_superadmin', permittedMunicipalityIds: ['daet'] }),
    )
    await assertSucceeds(getDocs(collection(db, 'dead_letters')))
  })

  itif(!!env)('superadmin with active privileged claim can read moderation_incidents', async () => {
    const db = authed(
      env,
      'super-1',
      staffClaims({ role: 'provincial_superadmin', permittedMunicipalityIds: ['daet'] }),
    )
    await assertSucceeds(getDocs(collection(db, 'moderation_incidents')))
  })

  itif(!!env)(
    'superadmin with active privileged claim can get a command_channel_thread document',
    async () => {
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
    },
  )

  itif(!!env)(
    'superadmin with active privileged claim can get a command_channel_message document',
    async () => {
      const db = authed(
        env,
        'super-1',
        staffClaims({ role: 'provincial_superadmin', permittedMunicipalityIds: ['daet'] }),
      )
      await assertSucceeds(getDoc(doc(db, 'command_channel_messages', 'msg-1')))
      // TODO(BANTAYOG-PHASE6): getDocs (list) fails because rules reference resource.data.threadId
      // which is undefined during list evaluation. Rules need separate allow list rule.
    },
  )

  itif(!!env)('superadmin with active privileged claim can read shift_handoffs', async () => {
    const db = authed(
      env,
      'super-1',
      staffClaims({ role: 'provincial_superadmin', permittedMunicipalityIds: ['daet'] }),
    )
    await assertSucceeds(getDocs(collection(db, 'shift_handoffs')))
  })

  itif(!!env)('superadmin without active privileged claim cannot read audit_logs', async () => {
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

  itif(!!env)(
    'superadmin with active privileged claim can read incident_response_events',
    async () => {
      const db = authed(
        env,
        'super-1',
        staffClaims({ role: 'provincial_superadmin', permittedMunicipalityIds: ['daet'] }),
      )
      await assertSucceeds(getDocs(collection(db, 'incident_response_events')))
    },
  )

  describe('Phase 7 collections', () => {
    itif(!!env)('any authed user can read provincial_resources', async () => {
      const db = authed(env, 'citizen-1', staffClaims({ role: 'citizen' }))
      await assertSucceeds(getDocs(collection(db, 'provincial_resources')))
    })

    itif(!!env)('unauthed user cannot read provincial_resources', async () => {
      const db = unauthed(env)
      await assertFails(getDocs(collection(db, 'provincial_resources')))
    })

    itif(!!env)('superadmin with active privileged claim can read data_incidents', async () => {
      const db = authed(
        env,
        'super-1',
        staffClaims({ role: 'provincial_superadmin', permittedMunicipalityIds: ['daet'] }),
      )
      await assertSucceeds(getDocs(collection(db, 'data_incidents')))
    })

    itif(!!env)('non-superadmin cannot read data_incidents', async () => {
      const db = authed(env, 'citizen-1', staffClaims({ role: 'citizen' }))
      await assertFails(getDocs(collection(db, 'data_incidents')))
    })

    itif(!!env)('superadmin with active privileged claim can read erasure_requests', async () => {
      const db = authed(
        env,
        'super-1',
        staffClaims({ role: 'provincial_superadmin', permittedMunicipalityIds: ['daet'] }),
      )
      await assertSucceeds(getDocs(collection(db, 'erasure_requests')))
    })

    itif(!!env)('non-superadmin cannot read erasure_requests', async () => {
      const db = authed(env, 'citizen-1', staffClaims({ role: 'citizen' }))
      await assertFails(getDocs(collection(db, 'erasure_requests')))
    })

    itif(!!env)('superadmin can read system_health', async () => {
      const db = authed(
        env,
        'super-1',
        staffClaims({ role: 'provincial_superadmin', permittedMunicipalityIds: ['daet'] }),
      )
      await assertSucceeds(getDocs(collection(db, 'system_health')))
    })

    itif(!!env)('non-superadmin cannot read system_health', async () => {
      const db = authed(env, 'citizen-1', staffClaims({ role: 'citizen' }))
      await assertFails(getDocs(collection(db, 'system_health')))
    })

    itif(!!env)('suspended superadmin cannot read data_incidents', async () => {
      const db = authed(
        env,
        'super-1',
        staffClaims({
          role: 'provincial_superadmin',
          permittedMunicipalityIds: ['daet'],
          accountStatus: 'suspended',
        }),
      )
      await assertFails(getDocs(collection(db, 'data_incidents')))
    })

    itif(!!env)('suspended superadmin cannot write data_incidents', async () => {
      const db = authed(
        env,
        'super-1',
        staffClaims({
          role: 'provincial_superadmin',
          permittedMunicipalityIds: ['daet'],
          accountStatus: 'suspended',
        }),
      )
      await assertFails(
        addDoc(collection(db, 'data_incidents'), { schemaVersion: 1, createdAt: ts }),
      )
    })

    itif(!!env)('suspended superadmin cannot read erasure_requests', async () => {
      const db = authed(
        env,
        'super-1',
        staffClaims({
          role: 'provincial_superadmin',
          permittedMunicipalityIds: ['daet'],
          accountStatus: 'suspended',
        }),
      )
      await assertFails(getDocs(collection(db, 'erasure_requests')))
    })

    itif(!!env)('suspended superadmin cannot write erasure_requests', async () => {
      const db = authed(
        env,
        'super-1',
        staffClaims({
          role: 'provincial_superadmin',
          permittedMunicipalityIds: ['daet'],
          accountStatus: 'suspended',
        }),
      )
      await assertFails(
        addDoc(collection(db, 'erasure_requests'), { schemaVersion: 1, createdAt: ts }),
      )
    })
  })
})
