import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { getStorage } from 'firebase-admin/storage';
import { logDimension } from '@bantayog/shared-validators';
import { streamAuditEvent } from '../services/audit-stream.js';
const log = logDimension('erasureSweep');
const STALE_EXECUTING_MS = 30 * 60 * 1000;
export async function erasureSweepCore(input) {
    const now = input.now ?? (() => Date.now());
    const result = { processed: 0, skippedHeld: 0, deadLettered: 0 };
    // Sequential claim: fetch one ready record (or one stale executing record).
    const readySnap = await input.db
        .collection('erasure_requests')
        .where('status', '==', 'approved_pending_anonymization')
        .where('legalHold', '!=', true)
        .limit(1)
        .get();
    const staleSnap = await input.db
        .collection('erasure_requests')
        .where('status', '==', 'executing')
        .where('executionStartedAt', '<', now() - STALE_EXECUTING_MS)
        .limit(1)
        .get();
    // Count held records for system_health observability
    const heldSnap = await input.db
        .collection('erasure_requests')
        .where('status', '==', 'approved_pending_anonymization')
        .where('legalHold', '==', true)
        .get();
    result.skippedHeld = heldSnap.size;
    const candidate = readySnap.docs[0] ?? staleSnap.docs[0];
    if (!candidate)
        return result;
    const sweepRunId = crypto.randomUUID();
    const citizenUid = candidate.data().citizenUid;
    // Claim the record transactionally to prevent double-processing by concurrent sweeps.
    await input.db.runTransaction(async (tx) => {
        const fresh = await tx.get(candidate.ref);
        const status = fresh.data()?.status;
        const legalHold = fresh.data()?.legalHold;
        const executionStartedAt = fresh.data()?.executionStartedAt;
        const isReady = status === 'approved_pending_anonymization' && legalHold !== true;
        const isStale = status === 'executing' &&
            executionStartedAt != null &&
            executionStartedAt < now() - STALE_EXECUTING_MS;
        if (!isReady && !isStale) {
            throw new Error('claim_lost_race');
        }
        tx.update(candidate.ref, { status: 'executing', sweepRunId, executionStartedAt: now() });
    });
    try {
        await executeErasure(input, citizenUid, candidate.ref.id);
        await candidate.ref.update({ status: 'completed', completedAt: now() });
        // Delete sentinel after Auth is gone
        await input.db.collection('erasure_active').doc(citizenUid).delete();
        void streamAuditEvent({
            eventType: 'erasure_completed',
            actorUid: 'system',
            targetDocumentId: candidate.ref.id,
            metadata: { citizenUid },
            occurredAt: now(),
        });
        result.processed++;
    }
    catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        log({
            severity: 'ERROR',
            code: 'ERASURE_SWEEP_FAILURE',
            message: `erasure sweep failed for ${citizenUid}: ${reason}`,
            data: { citizenUid, reason },
        });
        // Re-enable Auth — citizen must not be permanently locked out by a sweep failure
        try {
            await input.auth.updateUser(citizenUid, { disabled: false });
        }
        catch (reEnableErr) {
            // CRITICAL: citizen is locked out and sweep failed — manual intervention required
            log({
                severity: 'CRITICAL',
                code: 'ERASURE_SWEEP_AUTH_REENABLE_FAILED',
                message: `Auth re-enable failed after erasure sweep failure for ${citizenUid}`,
                data: {
                    citizenUid,
                    originalError: reason,
                    reEnableError: reEnableErr instanceof Error ? reEnableErr.message : String(reEnableErr),
                },
            });
        }
        await candidate.ref.update({
            status: 'dead_lettered',
            deadLetterReason: reason,
            deadLetteredAt: now(),
        });
        void streamAuditEvent({
            eventType: 'erasure_request_dead_lettered_with_auth_unblocked',
            actorUid: 'system',
            targetDocumentId: candidate.ref.id,
            metadata: { citizenUid, reason },
            occurredAt: now(),
        });
        result.deadLettered++;
    }
    return result;
}
async function executeErasure(input, citizenUid, requestId) {
    const db = input.db;
    // Step 1: Collect report IDs
    const reportsSnap = await db.collection('reports').where('submittedBy', '==', citizenUid).get();
    const reportIds = reportsSnap.docs.map((d) => d.id);
    // Step 2: Read report_private BEFORE nulling — extract senderMsisdnHashes
    const msisdnHashes = new Set();
    for (const reportId of reportIds) {
        const privateSnap = await db.collection('report_private').doc(reportId).get();
        const hash = privateSnap.data()?.senderMsisdnHash;
        if (hash)
            msisdnHashes.add(hash);
    }
    // Step 3: Anonymize reports
    for (const reportId of reportIds) {
        await db.collection('reports').doc(reportId).update({
            submittedBy: 'citizen_deleted',
            mediaRedacted: true,
        });
    }
    // Step 4: Null report_private PII fields
    for (const reportId of reportIds) {
        await db.collection('report_private').doc(reportId).update({
            citizenName: null,
            rawPhone: null,
            gpsExact: null,
            addressText: null,
        });
    }
    // Step 5: Null report_contacts content
    for (const reportId of reportIds) {
        const contactSnap = await db.collection('report_contacts').doc(reportId).get();
        if (contactSnap.exists) {
            const nulled = {};
            for (const key of Object.keys(contactSnap.data() ?? {})) {
                if (key !== 'reportId')
                    nulled[key] = null;
            }
            await db.collection('report_contacts').doc(reportId).update(nulled);
        }
    }
    // Step 6: Null sms_sessions by senderMsisdnHash
    for (const hash of msisdnHashes) {
        const sessSnap = await db.collection('sms_sessions').where('senderMsisdnHash', '==', hash).get();
        for (const sess of sessSnap.docs) {
            await sess.ref.update({ senderMsisdnHash: null, msisdn: null });
        }
    }
    // Step 7: Null sms_inbox by senderMsisdnHash
    for (const hash of msisdnHashes) {
        const inboxSnap = await db.collection('sms_inbox').where('senderMsisdnHash', '==', hash).get();
        for (const msg of inboxSnap.docs) {
            await msg.ref.update({ senderMsisdnHash: null, msisdn: null, rawBody: null });
        }
    }
    // Step 8: Delete Storage blobs for all citizen reports (verified and unverified)
    for (const reportId of reportIds) {
        const [files] = await input.storage.bucket().getFiles({ prefix: `report_media/${reportId}/` });
        for (const file of files) {
            await file.delete();
        }
    }
    // Step 9: Hard-delete Firebase Auth account — LAST, non-reversible
    await input.auth.deleteUser(citizenUid);
    // Sentinel deletion happens in the caller after this function returns (step 10)
    void log({
        severity: 'INFO',
        code: 'ERASURE_EXECUTED',
        message: `erasure executed for ${citizenUid}`,
        data: { citizenUid, requestId, reportCount: reportIds.length },
    });
}
export const erasureSweep = onSchedule({ schedule: 'every 15 minutes', region: 'asia-southeast1' }, async () => {
    await erasureSweepCore({ db: getFirestore(), auth: getAuth(), storage: getStorage() });
});
//# sourceMappingURL=erasure-sweep.js.map