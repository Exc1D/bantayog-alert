# Phase 4 SMS Providers — Implementation Design

**Date:** 2026-04-22
**Status:** Approved — incorporates adversarial review fixes
**Companion docs:** Arch Spec §3, Phase 4a design (2026-04-19)

---

## 1. Context

Both `semaphore.ts` and `globelabs.ts` are stubs that throw `SmsProviderNotImplementedError`. All SMS outbound currently routes through `fake.ts`.

**Known constraints from research:**

- **Semaphore:** API key auth via query param, endpoint `POST /messages/send`, supports priority OTP route (`/otp/send`)
- **Globe Labs:** OAuth 2.0 access token auth — the key in `.env` (`b87b1...`) is a 64-char hex string, NOT a valid OAuth token. Need `{ app_id, app_secret }` from developer portal. Until real credentials exist, Globe Labs remains a stub.
- **Priority routing:** `priority: 'urgent' | 'normal'` field needed on `SmsProviderSendInput`

**Adversarial review fixes incorporated:** MSISDN normalization bug, priority field missing, OAuth cache thread-safety, token refresh race condition, Semaphore zero-credit silent failure, body hash vs body bug, exponential backoff, sender name error mapping, idempotency key wired to Globe Labs.

---

## 2. MSISDN Normalization Fix (Pre-existing Bug)

**File:** `packages/shared-validators/src/msisdn.ts`

Current `normalizeMsisdn` only accepts `09XXXXXXXX` and `+639XXXXXXXX`. It throws on `639XXXXXXXX` (no leading zero). Fix to accept all three formats and normalize to `639XXXXXXXX`.

```typescript
export function normalizeMsisdn(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('0')) {
    return '63' + digits.slice(1)
  }
  if (digits.length === 10 && digits.startsWith('9')) {
    return '63' + digits
  }
  if (digits.length === 12 && digits.startsWith('63')) {
    return digits
  }
  throw new Error(`Unrecognized MSISDN format: ${raw}`)
}
```

---

## 3. Outbox Schema Fix — Store Body, Not Hash (Pre-existing Bug)

**File:** `packages/shared-validators/src/sms.ts`

The `smsOutboxDocSchema` stores `bodyPreviewHash` but the provider API needs the actual `body`. Store the encrypted body (not the hash).

**File:** `functions/src/services/dispatch-sms-outbox.ts`

Fix `buildEnqueueSmsPayload` to include `body: encryptedBody` alongside `bodyPreviewHash`. Provider `send()` reads from `body`.

---

## 4. Semaphore Implementation

### 4.1 API Shape

```
POST https://api.semaphore.co/messages/send?apiKey=<key>
Body: { number: "639171234567", message: "...", sendername: "BANTAYOG" }
Success 200: { message_id: number, status: "Queued" | "Error", network: "Globe" }
Error 4xx/5xx: { errors: [{ error: "string" }] }
```

**Critical:** Semaphore returns `200 OK` even on credit exhaustion, with `status: "Error"` in the body. Must parse body for explicit errors.

### 4.2 Implementation

**File:** `functions/src/services/sms-providers/semaphore.ts`

```typescript
export function createSemaphoreSmsProvider(): SmsProvider {
  return {
    providerId: 'semaphore',
    async send(input: SmsProviderSendInput): Promise<SmsProviderSendResult> {
      const apiKey = process.env.SEMAPHORE_API_KEY
      if (!apiKey) throw new Error('SEMAPHORE_API_KEY not set')

      const endpoint =
        input.priority === 'urgent'
          ? 'https://api.semaphore.co/otp/send'
          : 'https://api.semaphore.co/messages/send'

      const params = new URLSearchParams({
        apiKey,
        number: normalizeMsisdn(input.to),
        message: input.body,
        sendername: process.env.SMS_SENDER_NAME ?? 'SEMAPHORE',
      })

      const res = await fetch(`${endpoint}?${params}`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))

      // Semaphore returns 200 even on credit failure — check body status
      const entry = Array.isArray(data) ? data[0] : data
      if (entry.status === 'Error' || entry.errors?.length) {
        const msg = entry.errors?.[0]?.error ?? entry.message ?? 'unknown'
        // Credit exhaustion = non-retryable (account-level problem)
        const nonRetryable = /credit|insufficient|balance/i.test(msg)
        return {
          accepted: false,
          providerMessageId: String(entry.message_id ?? ''),
          latencyMs: 0,
          reason: nonRetryable ? 'provider_limit' : 'other',
        }
      }

      if (!res.ok) {
        const retryable = res.status >= 500 || res.status === 429
        if (retryable) {
          throw new SmsProviderRetryableError(
            `semaphore ${res.status}: ${data.errors?.[0]?.error ?? res.statusText}`,
            res.status === 429 ? 'rate_limited' : 'provider_error',
          )
        }
        // 400 bad format — e.g. unapproved sender name
        if (res.status === 400 && /sender/i.test(data.errors?.[0]?.error ?? '')) {
          return {
            accepted: false,
            reason: 'bad_format',
            providerMessageId: undefined,
            latencyMs: 0,
          }
        }
        return { accepted: false, reason: 'other', providerMessageId: undefined, latencyMs: 0 }
      }

      return {
        accepted: entry.status === 'Queued',
        providerMessageId: String(entry.message_id),
        latencyMs: 0,
        segmentCount: input.segmentCount ?? 1,
        encoding: input.encoding,
      }
    },
  }
}
```

