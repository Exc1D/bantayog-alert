/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument */
import { assertFails } from '@firebase/rules-unit-testing'
import { doc, setDoc, updateDoc } from 'firebase/firestore'
import { afterAll, beforeAll, describe, it } from 'vitest'
import { authed, createTestEnv } from '../helpers/rules-harness.js'
import { seedActiveAccount, staffClaims } from '../helpers/seed-factories.js'

let env: Awaited<ReturnType<typeof createTestEnv>>

beforeAll(async () => {
  env = await createTestEnv('demo-dispatch-mirror')
  // Municipal admin who owns the report
  await seedActiveAccount(env, {
    uid: 'daet-admin',
    role: 'municipal_admin',
    municipalityId: 'daet',
  })
  // Responder who should NOT be able to write reports.status directly
  await seedActiveAccount(env, {
    uid: 'resp-1',
    role: 'responder',
    municipalityId: 'daet',
    agencyId: 'bfp',
  })
})

afterAll(async () => {
  await env.cleanup()
})

describe('responder cannot write reports.status directly', () => {
  it('denies responder direct write on reports.status', async () => {
    // Seed an assigned report (not a dispatch — this is the report itself)
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore() as any
      await setDoc(doc(db, 'reports/report-1'), {
        status: 'assigned',
        municipalityId: 'daet',
        reporterRole: 'citizen',
        reportType: 'flood',
        severity: 'high',
        mediaRefs: [],
        description: 'seeded',
        submittedAt: 1713350400000,
        retentionExempt: false,
        visibilityClass: 'internal',
        visibility: { scope: 'municipality', sharedWith: [] },
        source: 'web',
        hasPhotoAndGPS: false,
        schemaVersion: 1,
      })
    })
    // Try to update status as a responder — should be denied
    const db = authed(
      env,
      'resp-1',
      staffClaims({ role: 'responder', municipalityId: 'daet', agencyId: 'bfp' }),
    )
    await assertFails(updateDoc(doc(db, 'reports/report-1'), { status: 'acknowledged' }))
  })
})
