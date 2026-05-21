import { onSchedule } from 'firebase-functions/v2/scheduler'
import { FieldValue, Transaction } from 'firebase-admin/firestore'
import { adminDb } from '../../admin-init.js'
import { getMonitorConfig } from './monitor-config.js'
import { logDimension } from '@bantayog/shared-validators'

const log = logDimension('monitorDispatchDeadlines')
const LEASE_EXPIRY_MS = 120_000 // 2 minutes
const RESPONDER_CAP = 200
const RECENT_WINDOW_MS = 30 * 60 * 1_000 // 30 min
const FALLBACK_WINDOW_MS = 2 * 60 * 60 * 1_000 // 2 hours
const MUNICIPALITY_CHUNK_SIZE = 10

interface ResponderDoc {
  id: string
  agencyId: string
  municipalityId: string
  lastSeenAt: number
}

interface DispatchData {
  status?: string
  reportId?: string
  assignedTo?: { uid: string; agencyId: string; municipalityId: string }
  escalationCount?: number
  previouslyNotifiedResponderUids?: string[]
  municipalityId?: string
  acknowledgementDeadlineAt?: number
}

export interface MonitorDispatchDeadlinesDeps {
  now: number
  config: Awaited<ReturnType<typeof getMonitorConfig>>
}

function markDispatchNeedsAdmin(
  tx: Transaction,
  dispatchRef: FirebaseFirestore.DocumentReference,
  dispatchId: string,
  now: number,
  monitorRunId: string,
): void {
  tx.update(dispatchRef, {
    status: 'needs_admin',
    monitorLeaseAt: now,
    monitorRunId,
  })
}

function writeDeadlineExceededEvent(
  tx: Transaction,
  db: FirebaseFirestore.Firestore,
  dispatchId: string,
  assignedTo: { uid: string; agencyId: string; municipalityId: string },
  escalationCount: number,
  now: number,
): void {
  tx.set(db.collection('dispatch_events').doc(), {
    type: 'deadline_exceeded',
    dispatchId,
    responderUid: assignedTo.uid,
    agencyId: assignedTo.agencyId,
    municipalityId: assignedTo.municipalityId,
    escalationCount,
    at: now,
    correlationId: crypto.randomUUID(),
    schemaVersion: 1,
  })
}

function writeEscalationAttemptedEvent(
  tx: Transaction,
  db: FirebaseFirestore.Firestore,
  dispatchId: string,
  fromResponder: { uid: string; agencyId: string; municipalityId: string },
  toResponder: ResponderDoc,
  escalationCount: number,
  now: number,
): void {
  tx.set(db.collection('dispatch_events').doc(), {
    type: 'escalation_attempted',
    dispatchId,
    fromResponderUid: fromResponder.uid,
    toResponderUid: toResponder.id,
    agencyId: toResponder.agencyId,
    municipalityId: toResponder.municipalityId,
    reason: 'deadline_exceeded',
    at: now,
    correlationId: crypto.randomUUID(),
    schemaVersion: 1,
  })
}

async function queryAvailableResponders(
  db: FirebaseFirestore.Firestore,
  municipalityIds: string[],
  now: number,
  windowMs: number,
): Promise<ResponderDoc[]> {
  const chunks: string[][] = []
  for (let i = 0; i < municipalityIds.length; i += MUNICIPALITY_CHUNK_SIZE) {
    chunks.push(municipalityIds.slice(i, i + MUNICIPALITY_CHUNK_SIZE))
  }

  const snapPromises = chunks.map((chunk) =>
    db
      .collection('responders')
      .where('availabilityStatus', '==', 'available')
      .where('accountStatus', '==', 'active')
      .where('lastSeenAt', '>', now - windowMs)
      .where('municipalityId', 'in', chunk)
      .get(),
  )

  const snaps = await Promise.all(snapPromises)
  return snaps.flatMap((snap) =>
    snap.docs.map((doc) => {
      const data = doc.data() as {
        agencyId: string
        municipalityId: string
        lastSeenAt: number
      }
      return {
        id: doc.id,
        agencyId: data.agencyId,
        municipalityId: data.municipalityId,
        lastSeenAt: data.lastSeenAt,
      }
    }),
  )
}

function findCandidateResponder(
  allResponders: ResponderDoc[],
  dispatchData: DispatchData,
): ResponderDoc | undefined {
  const assignedTo = dispatchData.assignedTo
  if (!assignedTo) return undefined

  const excluded = new Set(dispatchData.previouslyNotifiedResponderUids ?? [])
  excluded.add(assignedTo.uid)

  return allResponders
    .filter(
      (r) =>
        !excluded.has(r.id) &&
        (r.municipalityId === dispatchData.municipalityId || r.agencyId === assignedTo.agencyId),
    )
    .sort((a, b) => b.lastSeenAt - a.lastSeenAt)[0]
}

async function updateNeedsAdminAlerts(
  municipalityIds: string[],
  now: number,
  count: number,
): Promise<void> {
  const dateStr = new Date(now).toISOString().slice(0, 10)
  for (const muniId of municipalityIds) {
    const alertRef = adminDb.collection('alerts').doc(muniId + '_' + dateStr)
    await alertRef.set(
      {
        type: 'dispatch_deadline_exceeded',
        municipalityId: muniId,
        count: FieldValue.increment(count),
        lastUpdatedAt: now,
      },
      { merge: true },
    )
  }
}

