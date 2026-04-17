import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { afterAll, beforeAll, describe, it } from 'vitest'
import { authed, createTestEnv, unauthed } from '../helpers/rules-harness.js'
import { seedActiveAccount, staffClaims, ts } from '../helpers/seed-factories.js'

let env: Awaited<ReturnType<typeof createTestEnv>>

beforeAll(async () => {
  env = await createTestEnv('demo-public-collections')

  // Citizens
  await seedActiveAccount(env, { uid: 'citizen-1', role: 'citizen', municipalityId: 'daet' })

  // Superadmin (active)
  await seedActiveAccount(env, {
    uid: 'super-1',
    role: 'provincial_superadmin',
    permittedMunicipalityIds: ['daet'],
  })

  // Superadmin (suspended — tests isActivePrivileged gate)
  await seedActiveAccount(env, {
    uid: 'super-suspended',
    role: 'provincial_superadmin',
    permittedMunicipalityIds: ['daet'],
    accountStatus: 'suspended',
  })

  // Municipal admin
  await seedActiveAccount(env, {
    uid: 'daet-admin',
    role: 'municipal_admin',
    municipalityId: 'daet',
  })

  // Agency admin
  await seedActiveAccount(env, {
    uid: 'bfp-admin',
    role: 'agency_admin',
    agencyId: 'bfp',
    municipalityId: 'daet',
  })

  // Responder
  await seedActiveAccount(env, {
    uid: 'resp-1',
    role: 'responder',
    agencyId: 'bfp',
    municipalityId: 'daet',
  })

  // Seed alert and emergency docs for read tests
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'alerts/alert-1'), {
      title: 'Test alert',
      body: 'Body',
      severity: 'info',
      publishedAt: ts,
      publishedBy: 'bootstrap',
    })
    await setDoc(doc(db, 'emergencies/emerg-1'), {
      title: 'Test emergency',
      severity: 'critical',
      publishedAt: ts,
    })
    await setDoc(doc(db, 'agencies/bfp'), { name: 'BFP', region: 'Region V', schemaVersion: 1 })
    await setDoc(doc(db, 'hazard_signals/signal-1'), {
      type: 'flood',
      severity: 'high',
      municipalityId: 'daet',
      schemaVersion: 1,
    })
    await setDoc(doc(db, 'audit_logs/log-1'), {
      action: 'test',
      performedBy: 'super-1',
      performedAt: ts,
    })
    await setDoc(doc(db, 'dead_letters/letter-1'), { topic: 'test', failedAt: ts, error: 'test' })
    await setDoc(doc(db, 'moderation_incidents/mod-1'), {
      municipalityId: 'daet',
      status: 'open',
      schemaVersion: 1,
    })
    await setDoc(doc(db, 'breakglass_events/bg-1'), { initiatedBy: 'super-1', initiatedAt: ts })
    await setDoc(doc(db, 'incident_response_events/ir-1'), {
      type: 'test',
      municipalityId: 'daet',
      createdAt: ts,
    })
    await setDoc(doc(db, 'report_events/evt-1'), {
      agencyId: 'bfp',
      type: 'report_created',
      municipalityId: 'daet',
      createdAt: ts,
      schemaVersion: 1,
    })
    await setDoc(doc(db, 'dispatch_events/devt-1'), {
      agencyId: 'bfp',
      type: 'dispatch_created',
      municipalityId: 'daet',
      createdAt: ts,
      schemaVersion: 1,
    })
  })
})

afterAll(async () => {
  await env.cleanup()
})

