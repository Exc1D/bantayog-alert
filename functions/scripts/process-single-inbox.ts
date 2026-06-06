/**
 * Process a specific report_inbox item on the emulator.
 */
import { initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { processInboxItemCore } from '../src/domains/reports/process-inbox-item.js'

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  console.error(
    'ERROR: FIRESTORE_EMULATOR_HOST is not set. This script must run against the emulator.',
  )
  process.exit(1)
}

const PROJECT_ID = 'bantayog-alert-staging'

if (getApps().length === 0) {
  initializeApp({ projectId: PROJECT_ID })
}

const db = getFirestore()

async function main() {
  const docId = process.argv[2]
  if (!docId) {
    console.error('Usage: tsx functions/scripts/process-single-inbox.ts <inboxDocId>')
    process.exit(1)
  }

  console.log(`Processing inbox ${docId}...`)
  try {
    const result = await processInboxItemCore({ db, inboxId: docId })
    console.log(
      `  ✅ Materialized: ${result.materialized}, Report ID: ${result.reportId}, Public Ref: ${result.publicRef}`,
    )
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`  ❌ Failed: ${message}`)
    process.exit(1)
  }
}

main().catch((err: unknown) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
