import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { logDimension } from '@bantayog/shared-validators';
const log = logDimension('retentionSweep');
const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000;
const ACTIVE_STATUSES = ['pending_review', 'approved_pending_anonymization', 'executing'];
export async function retentionSweepCore(input) {
    const now = input.now ?? (() => Date.now());
    const result = { anonymized: 0, hardDeleted: 0 };
    // Load UIDs with active erasure requests for in-memory exclusion
    const activeErasureSnap = await input.db
        .collection('erasure_requests')
        .where('status', 'in', ACTIVE_STATUSES)
        .get();
    const activeErasureUids = new Set(activeErasureSnap.docs.map((d) => d.data().citizenUid));
    // --- 1-week threshold: anonymize unverified, unerasured reports ---
    const anonymizeThreshold = now() - ONE_WEEK_MS;
    const toAnonymize = await input.db
        .collection('reports')
        .where('verified', '==', false)
        .where('submittedAt', '<', anonymizeThreshold)
        .get();
    for (const doc of toAnonymize.docs) {
        const data = doc.data();
        // Skip reports already erased or belonging to citizens with active erasure requests
        if (data.submittedBy === 'citizen_deleted')
            continue;
        if (activeErasureUids.has(data.submittedBy))
            continue;
        if (data.retentionAnonymizedAt)
            continue;
        try {
            // Read report_private for msisdnHash BEFORE nulling
            const privateSnap = await input.db.collection('report_private').doc(doc.id).get();
            const senderMsisdnHash = privateSnap.data()?.senderMsisdnHash;
            // Null report_private PII
            if (privateSnap.exists) {
                await input.db.collection('report_private').doc(doc.id).update({
                    citizenName: null,
                    rawPhone: null,
                    gpsExact: null,
                    addressText: null,
                });
            }
            // Null report_contacts
            const contactSnap = await input.db.collection('report_contacts').doc(doc.id).get();
            if (contactSnap.exists) {
                const nulled = {};
                for (const key of Object.keys(contactSnap.data() ?? {})) {
                    if (key !== 'reportId')
                        nulled[key] = null;
                }
                await input.db.collection('report_contacts').doc(doc.id).update(nulled);
            }
            // Delete Storage blobs for this report only
            const [files] = await input.storage.bucket().getFiles({ prefix: `report_media/${doc.id}/` });
            for (const file of files) {
                await file.delete();
            }
            // Null SMS records by senderMsisdnHash
            if (senderMsisdnHash) {
                const sessSnap = await input.db
                    .collection('sms_sessions')
                    .where('senderMsisdnHash', '==', senderMsisdnHash)
                    .get();
                for (const sess of sessSnap.docs) {
                    await sess.ref.update({ senderMsisdnHash: null, msisdn: null });
                }
                const inboxSnap = await input.db
                    .collection('sms_inbox')
                    .where('senderMsisdnHash', '==', senderMsisdnHash)
                    .get();
                for (const msg of inboxSnap.docs) {
                    await msg.ref.update({ senderMsisdnHash: null, msisdn: null, rawBody: null });
                }
            }
            await doc.ref.update({
                mediaRedacted: true,
                retentionAnonymizedAt: now(),
                retentionHardDeleteEligibleAt: now() + ONE_MONTH_MS,
            });
            result.anonymized++;
        }
        catch (err) {
            log({
                severity: 'ERROR',
                code: 'RETENTION_ANONYMIZE_FAILED',
                message: `retention anonymize failed for ${doc.id}: ${String(err)}`,
                data: { reportId: doc.id, error: String(err) },
            });
        }
    }
    // --- 1-month threshold: hard-delete eligible reports ---
    const toDelete = await input.db
        .collection('reports')
        .where('retentionHardDeleteEligibleAt', '<', now())
        .get();
    for (const doc of toDelete.docs) {
        const data = doc.data();
        // Skip reports belonging to citizens with active erasure requests
        if (activeErasureUids.has(data.submittedBy))
            continue;
        try {
            await input.db.collection('report_private').doc(doc.id).delete();
            await input.db.collection('report_contacts').doc(doc.id).delete();
            await doc.ref.delete();
            // Write audit log outside the deleted document
            await input.db.collection('retention_audit_log').add({
                reportId: doc.id,
                retentionDeletedAt: now(),
                reason: 'retention_policy',
            });
            result.hardDeleted++;
        }
        catch (err) {
            log({
                severity: 'ERROR',
                code: 'RETENTION_DELETE_FAILED',
                message: `retention delete failed for ${doc.id}: ${String(err)}`,
                data: { reportId: doc.id, error: String(err) },
            });
        }
    }
    return result;
}
export const retentionSweep = onSchedule({ schedule: 'every 24 hours', region: 'asia-southeast1' }, async () => {
    await retentionSweepCore({ db: getFirestore(), storage: getStorage() });
});
//# sourceMappingURL=retention-sweep.js.map