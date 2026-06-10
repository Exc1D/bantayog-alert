#!/usr/bin/env tsx
/**
 * Staging Callable Lifecycle Proof (2F-03)
 *
 * Proves the full MVP incident loop through the DEPLOYED HTTPS callables on
 * `bantayog-alert-staging` — not emulators:
 *   submit → verify → verify → dispatch → accept →
 *   advance(acknowledged → en_route → on_scene → resolved)
 *
 * It composes firebase-admin (custom-token minting, RTDB shift, final-state
 * assertions, cleanup) with the pure REST helpers in staging-callable-client.
 *
 * SAFETY RULES (reuses scripts/staging-seed.ts guards):
 *   - Refuses to run if FIRESTORE_EMULATOR_HOST is set.
 *   - Refuses to run against production project "bantayog-alert".
 *   - Requires GOOGLE_APPLICATION_CREDENTIALS or active gcloud ADC.
 *
 * Required env (fail loudly if missing):
 *   - STAGING_FIREBASE_API_KEY      (Firebase web API key — client-embedded, not secret)
 *   - STAGING_FIREBASE_APP_ID       (web appId, e.g. 1:...:web:...)
 *   - STAGING_APP_CHECK_DEBUG_TOKEN (registered App Check debug token — keep local)
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=path/to/staging-sa.json \
 *   STAGING_FIREBASE_API_KEY=... STAGING_FIREBASE_APP_ID=... \
 *   STAGING_APP_CHECK_DEBUG_TOKEN=... \
 *     pnpm staging:callable-proof
 */

import { createHash, randomUUID } from 'node:crypto'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { initializeApp, getApps, cert } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getDatabase, type Database } from 'firebase-admin/database'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'
import {
  callStagingCallable,
  exchangeAppCheckDebugToken,
  exchangeCustomTokenForIdToken,
  StagingCallableError,
} from './staging-callable-client'
import { assertStagingAllowed } from './staging-seed'

const STAGING_PROJECT_ID = 'bantayog-alert-staging'
const DATABASE_URL =
  'https://bantayog-alert-staging-default-rtdb.asia-southeast1.firebasedatabase.app'
const MUNICIPALITY_ID = 'daet'
const ADMIN_UID = 'daet-admin-test-01'
const RESPONDER_UID = 'bfp-responder-test-01'
const RESPONDER_AGENCY_ID = 'bfp-daet'

// ---------------------------------------------------------------------------
// Pure helpers (unit-tested without network / firebase-admin)
// ---------------------------------------------------------------------------

export interface CitizenReportProofPayload {
  reportType: string
  description: string
  severity: 'high'
  source: 'web'
  publicLocation: { lat: number; lng: number }
  municipalityId: string
  barangayId: string
  triage: { peopleInjured: boolean; peopleTrapped: boolean; locationConfidence: 'exact' }
}

export interface CitizenReportProofEnvelope {
  clientCreatedAt: number
  idempotencyKey: string
  publicRef: string
  secretHash: string
  correlationId: string
  payload: CitizenReportProofPayload
}

/** Build a submitCitizenReport envelope that satisfies the strict callable schema. */
export function buildCitizenReportPayload(now: number): CitizenReportProofEnvelope {
  // UUID hex digits ([0-9a-f]) are a subset of the publicRef alphabet ([a-z0-9]).
  const publicRef = randomUUID().replace(/-/g, '').slice(0, 8)
  const secretHash = createHash('sha256').update(randomUUID()).digest('hex')
  return {
    clientCreatedAt: now,
    idempotencyKey: randomUUID(),
    publicRef,
    secretHash,
    correlationId: randomUUID(),
    payload: {
      reportType: 'fire',
      description: 'Staging callable proof — automated MVP lifecycle test report. Safe to delete.',
      severity: 'high',
      source: 'web',
      publicLocation: { lat: 14.1162, lng: 122.9652 },
      municipalityId: MUNICIPALITY_ID,
      barangayId: 'Bagasbas',
      triage: { peopleInjured: false, peopleTrapped: false, locationConfidence: 'exact' },
    },
  }
}

export interface ProofDocIds {
  reportId: string
  publicRef: string
  secretHash: string
  dispatchId: string
}

/** Fixed document paths created by one proof run, for deterministic cleanup. */
export function buildProofCleanupPaths(ids: ProofDocIds): string[] {
  return [
    `reports/${ids.reportId}`,
    `report_private/${ids.reportId}`,
    `report_ops/${ids.reportId}`,
    `report_lookup/${ids.publicRef}`,
    `secret_lookup/${ids.secretHash}`,
    `dispatches/${ids.dispatchId}`,
  ]
}

