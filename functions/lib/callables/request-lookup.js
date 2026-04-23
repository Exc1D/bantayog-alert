import { createHash } from 'node:crypto';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { z } from 'zod';
import { BantayogError, BantayogErrorCode } from '@bantayog/shared-validators';
import { bantayogErrorToHttps } from './https-error.js';
const payloadSchema = z
    .object({
    publicRef: z.string().regex(/^[a-z0-9]{8}$/),
    secret: z.string().min(1).max(64),
})
    .strict();
export async function requestLookupImpl(input) {
    const parsed = payloadSchema.safeParse(input.data);
    if (!parsed.success) {
        throw new BantayogError(BantayogErrorCode.INVALID_ARGUMENT, 'Invalid lookup request payload.');
    }
    const { publicRef, secret } = parsed.data;
    const lookupSnap = await input.db.collection('report_lookup').doc(publicRef).get();
    if (!lookupSnap.exists) {
        throw new BantayogError(BantayogErrorCode.NOT_FOUND, 'Unknown reference.');
    }
    const lookup = lookupSnap.data();
    if (lookup.expiresAt < Date.now()) {
        throw new BantayogError(BantayogErrorCode.NOT_FOUND, 'Reference expired.');
    }
    const secretHash = createHash('sha256').update(secret).digest('hex');
    if (secretHash !== lookup.tokenHash) {
        throw new BantayogError(BantayogErrorCode.FORBIDDEN, 'Secret mismatch.');
    }
    const reportSnap = await input.db.collection('reports').doc(lookup.reportId).get();
    if (!reportSnap.exists) {
        throw new BantayogError(BantayogErrorCode.NOT_FOUND, 'Report not found.');
    }
    const report = reportSnap.data();
    return {
        status: report.status ?? 'unknown',
        lastStatusAt: report.updatedAt ?? report.submittedAt ?? 0,
        municipalityLabel: report.municipalityLabel ?? 'Unknown',
    };
}
export const requestLookup = onCall(async (request) => {
    try {
        return await requestLookupImpl({
            db: getFirestore(),
            data: request.data,
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