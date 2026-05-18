#!/usr/bin/env tsx
/**
 * Manual processInboxItem fallback for local emulator testing.
 *
 * When the Firebase emulator's `onDocumentCreated` trigger for
 * `report_inbox/{inboxId}` crashes due to protobuf decoding
 * (firebase-functions v7.x + firebase-tools v15.x bug), this script
 * can be run manually to process unprocessed inbox items.
 *
 * Usage:
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8081 \
 *     pnpm exec tsx functions/scripts/process-inbox-manual.ts
 */

import { initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { processInboxItemCore } from '../src/triggers/process-inbox-item.js'

const PROJECT_ID = 'bantayog-alert-staging'

if (getApps().length === 0) {
  initializeApp({ projectId: PROJECT_ID })
}

const db = getFirestore()

async function main() {
  console.log('🔧 Manual inbox processing fallback\n')

  // Find all report_inbox items without processedAt
  // Use list (all docs) since .where('processedAt', '==', null)
  // only matches docs where the field exists and is null, not docs
  // where the field is absent.
  const snapshot = await db.collection('report_inbox').get()

  const unprocessedDocs = snapshot.docs.filter(
    (d) => d.data().processedAt === undefined || d.data().processedAt === null,
  )

  if (unprocessedDocs.length === 0) {
    console.log('No unprocessed report_inbox items found.')
    return
  }

  console.log(`Found ${unprocessedDocs.length} unprocessed inbox item(s).\n`)

  for (const doc of unprocessedDocs) {
    const inboxId = doc.id
    console.log(`Processing inbox ${inboxId}...`)
    try {
      const result = await processInboxItemCore({ db, inboxId })
      console.log(
        `  ✅ Materialized: ${result.materialized}, Report ID: ${result.reportId}, Public Ref: ${result.publicRef}\n`,
      )
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      console.error(`  ❌ Failed: ${message}\n`)
    }
  }

  console.log('Done.')
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
