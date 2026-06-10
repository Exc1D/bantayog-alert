import { execSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import { initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

/**
 * Staging Smoke Proof — Read-Only Validation
 *
 * Connects to the staging Firestore project and validates the
 * deterministic seed documents created by `pnpm staging:seed`.
 * Does NOT write anything.
 *
 * This validates only the seed documents by ID. Pre-existing staging
 * data (from prior tests, manual entries, or earlier seeds) is
 * reported as a note but does not block the proof.
 *
 * Requires GOOGLE_APPLICATION_CREDENTIALS or gcloud ADC.
 */

const STAGING_PROJECT_ID = 'bantayog-alert-staging'
const PRODUCTION_PROJECT_ID = 'bantayog-alert'

function getDb() {
  if (getApps().length === 0) {
    initializeApp({ projectId: STAGING_PROJECT_ID })
  }
  return getFirestore()
}

function hasGcloudAuth(): boolean {
  try {
    const out = execSync("gcloud auth list --filter=status:ACTIVE --format='value(account)'", {
      encoding: 'utf-8',
      timeout: 5000,
    })
    if (!out.trim()) return false
    execSync('gcloud auth application-default print-access-token', {
      encoding: 'utf-8',
      stdio: 'pipe',
      timeout: 5000,
    })
    return true
  } catch {
    return false
  }
}

export function assertStagingReadAllowed(): void {
  if (process.env.FIRESTORE_EMULATOR_HOST?.trim()) {
    throw new Error(
      'staging-smoke-proof: FIRESTORE_EMULATOR_HOST is set. ' +
        'Use proof:mvp-loop for emulator testing.',
    )
  }

  const projectId =
    process.env.GCLOUD_PROJECT?.trim() ??
    process.env.FIREBASE_PROJECT_ID?.trim() ??
    process.env.GOOGLE_CLOUD_PROJECT?.trim()

  if (projectId === PRODUCTION_PROJECT_ID) {
    throw new Error(
      `staging-smoke-proof: Refusing to read from production project ${PRODUCTION_PROJECT_ID}.`,
    )
  }

  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim() && !hasGcloudAuth()) {
    throw new Error(
      'staging-smoke-proof: No ADC credentials found. ' +
        'Set GOOGLE_APPLICATION_CREDENTIALS or run `gcloud auth application-default login`.',
    )
  }
}

const VALID_REPORT_STATUSES = new Set([
  'draft_inbox',
  'new',
  'awaiting_verify',
  'verified',
  'assigned',
  'acknowledged',
  'en_route',
  'on_scene',
  'resolved',
  'closed',
  'reopened',
  'rejected',
  'cancelled',
  'cancelled_false_report',
  'merged_as_duplicate',
])

const VALID_DISPATCH_STATUSES = new Set([
  'pending',
  'accepted',
  'acknowledged',
  'en_route',
  'on_scene',
  'resolved',
  'declined',
  'timed_out',
  'cancelled',
  'superseded',
  'unable_to_complete',
  'needs_admin',
  'escalated',
])

// Seed IDs expected after running `pnpm staging:seed`
const EXPECTED_REPORT_IDS = [
  'seed-report-001',
  'seed-report-002',
  'seed-report-003',
  'seed-report-004',
  'seed-report-005',
  'seed-report-006',
  'seed-report-007',
  'seed-report-008',
  'seed-report-009',
  'seed-report-010',
]

const EXPECTED_ALERT_IDS = [
  'seed-alert-001',
  'seed-alert-002',
  'seed-alert-003',
  'seed-alert-004',
  'seed-alert-005',
]

const EXPECTED_LOOKUP_REFS = [
  'SEED-001',
  'SEED-002',
  'SEED-003',
  'SEED-004',
  'SEED-005',
  'SEED-006',
  'SEED-007',
  'SEED-008',
  'SEED-009',
  'SEED-010',
]

const LOOKUP_FORBIDDEN_FIELDS = new Set([
  'assignedTo',
  'responderUid',
  'responderName',
  'resolutionSummary',
  'dispatchId',
  'adminNote',
  'contactPhone',
  'exactLocation',
  'reporterUid',
  'rawDescription',
])

interface ReportDoc {
  status?: string
  reportType?: string
  severity?: string
  municipalityId?: string
  submittedAt?: unknown
}

interface LookupDoc {
  reportId?: string
  publicTrackingRef?: string
  tokenHash?: string
  expiresAt?: number
  createdAt?: number
  schemaVersion?: number
  [key: string]: unknown
}

interface DispatchDoc {
  status?: string
  reportId?: string
}

interface AlertDoc {
  severity?: string
  title?: string
}

async function validateReports(db: ReturnType<typeof getDb>): Promise<void> {
  console.log('Validating seeded reports...')

  let invalidCount = 0
  let foundCount = 0
  for (const reportId of EXPECTED_REPORT_IDS) {
    const snap = await db.collection('reports').doc(reportId).get()
    if (!snap.exists) {
      console.warn(`  WARN: seeded report ${reportId} not found`)
      invalidCount++
      continue
    }
    foundCount++
    const data = snap.data() as ReportDoc
    if (!data.status || !VALID_REPORT_STATUSES.has(data.status)) {
      console.warn(`  WARN: report ${reportId} has invalid status: ${data.status}`)
      invalidCount++
    }
    if (!data.reportType) {
      console.warn(`  WARN: report ${reportId} missing reportType`)
      invalidCount++
    }
    if (!data.severity) {
      console.warn(`  WARN: report ${reportId} missing severity`)
      invalidCount++
    }
    if (!data.municipalityId) {
      console.warn(`  WARN: report ${reportId} missing municipalityId`)
      invalidCount++
    }
    if (!data.submittedAt) {
      console.warn(`  WARN: report ${reportId} missing submittedAt`)
      invalidCount++
    }
  }

  // Note pre-existing non-seed docs (informational only)
  const allSnapshot = await db.collection('reports').limit(50).get()
  const nonSeedCount = allSnapshot.docs.filter((d) => !EXPECTED_REPORT_IDS.includes(d.id)).length
  if (nonSeedCount > 0) {
    console.log(`  NOTE: ${nonSeedCount} non-seed report(s) also present in staging`)
  }

  console.log(
    `  ${foundCount}/${EXPECTED_REPORT_IDS.length} seeded reports found, ${invalidCount} warnings`,
  )
  if (invalidCount > 0) {
    throw new Error(`Found ${invalidCount} invalid seeded report(s).`)
  }
}

async function validateLookups(db: ReturnType<typeof getDb>): Promise<void> {
  console.log('Validating seeded report_lookup entries...')

  let invalidCount = 0
  let foundCount = 0
  for (const ref of EXPECTED_LOOKUP_REFS) {
    const snap = await db.collection('report_lookup').doc(ref).get()
    if (!snap.exists) {
      console.warn(`  WARN: seeded lookup ${ref} not found`)
      invalidCount++
      continue
    }
    foundCount++
    const data = snap.data() as LookupDoc

    for (const field of LOOKUP_FORBIDDEN_FIELDS) {
      if (field in data) {
        console.warn(`  WARN: lookup ${ref} leaks forbidden field: ${field}`)
        invalidCount++
      }
    }

    if (typeof data.reportId !== 'string' || data.reportId.length === 0) {
      console.warn(`  WARN: lookup ${ref} missing reportId`)
      invalidCount++
    }
    if (typeof data.publicTrackingRef !== 'string' || data.publicTrackingRef.length === 0) {
      console.warn(`  WARN: lookup ${ref} missing publicTrackingRef`)
      invalidCount++
    }
  }

  console.log(
    `  ${foundCount}/${EXPECTED_LOOKUP_REFS.length} seeded lookups found, ${invalidCount} warnings`,
  )
  if (invalidCount > 0) {
    throw new Error(`Found ${invalidCount} invalid seeded lookup(s).`)
  }
}

async function validateDispatches(db: ReturnType<typeof getDb>): Promise<void> {
  console.log('Validating seeded dispatches...')

  // Only seed-report-002 has a dispatch in the seed script
  const expectedDispatchIds = ['seed-report-002_bfp-responder-test-01']
  let invalidCount = 0
  let foundCount = 0

  for (const dispatchId of expectedDispatchIds) {
    const snap = await db.collection('dispatches').doc(dispatchId).get()
    if (!snap.exists) {
      console.warn(`  WARN: seeded dispatch ${dispatchId} not found`)
      invalidCount++
      continue
    }
    foundCount++
    const data = snap.data() as DispatchDoc
    if (!data.status || !VALID_DISPATCH_STATUSES.has(data.status)) {
      console.warn(`  WARN: dispatch ${dispatchId} has invalid status: ${data.status}`)
      invalidCount++
    }
    if (!data.reportId) {
      console.warn(`  WARN: dispatch ${dispatchId} missing reportId`)
      invalidCount++
    }
  }

  console.log(
    `  ${foundCount}/${expectedDispatchIds.length} seeded dispatches found, ${invalidCount} warnings`,
  )
  if (invalidCount > 0) {
    throw new Error(`Found ${invalidCount} invalid seeded dispatch(es).`)
  }
}

async function validateAlerts(db: ReturnType<typeof getDb>): Promise<void> {
  console.log('Validating seeded alerts...')

  const validSeverities = new Set(['info', 'low', 'medium', 'high', 'critical'])
  let invalidCount = 0
  let foundCount = 0

  for (const alertId of EXPECTED_ALERT_IDS) {
    const snap = await db.collection('alerts').doc(alertId).get()
    if (!snap.exists) {
      console.warn(`  WARN: seeded alert ${alertId} not found`)
      invalidCount++
      continue
    }
    foundCount++
    const data = snap.data() as AlertDoc
    if (!data.severity || !validSeverities.has(data.severity)) {
      console.warn(`  WARN: alert ${alertId} has invalid severity: ${data.severity}`)
      invalidCount++
    }
    if (!data.title) {
      console.warn(`  WARN: alert ${alertId} missing title`)
      invalidCount++
    }
  }

  console.log(
    `  ${foundCount}/${EXPECTED_ALERT_IDS.length} seeded alerts found, ${invalidCount} warnings`,
  )
  if (invalidCount > 0) {
    throw new Error(`Found ${invalidCount} invalid seeded alert(s).`)
  }
}

async function validateEventAuditTrail(db: ReturnType<typeof getDb>): Promise<void> {
  console.log('Checking event audit trails contain documents...')
  const [reportEventsSnap, dispatchEventsSnap] = await Promise.all([
    db.collection('report_events').limit(1).count().get(),
    db.collection('dispatch_events').limit(1).count().get(),
  ])

  const reportEventsCount = reportEventsSnap.data().count
  const dispatchEventsCount = dispatchEventsSnap.data().count

  console.log(`  report_events: ${reportEventsCount} document(s)`)
  console.log(`  dispatch_events: ${dispatchEventsCount} document(s)`)

  if (reportEventsCount === 0) {
    console.log('  NOTE: No report_events found (run pnpm proof:mvp-loop to generate).')
  }
  if (dispatchEventsCount === 0) {
    console.log('  NOTE: No dispatch_events found (run pnpm proof:mvp-loop to generate).')
  }
}

export async function main(): Promise<void> {
  assertStagingReadAllowed()
  const db = getDb()

  console.log(`\nStaging Smoke Proof — ${STAGING_PROJECT_ID} — ${new Date().toISOString()}\n`)

  await validateReports(db)
  await validateLookups(db)
  await validateDispatches(db)
  await validateAlerts(db)
  await validateEventAuditTrail(db)

  console.log('\nStaging smoke proof passed.')
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href

if (isMain) {
  main().catch((err: unknown) => {
    console.error('\nStaging smoke proof failed:', err instanceof Error ? err.message : String(err))
    process.exit(1)
  })
}
