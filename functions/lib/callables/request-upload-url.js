import { randomUUID } from 'node:crypto';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getStorage } from 'firebase-admin/storage';
import { z } from 'zod';
import { BantayogError, BantayogErrorCode } from '@bantayog/shared-validators';
import { bantayogErrorToHttps } from './https-error.js';
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_SIZE_BYTES = 10 * 1024 * 1024;
const SIGNED_URL_TTL_MS = 5 * 60 * 1000;
const payloadSchema = z
    .object({
    mimeType: z.string(),
    sizeBytes: z.number().int().positive(),
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
    const storagePath = `pending/${uploadId}`;
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
export const requestUploadUrl = onCall(async (request) => {
    try {
        return await requestUploadUrlImpl({
            auth: request.auth ?? undefined,
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
//# sourceMappingURL=request-upload-url.js.map