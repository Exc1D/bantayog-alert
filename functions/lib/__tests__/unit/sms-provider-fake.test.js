import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createFakeSmsProvider } from '../../services/sms-providers/fake.js';
const ORIGINAL_ENV = { ...process.env };
describe('createFakeSmsProvider', () => {
    beforeEach(() => {
        process.env.FAKE_SMS_LATENCY_MS = '10';
        process.env.FAKE_SMS_ERROR_RATE = '0';
        process.env.FAKE_SMS_FAIL_PROVIDER = '';
        process.env.FAKE_SMS_IMPERSONATE = 'semaphore';
    });
    afterEach(() => {
        delete process.env.FAKE_SMS_LATENCY_MS;
        delete process.env.FAKE_SMS_ERROR_RATE;
        delete process.env.FAKE_SMS_FAIL_PROVIDER;
        delete process.env.FAKE_SMS_IMPERSONATE;
        Object.assign(process.env, ORIGINAL_ENV);
    });
    it('returns accepted=true with providerMessageId under normal conditions', async () => {
        const provider = createFakeSmsProvider();
        const r = await provider.send({ to: '+639171234567', body: 'hi', encoding: 'GSM-7' });
        expect(r.accepted).toBe(true);
        if (r.accepted) {
            expect(r.providerMessageId).toMatch(/^fake-/);
            expect(r.encoding).toBe('GSM-7');
            expect(r.segmentCount).toBe(1);
            expect(r.latencyMs).toBeGreaterThanOrEqual(0);
        }
    });
    it('respects FAKE_SMS_ERROR_RATE=1.0 (always reject)', async () => {
        process.env.FAKE_SMS_ERROR_RATE = '1.0';
        const provider = createFakeSmsProvider();
        const r = await provider.send({ to: '+639171234567', body: 'hi', encoding: 'GSM-7' });
        expect(r.accepted).toBe(false);
    });
    it('throws when FAKE_SMS_FAIL_PROVIDER matches providerId (retryable error)', async () => {
        process.env.FAKE_SMS_FAIL_PROVIDER = 'semaphore';
        const provider = createFakeSmsProvider();
        await expect(provider.send({ to: '+639171234567', body: 'hi', encoding: 'GSM-7' })).rejects.toThrow();
    });
    it('does NOT throw when FAKE_SMS_FAIL_PROVIDER targets the other provider', async () => {
        process.env.FAKE_SMS_FAIL_PROVIDER = 'globelabs';
        const provider = createFakeSmsProvider();
        const r = await provider.send({ to: '+639171234567', body: 'hi', encoding: 'GSM-7' });
        expect(r.accepted).toBe(true);
    });
    it('FAKE_SMS_IMPERSONATE controls providerId field', () => {
        process.env.FAKE_SMS_IMPERSONATE = 'globelabs';
        const provider = createFakeSmsProvider();
        expect(provider.providerId).toBe('globelabs');
    });
});
//# sourceMappingURL=sms-provider-fake.test.js.map