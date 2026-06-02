import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { z } from 'zod';
import { adminDb } from '../../admin-init.js';
import { PROVINCIAL_SUPERADMIN } from '../../constants/roles.js';
import { requireAuth } from '../shared/https-error.js';
import { shouldEnforceAppCheck } from '../shared/app-check-config.js';
import { getAdminCallableCorsOrigins } from '../shared/callable-config.js';
import { checkRateLimit } from '../shared/rate-limit.js';
const SURFACES = ['feed', 'alerts'];
const VISIBILITIES = ['public', 'internal'];
const REASONS = [
    'sensitive_content',
    'privacy_request',
    'false_or_misleading',
    'legal_request',
    'other',
];
const InputSchema = z
    .object({
    surface: z.enum(SURFACES),
    contentId: z.string().min(1).max(128),
    visibility: z.enum(VISIBILITIES),
    reason: z.enum(REASONS),
    idempotencyKey: z.uuid(),
})
    .strict();
function collectionForSurface(surface) {
    return surface === 'alerts' ? 'alerts' : 'situation_updates';
}
function municipalityIds(data) {
    const affected = data.affectedMunicipalityIds;
    const target = data.targetMunicipalityIds;
    const value = Array.isArray(affected) ? affected : target;
    return Array.isArray(value)
        ? value.filter((item) => typeof item === 'string')
        : [];
}
function assertActorCanModerate(deps, data) {
    const { role, municipalityId } = deps.actor.claims;
    if (role !== 'municipal_admin' && role !== 'provincial_superadmin') {
        throw new HttpsError('permission-denied', 'municipal_admin or provincial_superadmin required');
    }
    if (role === 'provincial_superadmin')
        return;
    if (!municipalityId) {
        throw new HttpsError('permission-denied', 'municipality scope required');
    }
    if (deps.surface === 'feed' && data.municipalityId !== municipalityId) {
        throw new HttpsError('permission-denied', 'content not in your municipality');
    }
    if (deps.surface === 'alerts' && !municipalityIds(data).includes(municipalityId)) {
        throw new HttpsError('permission-denied', 'alert not in your municipality');
    }
}
export async function setCitizenContentVisibilityCore(db, deps) {
    const contentRef = db.collection(collectionForSurface(deps.surface)).doc(deps.contentId);
    const contentSnap = await contentRef.get();
    if (!contentSnap.exists) {
        throw new HttpsError('not-found', 'content not found');
    }
    const data = contentSnap.data() ?? {};
    assertActorCanModerate(deps, data);
    await contentRef.update({
        visibility: deps.visibility,
        updatedAt: deps.now,
        moderatedAt: deps.now,
        moderatedBy: deps.actor.uid,
        moderationReason: deps.reason,
    });
    const incidentRef = deps.idempotencyKey
        ? db
            .collection('moderation_incidents')
            .doc(['citizenContent', deps.actor.uid, deps.idempotencyKey].join(':'))
        : db.collection('moderation_incidents').doc();
    await incidentRef.set({
        contentSurface: deps.surface,
        contentId: deps.contentId,
        action: deps.visibility === 'public' ? 'restore' : 'hide',
        reason: deps.reason,
        actor: deps.actor.uid,
        actorRole: deps.actor.claims.role ?? 'municipal_admin',
        at: deps.now,
        schemaVersion: 1,
    });
    return {
        surface: deps.surface,
        contentId: deps.contentId,
        visibility: deps.visibility,
        updatedAt: deps.now,
    };
}
export const setCitizenContentVisibility = onCall({
    region: 'asia-southeast1',
    enforceAppCheck: shouldEnforceAppCheck(),
    maxInstances: 100,
    cors: getAdminCallableCorsOrigins(),
}, async (request) => {
    const { uid, claims } = requireAuth(request, [PROVINCIAL_SUPERADMIN, 'municipal_admin']);
    const parsed = InputSchema.safeParse(request.data);
    if (!parsed.success) {
        console.error('setCitizenContentVisibility validation failed:', z.treeifyError(parsed.error));
        throw new HttpsError('invalid-argument', 'malformed payload');
    }
    const rl = await checkRateLimit(getFirestore(), {
        key: `setCitizenContentVisibility:${uid}`,
        limit: 60,
        windowSeconds: 60,
        now: Timestamp.now(),
    });
    if (!rl.allowed) {
        throw new HttpsError('resource-exhausted', 'rate limit', {
            retryAfterSeconds: rl.retryAfterSeconds,
        });
    }
    const actorClaims = {};
    if (typeof claims.role === 'string')
        actorClaims.role = claims.role;
    if (typeof claims.municipalityId === 'string')
        actorClaims.municipalityId = claims.municipalityId;
    return setCitizenContentVisibilityCore(adminDb, {
        surface: parsed.data.surface,
        contentId: parsed.data.contentId,
        visibility: parsed.data.visibility,
        reason: parsed.data.reason,
        idempotencyKey: parsed.data.idempotencyKey,
        actor: { uid, claims: actorClaims },
        now: Date.now(),
    });
});
//# sourceMappingURL=citizen-content-visibility.js.map