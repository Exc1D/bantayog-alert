#!/usr/bin/env tsx
/**
 * Staging Seed Script
 *
 * Seeds deterministic demo data into the staging Firebase project.
 * Idempotent — uses fixed document IDs so re-runs overwrite, not duplicate.
 *
 * SAFETY RULES:
 *   - Refuses to run if FIRESTORE_EMULATOR_HOST is set.
 *   - Refuses to run against production project "bantayog-alert".
 *   - Requires explicit GOOGLE_APPLICATION_CREDENTIALS or gcloud auth.
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=path/to/service-account.json \
 *     pnpm exec tsx scripts/staging-seed.ts
 *
 *   # Or via package script:
 *   pnpm staging:seed
 */

import { execSync } from 'node:child_process'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { initializeApp, getApps, cert } from 'firebase-admin/app'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'

const PRODUCTION_PROJECT_ID = 'bantayog-alert'
const STAGING_PROJECT_ID = 'bantayog-alert-staging'
const BASE_TIME = 1_756_000_000_000 // Deterministic anchor for all seed timestamps

function hasGcloudAuth(): boolean {
  try {
    const out = execSync("gcloud auth list --filter=status:ACTIVE --format='value(account)'", {
      encoding: 'utf-8',
      timeout: 5000,
    })
    if (!out.trim()) return false
    // Verify Application Default Credentials are actually configured
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

export function assertStagingAllowed(): void {
  if (process.env.FIRESTORE_EMULATOR_HOST?.trim()) {
    throw new Error(
      'staging-seed: FIRESTORE_EMULATOR_HOST is set. ' +
        'This script is for staging, not emulators. ' +
        'Use demo:seed for local emulator data.',
    )
  }

  const projectId =
    process.env.GCLOUD_PROJECT?.trim() ??
    process.env.FIREBASE_PROJECT_ID?.trim() ??
    process.env.GOOGLE_CLOUD_PROJECT?.trim()

  if (projectId === PRODUCTION_PROJECT_ID) {
    throw new Error(
      `staging-seed: Refusing to seed production project ${PRODUCTION_PROJECT_ID}. ` +
        `Use the staging project ${STAGING_PROJECT_ID} instead.`,
    )
  }

  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim() && !hasGcloudAuth()) {
    throw new Error(
      'staging-seed: No credentials found. ' +
        'Set GOOGLE_APPLICATION_CREDENTIALS to a service account key ' +
        'or ensure gcloud auth is active.',
    )
  }
}

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

const REPORTS = [
  {
    id: 'seed-report-001',
    publicRef: 'SEED-001',
    reportType: 'flood',
    severity: 'high',
    status: 'verified',
    municipalityId: 'daet',
    barangayId: 'Bagasbas',
    municipalityLabel: 'Daet',
    publicLocation: { lat: 14.1162, lng: 122.9652 },
    submittedAt: BASE_TIME - 2 * 60 * 60 * 1000,
    visibilityClass: 'public_alertable',
    source: 'web',
  },
  {
    id: 'seed-report-002',
    publicRef: 'SEED-002',
    reportType: 'fire',
    severity: 'high',
    status: 'assigned',
    municipalityId: 'daet',
    barangayId: 'Camambugan',
    municipalityLabel: 'Daet',
    publicLocation: { lat: 14.1162, lng: 122.9652 },
    submittedAt: BASE_TIME - 5 * 60 * 60 * 1000,
    visibilityClass: 'public_alertable',
    source: 'web',
  },
  {
    id: 'seed-report-003',
    publicRef: 'SEED-003',
    reportType: 'typhoon',
    severity: 'high',
    status: 'new',
    municipalityId: 'paracale',
    barangayId: 'Paracale Poblacion',
    municipalityLabel: 'Paracale',
    publicLocation: { lat: 14.2789, lng: 122.7853 },
    submittedAt: BASE_TIME - 1 * 60 * 60 * 1000,
    visibilityClass: 'public_alertable',
    source: 'sms',
  },
  {
    id: 'seed-report-004',
    publicRef: 'SEED-004',
    reportType: 'landslide',
    severity: 'medium',
    status: 'awaiting_verify',
    municipalityId: 'labo',
    barangayId: 'Sta. Cruz',
    municipalityLabel: 'Labo',
    publicLocation: { lat: 14.0717, lng: 122.7619 },
    submittedAt: BASE_TIME - 8 * 60 * 60 * 1000,
    visibilityClass: 'public_alertable',
    source: 'web',
  },
  {
    id: 'seed-report-005',
    publicRef: 'SEED-005',
    reportType: 'accident',
    severity: 'medium',
    status: 'en_route',
    municipalityId: 'mercedes',
    barangayId: 'Mercedes Poblacion',
    municipalityLabel: 'Mercedes',
    publicLocation: { lat: 14.1125, lng: 122.8825 },
    submittedAt: BASE_TIME - 3 * 60 * 60 * 1000,
    visibilityClass: 'public_alertable',
    source: 'web',
  },
  {
    id: 'seed-report-006',
    publicRef: 'SEED-006',
    reportType: 'flood',
    severity: 'medium',
    status: 'on_scene',
    municipalityId: 'talisay',
    barangayId: 'Talisay Poblacion',
    municipalityLabel: 'Talisay',
    publicLocation: { lat: 14.1603, lng: 122.9275 },
    submittedAt: BASE_TIME - 6 * 60 * 60 * 1000,
    visibilityClass: 'public_alertable',
    source: 'web',
  },
  {
    id: 'seed-report-007',
    publicRef: 'SEED-007',
    reportType: 'structural',
    severity: 'low',
    status: 'verified',
    municipalityId: 'capalonga',
    barangayId: 'Capalonga Poblacion',
    municipalityLabel: 'Capalonga',
    publicLocation: { lat: 14.2025, lng: 122.4153 },
    submittedAt: BASE_TIME - 12 * 60 * 60 * 1000,
    visibilityClass: 'public_alertable',
    source: 'web',
  },
  {
    id: 'seed-report-008',
    publicRef: 'SEED-008',
    reportType: 'medical',
    severity: 'low',
    status: 'resolved',
    municipalityId: 'vinzons',
    barangayId: 'Vinzons Poblacion',
    municipalityLabel: 'Vinzons',
    publicLocation: { lat: 14.175, lng: 122.9086 },
    submittedAt: BASE_TIME - 1 * 24 * 60 * 60 * 1000,
    visibilityClass: 'public_alertable',
    source: 'web',
  },
  {
    id: 'seed-report-009',
    publicRef: 'SEED-009',
    reportType: 'storm_surge',
    severity: 'high',
    status: 'new',
    municipalityId: 'jose-panganiban',
    barangayId: 'Jose Panganiban Poblacion',
    municipalityLabel: 'Jose Panganiban',
    publicLocation: { lat: 14.2956, lng: 122.6986 },
    submittedAt: BASE_TIME - 0.5 * 60 * 60 * 1000,
    visibilityClass: 'public_alertable',
    source: 'sms',
  },
  {
    id: 'seed-report-010',
    publicRef: 'SEED-010',
    reportType: 'other',
    severity: 'low',
    status: 'awaiting_verify',
    municipalityId: 'santa-elena',
    barangayId: 'Santa Elena Poblacion',
    municipalityLabel: 'Santa Elena',
    publicLocation: { lat: 14.2025, lng: 122.4153 },
    submittedAt: BASE_TIME - 2 * 24 * 60 * 60 * 1000,
    visibilityClass: 'public_alertable',
    source: 'web',
  },
] as const

const ALERTS = [
  {
    id: 'seed-alert-001',
    title: 'Typhoon Warning Signal #2 — Camarines Norte',
    body: 'PAGASA has raised Typhoon Warning Signal #2 over Camarines Norte. Expect strong winds and heavy rainfall. Evacuate low-lying and coastal areas immediately.',
    severity: 'critical',
    publishedAt: BASE_TIME - 1 * 60 * 60 * 1000,
    publishedBy: 'Provincial DRRMO',
    affectedMunicipalityIds: ['daet', 'labo', 'paracale', 'vinzons'],
    visibility: 'public',
  },
  {
    id: 'seed-alert-002',
    title: 'Flood Advisory — Daet River',
    body: 'Water levels at Daet River have reached warning level. Residents in barangays Bagasbas, Lag-on, and Camambugan are advised to prepare for possible evacuation.',
    severity: 'high',
    publishedAt: BASE_TIME - 3 * 60 * 60 * 1000,
    publishedBy: 'Daet MDRRMO',
    affectedMunicipalityIds: ['daet'],
    visibility: 'public',
  },
  {
    id: 'seed-alert-003',
    title: 'Road Closure — Daet–Labo National Highway',
    body: 'The Daet–Labo National Highway is closed to all vehicles due to a landslide near km 24. DPWH crews are on-site. Use alternate routes.',
    severity: 'medium',
    publishedAt: BASE_TIME - 8 * 60 * 60 * 1000,
    publishedBy: 'DPWH Camarines Norte',
    affectedMunicipalityIds: ['daet', 'labo'],
    visibility: 'public',
  },
  {
    id: 'seed-alert-004',
    title: 'Preemptive Evacuation Order — Coastal Barangays',
    body: 'The municipal government of Paracale orders preemptive evacuation of all residents in coastal barangays. Proceed to designated evacuation centers.',
    severity: 'high',
    publishedAt: BASE_TIME - 2 * 60 * 60 * 1000,
    publishedBy: 'Paracale MDRRMO',
    affectedMunicipalityIds: ['paracale'],
    visibility: 'public',
  },
  {
    id: 'seed-alert-005',
    title: 'All-Clear — Vinzons Flash Flood',
    body: 'Floodwaters in Vinzons have receded. Roads are now passable. Residents may return home after inspection of their properties.',
    severity: 'info',
    publishedAt: BASE_TIME - 1 * 24 * 60 * 60 * 1000,
    publishedBy: 'Vinzons MDRRMO',
    affectedMunicipalityIds: ['vinzons'],
    visibility: 'public',
  },
] as const

export function buildReportOpsSeeds(
  reports: typeof REPORTS,
): Array<{ id: string; data: Record<string, unknown> }> {
  const TEST_RESPONDER_REPORT_ID = 'seed-report-002'
  const TEST_RESPONDER_AGENCY_ID = 'bfp-daet'
  return reports.map((report) => {
    const isResponderSeed = report.id === TEST_RESPONDER_REPORT_ID
    return {
      id: report.id,
      data: {
        reportId: report.id,
        municipalityId: report.municipalityId,
        status: report.status,
        severity: report.severity,
        createdAt: report.submittedAt,
        agencyIds: isResponderSeed ? [TEST_RESPONDER_AGENCY_ID] : [],
        activeResponderCount: isResponderSeed ? 1 : 0,
        requiresLocationFollowUp: false,
        reportType: report.reportType,
        visibility: { scope: 'municipality', sharedWith: [] },
        updatedAt: report.submittedAt,
        schemaVersion: 1,
      },
    }
  })
}

export function buildDispatchSeeds(
  reports: typeof REPORTS,
): Array<{ id: string; data: Record<string, unknown> }> {
  const TEST_RESPONDER_UID = 'bfp-responder-test-01'
  const TEST_RESPONDER_AGENCY_ID = 'bfp-daet'
  const TEST_RESPONDER_MUNICIPALITY_ID = 'daet'
  const TEST_RESPONDER_REPORT_ID = 'seed-report-002'

  const report = reports.find(
    (r) => r.id === TEST_RESPONDER_REPORT_ID && r.municipalityId === TEST_RESPONDER_MUNICIPALITY_ID,
  )
  if (!report) {
    throw new Error(
      `buildDispatchSeeds: expected report "${TEST_RESPONDER_REPORT_ID}" for municipality "${TEST_RESPONDER_MUNICIPALITY_ID}" not found. ` +
        'Verify that the test responder seed configuration and REPORTS data are in sync.',
    )
  }

  const dispatchId = `${report.id}_${TEST_RESPONDER_UID}`
  const dispatchedAt = report.submittedAt + 5 * 60 * 1000
  return [
    {
      id: dispatchId,
      data: {
        dispatchId,
        reportId: report.id,
        status: 'pending',
        municipalityId: report.municipalityId,
        assignedTo: {
          uid: TEST_RESPONDER_UID,
          agencyId: TEST_RESPONDER_AGENCY_ID,
          municipalityId: TEST_RESPONDER_MUNICIPALITY_ID,
        },
        dispatchedAt,
        dispatchedBy: 'daet-admin-test-01',
        dispatchedByRole: 'municipal_admin',
        statusUpdatedAt: dispatchedAt,
        lastStatusAt: dispatchedAt,
        acknowledgementDeadlineAt: dispatchedAt + 10 * 60 * 1000,
        correlationId: '11111111-1111-4111-8111-111111111111',
        idempotencyKey: `seed:${dispatchId}`,
        schemaVersion: 1,
      },
    },
  ]
}

export function buildResetPaths(): string[] {
  const paths = [
    ...REPORTS.flatMap((r) => [`reports/${r.id}`, `report_ops/${r.id}`]),
    ...buildDispatchSeeds(REPORTS).map((s) => `dispatches/${s.id}`),
    ...ALERTS.map((a) => `alerts/${a.id}`),
  ]
  return Array.from(new Set(paths))
}

async function seedReports(db: ReturnType<typeof getDb>) {
  console.log('Seeding reports...')
  const batch = db.batch()
  for (const report of REPORTS) {
    batch.set(db.collection('reports').doc(report.id), {
      ...report,
      createdAt: new Date(report.submittedAt),
    })
  }
  for (const seed of buildReportOpsSeeds(REPORTS)) {
    batch.set(db.collection('report_ops').doc(seed.id), seed.data)
  }
  for (const seed of buildDispatchSeeds(REPORTS)) {
    batch.set(db.collection('dispatches').doc(seed.id), seed.data)
  }
  await batch.commit()
  console.log(
    `  ${REPORTS.length} reports, ${buildReportOpsSeeds(REPORTS).length} report_ops, ` +
      `${buildDispatchSeeds(REPORTS).length} dispatches seeded`,
  )
}

async function seedAlerts(db: ReturnType<typeof getDb>) {
  console.log('Seeding alerts...')
  const batch = db.batch()
  for (const alert of ALERTS) {
    batch.set(db.collection('alerts').doc(alert.id), {
      ...alert,
      publishedAt: new Date(alert.publishedAt),
    })
  }
  await batch.commit()
  console.log(`  ${ALERTS.length} alerts seeded`)
}

async function seedDemoAccounts(db: ReturnType<typeof getDb>) {
  console.log('Seeding demo accounts...')
  const now = new Date(BASE_TIME)
  const batch = db.batch()

  batch.set(db.collection('active_accounts').doc('daet-admin-test-01'), {
    uid: 'daet-admin-test-01',
    role: 'municipal_admin',
    accountStatus: 'active',
    municipalityId: 'daet',
    lastClaimIssuedAt: now,
    updatedAt: now,
  })

  batch.set(db.collection('active_accounts').doc('bfp-responder-test-01'), {
    uid: 'bfp-responder-test-01',
    role: 'responder',
    accountStatus: 'active',
    municipalityId: 'daet',
    agencyId: 'bfp-daet',
    permittedMunicipalityIds: ['daet'],
    mfaEnrolled: false,
    lastClaimIssuedAt: now,
    updatedAt: now,
  })

  batch.set(db.collection('responders').doc('bfp-responder-test-01'), {
    uid: 'bfp-responder-test-01',
    displayName: 'BFP Daet Test Responder',
    agency: 'BFP',
    agencyId: 'bfp-daet',
    municipalityId: 'daet',
    accountStatus: 'active',
    isActive: true,
    availabilityStatus: 'available',
    lastSeenAt: now,
    updatedAt: now,
  })

  batch.set(db.collection('municipalities').doc('daet'), {
    id: 'daet',
    label: 'Daet',
    provinceId: 'camarines-norte',
    centroid: { lat: 14.1, lng: 122.95 },
    schemaVersion: 1,
  })

  await batch.commit()
  console.log('  Admin, responder, and municipality docs seeded')
}

export async function resetStagingData(db = getDb()) {
  const paths = buildResetPaths()
  const batch = db.batch()
  for (const path of paths) {
    batch.delete(db.doc(path))
  }
  await batch.commit()
  console.log(`  ${paths.length} seed documents reset`)
}

export async function main(db?: Firestore) {
  assertStagingAllowed()
  const firestore = db ?? getDb()
  console.log(`\nStaging seed — ${STAGING_PROJECT_ID} — ${new Date().toISOString()}\n`)
  await resetStagingData(firestore)
  await seedReports(firestore)
  await seedAlerts(firestore)
  await seedDemoAccounts(firestore)
  console.log('\nStaging seed complete.')
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href

if (isMain) {
  main().catch((err: unknown) => {
    console.error('\nStaging seed failed:', err instanceof Error ? err.message : String(err))
    process.exit(1)
  })
}
