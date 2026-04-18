#!/usr/bin/env tsx
/**
 * Bootstrap Camarines Norte municipalities into Firestore.
 *
 * Usage (emulator):
 *   firebase emulators:exec --only firestore \
 *     "pnpm tsx scripts/bootstrap-municipalities.ts"
 *
 * Usage (staging/prod):
 *   GOOGLE_APPLICATION_CREDENTIALS=./sa.json \
 *     pnpm tsx scripts/bootstrap-municipalities.ts
 */
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { CAMARINES_NORTE_MUNICIPALITIES } from '../packages/shared-validators/src/municipalities.js'

async function main(): Promise<void> {
  const env = process.env.FIRESTORE_EMULATOR_HOST ? 'emulator' : 'remote'
  console.log(`Bootstrapping municipalities (env=${env})...`)

  if (env === 'emulator') {
    initializeApp({
      projectId: process.env.FIRESTORE_EMULATOR_HOST?.includes(':8080')
        ? 'bantayog-alert-dev'
        : 'bantayog-alert-acceptance',
    })
  } else {
    const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS
    if (!keyPath) {
      throw new Error('Set GOOGLE_APPLICATION_CREDENTIALS to a service-account JSON path.')
    }
    initializeApp({ credential: cert(keyPath) })
  }

  const db = getFirestore()

  const batch = db.batch()
  for (const m of CAMARINES_NORTE_MUNICIPALITIES) {
    const ref = db.collection('municipalities').doc(m.id)
    batch.set(ref, { ...m, schemaVersion: 1 })
  }

  await batch.commit()
  console.log(`✅ Seeded ${CAMARINES_NORTE_MUNICIPALITIES.length} municipalities.`)

  // Verify
  const snap = await db.collection('municipalities').limit(1).get()
  if (snap.empty) {
    throw new Error('Verification failed: no municipalities found after write.')
  }
  console.log('✅ Verification passed.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
