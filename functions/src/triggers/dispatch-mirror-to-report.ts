/**
 * dispatch-mirror-to-report.ts
 *
 * Cloud Function v2 Firestore trigger (onDocumentWritten) that mirrors
 * dispatch state progression back to the parent report document.
 *
 * The pure helper `computeMirrorAction` is the decision function tested in
 * the unit tests. The trigger body (logger placeholder) is implemented
 * in Task 12.
 */

import { onDocumentWritten } from 'firebase-functions/v2/firestore'
import { FieldValue } from 'firebase-admin/firestore'
import { logger } from 'firebase-functions'
import type { Firestore } from 'firebase-admin/firestore'
import type { DispatchStatus, ReportStatus } from '@bantayog/shared-validators'
import { dispatchToReportState } from '@bantayog/shared-validators'

export type MirrorAction =
  | { action: 'skip'; reason: string }
  | { action: 'update'; to: ReportStatus }

/**
 * Pure decision function: given the before/after dispatch status and the
 * current report status, decide whether to skip or emit an update.
 *
 * Returns:
 * - `{ action: 'skip', reason: 'noop_same_status' }` when before === after
 * - `{ action: 'skip', reason: 'cancel_owned_by_callable' }` when after is 'cancelled'
 * - `{ action: 'skip', reason: 'no_mirror_for_<status>' }` when dispatchToReportState returns null
 * - `{ action: 'skip', reason: 'already_at_target' }` when mapped status === currentReportStatus
 * - `{ action: 'update', to: ReportStatus }` when a status write is needed
 */
export function computeMirrorAction(
  before: DispatchStatus | undefined,
  after: DispatchStatus | undefined,
  currentReportStatus: ReportStatus,
): MirrorAction {
  if (!after) return { action: 'skip', reason: 'deleted' }
  if (after === 'cancelled') return { action: 'skip', reason: 'cancel_owned_by_callable' }
  if (before === after) return { action: 'skip', reason: 'noop_same_status' }

  const mapped = dispatchToReportState(after)
  if (!mapped) return { action: 'skip', reason: `no_mirror_for_${after as string}` }
  if (mapped === currentReportStatus) return { action: 'skip', reason: 'already_at_target' }

  return { action: 'update', to: mapped }
}

// ---------------------------------------------------------------------------
// Cloud Function v2 trigger — implementation in Task 12
// ---------------------------------------------------------------------------

export interface DispatchMirrorToReportCoreParams {
  db: Firestore
  dispatchId: string
  beforeData: { status?: DispatchStatus; correlationId?: string } | undefined
  afterData:
    | {
        status?: DispatchStatus
        reportId?: string
        correlationId?: string
      }
    | undefined
}

/**
 * Core logic for dispatchMirrorToReport.
 * Exported for direct unit testing with firebase-functions-test.
 */
export async function dispatchMirrorToReportCore(
  params: DispatchMirrorToReportCoreParams,
): Promise<void> {
  const { db, dispatchId, beforeData, afterData } = params
  const before = beforeData as { status?: DispatchStatus } | undefined
  const after = afterData as
    | { status?: DispatchStatus; reportId?: string; correlationId?: string }
    | undefined
  const correlationId = after?.correlationId ?? crypto.randomUUID()

  if (!after?.reportId) {
    logger.info({ event: 'dispatch_mirror.skip', reason: 'no_reportId', correlationId })
    return
  }

  const reportRef = db.collection('reports').doc(after.reportId)

  await db.runTransaction(async (tx) => {
    const reportSnap = await tx.get(reportRef)
    if (!reportSnap.exists) {
      logger.warn({
        event: 'dispatch_mirror.skip',
        reason: 'report_missing',
        correlationId,
        dispatchId,
        reportId: after.reportId,
      })
      return
    }

    const currentStatus = (reportSnap.data() as { status: ReportStatus } | undefined)?.status
    const currentDispatchId = (reportSnap.data() as { currentDispatchId?: string } | undefined)
      ?.currentDispatchId

    // Only mirror state from the currently active dispatch
    if (currentDispatchId && currentDispatchId !== dispatchId) {
      logger.info({
        event: 'dispatch_mirror.skip',
        reason: 'not_current_dispatch',
        correlationId,
        dispatchId,
        reportId: after.reportId,
      })
      return
    }

    // Handle terminal dispatch failure states to revert report back to verified
    if (after.status === 'timed_out' || after.status === 'declined') {
      tx.update(reportRef, {
        status: 'verified',
        currentDispatchId: null,
        lastStatusAt: FieldValue.serverTimestamp(),
      })
      tx.create(db.collection('report_events').doc(), {
        reportId: after.reportId,
        from: currentStatus,
        to: 'verified',
        actor: 'system:dispatchMirrorToReport',
        at: FieldValue.serverTimestamp(),
        correlationId,
        schemaVersion: 1,
      })
      logger.info({
        event: 'dispatch_mirror.reverted_to_verified',
        reason: `dispatch_${after.status}`,
        correlationId,
        dispatchId,
        reportId: after.reportId,
      })
      return
    }

    const decision = computeMirrorAction(before?.status, after.status, currentStatus ?? 'verified')

    if (decision.action === 'skip') {
      logger.info({
        event: 'dispatch_mirror.skip',
        reason: decision.reason,
        correlationId,
        dispatchId,
        reportId: after.reportId,
      })
      return
    }

    // After skip guard, decision.action === 'update' — decision.to is ReportStatus
    const targetStatus: ReportStatus = decision.to

    tx.update(reportRef, {
      status: targetStatus,
      lastStatusAt: FieldValue.serverTimestamp(),
    })

    tx.create(db.collection('report_events').doc(), {
      reportId: after.reportId,
      from: currentStatus,
      to: targetStatus,
      actor: 'system:dispatchMirrorToReport',
      at: FieldValue.serverTimestamp(),
      correlationId,
      schemaVersion: 1,
    })

    logger.info({
      event: 'dispatch_mirror.applied',
      correlationId,
      dispatchId,
      reportId: after.reportId,
      from: currentStatus,
      to: targetStatus,
    })
  })
}

export const dispatchMirrorToReport = onDocumentWritten(
  { document: 'dispatches/{dispatchId}', region: 'asia-southeast1', timeoutSeconds: 10 },
  async (event) => {
    if (!event.data) return
    const change = event.data
    const beforeData = change.before.data() as { status?: DispatchStatus } | undefined
    const afterData = change.after.data() as
      | { status?: DispatchStatus; reportId?: string; correlationId?: string }
      | undefined

    await dispatchMirrorToReportCore({
      db: change.before.ref.firestore,
      dispatchId: event.params.dispatchId,
      beforeData,
      afterData,
    })
  },
)
