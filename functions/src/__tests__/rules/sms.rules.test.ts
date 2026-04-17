import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { afterAll, beforeAll, describe, it } from 'vitest'

let testEnv: RulesTestEnvironment

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-sms-rules',
    firestore: {
      rules: readFileSync(resolve(process.cwd(), '../infra/firebase/firestore.rules'), 'utf8'),
    },
  })

  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore()

    // Active superadmin with municipality permissions
    await db
      .collection('active_accounts')
      .doc('super-1')
      .set({
        uid: 'super-1',
        role: 'provincial_superadmin',
        accountStatus: 'active',
        permittedMunicipalityIds: ['daet'],
        mfaEnrolled: true,
        lastClaimIssuedAt: 1713350400000,
        updatedAt: 1713350400000,
      })

    // Suspended superadmin — accountStatus is 'suspended'
    await db
      .collection('active_accounts')
      .doc('suspended-super-1')
      .set({
        uid: 'suspended-super-1',
        role: 'provincial_superadmin',
        accountStatus: 'suspended',
        permittedMunicipalityIds: ['daet'],
        mfaEnrolled: true,
        lastClaimIssuedAt: 1713350400000,
        updatedAt: 1713350400000,
      })

    // Seed a minimal sms_outbox doc so reads can be tested
    await db.collection('sms_outbox').doc('msg-1').set({
      to: '+639000000001',
      body: 'Test message',
      status: 'queued',
      createdAt: 1713350400000,
    })

    // Seed a minimal sms_provider_health doc
    await db.collection('sms_provider_health').doc('twilio-1').set({
      provider: 'twilio',
      status: 'ok',
      checkedAt: 1713350400000,
    })
  })
})

afterAll(async () => {
  await testEnv.cleanup()
})

describe('sms_inbox rules', () => {
  it('blocks any client read from sms_inbox', async () => {
    const db = testEnv
      .authenticatedContext('super-1', {
        role: 'provincial_superadmin',
        accountStatus: 'active',
        permittedMunicipalityIds: ['daet'],
      })
      .firestore()

    await assertFails(db.collection('sms_inbox').doc('any-msg').get())
  })

  it('blocks any client write to sms_inbox', async () => {
    const db = testEnv
      .authenticatedContext('super-1', {
        role: 'provincial_superadmin',
        accountStatus: 'active',
        permittedMunicipalityIds: ['daet'],
      })
      .firestore()

    await assertFails(db.collection('sms_inbox').doc('any-msg').set({ body: 'test' }))
  })
})

describe('sms_outbox rules', () => {
  it('allows superadmin to read sms_outbox', async () => {
    const db = testEnv
      .authenticatedContext('super-1', {
        role: 'provincial_superadmin',
        accountStatus: 'active',
        permittedMunicipalityIds: ['daet'],
      })
      .firestore()

    await assertSucceeds(db.collection('sms_outbox').doc('msg-1').get())
  })

  it('blocks non-superadmin from reading sms_outbox', async () => {
    const db = testEnv
      .authenticatedContext('citizen-1', {
        role: 'citizen',
        accountStatus: 'active',
      })
      .firestore()

    await assertFails(db.collection('sms_outbox').doc('msg-1').get())
  })

  it('blocks suspended superadmin from reading sms_outbox', async () => {
    const db = testEnv
      .authenticatedContext('suspended-super-1', {
        role: 'provincial_superadmin',
        accountStatus: 'suspended',
        permittedMunicipalityIds: ['daet'],
      })
      .firestore()

    await assertFails(db.collection('sms_outbox').doc('msg-1').get())
  })

  it('blocks any client write to sms_outbox', async () => {
    const db = testEnv
      .authenticatedContext('super-1', {
        role: 'provincial_superadmin',
        accountStatus: 'active',
        permittedMunicipalityIds: ['daet'],
      })
      .firestore()

    await assertFails(db.collection('sms_outbox').doc('new-msg').set({ body: 'test' }))
  })
})

describe('sms_sessions rules', () => {
  it('blocks any client read from sms_sessions', async () => {
    const db = testEnv
      .authenticatedContext('super-1', {
        role: 'provincial_superadmin',
        accountStatus: 'active',
        permittedMunicipalityIds: ['daet'],
      })
      .firestore()

    await assertFails(db.collection('sms_sessions').doc('any-session').get())
  })

  it('blocks any client write to sms_sessions', async () => {
    const db = testEnv
      .authenticatedContext('super-1', {
        role: 'provincial_superadmin',
        accountStatus: 'active',
        permittedMunicipalityIds: ['daet'],
      })
      .firestore()

    await assertFails(db.collection('sms_sessions').doc('new-session').set({ msisdnHash: 'hash' }))
  })
})

describe('sms_provider_health rules', () => {
  it('allows superadmin to read sms_provider_health', async () => {
    const db = testEnv
      .authenticatedContext('super-1', {
        role: 'provincial_superadmin',
        accountStatus: 'active',
        permittedMunicipalityIds: ['daet'],
      })
      .firestore()

    await assertSucceeds(db.collection('sms_provider_health').doc('twilio-1').get())
  })

  it('blocks non-superadmin from reading sms_provider_health', async () => {
    const db = testEnv
      .authenticatedContext('citizen-1', {
        role: 'citizen',
        accountStatus: 'active',
      })
      .firestore()

    await assertFails(db.collection('sms_provider_health').doc('twilio-1').get())
  })

  it('blocks any client write to sms_provider_health', async () => {
    const db = testEnv
      .authenticatedContext('super-1', {
        role: 'provincial_superadmin',
        accountStatus: 'active',
        permittedMunicipalityIds: ['daet'],
      })
      .firestore()

    await assertFails(db.collection('sms_provider_health').doc('twilio-1').set({ status: 'down' }))
  })
})
