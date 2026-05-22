/**
 * Staging Incident Seed
 *
 * Seeds `reports` (Feed + Map tab) and `alerts` (Alerts tab) with realistic
 * Camarines Norte data so QA can exercise the full citizen PWA without
 * needing to submit live reports.
 *
 * Idempotent — uses fixed document IDs so re-runs overwrite, not duplicate.
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=path/to/key.json \
 *     pnpm exec tsx scripts/seed-staging-incidents.ts
 *
 * Or against the local emulator:
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8081 \
 *     pnpm exec tsx scripts/seed-staging-incidents.ts
 */

import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore, Timestamp, type Firestore } from 'firebase-admin/firestore'

const PROJECT_ID = 'bantayog-alert-staging'
const TEST_RESPONDER_UID = 'bfp-responder-test-01'
const TEST_RESPONDER_AGENCY_ID = 'bfp-daet'
const TEST_RESPONDER_MUNICIPALITY_ID = 'daet'
const TEST_RESPONDER_REPORT_ID = 'seed-report-002'

const now = Date.now()
const h = (n: number) => now - n * 60 * 60 * 1000 // n hours ago
const d = (n: number) => now - n * 24 * 60 * 60 * 1000 // n days ago

// Camarines Norte municipality centres (lat/lng)
const COORDS = {
  daet: { lat: 14.1162, lng: 122.9652 },
  capalonga: { lat: 14.3308, lng: 122.4961 },
  'jose-panganiban': { lat: 14.2956, lng: 122.6986 },
  labo: { lat: 14.0717, lng: 122.7619 },
  mercedes: { lat: 14.1125, lng: 122.8825 },
  paracale: { lat: 14.2789, lng: 122.7853 },
  'san-lorenzo-ruiz': { lat: 14.3828, lng: 122.5814 },
  'santa-elena': { lat: 14.2025, lng: 122.4153 },
  talisay: { lat: 14.1603, lng: 122.9275 },
  vinzons: { lat: 14.175, lng: 122.9086 },
} as const

// Slight scatter so map markers don't stack
function scatter(base: { lat: number; lng: number }, spread = 0.01) {
  return {
    lat: base.lat + (Math.random() - 0.5) * spread,
    lng: base.lng + (Math.random() - 0.5) * spread,
  }
}

export interface ReportSeed {
  id: string
  reportType: string
  severity: 'low' | 'medium' | 'high'
  status: string
  municipalityId: string
  barangayId: string
  municipalityLabel: string
  publicLocation: { lat: number; lng: number }
  submittedAt: number
  visibilityClass: 'public_alertable'
  publicRef: string
  source: string
}

export const REPORTS: ReportSeed[] = [
  {
    id: 'seed-report-001',
    publicRef: 'SEED-001',
    reportType: 'flood',
    severity: 'high',
    status: 'verified',
    municipalityId: 'daet',
    barangayId: 'Bagasbas',
    municipalityLabel: 'Daet',
    publicLocation: scatter(COORDS.daet),
    submittedAt: h(2),
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
    publicLocation: scatter(COORDS.daet),
    submittedAt: h(5),
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
    publicLocation: scatter(COORDS.paracale),
    submittedAt: h(1),
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
    publicLocation: scatter(COORDS.labo),
    submittedAt: h(8),
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
    publicLocation: scatter(COORDS.mercedes),
    submittedAt: h(3),
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
    publicLocation: scatter(COORDS.talisay),
    submittedAt: h(6),
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
    publicLocation: scatter(COORDS.capalonga),
    submittedAt: h(12),
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
    publicLocation: scatter(COORDS.vinzons),
    submittedAt: d(1),
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
    publicLocation: scatter(COORDS['jose-panganiban']),
    submittedAt: h(0.5),
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
    publicLocation: scatter(COORDS['santa-elena']),
    submittedAt: d(2),
    visibilityClass: 'public_alertable',
    source: 'web',
  },
]

interface AlertSeed {
  id: string
  title: string
  body: string
  severity: 'info' | 'low' | 'medium' | 'high' | 'critical'
  publishedAt: number
  publishedBy: string
}

