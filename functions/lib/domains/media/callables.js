import { randomUUID } from 'node:crypto';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getStorage } from 'firebase-admin/storage';
import { Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';
import { BantayogError, BantayogErrorCode } from '@bantayog/shared-validators';
import { bantayogErrorToHttps } from '../shared/https-error.js';
import { shouldEnforceAppCheck } from '../shared/app-check-config.js';
import { adminDb } from '../../admin-init.js';
import { checkRateLimit } from '../shared/rate-limit.js';
import { getCitizenCallableCorsOrigins } from '../shared/callable-config.js';
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_SIZE_BYTES = 10 * 1024 * 1024;
const SIGNED_URL_TTL_MS = 60 * 1000; // 60 seconds — minimize interception window
const payloadSchema = z
    .object({
    mimeType: z.string(),
    sizeBytes: z.number().int().positive(),
    sha256: z.string().regex(/^[a-fA-F0-9]{64}$/),
})
    .strict();
export async function requestUploadUrlImpl(input) {
    if (!input.auth) {
        throw new BantayogError(BantayogErrorCode.UNAUTHORIZED, 'Must be authenticated to request an upload URL.');
    }
    const parsed = payloadSchema.safeParse(input.data);
    if (!parsed.success) {
        const issues = parsed.error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
        }));
        throw new BantayogError(BantayogErrorCode.INVALID_ARGUMENT, 'Invalid upload request payload.', {
            errors: issues,
        });
    }
    const { mimeType, sizeBytes } = parsed.data;
    if (!ALLOWED_MIME.has(mimeType)) {
        throw new BantayogError(BantayogErrorCode.INVALID_ARGUMENT, `MIME type '${mimeType}' is not allowed. Allowed: ${[...ALLOWED_MIME].join(', ')}`);
    }
    if (sizeBytes > MAX_SIZE_BYTES) {
        throw new BantayogError(BantayogErrorCode.INVALID_ARGUMENT, `File size ${String(sizeBytes)} exceeds maximum ${String(MAX_SIZE_BYTES)} bytes.`);
    }
    const storage = getStorage();
    const uploadId = randomUUID();
    // Bind upload path to user UID to prevent cross-user access
    const storagePath = `pending/${input.auth.uid}/${uploadId}`;
    const bucket = storage.bucket(input.bucket);
    const file = bucket.file(storagePath);
    const expiresAt = Date.now() + SIGNED_URL_TTL_MS;
    const [uploadUrl] = await file.getSignedUrl({
        version: 'v4',
        action: 'write',
        expires: expiresAt,
    });
    return {
        uploadUrl,
        uploadId,
        storagePath,
        expiresAt,
    };
}
export const requestUploadUrl = onCall({
    cors: getCitizenCallableCorsOrigins(),
    enforceAppCheck: shouldEnforceAppCheck(),
    maxInstances: 10,
}, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Must be signed in to request upload URL.');
    }
    const rl = await checkRateLimit(adminDb, {
        key: `requestUploadUrl:${request.auth.uid}`,
        limit: 20,
        windowSeconds: 60,
        now: Timestamp.now(),
    });
    if (!rl.allowed) {
        throw new HttpsError('resource-exhausted', 'rate limit exceeded');
    }
    try {
        return await requestUploadUrlImpl({
            auth: request.auth,
            data: request.data,
            bucket: process.env.STORAGE_BUCKET ?? 'bantayog-alert.appspot.com',
        });
    }
    catch (err) {
        if (err instanceof BantayogError) {
            throw bantayogErrorToHttps(err);
        }
        throw new HttpsError('internal', err instanceof Error ? err.message : 'Unknown error');
    }
});
//# sourceMappingURL=callables.js.map