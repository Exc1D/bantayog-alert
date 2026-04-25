import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import * as turf from '@turf/turf';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { adminDb } from '../admin-init.js';
import { logDimension } from '@bantayog/shared-validators';
const log = logDimension('borderAutoShare');
// Load once per function instance — not per invocation
let municipalityBoundaries = null;
function getMunicipalityBoundaries() {
    if (!municipalityBoundaries) {
        const require = createRequire(import.meta.url);
        const filePath = require.resolve('@bantayog/shared-data/municipality-boundaries.geojson');
        municipalityBoundaries = JSON.parse(readFileSync(filePath, 'utf8'));
    }
    return municipalityBoundaries;
}
export async function borderAutoShareCore(db, deps) {
    const { reportId, opsData, boundaryGeohashSet } = deps;
    const locationGeohash = opsData.locationGeohash;
    if (!locationGeohash)
        return;
    if (!boundaryGeohashSet.has(locationGeohash))
        return;
    // Load exact location from report_private
    const privateSnap = await db.collection('report_private').doc(reportId).get();
    const exactLocation = privateSnap.data()?.exactLocation;
    if (!exactLocation)
        return;
    const point = turf.point([exactLocation.lng, exactLocation.lat]);
    const boundaries = getMunicipalityBoundaries();
    const ownerMuniId = opsData.municipalityId;
    const nowMs = Date.now();
    for (const feature of boundaries.features) {
        const targetMuniId = feature.properties?.municipalityId;
        if (targetMuniId === ownerMuniId)
            continue;
        const buffered = turf.buffer(feature, 0.5, {
            units: 'kilometers',
        });
        if (!buffered || !turf.booleanPointInPolygon(point, buffered))
            continue;
        // This report is within 500m of targetMuniId's boundary — auto-share
        const sharingRef = db.collection('report_sharing').doc(reportId);
        const eventRef = sharingRef.collection('events').doc();
        const threadRef = db.collection('command_channel_threads').doc();
        const opsRef = db.collection('report_ops').doc(reportId);
        await db.runTransaction(async (tx) => {
            // Re-read sharing doc inside transaction to avoid race conditions
            const existingSnap = await tx.get(sharingRef);
            const existingData = existingSnap.data();
            const currentShared = existingData?.sharedWith ?? [];
            if (currentShared.includes(targetMuniId))
                return; // already shared
            tx.set(sharingRef, {
                ownerMunicipalityId: ownerMuniId,
                reportId,
                sharedWith: [...new Set([...currentShared, targetMuniId])],
                updatedAt: nowMs,
                schemaVersion: 1,
            }, { merge: true });
            tx.set(eventRef, {
                targetMunicipalityId: targetMuniId,
                sharedBy: 'system',
                sharedAt: nowMs,
                source: 'auto',
                schemaVersion: 1,
            });
            tx.set(threadRef, {
                threadId: threadRef.id,
                reportId,
                threadType: 'border_share',
                subject: `Auto-shared with ${targetMuniId} (boundary proximity)`,
                participantUids: {
                    [ownerMuniId]: true,
                    [targetMuniId]: true,
                },
                createdBy: 'system',
                createdAt: nowMs,
                updatedAt: nowMs,
                schemaVersion: 1,
            });
            tx.update(opsRef, {
                'visibility.scope': 'shared',
                'visibility.sharedWith': [...new Set([...currentShared, targetMuniId])],
                updatedAt: nowMs,
            });
        });
        log({
            severity: 'INFO',
            code: 'border.auto-share',
            message: `Auto-shared ${reportId} with ${targetMuniId}`,
        });
    }
}
export const borderAutoShareTrigger = onDocumentCreated({ document: 'report_ops/{reportId}', region: 'asia-southeast1', timeoutSeconds: 60 }, async (event) => {
    const opsData = event.data?.data() ?? {};
    let boundaryGeohashSet = new Set();
    try {
        const mod = (await import('@bantayog/shared-data'));
        boundaryGeohashSet = mod.BOUNDARY_GEOHASH_SET ?? new Set();
    }
    catch (err) {
        log({
            severity: 'WARNING',
            code: 'border.shared-data-missing',
            message: `Failed to import @bantayog/shared-data: ${err instanceof Error ? err.message : String(err)}`,
        });
    }
    await borderAutoShareCore(adminDb, {
        reportId: event.params.reportId,
        opsData,
        boundaryGeohashSet,
    });
});
//# sourceMappingURL=border-auto-share.js.map