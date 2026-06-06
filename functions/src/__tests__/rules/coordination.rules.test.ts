import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { collection, doc, getDoc, getDocs, setDoc, addDoc } from 'firebase/firestore'
import { afterAll, beforeAll, describe, it } from 'vitest'
import { authed, createTestEnvSafe } from '../helpers/rules-harness.js'
import { seedActiveAccount, staffClaims, ts } from '../helpers/seed-factories.js'

let env: RulesTestEnvironment | undefined

const itif = (condition: boolean) =>
  condition ||
  process.env.FIRESTORE_EMULATOR_HOST ||
  process.env.FIREBASE_DATABASE_EMULATOR_HOST ||
  process.env.FIREBASE_STORAGE_EMULATOR_HOST
    ? it
    : it.skip

beforeAll(async () => {
  env = await createTestEnvSafe('demo-phase-2-coordination')
  if (!env) return
  await seedActiveAccount(env, {
    uid: 'daet-admin',
    role: 'municipal_admin',
    municipalityId: 'daet',
  })
  await seedActiveAccount(env, {
    uid: 'other-admin',
    role: 'municipal_admin',
    municipalityId: 'mercedes',
  })
  await seedActiveAccount(env, {
    uid: 'bfp-daet-agency',
    role: 'agency_admin',
    municipalityId: 'daet',
    agencyId: 'bfp-daet',
  })
  await seedActiveAccount(env, {
    uid: 'pnp-daet-agency',
    role: 'agency_admin',
    municipalityId: 'daet',
    agencyId: 'pnp-daet',
  })
  await seedActiveAccount(env, {
    uid: 'super-admin',
    role: 'provincial_superadmin',
  })
})

afterAll(async () => {
  await env?.cleanup()
})

describe('coordination collections rules', () => {
  describe('command_threads', () => {
    itif(!!env)('command threads are callable-only reads', async () => {
      const db = authed(env, 'daet-admin', staffClaims({ role: 'municipal_admin' }))
      await assertFails(getDocs(collection(db, 'command_threads')))
    })

    itif(!!env)('command threads are callable-only writes', async () => {
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

  describe('command_channel_threads (callable)', () => {
    itif(!!env)('command channel threads are callable-only reads', async () => {
      const db = authed(env, 'daet-admin', staffClaims({ role: 'municipal_admin' }))
      await assertFails(getDocs(collection(db, 'command_channel_threads')))
    })

    itif(!!env)('command channel threads are callable-only writes', async () => {
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
    itif(!!env)('command channel messages are callable-only reads', async () => {
      const db = authed(env, 'daet-admin', staffClaims({ role: 'municipal_admin' }))
      await assertFails(getDocs(collection(db, 'command_channel_messages')))
    })

    itif(!!env)('command channel messages are callable-only writes', async () => {
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
    itif(!!env)('agency assistance requests are callable-only reads', async () => {
      const db = authed(env, 'daet-admin', staffClaims({ role: 'municipal_admin' }))
      await assertFails(getDocs(collection(db, 'agency_assistance_requests')))
    })

    itif(!!env)('agency assistance requests are callable-only writes', async () => {
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

    itif(!!env)('muni admin can read own municipality requests', async () => {
      await env!.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'agency_assistance_requests', 'req-1'), {
          requestedByMunicipality: 'daet',
          targetAgencyId: 'bfp-daet',
          dispatchId: 'd-1',
          requestType: 'BFP',
          requestedAt: ts,
        })
      })
      const db = authed(
        env,
        'daet-admin',
        staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
      )
      await assertSucceeds(getDoc(doc(db, 'agency_assistance_requests', 'req-1')))
    })

    itif(!!env)('agency admin reads request matching their agencyId (positive)', async () => {
      await env!.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'agency_assistance_requests', 'req-agency-match'), {
          requestedByMunicipality: 'daet',
          targetAgencyId: 'bfp-daet',
          requestType: 'BFP',
          requestedAt: ts,
        })
      })
      const db = authed(
        env,
        'bfp-daet-agency',
        staffClaims({ role: 'agency_admin', municipalityId: 'daet', agencyId: 'bfp-daet' }),
      )
      await assertSucceeds(getDoc(doc(db, 'agency_assistance_requests', 'req-agency-match')))
    })

    itif(!!env)(
      'agency admin denied when agencyId does not match targetAgencyId (negative)',
      async () => {
        const db = authed(
          env,
          'pnp-daet-agency',
          staffClaims({ role: 'agency_admin', municipalityId: 'daet', agencyId: 'pnp-daet' }),
        )
        // req-agency-match has targetAgencyId: 'bfp-daet', pnp-daet should be denied
        await assertFails(getDoc(doc(db, 'agency_assistance_requests', 'req-agency-match')))
      },
    )

    itif(!!env)('superadmin reads any agency assistance request (positive)', async () => {
      const db = authed(env, 'super-admin', staffClaims({ role: 'provincial_superadmin' }))
      await assertSucceeds(getDoc(doc(db, 'agency_assistance_requests', 'req-agency-match')))
    })

    itif(!!env)('citizen read denied (negative)', async () => {
      const db = authed(env, 'citizen-1', staffClaims({ role: 'citizen' }))
      await assertFails(getDoc(doc(db, 'agency_assistance_requests', 'req-agency-match')))
    })
  })

  describe('command_channel_threads/messages participant lookup', () => {
    beforeAll(async () => {
      await env!.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'command_channel_threads', 'thread-1'), {
          threadId: 'thread-1',
          reportId: 'report-1',
          threadType: 'agency_assistance',
          subject: 'Need help',
          participantUids: { 'daet-admin': true },
          createdBy: 'daet-admin',
          createdAt: ts,
          updatedAt: ts,
          schemaVersion: 1,
        })

        await setDoc(doc(ctx.firestore(), 'command_channel_messages', 'msg-1'), {
          threadId: 'thread-1',
          authorUid: 'daet-admin',
          authorRole: 'municipal_admin',
          body: 'hello',
          createdAt: ts,
          schemaVersion: 1,
        })
      })
    })

    itif(!!env)('allows participant to read thread', async () => {
      const db = authed(
        env,
        'daet-admin',
        staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
      )
      await assertSucceeds(getDoc(doc(db, 'command_channel_threads', 'thread-1')))
    })

    itif(!!env)('denies non-participant from reading thread', async () => {
      const db = authed(
        env,
        'other-admin',
        staffClaims({ role: 'municipal_admin', municipalityId: 'mercedes' }),
      )
      await assertFails(getDoc(doc(db, 'command_channel_threads', 'thread-1')))
    })

    itif(!!env)('allows participant to read message through parent thread lookup', async () => {
      const db = authed(
        env,
        'daet-admin',
        staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
      )
      await assertSucceeds(getDoc(doc(db, 'command_channel_messages', 'msg-1')))
    })

    itif(!!env)('denies non-participant from reading message', async () => {
      const db = authed(
        env,
        'other-admin',
        staffClaims({ role: 'municipal_admin', municipalityId: 'mercedes' }),
      )
      await assertFails(getDoc(doc(db, 'command_channel_messages', 'msg-1')))
    })
  })
})

