import { HttpsError, type FunctionsErrorCode } from 'firebase-functions/v2/https';
import { BantayogErrorCode, type BantayogError } from '@bantayog/shared-validators';
export declare const BANTAYOG_TO_HTTPS_CODE: Record<BantayogErrorCode, FunctionsErrorCode>;
export declare function bantayogErrorToHttps(err: BantayogError): HttpsError;
export declare function requireAuth(request: {
    auth?: {
        uid: string;
        token: Record<string, unknown>;
    } | null;
}, allowedRoles: string[]): {
    uid: string;
    claims: Record<string, unknown>;
};
export declare function requireMfaAuth(request: {
    auth?: {
        uid: string;
        token: Record<string, unknown>;
    } | null;
}): void;
//# sourceMappingURL=https-error.d.ts.map