import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { Timestamp } from 'firebase-admin/firestore'
import { checkRateLimit } from '../../services/rate-limit'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const RULES_PATH = resolve(import.meta.dirname, '../../../../infra/firebase/firestore.rules')

let testEnv: RulesTestEnvironment

beforeEach(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'rate-limit-test',
    firestore: {
      host: 'localhost',
      port: 8080,
      rules: readFileSync(RULES_PATH, 'utf8'),
    },
  })
  await testEnv.clearFirestore()
})

afterEach(async () => {
  await testEnv.cleanup()
})

describe('checkRateLimit', () => {
  it('allows the first call under the limit', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = ctx.firestore() as any
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      const result = await checkRateLimit(db, {
        key: 'verifyReport:uid-1',
        limit: 60,
        windowSeconds: 60,
        now: Timestamp.now(),
      })
      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(59)
    })
  })

  it('denies calls past the limit and returns retryAfterSeconds', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = ctx.firestore() as any
      const now = Timestamp.now()
      for (let i = 0; i < 60; i++) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        await checkRateLimit(db, {
          key: 'verifyReport:uid-1',
          limit: 60,
          windowSeconds: 60,
          now,
        })
      }
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      const denied = await checkRateLimit(db, {
        key: 'verifyReport:uid-1',
        limit: 60,
        windowSeconds: 60,
        now,
      })
      expect(denied.allowed).toBe(false)
      expect(denied.retryAfterSeconds).toBeGreaterThan(0)
    })
  })
})
