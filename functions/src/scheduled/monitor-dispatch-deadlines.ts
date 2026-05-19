import { onSchedule } from 'firebase-functions/v2/scheduler'
import { FieldValue } from 'firebase-admin/firestore'
import { adminDb } from '../admin-init.js'
import { getMonitorConfig } from '../services/monitor-config.js'
import { logDimension } from '@bantayog/shared-validators'

const log = logDimension('monitorDispatchDeadlines')
const LEASE_EXPIRY_MS = 120000 // 2 minutes

export interface MonitorDispatchDeadlinesDeps {
  now: number
  config: Awaited<ReturnType<typeof getMonitorConfig>>
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

  // Query pending dispatches past deadline with expired lease
  const snap = await db
    .collection('dispatches')
    .where('status', '==', 'pending')
    .where('acknowledgementDeadlineAt', '<', now)
    .where('monitorLeaseAt', '<', now - LEASE_EXPIRY_MS)
    .orderBy('acknowledgementDeadlineAt')
    .limit(config.maxDispatchesPerRun)
    .get()

  const dispatches = snap.docs

  if (dispatches.length > config.circuitBreakerThreshold) {
    log({
      severity: 'WARNING',
      code: 'monitor.circuit_opened',
      message:
        'Found ' +
        String(dispatches.length) +
        ' dispatches exceeding threshold ' +
        String(config.circuitBreakerThreshold),
    })
    return
  }

  // Collect unique municipality IDs
  const municipalityIds = [
    ...new Set(dispatches.map((d) => (d.data() as { municipalityId: string }).municipalityId)),
  ]

  // Chunk municipalityIds into groups of 10 (Firestore in limit)
  const chunks: string[][] = []
  for (let i = 0; i < municipalityIds.length; i += 10) {
    chunks.push(municipalityIds.slice(i, i + 10))
  }

  interface Responder {
    id: string
    agencyId: string
    municipalityId: string
    lastSeenAt: number
    availabilityStatus?: string
    accountStatus?: string
  }

  // Query responders for all chunks
  const responderPromises = chunks.map((chunk) =>
    db
      .collection('responders')
      .where('availabilityStatus', '==', 'available')
      .where('accountStatus', '==', 'active')
      .where('lastSeenAt', '>', now - 30 * 60 * 1000)
      .where('municipalityId', 'in', chunk)
      .get(),
  )

