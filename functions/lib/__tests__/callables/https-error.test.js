import { describe, it, expect } from 'vitest';
import { HttpsError } from 'firebase-functions/v2/https';
import { BANTAYOG_TO_HTTPS_CODE, bantayogErrorToHttps, requireAuth, requireMfaAuth, } from '../../callables/https-error.js';
import { BantayogError, BantayogErrorCode } from '@bantayog/shared-validators';
describe('BANTAYOG_TO_HTTPS_CODE', () => {
    it('maps every BantayogErrorCode to a FunctionsErrorCode', () => {
        // Iterate actual enum values, not map keys, to catch unmapped entries
        const codes = Object.values(BantayogErrorCode).filter((value) => typeof value === 'string');
        expect(codes.length).toBeGreaterThan(0);
        for (const code of codes) {
            expect(BANTAYOG_TO_HTTPS_CODE[code]).toBeDefined();
            expect(typeof BANTAYOG_TO_HTTPS_CODE[code]).toBe('string');
        }
    });
});
describe('bantayogErrorToHttps', () => {
    it('converts a BantayogError to an HttpsError with the right code', () => {
        const err = new BantayogError(BantayogErrorCode.VALIDATION_ERROR, 'bad input', { field: 'x' });
        const httpsErr = bantayogErrorToHttps(err);
        expect(httpsErr).toBeInstanceOf(HttpsError);
        expect(httpsErr.code).toBe('invalid-argument');
        expect(httpsErr.message).toBe('bad input');
        expect(httpsErr.details).toEqual({ field: 'x' });
    });
    it('converts NOT_FOUND to not-found', () => {
        const err = new BantayogError(BantayogErrorCode.NOT_FOUND, 'missing');
        const httpsErr = bantayogErrorToHttps(err);
        expect(httpsErr.code).toBe('not-found');
    });
});
describe('requireAuth', () => {
    it('throws unauthenticated when request.auth is null', () => {
        expect(() => requireAuth({ auth: null }, ['municipal_admin'])).toThrow(HttpsError);
        try {
            requireAuth({ auth: null }, ['municipal_admin']);
        }
        catch (err) {
            expect(err).toBeInstanceOf(HttpsError);
            expect(err.code).toBe('unauthenticated');
        }
        expect(() => requireAuth({ auth: null }, ['municipal_admin'])).toThrow('sign-in required');
    });
    it('throws unauthenticated when request.auth is undefined', () => {
        expect(() => requireAuth({}, ['municipal_admin'])).toThrow(HttpsError);
        try {
            requireAuth({}, ['municipal_admin']);
        }
        catch (err) {
            expect(err).toBeInstanceOf(HttpsError);
            expect(err.code).toBe('unauthenticated');
        }
    });
    it('throws permission-denied when role is not in allowed list', () => {
        const request = {
            auth: {
                uid: 'u1',
                token: { role: 'citizen' },
            },
        };
        expect(() => requireAuth(request, ['municipal_admin'])).toThrow('role citizen is not allowed');
        try {
            requireAuth(request, ['municipal_admin']);
        }
        catch (err) {
            expect(err).toBeInstanceOf(HttpsError);
            expect(err.code).toBe('permission-denied');
        }
    });
    it('throws permission-denied when role is missing', () => {
        const request = {
            auth: {
                uid: 'u1',
                token: {},
            },
        };
        expect(() => requireAuth(request, ['municipal_admin'])).toThrow('role undefined is not allowed');
        try {
            requireAuth(request, ['municipal_admin']);
        }
        catch (err) {
            expect(err).toBeInstanceOf(HttpsError);
            expect(err.code).toBe('permission-denied');
        }
    });
    it('returns uid and claims when role is allowed', () => {
        const request = {
            auth: {
                uid: 'u1',
                token: { role: 'municipal_admin', municipalityId: 'm1' },
            },
        };
        const result = requireAuth(request, ['municipal_admin', 'superadmin']);
        expect(result.uid).toBe('u1');
        expect(result.claims).toEqual({
            role: 'municipal_admin',
            municipalityId: 'm1',
        });
    });
});
describe('requireMfaAuth', () => {
    it('throws mfa_required when sign_in_second_factor is absent', () => {
        expect(() => {
            requireMfaAuth({
                auth: { uid: 'u1', token: { firebase: {} } },
            });
        }).toThrow('mfa_required');
        try {
            requireMfaAuth({
                auth: { uid: 'u1', token: { firebase: {} } },
            });
        }
        catch (err) {
            expect(err).toBeInstanceOf(HttpsError);
            expect(err.code).toBe('unauthenticated');
        }
    });
    it('passes when sign_in_second_factor is a string', () => {
        expect(() => {
            requireMfaAuth({
                auth: { uid: 'u1', token: { firebase: { sign_in_second_factor: 'totp' } } },
            });
        }).not.toThrow();
    });
    it('throws mfa_required when auth is null', () => {
        expect(() => {
            requireMfaAuth({ auth: null });
        }).toThrow('mfa_required');
        try {
            requireMfaAuth({ auth: null });
        }
        catch (err) {
            expect(err).toBeInstanceOf(HttpsError);
            expect(err.code).toBe('unauthenticated');
        }
    });
    it('throws mfa_required when auth is undefined', () => {
        expect(() => {
            requireMfaAuth({});
        }).toThrow('mfa_required');
        try {
            requireMfaAuth({});
        }
        catch (err) {
            expect(err).toBeInstanceOf(HttpsError);
            expect(err.code).toBe('unauthenticated');
        }
    });
    it('throws mfa_required when firebase claim is undefined', () => {
        expect(() => {
            requireMfaAuth({
                auth: { uid: 'u1', token: { role: 'superadmin' } },
            });
        }).toThrow('mfa_required');
        try {
            requireMfaAuth({
                auth: { uid: 'u1', token: { role: 'superadmin' } },
            });
        }
        catch (err) {
            expect(err).toBeInstanceOf(HttpsError);
            expect(err.code).toBe('unauthenticated');
        }
    });
    it('throws mfa_required when sign_in_second_factor is a number', () => {
        expect(() => {
            requireMfaAuth({
                auth: { uid: 'u1', token: { firebase: { sign_in_second_factor: 42 } } },
            });
        }).toThrow('mfa_required');
        try {
            requireMfaAuth({
                auth: { uid: 'u1', token: { firebase: { sign_in_second_factor: 42 } } },
            });
        }
        catch (err) {
            expect(err).toBeInstanceOf(HttpsError);
            expect(err.code).toBe('unauthenticated');
        }
    });
});
//# sourceMappingURL=https-error.test.js.map