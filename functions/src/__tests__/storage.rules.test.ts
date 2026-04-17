import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { afterAll, beforeAll, describe, it } from 'vitest'

let testEnv: RulesTestEnvironment

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-storage-rules',
    storage: {
      rules: readFileSync(resolve(process.cwd(), '../infra/firebase/storage.rules'), 'utf8'),
      host: '127.0.0.1',
      port: 9199,
    },
  })

  // Seed storage objects with admin privileges (rules disabled)
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const storage = context.storage()

    // report_media for daet municipality
    await storage
      .ref('report_media/daet/report-1/photo.jpg')
      .put(new TextEncoder().encode('fake-image-data'), {
        contentType: 'image/jpeg',
      })
    await storage
      .ref('report_media/daet/report-2/photo.jpg')
      .put(new TextEncoder().encode('fake-image-data'), {
        contentType: 'image/jpeg',
      })

    // report_media for mercedes municipality
    await storage
      .ref('report_media/mercedes/report-3/photo.jpg')
      .put(new TextEncoder().encode('fake-image-data'), {
        contentType: 'image/jpeg',
      })

    // hazard_layers
    await storage
      .ref('hazard_layers/v1/base.geojson')
      .put(new TextEncoder().encode('fake-geojson-data'), {
        contentType: 'application/geo+json',
      })
    await storage
      .ref('hazard_layers/v2/overlay.geojson')
      .put(new TextEncoder().encode('fake-geojson-data'), {
        contentType: 'application/geo+json',
      })
  })
})

afterAll(async () => {
  await testEnv.cleanup()
})

// ================================================================
// Write tests — all roles blocked
// ================================================================
describe('storage write — all roles blocked', () => {
  const cases: { label: string; uid: string; token: Record<string, unknown> }[] = [
    { label: 'citizen', uid: 'citizen-1', token: { role: 'citizen', accountStatus: 'active' } },
    {
      label: 'responder',
      uid: 'responder-1',
      token: { role: 'responder', accountStatus: 'active', municipalityId: 'daet' },
    },
    {
      label: 'muni_admin',
      uid: 'muni-admin-daet',
      token: { role: 'municipal_admin', accountStatus: 'active', municipalityId: 'daet' },
    },
    {
      label: 'agency_admin',
      uid: 'agency-admin-1',
      token: { role: 'agency_admin', accountStatus: 'active', agencyId: 'agency-a' },
    },
    {
      label: 'superadmin',
      uid: 'super-1',
      token: {
        role: 'provincial_superadmin',
        accountStatus: 'active',
        permittedMunicipalityIds: ['daet'],
      },
    },
  ]

  cases.forEach(({ label, uid, token }) => {
    it(`write to report_media/${label} fails`, async () => {
      const storage = testEnv.authenticatedContext(uid, token).storage()
      const ref = storage.ref('report_media/daet/report-new/photo.jpg')
      await assertFails(
        (async () => {
          const task = ref.put(new TextEncoder().encode('new-data'), { contentType: 'image/jpeg' })
          await new Promise((resolve, reject) => {
            task.then(resolve, reject)
          })
        })(),
      )
    })

    it(`write to hazard_layers/${label} fails`, async () => {
      const storage = testEnv.authenticatedContext(uid, token).storage()
      const ref = storage.ref('hazard_layers/v99/new.geojson')
      await assertFails(
        (async () => {
          const task = ref.put(new TextEncoder().encode('new-data'), {
            contentType: 'application/geo+json',
          })
          await new Promise((resolve, reject) => {
            task.then(resolve, reject)
          })
        })(),
      )
    })
  })
})

// ================================================================
// report_media — municipal_admin
// ================================================================
describe('report_media read — municipal_admin', () => {
  it('muni admin reads own-muni report_media/{muni}/{reportId}/x.jpg (positive)', async () => {
    const storage = testEnv
      .authenticatedContext('muni-admin-daet', {
        role: 'municipal_admin',
        accountStatus: 'active',
        municipalityId: 'daet',
      })
      .storage()

    await assertSucceeds(storage.ref('report_media/daet/report-1/photo.jpg').getMetadata())
  })

  it('muni admin reads other-muni path fails', async () => {
    const storage = testEnv
      .authenticatedContext('muni-admin-daet', {
        role: 'municipal_admin',
        accountStatus: 'active',
        municipalityId: 'daet',
      })
      .storage()

    await assertFails(storage.ref('report_media/mercedes/report-3/photo.jpg').getMetadata())
  })
})

