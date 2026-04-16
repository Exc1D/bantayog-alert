import { describe, it, beforeAll, beforeEach } from 'vitest'
import { assertSucceeds, assertFails } from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { getTestEnv } from './setup'
import { citizenCtx, superadminCtx } from './helpers'

describe('claim_revocations rules', () => {
  let testEnv: Awaited<ReturnType<typeof getTestEnv>>

  beforeAll(async () => {
    testEnv = await getTestEnv()
  })
  beforeEach(async () => {
    await testEnv.clearFirestore()
  })

  it('should allow user to read own claim_revocations', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'claim_revocations', 'user_1'), {
        revokedAt: new Date(),
        reason: 'test',
        revokedBy: 'admin',
      })
    })
    const ctx = citizenCtx(testEnv, 'user_1')
    await assertSucceeds(getDoc(doc(ctx.firestore(), 'claim_revocations', 'user_1')))
  })

  it('should reject reading another users claim_revocations', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'claim_revocations', 'user_2'), {
        revokedAt: new Date(),
        reason: 'test',
        revokedBy: 'admin',
      })
    })
    const ctx = citizenCtx(testEnv, 'user_1')
    await assertFails(getDoc(doc(ctx.firestore(), 'claim_revocations', 'user_2')))
  })

  it('should reject write to claim_revocations', async () => {
    const ctx = citizenCtx(testEnv, 'user_1')
    await assertFails(
      setDoc(doc(ctx.firestore(), 'claim_revocations', 'user_1'), {
        revokedAt: new Date(),
        reason: 'self-revoke attempt',
        revokedBy: 'user_1',
      }),
    )
  })
})

describe('active_accounts rules', () => {
  let testEnv: Awaited<ReturnType<typeof getTestEnv>>

  beforeAll(async () => {
    testEnv = await getTestEnv()
  })
  beforeEach(async () => {
    await testEnv.clearFirestore()
  })

  // No afterAll here — shared testEnv cleanup happens once at the outer scope

  it('should allow user to read own active_accounts', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'active_accounts', 'user_1'), {
        accountStatus: 'active',
        lastUpdatedAt: new Date(),
      })
    })
    const ctx = citizenCtx(testEnv, 'user_1')
    await assertSucceeds(getDoc(doc(ctx.firestore(), 'active_accounts', 'user_1')))
  })

  it('should reject reading another users active_accounts', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'active_accounts', 'user_2'), {
        accountStatus: 'active',
        lastUpdatedAt: new Date(),
      })
    })
    const ctx = citizenCtx(testEnv, 'user_1')
    await assertFails(getDoc(doc(ctx.firestore(), 'active_accounts', 'user_2')))
  })

  it('should reject write to active_accounts', async () => {
    const ctx = superadminCtx(testEnv)
    await assertFails(
      setDoc(doc(ctx.firestore(), 'active_accounts', 'superadmin_1'), {
        accountStatus: 'active',
        lastUpdatedAt: new Date(),
      }),
    )
  })
})
