import { createHash } from 'node:crypto';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { z } from 'zod';
import { BantayogError, BantayogErrorCode } from '@bantayog/shared-validators';
import { bantayogErrorToHttps } from '../shared/https-error.js';
import { shouldEnforceAppCheck } from '../shared/app-check-config.js';
const payloadSchema = z.union([
    z
        .object({
        publicRef: z.string().regex(/^[a-z0-9]{8}$/),
        secret: z.string().min(1).max(64),
    })
        .strict(),
    z
        .object({
        secret: z.string().min(1).max(64),
    })
        .strict(),
]);
export async function requestLookupImpl(input) {
    const parsed = payloadSchema.safeParse(input.data);
    if (!parsed.success) {
        throw new BantayogError(BantayogErrorCode.INVALID_ARGUMENT, 'Invalid lookup request payload.');
    }
    const data = parsed.data;
    const secretOnlyPath = !('publicRef' in data);
    const secretHash = createHash('sha256').update(data.secret).digest('hex');
    let resolvedPublicRef;
    let reportId;
    if (secretOnlyPath) {
        if (input.auth === undefined) {
            throw new BantayogError(BantayogErrorCode.UNAUTHORIZED, 'Authentication required for secret-only lookup.');
        }
        const secretSnap = await input.db.collection('secret_lookup').doc(secretHash).get();
        if (!secretSnap.exists) {
            throw new BantayogError(BantayogErrorCode.NOT_FOUND, 'Unknown secret.');
        }
        const secretDoc = secretSnap.data();
        if (!secretDoc ||
            typeof secretDoc.publicRef !== 'string' ||
            typeof secretDoc.reportId !== 'string' ||
            typeof secretDoc.expiresAt !== 'number') {
            console.error('[requestLookup] secret_lookup doc malformed:', { secretHash, secretDoc });
            throw new BantayogError(BantayogErrorCode.NOT_FOUND, 'Invalid secret record.');
        }
        if (secretDoc.expiresAt < Date.now()) {
            throw new BantayogError(BantayogErrorCode.NOT_FOUND, 'Secret expired.');
        }
        resolvedPublicRef = secretDoc.publicRef;
        reportId = secretDoc.reportId;
    }
    else {
        const { publicRef } = data;
        resolvedPublicRef = publicRef;
        const lookupSnap = await input.db.collection('report_lookup').doc(publicRef).get();
        if (!lookupSnap.exists) {
            throw new BantayogError(BantayogErrorCode.NOT_FOUND, 'Unknown reference.');
        }
        const lookup = lookupSnap.data();
        if (lookup.expiresAt < Date.now()) {
            throw new BantayogError(BantayogErrorCode.NOT_FOUND, 'Reference expired.');
        }
        if (secretHash !== lookup.tokenHash) {
            throw new BantayogError(BantayogErrorCode.FORBIDDEN, 'Secret mismatch.');
        }
        reportId = lookup.reportId;
    }
    const reportSnap = await input.db.collection('reports').doc(reportId).get();
    if (!reportSnap.exists) {
        throw new BantayogError(BantayogErrorCode.NOT_FOUND, 'Report not found.');
    }
    const report = reportSnap.data();
    return {
        publicRef: resolvedPublicRef,
        status: report.status ?? 'unknown',
        lastStatusAt: report.updatedAt ?? report.submittedAt ?? 0,
        municipalityLabel: report.municipalityLabel ?? 'Unknown',
    };
}
export const requestLookup = onCall({
    cors: ['http://localhost:5173', 'https://bantayog-citizen-staging.web.app'],
    enforceAppCheck: shouldEnforceAppCheck(),
}, async (request) => {
    try {
        return await requestLookupImpl({
            db: getFirestore(),
            data: request.data,
            auth: request.auth ?? undefined,
        });
    }
    catch (err) {
        if (err instanceof BantayogError) {
            throw bantayogErrorToHttps(err);
        }
        throw new HttpsError('internal', err instanceof Error ? err.message : 'Unknown error');
    }
});
//# sourceMappingURL=request-lookup.js.map