describe('alerts and emergencies — public read, no write', () => {
  it('authed citizen reads alerts (positive)', async () => {
    const db = authed(env, 'citizen-1', staffClaims({ role: 'citizen', municipalityId: 'daet' }))
    await assertSucceeds(getDoc(doc(db, 'alerts/alert-1')))
  })

  it('unauthed read alerts fails (negative)', async () => {
    const db = unauthed(env)
    await assertFails(getDoc(doc(db, 'alerts/alert-1')))
  })

  it('any client write to alerts fails', async () => {
    const db = authed(
      env,
      'super-1',
      staffClaims({ role: 'provincial_superadmin', permittedMunicipalityIds: ['daet'] }),
    )
    await assertFails(setDoc(doc(db, 'alerts/alert-new'), { title: 'x' }))
  })

  it('authed citizen reads emergencies (positive)', async () => {
    const db = authed(env, 'citizen-1', staffClaims({ role: 'citizen', municipalityId: 'daet' }))
    await assertSucceeds(getDoc(doc(db, 'emergencies/emerg-1')))
  })
})

describe('agencies — authed read, superadmin write only', () => {
  it('non-superadmin writes to agencies fail (negative)', async () => {
    const db = authed(
      env,
      'daet-admin',
      staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
    )
    await assertFails(setDoc(doc(db, 'agencies/bfp'), { name: 'BFP Updated' }))
  })

  it('superadmin writes to agencies succeed (positive)', async () => {
    const db = authed(
      env,
      'super-1',
      staffClaims({ role: 'provincial_superadmin', permittedMunicipalityIds: ['daet'] }),
    )
    await assertSucceeds(
      setDoc(doc(db, 'agencies/bfp'), {
        name: 'BFP Updated',
        region: 'Region V',
        schemaVersion: 1,
      }),
    )
  })

  it('suspended superadmin write to agencies fails (negative — isActivePrivileged gate)', async () => {
    const db = authed(
      env,
      'super-suspended',
      staffClaims({
        role: 'provincial_superadmin',
        permittedMunicipalityIds: ['daet'],
        accountStatus: 'suspended',
      }),
    )
    await assertFails(setDoc(doc(db, 'agencies/bfp'), { name: 'BFP Suspended Update' }))
  })
})

describe('audit_logs — superadmin only', () => {
  it('non-superadmin reads to audit_logs fail', async () => {
    const db = authed(env, 'citizen-1', staffClaims({ role: 'citizen', municipalityId: 'daet' }))
    await assertFails(getDoc(doc(db, 'audit_logs/log-1')))
  })

  it('superadmin reads to audit_logs succeed', async () => {
    const db = authed(
      env,
      'super-1',
      staffClaims({ role: 'provincial_superadmin', permittedMunicipalityIds: ['daet'] }),
    )
    await assertSucceeds(getDoc(doc(db, 'audit_logs/log-1')))
  })
})

describe('rate_limits — server-only, no client access', () => {
  it('any client read to rate_limits fails', async () => {
    const db = authed(
      env,
      'super-1',
      staffClaims({ role: 'provincial_superadmin', permittedMunicipalityIds: ['daet'] }),
    )
    await assertFails(getDoc(doc(db, 'rate_limits/key-1')))
  })

  it('any client write to rate_limits fails', async () => {
    const db = authed(
      env,
      'super-1',
      staffClaims({ role: 'provincial_superadmin', permittedMunicipalityIds: ['daet'] }),
    )
    await assertFails(setDoc(doc(db, 'rate_limits/key-1'), { count: 1 }))
  })
})

describe('dead_letters — superadmin read-only', () => {
  it('any client write to dead_letters fails', async () => {
    const db = authed(
      env,
      'super-1',
      staffClaims({ role: 'provincial_superadmin', permittedMunicipalityIds: ['daet'] }),
    )
    await assertFails(
      setDoc(doc(db, 'dead_letters/new-letter'), { topic: 'test', failedAt: ts, error: 'test' }),
    )
  })

  it('non-superadmin read to dead_letters fails', async () => {
    const db = authed(
      env,
      'daet-admin',
      staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
    )
    await assertFails(getDoc(doc(db, 'dead_letters/letter-1')))
  })
})

