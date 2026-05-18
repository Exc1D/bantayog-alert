/**
 * Quick end-to-end test: submit a report_inbox item via emulator using Admin SDK,
 * then run the manual fallback to process it.
 *
 * Usage:
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8081 \
 *     FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 \
 *     pnpm exec tsx functions/scripts/e2e-create-report-inbox.ts
 */

import { initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { processInboxItemCore } from '../src/triggers/process-inbox-item.js'

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

const TEST_INBOX: Record<string, unknown> = {
  reporterUid: 'test-citizen-uid',
  clientCreatedAt: Date.now(),
  idempotencyKey: crypto.randomUUID(),
  publicRef: 'test1234',
  secretHash: '9caf06bb4436cdbfa20af9121a626bc1093c4f54b31c0fa937957856135345b6',
  correlationId: crypto.randomUUID(),
  payload: {
    reportType: 'flood',
    description: 'Test flood report from E2E script',
    severity: 'high',
    source: 'web',
    clientDraftRef: 'test-draft-ref-12345',
    municipalityId: 'daet',
    barangayId: 'brgy-daet-1',
    nearestLandmark: 'Near central plaza',
    publicLocation: { lat: 14.1122, lng: 122.9553 },
    contact: {
      phone: '+639171234567',
      smsConsent: true,
    },
  },
}

async function main() {
  console.log('🧪 E2E test: creating report_inbox item on emulator...\n')

  const docId = 'test-e2e-' + Date.now()
  await db.collection('report_inbox').doc(docId).set(TEST_INBOX)
  console.log(`✅ Created report_inbox/${docId}`)

  console.log('\n🔧 Processing inbox item...')
  const result = await processInboxItemCore({ db, inboxId: docId })
  console.log(
    `  ✅ Materialized: ${result.materialized}, Report ID: ${result.reportId}, Public Ref: ${result.publicRef}\n`,
  )

  // Verify the report was materialized
  const reportDoc = await db.collection('reports').doc(result.reportId).get()
  if (reportDoc.exists) {
    console.log(`✅ Report ${result.reportId} exists in 'reports' collection`)
  } else {
    console.log(`❌ Report ${result.reportId} NOT found in 'reports'`)
    process.exit(1)
  }

  console.log('\n🧹 Cleaning up...')
  await db.collection('report_inbox').doc(docId).delete()
  await db.collection('reports').doc(result.reportId).delete()
  console.log('✅ Cleanup complete.')

  console.log('\n🎉 E2E test passed!')
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
