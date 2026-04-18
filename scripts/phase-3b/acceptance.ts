import { initializeApp, getApp, getApps } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'
import { getFunctions } from 'firebase-admin/functions'
import { httpsCallable, getFunctions as webGetFunctions } from 'firebase/functions'
import { initializeApp as webInitApp } from 'firebase/app'
import { getAuth as webGetAuth, signInWithCustomToken, connectAuthEmulator } from 'firebase/auth'

type Report = { passed: boolean; assertions: Array<{ name: string; ok: boolean; detail?: string }> }

const EMU = !process.argv.includes('--env=staging')
if (EMU) {
  process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080'
  process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099'
  process.env.FIREBASE_DATABASE_EMULATOR_HOST = 'localhost:9000'
}

const PROJECT_ID =
  process.env.GCLOUD_PROJECT ?? process.env.FIREBASE_PROJECT_ID ?? 'bantayog-alert-dev'

if (getApps().length === 0) {
  initializeApp({ projectId: PROJECT_ID })
}

const adminAuth = getAuth(getApp())
const adminDb = getFirestore(getApp())

const report: Report = { passed: true, assertions: [] }
function check(name: string, ok: boolean, detail?: string) {
  report.assertions.push({ name, ok, detail })
  if (!ok) report.passed = false
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`)
}

async function main() {
  const reportId = adminDb.collection('reports').doc().id
  const now = new Date()

  // Seed a verified report (prereq for dispatch).
  await adminDb.collection('reports').doc(reportId).set({
    reportId,
    status: 'verified',
    municipalityId: 'daet',
    municipalityLabel: 'Daet',
    source: 'citizen_pwa',
    severityDerived: 'medium',
    correlationId: crypto.randomUUID(),
    createdAt: now,
    lastStatusAt: now,
    lastStatusBy: 'system:acceptance-seed',
    schemaVersion: 1,
  })
  await adminDb
    .collection('report_private')
    .doc(reportId)
    .set({
      reportId,
      reporterUid: 'cit-acceptance-01',
      rawDescription: 'seed',
      coordinatesPrecise: { lat: 14.1134, lng: 122.9554 },
      schemaVersion: 1,
    })
  await adminDb.collection('report_ops').doc(reportId).set({
    reportId,
    verifyQueuePriority: 0,
    assignedMunicipalityAdmins: [],
    schemaVersion: 1,
  })
  check('Seeded verified report', true, reportId)

  // Mint a custom token for the seeded admin.
  const adminUid = 'daet-admin-test-01'
  await adminAuth.setCustomUserClaims(adminUid, {
    role: 'municipal_admin',
    municipalityId: 'daet',
    active: true,
  })
  const adminCustomToken = await adminAuth.createCustomToken(adminUid)
  check('Admin custom token minted', true, adminUid)

  // Set up web SDK client for callable invocation.
  const webApp = webInitApp({ appId: 'demo' })
  const webAuth = webGetAuth(webApp)
  const webFunctions = webGetFunctions(webApp)

  if (EMU) {
    connectAuthEmulator(webAuth, 'http://localhost:9099', { disableWarnings: true })
  }

  await signInWithCustomToken(webAuth, adminCustomToken)
  check('Admin signed in via web SDK', true)

  // Call verifyReport to advance verified → assigned (via dispatch).
  // First, advance verified → awaiting_verify → verified (two-step).
  // Actually, start from 'new' and advance to 'verified' then dispatch.

  // Re-seed at 'new' status to test verify path.
  const reportId2 = adminDb.collection('reports').doc().id
  await adminDb.collection('reports').doc(reportId2).set({
    reportId: reportId2,
    status: 'new',
    municipalityId: 'daet',
    municipalityLabel: 'Daet',
    source: 'citizen_pwa',
    severityDerived: 'medium',
    correlationId: crypto.randomUUID(),
    createdAt: now,
    lastStatusAt: now,
    lastStatusBy: 'system:acceptance-seed',
    schemaVersion: 1,
  })
  await adminDb.collection('report_ops').doc(reportId2).set({
    reportId: reportId2,
    verifyQueuePriority: 0,
    assignedMunicipalityAdmins: [],
    schemaVersion: 1,
  })
  check('Seeded new report for verify test', true, reportId2)

  // Call verifyReport: new → awaiting_verify.
  const verifyFn = httpsCallable(webFunctions, 'verifyReport')
  const v1 = await verifyFn({ reportId: reportId2, idempotencyKey: crypto.randomUUID() })
  check(
    'verifyReport: new→awaiting_verify',
    (v1.data as { status: string }).status === 'awaiting_verify',
  )

  // Call verifyReport again: awaiting_verify → verified.
  const v2 = await verifyFn({ reportId: reportId2, idempotencyKey: crypto.randomUUID() })
  check(
    'verifyReport: awaiting_verify→verified',
    (v2.data as { status: string }).status === 'verified',
  )

  // Call dispatchResponder with the test responder.
  const dispFn = httpsCallable(webFunctions, 'dispatchResponder')
  const dispResult = await dispFn({
    reportId: reportId2,
    responderUid: 'bfp-responder-test-01',
    idempotencyKey: crypto.randomUUID(),
  })
  const dispData = dispResult.data as { dispatchId: string; status: string }
  check('dispatchResponder: created dispatch', dispData.status === 'pending', dispData.dispatchId)

  // Verify the dispatch document exists.
  const dispDoc = await adminDb.collection('dispatches').doc(dispData.dispatchId).get()
  check('Dispatch doc persisted', dispDoc.exists)

  // Verify report status is 'assigned'.
  const reportDoc = await adminDb.collection('reports').doc(reportId2).get()
  check('Report status assigned', reportDoc.data()?.status === 'assigned')

  // Test cross-muni rejection: try to dispatch a report from a different municipality.
  const crossMuniReportId = adminDb.collection('reports').doc().id
  await adminDb.collection('reports').doc(crossMuniReportId).set({
    reportId: crossMuniReportId,
    status: 'verified',
    municipalityId: 'mercedes',
    municipalityLabel: 'Mercedes',
    source: 'citizen_pwa',
    severityDerived: 'medium',
    correlationId: crypto.randomUUID(),
    createdAt: now,
    lastStatusAt: now,
    lastStatusBy: 'system:acceptance-seed',
    schemaVersion: 1,
  })
  await adminDb
    .collection('report_private')
    .doc(crossMuniReportId)
    .set({
      reportId: crossMuniReportId,
      reporterUid: 'cit-cross-01',
      rawDescription: 'seed',
      coordinatesPrecise: { lat: 14.3, lng: 123.0 },
      schemaVersion: 1,
    })
  await adminDb.collection('report_ops').doc(crossMuniReportId).set({
    reportId: crossMuniReportId,
    verifyQueuePriority: 0,
    assignedMunicipalityAdmins: [],
    schemaVersion: 1,
  })

  try {
    await dispFn({
      reportId: crossMuniReportId,
      responderUid: 'bfp-responder-test-01',
      idempotencyKey: crypto.randomUUID(),
    })
    check('Cross-muni rejection', false, 'should have thrown')
  } catch (err: unknown) {
    const errCode = (err as { code?: string }).code
    check(
      'Cross-muni rejection',
      errCode === 'permission-denied' || errCode === 'FORBIDDEN',
      errCode ?? 'unknown',
    )
  }

  // Output JSON report.
  console.log('\n--- RESULT ---')
  console.log(JSON.stringify(report, null, 2))
  process.exit(report.passed ? 0 : 1)
}

main().catch((err) => {
  console.error('[acceptance] fatal:', err)
  process.exit(1)
})