describe('command_channel_threads/messages — participant map key lookup', () => {
  beforeAll(async () => {
    await env!.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'command_channel_threads', 'thread-2'), {
        threadId: 'thread-2',
        reportId: 'report-1',
        threadType: 'agency_assistance',
        subject: 'Need help',
        participantUids: { 'daet-admin': true },
        createdBy: 'daet-admin',
        createdAt: ts,
        updatedAt: ts,
        schemaVersion: 1,
      })

      await setDoc(doc(ctx.firestore(), 'command_channel_messages', 'msg-2'), {
        threadId: 'thread-2',
        message: 'hello',
        sentBy: 'daet-admin',
        sentAt: ts,
        schemaVersion: 1,
      })
    })
  })

  itif(!!env)('allows participant to read thread', async () => {
    const db = authed(
      env,
      'daet-admin',
      staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
    )
    await assertSucceeds(getDoc(doc(db, 'command_channel_threads', 'thread-2')))
  })

  itif(!!env)('denies non-participant from reading thread', async () => {
    const db = authed(
      env,
      'other-admin',
      staffClaims({ role: 'municipal_admin', municipalityId: 'mercedes' }),
    )
    await assertFails(getDoc(doc(db, 'command_channel_threads', 'thread-2')))
  })

  itif(!!env)(
    'allows participant to read a message when parent thread participantUids contains uid',
    async () => {
      const db = authed(
        env,
        'daet-admin',
        staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
      )
      await assertSucceeds(getDoc(doc(db, 'command_channel_messages', 'msg-2')))
    },
  )

  itif(!!env)('denies non-participant from reading a message', async () => {
    const db = authed(
      env,
      'other-admin',
      staffClaims({ role: 'municipal_admin', municipalityId: 'mercedes' }),
    )
    await assertFails(getDoc(doc(db, 'command_channel_messages', 'msg-2')))
  })
})
