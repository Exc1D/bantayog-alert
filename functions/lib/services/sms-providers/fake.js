import { detectEncoding } from '@bantayog/shared-validators';
import { SmsProviderRetryableError } from '../sms-provider.js';
function parseImpersonation() {
    const raw = process.env.FAKE_SMS_IMPERSONATE;
    if (raw === 'globelabs')
        return 'globelabs';
    return 'semaphore';
}
export function createFakeSmsProvider() {
    const providerId = parseImpersonation();
    return {
        providerId,
        async send(input) {
            const latencyMs = Number(process.env.FAKE_SMS_LATENCY_MS ?? '0');
            if (!Number.isNaN(latencyMs) && latencyMs > 0) {
                await new Promise((r) => setTimeout(r, latencyMs));
            }
            const fail = (process.env.FAKE_SMS_FAIL_PROVIDER ?? '').trim();
            if (fail === providerId) {
                throw new SmsProviderRetryableError(`fake: simulated failure for ${providerId}`, 'provider_error');
            }
            const errorRate = Number(process.env.FAKE_SMS_ERROR_RATE ?? '0');
            if (!Number.isNaN(errorRate) && errorRate > 0 && Math.random() < errorRate) {
                return {
                    accepted: false,
                    latencyMs,
                    reason: 'other',
                };
            }
            const { encoding, segmentCount } = detectEncoding(input.body);
            return {
                accepted: true,
                providerMessageId: `fake-${providerId}-${crypto.randomUUID()}`,
                latencyMs,
                segmentCount,
                encoding,
            };
        },
    };
}
//# sourceMappingURL=fake.js.map