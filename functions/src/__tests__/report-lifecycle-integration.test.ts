import { describe, expect, afterAll } from 'vitest'
import { randomUUID } from 'node:crypto'
import { Timestamp } from 'firebase-admin/firestore'
import { adminDb, rtdb as adminRtdb } from '../admin-init.js'
import { processInboxItemCore } from '../domains/reports/process-inbox-item.js'
import { verifyReportCore } from '../domains/reports/verify-report.js'
import { dispatchResponderCore } from '../domains/dispatches/dispatch-responder.js'
import { acceptDispatchCore } from '../domains/dispatches/accept-dispatch.js'
import { advanceDispatchCore } from '../domains/dispatches/advance-dispatch.js'
import { seedResponderDoc, seedResponderShift } from './helpers/seed-factories.js'

// ---------------------------------------------------------------------------
// Emulator guard
// ---------------------------------------------------------------------------

async function probeFirestore(host: string, port: number): Promise<boolean> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => {
      controller.abort()
    }, 2000)
    const response = await fetch(`http://${host}:${String(port)}`, { signal: controller.signal })
    clearTimeout(timeout)
    return response.status === 200 || response.status === 404
  } catch {
    return false
  }
}

async function probeRtdb(host: string, port: number): Promise<boolean> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => {
      controller.abort()
    }, 2000)
    const response = await fetch(`http://${host}:${String(port)}/.json?ns=dummy`, {
      signal: controller.signal,
    })
    clearTimeout(timeout)
    return response.status === 401 || response.status === 404 || response.status === 200
  } catch {
    return false
  }
}

const firestoreAvailable = await probeFirestore('127.0.0.1', 8081)
const rtdbAvailable = await probeRtdb('127.0.0.1', 9000)
const emulatorAvailable = firestoreAvailable && rtdbAvailable
const itif = (condition: boolean) => (condition ? it : it.skip)

// ---------------------------------------------------------------------------
// Test slugs
// ---------------------------------------------------------------------------

const SLUG = randomUUID().slice(0, 8)
const PUBLIC_REF = SLUG
const CORRELATION_ID = randomUUID()
const AGENCY_ID = 'BFP'
const MUNICIPALITY_ID = 'daet'
const UID_ADMIN = `admin-${SLUG}`
const UID_RESPONDER = `responder-${SLUG}`

const NOW = Date.now()
const TIMESTAMP = Timestamp.fromMillis(NOW)

// ---------------------------------------------------------------------------
// State accumulated across tests
// ---------------------------------------------------------------------------

const state: {
  inboxId: string
  reportId: string
  dispatchId: string
} = {
  inboxId: '',
  reportId: '',
  dispatchId: '',
}

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

afterAll(async () => {
  if (!emulatorAvailable) return

  const paths: string[] = [`municipalities/${MUNICIPALITY_ID}`]
  if (state.inboxId) paths.push(`report_inbox/${state.inboxId}`)
  if (state.reportId) {
    paths.push(`reports/${state.reportId}`)
    paths.push(`report_ops/${state.reportId}`)
    paths.push(`report_private/${state.reportId}`)
    paths.push(`report_contacts/${state.reportId}`)
    paths.push(`report_lookup/${PUBLIC_REF}`)
  }
  if (state.dispatchId) paths.push(`dispatches/${state.dispatchId}`)

  const batch = adminDb.batch()
  for (const p of paths) {
    const ref = adminDb.doc(p)
    const snap = await ref.get()
    if (snap.exists) batch.delete(ref)
  }
  await batch.commit()

  await adminRtdb.ref(`/responder_index/${MUNICIPALITY_ID}/${UID_RESPONDER}`).remove()
  await adminRtdb.ref(`/active_responders/${MUNICIPALITY_ID}/${UID_RESPONDER}`).remove()
})

// ---------------------------------------------------------------------------
// Seed helpers
// ---------------------------------------------------------------------------

async function seedMunicipality() {
  await adminDb
    .collection('municipalities')
    .doc(MUNICIPALITY_ID)
    .set({
      id: MUNICIPALITY_ID,
      label: 'Daet',
      provinceId: 'camarines-norte',
      centroid: { lat: 14.11, lng: 122.95 },
      schemaVersion: 1,
    })
}

