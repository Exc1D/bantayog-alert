import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import { initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

/**
 * Staging Smoke Proof — Read-Only Validation
 *
 * Connects to the staging Firestore project and validates that
 * seeded data is present and well-formed. Does NOT write anything.
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

  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim() && !process.env.FIREBASE_TOKEN?.trim()) {
    throw new Error(
      'staging-smoke-proof: No credentials found. ' +
        'Set GOOGLE_APPLICATION_CREDENTIALS or run `gcloud auth application-default login`.',
    )
  }
}

interface ReportDoc {
  status?: string
  publicRef?: string
  reportType?: string
  severity?: string
  municipalityId?: string
}

interface LookupDoc {
  reportId?: string
  publicTrackingRef?: string
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
  console.log('Validating reports...')
  const snapshot = await db.collection('reports').limit(50).get()

  if (snapshot.empty) {
    throw new Error('No reports found in staging. Run `pnpm staging:seed` first.')
  }

  const validStatuses = new Set([
    'new',
    'awaiting_verify',
    'verified',
    'assigned',
    'acknowledged',
    'en_route',
    'on_scene',
    'resolved',
    'cancelled',
  ])

  let invalidCount = 0
  for (const doc of snapshot.docs) {
    const data = doc.data() as ReportDoc
    if (!data.status || !validStatuses.has(data.status)) {
      console.warn(`  WARN: report ${doc.id} has invalid status: ${data.status}`)
      invalidCount++
    }
    if (!data.publicRef) {
      console.warn(`  WARN: report ${doc.id} missing publicRef`)
      invalidCount++
    }
    if (!data.reportType) {
      console.warn(`  WARN: report ${doc.id} missing reportType`)
      invalidCount++
    }
  }

  console.log(`  ${snapshot.size} reports checked, ${invalidCount} warnings`)
  if (invalidCount > 0) {
    throw new Error(`Found ${invalidCount} invalid report(s).`)
  }
}

async function validateLookups(db: ReturnType<typeof getDb>): Promise<void> {
  console.log('Validating report_lookup...')
  const snapshot = await db.collection('report_lookup').limit(50).get()

  if (snapshot.empty) {
    throw new Error('No report_lookup entries found.')
  }

  let invalidCount = 0
  for (const doc of snapshot.docs) {
    const data = doc.data() as LookupDoc
    const keys = Object.keys(data)
    if (keys.length !== 2 || !keys.includes('reportId') || !keys.includes('publicTrackingRef')) {
      console.warn(`  WARN: lookup ${doc.id} has unexpected fields: ${keys.join(', ')}`)
      invalidCount++
    }
  }

  console.log(`  ${snapshot.size} lookups checked, ${invalidCount} warnings`)
  if (invalidCount > 0) {
    throw new Error(`Found ${invalidCount} lookup(s) with unexpected fields.`)
  }
}

async function validateDispatches(db: ReturnType<typeof getDb>): Promise<void> {
  console.log('Validating dispatches...')
  const snapshot = await db.collection('dispatches').limit(50).get()

  if (snapshot.empty) {
    console.log('  No dispatches found (expected if seed not yet run).')
    return
  }

  const validStatuses = new Set([
    'pending',
    'accepted',
    'acknowledged',
    'en_route',
    'on_scene',
    'resolved',
    'unable_to_complete',
    'declined',
    'cancelled',
    'escalated',
  ])

  let invalidCount = 0
  for (const doc of snapshot.docs) {
    const data = doc.data() as DispatchDoc
    if (!data.status || !validStatuses.has(data.status)) {
      console.warn(`  WARN: dispatch ${doc.id} has invalid status: ${data.status}`)
      invalidCount++
    }
    if (!data.reportId) {
      console.warn(`  WARN: dispatch ${doc.id} missing reportId`)
      invalidCount++
    }
  }

  console.log(`  ${snapshot.size} dispatches checked, ${invalidCount} warnings`)
  if (invalidCount > 0) {
    throw new Error(`Found ${invalidCount} invalid dispatch(es).`)
  }
}

async function validateAlerts(db: ReturnType<typeof getDb>): Promise<void> {
  console.log('Validating alerts...')
  const snapshot = await db.collection('alerts').limit(50).get()

  if (snapshot.empty) {
    console.log('  No alerts found (expected if seed not yet run).')
    return
  }

  const validSeverities = new Set(['info', 'low', 'medium', 'high', 'critical'])

  let invalidCount = 0
  for (const doc of snapshot.docs) {
    const data = doc.data() as AlertDoc
    if (!data.severity || !validSeverities.has(data.severity)) {
      console.warn(`  WARN: alert ${doc.id} has invalid severity: ${data.severity}`)
      invalidCount++
    }
    if (!data.title) {
      console.warn(`  WARN: alert ${doc.id} missing title`)
      invalidCount++
    }
  }

  console.log(`  ${snapshot.size} alerts checked, ${invalidCount} warnings`)
  if (invalidCount > 0) {
    throw new Error(`Found ${invalidCount} invalid alert(s).`)
  }
}

async function validateEventAuditTrail(db: ReturnType<typeof getDb>): Promise<void> {
  console.log('Checking event audit trails exist...')
  const [reportEventsSnap, dispatchEventsSnap] = await Promise.all([
    db.collection('report_events').limit(1).count().get(),
    db.collection('dispatch_events').limit(1).count().get(),
  ])

  const reportEventsCount = reportEventsSnap.data().count
  const dispatchEventsCount = dispatchEventsSnap.data().count

  console.log(`  report_events collections: ${reportEventsCount} document(s)`)
  console.log(`  dispatch_events collections: ${dispatchEventsCount} document(s)`)

  // Events may be absent if the lifecycle proof hasn't run yet; warn only
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