const ALERTS: AlertSeed[] = [
  {
    id: 'seed-alert-001',
    title: 'Typhoon Warning Signal #2 — Camarines Norte',
    body: 'PAGASA has raised Typhoon Warning Signal #2 over Camarines Norte. Expect strong winds and heavy rainfall. Evacuate low-lying and coastal areas immediately.',
    severity: 'critical',
    publishedAt: h(1),
    publishedBy: 'Provincial DRRMO',
  },
  {
    id: 'seed-alert-002',
    title: 'Flood Advisory — Daet River',
    body: 'Water levels at Daet River have reached warning level. Residents in barangays Bagasbas, Lag-on, and Camambugan are advised to prepare for possible evacuation.',
    severity: 'high',
    publishedAt: h(3),
    publishedBy: 'Daet MDRRMO',
  },
  {
    id: 'seed-alert-003',
    title: 'Road Closure — Daet–Labo National Highway',
    body: 'The Daet–Labo National Highway is closed to all vehicles due to a landslide near km 24. DPWH crews are on-site. Use alternate routes.',
    severity: 'medium',
    publishedAt: h(8),
    publishedBy: 'DPWH Camarines Norte',
  },
  {
    id: 'seed-alert-004',
    title: 'Preemptive Evacuation Order — Coastal Barangays',
    body: 'The municipal government of Paracale orders preemptive evacuation of all residents in coastal barangays. Proceed to designated evacuation centers.',
    severity: 'high',
    publishedAt: h(2),
    publishedBy: 'Paracale MDRRMO',
  },
  {
    id: 'seed-alert-005',
    title: 'All-Clear — Vinzons Flash Flood',
    body: 'Floodwaters in Vinzons have receded. Roads are now passable. Residents may return home after inspection of their properties.',
    severity: 'info',
    publishedAt: d(1),
    publishedBy: 'Vinzons MDRRMO',
  },
]

export interface ReportOpsSeed {
  id: string
  data: {
    reportId: string
    municipalityId: string
    status: string
    severity: 'low' | 'medium' | 'high'
    createdAt: number
    agencyIds: string[]
    activeResponderCount: number
    requiresLocationFollowUp: boolean
    reportType: string
    visibility: { scope: 'municipality'; sharedWith: string[] }
    updatedAt: number
    schemaVersion: 1
  }
}

export interface DispatchSeed {
  id: string
  data: {
    dispatchId: string
    reportId: string
    status: 'pending'
    municipalityId: string
    assignedTo: {
      uid: string
      agencyId: string
      municipalityId: string
    }
    dispatchedAt: number
    dispatchedBy: string
    dispatchedByRole: 'municipal_admin'
    statusUpdatedAt: number
    lastStatusAt: number
    acknowledgementDeadlineAt: number
    correlationId: string
    idempotencyKey: string
    schemaVersion: 1
  }
}

export function buildReportOpsSeeds(reports: readonly ReportSeed[]): ReportOpsSeed[] {
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

export function buildDispatchSeeds(reports: readonly ReportSeed[]): DispatchSeed[] {
  const report = reports.find(
    (candidate) =>
      candidate.id === TEST_RESPONDER_REPORT_ID &&
      candidate.municipalityId === TEST_RESPONDER_MUNICIPALITY_ID,
  )
  if (!report) return []

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

function getDb(): Firestore {
  if (getApps().length === 0) {
    initializeApp({ projectId: PROJECT_ID })
  }
  return getFirestore()
}

async function seedReports(db: Firestore) {
  console.log('Seeding reports...')
  const batch = db.batch()
  for (const report of REPORTS) {
    batch.set(db.collection('reports').doc(report.id), {
      ...report,
      createdAt: Timestamp.fromMillis(report.submittedAt),
    })
  }
  const reportOpsSeeds = buildReportOpsSeeds(REPORTS)
  for (const seed of reportOpsSeeds) {
    batch.set(db.collection('report_ops').doc(seed.id), seed.data)
  }
  const dispatchSeeds = buildDispatchSeeds(REPORTS)
  for (const seed of dispatchSeeds) {
    batch.set(db.collection('dispatches').doc(seed.id), seed.data)
  }
  await batch.commit()
  console.log(
    `✓ ${String(REPORTS.length)} reports, ${String(reportOpsSeeds.length)} report_ops, ` +
      `${String(dispatchSeeds.length)} dispatches seeded`,
  )
}

async function seedAlerts(db: Firestore) {
  console.log('Seeding alerts...')
  const batch = db.batch()
  for (const alert of ALERTS) {
    batch.set(db.collection('alerts').doc(alert.id), alert)
  }
  await batch.commit()
  console.log(`✓ ${String(ALERTS.length)} alerts seeded`)
}

export async function main(db = getDb()) {
  console.log(`\n🌱 Seeding staging incidents — ${new Date().toISOString()}\n`)
  await seedReports(db)
  await seedAlerts(db)
  console.log('\n✅ Done.')
  console.log('\nCoverage:')
  console.log('  Feed tab    — 10 reports across all severities and statuses')
  console.log('  Map tab     — same 10 reports with real Camarines Norte coordinates')
  console.log('  Alerts tab  — 5 alerts (critical → info)')
  console.log('  Responder   — 1 active dispatch for bfp-responder-test-01')
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((err: unknown) => {
    console.error('\n❌ Seed failed:', err)
    process.exit(1)
  })
}
