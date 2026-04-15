/**
 * Backfill responderId and status on report_ops Documents
 *
 * Copies `assignedTo` → `responderId` and `responderStatus` → `status`
 * for existing documents that don't yet have the normalized fields.
 *
 * Usage:
 *   # Dry run (safe — only logs what would change)
 *   npx tsx scripts/backfill-report-ops-responder-id.ts --dry-run
 *
 *   # Live run (actually modifies Firestore)
 *   npx tsx scripts/backfill-report-ops-responder-id.ts
 *
 * Prerequisites:
 *   - Firebase emulators running (or export FIREBASE_PROJECT_ID for production)
 *   - Dependencies installed: npm install
 *
 * Runbook:
 *   1. Export emulator or production project env
 *   2. Run dry-run first to preview changes
 *   3. Run live mode once verified
 *   4. Keep script for auditability
 */

import admin from 'firebase-admin'

// Initialize Firebase Admin — picks up FIREBASE_EMULATOR_HOST from the environment
admin.initializeApp()

const db = admin.firestore()

// ── Types ───────────────────────────────────────────────────────────────────────

interface ReportOps {
  id: string
  reportId: string
  assignedTo?: string
  responderId?: string
  responderStatus?: 'en_route' | 'on_scene' | 'needs_assistance' | 'completed'
  status?: string
  responderNotes?: string
  responderArrivalTime?: number
  responderDepartureTime?: number
  timeline: Array<{
    timestamp: number
    action: string
    performedBy: string
    notes?: string
  }>
}

interface BackfillStats {
  scanned: number
  updated: number
  skipped: number
  failed: number
}

// Map responderStatus values to a normalized status string
function normalizeStatus(responderStatus?: string): string | undefined {
  if (!responderStatus) return undefined
  switch (responderStatus) {
    case 'en_route':
      return 'assigned' // Responder is on way
    case 'on_scene':
      return 'responding' // Responder has arrived
    case 'needs_assistance':
      return 'needs_assistance'
    case 'completed':
      return 'completed'
    default:
      return undefined
  }
}

// ── Main Backfill Logic ────────────────────────────────────────────────────────

async function backfillReportOps(dryRun: boolean): Promise<BackfillStats> {
  const stats: BackfillStats = { scanned: 0, updated: 0, skipped: 0, failed: 0 }

  console.log(`\n🔄 Starting backfill (${dryRun ? 'DRY RUN' : 'LIVE MODE'})\n`)

  // Collect all report_ops documents in batches
  const batchSize = 100
  let lastDoc: admin.firestore.QueryDocumentSnapshot | null = null

  do {
    let query: admin.firestore.Query<admin.firestore.DocumentData> = db
      .collection('report_ops')
      .limit(batchSize)

    if (lastDoc) {
      query = query.startAfter(lastDoc)
    }

    const snapshot = await query.get()

    if (snapshot.empty) {
      break
    }

    for (const docSnap of snapshot.docs) {
      const data = docSnap.data() as ReportOps
      stats.scanned++

      try {
        // Determine current values
        const currentResponderId = data.responderId
        const currentAssignedTo = data.assignedTo
        const currentStatus = data.status
        const currentResponderStatus = data.responderStatus

        // Check if already normalized
        const needsResponderIdBackfill =
          !currentResponderId && currentAssignedTo
        const needsStatusBackfill =
          !currentStatus && currentResponderStatus

        // Skip if no backfill needed
        if (!needsResponderIdBackfill && !needsStatusBackfill) {
          stats.skipped++
          console.log(`  ⏭️  SKIP   ${docSnap.id}: already normalized`)
          continue
        }

        // Build update object
        const updates: Partial<ReportOps> = {}

        if (needsResponderIdBackfill) {
          updates.responderId = currentAssignedTo!
          console.log(
            `  📝 UPDATE ${docSnap.id}: responderId = "${currentAssignedTo}"`
          )
        }

        if (needsStatusBackfill) {
          const normalizedStatus = normalizeStatus(currentResponderStatus)
          if (normalizedStatus) {
            updates.status = normalizedStatus
            console.log(
              `  📝 UPDATE ${docSnap.id}: status = "${normalizedStatus}" (from responderStatus "${currentResponderStatus}")`
            )
          }
        }

        if (dryRun) {
          console.log(`  🔍 DRY    ${docSnap.id}: would update fields above`)
          stats.updated++
        } else {
          await docSnap.ref.update(updates)
          console.log(`  ✅ LIVE   ${docSnap.id}: updated successfully`)
          stats.updated++
        }
      } catch (err) {
        console.error(`  ❌ ERROR  ${docSnap.id}: ${err}`)
        stats.failed++
      }
    }

    lastDoc = snapshot.docs[snapshot.docs.length - 1]
  } while (lastDoc)

  return stats
}

// ── CLI ───────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run') || args.includes('-n')

  if (dryRun) {
    console.log('📋 DRY RUN MODE — no changes will be made')
  } else {
    console.warn('⚠️  LIVE MODE — this will modify Firestore documents')
    console.warn('   Press Ctrl+C to abort, or wait 3 seconds to continue...\n')
    await new Promise((resolve) => setTimeout(resolve, 3000))
  }

  try {
    const stats = await backfillReportOps(dryRun)

    console.log('\n────────── Backfill Complete ──────────')
    console.log(`  Scanned: ${stats.scanned}`)
    console.log(`  Updated: ${stats.updated}`)
    console.log(`  Skipped: ${stats.skipped}`)
    console.log(`  Failed:  ${stats.failed}`)
    console.log('──────────────────────────────────────\n')

    if (stats.failed > 0) {
      console.error(`⚠️  ${stats.failed} documents failed to update`)
      process.exit(1)
    }

    console.log(
      dryRun
        ? '✅ Dry run complete — run without --dry-run to apply changes'
        : '✅ Backfill complete'
    )
  } catch (err) {
    console.error('❌ Fatal error:', err)
    process.exit(1)
  }
}

main()
