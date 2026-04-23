import { describe, it, expect } from 'vitest';
import { normalizeMsisdn, msisdnPhSchema, hashMsisdn, MsisdnInvalidError } from './msisdn.js';
describe('normalizeMsisdn', () => {
    it('accepts +63 form unchanged', () => {
        expect(normalizeMsisdn('+639171234567')).toBe('+639171234567');
    });
    it('accepts 0-prefix form and rewrites to +63', () => {
        expect(normalizeMsisdn('09171234567')).toBe('+639171234567');
    });
    it('accepts 639XXXXXXXX form and rewrites to +63', () => {
        expect(normalizeMsisdn('639171234567')).toBe('+639171234567');
    });
    it('rejects non-PH country code', () => {
        expect(() => normalizeMsisdn('+14155552671')).toThrow(MsisdnInvalidError);
    });
    it('rejects wrong length', () => {
        expect(() => normalizeMsisdn('+63917123456')).toThrow(MsisdnInvalidError);
    });
    it('rejects non-numeric', () => {
        expect(() => normalizeMsisdn('+6391712ABCDE')).toThrow(MsisdnInvalidError);
    });
    it('rejects empty string', () => {
        expect(() => normalizeMsisdn('')).toThrow(MsisdnInvalidError);
    });
    it('strips internal spaces and dashes before validating', () => {
        expect(normalizeMsisdn('+63 917 123 4567')).toBe('+639171234567');
        expect(normalizeMsisdn('0917-123-4567')).toBe('+639171234567');
    });
});
describe('msisdnPhSchema', () => {
    it('parses normalized +63 values', () => {
        expect(msisdnPhSchema.parse('+639171234567')).toBe('+639171234567');
    });
    it('rejects 0-prefix (schema expects already-normalized input)', () => {
        expect(() => msisdnPhSchema.parse('09171234567')).toThrow();
    });
});
describe('hashMsisdn', () => {
    it('returns 64-char lowercase hex', () => {
        const h = hashMsisdn('+639171234567', 'salt-fixture-long');
        expect(h).toMatch(/^[a-f0-9]{64}$/);
    });
    it('is deterministic across calls', () => {
        expect(hashMsisdn('+639171234567', 'salt-a-very-long')).toBe(hashMsisdn('+639171234567', 'salt-a-very-long'));
    });
    it('salt changes the output', () => {
        expect(hashMsisdn('+639171234567', 'salt-a-very-long')).not.toBe(hashMsisdn('+639171234567', 'salt-b-very-long'));
    });
    it('throws for empty salt', () => {
        expect(() => hashMsisdn('+639171234567', '')).toThrow('at least 16 characters');
    });
    it('throws for short salt', () => {
        expect(() => hashMsisdn('+639171234567', 'short')).toThrow('at least 16 characters');
    });
    it('accepts valid salt of 16+ characters', () => {
        const result = hashMsisdn('+639171234567', 'a'.repeat(16));
        expect(result).toMatch(/^[a-f0-9]{64}$/);
    });
});
//# sourceMappingURL=msisdn.test.js.map