describe('hazard_signals — authed read, no write', () => {
  it('authed citizen reads hazard_signals (positive)', async () => {
    const db = authed(env, 'citizen-1', staffClaims({ role: 'citizen', municipalityId: 'daet' }))
    await assertSucceeds(getDoc(doc(db, 'hazard_signals/signal-1')))
  })

  it('any client write to hazard_signals fails', async () => {
    const db = authed(
      env,
      'super-1',
      staffClaims({ role: 'provincial_superadmin', permittedMunicipalityIds: ['daet'] }),
    )
    await assertFails(
      setDoc(doc(db, 'hazard_signals/signal-new'), {
        type: 'flood',
        severity: 'high',
        municipalityId: 'daet',
      }),
    )
  })
})

describe('moderation_incidents — privileged muni-admin or superadmin read', () => {
  it('muni admin reads moderation_incidents (positive)', async () => {
    const db = authed(
      env,
      'daet-admin',
      staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
    )
    await assertSucceeds(getDoc(doc(db, 'moderation_incidents/mod-1')))
  })

  it('agency admin reads moderation_incidents fails (negative)', async () => {
    const db = authed(
      env,
      'bfp-admin',
      staffClaims({ role: 'agency_admin', agencyId: 'bfp', municipalityId: 'daet' }),
    )
    await assertFails(getDoc(doc(db, 'moderation_incidents/mod-1')))
  })

  it('superadmin reads moderation_incidents succeeds (positive)', async () => {
    const db = authed(
      env,
      'super-1',
      staffClaims({ role: 'provincial_superadmin', permittedMunicipalityIds: ['daet'] }),
    )
    await assertSucceeds(getDoc(doc(db, 'moderation_incidents/mod-1')))
  })

  it('suspended superadmin reads moderation_incidents fails (isActivePrivileged gate)', async () => {
    const db = authed(
      env,
      'super-suspended',
      staffClaims({
        role: 'provincial_superadmin',
        permittedMunicipalityIds: ['daet'],
        accountStatus: 'suspended',
      }),
    )
    await assertFails(getDoc(doc(db, 'moderation_incidents/mod-1')))
  })

  it('citizen reads moderation_incidents fails (negative)', async () => {
    const db = authed(env, 'citizen-1', staffClaims({ role: 'citizen', municipalityId: 'daet' }))
    await assertFails(getDoc(doc(db, 'moderation_incidents/mod-1')))
  })

  it('responder reads moderation_incidents fails (negative)', async () => {
    const db = authed(
      env,
      'resp-1',
      staffClaims({ role: 'responder', agencyId: 'bfp', municipalityId: 'daet' }),
    )
    await assertFails(getDoc(doc(db, 'moderation_incidents/mod-1')))
  })
})

describe('breakglass_events — superadmin only', () => {
  it('responder reads breakglass_events fails', async () => {
    const db = authed(
      env,
      'resp-1',
      staffClaims({ role: 'responder', agencyId: 'bfp', municipalityId: 'daet' }),
    )
    await assertFails(getDoc(doc(db, 'breakglass_events/bg-1')))
  })

  it('superadmin reads breakglass_events succeeds', async () => {
    const db = authed(
      env,
      'super-1',
      staffClaims({ role: 'provincial_superadmin', permittedMunicipalityIds: ['daet'] }),
    )
    await assertSucceeds(getDoc(doc(db, 'breakglass_events/bg-1')))
  })
})

describe('incident_response_events — superadmin only', () => {
  it('any client write to incident_response_events fails', async () => {
    const db = authed(
      env,
      'super-1',
      staffClaims({ role: 'provincial_superadmin', permittedMunicipalityIds: ['daet'] }),
    )
    await assertFails(
      setDoc(doc(db, 'incident_response_events/ir-new'), {
        type: 'test',
        municipalityId: 'daet',
        createdAt: ts,
      }),
    )
  })
})

describe('default-deny guardrail', () => {
  it('any write to an unmapped collection fails default-deny', async () => {
    const db = authed(env, 'citizen-1', staffClaims({ role: 'citizen' }))
    const { setDoc, doc: d } = await import('firebase/firestore')
    await assertFails(setDoc(d(db, 'not_a_collection/x'), { a: 1 }))
  })
})
