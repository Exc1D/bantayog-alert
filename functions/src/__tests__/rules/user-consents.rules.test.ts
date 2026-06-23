import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { guardInitTestEnvironment } from '../helpers/emulator-guard.js'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import { doc, getDoc, setDoc, deleteDoc, Timestamp } from 'firebase/firestore'

const RULES_PATH = resolve(import.meta.dirname, '../../../../infra/firebase/firestore.rules')

let env: RulesTestEnvironment | undefined

const activeToken = { role: 'citizen', accountStatus: 'active' }

const itif = (condition: boolean) =>
  condition ||
  process.env.FIRESTORE_EMULATOR_HOST ||
  process.env.FIREBASE_DATABASE_EMULATOR_HOST ||
  process.env.FIREBASE_STORAGE_EMULATOR_HOST
    ? it
    : it.skip

beforeAll(async () => {
  const result = await guardInitTestEnvironment(
    {
      projectId: 'demo-user-consents-rules',
      firestore: { rules: readFileSync(RULES_PATH, 'utf8'), host: 'localhost', port: 8081 },
    },
    'user-consents-rules',
  )
  env = result.env
})

afterAll(async () => {
  await env?.cleanup()
})

beforeEach(async () => {
  if (!env) return
  await env.clearFirestore()
})

describe('user_consents rules', () => {
  itif(!!env)('owner can read their own consent doc', async () => {
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

  itif(!!env)('owner can create consent doc with valid fields', async () => {
    const db = env!.authenticatedContext('uid-owner', activeToken).firestore()
    await assertSucceeds(
      setDoc(doc(db, 'user_consents', 'uid-owner'), {
        consentVersion: '1.0',
        consentGivenAt: Timestamp.now(),
        method: 'in_app_modal',
      }),
    )
  })

  itif(!!env)('owner can refresh their consent version with valid fields', async () => {
    await env!.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'user_consents', 'uid-owner'), {
        consentVersion: '0.9',
        consentGivenAt: Timestamp.now(),
        method: 'in_app_modal',
      })
    })

    const db = env!.authenticatedContext('uid-owner', activeToken).firestore()
    await assertSucceeds(
      setDoc(doc(db, 'user_consents', 'uid-owner'), {
        consentVersion: '1.0',
        consentGivenAt: Timestamp.now(),
        method: 'in_app_modal',
      }),
    )
  })

  itif(!!env)('denies read of another user consent doc', async () => {
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

  itif(!!env)('denies unauthenticated read', async () => {
    const db = env!.unauthenticatedContext().firestore()
    await assertFails(getDoc(doc(db, 'user_consents', 'uid-owner')))
  })

  itif(!!env)('denies create with extra fields', async () => {
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

  itif(!!env)('denies create in another user slot', async () => {
    const db = env!.authenticatedContext('uid-owner', activeToken).firestore()
    await assertFails(
      setDoc(doc(db, 'user_consents', 'uid-other'), {
        consentVersion: '1.0',
        consentGivenAt: Timestamp.now(),
        method: 'in_app_modal',
      }),
    )
  })

  itif(!!env)('denies consent updates with extra fields', async () => {
    await env!.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'user_consents', 'uid-owner'), {
        consentVersion: '0.9',
        consentGivenAt: Timestamp.now(),
        method: 'in_app_modal',
      })
    })

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

  itif(!!env)('denies updating another user consent doc', async () => {
    await env!.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'user_consents', 'uid-other'), {
        consentVersion: '0.9',
        consentGivenAt: Timestamp.now(),
        method: 'in_app_modal',
      })
    })

    const db = env!.authenticatedContext('uid-owner', activeToken).firestore()
    await assertFails(
      setDoc(doc(db, 'user_consents', 'uid-other'), {
        consentVersion: '1.0',
        consentGivenAt: Timestamp.now(),
        method: 'in_app_modal',
      }),
    )
  })

  itif(!!env)('denies delete', async () => {
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

  itif(!!env)('denies create with method sms', async () => {
    const db = env!.authenticatedContext('uid-owner', activeToken).firestore()
    await assertFails(
      setDoc(doc(db, 'user_consents', 'uid-owner'), {
        consentVersion: '1.0',
        consentGivenAt: Timestamp.now(),
        method: 'sms',
      }),
    )
  })
})
