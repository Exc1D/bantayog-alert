import { onCall } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { CAMARINES_NORTE_MUNICIPALITIES } from '@bantayog/shared-validators';
import { requireAuth, requireMfaAuth } from './https-error.js';
import { streamAuditEvent } from '../services/audit-stream.js';
import { enqueueBroadcastSms } from '../services/send-sms.js';
import { sendMassAlertFcm } from '../services/fcm-mass-send.js';
const declareEmergencyInputSchema = z.object({
    hazardType: z.string().min(1).max(100),
    affectedMunicipalityIds: z.array(z.string().min(1)).min(1),
    message: z.string().min(1).max(500),
});
const MUNICIPALITY_LABEL_BY_ID = new Map(CAMARINES_NORTE_MUNICIPALITIES.map((municipality) => [municipality.id, municipality.label]));
const MUNICIPALITY_CHUNK_SIZE = 10;
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
    const municipalityIds = [...new Set(validated.affectedMunicipalityIds)];
    const salt = process.env.SMS_MSISDN_HASH_SALT;
    if (!salt && process.env.NODE_ENV === 'production') {
        throw new Error('SMS_MSISDN_HASH_SALT required in production');
    }
    const saltValue = salt ?? '';
    for (let i = 0; i < municipalityIds.length; i += MUNICIPALITY_CHUNK_SIZE) {
        const municipalityChunk = municipalityIds.slice(i, i + MUNICIPALITY_CHUNK_SIZE);
        await db.runTransaction(async (tx) => {
            const consentSnap = await tx.get(db
                .collection('report_sms_consent')
                .where('followUpConsent', '==', true)
                .where('municipalityId', 'in', municipalityChunk));
            for (const consentDoc of consentSnap.docs) {
                const data = consentDoc.data();
                if (typeof data.phone !== 'string' || data.phone.length === 0)
                    continue;
                const locale = data.locale === 'en' || data.locale === 'tl' ? data.locale : 'tl';
                const municipalityName = MUNICIPALITY_LABEL_BY_ID.get(data.municipalityId ?? '') ?? 'Municipality';
                enqueueBroadcastSms(db, tx, {
                    recipientMsisdn: data.phone,
                    salt: saltValue,
                    locale,
                    vars: {
                        municipalityName,
                        body: validated.message,
                    },
                    providerId: 'semaphore',
                    massAlertRequestId: alertId,
                    nowMs: now,
                });
            }
        });
    }
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