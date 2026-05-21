import { dispatchToReportState, } from '@bantayog/shared-validators';
export async function mirrorDispatchStatusToReportInTransaction(args) {
    const targetStatus = dispatchToReportState(args.afterStatus);
    if (!targetStatus || !args.reportId)
        return;
    const reportRef = args.db.collection('reports').doc(args.reportId);
    const reportSnap = await args.tx.get(reportRef);
    if (!reportSnap.exists)
        return;
    const report = reportSnap.data();
    if (report?.currentDispatchId && report.currentDispatchId !== args.dispatchId)
        return;
    const from = report?.status ?? 'verified';
    if (from === targetStatus)
        return;
    args.tx.update(reportRef, {
        status: targetStatus,
        lastStatusAt: args.nowMillis,
        lastStatusBy: args.actorUid,
    });
    const eventRef = args.db.collection('report_events').doc();
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
    });
}
//# sourceMappingURL=dispatch-report-mirror.js.map