### 4.3 Notes

- Normalize MSISDN before sending (accepts `09XXXXXXXX`, `+639XXXXXXXX`, `639XXXXXXXX`)
- `SMS_SENDER_NAME` defaults to `SEMAPHORE` until `BANTAYOG` is approved
- 401 from Semaphore = bad API key = non-retryable; throw immediately
- 500/429 = retryable via `SmsProviderRetryableError`

---

## 5. Globe Labs Implementation

### 5.1 Auth Problem

Globe Labs SMS API uses OAuth 2.0. The existing `GLOBE_LABS_API_KEY` in `.env` is wrong format. Implement OAuth flow gated behind `GLOBE_LABS_APP_ID` + `GLOBE_LABS_APP_SECRET`. Until those are available, `resolveProvider('globelabs')` returns the stub.

### 5.2 Token Management — Distributed Cache via Firestore

Cloud Functions v2 runs multiple instances. In-memory cache is per-instance. Use Firestore as shared token cache:

```typescript
interface CachedToken {
  accessToken: string
  expiresAt: number // epoch ms
  refreshedAt: number
}

let refreshMutex: Promise<string> | null = null

async function getValidAccessToken(db: Firestore): Promise<string> {
  const ref = db.collection('sms_provider_tokens').doc('globelabs')
  const snap = await ref.get()

  if (snap.exists) {
    const cached: CachedToken = snap.data() as CachedToken
    if (Date.now() < cached.expiresAt - 60_000) {
      return cached.accessToken
    }
  }

  // Mutex: if another call in this process is already refreshing, wait for it
  // Note: this only deduplicates within a single process — not cross-instance
  if (refreshMutex) return refreshMutex

  refreshMutex = fetchAndCacheToken(db)
  try {
    return await refreshMutex
  } finally {
    refreshMutex = null
  }
}

async function fetchAndCacheToken(db: Firestore): Promise<string> {
  const appId = process.env.GLOBE_LABS_APP_ID
  const appSecret = process.env.GLOBE_LABS_APP_SECRET
  if (!appId || !appSecret) throw new Error('Globe Labs OAuth credentials not configured')

  const res = await fetch('https://developer.globelabs.com.ph/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: appId,
      client_secret: appSecret,
    }),
  })

  if (!res.ok) throw new Error(`Globe Labs OAuth failed: ${res.status}`)
  const data = await res.json()

  const token: CachedToken = {
    accessToken: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
    refreshedAt: Date.now(),
  }

  await db.collection('sms_provider_tokens').doc('globelabs').set(token, { merge: true })
  return token.accessToken
}
```

**Mutex pattern:** `refreshMutex` is a module-level `Promise | null`. Only one caller within the same process enters the refresh path; others `await` the same promise. This does **not** provide cross-instance protection — each Cloud Function instance has its own mutex.

### 5.3 Send Implementation

**File:** `functions/src/services/sms-providers/globelabs.ts`

```
POST https://devapi.globelabs.com.ph/smsmessaging/v1/outbound/{shortCode}/requests?access_token=<token>
Body: { outboundSMSMessageRequest: { clientCorrelator, senderAddress, outboundSMSTextMessage: { message }, address } }
```

