import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getApp } from 'firebase-admin/app';
import { z } from 'zod';
const prewarmSurgeInputSchema = z
    .object({
    level: z.enum(['light', 'heavy']),
})
    .strict();
const LIGHT_FUNCTIONS = ['verifyReport', 'dispatchResponder', 'closeReport'];
const HEAVY_FUNCTIONS = [
    ...LIGHT_FUNCTIONS,
    'rejectReport',
    'suspendUser',
    'revokeUser',
    'resetUserTotp',
    'declareEmergency',
    'sendMassAlert',
    'massAlertReachPlanPreview',
];
function assertSuperadmin(actor) {
    if (actor.role !== 'provincial_superadmin') {
        throw new HttpsError('permission-denied', 'superadmin_required');
    }
}
function getFunctionUrl(functionName) {
    const projectId = getApp().options.projectId ?? '';
    return `https://asia-southeast1-${projectId}.cloudfunctions.net/${functionName}`;
}
export async function prewarmSurgeCore(actor, level) {
    assertSuperadmin(actor);
    const functions = level === 'light' ? LIGHT_FUNCTIONS : HEAVY_FUNCTIONS;
    let warmed = 0;
    // Sequential to avoid thundering herd against own infrastructure
    for (const name of functions) {
        try {
            const response = await fetch(getFunctionUrl(name), {
                method: 'GET',
                signal: AbortSignal.timeout(5000),
            });
            if (response.ok) {
                warmed++;
            }
        }
        catch {
            // Network error or timeout — function not warmed
        }
    }
    return { warmed };
}
export const prewarmSurge = onCall({ region: 'asia-southeast1', enforceAppCheck: true, maxInstances: 10, timeoutSeconds: 120 }, async (request) => {
    if (!request.auth)
        throw new HttpsError('unauthenticated', 'sign-in required');
    const role = request.auth.token.role;
    const actor = {
        uid: request.auth.uid,
        role: typeof role === 'string' ? role : '',
    };
    const parsed = prewarmSurgeInputSchema.safeParse(request.data);
    if (!parsed.success) {
        throw new HttpsError('invalid-argument', 'malformed payload');
    }
    assertSuperadmin(actor);
    return await prewarmSurgeCore(actor, parsed.data.level);
});
//# sourceMappingURL=prewarm-surge.js.map