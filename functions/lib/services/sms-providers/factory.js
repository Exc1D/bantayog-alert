import { createFakeSmsProvider } from './fake.js';
import { createSemaphoreSmsProvider } from './semaphore.js';
import { createGlobelabsSmsProvider } from './globelabs.js';
export function getProviderMode() {
    const raw = process.env.SMS_PROVIDER_MODE ?? 'fake';
    if (raw === 'real' || raw === 'disabled' || raw === 'fake')
        return raw;
    return 'fake';
}
function createDisabledSmsProvider() {
    return {
        providerId: 'disabled',
        send() {
            return Promise.reject(new Error('SMS provider is disabled'));
        },
    };
}
export function resolveProvider(target) {
    const mode = getProviderMode();
    if (mode === 'disabled') {
        return createDisabledSmsProvider();
    }
    if (mode === 'fake') {
        // impersonation is driven by FAKE_SMS_IMPERSONATE env in tests;
        // here we pin the fake to the requested target for production-like DI.
        process.env.FAKE_SMS_IMPERSONATE = target;
        return createFakeSmsProvider();
    }
    if (target === 'semaphore')
        return createSemaphoreSmsProvider();
    return createGlobelabsSmsProvider();
}
//# sourceMappingURL=factory.js.map