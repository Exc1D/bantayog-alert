import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { requireAuth, requireMfaAuth } from '../shared/https-error.js';
import { PDRRMO, PROVINCIAL_SUPERADMIN } from '../../constants/roles.js';
import { streamAuditEvent } from '../ops/audit-stream.js';
import { shouldEnforceAppCheck } from '../shared/app-check-config.js';
import { checkRateLimit } from '../shared/rate-limit.js';
import { Timestamp } from 'firebase-admin/firestore';
const HAZARD_TYPES = [
    'flood',
    'landslide',
    'earthquake',
    'fire',
    'typhoon',
    'storm_surge',
    'volcanic_eruption',
    'tsunami',
    'drought',
    'security',
    'health',
    'infrastructure',
    'other',
];
const declareAlertInputSchema = z.object({
    hazardType: z.enum(HAZARD_TYPES),
    affectedMunicipalityIds: z.array(z.string().min(1)).min(1),
    message: z.string().min(1).max(500),
    reportId: z.uuid().optional(),
});
export async function declareAlertCore(db, input, actor) {
    const validated = declareAlertInputSchema.parse(input);
    if (actor.claims?.role === 'municipal_admin') {
        const municipalityId = actor.claims.municipalityId;
        if (typeof municipalityId !== 'string' ||
            validated.affectedMunicipalityIds.some((id) => id !== municipalityId)) {
            throw new HttpsError('permission-denied', 'municipal_admin can only declare alerts for their municipality');
        }
    }
    const alertId = randomUUID();
    const now = Date.now();
    const alertDoc = {
        alertId,
        alertType: 'alert',
        hazardType: validated.hazardType,
        affectedMunicipalityIds: validated.affectedMunicipalityIds,
        message: validated.message,
        declaredBy: actor.uid,
        declaredAt: now,
        publishedAt: now,
        visibility: 'public',
        schemaVersion: 1,
    };
    if (validated.reportId) {
        alertDoc.reportId = validated.reportId;
    }
    await db.collection('alerts').doc(alertId).set(alertDoc);
    if (process.env.FUNCTIONS_EMULATOR !== 'true') {
        // Best-effort FCM push — don't fail alert creation if push fails
        try {
            const { messaging } = await import('firebase-admin');
            await messaging().send({
                topic: 'alerts',
                notification: {
                    title: 'Alert Issued',
                    body: validated.message,
                },
                data: {
                    alertId,
                    hazardType: validated.hazardType,
                },
            });
        }
        catch (err) {
            console.error('FCM push failed:', err);
        }
    }
    void streamAuditEvent({
        eventType: 'alert_declared',
        actorUid: actor.uid,
        targetDocumentId: alertId,
        metadata: { hazardType: validated.hazardType },
        occurredAt: now,
    });
    return { alertId };
}
export const declareAlert = onCall({
    region: 'asia-southeast1',
    enforceAppCheck: shouldEnforceAppCheck(),
    maxInstances: 10,
    memory: '512MiB',
}, async (request) => {
    const { uid, claims } = requireAuth(request, [PROVINCIAL_SUPERADMIN, PDRRMO, 'municipal_admin']);
    requireMfaAuth(request);
    const rl = await checkRateLimit(getFirestore(), {
        key: `declareAlert:${uid}`,
        limit: 5,
        windowSeconds: 300,
        now: Timestamp.now(),
    });
    if (!rl.allowed) {
        throw new HttpsError('resource-exhausted', 'rate limit exceeded');
    }
    return declareAlertCore(getFirestore(), request.data, { uid, claims });
});
//# sourceMappingURL=callables.js.map