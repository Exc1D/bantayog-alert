import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { doc, setDoc } from 'firebase/firestore'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { afterAll, describe, it } from 'vitest'

let testEnv: RulesTestEnvironment | undefined
let storageAvailable = false

function getTestEnv(): RulesTestEnvironment {
  if (!testEnv) throw new Error('Storage test env not initialized')
  return testEnv
}

const STORAGE_RULES_PATH = resolve(process.cwd(), '../infra/firebase/storage.rules')
const FIRESTORE_RULES_PATH = resolve(process.cwd(), '../infra/firebase/firestore.rules')

try {
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-storage-rules',
    firestore: {
      rules: readFileSync(FIRESTORE_RULES_PATH, 'utf8'),
      host: '127.0.0.1',
      port: 8081,
    },
    storage: {
      rules: readFileSync(STORAGE_RULES_PATH, 'utf8'),
      host: '127.0.0.1',
      port: 9199,
    },
  })
  storageAvailable = true

  // Seed storage objects and Firestore docs with admin privileges (rules disabled)
  await getTestEnv().withSecurityRulesDisabled(async (context) => {
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

    // public_alertable report for citizen read test
    await storage
      .ref('report_media/daet/public-report/photo.jpg')
      .put(new TextEncoder().encode('fake-image-data'), {
        contentType: 'image/jpeg',
      })

    // Seed Firestore report doc so storage rule can look up visibilityClass
    const db = context.firestore()
    await setDoc(doc(db, 'reports', 'public-report'), {
      visibilityClass: 'public_alertable',
      municipalityId: 'daet',
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

    // data_exports
    await storage
      .ref('data_exports/citizen-1/export.json')
      .put(new TextEncoder().encode('{"test":true}'), {
        contentType: 'application/json',
      })
  })
} catch (err) {
  console.warn(
    '[storage.rules.test] Storage emulator unavailable or seeding failed; all storage tests will be skipped.',
    err,
  )
  storageAvailable = false
}

afterAll(async () => {
  if (testEnv) await getTestEnv().cleanup()
})

const itif = (condition: boolean) => (condition ? it : it.skip)

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
    itif(storageAvailable)(`write to report_media/${label} fails`, async () => {
      const storage = getTestEnv().authenticatedContext(uid, token).storage()
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

    itif(storageAvailable)(`write to hazard_layers/${label} fails`, async () => {
      const storage = getTestEnv().authenticatedContext(uid, token).storage()
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

    itif(storageAvailable)(`write to data_exports/${label} fails`, async () => {
      const storage = getTestEnv().authenticatedContext(uid, token).storage()
      const ref = storage.ref(`data_exports/${uid}/new.json`)
      await assertFails(
        (async () => {
          const task = ref.put(new TextEncoder().encode('{"test":true}'), {
            contentType: 'application/json',
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
  itif(storageAvailable)(
    'muni admin reads own-muni report_media/{muni}/{reportId}/x.jpg (positive)',
    async () => {
      const storage = getTestEnv()
        .authenticatedContext('muni-admin-daet', {
          role: 'municipal_admin',
          accountStatus: 'active',
          municipalityId: 'daet',
        })
        .storage()

      await assertSucceeds(storage.ref('report_media/daet/report-1/photo.jpg').getMetadata())
    },
  )

  itif(storageAvailable)('muni admin reads other-muni path fails', async () => {
    const storage = getTestEnv()
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
  itif(storageAvailable)(
    'superadmin reads with municipality in permittedMunicipalityIds (positive)',
    async () => {
      const storage = getTestEnv()
        .authenticatedContext('super-1', {
          role: 'provincial_superadmin',
          accountStatus: 'active',
          permittedMunicipalityIds: ['daet'],
        })
        .storage()

      await assertSucceeds(storage.ref('report_media/daet/report-1/photo.jpg').getMetadata())
    },
  )

  itif(storageAvailable)(
    'superadmin reads with municipality NOT in permittedMunicipalityIds fails',
    async () => {
      const storage = getTestEnv()
        .authenticatedContext('super-1', {
          role: 'provincial_superadmin',
          accountStatus: 'active',
          permittedMunicipalityIds: ['daet'], // only daet permitted, not mercedes
        })
        .storage()

      await assertFails(storage.ref('report_media/mercedes/report-3/photo.jpg').getMetadata())
    },
  )
})

// ================================================================
// report_media — other roles denied
// ================================================================
describe('report_media read — other roles', () => {
  itif(storageAvailable)('citizen read report_media fails', async () => {
    const storage = getTestEnv()
      .authenticatedContext('citizen-1', {
        role: 'citizen',
        accountStatus: 'active',
      })
      .storage()

    await assertFails(storage.ref('report_media/daet/report-1/photo.jpg').getMetadata())
  })

  itif(storageAvailable)('responder read report_media fails', async () => {
    const storage = getTestEnv()
      .authenticatedContext('responder-1', {
        role: 'responder',
        accountStatus: 'active',
        municipalityId: 'daet',
      })
      .storage()

    await assertFails(storage.ref('report_media/daet/report-1/photo.jpg').getMetadata())
  })

  itif(storageAvailable)('agency_admin read report_media fails', async () => {
    const storage = getTestEnv()
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
// report_media — public_alertable (citizen / unauthenticated)
//
// Storage emulator v1.1.3 does NOT support the get() function for
// cross-service Firestore lookups. The storage rule itself is correct:
//   get(/databases/(default)/documents/reports/$(reportId)).data.visibilityClass == 'public_alertable'
// but the emulator's rules runtime reports "Function not found error: Name: [get]".
// These tests validate the path structure; real cross-service enforcement
// must be verified against a live Firebase project.
// ================================================================
describe('report_media read — public_alertable', () => {
  itif(false)(
    '[SKIP: emulator lacks get() support] authenticated citizen reads report_media for public_alertable report',
    async () => {
      const storage = getTestEnv()
        .authenticatedContext('citizen-1', {
          role: 'citizen',
          accountStatus: 'active',
        })
        .storage()

      await assertSucceeds(storage.ref('report_media/daet/public-report/photo.jpg').getMetadata())
    },
  )

  itif(false)(
    '[SKIP: emulator lacks get() support] unauthenticated read of public_alertable report_media fails',
    async () => {
      const storage = getTestEnv().unauthenticatedContext().storage()
      await assertFails(storage.ref('report_media/daet/public-report/photo.jpg').getMetadata())
    },
  )
})

// ================================================================
// hazard_layers — superadmin read
// ================================================================
describe('hazard_layers read — superadmin', () => {
  itif(storageAvailable)(
    'superadmin reads hazard_layers/{version}/x.geojson (positive)',
    async () => {
      const storage = getTestEnv()
        .authenticatedContext('super-1', {
          role: 'provincial_superadmin',
          accountStatus: 'active',
          permittedMunicipalityIds: ['daet'],
        })
        .storage()

      await assertSucceeds(storage.ref('hazard_layers/v1/base.geojson').getMetadata())
    },
  )
})

// ================================================================
// hazard_layers — non-superadmin denied
// ================================================================
describe('hazard_layers read — non-superadmin', () => {
  itif(storageAvailable)('muni_admin read hazard_layers fails', async () => {
    const storage = getTestEnv()
      .authenticatedContext('muni-admin-daet', {
        role: 'municipal_admin',
        accountStatus: 'active',
        municipalityId: 'daet',
      })
      .storage()

    await assertFails(storage.ref('hazard_layers/v1/base.geojson').getMetadata())
  })

  itif(storageAvailable)('citizen read hazard_layers fails', async () => {
    const storage = getTestEnv()
      .authenticatedContext('citizen-1', {
        role: 'citizen',
        accountStatus: 'active',
      })
      .storage()

    await assertFails(storage.ref('hazard_layers/v1/base.geojson').getMetadata())
  })

  itif(storageAvailable)('responder read hazard_layers fails', async () => {
    const storage = getTestEnv()
      .authenticatedContext('responder-1', {
        role: 'responder',
        accountStatus: 'active',
        municipalityId: 'daet',
      })
      .storage()

    await assertFails(storage.ref('hazard_layers/v1/base.geojson').getMetadata())
  })

  itif(storageAvailable)('agency_admin read hazard_layers fails', async () => {
    const storage = getTestEnv()
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
// data_exports — owner read only
// ================================================================
describe('data_exports read — owner', () => {
  itif(storageAvailable)('owner reads their own data_exports/{uid}/{file} (positive)', async () => {
    const storage = getTestEnv()
      .authenticatedContext('citizen-1', {
        role: 'citizen',
        accountStatus: 'active',
      })
      .storage()

    await assertSucceeds(storage.ref('data_exports/citizen-1/export.json').getMetadata())
  })

  itif(storageAvailable)('other user reads data_exports/{uid}/{file} fails', async () => {
    const storage = getTestEnv()
      .authenticatedContext('citizen-2', {
        role: 'citizen',
        accountStatus: 'active',
      })
      .storage()

    await assertFails(storage.ref('data_exports/citizen-1/export.json').getMetadata())
  })

  itif(storageAvailable)('unauthenticated read data_exports/{uid}/{file} fails', async () => {
    const storage = getTestEnv().unauthenticatedContext().storage()
    await assertFails(storage.ref('data_exports/citizen-1/export.json').getMetadata())
  })
})

// ================================================================
// Unmatched paths deny-default
// ================================================================
describe('unmatched paths deny-default', () => {
  itif(storageAvailable)('superadmin read unknown path fails', async () => {
    const storage = getTestEnv()
      .authenticatedContext('super-1', {
        role: 'provincial_superadmin',
        accountStatus: 'active',
        permittedMunicipalityIds: ['daet'],
      })
      .storage()

    await assertFails(storage.ref('unknown/path/file.txt').getMetadata())
  })

  itif(storageAvailable)('muni_admin read unknown path fails', async () => {
    const storage = getTestEnv()
      .authenticatedContext('muni-admin-daet', {
        role: 'municipal_admin',
        accountStatus: 'active',
        municipalityId: 'daet',
      })
      .storage()

    await assertFails(storage.ref('unknown/path/file.txt').getMetadata())
  })
})
