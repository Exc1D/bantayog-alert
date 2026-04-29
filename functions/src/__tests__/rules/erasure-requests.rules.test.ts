import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore'

const RULES_PATH = resolve(import.meta.dirname, '../../../../infra/firebase/firestore.rules')

let env: RulesTestEnvironment | undefined

const citizenToken = { role: 'citizen', accountStatus: 'active' }
const superadminToken = {
  role: 'provincial_superadmin',
  accountStatus: 'active',
  mfaVerified: true,
}

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-8c-rules',
    firestore: { rules: readFileSync(RULES_PATH, 'utf8'), host: 'localhost', port: 8081 },
  })
})

afterAll(async () => {
  await env?.cleanup()
})

beforeEach(async () => {
  await env!.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    for (const col of ['erasure_requests', 'erasure_active']) {
      const snap = await db.collection(col).get()
      await Promise.all(snap.docs.map((d) => d.ref.delete()))
    }
  })
})

describe('erasure_requests rules', () => {
  it('citizen can create their own pending_review request', async () => {
    const db = env!.authenticatedContext('uid-citizen', citizenToken).firestore()
    await assertSucceeds(
      setDoc(doc(db, 'erasure_requests', 'req-1'), {
        citizenUid: 'uid-citizen',
        status: 'pending_review',
        legalHold: false,
        requestedAt: Date.now(),
      }),
    )
  })

  it('citizen cannot create with executing status', async () => {
    const db = env!.authenticatedContext('uid-citizen', citizenToken).firestore()
    await assertFails(
      setDoc(doc(db, 'erasure_requests', 'req-bad'), {
        citizenUid: 'uid-citizen',
        status: 'executing',
        requestedAt: Date.now(),
      }),
    )
  })

  it('citizen can read their own request', async () => {
    await env!.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'erasure_requests', 'req-mine'), {
        citizenUid: 'uid-citizen',
        status: 'pending_review',
        requestedAt: Date.now(),
      })
    })
    const db = env!.authenticatedContext('uid-citizen', citizenToken).firestore()
    await assertSucceeds(getDoc(doc(db, 'erasure_requests', 'req-mine')))
  })

  it('citizen cannot read another citizen request', async () => {
    await env!.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'erasure_requests', 'req-other'), {
        citizenUid: 'uid-other',
        status: 'pending_review',
        requestedAt: Date.now(),
      })
    })
    const db = env!.authenticatedContext('uid-citizen', citizenToken).firestore()
    await assertFails(getDoc(doc(db, 'erasure_requests', 'req-other')))
  })

  it('superadmin can read any request', async () => {
    await env!.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'erasure_requests', 'req-any'), {
        citizenUid: 'uid-citizen',
        status: 'pending_review',
        requestedAt: Date.now(),
      })
      await setDoc(doc(ctx.firestore(), 'active_accounts', 'uid-admin'), {
        accountStatus: 'active',
      })
    })
    const db = env!.authenticatedContext('uid-admin', superadminToken).firestore()
    await assertSucceeds(getDoc(doc(db, 'erasure_requests', 'req-any')))
  })

  it('citizen cannot update a request after creation', async () => {
    await env!.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'erasure_requests', 'req-update'), {
        citizenUid: 'uid-citizen',
        status: 'pending_review',
        requestedAt: Date.now(),
      })
    })
    const db = env!.authenticatedContext('uid-citizen', citizenToken).firestore()
    await assertFails(updateDoc(doc(db, 'erasure_requests', 'req-update'), { status: 'denied' }))
  })
})

describe('erasure_active sentinel rules', () => {
  it('citizen can read their own sentinel', async () => {
    await env!.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'erasure_active', 'uid-citizen'), {
        citizenUid: 'uid-citizen',
        createdAt: Date.now(),
      })
    })
    const db = env!.authenticatedContext('uid-citizen', citizenToken).firestore()
    await assertSucceeds(getDoc(doc(db, 'erasure_active', 'uid-citizen')))
  })

  it('citizen cannot read another citizen sentinel', async () => {
    await env!.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'erasure_active', 'uid-other'), {
        citizenUid: 'uid-other',
        createdAt: Date.now(),
      })
    })
    const db = env!.authenticatedContext('uid-citizen', citizenToken).firestore()
    await assertFails(getDoc(doc(db, 'erasure_active', 'uid-other')))
  })
})
