import { describe, expect, it } from 'vitest';
import { reportSmsConsentDocSchema } from './users';
const ts = 1713350400000;
describe('reportSmsConsentDocSchema', () => {
    it('parses a full consent doc', () => {
        expect(reportSmsConsentDocSchema.parse({
            reportId: 'r1',
            phone: '+63 912 345 6789',
            locale: 'tl',
            smsConsent: true,
            municipalityId: 'daet',
            followUpConsent: true,
            createdAt: ts,
            schemaVersion: 1,
        })).toMatchObject({ municipalityId: 'daet', followUpConsent: true });
    });
    it('defaults followUpConsent to false', () => {
        const result = reportSmsConsentDocSchema.parse({
            reportId: 'r1',
            phone: '+63 912 345 6789',
            locale: 'tl',
            smsConsent: true,
            municipalityId: 'daet',
            createdAt: ts,
            schemaVersion: 1,
        });
        expect(result.followUpConsent).toBe(false);
    });
    it('rejects when municipalityId is absent', () => {
        expect(() => reportSmsConsentDocSchema.parse({
            reportId: 'r1',
            phone: '+63 912 345 6789',
            locale: 'tl',
            smsConsent: true,
            createdAt: ts,
            schemaVersion: 1,
        })).toThrow();
    });
});
//# sourceMappingURL=users.test.js.map