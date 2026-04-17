import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { afterAll, beforeAll, describe, it } from 'vitest'
import { authed, createTestEnv } from '../helpers/rules-harness.js'
import { seedActiveAccount, staffClaims, ts } from '../helpers/seed-factories.js'

let env: Awaited<ReturnType<typeof createTestEnv>>

beforeAll(async () => {
  env = await createTestEnv('demo-coordination-rules')

  // Active superadmin
  await seedActiveAccount(env, {
    uid: 'super-1',
    role: 'provincial_superadmin',
    permittedMunicipalityIds: ['daet', 'san-vicente'],
  })

  // Muni admin for daet
  await seedActiveAccount(env, {
    uid: 'daet-admin',
    role: 'municipal_admin',
    municipalityId: 'daet',
  })

  // Muni admin for san-vicente (different municipality)
  await seedActiveAccount(env, {
    uid: 'sv-admin',
    role: 'municipal_admin',
    municipalityId: 'san-vicente',
  })

  // Agency admin for PDRRMO
  await seedActiveAccount(env, {
    uid: 'pdrrmo-admin',
    role: 'agency_admin',
    agencyId: 'pdrrmo',
  })

  // Agency admin for BFP (different agency)
  await seedActiveAccount(env, {
    uid: 'bfp-admin',
    role: 'agency_admin',
    agencyId: 'bfp',
  })

  // Responder (for role checks)
  await seedActiveAccount(env, {
    uid: 'responder-1',
    role: 'responder',
  })

  // Seed coordination docs
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()

    // agency_assistance_requests
    await setDoc(doc(db, 'agency_assistance_requests/req-1'), {
      requestedByMunicipality: 'daet',
      targetAgencyId: 'pdrrmo',
      status: 'pending',
      createdAt: ts,
    })

    // command_channel_threads
    await setDoc(doc(db, 'command_channel_threads/thread-1'), {
      participantUids: ['daet-admin', 'pdrrmo-admin', 'super-1'],
      subject: 'flood response',
      createdAt: ts,
    })

    // command_channel_messages (child of thread-1)
    await setDoc(doc(db, 'command_channel_messages/msg-1'), {
      threadId: 'thread-1',
      body: 'Need additional boats',
      senderUid: 'daet-admin',
      sentAt: ts,
    })

    // mass_alert_requests
    await setDoc(doc(db, 'mass_alert_requests/alert-1'), {
      requestedByMunicipality: 'daet',
      alertType: 'typhoon',
      status: 'pending',
      createdAt: ts,
    })

    // shift_handoffs
    await setDoc(doc(db, 'shift_handoffs/handoff-1'), {
      fromUid: 'daet-admin',
      toUid: 'sv-admin',
      municipalityId: 'daet',
      handedOverAt: ts,
    })
  })
})

afterAll(async () => {
  await env.cleanup()
})

// ============================================================
// agency_assistance_requests
// ============================================================

describe('agency_assistance_requests rules', () => {
  it('requesting muni admin reads (positive)', async () => {
    const db = authed(
      env,
      'daet-admin',
      staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
    )
    await assertSucceeds(getDoc(doc(db, 'agency_assistance_requests/req-1')))
  })

  it('target agency admin reads (positive)', async () => {
    const db = authed(
      env,
      'pdrrmo-admin',
      staffClaims({ role: 'agency_admin', agencyId: 'pdrrmo' }),
    )
    await assertSucceeds(getDoc(doc(db, 'agency_assistance_requests/req-1')))
  })

  it('other agency admin fails', async () => {
    const db = authed(env, 'bfp-admin', staffClaims({ role: 'agency_admin', agencyId: 'bfp' }))
    await assertFails(getDoc(doc(db, 'agency_assistance_requests/req-1')))
  })

  it('superadmin reads (positive)', async () => {
    const db = authed(env, 'super-1', staffClaims({ role: 'provincial_superadmin' }))
    await assertSucceeds(getDoc(doc(db, 'agency_assistance_requests/req-1')))
  })

  it('any client write fails', async () => {
    const db = authed(env, 'super-1', staffClaims({ role: 'provincial_superadmin' }))
    await assertFails(
      setDoc(doc(db, 'agency_assistance_requests/new-req'), {
        requestedByMunicipality: 'daet',
        targetAgencyId: 'pdrrmo',
        status: 'pending',
        createdAt: ts,
      }),
    )
  })
})

// ============================================================
// command_channel_threads
// ============================================================

