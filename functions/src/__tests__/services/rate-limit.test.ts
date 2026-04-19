import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { Timestamp } from 'firebase-admin/firestore'
import { checkRateLimit } from '../../services/rate-limit.js'
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        updatedAt: Date.now() as any,
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
      const nowMs = now.toMillis()
      for (let i = 0; i < 60; i++) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        await checkRateLimit(db, {
          key: 'verifyReport:uid-1',
          limit: 60,
          windowSeconds: 60,
          now,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          updatedAt: nowMs as any,
        })
      }
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      const denied = await checkRateLimit(db, {
        key: 'verifyReport:uid-1',
        limit: 60,
        windowSeconds: 60,
        now,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        updatedAt: nowMs as any,
      })
      expect(denied.allowed).toBe(false)
      expect(denied.retryAfterSeconds).toBeGreaterThan(0)
    })
  })

  it('evicts timestamps outside the window', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = ctx.firestore() as any
      const now = Timestamp.fromMillis(1_000_000)
      const old = Timestamp.fromMillis(900_000) // 100 s before window start (window = 60 s)
      // Seed an old timestamp outside the 60s window
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      await checkRateLimit(db, {
        key: 'evict-test',
        limit: 60,
        windowSeconds: 60,
        now: old,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        updatedAt: old.toMillis() as any,
      })
      // Now call with current time — old entry must be filtered out
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      const result = await checkRateLimit(db, {
        key: 'evict-test',
        limit: 60,
        windowSeconds: 60,
        now,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        updatedAt: now.toMillis() as any,
      })
      expect(result.allowed).toBe(true)
    })
  })
})