  const responderSnaps = await Promise.all(responderPromises)
  let allResponders: Responder[] = responderSnaps.flatMap((s) =>
    s.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) }) as Responder),
  )

  // Fallback: if strict query returns empty, try 2h window
  if (allResponders.length === 0) {
    const fallbackPromises = chunks.map((chunk) =>
      db
        .collection('responders')
        .where('availabilityStatus', '==', 'available')
        .where('accountStatus', '==', 'active')
        .where('lastSeenAt', '>', now - 2 * 60 * 60 * 1000)
        .where('municipalityId', 'in', chunk)
        .get(),
    )
    const fallbackSnaps = await Promise.all(fallbackPromises)
    allResponders = fallbackSnaps.flatMap((s) =>
      s.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) }) as Responder),
    )
  }

  // Cap at 200 responders in memory
  if (allResponders.length > 200) {
    log({
      severity: 'WARNING',
      code: 'monitor.responder_cap',
      message: 'Capped responders from ' + String(allResponders.length) + ' to 200',
    })
    allResponders = allResponders.sort((a, b) => b.lastSeenAt - a.lastSeenAt).slice(0, 200)
  }

  let escalatedCount = 0
  let needsAdminCount = 0

  for (const dispatchDoc of dispatches) {
    try {
      await db.runTransaction(async (tx) => {
        const dRef = db.collection('dispatches').doc(dispatchDoc.id)
        const dSnap = await tx.get(dRef)
        if (!dSnap.exists) return
        const d = dSnap.data() as {
          status?: string
          reportId?: string
          assignedTo?: { uid: string; agencyId: string; municipalityId: string }
          escalationCount?: number
          previouslyNotifiedResponderUids?: string[]
          municipalityId?: string
          acknowledgementDeadlineAt?: number
        }

        // Re-check conditions inside transaction
        if (d.assignedTo === undefined) return
        if (
          d.status !== 'pending' ||
          d.acknowledgementDeadlineAt === undefined ||
          d.acknowledgementDeadlineAt >= now
        )
          return
        const assignedTo = d.assignedTo

        // CHECK CAP FIRST
        if ((d.escalationCount ?? 0) >= 1) {
          tx.update(dRef, {
            status: 'needs_admin',
            monitorLeaseAt: now,
            monitorRunId,
          })
          tx.set(db.collection('dispatch_events').doc(), {
            type: 'deadline_exceeded',
            dispatchId: dispatchDoc.id,
            responderUid: assignedTo.uid,
            agencyId: assignedTo.agencyId,
            municipalityId: assignedTo.municipalityId,
            escalationCount: d.escalationCount ?? 0,
            at: now,
            correlationId: crypto.randomUUID(),
            schemaVersion: 1,
          })
          needsAdminCount++
          return
        }

        // Check if assigned responder is still active
        const responderRef = db.collection('responders').doc(assignedTo.uid)
        const responderSnap = await tx.get(responderRef)
        const responderData = responderSnap.exists
          ? (responderSnap.data() as { accountStatus?: string } | undefined)
          : null
        if (responderData === null || responderData === undefined) {
          tx.update(dRef, {
            status: 'needs_admin',
            monitorLeaseAt: now,
            monitorRunId,
          })
          needsAdminCount++
          return
        }
        if (responderData.accountStatus !== 'active') {
          tx.update(dRef, {
            status: 'needs_admin',
            monitorLeaseAt: now,
            monitorRunId,
          })
          needsAdminCount++
          return
        }

        // Find next candidate
        const excluded = new Set(d.previouslyNotifiedResponderUids ?? [])
        excluded.add(assignedTo.uid)
        const candidates = allResponders
          .filter((r) => !excluded.has(r.id))
          .filter(
            (r) => r.municipalityId === d.municipalityId || r.agencyId === assignedTo.agencyId,
          )
          .sort((a, b) => b.lastSeenAt - a.lastSeenAt)

        if (candidates.length === 0) {
          tx.update(dRef, {
            status: 'needs_admin',
            monitorLeaseAt: now,
            monitorRunId,
          })
          needsAdminCount++
          return
        }

        const nextResponder = candidates[0]
        if (!nextResponder) {
          tx.update(dRef, {
            status: 'needs_admin',
            monitorLeaseAt: now,
            monitorRunId,
          })
          needsAdminCount++
          return
        }

        // ESCALATE: update same dispatch doc
        tx.update(dRef, {
          assignedTo: {
            uid: nextResponder.id,
            agencyId: nextResponder.agencyId,
            municipalityId: nextResponder.municipalityId,
          },
          escalationCount: FieldValue.increment(1),
          previouslyNotifiedResponderUids: FieldValue.arrayUnion(assignedTo.uid),
          escalationReason: 'deadline_exceeded',
          monitorLeaseAt: now,
          monitorRunId,
          status: 'pending',
        })

        tx.set(db.collection('dispatch_events').doc(), {
          type: 'deadline_exceeded',
          dispatchId: dispatchDoc.id,
          responderUid: assignedTo.uid,
          agencyId: assignedTo.agencyId,
          municipalityId: assignedTo.municipalityId,
          escalationCount: (d.escalationCount ?? 0) + 1,
          at: now,
          correlationId: crypto.randomUUID(),
          schemaVersion: 1,
        })

        tx.set(db.collection('dispatch_events').doc(), {
          type: 'escalation_attempted',
          dispatchId: dispatchDoc.id,
          fromResponderUid: assignedTo.uid,
          toResponderUid: nextResponder.id,
          agencyId: nextResponder.agencyId,
          municipalityId: nextResponder.municipalityId,
          reason: 'deadline_exceeded',
          at: now,
          correlationId: crypto.randomUUID(),
          schemaVersion: 1,
        })

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

  // Update grouped alert for needs_admin dispatches
  if (needsAdminCount > 0) {
    for (const muniId of municipalityIds) {
      const alertRef = adminDb
        .collection('alerts')
        .doc(muniId + '_' + new Date(now).toISOString().slice(0, 10))
      await alertRef.set(
        {
          type: 'dispatch_deadline_exceeded',
          municipalityId: muniId,
          count: FieldValue.increment(needsAdminCount),
          lastUpdatedAt: now,
        },
        { merge: true },
      )
    }
  }

  log({
    severity: 'INFO',
    code: 'monitor.done',
    message:
      'Processed ' +
      String(dispatches.length) +
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
