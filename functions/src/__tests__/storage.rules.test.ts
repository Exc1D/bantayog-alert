import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import { afterAll, beforeAll, describe, it } from 'vitest'
import { createTestEnv } from './helpers/rules-harness.js'
import { seedActiveAccount, staffClaims } from './helpers/seed-factories.js'

let env: Awaited<ReturnType<typeof createTestEnv>>

beforeAll(async () => {
  env = await createTestEnv('demo-phase-2-storage')
  await seedActiveAccount(env, {
    uid: 'daet-admin',
    role: 'municipal_admin',
    municipalityId: 'daet',
  })
  await seedActiveAccount(env, {
    uid: 'mercedes-admin',
    role: 'municipal_admin',
    municipalityId: 'mercedes',
  })
  await seedActiveAccount(env, {
    uid: 'super-1',
    role: 'provincial_superadmin',
    permittedMunicipalityIds: ['daet', 'mercedes'],
  })
  await seedActiveAccount(env, {
    uid: 'super-no-muni',
    role: 'provincial_superadmin',
    permittedMunicipalityIds: [],
  })
  await seedActiveAccount(env, {
    uid: 'resp-1',
    role: 'responder',
    agencyId: 'bfp',
    municipalityId: 'daet',
  })
  await seedActiveAccount(env, {
    uid: 'citizen-1',
    role: 'citizen',
  })
  await seedActiveAccount(env, {
    uid: 'agency-admin',
    role: 'agency_admin',
    agencyId: 'bfp',
    municipalityId: 'daet',
  })

  await env.withSecurityRulesDisabled(async (ctx) => {
    const storage = ctx.storage()
    await storage.ref('report_media/daet/r1/test.jpg').put(new Uint8Array([1]))
    await storage.ref('report_media/mercedes/r2/test.jpg').put(new Uint8Array([1]))
    await storage.ref('hazard_layers/v1/camiguin.geojson').put(new Uint8Array([1]))
  })
})

afterAll(async () => {
  await env.cleanup()
})

describe('report_media — write operations', () => {
  it('citizen write to report_media fails', async () => {
    const storage = env
      .authenticatedContext('citizen-1', staffClaims({ role: 'citizen' }))
      .storage()
    await assertFails(storage.ref('report_media/daet/r1/photo.jpg').put(new Uint8Array([1])))
  })

  it('responder write to report_media fails', async () => {
    const storage = env
      .authenticatedContext(
        'resp-1',
        staffClaims({ role: 'responder', agencyId: 'bfp', municipalityId: 'daet' }),
      )
      .storage()
    await assertFails(storage.ref('report_media/daet/r1/photo.jpg').put(new Uint8Array([1])))
  })

  it('muni admin write to report_media fails', async () => {
    const storage = env
      .authenticatedContext(
        'daet-admin',
        staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
      )
      .storage()
    await assertFails(storage.ref('report_media/daet/r1/photo.jpg').put(new Uint8Array([1])))
  })

  it('agency admin write to report_media fails', async () => {
    const storage = env
      .authenticatedContext(
        'agency-admin',
        staffClaims({ role: 'agency_admin', agencyId: 'bfp', municipalityId: 'daet' }),
      )
      .storage()
    await assertFails(storage.ref('report_media/daet/r1/photo.jpg').put(new Uint8Array([1])))
  })

  it('superadmin write to report_media fails', async () => {
    const storage = env
      .authenticatedContext(
        'super-1',
        staffClaims({
          role: 'provincial_superadmin',
          permittedMunicipalityIds: ['daet', 'mercedes'],
        }),
      )
      .storage()
    await assertFails(storage.ref('report_media/daet/r1/photo.jpg').put(new Uint8Array([1])))
  })
})

