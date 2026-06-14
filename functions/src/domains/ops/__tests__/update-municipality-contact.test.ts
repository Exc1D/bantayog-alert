// fallow-ignore-next-line code-duplication
import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest'
import { guardInitTestEnvironment } from '../../../__tests__/helpers/emulator-guard.js'
import {
  updateMunicipalityContactCore,
  type UpdateMunicipalityContactDeps,
} from '../update-municipality-contact.js'
import { type Firestore } from 'firebase-admin/firestore'
import { type RulesTestContext, type RulesTestEnvironment } from '@firebase/rules-unit-testing'

let testEnv: RulesTestEnvironment | undefined
let available = false

const DAET_DOC = {
  id: 'daet',
  label: 'Daet',
  provinceId: 'camarines-norte',
  centroid: { lat: 14.1121, lng: 122.9554 },
  mdrrmoLabel: 'Daet MDRRMO',
  mdrrmoHotline: '(054) 721-1216',
  schemaVersion: 1,
}

const LABO_DOC = {
  id: 'labo',
  label: 'Labo',
  provinceId: 'camarines-norte',
  centroid: { lat: 14.157, lng: 122.83 },
  schemaVersion: 1,
}

const MUNICIPAL_ADMIN_CLAIMS = { role: 'municipal_admin', municipalityId: 'daet' }
const SUPERADMIN_CLAIMS = { role: 'provincial_superadmin' }

async function withRulesDisabled(callback: (ctx: RulesTestContext) => Promise<void>) {
  if (!available || !testEnv) return
  await testEnv.withSecurityRulesDisabled(callback)
}

function asFirestore(ctx: RulesTestContext): Firestore {
  return ctx.firestore() as unknown as Firestore
}

async function seedDaet(ctx: RulesTestContext) {
  const db = asFirestore(ctx)
  await db.collection('municipalities').doc('daet').set(DAET_DOC)
  return db
}

async function seedLabo(ctx: RulesTestContext) {
  const db = asFirestore(ctx)
  await db.collection('municipalities').doc('labo').set(LABO_DOC)
  return db
}

async function expectCoreRejects(deps: UpdateMunicipalityContactDeps, code: string) {
  await withRulesDisabled(async (ctx) => {
    const db = asFirestore(ctx)
    await expect(updateMunicipalityContactCore(db, deps)).rejects.toMatchObject({ code })
  })
}

async function readMunicipalityDoc(db: Firestore, id: string) {
  const doc = (await db.collection('municipalities').doc(id).get()).data()
  if (!doc) throw new Error(`Missing ${id} municipality doc`)
  return doc
}

// fallow-ignore-next-line code-duplication
beforeAll(async () => {
  // streamAuditEvent self-skips BigQuery when FUNCTIONS_EMULATOR is set.
  process.env.FUNCTIONS_EMULATOR = 'true'
  const guarded = await guardInitTestEnvironment(
    {
      projectId: 'update-municipality-contact-test',
      firestore: { host: '127.0.0.1', port: 8081 },
    },
    'update-municipality-contact',
  )
  // fallow-ignore-next-line code-duplication
  testEnv = guarded.env
  available = guarded.available
})

beforeEach(async () => {
  if (!available || !testEnv) return
  await testEnv.clearFirestore()
})

afterAll(async () => {
  await testEnv?.cleanup()
})

