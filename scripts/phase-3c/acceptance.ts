#!/usr/bin/env tsx
/**
 * Phase 3c acceptance gate — responder loop end-to-end.
 *
 * Tests the complete responder lifecycle:
 *   dispatch → accept → progress (acknowledged/en_route/on_scene) → resolve → close
 *   Plus: cancel from accepted, idempotency guard, dispatchMirrorToReport sync
 *
 * Run against local emulator:
 *   firebase emulators:exec --only firestore,functions,auth,pubsub \
 *     "pnpm tsx scripts/phase-3c/acceptance.ts --env=emulator"
 *
 * Run against staging:
 *   GOOGLE_APPLICATION_CREDENTIALS=./sa.json \
 *     pnpm tsx scripts/phase-3c/acceptance.ts --env=staging
 */
import { initializeApp, getApp, getApps } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import { getDatabase } from 'firebase-admin/database'
import {
  httpsCallable,
  getFunctions as webGetFunctions,
  connectFunctionsEmulator,
} from 'firebase/functions'
import { initializeApp as webInitApp } from 'firebase/app'
import { getAuth as webGetAuth, signInWithCustomToken, connectAuthEmulator } from 'firebase/auth'

interface Assertion {
  name: string
  ok: boolean
  detail?: string
}

const results: Assertion[] = []
function check(name: string, ok: boolean, detail?: string): void {
  results.push({ name, ok, detail })
  console.log(ok ? `✓ PASS ${name}` : `✗ FAIL ${name}${detail ? ` — ${detail}` : ''}`)
}

const EMU = process.argv.find((a) => a.startsWith('--env='))?.split('=')[1] !== 'staging'
const PROJECT_ID =
  process.env.GCLOUD_PROJECT ?? process.env.FIREBASE_PROJECT_ID ?? 'bantayog-alert-staging'

if (getApps().length === 0) {
  initializeApp({ projectId: PROJECT_ID })
}

const adminDb = getFirestore(getApp())
const adminAuth = getAuth(getApp())
const adminRtdb = getDatabase(getApp())

// Shared timestamp for seeding (created once to ensure consistency)
const now = Timestamp.now()

// ─── Helpers ───────────────────────────────────────────────────────────────────

/** Read a dispatch doc and return its data (or null if not found). */
async function readDispatch(dispatchId: string) {
  const doc = await adminDb.collection('dispatches').doc(dispatchId).get()
  return doc.exists ? doc.data() : null
}

/** Read a report doc and return its data (or null if not found). */
async function readReport(reportId: string) {
  const doc = await adminDb.collection('reports').doc(reportId).get()
  return doc.exists ? doc.data() : null
}

