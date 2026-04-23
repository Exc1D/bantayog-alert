/**
 * Error codes used across all Bantayog Alert services.
 * These map to user-facing messages and determine retry behavior.
 */
export var BantayogErrorCode;
(function (BantayogErrorCode) {
    // Validation errors — never retry without fixing input
    BantayogErrorCode["VALIDATION_ERROR"] = "VALIDATION_ERROR";
    BantayogErrorCode["INVALID_ARGUMENT"] = "INVALID_ARGUMENT";
    BantayogErrorCode["UNAUTHORIZED"] = "UNAUTHORIZED";
    BantayogErrorCode["FORBIDDEN"] = "FORBIDDEN";
    BantayogErrorCode["NOT_FOUND"] = "NOT_FOUND";
    BantayogErrorCode["CONFLICT"] = "CONFLICT";
    // Quota / rate limit errors — client should back off
    BantayogErrorCode["RATE_LIMITED"] = "RATE_LIMITED";
    BantayogErrorCode["QUOTA_EXCEEDED"] = "QUOTA_EXCEEDED";
    // Transient errors — eligible for retry
    BantayogErrorCode["DEADLINE_EXCEEDED"] = "DEADLINE_EXCEEDED";
    BantayogErrorCode["SERVICE_UNAVAILABLE"] = "SERVICE_UNAVAILABLE";
    BantayogErrorCode["INTERNAL_ERROR"] = "INTERNAL_ERROR";
    // Domain-specific codes
    BantayogErrorCode["REPORT_NOT_FOUND"] = "REPORT_NOT_FOUND";
    BantayogErrorCode["DISPATCH_NOT_FOUND"] = "DISPATCH_NOT_FOUND";
    BantayogErrorCode["MUNICIPALITY_NOT_FOUND"] = "MUNICIPALITY_NOT_FOUND";
    BantayogErrorCode["UPLOAD_URL_GENERATION_FAILED"] = "UPLOAD_URL_GENERATION_FAILED";
    BantayogErrorCode["MEDIA_PROCESSING_FAILED"] = "MEDIA_PROCESSING_FAILED";
    BantayogErrorCode["INVALID_STATUS_TRANSITION"] = "INVALID_STATUS_TRANSITION";
    BantayogErrorCode["FAILED_PRECONDITION"] = "FAILED_PRECONDITION";
    BantayogErrorCode["IDEMPOTENCY_KEY_CONFLICT"] = "IDEMPOTENCY_KEY_CONFLICT";
})(BantayogErrorCode || (BantayogErrorCode = {}));
/**
 * Returns true if the given string is a valid BantayogErrorCode.
 * Useful for narrowing unknown error code values from external sources.
 */
export function isBantayogErrorCode(value) {
    return Object.values(BantayogErrorCode).includes(value);
}
/**
 * Returns true if the given report status is terminal (no further transitions
 * are valid — spec §5.3).
 */
export function isTerminalReportStatus(status) {
    return status === 'closed' || status === 'resolved';
}
/**
 * Returns true if the given dispatch status is terminal (no further transitions
 * are valid for the responder — spec §5.4).
 */
export function isTerminalDispatchStatus(status) {
    return status === 'resolved' || status === 'declined';
}
/**
 * BantayogError is a structured error with a machine-readable code, a safe
 * user message, and an optional payload. It serializes safely to JSON and
 * can be thrown across async boundaries without losing context.
 */
export class BantayogError extends Error {
    code;
    data;
    constructor(code, message, data) {
        super(message);
        this.code = code;
        this.data = data;
        this.name = 'BantayogError';
        // captureStackTrace is only available in V8; keep conditional for test envs
        if (typeof Error.captureStackTrace === 'function') {
            Error.captureStackTrace(this, BantayogError);
        }
    }
    toJSON() {
        return {
            name: this.name,
            code: this.code,
            message: this.message,
            ...(this.data ? { data: this.data } : {}),
        };
    }
}
/**
 * Create a BantayogError with a NOT_FOUND code and entity identifiers.
 * Convenience factory used across callables and triggers.
 */
export function notFoundError(entity, id, data) {
    return new BantayogError(BantayogErrorCode.NOT_FOUND, `${entity} '${id}' not found`, {
        entityId: id,
        entityType: entity,
        ...data,
    });
}
/**
 * Create a BantayogError with a INVALID_STATUS_TRANSITION code.
 */
export function invalidTransitionError(from, to, context) {
    return new BantayogError(BantayogErrorCode.INVALID_STATUS_TRANSITION, `Invalid transition: ${from} → ${to}`, { from, to, ...context });
}
//# sourceMappingURL=errors.js.map