#!/usr/bin/env tsx
/**
 * Staging Reset Script
 *
 * Deletes the known seed documents from the staging Firebase project.
 *
 * SAFETY RULES:
 *   - Refuses to run if FIRESTORE_EMULATOR_HOST is set.
 *   - Refuses to run against production project "bantayog-alert".
 *   - Requires explicit GOOGLE_APPLICATION_CREDENTIALS or gcloud auth.
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=path/to/service-account.json \
 *     pnpm exec tsx scripts/staging-reset.ts
 *
 *   # Or via package script:
 *   pnpm staging:reset
 */

import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { initializeApp, getApps, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { assertStagingAllowed, buildResetPaths } from './staging-seed.js'

const STAGING_PROJECT_ID = 'bantayog-alert-staging'

function getDb() {
  if (getApps().length === 0) {
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim()) {
      initializeApp({
        credential: cert(resolve(process.env.GOOGLE_APPLICATION_CREDENTIALS)),
        projectId: STAGING_PROJECT_ID,
      })
    } else {
      initializeApp({ projectId: STAGING_PROJECT_ID })
    }
  }
  return getFirestore()
}

async function main() {
  assertStagingAllowed()
  const db = getDb()
  console.log(`\nStaging reset — ${STAGING_PROJECT_ID} — ${new Date().toISOString()}\n`)
  const paths = buildResetPaths()
  const batch = db.batch()
  for (const path of paths) {
    batch.delete(db.doc(path))
  }
  await batch.commit()
  console.log(`  ${paths.length} seed documents reset`)
  console.log('\nStaging reset complete.')
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((err: unknown) => {
    console.error('\nStaging reset failed:', err instanceof Error ? err.message : String(err))
    process.exit(1)
  })
}
