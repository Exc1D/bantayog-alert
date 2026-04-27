import { onCall } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { requireAuth, requireMfaAuth } from './https-error.js';
import { streamAuditEvent } from '../services/audit-stream.js';
const dataIncidentInputSchema = z.object({
    incidentType: z.enum([
        'unauthorized_access',
        'data_loss',
        'data_corruption',
        'system_breach',
        'accidental_disclosure',
    ]),
    severity: z.enum(['critical', 'high', 'medium', 'low']),
    affectedCollections: z.array(z.string().min(1)),
    affectedDataClasses: z.array(z.string().min(1)),
    estimatedAffectedSubjects: z.number().int().nonnegative().optional(),
    summary: z.string().min(1).max(2000),
});
export async function declareDataIncidentCore(db, input, actor) {
    const validated = dataIncidentInputSchema.parse(input);
    const incidentId = randomUUID();
    const eventId = randomUUID();
    const now = Date.now();
    await db.runTransaction(async (tx) => {
        await Promise.resolve();
        tx.set(db.collection('data_incidents').doc(incidentId), {
            ...validated,
            incidentId,
            status: 'declared',
            declaredAt: now,
            declaredBy: actor.uid,
            retentionExempt: false,
            schemaVersion: 1,
        });
        tx.set(db.collection('incident_response_events').doc(eventId), {
            eventId,
            incidentId,
            phase: 'declared',
            recordedBy: actor.uid,
            recordedAt: now,
            schemaVersion: 1,
        });
    });
    void streamAuditEvent({
        eventType: 'data_incident_declared',
        actorUid: actor.uid,
        targetDocumentId: incidentId,
        occurredAt: now,
    });
    return { incidentId };
}
export const declareDataIncident = onCall({ region: 'asia-southeast1', enforceAppCheck: true }, async (request) => {
    const { uid } = requireAuth(request, ['superadmin']);
    requireMfaAuth(request);
    return declareDataIncidentCore(getFirestore(), request.data, { uid });
});
//# sourceMappingURL=declare-data-incident.js.map