describe('command_channel_threads rules', () => {
  it('participant reads (positive)', async () => {
    const db = authed(
      env,
      'daet-admin',
      staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
    )
    await assertSucceeds(getDoc(doc(db, 'command_channel_threads/thread-1')))
  })

  it('non-participant with muni admin role fails', async () => {
    const db = authed(
      env,
      'sv-admin',
      staffClaims({ role: 'municipal_admin', municipalityId: 'san-vicente' }),
    )
    await assertFails(getDoc(doc(db, 'command_channel_threads/thread-1')))
  })

  it('responder role fails even if in participantUids', async () => {
    // Responder is not in participantUids, but even if they were,
    // the rule requires isMuniAdmin || isAgencyAdmin || isSuperadmin
    const db = authed(env, 'responder-1', staffClaims({ role: 'responder' }))
    await assertFails(getDoc(doc(db, 'command_channel_threads/thread-1')))
  })

  it('any client write fails', async () => {
    const db = authed(env, 'super-1', staffClaims({ role: 'provincial_superadmin' }))
    await assertFails(
      setDoc(doc(db, 'command_channel_threads/new-thread'), {
        participantUids: ['super-1'],
        subject: 'test',
        createdAt: ts,
      }),
    )
  })
})

// ============================================================
// command_channel_messages
// ============================================================

describe('command_channel_messages rules', () => {
  it('participant of the parent thread reads (positive)', async () => {
    const db = authed(
      env,
      'daet-admin',
      staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
    )
    await assertSucceeds(getDoc(doc(db, 'command_channel_messages/msg-1')))
  })

  it('non-participant fails', async () => {
    const db = authed(
      env,
      'sv-admin',
      staffClaims({ role: 'municipal_admin', municipalityId: 'san-vicente' }),
    )
    await assertFails(getDoc(doc(db, 'command_channel_messages/msg-1')))
  })

  it('any client write fails', async () => {
    const db = authed(env, 'super-1', staffClaims({ role: 'provincial_superadmin' }))
    await assertFails(
      setDoc(doc(db, 'command_channel_messages/new-msg'), {
        threadId: 'thread-1',
        body: 'unauthorized',
        senderUid: 'super-1',
        sentAt: ts,
      }),
    )
  })
})

// ============================================================
// mass_alert_requests
// ============================================================

describe('mass_alert_requests rules', () => {
  it('superadmin reads (positive)', async () => {
    const db = authed(env, 'super-1', staffClaims({ role: 'provincial_superadmin' }))
    await assertSucceeds(getDoc(doc(db, 'mass_alert_requests/alert-1')))
  })

  it('muni admin whose muni matches requestedByMunicipality reads (positive)', async () => {
    const db = authed(
      env,
      'daet-admin',
      staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
    )
    await assertSucceeds(getDoc(doc(db, 'mass_alert_requests/alert-1')))
  })

  it('different muni admin fails', async () => {
    const db = authed(
      env,
      'sv-admin',
      staffClaims({ role: 'municipal_admin', municipalityId: 'san-vicente' }),
    )
    await assertFails(getDoc(doc(db, 'mass_alert_requests/alert-1')))
  })

  it('any client write fails', async () => {
    const db = authed(env, 'super-1', staffClaims({ role: 'provincial_superadmin' }))
    await assertFails(
      setDoc(doc(db, 'mass_alert_requests/new-alert'), {
        requestedByMunicipality: 'daet',
        alertType: 'typhoon',
        status: 'pending',
        createdAt: ts,
      }),
    )
  })
})

// ============================================================
// shift_handoffs
// ============================================================

describe('shift_handoffs rules', () => {
  it('fromUid reads (positive)', async () => {
    const db = authed(
      env,
      'daet-admin',
      staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
    )
    await assertSucceeds(getDoc(doc(db, 'shift_handoffs/handoff-1')))
  })

  it('toUid reads (positive)', async () => {
    const db = authed(
      env,
      'sv-admin',
      staffClaims({ role: 'municipal_admin', municipalityId: 'san-vicente' }),
    )
    await assertSucceeds(getDoc(doc(db, 'shift_handoffs/handoff-1')))
  })

  it('superadmin reads (positive)', async () => {
    const db = authed(env, 'super-1', staffClaims({ role: 'provincial_superadmin' }))
    await assertSucceeds(getDoc(doc(db, 'shift_handoffs/handoff-1')))
  })

  it('unrelated user read fails', async () => {
    const db = authed(
      env,
      'pdrrmo-admin',
      staffClaims({ role: 'agency_admin', agencyId: 'pdrrmo' }),
    )
    await assertFails(getDoc(doc(db, 'shift_handoffs/handoff-1')))
  })

  it('any client write fails', async () => {
    const db = authed(env, 'super-1', staffClaims({ role: 'provincial_superadmin' }))
    await assertFails(
      setDoc(doc(db, 'shift_handoffs/new-handoff'), {
        fromUid: 'super-1',
        toUid: 'daet-admin',
        municipalityId: 'daet',
        handedOverAt: ts,
      }),
    )
  })
})
