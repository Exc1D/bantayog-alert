import { onCall } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { requireAuth, requireMfaAuth } from './https-error.js';
import { streamAuditEvent } from '../services/audit-stream.js';
import { sendMassAlertFcm } from '../services/fcm-mass-send.js';
const declareEmergencyInputSchema = z.object({
    hazardType: z.string().min(1).max(100),
    affectedMunicipalityIds: z.array(z.string().min(1)).min(1),
    message: z.string().min(1).max(500),
});
export async function declareEmergencyCore(db, input, actor) {
    const validated = declareEmergencyInputSchema.parse(input);
    const alertId = randomUUID();
    const now = Date.now();
    await db.collection('alerts').doc(alertId).set({
        alertId,
        alertType: 'emergency',
        hazardType: validated.hazardType,
        affectedMunicipalityIds: validated.affectedMunicipalityIds,
        message: validated.message,
        declaredBy: actor.uid,
        declaredAt: now,
        schemaVersion: 1,
    });
    void sendMassAlertFcm(db, {
        municipalityIds: validated.affectedMunicipalityIds,
        title: `Emergency: ${validated.hazardType}`,
        body: validated.message,
    });
    void streamAuditEvent({
        eventType: 'emergency_declared',
        actorUid: actor.uid,
        targetDocumentId: alertId,
        metadata: { hazardType: validated.hazardType },
        occurredAt: now,
    });
    return { alertId };
}
export const declareEmergency = onCall({ region: 'asia-southeast1', enforceAppCheck: true }, async (request) => {
    const { uid } = requireAuth(request, ['superadmin']);
    requireMfaAuth(request);
    return declareEmergencyCore(getFirestore(), request.data, { uid });
});
//# sourceMappingURL=declare-emergency.js.map