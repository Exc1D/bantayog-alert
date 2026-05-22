import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { getStorage } from 'firebase-admin/storage';
import { randomUUID } from 'node:crypto';
import { requireAuth } from '../shared/https-error.js';
import { streamAuditEvent } from '../ops/audit-stream.js';
import { shouldEnforceAppCheck } from '../shared/app-check-config.js';
const STORAGE_BUCKET = process.env.STORAGE_BUCKET ?? 'bantayog-alert.appspot.com';
const SIGNED_URL_TTL_MS = 60 * 60 * 1000; // 1 hour
const RATE_LIMIT_MS = 60 * 1000; // 1 per minute
async function getSignedStorageUrl(storage, bucketName, storagePath) {
    const expiresAt = Date.now() + SIGNED_URL_TTL_MS;
    const [url] = await storage.bucket(bucketName).file(storagePath).getSignedUrl({
        version: 'v4',
        action: 'read',
        expires: expiresAt,
    });
    return { url, expiresAt };
}
export async function requestDataExportImpl(db, auth, storage, actor) {
    const now = Date.now();
    // Atomic rate limit: use a transaction to reserve a pending slot.
    const limiterRef = db.collection('data_export_limiters').doc(actor.uid);
    try {
        await db.runTransaction(async (tx) => {
            const limiterDoc = await tx.get(limiterRef);
            const lastExportAt = limiterDoc.data()?.lastExportAt ?? 0;
            if (lastExportAt > now - RATE_LIMIT_MS) {
                throw new HttpsError('resource-exhausted', 'Export already requested recently. Please wait.');
            }
            tx.set(limiterRef, { lastExportAt: now, status: 'pending' }, { merge: true });
        });
    }
    catch (err) {
        if (err instanceof HttpsError)
            throw err;
        throw new HttpsError('internal', 'Failed to check rate limit.');
    }
    // Aggregate profile.
    const userDoc = await db.collection('users').doc(actor.uid).get();
    const profile = {
        createdAt: userDoc.data()?.createdAt ?? now,
        reporterName: userDoc.data()?.reporterName,
    };
    // Aggregate reports where reporterUid == uid.
    const reportsSnap = await db.collection('reports').where('reporterUid', '==', actor.uid).get();
    const reports = reportsSnap.docs.map((doc) => {
        const d = doc.data();
        return {
            reportId: doc.id,
            publicRef: d.publicRef,
            reportType: d.reportType,
            description: d.description,
            severity: d.severity,
            status: d.status,
            createdAt: d.createdAt,
            resolvedAt: d.resolvedAt,
            location: d.publicLocation,
            municipalityId: d.municipalityId,
            barangayId: d.barangayId,
            nearestLandmark: d.nearestLandmark,
            reporterName: d.reporterName,
            clientCreatedAt: d.clientCreatedAt,
            idempotencyKey: d.idempotencyKey,
        };
    });
    // Aggregate media for collected report IDs.
    const reportIds = reports.map((r) => r.reportId);
    const mediaItems = [];
    if (reportIds.length > 0) {
        // Firestore `in` queries are capped at 30 values per clause.
        const BATCH_SIZE = 30;
        const batches = [];
        for (let i = 0; i < reportIds.length; i += BATCH_SIZE) {
            batches.push(reportIds.slice(i, i + BATCH_SIZE));
        }
        const mediaSnaps = await Promise.all(batches.map((batch) => db.collection('report_media').where('reportId', 'in', batch).get()));
        for (const mediaSnap of mediaSnaps) {
            for (const mediaDoc of mediaSnap.docs) {
                const m = mediaDoc.data();
                const item = {
                    reportId: m.reportId,
                    storagePath: m.storagePath,
                    contentType: m.contentType ?? 'application/octet-stream',
                    sizeBytes: m.sizeBytes ?? 0,
                };
                // Add signed download URL.
                try {
                    const { url, expiresAt } = await getSignedStorageUrl(storage, STORAGE_BUCKET, m.storagePath);
                    item.downloadUrl = url;
                    item.expiresAt = expiresAt;
                }
                catch (err) {
                    console.error(`[requestDataExport] Failed to sign URL for ${m.storagePath}:`, err);
                    // Storage path may not exist yet; omit URL and continue.
                }
                mediaItems.push(item);
            }
        }
    }
    const envelope = {
        schemaVersion: 1,
        generatedAt: now,
        citizenUid: actor.uid,
        profile,
        reports,
        media: mediaItems,
    };
    // Upload envelope to Cloud Storage.
    const requestId = randomUUID();
    const storagePath = `data_exports/${actor.uid}/${String(now)}-${requestId}.json`;
    const envelopeBuffer = Buffer.from(JSON.stringify(envelope), 'utf-8');
    await storage
        .bucket(STORAGE_BUCKET)
        .file(storagePath)
        .save(envelopeBuffer, {
        contentType: 'application/json',
        metadata: { requestedBy: actor.uid },
    });
    // Generate signed URL for the envelope itself.
    const expiresAt = Date.now() + SIGNED_URL_TTL_MS;
    const [downloadUrl] = await storage
        .bucket(STORAGE_BUCKET)
        .file(storagePath)
        .getSignedUrl({ version: 'v4', action: 'read', expires: expiresAt });
    // Write Firestore tracking doc.
    await db.collection('data_exports').doc(requestId).set({
        citizenUid: actor.uid,
        status: 'ready',
        storagePath,
        createdAt: now,
        expiresAt,
        reportCount: reports.length,
        mediaCount: mediaItems.length,
    });
    // Audit event (no PII).
    void streamAuditEvent({
        eventType: 'data_export_generated',
        actorUid: actor.uid,
        targetDocumentId: requestId,
        metadata: { reportCount: reports.length, mediaCount: mediaItems.length },
        occurredAt: now,
    });
    return { downloadUrl, expiresAt, reportCount: reports.length, mediaCount: mediaItems.length };
}
export const requestDataExport = onCall({ region: 'asia-southeast1', enforceAppCheck: shouldEnforceAppCheck(), maxInstances: 10 }, async (request) => {
    const { uid } = requireAuth(request, ['citizen']);
    try {
        return await requestDataExportImpl(getFirestore(), getAuth(), getStorage(), { uid });
    }
    catch (err) {
        if (err instanceof HttpsError)
            throw err;
        console.error('requestDataExport failed:', err);
        throw new HttpsError('internal', 'Failed to generate data export.');
    }
});
//# sourceMappingURL=request-data-export.js.map