import type { Firestore, Transaction } from 'firebase-admin/firestore'
import {
  dispatchToReportState,
  type DispatchStatus,
  type ReportStatus,
} from '@bantayog/shared-validators'

export interface MirrorDispatchStatusToReportArgs {
  db: Firestore
  tx: Transaction
  dispatchId: string
  reportId: string | undefined
  afterStatus: DispatchStatus
  actorUid: string
  actorRole: 'responder'
  nowMillis: number
  correlationId: string
}

export async function mirrorDispatchStatusToReportInTransaction(
  args: MirrorDispatchStatusToReportArgs,
): Promise<void> {
  const targetStatus = dispatchToReportState(args.afterStatus)
  if (!targetStatus || !args.reportId) return

  const reportRef = args.db.collection('reports').doc(args.reportId)
  const reportSnap = await args.tx.get(reportRef)
  if (!reportSnap.exists) return

  const report = reportSnap.data() as
    | { status?: ReportStatus; currentDispatchId?: string }
    | undefined
  if (report?.currentDispatchId && report.currentDispatchId !== args.dispatchId) return

  const from = report?.status ?? 'verified'
  if (from === targetStatus) return

  args.tx.update(reportRef, {
    status: targetStatus,
    lastStatusAt: args.nowMillis,
    lastStatusBy: args.actorUid,
  })

  const eventRef = args.db.collection('report_events').doc()
  args.tx.set(eventRef, {
    eventId: eventRef.id,
    reportId: args.reportId,
    from,
    to: targetStatus,
    actor: args.actorUid,
    actorRole: args.actorRole,
    at: args.nowMillis,
    correlationId: args.correlationId,
    schemaVersion: 1,
  })
}