describe('updateMunicipalityContactCore', () => {
  it('lets a municipal admin edit their own municipality contact', async ({ skip }) => {
    if (!available || !testEnv) skip()
    await withRulesDisabled(async (ctx) => {
      const db = await seedDaet(ctx)

      const result = await updateMunicipalityContactCore(db, {
        municipalityId: 'daet',
        mdrrmoLabel: 'Daet DRRMO Hotline',
        mdrrmoHotline: '+63 917 555 1234',
        actor: { uid: 'admin-1', claims: MUNICIPAL_ADMIN_CLAIMS },
        now: 1765000000000,
      })

      expect(result.mdrrmoHotline).toBe('+63 917 555 1234')

      const doc = await readMunicipalityDoc(db, 'daet')
      expect(doc.mdrrmoLabel).toBe('Daet DRRMO Hotline')
      expect(doc.mdrrmoHotline).toBe('+63 917 555 1234')
      expect(doc.contactUpdatedAt).toBe(1765000000000)
      expect(doc.contactUpdatedBy).toBe('admin-1')
      // Non-contact fields untouched.
      expect(doc.label).toBe('Daet')
      expect(doc.centroid).toEqual({ lat: 14.1121, lng: 122.9554 })
      expect(doc.schemaVersion).toBe(1)
    })
  })

  it('rejects a municipal admin editing another municipality', async ({ skip }) => {
    if (!available || !testEnv) skip()
    await expectCoreRejects(
      {
        municipalityId: 'daet',
        mdrrmoLabel: 'Hijacked',
        mdrrmoHotline: '(054) 000-0000',
        actor: { uid: 'admin-2', claims: { role: 'municipal_admin', municipalityId: 'labo' } },
        now: 1765000000000,
      },
      'permission-denied',
    )
  })

  it('lets a provincial superadmin edit any municipality', async ({ skip }) => {
    if (!available || !testEnv) skip()
    await withRulesDisabled(async (ctx) => {
      const db = await seedLabo(ctx)

      const result = await updateMunicipalityContactCore(db, {
        municipalityId: 'labo',
        mdrrmoLabel: 'Labo MDRRMO',
        mdrrmoHotline: '(054) 585-1234',
        actor: { uid: 'super-1', claims: SUPERADMIN_CLAIMS },
        now: 1765000001000,
      })

      expect(result.municipalityId).toBe('labo')
      const doc = await readMunicipalityDoc(db, 'labo')
      expect(doc.mdrrmoLabel).toBe('Labo MDRRMO')
      expect(doc.contactUpdatedBy).toBe('super-1')
    })
  })

  it('initializes a known municipality doc before updating contact', async ({ skip }) => {
    if (!available || !testEnv) skip()
    await withRulesDisabled(async (ctx) => {
      const db = asFirestore(ctx)

      const result = await updateMunicipalityContactCore(db, {
        municipalityId: 'labo',
        mdrrmoLabel: 'Labo MDRRMO',
        mdrrmoHotline: '(054) 585-1234',
        actor: { uid: 'super-2', claims: SUPERADMIN_CLAIMS },
        now: 1765000002000,
      })

      expect(result.municipalityId).toBe('labo')
      const doc = await readMunicipalityDoc(db, 'labo')
      expect(doc.label).toBe('Labo')
      expect(doc.centroid).toEqual({ lat: 14.157, lng: 122.83 })
      expect(doc.schemaVersion).toBe(1)
      expect(doc.mdrrmoLabel).toBe('Labo MDRRMO')
      expect(doc.mdrrmoHotline).toBe('(054) 585-1234')
    })
  })

  it('rejects editing a municipality that does not exist', async ({ skip }) => {
    if (!available || !testEnv) skip()
    await expectCoreRejects(
      {
        municipalityId: 'unknown-municipality',
        mdrrmoLabel: 'Unknown MDRRMO',
        mdrrmoHotline: '(054) 585-1234',
        actor: { uid: 'super-1', claims: SUPERADMIN_CLAIMS },
        now: 1765000000000,
      },
      'not-found',
    )
  })

  it('rejects an agency admin', async ({ skip }) => {
    if (!available || !testEnv) skip()
    await expectCoreRejects(
      {
        municipalityId: 'daet',
        mdrrmoLabel: 'Nope',
        mdrrmoHotline: '(054) 000-0000',
        actor: { uid: 'agency-1', claims: { role: 'agency_admin', municipalityId: 'daet' } },
        now: 1765000000000,
      },
      'permission-denied',
    )
  })
})