describe('report_media — read operations', () => {
  it('muni admin reads own-muni report_media succeeds', async () => {
    const storage = env
      .authenticatedContext(
        'daet-admin',
        staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
      )
      .storage()
    await assertSucceeds(storage.ref('report_media/daet/r1/test.jpg').getMetadata())
  })

  it('muni admin reads other-muni report_media fails', async () => {
    const storage = env
      .authenticatedContext(
        'daet-admin',
        staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
      )
      .storage()
    await assertFails(storage.ref('report_media/mercedes/r2/test.jpg').getMetadata())
  })

  it('superadmin reads report_media with permittedMunicipalityIds succeeds', async () => {
    const storage = env
      .authenticatedContext(
        'super-1',
        staffClaims({
          role: 'provincial_superadmin',
          permittedMunicipalityIds: ['daet', 'mercedes'],
        }),
      )
      .storage()
    await assertSucceeds(storage.ref('report_media/daet/r1/test.jpg').getMetadata())
    await assertSucceeds(storage.ref('report_media/mercedes/r2/test.jpg').getMetadata())
  })

  it('superadmin reads report_media NOT in permittedMunicipalityIds fails', async () => {
    const storage = env
      .authenticatedContext(
        'super-no-muni',
        staffClaims({ role: 'provincial_superadmin', permittedMunicipalityIds: [] }),
      )
      .storage()
    await assertFails(storage.ref('report_media/daet/r1/test.jpg').getMetadata())
  })

  it('citizen read report_media fails', async () => {
    const storage = env
      .authenticatedContext('citizen-1', staffClaims({ role: 'citizen' }))
      .storage()
    await assertFails(storage.ref('report_media/daet/r1/test.jpg').getMetadata())
  })

  it('responder read report_media fails', async () => {
    const storage = env
      .authenticatedContext(
        'resp-1',
        staffClaims({ role: 'responder', agencyId: 'bfp', municipalityId: 'daet' }),
      )
      .storage()
    await assertFails(storage.ref('report_media/daet/r1/test.jpg').getMetadata())
  })

  it('agency admin read report_media fails', async () => {
    const storage = env
      .authenticatedContext(
        'agency-admin',
        staffClaims({ role: 'agency_admin', agencyId: 'bfp', municipalityId: 'daet' }),
      )
      .storage()
    await assertFails(storage.ref('report_media/daet/r1/test.jpg').getMetadata())
  })
})

describe('hazard_layers — write operations', () => {
  it('any role write to hazard_layers fails', async () => {
    const storage = env
      .authenticatedContext(
        'super-1',
        staffClaims({
          role: 'provincial_superadmin',
          permittedMunicipalityIds: ['daet', 'mercedes'],
        }),
      )
      .storage()
    await assertFails(storage.ref('hazard_layers/v2/new.geojson').put(new Uint8Array([1])))
  })
})

describe('hazard_layers — read operations', () => {
  it('superadmin reads hazard_layers succeeds', async () => {
    const storage = env
      .authenticatedContext(
        'super-1',
        staffClaims({
          role: 'provincial_superadmin',
          permittedMunicipalityIds: ['daet', 'mercedes'],
        }),
      )
      .storage()
    await assertSucceeds(storage.ref('hazard_layers/v1/camiguin.geojson').getMetadata())
  })

  it('muni admin read hazard_layers fails', async () => {
    const storage = env
      .authenticatedContext(
        'daet-admin',
        staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
      )
      .storage()
    await assertFails(storage.ref('hazard_layers/v1/camiguin.geojson').getMetadata())
  })

  it('citizen read hazard_layers fails', async () => {
    const storage = env
      .authenticatedContext('citizen-1', staffClaims({ role: 'citizen' }))
      .storage()
    await assertFails(storage.ref('hazard_layers/v1/camiguin.geojson').getMetadata())
  })

  it('responder read hazard_layers fails', async () => {
    const storage = env
      .authenticatedContext(
        'resp-1',
        staffClaims({ role: 'responder', agencyId: 'bfp', municipalityId: 'daet' }),
      )
      .storage()
    await assertFails(storage.ref('hazard_layers/v1/camiguin.geojson').getMetadata())
  })
})

describe('default-deny — unmatched paths', () => {
  it('any write to unmapped path fails', async () => {
    const storage = env
      .authenticatedContext(
        'super-1',
        staffClaims({
          role: 'provincial_superadmin',
          permittedMunicipalityIds: ['daet', 'mercedes'],
        }),
      )
      .storage()
    await assertFails(storage.ref('other_path/file.txt').put(new Uint8Array([1])))
  })

  it('any read from unmapped path fails', async () => {
    const storage = env
      .authenticatedContext(
        'super-1',
        staffClaims({
          role: 'provincial_superadmin',
          permittedMunicipalityIds: ['daet', 'mercedes'],
        }),
      )
      .storage()
    await assertFails(storage.ref('other_path/file.txt').getMetadata())
  })
})