// ================================================================
// report_media — superadmin
// ================================================================
describe('report_media read — superadmin', () => {
  it('superadmin reads with municipality in permittedMunicipalityIds (positive)', async () => {
    const storage = testEnv
      .authenticatedContext('super-1', {
        role: 'provincial_superadmin',
        accountStatus: 'active',
        permittedMunicipalityIds: ['daet'],
      })
      .storage()

    await assertSucceeds(storage.ref('report_media/daet/report-1/photo.jpg').getMetadata())
  })

  it('superadmin reads with municipality NOT in permittedMunicipalityIds fails', async () => {
    const storage = testEnv
      .authenticatedContext('super-1', {
        role: 'provincial_superadmin',
        accountStatus: 'active',
        permittedMunicipalityIds: ['daet'], // only daet permitted, not mercedes
      })
      .storage()

    await assertFails(storage.ref('report_media/mercedes/report-3/photo.jpg').getMetadata())
  })
})

// ================================================================
// report_media — other roles denied
// ================================================================
describe('report_media read — other roles', () => {
  it('citizen read report_media fails', async () => {
    const storage = testEnv
      .authenticatedContext('citizen-1', {
        role: 'citizen',
        accountStatus: 'active',
      })
      .storage()

    await assertFails(storage.ref('report_media/daet/report-1/photo.jpg').getMetadata())
  })

  it('responder read report_media fails', async () => {
    const storage = testEnv
      .authenticatedContext('responder-1', {
        role: 'responder',
        accountStatus: 'active',
        municipalityId: 'daet',
      })
      .storage()

    await assertFails(storage.ref('report_media/daet/report-1/photo.jpg').getMetadata())
  })

  it('agency_admin read report_media fails', async () => {
    const storage = testEnv
      .authenticatedContext('agency-admin-1', {
        role: 'agency_admin',
        accountStatus: 'active',
        agencyId: 'agency-a',
      })
      .storage()

    await assertFails(storage.ref('report_media/daet/report-1/photo.jpg').getMetadata())
  })
})

// ================================================================
// hazard_layers — superadmin read
// ================================================================
describe('hazard_layers read — superadmin', () => {
  it('superadmin reads hazard_layers/{version}/x.geojson (positive)', async () => {
    const storage = testEnv
      .authenticatedContext('super-1', {
        role: 'provincial_superadmin',
        accountStatus: 'active',
        permittedMunicipalityIds: ['daet'],
      })
      .storage()

    await assertSucceeds(storage.ref('hazard_layers/v1/base.geojson').getMetadata())
  })
})

// ================================================================
// hazard_layers — non-superadmin denied
// ================================================================
describe('hazard_layers read — non-superadmin', () => {
  it('muni_admin read hazard_layers fails', async () => {
    const storage = testEnv
      .authenticatedContext('muni-admin-daet', {
        role: 'municipal_admin',
        accountStatus: 'active',
        municipalityId: 'daet',
      })
      .storage()

    await assertFails(storage.ref('hazard_layers/v1/base.geojson').getMetadata())
  })

  it('citizen read hazard_layers fails', async () => {
    const storage = testEnv
      .authenticatedContext('citizen-1', {
        role: 'citizen',
        accountStatus: 'active',
      })
      .storage()

    await assertFails(storage.ref('hazard_layers/v1/base.geojson').getMetadata())
  })

  it('responder read hazard_layers fails', async () => {
    const storage = testEnv
      .authenticatedContext('responder-1', {
        role: 'responder',
        accountStatus: 'active',
        municipalityId: 'daet',
      })
      .storage()

    await assertFails(storage.ref('hazard_layers/v1/base.geojson').getMetadata())
  })

  it('agency_admin read hazard_layers fails', async () => {
    const storage = testEnv
      .authenticatedContext('agency-admin-1', {
        role: 'agency_admin',
        accountStatus: 'active',
        agencyId: 'agency-a',
      })
      .storage()

    await assertFails(storage.ref('hazard_layers/v1/base.geojson').getMetadata())
  })
})

// ================================================================
// Unmatched paths deny-default
// ================================================================
describe('unmatched paths deny-default', () => {
  it('superadmin read unknown path fails', async () => {
    const storage = testEnv
      .authenticatedContext('super-1', {
        role: 'provincial_superadmin',
        accountStatus: 'active',
        permittedMunicipalityIds: ['daet'],
      })
      .storage()

    await assertFails(storage.ref('unknown/path/file.txt').getMetadata())
  })

  it('muni_admin read unknown path fails', async () => {
    const storage = testEnv
      .authenticatedContext('muni-admin-daet', {
        role: 'municipal_admin',
        accountStatus: 'active',
        municipalityId: 'daet',
      })
      .storage()

    await assertFails(storage.ref('unknown/path/file.txt').getMetadata())
  })
})