export async function monitorDispatchDeadlinesCore(
  db: FirebaseFirestore.Firestore,
  deps: MonitorDispatchDeadlinesDeps,
): Promise<void> {
  const { now, config } = deps

  if (!config.autoEscalationEnabled) {
    log({
      severity: 'INFO',
      code: 'monitor.skipped',
      message: 'Auto-escalation disabled via kill switch',
    })
    return
  }

  const monitorRunId = crypto.randomUUID()

  const snap = await db
    .collection('dispatches')
    .where('status', '==', 'pending')
    .where('acknowledgementDeadlineAt', '<', now)
    .where('monitorLeaseAt', '<', now - LEASE_EXPIRY_MS)
    .orderBy('acknowledgementDeadlineAt')
    .limit(config.maxDispatchesPerRun)
    .get()

  const dispatchDocs = snap.docs

  if (dispatchDocs.length > config.circuitBreakerThreshold) {
    log({
      severity: 'WARNING',
      code: 'monitor.circuit_opened',
      message:
        'Found ' +
        String(dispatchDocs.length) +
        ' dispatches exceeding threshold ' +
        String(config.circuitBreakerThreshold),
    })
    return
  }

  const municipalityIds = [
    ...new Set(dispatchDocs.map((d) => (d.data() as { municipalityId: string }).municipalityId)),
  ]

  let allResponders = await queryAvailableResponders(db, municipalityIds, now, RECENT_WINDOW_MS)

  if (allResponders.length === 0) {
    allResponders = await queryAvailableResponders(db, municipalityIds, now, FALLBACK_WINDOW_MS)
  }

  if (allResponders.length > RESPONDER_CAP) {
    log({
      severity: 'WARNING',
      code: 'monitor.responder_cap',
      message:
        'Capped responders from ' + String(allResponders.length) + ' to ' + String(RESPONDER_CAP),
    })
    allResponders = allResponders
      .sort((a, b) => b.lastSeenAt - a.lastSeenAt)
      .slice(0, RESPONDER_CAP)
  }

  let escalatedCount = 0
  let needsAdminCount = 0

  for (const dispatchDoc of dispatchDocs) {
    try {
      await db.runTransaction(async (tx) => {
        const dispatchRef = db.collection('dispatches').doc(dispatchDoc.id)
        const freshSnap = await tx.get(dispatchRef)
        if (!freshSnap.exists) return

        const data = freshSnap.data() as DispatchData
        const assignedTo = data.assignedTo
        if (!assignedTo) return

        if (
          data.status !== 'pending' ||
          data.acknowledgementDeadlineAt === undefined ||
          data.acknowledgementDeadlineAt >= now
        ) {
          return
        }

        if ((data.escalationCount ?? 0) >= 1) {
          markDispatchNeedsAdmin(tx, dispatchRef, dispatchDoc.id, now, monitorRunId)
          writeDeadlineExceededEvent(
            tx,
            db,
            dispatchDoc.id,
            assignedTo,
            data.escalationCount ?? 0,
            now,
          )
          needsAdminCount++
          return
        }

        const responderSnap = await tx.get(db.collection('responders').doc(assignedTo.uid))
        if (
          !responderSnap.exists ||
          (responderSnap.data() as { accountStatus?: string }).accountStatus !== 'active'
        ) {
          markDispatchNeedsAdmin(tx, dispatchRef, dispatchDoc.id, now, monitorRunId)
          needsAdminCount++
          return
        }

        const candidate = findCandidateResponder(allResponders, data)
        if (!candidate) {
          markDispatchNeedsAdmin(tx, dispatchRef, dispatchDoc.id, now, monitorRunId)
          needsAdminCount++
          return
        }

        const newEscalationCount = (data.escalationCount ?? 0) + 1

        tx.update(dispatchRef, {
          assignedTo: {
            uid: candidate.id,
            agencyId: candidate.agencyId,
            municipalityId: candidate.municipalityId,
          },
          escalationCount: FieldValue.increment(1),
          previouslyNotifiedResponderUids: FieldValue.arrayUnion(assignedTo.uid),
          escalationReason: 'deadline_exceeded',
          monitorLeaseAt: now,
          monitorRunId,
          status: 'pending',
        })

        writeDeadlineExceededEvent(tx, db, dispatchDoc.id, assignedTo, newEscalationCount, now)
        writeEscalationAttemptedEvent(
          tx,
          db,
          dispatchDoc.id,
          assignedTo,
          candidate,
          newEscalationCount,
          now,
        )

        escalatedCount++
      })
    } catch (err) {
      log({
        severity: 'ERROR',
        code: 'monitor.transaction_failed',
        message: err instanceof Error ? err.message : 'unknown',
      })
    }
  }

  if (needsAdminCount > 0) {
    await updateNeedsAdminAlerts(municipalityIds, now, needsAdminCount)
  }

  log({
    severity: 'INFO',
    code: 'monitor.done',
    message:
      'Processed ' +
      String(dispatchDocs.length) +
      ' dispatches: ' +
      String(escalatedCount) +
      ' escalated, ' +
      String(needsAdminCount) +
      ' needs_admin',
  })
}

export const monitorDispatchDeadlines = onSchedule(
  {
    schedule: 'every 1 minutes',
    region: 'asia-southeast1',
    minInstances: 1,
    maxInstances: 1,
    timeoutSeconds: 120,
  },
  async () => {
    try {
      const config = await getMonitorConfig()
      await monitorDispatchDeadlinesCore(adminDb, { now: Date.now(), config })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      log({
        severity: 'ERROR',
        code: 'monitor.failed',
        message: `Monitor dispatch deadlines failed: ${message}`,
      })
      throw err
    }
  },
)
