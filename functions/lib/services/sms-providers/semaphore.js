import { SmsProviderRetryableError, } from '../sms-provider.js';
import { normalizeMsisdn } from '@bantayog/shared-validators';
const PROVIDER_TIMEOUT_MS = 5_000;
export function createSemaphoreSmsProvider() {
    return {
        providerId: 'semaphore',
        async send(input) {
            const apiKey = process.env.SEMAPHORE_API_KEY;
            if (!apiKey)
                throw new Error('SEMAPHORE_API_KEY not set');
            const normalizedTo = normalizeMsisdn(input.to).replace(/^\+/, '');
            const endpoint = input.priority === 'urgent'
                ? 'https://api.semaphore.co/otp/send'
                : 'https://api.semaphore.co/messages/send';
            const params = new URLSearchParams({
                apiKey,
                number: normalizedTo,
                message: input.body,
                sendername: process.env.SMS_SENDER_NAME ?? 'SEMAPHORE',
            });
            const controller = new AbortController();
            const timer = setTimeout(() => {
                controller.abort();
            }, PROVIDER_TIMEOUT_MS);
            let res;
            try {
                res = await fetch(`${endpoint}?${params.toString()}`, {
                    method: 'POST',
                    signal: controller.signal,
                });
            }
            catch (err) {
                if (err instanceof DOMException && err.name === 'AbortError') {
                    throw new SmsProviderRetryableError('semaphore request timed out', 'provider_error');
                }
                throw err;
            }
            finally {
                clearTimeout(timer);
            }
            let data = {};
            try {
                data = (await res.json());
            }
            catch (err) {
                // 4xx errors are non-retryable (client request issues)
                if (res.status >= 400 && res.status < 500 && res.status !== 429) {
                    return { accepted: false, reason: 'other', latencyMs: 0 };
                }
                // 5xx and network errors are retryable
                throw new SmsProviderRetryableError(`semaphore ${res.status.toString()}: unparseable response (${String(err)})`, res.status === 429 ? 'rate_limited' : 'provider_error');
            }
            const status = data.status ?? '';
            const errorsArr = data.errors ?? [];
            const messageId = String(data.message_id ?? '');
            const firstErr = errorsArr[0];
            // Check HTTP error codes first — these take precedence
            if (!res.ok) {
                const retryable = res.status >= 500 || res.status === 429;
                if (retryable) {
                    throw new SmsProviderRetryableError(`semaphore ${res.status.toString()}: ${firstErr?.error ?? res.statusText}`, res.status === 429 ? 'rate_limited' : 'provider_error');
                }
                // 400 bad format — e.g. unapproved sender name
                if (res.status === 400 && /sender/i.test(firstErr?.error ?? '')) {
                    return { accepted: false, reason: 'bad_format', latencyMs: 0 };
                }
                return { accepted: false, reason: 'other', latencyMs: 0 };
            }
            // Semaphore returns 200 even on credit failure — check body status
            if (status === 'Error') {
                const msg = firstErr?.error ?? data.message ?? 'unknown';
                // Credit exhaustion = non-retryable (account-level problem)
                const nonRetryable = /credit|insufficient|balance/i.test(msg);
                const rejected = {
                    accepted: false,
                    latencyMs: 0,
                    reason: nonRetryable ? 'provider_limit' : 'other',
                };
                if (messageId)
                    rejected.providerMessageId = messageId;
                return rejected;
            }
            if (status === 'Queued') {
                const success = {
                    accepted: true,
                    providerMessageId: messageId,
                    latencyMs: 0,
                    segmentCount: input.segmentCount ?? 1,
                    encoding: input.encoding,
                };
                return success;
            }
            // Fallback: unexpected status
            return { accepted: false, reason: 'other', latencyMs: 0 };
        },
    };
}
//# sourceMappingURL=semaphore.js.map