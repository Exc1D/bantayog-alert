import { HttpsError } from 'firebase-functions/v2/https';
import { BantayogErrorCode } from '@bantayog/shared-validators';
export const BANTAYOG_TO_HTTPS_CODE = {
    // Validation errors — never retry without fixing input
    VALIDATION_ERROR: 'invalid-argument',
    INVALID_ARGUMENT: 'invalid-argument',
    UNAUTHORIZED: 'unauthenticated',
    FORBIDDEN: 'permission-denied',
    NOT_FOUND: 'not-found',
    CONFLICT: 'already-exists',
    // Quota / rate limit errors — client should back off
    RATE_LIMITED: 'resource-exhausted',
    QUOTA_EXCEEDED: 'resource-exhausted',
    // Transient errors — eligible for retry
    DEADLINE_EXCEEDED: 'deadline-exceeded',
    SERVICE_UNAVAILABLE: 'unavailable',
    INTERNAL_ERROR: 'internal',
    // Domain-specific codes
    REPORT_NOT_FOUND: 'not-found',
    DISPATCH_NOT_FOUND: 'not-found',
    MUNICIPALITY_NOT_FOUND: 'not-found',
    UPLOAD_URL_GENERATION_FAILED: 'internal',
    MEDIA_PROCESSING_FAILED: 'internal',
    INVALID_STATUS_TRANSITION: 'failed-precondition',
    FAILED_PRECONDITION: 'failed-precondition',
    IDEMPOTENCY_KEY_CONFLICT: 'already-exists',
};
export function bantayogErrorToHttps(err) {
    return new HttpsError(BANTAYOG_TO_HTTPS_CODE[err.code], err.message, err.data);
}
export function requireAuth(request, allowedRoles) {
    if (!request.auth)
        throw new HttpsError('unauthenticated', 'sign-in required');
    const claims = request.auth.token;
    const role = claims.role;
    if (typeof role !== 'string' || !allowedRoles.includes(role)) {
        throw new HttpsError('permission-denied', `role ${String(role)} is not allowed`);
    }
    return { uid: request.auth.uid, claims };
}
export function requireMfaAuth(request) {
    const firebase = request.auth?.token.firebase;
    if (typeof firebase?.sign_in_second_factor !== 'string') {
        throw new HttpsError('unauthenticated', 'mfa_required');
    }
}
//# sourceMappingURL=https-error.js.map