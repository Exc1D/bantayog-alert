import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest'
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { setDoc, doc } from 'firebase/firestore'
import { type Firestore } from 'firebase-admin/firestore'
import ngeohash from 'ngeohash'
import type { FeatureCollection } from 'geojson'

const ts = 1713350400000
// Use a coordinate guaranteed to be within 500m of the Daet-Mercedes boundary
// Daet polygon: [122.9, 14.12] to [122.95, 14.22]
// Mercedes polygon: [122.85, 14.1] to [122.9, 14.17]
// Boundary is at ~122.9°E; 0.002° ≈ 214m at this latitude
// A point ~214m inside Mercedes: 14.15°N, 122.898°E
const NEAR_BOUNDARY_LAT = 14.15
const NEAR_BOUNDARY_LNG = 122.898
const NEAR_BOUNDARY_GEOHASH = ngeohash.encode(NEAR_BOUNDARY_LAT, NEAR_BOUNDARY_LNG, 6)

const FAR_FROM_BOUNDARY_LAT = 14.2
const FAR_FROM_BOUNDARY_LNG = 122.92
const FAR_GEOHASH = ngeohash.encode(FAR_FROM_BOUNDARY_LAT, FAR_FROM_BOUNDARY_LNG, 6)

const STUB_BOUNDARIES: FeatureCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { municipalityId: 'daet' },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [122.9, 14.12],
            [122.95, 14.12],
            [122.95, 14.22],
            [122.9, 14.22],
            [122.9, 14.12],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      properties: { municipalityId: 'mercedes' },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [122.85, 14.1],
            [122.9, 14.1],
            [122.9, 14.17],
            [122.85, 14.17],
            [122.85, 14.1],
          ],
        ],
      },
    },
  ],
}

vi.mock('firebase-admin/database', () => ({ getDatabase: vi.fn(() => ({})) }))
vi.mock('node:fs', () => ({
  readFileSync: () => JSON.stringify(STUB_BOUNDARIES),
}))
vi.mock('node:module', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createRequire: cr } = require('node:module')
  const req = cr('/virtual/index.js') as { resolve: (mod: string) => string }
  const origResolve = req.resolve.bind(req)
  req.resolve = (mod: string) => {
    if (mod === '@bantayog/shared-data/municipality-boundaries.geojson') {
      return '/stubbed/path/boundary.json'
    }
    return origResolve(mod)
  }
  return { createRequire: () => req }
})

let adminDb: Firestore
vi.mock('../../admin-init.js', () => ({
  get adminDb() {
    return adminDb
  },
}))

import { borderAutoShareCore } from '../../triggers/border-auto-share.js'

let testEnv: RulesTestEnvironment

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'border-auto-share-test',
    firestore: {
      host: 'localhost',
      port: 8081,
      rules:
        'rules_version = "2"; service cloud.firestore { match /{d=**} { allow read, write: if true; } }',
    },
  })
  adminDb = testEnv.unauthenticatedContext().firestore() as unknown as Firestore
})

beforeEach(async () => {
  await testEnv.clearFirestore()
})
afterAll(async () => {
  await testEnv.cleanup()
})

describe('borderAutoShareTrigger', () => {
  it('skips reports with no locationGeohash', async () => {
    const opsDoc = {
      municipalityId: 'daet',
      status: 'verified',
      severity: 'high',
      createdAt: ts,
      updatedAt: ts,
      agencyIds: [],
      activeResponderCount: 0,
      requiresLocationFollowUp: false,
      visibility: { scope: 'municipality', sharedWith: [] },
      schemaVersion: 1,
    }
    await borderAutoShareCore(adminDb, {
      reportId: 'r1',
      opsData: opsDoc,
      boundaryGeohashSet: new Set<string>([NEAR_BOUNDARY_GEOHASH]),
    })
    const snap = await adminDb.collection('report_sharing').doc('r1').get()
    expect(snap.exists).toBe(false)
  })

  it('does not create report_sharing for a report far from any boundary', async () => {
    const opsDoc = {
      municipalityId: 'daet',
      locationGeohash: FAR_GEOHASH,
      status: 'verified',
      severity: 'high',
      createdAt: ts,
      updatedAt: ts,
      agencyIds: [],
      activeResponderCount: 0,
      requiresLocationFollowUp: false,
      visibility: { scope: 'municipality', sharedWith: [] },
      schemaVersion: 1,
    }
    await borderAutoShareCore(adminDb, {
      reportId: 'r1',
      opsData: opsDoc,
      boundaryGeohashSet: new Set<string>([NEAR_BOUNDARY_GEOHASH]),
    })
    const snap = await adminDb.collection('report_sharing').doc('r1').get()
    expect(snap.exists).toBe(false)
  })

  it('creates report_sharing with source auto when near boundary', async () => {
    const opsDoc = {
      municipalityId: 'daet',
      locationGeohash: NEAR_BOUNDARY_GEOHASH,
      status: 'verified',
      severity: 'high',
      createdAt: ts,
      updatedAt: ts,
      agencyIds: [],
      activeResponderCount: 0,
      requiresLocationFollowUp: false,
      visibility: { scope: 'municipality', sharedWith: [] },
      schemaVersion: 1,
    }
    // Seed report_private with exactLocation
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'report_private', 'r1'), {
        reportId: 'r1',
        reporterUid: 'u1',
        createdAt: ts,
        schemaVersion: 1,
        exactLocation: { lat: NEAR_BOUNDARY_LAT, lng: NEAR_BOUNDARY_LNG },
      })
    })
    await borderAutoShareCore(adminDb, {
      reportId: 'r1',
      opsData: opsDoc,
      boundaryGeohashSet: new Set<string>([NEAR_BOUNDARY_GEOHASH]),
    })
    const snap = await adminDb.collection('report_sharing').doc('r1').get()
    expect(snap.exists).toBe(true)
    const events = await adminDb.collection('report_sharing').doc('r1').collection('events').get()
    expect(events.docs.some((d) => d.data().source === 'auto')).toBe(true)
  })

  it('does not re-trigger if report already shared with that municipality', async () => {
    const opsDoc = {
      municipalityId: 'daet',
      locationGeohash: NEAR_BOUNDARY_GEOHASH,
      status: 'verified',
      severity: 'high',
      createdAt: ts,
      updatedAt: ts,
      agencyIds: [],
      activeResponderCount: 0,
      requiresLocationFollowUp: false,
      visibility: { scope: 'municipality', sharedWith: ['mercedes'] },
      schemaVersion: 1,
    }
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'report_sharing', 'r1'), {
        ownerMunicipalityId: 'daet',
        reportId: 'r1',
        sharedWith: ['mercedes'],
        createdAt: ts,
        updatedAt: ts,
        schemaVersion: 1,
      })
    })
    await borderAutoShareCore(adminDb, {
      reportId: 'r1',
      opsData: opsDoc,
      boundaryGeohashSet: new Set<string>([NEAR_BOUNDARY_GEOHASH]),
    })
    const events = await adminDb.collection('report_sharing').doc('r1').collection('events').get()
    expect(events.size).toBe(0) // no new event written
  })
})