async function seedInboxEntry(): Promise<string> {
  const inboxRef = adminDb.collection('report_inbox').doc()
  await inboxRef.set({
    reporterUid: `citizen-${SLUG}`,
    clientCreatedAt: NOW,
    idempotencyKey: randomUUID(),
    publicRef: PUBLIC_REF,
    secretHash: 'a'.repeat(64),
    correlationId: CORRELATION_ID,
    payload: {
      reportType: 'flood',
      description: `Backend lifecycle integration test ${SLUG}`,
      severity: 'medium',
      source: 'web',
      municipalityId: MUNICIPALITY_ID,
      barangayId: 'barangay-01',
      publicLocation: { lat: 14.0, lng: 122.0 },
      contact: { phone: '+639121234567', smsConsent: true },
    },
  })
  return inboxRef.id
}

async function seedResponder() {
  await seedResponderDoc(adminDb, {
    uid: UID_RESPONDER,
    municipalityId: MUNICIPALITY_ID,
    agencyId: AGENCY_ID,
    isActive: true,
    displayName: 'Test Responder',
  })
  await seedResponderShift(adminRtdb, MUNICIPALITY_ID, UID_RESPONDER, true)
}

async function getDoc(path: string) {
  const snap = await adminDb.doc(path).get()
  return snap.exists ? { id: snap.id, data: snap.data() } : null
}

// ===========================================================================
// Tests
// ===========================================================================

