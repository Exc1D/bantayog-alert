import { SmsProviderRetryableError, } from '../sms-provider.js';
import { normalizeMsisdn } from '@bantayog/shared-validators';
import { getFirestore as realGetFirestore } from 'firebase-admin/firestore';
let refreshMutex = null;
const PROVIDER_TIMEOUT_MS = 5_000;
async function fetchWithTimeout(url, init) {
    const controller = new AbortController();
    const timer = setTimeout(() => {
        controller.abort();
    }, PROVIDER_TIMEOUT_MS);
    try {
        return await fetch(url, { ...init, signal: controller.signal });
    }
    catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
            throw new SmsProviderRetryableError('globelabs request timed out', 'provider_error');
        }
        throw err;
    }
    finally {
        clearTimeout(timer);
    }
}
async function fetchAndCacheToken(db) {
    const appId = process.env.GLOBE_LABS_APP_ID;
    const appSecret = process.env.GLOBE_LABS_APP_SECRET;
    if (!appId || !appSecret)
        throw new Error('Globe Labs OAuth credentials not configured');
    const res = await fetchWithTimeout('https://developer.globelabs.com.ph/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: appId,
            client_secret: appSecret,
        }),
    });
    if (!res.ok)
        throw new Error(`Globe Labs OAuth failed: ${res.status.toString()}`);
    const raw = (await res.json());
    if (typeof raw.access_token !== 'string' ||
        typeof raw.expires_in !== 'number' ||
        !Number.isFinite(raw.expires_in)) {
        throw new SmsProviderRetryableError('Globe Labs OAuth returned malformed response', 'provider_error');
    }
    const token = {
        accessToken: raw.access_token,
        expiresAt: Date.now() + raw.expires_in * 1000,
        refreshedAt: Date.now(),
    };
    await db.collection('sms_provider_tokens').doc('globelabs').set(token, { merge: true });
    return token.accessToken;
}
async function getValidAccessToken(db, forceRefresh = false) {
    if (!forceRefresh) {
        const ref = db.collection('sms_provider_tokens').doc('globelabs');
        const snap = await ref.get();
        if (snap.exists) {
            const cached = snap.data();
            if (Date.now() < cached.expiresAt - 60_000) {
                return cached.accessToken;
            }
        }
    }
    // Mutex: if another call in this process is already refreshing, wait for it
    if (refreshMutex)
        return refreshMutex;
    refreshMutex = fetchAndCacheToken(db);
    try {
        return await refreshMutex;
    }
    finally {
        refreshMutex = null;
    }
}
export function createGlobelabsSmsProvider(deps = {}) {
    const getDb = deps.getFirestore ?? realGetFirestore;
    return {
        providerId: 'globelabs',
        async send(input) {
            const shortCode = process.env.GLOBE_LABS_SHORT_CODE ?? '2158';
            const db = getDb();
            const token = await getValidAccessToken(db);
            const payload = {
                outboundSMSMessageRequest: {
                    clientCorrelator: input.idempotencyKey ?? crypto.randomUUID(),
                    senderAddress: shortCode,
                    outboundSMSTextMessage: { message: input.body },
                    address: normalizeMsisdn(input.to),
                },
            };
            const baseUrl = `https://devapi.globelabs.com.ph/smsmessaging/v1/outbound/${shortCode}/requests`;
            const startMs = Date.now();
            let res = await fetchWithTimeout(`${baseUrl}?access_token=${token}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            // Token expired — force refresh and retry once
            if (res.status === 401) {
                const freshToken = await getValidAccessToken(db, true);
                res = await fetchWithTimeout(`${baseUrl}?access_token=${freshToken}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });
            }
            const latencyMs = Date.now() - startMs;
            if (!res.ok) {
                throw new SmsProviderRetryableError(`globelabs ${res.status.toString()}`, res.status === 429 ? 'rate_limited' : 'provider_error');
            }
            const data = (await res.json());
            const req = data.outboundSMSMessageRequest;
            return {
                accepted: true,
                // eslint-disable-next-line @typescript-eslint/no-base-to-string
                providerMessageId: String(req?.resourceURL ?? 'unknown'),
                latencyMs,
                segmentCount: input.segmentCount ?? 1,
                encoding: input.encoding,
            };
        },
    };
}
//# sourceMappingURL=globelabs.js.map