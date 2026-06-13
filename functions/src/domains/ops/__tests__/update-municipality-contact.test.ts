/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument */
import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest'
import { type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { guardInitTestEnvironment } from '../../../__tests__/helpers/emulator-guard.js'

vi.mock('firebase-admin/database', () => ({
  getDatabase: vi.fn(() => ({})),
}))

import { updateMunicipalityContactCore } from '../update-municipality-contact.js'

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
    await testEnv!.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore() as any
      await db.collection('municipalities').doc('daet').set(DAET_DOC)

      const result = await updateMunicipalityContactCore(db, {
        municipalityId: 'daet',
        mdrrmoLabel: 'Daet DRRMO Hotline',
        mdrrmoHotline: '+63 917 555 1234',
        actor: { uid: 'admin-1', claims: { role: 'municipal_admin', municipalityId: 'daet' } },
        now: 1765000000000,
      })

      expect(result.mdrrmoHotline).toBe('+63 917 555 1234')

      const doc = (await db.collection('municipalities').doc('daet').get()).data()
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
    await testEnv!.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore() as any
      await db.collection('municipalities').doc('daet').set(DAET_DOC)

      await expect(
        updateMunicipalityContactCore(db, {
          municipalityId: 'daet',
          mdrrmoLabel: 'Hijacked',
          mdrrmoHotline: '(054) 000-0000',
          actor: { uid: 'admin-2', claims: { role: 'municipal_admin', municipalityId: 'labo' } },
          now: 1765000000000,
        }),
      ).rejects.toMatchObject({ code: 'permission-denied' })
    })
  })

  it('lets a provincial superadmin edit any municipality', async ({ skip }) => {
    if (!available || !testEnv) skip()
    await testEnv!.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore() as any
      await db.collection('municipalities').doc('labo').set(LABO_DOC)

      const result = await updateMunicipalityContactCore(db, {
        municipalityId: 'labo',
        mdrrmoLabel: 'Labo MDRRMO',
        mdrrmoHotline: '(054) 585-1234',
        actor: { uid: 'super-1', claims: { role: 'provincial_superadmin' } },
        now: 1765000001000,
      })

      expect(result.municipalityId).toBe('labo')
      const doc = (await db.collection('municipalities').doc('labo').get()).data()
      expect(doc.mdrrmoLabel).toBe('Labo MDRRMO')
      expect(doc.contactUpdatedBy).toBe('super-1')
    })
  })

  it('rejects editing a municipality that does not exist', async ({ skip }) => {
    if (!available || !testEnv) skip()
    await testEnv!.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore() as any
      await expect(
        updateMunicipalityContactCore(db, {
          municipalityId: 'labo',
          mdrrmoLabel: 'Labo MDRRMO',
          mdrrmoHotline: '(054) 585-1234',
          actor: { uid: 'super-1', claims: { role: 'provincial_superadmin' } },
          now: 1765000000000,
        }),
      ).rejects.toMatchObject({ code: 'not-found' })
    })
  })

  it('rejects an agency admin', async ({ skip }) => {
    if (!available || !testEnv) skip()
    await testEnv!.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore() as any
      await db.collection('municipalities').doc('daet').set(DAET_DOC)

      await expect(
        updateMunicipalityContactCore(db, {
          municipalityId: 'daet',
          mdrrmoLabel: 'Nope',
          mdrrmoHotline: '(054) 000-0000',
          actor: { uid: 'agency-1', claims: { role: 'agency_admin', municipalityId: 'daet' } },
          now: 1765000000000,
        }),
      ).rejects.toMatchObject({ code: 'permission-denied' })
    })
  })
})
