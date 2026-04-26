import { describe, it, expect, beforeEach } from 'vitest'
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import type { Database } from 'firebase-admin/database'
import {
  projectResponderLocationsCore,
  roundToGrid,
  computeFreshness,
} from '../../scheduled/project-responder-locations.js'

let testEnv: RulesTestEnvironment

beforeEach(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'projection-test',
    database: { host: 'localhost', port: 9000 },
  })
  await testEnv.clearDatabase()
})

describe('roundToGrid', () => {
  it('rounds to 3 decimal places (~100m)', () => {
    expect(roundToGrid(14.09315)).toBe(14.093)
    expect(roundToGrid(122.95455)).toBe(122.955)
    expect(roundToGrid(-33.456789)).toBe(-33.457)
    expect(roundToGrid(0)).toBe(0)
    expect(roundToGrid(14.093149)).toBe(14.093)
  })
})

describe('computeFreshness', () => {
  it('returns fresh for <30s', () => {
    expect(computeFreshness(0)).toBe('fresh')
    expect(computeFreshness(29_999)).toBe('fresh')
  })

  it('returns degraded for 30–90s', () => {
    expect(computeFreshness(30_000)).toBe('degraded')
    expect(computeFreshness(89_999)).toBe('degraded')
  })

  it('returns stale for 90–300s', () => {
    expect(computeFreshness(90_000)).toBe('stale')
    expect(computeFreshness(299_999)).toBe('stale')
  })

  it('returns offline for ≥300s', () => {
    expect(computeFreshness(300_000)).toBe('offline')
    expect(computeFreshness(301_000)).toBe('offline')
  })
})

describe('projectResponderLocationsCore', () => {
  it('projects active responders with rounded coordinates and correct freshness', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const rtdb = ctx.database() as unknown as Database
      const now = 1_000_000

      await rtdb.ref('responder_index/r1').set({ municipalityId: 'daet', agencyId: 'bfp' })
      await rtdb.ref('responder_locations/r1').set({
        capturedAt: now - 10_000,
        lat: 14.09315,
        lng: 122.95455,
        accuracy: 5,
        batteryPct: 80,
        motionState: 'moving',
        appVersion: '1.0.0',
        telemetryStatus: 'active',
      })

      await projectResponderLocationsCore(rtdb, { now })

      const snap = await rtdb.ref('shared_projection/daet/r1').get()
      expect(snap.val()).toEqual({
        lat: 14.093,
        lng: 122.955,
        freshness: 'fresh',
        lastSeenAt: now,
      })
    })
  })

  it('deletes offline responders from projection', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const rtdb = ctx.database() as unknown as Database
      const now = 1_000_000

      await rtdb.ref('responder_index/r1').set({ municipalityId: 'daet', agencyId: 'bfp' })
      await rtdb.ref('responder_locations/r1').set({
        capturedAt: now - 400_000,
        lat: 14.0931,
        lng: 122.9544,
        accuracy: 5,
        batteryPct: 80,
        motionState: 'still',
        appVersion: '1.0.0',
        telemetryStatus: 'active',
      })
      await rtdb.ref('shared_projection/daet/r1').set({
        lat: 14.093,
        lng: 122.955,
        freshness: 'fresh',
        lastSeenAt: now - 500_000,
      })

      await projectResponderLocationsCore(rtdb, { now })

      const snap = await rtdb.ref('shared_projection/daet/r1').get()
      expect(snap.val()).toBeNull()
    })
  })

  it('cleans up stale projection entries via TTL', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const rtdb = ctx.database() as unknown as Database
      const now = 1_000_000

      await rtdb.ref('shared_projection/daet/r1').set({
        lat: 14.093,
        lng: 122.955,
        freshness: 'fresh',
        lastSeenAt: now - 100_000,
      })

      await projectResponderLocationsCore(rtdb, { now })

      const snap = await rtdb.ref('shared_projection/daet/r1').get()
      expect(snap.val()).toBeNull()
    })
  })

  it('groups responders by municipalityId', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const rtdb = ctx.database() as unknown as Database
      const now = 1_000_000

      await rtdb.ref('responder_index/r1').set({ municipalityId: 'daet', agencyId: 'bfp' })
      await rtdb.ref('responder_index/r2').set({ municipalityId: 'mercedes', agencyId: 'bfp' })

      await rtdb.ref('responder_locations/r1').set({
        capturedAt: now - 5_000,
        lat: 14.0931,
        lng: 122.9544,
        accuracy: 5,
        batteryPct: 80,
        motionState: 'moving',
        appVersion: '1.0.0',
        telemetryStatus: 'active',
      })
      await rtdb.ref('responder_locations/r2').set({
        capturedAt: now - 5_000,
        lat: 14.1234,
        lng: 123.0,
        accuracy: 5,
        batteryPct: 90,
        motionState: 'still',
        appVersion: '1.0.0',
        telemetryStatus: 'active',
      })

      await projectResponderLocationsCore(rtdb, { now })

      const daet = (await rtdb.ref('shared_projection/daet/r1').get()).val() as {
        freshness: string
      } | null
      const mercedes = (await rtdb.ref('shared_projection/mercedes/r2').get()).val() as {
        freshness: string
      } | null
      expect(daet?.freshness).toBe('fresh')
      expect(mercedes?.freshness).toBe('fresh')
    })
  })
})
