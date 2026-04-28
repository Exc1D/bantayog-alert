#!/usr/bin/env tsx
// e2e-tests/k6/seed.ts
//
// Usage:
//   tsx e2e-tests/k6/seed.ts seed dispatch <responderUid>
//   tsx e2e-tests/k6/seed.ts seed inbox
//   tsx e2e-tests/k6/seed.ts teardown dispatch <id1,id2,id3>
//   tsx e2e-tests/k6/seed.ts teardown inbox <id>
//
// Required env vars:
//   K6_FIREBASE_PROJECT_ID  — e.g. "bantayog-staging"
//   K6_SERVICE_ACCOUNT_JSON — path to staging service account JSON file
//
/* eslint-disable no-console */
// NEVER point K6_SERVICE_ACCOUNT_JSON at a prod service account.

import { initializeApp, cert, type ServiceAccount } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import { readFileSync } from 'node:fs'

const projectId = process.env.K6_FIREBASE_PROJECT_ID
if (!projectId) throw new Error('K6_FIREBASE_PROJECT_ID is required')

const saPath = process.env.K6_SERVICE_ACCOUNT_JSON
if (!saPath) throw new Error('K6_SERVICE_ACCOUNT_JSON (file path) is required')

const serviceAccount = JSON.parse(readFileSync(saPath, 'utf8')) as ServiceAccount
initializeApp({ credential: cert(serviceAccount), projectId })
const db = getFirestore()

// ---------------------------------------------------------------------------
// Seed helpers
// ---------------------------------------------------------------------------

async function seedDispatch(responderUid: string): Promise<string> {
  // Shape matches seedDispatch() in functions/src/__tests__/helpers/seed-factories.ts
  // reportId uses a placeholder — acceptDispatch only reads status + assignedTo, not the report
  const ref = db.collection('dispatches').doc()
  const now = Timestamp.now()
  await ref.set({
    dispatchId: ref.id,
    reportId: `k6-placeholder-report-${ref.id}`,
    status: 'pending',
    assignedTo: {
      uid: responderUid,
      agencyId: 'bfp-daet',
      municipalityId: 'daet',
    },
    dispatchedAt: now,
    lastStatusAt: now,
    acknowledgementDeadlineAt: Timestamp.fromMillis(now.toMillis() + 15 * 60 * 1000),
    correlationId: crypto.randomUUID(),
    schemaVersion: 1,
  })
  return ref.id
}

async function seedInboxItem(): Promise<string> {
  // Shape matches writeInbox() call in apps/citizen-pwa/src/services/submit-report.ts
  // clientCreatedAt is 10 min in the past so the reconciliation sweep picks it up immediately.
  // The sweep queries: clientCreatedAt < (now - 2min) AND processedAt == null
  const ref = db.collection('report_inbox').doc()
  await ref.set({
    reporterUid: 'k6-test-citizen',
    clientCreatedAt: Date.now() - 10 * 60 * 1000,
    idempotencyKey: crypto.randomUUID(),
    publicRef: `K6-${ref.id.slice(0, 6).toUpperCase()}`,
    secretHash: `k6-placeholder-hash-${ref.id}`,
    correlationId: crypto.randomUUID(),
    payload: {
      reportType: 'flood',
      severity: 'medium',
      description: 'k6 sweep test item — please disregard',
      source: 'web',
      publicLocation: { lat: 14.1114, lng: 122.9551 },
      pendingMediaIds: [],
      municipalityId: 'daet',
      barangayId: 'lag-on',
    },
  })
  return ref.id
}

async function teardownDispatch(ids: string[]): Promise<void> {
  const batch = db.batch()
  for (const id of ids) batch.delete(db.collection('dispatches').doc(id))
  await batch.commit()
}

async function teardownInboxItem(id: string): Promise<void> {
  await db.collection('report_inbox').doc(id).delete()
}

async function checkProcessed(id: string): Promise<boolean> {
  const snap = await db.collection('report_inbox').doc(id).get()
  if (!snap.exists) throw new Error(`report_inbox/${id} not found`)
  const processedAt = snap.get('processedAt')
  return processedAt != null
}

// ---------------------------------------------------------------------------
// CLI dispatch
// ---------------------------------------------------------------------------

const [, , command, subCommand, ...rest] = process.argv

async function main() {
  if (command === 'seed') {
    if (subCommand === 'dispatch') {
      const responderUid = rest[0]
      if (!responderUid) throw new Error('Usage: seed dispatch <responderUid>')
      const id = await seedDispatch(responderUid)
      console.log(JSON.stringify({ id }))
    } else if (subCommand === 'inbox') {
      const id = await seedInboxItem()
      console.log(JSON.stringify({ id }))
    } else if (subCommand === 'check-processed') {
      const id = rest[0]
      if (!id) throw new Error('Usage: seed check-processed <id>')
      const isProcessed = await checkProcessed(id)
      console.log(JSON.stringify({ id, processed: isProcessed }))
    } else {
      throw new Error(`Unknown seed subcommand: ${subCommand}`)
    }
  } else if (command === 'teardown') {
    if (subCommand === 'dispatch') {
      const ids = rest[0]?.split(',').filter(Boolean) ?? []
      if (!ids.length) throw new Error('Usage: teardown dispatch <id1,id2,...>')
      await teardownDispatch(ids)
      console.log(JSON.stringify({ deleted: ids }))
    } else if (subCommand === 'inbox') {
      const id = rest[0]
      if (!id) throw new Error('Usage: teardown inbox <id>')
      await teardownInboxItem(id)
      console.log(JSON.stringify({ deleted: id }))
    } else {
      throw new Error(`Unknown teardown subcommand: ${subCommand}`)
    }
  } else {
    throw new Error(`Unknown command: ${command}. Use: seed | teardown`)
  }
}

main().catch((err: unknown) => {
  console.error(String(err))
  process.exit(1)
})
