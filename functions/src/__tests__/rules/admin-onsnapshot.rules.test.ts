/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument */
import { describe, it, beforeEach } from 'vitest'
import {
  initializeTestEnvironment,
  type RulesTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { setDoc, doc } from 'firebase/firestore'
import type { Firestore } from 'firebase-admin/firestore'

const FIRESTORE_RULES_PATH = resolve(process.cwd(), '../infra/firebase/firestore.rules')
const ts = 1713350400000

let testEnv: RulesTestEnvironment | undefined
let firestoreAvailable = false

try {
  testEnv = await initializeTestEnvironment({
    projectId: 'admin-onsnapshot-rules-test',
    firestore: {
      host: '127.0.0.1',
      port: 8081,
      rules: readFileSync(FIRESTORE_RULES_PATH, 'utf8'),
    },
  })
  firestoreAvailable = true
} catch (err) {
  console.warn(
    '[admin-onsnapshot.rules.test] Firestore emulator unavailable; tests will be skipped.',
    err,
  )
  firestoreAvailable = false
}

const itif = (condition: boolean) =>
  condition ||
  process.env.FIRESTORE_EMULATOR_HOST ||
  process.env.FIREBASE_DATABASE_EMULATOR_HOST ||
  process.env.FIREBASE_STORAGE_EMULATOR_HOST
    ? it
    : it.skip

function seedReport(db: any, reportId: string, municipalityId: string, status: string) {
  return setDoc(doc(db, 'reports', reportId), {
    reportId,
    status,
    municipalityId,
    municipalityLabel: 'Daet',
    source: 'citizen_pwa',
    severityDerived: 'medium',
    correlationId: crypto.randomUUID(),
    visibilityClass: 'internal',
    createdAt: ts,
    lastStatusAt: ts,
    lastStatusBy: 'system:seed',
    schemaVersion: 1,
  })
}

beforeEach(async () => {
  if (!firestoreAvailable || !testEnv) return
  await testEnv.clearFirestore()
})

describe('admin muni-scoped onSnapshot queue', () => {
  itif(firestoreAvailable)(
    'allows muni admin to read reports filtered by own municipalityId + queue statuses',
    async () => {
      await testEnv!.withSecurityRulesDisabled(async (ctx) => {
        const db = ctx.firestore() as any
        await seedReport(db, 'r1', 'daet', 'new')
        await seedReport(db, 'r2', 'daet', 'awaiting_verify')
        await setDoc(doc(db, 'users', 'admin-1'), {
          uid: 'admin-1',
          role: 'municipal_admin',
          municipalityId: 'daet',
          isActive: true,
          schemaVersion: 1,
        })
      })

      const adminDb = testEnv!
        .authenticatedContext('admin-1', {
          role: 'municipal_admin',
          municipalityId: 'daet',
          accountStatus: 'active',
        })
        .firestore() as unknown as Firestore

      await assertSucceeds(
        adminDb
          .collection('reports')
          .where('municipalityId', '==', 'daet')
          .where('status', 'in', ['new', 'awaiting_verify'])
          .get(),
      )
    },
  )

  itif(firestoreAvailable)('denies cross-muni reads', async () => {
    await testEnv!.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore() as any
      await seedReport(db, 'rx', 'mercedes', 'new')
      await setDoc(doc(db, 'users', 'admin-1'), {
        uid: 'admin-1',
        role: 'municipal_admin',
        municipalityId: 'daet',
        isActive: true,
        schemaVersion: 1,
      })
    })
    const adminDb = testEnv!
      .authenticatedContext('admin-1', {
        role: 'municipal_admin',
        municipalityId: 'daet',
        accountStatus: 'active',
      })
      .firestore() as unknown as Firestore

    await assertFails(adminDb.collection('reports').where('municipalityId', '==', 'mercedes').get())
  })

  itif(firestoreAvailable)('denies unauthenticated reads', async () => {
    const anon = testEnv!.unauthenticatedContext().firestore() as unknown as Firestore
    await assertFails(anon.collection('reports').where('municipalityId', '==', 'daet').get())
  })

  itif(firestoreAvailable)('denies citizen-role reads', async () => {
    await testEnv!.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore() as any
      await setDoc(doc(db, 'users', 'cit-1'), {
        uid: 'cit-1',
        role: 'citizen',
        isActive: true,
        schemaVersion: 1,
      })
    })
    const citDb = testEnv!
      .authenticatedContext('cit-1', { role: 'citizen', accountStatus: 'active' })
      .firestore() as unknown as Firestore
    await assertFails(citDb.collection('reports').where('municipalityId', '==', 'daet').get())
  })
})