```typescript
export function createGlobelabsSmsProvider(): SmsProvider {
  return {
    providerId: 'globelabs',
    async send(input: SmsProviderSendInput): Promise<SmsProviderSendResult> {
      const shortCode = process.env.GLOBE_LABS_SHORT_CODE ?? '2158'
      const db = getFirestore()
      const token = await getValidAccessToken(db)
      const url = `https://devapi.globelabs.com.ph/smsmessaging/v1/outbound/${shortCode}/requests?access_token=${token}`

      const payload = {
        outboundSMSMessageRequest: {
          clientCorrelator: input.idempotencyKey ?? crypto.randomUUID(),
          senderAddress: shortCode,
          outboundSMSTextMessage: { message: input.body },
          address: normalizeMsisdn(input.to),
        },
      }

      let res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      // Token expired — refresh and retry once
      if (res.status === 401) {
        const freshToken = await getValidAccessToken(db)
        const retryUrl = url.replace(/access_token=[^&]+/, `access_token=${freshToken}`)
        res = await fetch(retryUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      }

      if (!res.ok) {
        throw new SmsProviderRetryableError(
          `globelabs ${res.status}`,
          res.status === 429 ? 'rate_limited' : 'provider_error',
        )
      }

      const data = await res.json()
      return {
        accepted: true,
        providerMessageId: data.outboundSMSMessageRequest?.resourceURL ?? 'unknown',
        latencyMs: 0,
        segmentCount: input.segmentCount ?? 1,
        encoding: input.encoding,
      }
    },
  }
}
```

### 5.4 Notes

- `idempotencyKey` from outbox doc → `clientCorrelator` for Globe Labs API deduplication
- MSISDN normalized before sending
- 401 triggers token refresh and one retry; mutex prevents stampede

---

## 6. Priority Routing

**File:** `functions/src/services/sms-provider.ts`

Add `priority?: 'urgent' | 'normal'` to `SmsProviderSendInput`:

```typescript
export interface SmsProviderSendInput {
  to: string
  body: string
  encoding: SmsEncoding
  priority?: 'urgent' | 'normal'
  idempotencyKey?: string
}
```

Semaphore: urgent → `/otp/send` (no rate limit, 2x credits). Globe Labs: `priority` field ignored.

**File:** `functions/src/services/dispatch-sms-outbox.ts`

Thread `priority` from the call site through to `provider.send()`.

---

## 7. Env Vars

### `.env.example` (committed, no secrets)

```
SEMAPHORE_API_KEY="your_semaphore_api_key_here"
SMS_SENDER_NAME="BANTAYOG"
SMS_PROVIDER_MODE="real"
```

Note: `GLOBE_LABS_API_KEY` in `.env` is the wrong format — do not use it. Globe Labs OAuth requires `GLOBE_LABS_APP_ID` and `GLOBE_LABS_APP_SECRET` from the developer portal. Leave Globe Labs as stub until OAuth credentials are available.

### `.env.local.example` (new, not committed)

```
# Copy to .env.local for development with real providers
SMS_PROVIDER_MODE=real
SMS_SENDER_NAME=BANTAYOG
GLOBE_LABS_APP_ID=your_app_id_here
GLOBE_LABS_APP_SECRET=your_app_secret_here
GLOBE_LABS_SHORT_CODE=2158
```

---

## 8. Files to Change

| File                                                      | Change                                                                                               |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `packages/shared-validators/src/msisdn.ts`                | Fix `normalizeMsisdn` to accept `639XXXXXXXX`                                                        |
| `packages/shared-validators/src/sms.ts`                   | Add `body` field to `smsOutboxDocSchema` (alongside `bodyPreviewHash`)                               |
| `functions/src/services/sms-provider.ts`                  | Add `priority?: 'urgent' \| 'normal'` and `idempotencyKey?: string` to `SmsProviderSendInput`        |
| `functions/src/services/sms-providers/semaphore.ts`       | Replace stub with real fetch; parse body for zero-credit errors; normalize MSISDN                    |
| `functions/src/services/sms-providers/globelabs.ts`       | Replace stub with OAuth + fetch; Firestore token cache with mutex; idempotencyKey → clientCorrelator |
| `functions/src/services/dispatch-sms-outbox.ts`           | Normalize MSISDN at enqueue; store actual body; thread priority through                              |
| `functions/src/services/sms-providers/factory.ts`         | Remove `process.env` mutation                                                                        |
| `.env`                                                    | Add `SMS_SENDER_NAME=BANTAYOG`, note about Globe Labs OAuth                                          |
| `.env.local.example`                                      | New file documenting required vars                                                                   |
| `functions/src/__tests__/sms-providers/semaphore.test.ts` | New — mock fetch tests                                                                               |
| `functions/src/__tests__/sms-providers/globelabs.test.ts` | New — mock fetch + OAuth tests                                                                       |

---

## 9. Testing Strategy

**Unit tests** (mock HTTP with nock or fetch mocking):

- Semaphore: success, 401 bad key, 400 bad sender, 429 rate limit, 500 server error, zero-credit body error, OTP urgent route
- Globe Labs: success, 401 token expiry + refresh, OAuth failure, send failure
- Token mutex: concurrent requests only refresh once

**Acceptance tests** continue to use `SMS_PROVIDER_MODE=fake` via `firebase emulators:exec`.

---

## 10. Out of Scope

- Globe Labs OAuth if credentials unavailable (Semaphore-only deploy is valid; Globe Labs stays stub)
- Sender ID approval (tracked in Arch Spec §13.11 pre-prod checklist)
- Priority routing UI (Phase 5+)
- Cost tracking / credit monitoring dashboard
