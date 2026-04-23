/**
 * Error types and status helpers for Bantayog Alert.
 *
 * BantayogError is a typed error class used across all Cloud Functions and
 * callables. Structured error codes (BantayogErrorCode) enable front-end
 * branch-on-error without string matching.
 */
import type { ReportStatus, DispatchStatus } from '@bantayog/shared-types';
export type { ReportStatus, DispatchStatus };
/**
 * Error codes used across all Bantayog Alert services.
 * These map to user-facing messages and determine retry behavior.
 */
export declare enum BantayogErrorCode {
    VALIDATION_ERROR = "VALIDATION_ERROR",
    INVALID_ARGUMENT = "INVALID_ARGUMENT",
    UNAUTHORIZED = "UNAUTHORIZED",
    FORBIDDEN = "FORBIDDEN",
    NOT_FOUND = "NOT_FOUND",
    CONFLICT = "CONFLICT",
    RATE_LIMITED = "RATE_LIMITED",
    QUOTA_EXCEEDED = "QUOTA_EXCEEDED",
    DEADLINE_EXCEEDED = "DEADLINE_EXCEEDED",
    SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE",
    INTERNAL_ERROR = "INTERNAL_ERROR",
    REPORT_NOT_FOUND = "REPORT_NOT_FOUND",
    DISPATCH_NOT_FOUND = "DISPATCH_NOT_FOUND",
    MUNICIPALITY_NOT_FOUND = "MUNICIPALITY_NOT_FOUND",
    UPLOAD_URL_GENERATION_FAILED = "UPLOAD_URL_GENERATION_FAILED",
    MEDIA_PROCESSING_FAILED = "MEDIA_PROCESSING_FAILED",
    INVALID_STATUS_TRANSITION = "INVALID_STATUS_TRANSITION",
    FAILED_PRECONDITION = "FAILED_PRECONDITION",
    IDEMPOTENCY_KEY_CONFLICT = "IDEMPOTENCY_KEY_CONFLICT"
}
/**
 * Returns true if the given string is a valid BantayogErrorCode.
 * Useful for narrowing unknown error code values from external sources.
 */
export declare function isBantayogErrorCode(value: string): value is BantayogErrorCode;
/**
 * Returns true if the given report status is terminal (no further transitions
 * are valid — spec §5.3).
 */
export declare function isTerminalReportStatus(status: ReportStatus): boolean;
/**
 * Returns true if the given dispatch status is terminal (no further transitions
 * are valid for the responder — spec §5.4).
 */
export declare function isTerminalDispatchStatus(status: DispatchStatus): boolean;
/**
 * BantayogError is a structured error with a machine-readable code, a safe
 * user message, and an optional payload. It serializes safely to JSON and
 * can be thrown across async boundaries without losing context.
 */
export declare class BantayogError extends Error {
    readonly code: BantayogErrorCode;
    readonly data?: Record<string, unknown> | undefined;
    constructor(code: BantayogErrorCode, message: string, data?: Record<string, unknown> | undefined);
    toJSON(): object;
}
/**
 * Create a BantayogError with a NOT_FOUND code and entity identifiers.
 * Convenience factory used across callables and triggers.
 */
export declare function notFoundError(entity: string, id: string, data?: Record<string, unknown>): BantayogError;
/**
 * Create a BantayogError with a INVALID_STATUS_TRANSITION code.
 */
export declare function invalidTransitionError(from: string, to: string, context?: Record<string, unknown>): BantayogError;
//# sourceMappingURL=errors.d.ts.map