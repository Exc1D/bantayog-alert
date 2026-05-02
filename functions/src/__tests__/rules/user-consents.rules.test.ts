import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import { doc, getDoc, setDoc, updateDoc, deleteDoc, Timestamp } from 'firebase/firestore'

const RULES_PATH = resolve(import.meta.dirname, '../../../../infra/firebase/firestore.rules')

let env: RulesTestEnvironment | undefined

const activeToken = { role: 'citizen', accountStatus: 'active' }

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-user-consents-rules',
    firestore: { rules: readFileSync(RULES_PATH, 'utf8'), host: 'localhost', port: 8081 },
  })
})

afterAll(async () => {
  await env?.cleanup()
})

beforeEach(async () => {
  await env!.clearFirestore()
})

describe('user_consents rules', () => {
  it('owner can read their own consent doc', async () => {
    await env!.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'user_consents', 'uid-owner'), {
        consentVersion: '1.0',
        consentGivenAt: Timestamp.now(),
        method: 'in_app_modal',
      })
    })
    const db = env!.authenticatedContext('uid-owner', activeToken).firestore()
    await assertSucceeds(getDoc(doc(db, 'user_consents', 'uid-owner')))
  })

  it('owner can create consent doc with valid fields', async () => {
    const db = env!.authenticatedContext('uid-owner', activeToken).firestore()
    await assertSucceeds(
      setDoc(doc(db, 'user_consents', 'uid-owner'), {
        consentVersion: '1.0',
        consentGivenAt: Timestamp.now(),
        method: 'in_app_modal',
      }),
    )
  })

  it('denies read of another user consent doc', async () => {
    await env!.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'user_consents', 'uid-other'), {
        consentVersion: '1.0',
        consentGivenAt: Timestamp.now(),
        method: 'in_app_modal',
      })
    })
    const db = env!.authenticatedContext('uid-owner', activeToken).firestore()
    await assertFails(getDoc(doc(db, 'user_consents', 'uid-other')))
  })

  it('denies unauthenticated read', async () => {
    const db = env!.unauthenticatedContext().firestore()
    await assertFails(getDoc(doc(db, 'user_consents', 'uid-owner')))
  })

  it('denies create with extra fields', async () => {
    const db = env!.authenticatedContext('uid-owner', activeToken).firestore()
    await assertFails(
      setDoc(doc(db, 'user_consents', 'uid-owner'), {
        consentVersion: '1.0',
        consentGivenAt: Timestamp.now(),
        method: 'in_app_modal',
        extra: 'not-allowed',
      }),
    )
  })

  it('denies create in another user slot', async () => {
    const db = env!.authenticatedContext('uid-owner', activeToken).firestore()
    await assertFails(
      setDoc(doc(db, 'user_consents', 'uid-other'), {
        consentVersion: '1.0',
        consentGivenAt: Timestamp.now(),
        method: 'in_app_modal',
      }),
    )
  })

  it('denies update', async () => {
    await env!.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'user_consents', 'uid-owner'), {
        consentVersion: '1.0',
        consentGivenAt: Timestamp.now(),
        method: 'in_app_modal',
      })
    })
    const db = env!.authenticatedContext('uid-owner', activeToken).firestore()
    await assertFails(updateDoc(doc(db, 'user_consents', 'uid-owner'), { consentVersion: '2.0' }))
  })

  it('denies delete', async () => {
    await env!.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'user_consents', 'uid-owner'), {
        consentVersion: '1.0',
        consentGivenAt: Timestamp.now(),
        method: 'in_app_modal',
      })
    })
    const db = env!.authenticatedContext('uid-owner', activeToken).firestore()
    await assertFails(deleteDoc(doc(db, 'user_consents', 'uid-owner')))
  })
})
