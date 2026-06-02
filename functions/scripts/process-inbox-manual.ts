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

import { fileURLToPath } from 'node:url'
import { initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'
import {
  processInboxItemCore,
  type ProcessInboxItemCoreResult,
} from '../src/domains/reports/process-inbox-item.js'

const PROJECT_ID = 'bantayog-alert-staging'

export interface ProcessInboxManualFailure {
  inboxId: string
  error: string
}

export interface ProcessInboxManualSummary {
  scanned: number
  candidates: number
  processed: number
  replayed: number
  failed: number
  exitCode: number
  failures: ProcessInboxManualFailure[]
}

export interface ProcessInboxManualSummaryDeps {
  db: Firestore
  processInboxItem?: (input: {
    db: Firestore
    inboxId: string
  }) => Promise<ProcessInboxItemCoreResult>
  writeLine?: (line: string) => void
}

function formatErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export async function processInboxManualSummary(
  deps: ProcessInboxManualSummaryDeps,
): Promise<ProcessInboxManualSummary> {
  const processInboxItem = deps.processInboxItem ?? processInboxItemCore
  const writeLine = deps.writeLine ?? console.log
  writeLine('[INFO] Manual inbox processing fallback')
  const snapshot = await deps.db.collection('report_inbox').get()
  const candidates = snapshot.docs.filter((doc) => {
    const data = doc.data()
    return data.processedAt === undefined || data.processedAt === null
  })

  const summary: ProcessInboxManualSummary = {
    scanned: snapshot.docs.length,
    candidates: candidates.length,
    processed: 0,
    replayed: 0,
    failed: 0,
    exitCode: 0,
    failures: [],
  }

  if (candidates.length === 0) {
    writeLine('No unprocessed report_inbox items found.')
    writeLine(JSON.stringify(summary))
    return summary
  }

  writeLine(`Found ${candidates.length} unprocessed inbox item(s).`)

  for (const doc of candidates) {
    writeLine(`Processing inbox ${doc.id}...`)
    try {
      const result = await processInboxItem({ db: deps.db, inboxId: doc.id })
      writeLine(
        `  [OK] Materialized: ${result.materialized}, Report ID: ${result.reportId}, Public Ref: ${result.publicRef}`,
      )
      if (result.materialized) {
        summary.processed += 1
      }
      if (result.replayed) {
        summary.replayed += 1
      }
    } catch (error: unknown) {
      summary.failed += 1
      writeLine(`  [FAIL] Failed: ${formatErrorMessage(error)}`)
      summary.failures.push({ inboxId: doc.id, error: formatErrorMessage(error) })
    }
  }

  summary.exitCode = summary.failed > 0 ? 1 : 0
  writeLine('Done.')
  writeLine(JSON.stringify(summary))
  return summary
}

export async function runManualInboxProcessor(
  db: Firestore,
  writeLine: (line: string) => void = console.log,
  processInboxItem?: ProcessInboxManualSummaryDeps['processInboxItem'],
): Promise<ProcessInboxManualSummary> {
  const summary = await processInboxManualSummary({ db, writeLine, processInboxItem })
  process.exitCode = summary.exitCode
  return summary
}

export async function runManualInboxProcessorAndTerminate(
  db: Firestore,
  writeLine: (line: string) => void = console.log,
  processInboxItem?: ProcessInboxManualSummaryDeps['processInboxItem'],
): Promise<ProcessInboxManualSummary> {
  try {
    return await runManualInboxProcessor(db, writeLine, processInboxItem)
  } finally {
    await db.terminate()
  }
}

async function main(): Promise<void> {
  if (!process.env.FIRESTORE_EMULATOR_HOST) {
    console.error(
      'ERROR: FIRESTORE_EMULATOR_HOST is not set. This script must run against the emulator.',
    )
    process.exitCode = 1
    return
  }

  if (getApps().length === 0) {
    initializeApp({ projectId: PROJECT_ID })
  }

  await runManualInboxProcessorAndTerminate(getFirestore())
}

const isMainModule = process.argv[1] === fileURLToPath(import.meta.url)

if (isMainModule) {
  void main().catch((error: unknown) => {
    console.error('Fatal error:', error)
    process.exitCode = 1
  })
}