describe(`Report lifecycle integration [${SLUG}]`, { timeout: 60000 }, () => {
  // ---- C01: Seed inbox + materialize report ----
  itif(emulatorAvailable)('C01: seeds report_inbox and materializes report', async () => {
    await seedMunicipality()
    state.inboxId = await seedInboxEntry()

    const inboxDoc = await getDoc(`report_inbox/${state.inboxId}`)
    expect(inboxDoc).not.toBeNull()
    expect(inboxDoc!.data.publicRef).toBe(PUBLIC_REF)

    const result = await processInboxItemCore({
      db: adminDb,
      inboxId: state.inboxId,
      now: () => NOW,
    })
    expect(result.materialized).toBe(true)
    expect(result.reportId).toMatch(/^[0-9a-f-]+$/)
    expect(result.publicRef).toBe(PUBLIC_REF)
    state.reportId = result.reportId

    const report = await getDoc(`reports/${state.reportId}`)
    expect(report).not.toBeNull()
    expect(report!.data.status).toBe('new')
    expect(report!.data.municipalityId).toBe(MUNICIPALITY_ID)

    const reportOps = await getDoc(`report_ops/${state.reportId}`)
    expect(reportOps).not.toBeNull()
    expect(reportOps!.data.status).toBe('new')

    const reportPrivate = await getDoc(`report_private/${state.reportId}`)
    expect(reportPrivate).not.toBeNull()

    const lookup = await getDoc(`report_lookup/${PUBLIC_REF}`)
    expect(lookup).not.toBeNull()
    expect(lookup!.data.reportId).toBe(state.reportId)
  })

  // ---- C02: Verify the report ----
  itif(emulatorAvailable)('C02: verifies the report', async () => {
    expect(state.reportId).not.toBe('')
    await seedResponder()

    // verify is a two-step: new → awaiting_verify → verified
    await verifyReportCore(adminDb, {
      reportId: state.reportId,
      actor: {
        uid: UID_ADMIN,
        claims: { role: 'provincial_superadmin', municipalityId: MUNICIPALITY_ID },
      },
      now: TIMESTAMP,
      correlationId: CORRELATION_ID,
      scrubbedDescription: `Verified report ${SLUG}`,
      visibilityClass: 'public_alertable',
      idempotencyKey: randomUUID(),
    })

    await verifyReportCore(adminDb, {
      reportId: state.reportId,
      actor: {
        uid: UID_ADMIN,
        claims: { role: 'provincial_superadmin', municipalityId: MUNICIPALITY_ID },
      },
      now: Timestamp.fromMillis(NOW + 1),
      correlationId: CORRELATION_ID,
      scrubbedDescription: `Verified report ${SLUG}`,
      visibilityClass: 'public_alertable',
      idempotencyKey: randomUUID(),
    })

    const report = await getDoc(`reports/${state.reportId}`)
    expect(report).not.toBeNull()
    expect(report!.data.status).toBe('verified')
    expect(report!.data.visibilityClass).toBe('public_alertable')
  })

  // ---- C03: Dispatch responder ----
  itif(emulatorAvailable)('C03: dispatches responder', async () => {
    expect(state.reportId).not.toBe('')

    const dispatchResult = await dispatchResponderCore(adminDb, adminRtdb, {
      actor: {
        uid: UID_ADMIN,
        claims: { role: 'provincial_superadmin', municipalityId: MUNICIPALITY_ID },
      },
      reportId: state.reportId,
      taskType: 'flood',
      responderUid: UID_RESPONDER,
      agencyId: AGENCY_ID,
      municipalityId: MUNICIPALITY_ID,
      now: TIMESTAMP,
      correlationId: CORRELATION_ID,
      idempotencyKey: randomUUID(),
    })

    state.dispatchId = dispatchResult.dispatchId
    expect(state.dispatchId).toContain('_')

    const dispatch = await getDoc(`dispatches/${state.dispatchId}`)
    expect(dispatch).not.toBeNull()
    expect(dispatch!.data.status).toBe('pending')
    expect(dispatch!.data.assignedTo?.uid).toBe(UID_RESPONDER)

    const report = await getDoc(`reports/${state.reportId}`)
    expect(report!.data.status).toBe('assigned')
  })

  // ---- C04: Accept dispatch and progress to on_scene ----
  itif(emulatorAvailable)('C04: responder accepts and progresses to on_scene', async () => {
    expect(state.dispatchId).not.toBe('')

    await acceptDispatchCore(adminDb, {
      dispatchId: state.dispatchId,
      actor: { uid: UID_RESPONDER, claims: { role: 'responder', municipalityId: MUNICIPALITY_ID } },
      now: TIMESTAMP,
      idempotencyKey: randomUUID(),
    })

    let dispatch = await getDoc(`dispatches/${state.dispatchId}`)
    expect(dispatch).not.toBeNull()
    expect(dispatch!.data.status).toBe('accepted')

    // accepted → acknowledged
    await advanceDispatchCore(adminDb, {
      dispatchId: state.dispatchId,
      to: 'acknowledged',
      actor: { uid: UID_RESPONDER, claims: { role: 'responder', municipalityId: MUNICIPALITY_ID } },
      now: TIMESTAMP,
      idempotencyKey: randomUUID(),
    })

    dispatch = await getDoc(`dispatches/${state.dispatchId}`)
    expect(dispatch).not.toBeNull()
    expect(dispatch!.data.status).toBe('acknowledged')

    // acknowledged → en_route
    await advanceDispatchCore(adminDb, {
      dispatchId: state.dispatchId,
      to: 'en_route',
      actor: { uid: UID_RESPONDER, claims: { role: 'responder', municipalityId: MUNICIPALITY_ID } },
      now: TIMESTAMP,
      idempotencyKey: randomUUID(),
    })

    dispatch = await getDoc(`dispatches/${state.dispatchId}`)
    expect(dispatch).not.toBeNull()
    expect(dispatch!.data.status).toBe('en_route')
    expect(dispatch!.data.enRouteAt).toBeGreaterThan(0)

    // en_route → on_scene
    await advanceDispatchCore(adminDb, {
      dispatchId: state.dispatchId,
      to: 'on_scene',
      actor: { uid: UID_RESPONDER, claims: { role: 'responder', municipalityId: MUNICIPALITY_ID } },
      now: TIMESTAMP,
      idempotencyKey: randomUUID(),
    })

    dispatch = await getDoc(`dispatches/${state.dispatchId}`)
    expect(dispatch).not.toBeNull()
    expect(dispatch!.data.status).toBe('on_scene')
    expect(dispatch!.data.onSceneAt).toBeGreaterThan(0)

    // Report should also have been mirrored to on_scene via dispatchMirrorToReport
    const report = await getDoc(`reports/${state.reportId}`)
    expect(report).not.toBeNull()
    expect(report!.data.status).toBe('on_scene')
  })

  // ---- C05: Resolve ----
  itif(emulatorAvailable)('C05: advances to resolved', async () => {
    expect(state.dispatchId).not.toBe('')

    await advanceDispatchCore(adminDb, {
      dispatchId: state.dispatchId,
      to: 'resolved',
      resolutionSummary: `Resolved successfully in test ${SLUG}`,
      actor: { uid: UID_RESPONDER, claims: { role: 'responder', municipalityId: MUNICIPALITY_ID } },
      now: TIMESTAMP,
      idempotencyKey: randomUUID(),
    })

    const dispatch = await getDoc(`dispatches/${state.dispatchId}`)
    expect(dispatch).not.toBeNull()
    expect(dispatch!.data.status).toBe('resolved')
    expect(dispatch!.data.resolvedAt).toBeGreaterThan(0)

    const report = await getDoc(`reports/${state.reportId}`)
    expect(report).not.toBeNull()
    expect(report!.data.status).toBe('resolved')
  })
})
