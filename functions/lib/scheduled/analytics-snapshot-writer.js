import { onSchedule } from 'firebase-functions/v2/scheduler';
import { Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '../admin-init.js';
import { CAMARINES_NORTE_MUNICIPALITY_IDS } from '@bantayog/shared-data';
import { logDimension } from '@bantayog/shared-validators';
const log = logDimension('analyticsSnapshotWriter');
const REPORT_STATUSES = [
    'draft_inbox',
    'new',
    'awaiting_verify',
    'verified',
    'assigned',
    'acknowledged',
    'en_route',
    'on_scene',
    'resolved',
    'closed',
    'reopened',
    'rejected',
    'cancelled',
    'cancelled_false_report',
    'merged_as_duplicate',
];
const SEVERITIES = ['low', 'medium', 'high', 'critical'];
export async function analyticsSnapshotWriterCore(db, deps) {
    const { date, now } = deps;
    const nowMillis = typeof now === 'number' ? now : now.toMillis();
    const provinceByStatus = {};
    const provinceBySeverity = {};
    for (const municipalityId of CAMARINES_NORTE_MUNICIPALITY_IDS) {
        const reportsByStatus = {};
        const reportsBySeverity = {};
        await Promise.all([
            ...REPORT_STATUSES.map(async (status) => {
                const snap = await db
                    .collection('report_ops')
                    .where('municipalityId', '==', municipalityId)
                    .where('status', '==', status)
                    .count()
                    .get();
                reportsByStatus[status] = snap.data().count;
                provinceByStatus[status] = (provinceByStatus[status] ?? 0) + snap.data().count;
            }),
            ...SEVERITIES.map(async (severity) => {
                const snap = await db
                    .collection('report_ops')
                    .where('municipalityId', '==', municipalityId)
                    .where('severity', '==', severity)
                    .count()
                    .get();
                reportsBySeverity[severity] = snap.data().count;
                provinceBySeverity[severity] = (provinceBySeverity[severity] ?? 0) + snap.data().count;
            }),
        ]);
        await db
            .collection('analytics_snapshots')
            .doc(date)
            .collection(municipalityId)
            .doc('summary')
            .set({
            date,
            municipalityId,
            reportsByStatus,
            reportsBySeverity,
            generatedAt: nowMillis,
            schemaVersion: 1,
        });
    }
    await db.collection('analytics_snapshots').doc(date).collection('province').doc('summary').set({
        date,
        municipalityId: 'province',
        reportsByStatus: provinceByStatus,
        reportsBySeverity: provinceBySeverity,
        generatedAt: nowMillis,
        schemaVersion: 1,
    });
    const startOfDayMs = Date.parse(`${date}T00:00:00.000Z`);
    if (Number.isNaN(startOfDayMs)) {
        throw new Error(`Invalid date format: ${date}`);
    }
    const endOfDayMs = startOfDayMs + 86400000;
    const resolvedSnap = await db
        .collection('report_ops')
        .where('status', '==', 'resolved')
        .where('resolvedAt', '>=', startOfDayMs)
        .where('resolvedAt', '<', endOfDayMs)
        .get();
    const resolvedToday = resolvedSnap.size;
    const resolvedWithTimes = resolvedSnap.docs.filter((d) => {
        const data = d.data();
        return (typeof data.createdAt === 'number' &&
            typeof data.resolvedAt === 'number' &&
            data.resolvedAt >= data.createdAt);
    });
    const avgResponseTimeMinutes = resolvedWithTimes.length > 0
        ? resolvedWithTimes.reduce((sum, d) => {
            const data = d.data();
            return sum + (data.resolvedAt - data.createdAt) / 60000;
        }, 0) / resolvedWithTimes.length
        : null;
    await db
        .collection('analytics_snapshots')
        .doc(date)
        .collection('province')
        .doc('summary')
        .set({ resolvedToday, avgResponseTimeMinutes }, { merge: true });
    log({
        severity: 'INFO',
        code: 'analytics.done',
        message: `Analytics snapshot written for ${date}`,
    });
}
export const analyticsSnapshotWriter = onSchedule({ schedule: '5 0 * * *', region: 'asia-southeast1', timeoutSeconds: 300, timeZone: 'UTC' }, async () => {
    const now = Timestamp.now();
    const date = new Date(now.toMillis()).toISOString().slice(0, 10);
    await analyticsSnapshotWriterCore(adminDb, { date, now });
});
//# sourceMappingURL=analytics-snapshot-writer.js.map