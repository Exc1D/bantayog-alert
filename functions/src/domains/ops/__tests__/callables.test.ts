/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unnecessary-type-assertion */
import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest'
import { type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { guardInitTestEnvironment } from '../../../__tests__/helpers/emulator-guard.js'
const itif = (condition: boolean) => (condition ? it : it.skip)

vi.mock('firebase-admin/database', () => ({
  getDatabase: vi.fn(() => ({})),
}))

import { getOpsMetricsCore } from '../callables.js'
import { staffClaims } from '../../../__tests__/helpers/seed-factories.js'

let testEnv: RulesTestEnvironment | undefined
let available = false
let adminDb: any

beforeAll(async () => {
  const guarded = await guardInitTestEnvironment(
    {
      projectId: 'get-ops-metrics-test',
      firestore: { host: 'localhost', port: 8081 },
    },
    'get-ops-metrics',
  )
  testEnv = guarded.env
  available = guarded.available
  if (!available) return
  adminDb = testEnv!.unauthenticatedContext().firestore()
})

beforeEach(async () => {
  if (!available || !testEnv) return
  await testEnv!.clearFirestore()
})
afterAll(async () => {
  await testEnv?.cleanup()
})

const today = new Date().toISOString().slice(0, 10)

describe('getOpsMetricsCore', () => {
  itif(available)('derives municipality scope from municipal_admin claims', async () => {
    await testEnv!.withSecurityRulesDisabled(async () => {
      // eslint-disable-next-line no-restricted-syntax
      await adminDb.collection('metrics_daily').doc(`daet_${today}`).set({
        scopeType: 'municipality',
        scopeId: 'daet',
        date: today,
        totalDispatches: 5,
        acceptedCount: 3,
        declinedCount: 1,
        updatedAt: Date.now(),
      })
    })

    const result = await getOpsMetricsCore(adminDb, {
      timeRange: '24h',
      actor: { claims: staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }) },
    })

    expect(result.scope.type).toBe('municipality')
    expect(result.scope.id).toBe('daet')
    expect(result.metrics.totalDispatches).toBe(5)
    expect(result.metrics.acceptedCount).toBe(3)
    expect(result.metrics.declinedCount).toBe(1)
  })

  itif(available)('derives province scope from provincial_superadmin claims', async () => {
    await testEnv!.withSecurityRulesDisabled(async () => {
      // eslint-disable-next-line no-restricted-syntax
      await adminDb.collection('metrics_daily').doc(`province_${today}`).set({
        scopeType: 'province',
        scopeId: 'province',
        date: today,
        totalDispatches: 42,
        escalatedCount: 2,
        updatedAt: Date.now(),
      })
    })

    const result = await getOpsMetricsCore(adminDb, {
      timeRange: '24h',
      actor: { claims: staffClaims({ role: 'provincial_superadmin' }) },
    })

    expect(result.scope.type).toBe('province')
    expect(result.metrics.totalDispatches).toBe(42)
    expect(result.metrics.escalatedCount).toBe(2)
  })

  itif(available)('rejects unknown roles', async () => {
    await expect(
      getOpsMetricsCore(adminDb, {
        timeRange: '24h',
        actor: { claims: staffClaims({ role: 'citizen' }) },
      }),
    ).rejects.toThrow('unknown role')
  })
})