// ---------------------------------------------------------------------------
// Orchestration (only runs when executed directly, never on import)
// ---------------------------------------------------------------------------

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Assertion failed: ${message}`)
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`staging-callable-proof: missing required env ${name}`)
  }
  return value
}

function initAdmin(): void {
  if (getApps().length > 0) return
  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim()
  if (credentialsPath) {
    initializeApp({
      credential: cert(resolve(credentialsPath)),
      projectId: STAGING_PROJECT_ID,
      databaseURL: DATABASE_URL,
    })
  } else {
    initializeApp({ projectId: STAGING_PROJECT_ID, databaseURL: DATABASE_URL })
  }
}

async function mintIdToken(
  apiKey: string,
  uid: string,
  claims: Record<string, unknown>,
): Promise<string> {
  const customToken = await getAuth().createCustomToken(uid, claims)
  return exchangeCustomTokenForIdToken({ apiKey, customToken })
}

async function assertFinalState(
  db: Firestore,
  ids: { reportId: string; publicRef: string; dispatchId: string },
  citizenUid: string,
): Promise<void> {
  const report = (await db.doc(`reports/${ids.reportId}`).get()).data()
  assert(report, 'reports doc missing after lifecycle')
  assert(report.status === 'resolved', `report status ${String(report.status)} != resolved`)
  assert(!('reporterUid' in report), 'reports doc leaked reporterUid (PII isolation broken)')

  const dispatch = (await db.doc(`dispatches/${ids.dispatchId}`).get()).data()
  assert(dispatch, 'dispatch doc missing after lifecycle')
  assert(dispatch.status === 'resolved', `dispatch status ${String(dispatch.status)} != resolved`)
  assert(
    typeof dispatch.resolutionSummary === 'string' && dispatch.resolutionSummary.length > 0,
    'dispatch missing resolutionSummary',
  )

  const ops = await db.doc(`report_ops/${ids.reportId}`).get()
  assert(ops.exists, 'report_ops doc missing')

  const priv = (await db.doc(`report_private/${ids.reportId}`).get()).data()
  assert(priv, 'report_private doc missing')
  assert(priv.reporterUid === citizenUid, 'report_private.reporterUid does not match reporter')

  const lookup = (await db.doc(`report_lookup/${ids.publicRef}`).get()).data()
  assert(lookup, 'report_lookup doc missing')
  assert(lookup.reportId === ids.reportId, 'report_lookup.reportId mismatch')
  for (const leaked of ['reporterUid', 'contactPhone', 'reporterRole']) {
    assert(!(leaked in lookup), `report_lookup leaked citizen-unsafe field ${leaked}`)
  }
}

async function deleteByQuery(
  db: Firestore,
  collection: string,
  field: string,
  value: string,
): Promise<number> {
  const snap = await db.collection(collection).where(field, '==', value).get()
  if (snap.empty) return 0
  let batch = db.batch()
  let n = 0
  for (const doc of snap.docs) {
    batch.delete(doc.ref)
    n += 1
    if (n % 400 === 0) {
      await batch.commit()
      batch = db.batch()
    }
  }
  await batch.commit()
  return snap.size
}

async function cleanup(
  db: Firestore,
  rtdb: Database,
  ids: ProofDocIds | null,
  citizenUid: string,
): Promise<void> {
  if (ids) {
    for (const path of buildProofCleanupPaths(ids)) {
      await db.recursiveDelete(db.doc(path)).catch(() => undefined)
    }
    await deleteByQuery(db, 'report_events', 'reportId', ids.reportId).catch(() => 0)
    await deleteByQuery(db, 'dispatch_events', 'dispatchId', ids.dispatchId).catch(() => 0)
  }
  await rtdb
    .ref(`/responder_index/${MUNICIPALITY_ID}/${RESPONDER_UID}`)
    .remove()
    .catch(() => undefined)
  await getAuth()
    .deleteUser(citizenUid)
    .catch(() => undefined)
}

async function main(): Promise<void> {
  assertStagingAllowed()
  const apiKey = requireEnv('STAGING_FIREBASE_API_KEY')
  const appId = requireEnv('STAGING_FIREBASE_APP_ID')
  const debugToken = requireEnv('STAGING_APP_CHECK_DEBUG_TOKEN')

  initAdmin()
  const db = getFirestore()
  const rtdb = getDatabase()

  console.log(`\nStaging callable proof — ${STAGING_PROJECT_ID} — ${new Date().toISOString()}\n`)

  const appCheckToken = await exchangeAppCheckDebugToken({ apiKey, appId, debugToken })
  console.log('  ✓ App Check debug token exchanged')

  const citizenUid = `proof-citizen-${randomUUID()}`
  const citizenIdToken = await mintIdToken(apiKey, citizenUid, {
    role: 'citizen',
    accountStatus: 'active',
  })
  const adminIdToken = await mintIdToken(apiKey, ADMIN_UID, {
    role: 'municipal_admin',
    accountStatus: 'active',
    municipalityId: MUNICIPALITY_ID,
  })
  const responderIdToken = await mintIdToken(apiKey, RESPONDER_UID, {
    role: 'responder',
    accountStatus: 'active',
    municipalityId: MUNICIPALITY_ID,
    agencyId: RESPONDER_AGENCY_ID,
    permittedMunicipalityIds: [MUNICIPALITY_ID],
  })
  console.log('  ✓ Citizen / admin / responder ID tokens minted')

  // Deployed dispatchResponder requires the responder on shift via RTDB.
  // staging:seed does NOT seed this, so the proof sets it explicitly.
  await rtdb
    .ref(`/responder_index/${MUNICIPALITY_ID}/${RESPONDER_UID}`)
    .set({ isOnShift: true, updatedAt: Date.now() })
  console.log('  ✓ Responder shift set in RTDB')

  const envelope = buildCitizenReportPayload(Date.now())
  let ids: ProofDocIds | null = null

  try {
    const submit = (await callStagingCallable({
      functionName: 'submitCitizenReport',
      payload: envelope,
      idToken: citizenIdToken,
      appCheckToken,
    })) as { reportId?: unknown; publicRef?: unknown }
    assert(typeof submit.reportId === 'string', 'submitCitizenReport returned no reportId')
    const reportId = submit.reportId
    const dispatchId = `${reportId}_${RESPONDER_UID}`
    ids = { reportId, publicRef: envelope.publicRef, secretHash: envelope.secretHash, dispatchId }
    console.log(`  ✓ submitCitizenReport → report ${reportId}`)

    await callStagingCallable({
      functionName: 'verifyReport',
      payload: { reportId, idempotencyKey: randomUUID() },
      idToken: adminIdToken,
      appCheckToken,
    })
    await callStagingCallable({
      functionName: 'verifyReport',
      payload: { reportId, idempotencyKey: randomUUID() },
      idToken: adminIdToken,
      appCheckToken,
    })
    console.log('  ✓ verifyReport ×2 → new → awaiting_verify → verified')

    await callStagingCallable({
      functionName: 'dispatchResponder',
      payload: { reportId, responderUid: RESPONDER_UID, idempotencyKey: randomUUID() },
      idToken: adminIdToken,
      appCheckToken,
    })
    console.log(`  ✓ dispatchResponder → dispatch ${dispatchId}`)

    await callStagingCallable({
      functionName: 'acceptDispatch',
      payload: { dispatchId, idempotencyKey: randomUUID() },
      idToken: responderIdToken,
      appCheckToken,
    })
    console.log('  ✓ acceptDispatch → accepted')

    for (const to of ['acknowledged', 'en_route', 'on_scene'] as const) {
      await callStagingCallable({
        functionName: 'advanceDispatch',
        payload: { dispatchId, to, idempotencyKey: randomUUID() },
        idToken: responderIdToken,
        appCheckToken,
      })
    }
    await callStagingCallable({
      functionName: 'advanceDispatch',
      payload: {
        dispatchId,
        to: 'resolved',
        resolutionSummary: 'Staging proof resolved — automated lifecycle test.',
        idempotencyKey: randomUUID(),
      },
      idToken: responderIdToken,
      appCheckToken,
    })
    console.log('  ✓ advanceDispatch → acknowledged → en_route → on_scene → resolved')

    await assertFinalState(db, { reportId, publicRef: envelope.publicRef, dispatchId }, citizenUid)
    console.log('  ✓ Final state + PII isolation asserted via Admin SDK')

    console.log('\nPROOF PASSED — full MVP loop verified through deployed staging callables.\n')
  } finally {
    await cleanup(db, rtdb, ids, citizenUid)
    console.log('  ✓ Cleanup complete (proof docs deleted, shift cleared, citizen user removed)')
  }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href

if (isMain) {
  main().catch((err: unknown) => {
    if (err instanceof StagingCallableError) {
      console.error(`\nStaging callable proof FAILED [${err.status}]: ${err.message}`)
    } else {
      console.error(
        '\nStaging callable proof FAILED:',
        err instanceof Error ? err.message : String(err),
      )
    }
    process.exit(1)
  })
}