/** Seed a report at the specified status with minimal required fields. */
async function seedReport(id: string, status: string, reporterUid: string, description: string) {
  await adminDb.collection('reports').doc(id).set({
    reportId: id,
    status,
    municipalityId: MUNI_ID,
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
    .doc(id)
    .set({
      reportId: id,
      reporterUid,
      rawDescription: description,
      coordinatesPrecise: { lat: 14.1134, lng: 122.9554 },
      schemaVersion: 1,
    })
  await adminDb.collection('report_ops').doc(id).set({
    reportId: id,
    verifyQueuePriority: 0,
    assignedMunicipalityAdmins: [],
    schemaVersion: 1,
  })
}

// ─── Test accounts ────────────────────────────────────────────────────────────

const ADMIN_UID = 'daet-admin-test-01'
const RESPONDER_UID = 'bfp-responder-test-01'
const MUNI_ID = 'daet'

async function main(): Promise<void> {
  console.log(`\n🧪 Phase 3c Acceptance Test (env=${EMU ? 'emulator' : 'staging'})\n`)

  // ── 0. Ensure test data seeded ────────────────────────────────────────────

  // Seed responder on shift in RTDB (needed for useOwnDispatches)
  await adminRtdb
    .ref(`/responder_index/${MUNI_ID}/${RESPONDER_UID}`)
    .set({ isOnShift: true, updatedAt: Date.now() })
  check('Responder on-shift index set', true, RESPONDER_UID)

  // ── 1. Seed a verified report ─────────────────────────────────────────────

  const reportId = adminDb.collection('reports').doc().id
  await seedReport(reportId, 'verified', 'cit-acceptance-01', 'phase-3c acceptance seed')
  check('Seeded verified report', true, reportId)

  // ── 2. Mint admin + responder tokens ──────────────────────────────────────

  await adminAuth.setCustomUserClaims(ADMIN_UID, {
    role: 'municipal_admin',
    municipalityId: MUNI_ID,
    active: true,
  })
  const adminToken = await adminAuth.createCustomToken(ADMIN_UID)
  check('Admin custom token minted', true, ADMIN_UID)

  await adminAuth.setCustomUserClaims(RESPONDER_UID, {
    role: 'responder',
    municipalityId: MUNI_ID,
    agencyId: 'bfp-daet',
    active: true,
  })
  const responderToken = await adminAuth.createCustomToken(RESPONDER_UID)
  check('Responder custom token minted', true, RESPONDER_UID)

  // ── 3. Web SDK setup for callable invocations ──────────────────────────────

  const webApp = webInitApp({
    apiKey: 'emulator-api-key',
    authDomain: 'localhost',
    projectId: PROJECT_ID,
    appId: 'demo-app',
  })
  const webAuth = webGetAuth(webApp)
  const webFunctions = webGetFunctions(webApp)

  if (EMU) {
    connectAuthEmulator(webAuth, 'http://localhost:9099', { disableWarnings: true })
    connectFunctionsEmulator(webFunctions, 'localhost', 5001)
  }

  // ── 4. dispatchResponder — verified → assigned, dispatch created ──────────

  await signInWithCustomToken(webAuth, adminToken)
  const dispatchFn = httpsCallable(webFunctions, 'dispatchResponder')
  const dispData = (
    await dispatchFn({
      reportId,
      responderUid: RESPONDER_UID,
      idempotencyKey: crypto.randomUUID(),
    })
  ).data as { dispatchId: string; status: string }
  check('dispatchResponder: created dispatch', dispData.status === 'pending', dispData.dispatchId)

  const dispatchId = dispData.dispatchId
  check('Dispatch doc exists', (await readDispatch(dispatchId)) !== null)
  check(
    'Report status assigned after dispatch',
    (await readReport(reportId))?.status === 'assigned',
    'assigned',
  )

  // ── 5. acceptDispatch — pending → accepted ─────────────────────────────────

  const acceptFn = httpsCallable(webFunctions, 'acceptDispatch')
  const acceptData = (await acceptFn({ dispatchId, idempotencyKey: crypto.randomUUID() })).data as {
    status: string
  }
  check('acceptDispatch: pending → accepted', acceptData.status === 'accepted', acceptData.status)

  // Check dispatch + report status after accept
  const dispAfterAccept = await readDispatch(dispatchId)
  check('Dispatch status accepted', dispAfterAccept?.status === 'accepted')
  const reportAfterAccept = await readReport(reportId)
  check(
    'Report status updated to acknowledged after accept',
    reportAfterAccept?.status === 'acknowledged',
    reportAfterAccept?.status,
  )

  // ── 6. acceptDispatch idempotency — second call is no-op ──────────────────

  const acceptData2 = (
    await acceptFn({
      dispatchId,
      idempotencyKey: '11111111-1111-1111-1111-111111111111',
    })
  ).data as { status: string }
  check(
    'acceptDispatch idempotent: second call returns accepted (not error)',
    acceptData2.status === 'accepted',
  )

  // ── 7–10. Responder direct-write: cycle through dispatch statuses ─────────

  const dispatchTransition = async (
    nextStatus: string,
    extraFields: Record<string, unknown> = {},
    reportStatus?: string,
  ) => {
    await adminDb
      .collection('dispatches')
      .doc(dispatchId)
      .update({ status: nextStatus, ...extraFields })
    const disp = await readDispatch(dispatchId)
    check(`Dispatch ${nextStatus}`, disp?.status === nextStatus)
    const report = await readReport(reportId)
    check(
      `Report status updated to ${nextStatus}`,
      report?.status === (reportStatus ?? nextStatus),
      report?.status,
    )
  }

  await dispatchTransition('acknowledged', {
    acknowledgedAt: Timestamp.now(),
    acknowledgementDeadlineAt: Timestamp.fromDate(new Date(Date.now() + 5 * 60 * 1000)),
  })
  await dispatchTransition('en_route', { enRouteAt: Timestamp.now() })
  await dispatchTransition('on_scene', { onSceneAt: Timestamp.now() })
  await dispatchTransition('resolved', { resolvedAt: Timestamp.now() })

  // ── 11. closeReport — resolved → closed ──────────────────────────────────

  const closeData = (
    await httpsCallable(
      webFunctions,
      'closeReport',
    )({
      reportId,
      idempotencyKey: crypto.randomUUID(),
    })
  ).data as { status: string }
  check('closeReport: resolved → closed', closeData.status === 'closed', closeData.status)
  check('Report status closed', (await readReport(reportId))?.status === 'closed')

  // ── 12. Test cancelDispatch from accepted ────────────────────────────────

  // Seed second report + dispatch at assigned status, then accept
  const reportId2 = adminDb.collection('reports').doc().id
  await seedReport(reportId2, 'assigned', 'cit-acceptance-02', 'cancel test seed')

  const disp2Id = (
    await dispatchFn({
      reportId: reportId2,
      responderUid: RESPONDER_UID,
      idempotencyKey: crypto.randomUUID(),
    })
  ).data as { dispatchId: string }
  check('Dispatch 2 exists', (await readDispatch(disp2Id.dispatchId)) !== null)

  // Accept it
  await acceptFn({ dispatchId: disp2Id.dispatchId, idempotencyKey: crypto.randomUUID() })
  check('Dispatch 2 accepted', (await readDispatch(disp2Id.dispatchId))?.status === 'accepted')

  // Cancel from accepted (Phase 3c widened)
  const cancelFn = httpsCallable(webFunctions, 'cancelDispatch')
  const cancelData = (
    await cancelFn({
      dispatchId: disp2Id.dispatchId,
      reason: 'responder_unavailable',
      idempotencyKey: crypto.randomUUID(),
    })
  ).data as { status: string }
  check(
    'cancelDispatch: accepted → cancelled',
    cancelData.status === 'cancelled',
    cancelData.status,
  )
  check(
    'Dispatch 2 cancelled doc',
    (await readDispatch(disp2Id.dispatchId))?.status === 'cancelled',
  )

  // ── 13. cancelDispatch cannot cancel resolved ───────────────────────────────

  try {
    await cancelFn({
      dispatchId, // already resolved from step 10
      reason: 'test_should_fail',
      idempotencyKey: crypto.randomUUID(),
    })
    check('cancelDispatch: resolved is terminal — should throw', false, 'did not throw')
  } catch (err: unknown) {
    const errCode = (err as { code?: string }).code
    check(
      'cancelDispatch: resolved → throws FAILED_PRECONDITION',
      errCode === 'failed-precondition' || errCode === 'FAILED_PRECONDITION',
      errCode ?? String(err),
    )
  }

  // ── Output ─────────────────────────────────────────────────────────────────

  console.log('\n--- RESULT ---')
  const passed = results.filter((r) => r.ok).length
  const failed = results.filter((r) => !r.ok).length
  console.log(`${passed} passed, ${failed} failed`)
  console.log(JSON.stringify({ passed, failed, assertions: results }, null, 2))
  process.exit(failed > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error('[acceptance] fatal:', err)
  process.exit(1)
})
