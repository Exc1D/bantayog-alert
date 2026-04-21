# Phase 4a — Outbound SMS Design

**Date:** 2026-04-19
**Branch (to be created):** `feature/phase-4a-outbound-sms`
**Status:** Design — awaiting user review before implementation plan

---

## 1. Scope and context

Phase 4 in the implementation plan (`prd/bantayog-alert-implementation-plan-v1.0.md` §Phase 4) bundles four loosely-coupled subsystems: SMS layer (inbound + outbound), command channels, coordination threads, and hazard zones. That scope is too broad for one spec; Phase 4 is decomposed into 4a/4b/4c/4d. This spec covers **4a — Outbound SMS only**.

**In scope for 4a:**

- Outbound SMS dispatch pipeline (enqueue → provider send → delivery receipt).
- Four citizen-facing purposes wired from existing Phase 3 flows:
  - `receipt_ack` — from `processInboxItem` trigger on successful materialization.
  - `verification` — from `verifyReport` callable on `awaiting_verify → verified`.
  - `status_update` — from `dispatchResponder` callable on dispatch creation.
  - `resolution` — from `closeReport` callable on terminal close.
- Circuit-breaker provider selection (Semaphore primary, Globe Labs secondary, fake for dev/CI).
- Delivery-report webhook (provider → Cloud Function) with shared-secret auth.
- Citizen PWA phone + consent capture (new form fields; previously unimplemented).
- Fake provider for emulator + CI; real provider adapters scaffolded as `NotImplemented` behind env flag.

**Out of scope (deferred):**

- Inbound SMS (parsing, session management, reply routing) — Phase 4b.
- Agency command channels / coordination threads — Phase 4c.
- Hazard zones — Phase 4d.
- Real Semaphore / Globe Labs credentials + sender-ID approval — Phase 4b or ops task.
- Admin SMS history panel — Phase 5.
- Templates stored in Firestore with CMS — Phase 5 (hard-coded in shared-validators for 4a).

**Pilot blockers addressed:** #8 (outbound SMS to reporters), #9 (status SMS for dispatched reports), #12 (citizen consent capture for SMS), #30 (provider abstraction + failover).

---

## 2. Architecture

### 2.1 High-level flow

```
┌─────────────────┐     ┌──────────────────────┐     ┌─────────────────┐
│ Trigger source  │────▶│ enqueueSms(tx, ...)  │────▶│ sms_outbox doc  │
│ (Phase 3 code)  │     │ (in same txn)        │     │ status=queued   │
└─────────────────┘     └──────────────────────┘     └────────┬────────┘
                                                              │
                                           onDocumentWritten  │
                                                              ▼
                                    ┌─────────────────────────────────────┐
                                    │ dispatchSmsOutbox                    │
                                    │  1. guard: isCreate || isRetry       │
                                    │  2. pickProvider() via circuit state │
                                    │  3. providerFake|Semaphore|GlobeLabs │
                                    │  4. update status sent|failed|defer  │
                                    │  5. incrementMinuteWindow(outcome)   │
                                    └──────┬────────────────────────┬──────┘
                                           │ on send success        │ on failure
                                           ▼                        ▼
                                    status=sent              status=failed|deferred
                                    (awaits DLR)             (retry or terminal)

┌──────────────────────┐  webhook with       ┌──────────────────────────┐
│ SMS provider (real)  │──X-Sms-Provider─────▶│ smsDeliveryReport (HTTP) │
└──────────────────────┘  Secret header      │  verify secret           │
                                             │  update outbox status     │
                                             │  clear plaintext msisdn   │
                                             └──────────────────────────┘

┌─────────────────────────────────┐  every 1m  ┌───────────────────────────────┐
│ evaluateSmsProviderHealth       │───read────▶│ sms_provider_health +          │
│  reads last N minute windows    │   write   │  sms_provider_health/          │
│  computes error rate + latency  │           │    {id}/minute_windows/{ts}    │
│  updates circuitState           │           └───────────────────────────────┘
└─────────────────────────────────┘

┌────────────────────────────────────┐  every 10m
│ reconcileSmsDeliveryStatus         │───▶ scans sms_outbox where
│  finds orphans (status=queued &    │      status='queued' AND
│   queuedAt < now - 30m)            │      queuedAt < threshold
│  marks them abandoned              │
│  picks up deferred rows for retry  │───▶ CAS deferred → queued
└────────────────────────────────────┘

┌────────────────────────────────────┐  every 1h
│ cleanupSmsMinuteWindows            │───▶ paginated delete of minute
│  cursor-based batch delete         │      windows older than 1h
└────────────────────────────────────┘
```

### 2.2 Pattern lineage

This mirrors the existing `report_inbox` → `processInboxItem` pattern from Phase 3a:

- **Outbox-then-trigger.** Phase 3 callables write a source document inside a Firestore transaction; a `onDocumentWritten` trigger materializes downstream state. Phase 4a's `enqueueSms` writes an `sms_outbox` document in the same transaction as the report/dispatch mutation. `dispatchSmsOutbox` handles the send asynchronously.
- **Idempotency via `withIdempotency`.** Existing helper in `packages/shared-validators/src/idempotency.ts`. Every enqueue carries an idempotency key derived from `{reportId, purpose}` for most purposes, or `{dispatchId, purpose}` for status_update.
- **No direct provider call from a callable.** Callables never block on SMS. A provider outage must never bubble up as a user-facing error.

### 2.3 Key architectural decisions

| Decision                                                              | Rationale                                                                                                                                                                               |
| --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Single `onDocumentWritten` handler, not `onCreate` + `onUpdate`       | Retry sets `status: deferred → queued`; a separate `onCreate` won't fire for that transition. One handler with `isCreate \|\| isRetry` guard avoids double-send races.                  |
| Minute-window subcollection under each provider health doc            | Per-provider, per-minute counter shards. Single health doc `updatedAt` writes are capped to ~1 req/s by Firestore; surge of 500 sends/min would contend on one doc. Shard per minute.   |
| Plaintext msisdn stored alongside hash on outbox, cleared on terminal | Providers need plaintext to send. Admin audit needs the hash for lookup. Keep both until status ∈ {sent→delivered, failed, abandoned}, then clear plaintext.                            |
| Circuit state persisted on provider health doc, not in-memory         | Cloud Function instances are ephemeral. Cold starts must not reset the breaker.                                                                                                         |
| Webhook shared-secret via `X-Sms-Provider-Secret` header              | Providers differ on HMAC schemes. Shared secret in Secret Manager + constant-time compare keeps adapters simple. Revocation is a redeploy, which is acceptable for this traffic volume. |
| Predicted + actual segment count stored on outbox                     | Lets monitoring catch mis-predictions (GSM-7 vs UCS-2 misclassification) and catch providers that segment differently than our detector.                                                |

---

## 3. Components

### 3.1 New files

#### Shared validators (`packages/shared-validators/`)

- **`src/sms-encoding.ts`** — `detectEncoding(body: string): { encoding: 'GSM-7' | 'UCS-2', segmentCount: number }`. GSM-7 charset test against the 128-char GSM default alphabet + basic-extension table; characters outside both → UCS-2. Segment count: 160 chars (GSM-7) or 70 chars (UCS-2) for single; 153 / 67 for concatenated.
- **`src/sms-templates.ts`** — 4 template pairs keyed by `{ purpose, locale }`:
  - `receipt_ack.tl`, `receipt_ack.en`
  - `verification.tl`, `verification.en`
  - `status_update.tl`, `status_update.en`
  - `resolution.tl`, `resolution.en`
  - All templates include `{publicRef}` placeholder. `renderTemplate(purpose, locale, vars): string`.
  - File header: `// TODO(phase-5): move template bodies to Firestore for CMS-driven editing.`
- **`src/msisdn.ts`** — PH-only regex `/^(\+63|0)9\d{9}$/`. `normalizeMsisdn(input: string): string` returns `+63XXXXXXXXXX` or throws `MSISDN_INVALID`. `hashMsisdn(msisdn: string, salt: string): string` returns `sha256(salt + msisdn).hex()`.
- **`src/sms.ts`** (rewrite — treat as breaking schema change; no production data exists yet so no migration). The existing `smsOutboxDocSchema` and `smsProviderHealthDocSchema` are bumped from `schemaVersion: 1` to `schemaVersion: 2`. Any writer that produces `schemaVersion: 1` in 4a is a bug — CI will enforce this via rule coverage + Zod parse in the dispatcher.

  **`smsProviderIdSchema`** — unchanged. Keep `z.enum(['semaphore', 'globelabs'])` (no underscore). The `fake` provider id is a _runtime_ injection only and must not be persisted; at the Zod layer, `smsProviderIdSchema` stays restricted to real providers. The `SmsProvider.providerId` TypeScript type in functions code is `'semaphore' | 'globelabs' | 'fake'` but docs written to Firestore carry only the real ids.

  **`smsOutboxDocSchema` delta (schemaVersion 1 → 2):**
  - **Add (required):** `predictedEncoding: 'GSM-7' | 'UCS-2'`, `predictedSegmentCount: number.int().positive()`, `recipientMsisdn: string` _(plaintext, cleared to `null` on terminal — modeled as `string | null`)_, `retryCount: number.int().nonnegative()`, `locale: 'tl' | 'en'`, `queuedAt: number.int()`.
  - **Add (optional):** `terminalReason?: 'rejected' | 'client_err' | 'orphan' | 'abandoned_after_retries' | 'dlr_failed'`, `deferralReason?: 'rate_limited' | 'provider_error' | 'network'`, `failedAt?: number.int()`, `abandonedAt?: number.int()`.
  - **Change (required → optional):** `encoding` and `segmentCount` become optional — they are provider-authoritative values set only after a successful `send()`. Use `predictedEncoding`/`predictedSegmentCount` for enqueue-time values.
  - **Change (enum widened):** `status` enum becomes `'queued' | 'sending' | 'sent' | 'delivered' | 'failed' | 'deferred' | 'abandoned'`. `'undelivered'` is removed (merged into `failed`).
  - **Change:** `statusReason` kept for backward-compatible free-form notes but new writers populate `terminalReason`/`deferralReason` instead; `statusReason` is optional and unused by 4a.
  - **Unchanged:** `providerId`, `recipientMsisdnHash`, `purpose`, `bodyPreviewHash`, `providerMessageId?`, `reportId?`, `idempotencyKey`, `createdAt`, `sentAt?`, `deliveredAt?`.

  **`smsProviderHealthDocSchema` delta (schemaVersion 1 → 2):**
  - **Add (optional):** `openedAt?: number.int()`, `lastProbeAt?: number.int()`, `lastTransitionReason?: string.max(200)`.
  - **Unchanged:** `providerId`, `circuitState` _(already present)_, `errorRatePct`, `lastErrorAt?`, `updatedAt`.
  - **Remove:** nothing. All existing fields retained.

  **`smsMinuteWindowDocSchema` (new subcollection schema):**
  - `.strict()` object: `providerId: smsProviderIdSchema`, `windowStartMs: number.int()` (ms at start of minute, derived from doc id), `attempts: number.int().nonnegative()`, `failures: number.int().nonnegative()`, `rateLimitedCount: number.int().nonnegative()`, `latencySumMs: number.int().nonnegative()`, `maxLatencyMs: number.int().nonnegative()`, `updatedAt: number.int()`, `schemaVersion: z.literal(1)`.
  - Doc id is `YYYYMMDDHHMM` (UTC) — lexicographically sortable. Stored at `sms_provider_health/{providerId}/minute_windows/{YYYYMMDDHHMM}`.

  **`contact` schema (added to `reportInboxPayloadSchema` in `reports.ts`, not `sms.ts`, but noted here for cross-reference):**

  ```typescript
  contact: z.object({
    phone: msisdnPhSchema, // normalized +63 form
    smsConsent: z.literal(true), // literal true, not boolean — absence of consent = absence of contact
  })
    .strict()
    .optional()
  ```

  This enforces at the Zod layer that "phone present implies consent=true" — a payload with `phone` and `smsConsent: false` fails validation. Callers who lack consent must omit the `contact` object entirely.

#### Functions (`functions/src/`)

- **`services/sms-provider.ts`** — canonical interface. On success, `encoding` and `segmentCount` are authoritative. On a rejected-but-returned response (`accepted: false`), they may be omitted; the dispatcher falls back to predicted values for auditing. On a thrown error (network, 5xx, 429), the caller never sees the return object at all.

  ```typescript
  export interface SmsProviderSendSuccess {
    accepted: true
    providerMessageId: string
    latencyMs: number
    segmentCount: number // authoritative
    encoding: 'GSM-7' | 'UCS-2' // authoritative
  }

  export interface SmsProviderSendRejected {
    accepted: false
    providerMessageId?: string // some providers echo even on reject
    latencyMs: number
    reason: 'invalid_number' | 'ban' | 'bad_format' | 'other'
    segmentCount?: number // optional — provider may not have segmented yet
    encoding?: 'GSM-7' | 'UCS-2' // optional
  }

  export type SmsProviderSendResult = SmsProviderSendSuccess | SmsProviderSendRejected

  export interface SmsProvider {
    readonly providerId: 'semaphore' | 'globelabs' | 'fake'
    send(input: {
      to: string // +63 normalized
      body: string
      encoding: 'GSM-7' | 'UCS-2'
    }): Promise<SmsProviderSendResult> // throws on retryable errors
  }
  ```

  **Provider adapter state in 4a:**
  - `fake.ts` — fully implemented, callable. Can impersonate any real providerId via `FAKE_SMS_IMPERSONATE='semaphore' | 'globelabs'` so that an outbox doc written in 4a carries a real providerId (`semaphore` or `globelabs`) even though the fake backend served it. This keeps the persisted provider id aligned with `smsProviderIdSchema`.
  - `semaphore.ts` — stub that throws `NotImplementedError`. Wired into DI only when `SMS_PROVIDER_MODE='real'`.
  - `globelabs.ts` — **also a stub in 4a** throwing `NotImplementedError`. Not used in 4a because Phase 4a ships with `SMS_PROVIDER_MODE='fake'` only; the real-provider rollout is blocked on Phase 4b + credentials.
  - **Failover path is validated via the fake.** Because the fake can impersonate either providerId and `FAKE_SMS_FAIL_PROVIDER` gates which impersonation rejects, end-to-end failover (`semaphore` open → `globelabs` closed → route there) is exercised against the fake in 4a. The real Semaphore ↔ Globe Labs failover is validated in the Phase 4b rollout against real credentials.

  Fake provider honors env flags:
  - `FAKE_SMS_LATENCY_MS` — sleep before returning.
  - `FAKE_SMS_ERROR_RATE` — 0.0..1.0, random reject (resolves with `accepted: false`).
  - `FAKE_SMS_FAIL_PROVIDER` — `'semaphore' | 'globelabs' | ''` — throw a retryable-network error when asked to impersonate this provider. Lets tests trip the breaker on a specific providerId without touching the other.
  - `FAKE_SMS_IMPERSONATE` — `'semaphore' | 'globelabs'` — which real providerId the fake claims to be when building the outbox record.

- **`services/sms-health.ts`** —
  - `readCircuitState(providerId): Promise<CircuitStateDoc>`.
  - `pickProvider(): Promise<'semaphore' | 'globelabs'>` — reads both health docs, returns `semaphore` if closed, else `globelabs` if closed, else falls back to whichever is `half_open`, else throws `NO_PROVIDER_AVAILABLE` (both open — caller should defer). **Does not return `'fake'`.** Selection is always a real providerId; whether a real or fake adapter serves it is a DI-layer decision controlled by `SMS_PROVIDER_MODE`.
  - `incrementMinuteWindow(providerId, outcome: { success: boolean, rateLimited: boolean, latencyMs: number }): Promise<void>` — writes/merges into `sms_provider_health/{providerId}/minute_windows/{YYYYMMDDHHMM}`.

- **`services/send-sms.ts`** —
  - `enqueueSms(tx: Transaction, args: { reportId, purpose, recipientMsisdn, locale: 'tl' | 'en', templateVars }): void` — writes the outbox doc with predicted encoding/segments + both plaintext and hash msisdn. Idempotency key derived from `{reportId|dispatchId, purpose}`; duplicate enqueue returns existing doc.
  - **Locale derivation** (caller responsibility, not `enqueueSms` itself): locale is derived from `municipality.config.defaultSmsLocale` on the report's municipality document, defaulting to `'tl'` (Tagalog) when unset. Phase 4a does not capture a user-level locale preference; that is deferred to Phase 5. Callers pass the resolved locale into `enqueueSms` explicitly.

- **`triggers/dispatch-sms-outbox.ts`** — `onDocumentWritten('sms_outbox/{id}', ...)`:
  1. Guard: proceed only if `isCreate || (previousStatus === 'deferred' && currentStatus === 'queued')`. Otherwise no-op.
  2. Unified CAS: run Firestore transaction — re-read doc, confirm `status === 'queued'`, set `status='sending'`. On conflict (another invocation won the CAS), exit. This guard also catches at-least-once replays of `isCreate` invocations.
  3. `pickProvider()` → `provider.send(...)`. If `pickProvider()` throws `NO_PROVIDER_AVAILABLE`, treat as retryable-defer (§step 6) with `deferralReason='provider_error'`.
  4. On `accepted: true`: update `status='sent'`, set `sentAt`, `providerMessageId`, actual `encoding`, actual `segmentCount`. `incrementMinuteWindow({success: true, latencyMs})`.
  5. On `accepted: false` (non-retryable): `status='failed'`, `terminalReason` mapped from provider's `reason` field. Set `encoding`/`segmentCount` from provider response if present; otherwise leave them unset (predicted values remain available for audit). `incrementMinuteWindow({success: false, rateLimited: false, latencyMs})`.
  6. On thrown retryable error (network, 5xx, 429): if `retryCount < 3`, `status='deferred'`, increment `retryCount`, set `deferralReason` (`rate_limited` for 429, `provider_error` for 5xx, `network` for connection-level). If `retryCount >= 3`, `status='abandoned'`, `terminalReason='abandoned_after_retries'`, `abandonedAt`. `incrementMinuteWindow({success: false, rateLimited: is429, latencyMs})`.

- **`triggers/evaluate-sms-provider-health.ts`** — scheduled every 1 min:
  - For each provider: read last 5 `minute_windows` docs.
  - Compute `errorRatePct = failures / attempts`, `p95LatencyMs ≈ maxLatencyMs` (approximation without full histogram — acceptable for SoS Phase 4a).
  - Circuit transitions (§4.3 below).
  - Atomic update on provider health doc.

- **`triggers/reconcile-sms-delivery-status.ts`** — scheduled every 10 min:
  - Orphan sweep: query `sms_outbox where status='queued' and queuedAt < now - 30m` → mark `status='abandoned'`, `terminalReason='orphan'`, `abandonedAt=now`.
  - Deferred pickup: query `sms_outbox where status='deferred'` ordered by `updatedAt` asc, limit 100 per tick → transaction CAS `deferred → queued`. **`queuedAt` IS updated to `now` on this transition** (otherwise the orphan sweep would re-flag a just-retried row). `createdAt` is never touched. This re-fires the `onDocumentWritten` trigger.

- **`triggers/cleanup-sms-minute-windows.ts`** — scheduled every 1 hour:
  - For each provider, paginate `minute_windows` collection in batches of 500 keyed by doc ID (`YYYYMMDDHHMM` sortable).
  - Delete docs older than 1h. Cursor-based pagination survives 50k+ docs.

- **`http/sms-delivery-report.ts`** — `onRequest(...)`. **Exported as `smsDeliveryReport` from `functions/src/index.ts`** → Firebase Functions v2 generates the endpoint at `https://<region>-<project>.cloudfunctions.net/smsDeliveryReport` (or, behind the Hosting rewrite declared in `firebase.json`, at `POST /webhooks/sms-delivery-report`). The Hosting rewrite is added in the same PR; providers are configured to POST to the Hosting URL.
  - Verify `X-Sms-Provider-Secret` header constant-time-equals Secret Manager value. Mismatch → 401, structured log `sms.webhook.auth_failed`.
  - Parse body per provider-specific schema (Semaphore / Globe Labs) → normalized `{ providerMessageId, status: 'delivered' | 'failed', reason? }`.
  - Look up outbox by `providerMessageId` (requires index).
  - If found and not terminal: update `status`, set `deliveredAt` or `failedAt`, clear `recipientMsisdn` plaintext.
  - If found and already terminal (including `abandoned`): structured log `sms.webhook.callback_after_terminal`, return 200 no-op. **Do not mutate.**
  - If not found: structured log `sms.webhook.unknown_message`, return 200.

#### Scripts

- **`scripts/phase-4a/acceptance.ts`** — see §5.6.

### 3.2 Files to modify

- **`functions/src/triggers/process-inbox-item.ts`** — after successful materialization, inside same transaction: if payload includes `contact.phone` and `contact.smsConsent === true`, call `enqueueSms(tx, { reportId, purpose: 'receipt_ack', ... })`.
- **`functions/src/callables/verify-report.ts`** — on success branch `awaiting_verify → verified` or `new → verified`, enqueue `verification` (only if reporter had consent).
- **`functions/src/callables/dispatch-responder.ts`** — on dispatch creation, enqueue `status_update`.
- **`functions/src/callables/close-report.ts`** — on terminal close with outcome ∈ {resolved, false_alarm}, enqueue `resolution`.
- **`apps/citizen-pwa/src/components/SubmitReportForm.tsx`** — add phone input (PH-format validated client-side with `msisdn.ts` regex) + consent checkbox. Both optional; form submits without them. If phone present, consent required before submit.
- **`apps/citizen-pwa/src/services/submit-report.ts`** — pass `contact: { phone, smsConsent: true } | undefined` through to `requestUploadUrl` / inbox write. Form validation blocks submission when `phone` is present but consent box is unchecked, so the service layer never sees a `{phone, smsConsent: false}` shape.
- **`packages/shared-validators/src/reports.ts`** — extend `reportInboxPayloadSchema` with optional `contact` object shaped per §3.1: `{ phone: msisdnPhSchema, smsConsent: z.literal(true) }.strict().optional()`.
- **`firestore.rules`** — extend `match /sms_provider_health/{providerId}/minute_windows/{ts}` — callable-only write, admin-only read. Add rule test.
- **`firestore.indexes.json`** — add composite indexes:
  - `sms_outbox` by `providerMessageId ASC` (webhook lookup).
  - `sms_outbox` by `status ASC, queuedAt ASC` (orphan sweep + deferred pickup).
- **`infra/terraform/`** — add Secret Manager entries `sms-msisdn-hash-salt` and `sms-webhook-inbound-secret`. Add log metrics `sms.sent`, `sms.failed`, `sms.abandoned`, `sms.circuit.opened`.

---

## 4. Data flow and error handling

### 4.1 Outbox document lifecycle

```
       ┌────────────┐  send success   ┌──────┐  DLR=delivered  ┌───────────┐
       │  queued    ├────────────────▶│ sent ├────────────────▶│ delivered │
       └────┬───┬───┘                 └───┬──┘  (clear msisdn) └───────────┘
            │   │                         │
            │   │                         │  DLR=failed
            │   │                         └──────────────────▶┌────────┐
            │   │                                             │ failed │
            │   │       send reject (provider rejects         └────────┘
            │   │       non-retryable — ban, bad number)
            │   └──────────────────────────────────────────▶ failed
            │
            │  retryable error
            │  (network, 5xx, 429)
            ▼
       ┌──────────┐                     ┌───────────┐
       │ deferred │◀──retry count < 3───│  retrying │
       └────┬─────┘                     └───────────┘
            │
            │ reconcile picks up (CAS deferred→queued)
            ▼
       ┌────────┐  retry count = 3     ┌───────────┐
       │ queued │─────────────────────▶│ abandoned │
       └────────┘                      └───────────┘

        ┌────────┐ orphan: queued for > 30m
        │ queued ├────────────────────────────▶ abandoned
        └────────┘
```

**Terminal states:** `delivered`, `failed`, `abandoned`. Plaintext `recipientMsisdn` cleared in all three (webhook for delivered/failed, orphan sweep for abandoned).

### 4.2 Circuit-breaker state machine (per provider)

```
          ┌──────────────────────────────────────────┐
          │                                          │
          ▼                                          │
    ┌──────────┐   (a) error rate > 30% in 5m     ┌──┴──────────┐
    │  closed  │─────────────────────────────────▶│   open      │
    └──────────┘   (b) p95 latency > 30s in 5m    └──┬───────────┘
          ▲       (c) rateLimited>=3 & all attempts  │ after 5m
          │                                          │ cooldown
          │        probe success                     ▼
          └──────────────────────────┬──────── ┌──────────────┐
                                     │         │  half_open   │
                                     └─────────┤  (1 probe)   │
                                               └──────┬───────┘
                                                      │ probe failure
                                                      │ → reopen
                                                      ▼
                                                   open
```

Trip conditions (any of):

- (a) `failures / attempts > 0.30` over the last 5 minute windows AND `attempts >= 10`.
- (b) `maxLatencyMs > 30000` in any of the last 5 minute windows.
- (c) `rateLimitedCount >= 3 AND rateLimitedCount === attempts` over the last 5 minute windows — sustained 429s targeting us specifically (every single attempt rate-limited).

**Individual 429s during normal operation** → handled as a per-message retryable defer via §4.3 (`deferred` with `deferralReason='rate_limited'`). Condition (c) fires only when the 429 rate is effectively 100% — the provider is refusing us entirely, which is a circuit-level failure distinct from one transient rate-limit. The two paths are complementary, not contradictory.

Transitions are atomic writes on the provider health doc with `lastTransitionReason` filled in for audit.

### 4.3 Error taxonomy

| Error source                                          | Outbox outcome                             | Retry?        | Logs / metrics                        |
| ----------------------------------------------------- | ------------------------------------------ | ------------- | ------------------------------------- |
| Provider 2xx + `accepted=false` (e.g. invalid number) | `failed`, `terminalReason='rejected'`      | No            | `sms.failed{reason=rejected}`         |
| Provider 4xx non-429 (auth, format)                   | `failed`, `terminalReason='client_err'`    | No            | `sms.failed{reason=client_err}`       |
| Provider 429                                          | `deferred` if <3 retries, else `abandoned` | Yes (backoff) | `sms.rate_limited`                    |
| Provider 5xx / network / timeout                      | `deferred` if <3 retries, else `abandoned` | Yes (backoff) | `sms.provider_error`                  |
| DLR `delivered`                                       | `delivered`, plaintext cleared             | n/a           | `sms.delivered`                       |
| DLR `failed`                                          | `failed`, plaintext cleared                | n/a           | `sms.dlr_failed`                      |
| DLR for abandoned row                                 | no-op, 200                                 | n/a           | `sms.webhook.callback_after_terminal` |
| DLR for unknown message id                            | no-op, 200                                 | n/a           | `sms.webhook.unknown_message`         |
| Webhook bad secret                                    | 401, no mutation                           | n/a           | `sms.webhook.auth_failed`             |
| Orphan (queued > 30m with no send attempt)            | `abandoned`, `terminalReason='orphan'`     | No            | `sms.abandoned{reason=orphan}`        |

### 4.4 Idempotency

- **Outbox enqueue:** `idempotencyKey = sha256(reportId + purpose)` for most purposes; `sha256(dispatchId + purpose)` for `status_update`. Duplicate enqueue returns the existing outbox doc without a second write.
- **Provider send:** `dispatchSmsOutbox` trigger guards against re-entry via CAS on `status: queued → sending`. Idempotency against trigger replays (e.g. Cloud Functions at-least-once) lives here.
- **DLR processing:** webhook skips mutation when the row is already terminal. Duplicate DLRs are safe.

### 4.5 Segment-count monitoring

Every outbox doc carries `predictedSegmentCount` (set at enqueue by `detectEncoding`) and `segmentCount` (set after `provider.send(...)` returns). A Cloud Monitoring metric fires when they disagree; the ratio is a sanity check on our encoding detector.

---

## 5. Testing strategy & acceptance gate

### 5.1 Unit tests — shared-validators

- **`sms-encoding.test.ts`** — golden table of ~20 inputs covering pure ASCII, GSM-extended characters (`~`, `{`, `}`, `|`, `\`, `€`), Tagalog diacritics, emoji, long messages across segment thresholds.
- **`sms-templates.test.ts`** — each template renders without placeholder leak; all required `{vars}` substitute; locale fallback ordering.
- **`msisdn.test.ts`** — accept/reject tables for PH-only: `+639171234567`, `09171234567`, plus invalid formats (non-PH country codes, wrong length, non-numeric).
- **`idempotency.test.ts`** — reuse existing coverage; add sms-specific keys.

### 5.2 Functions unit tests

- **`sms-provider.fake.test.ts`** — fake respects `FAKE_SMS_LATENCY_MS`, `FAKE_SMS_ERROR_RATE`, `FAKE_SMS_FAIL_PROVIDER`; returns valid shape.
- **`sms-health.pickProvider.test.ts`** — matrix of (semaphore state × globelabs state) → expected provider. Includes half_open picks. Asserts `pickProvider()` throws `NO_PROVIDER_AVAILABLE` when both are open.
- **`send-sms.test.ts`** — `enqueueSms` is idempotent across same reportId+purpose; writes correct shape; populates predicted fields.

### 5.3 Integration tests (Firestore emulator)

- **`dispatch-sms-outbox.integration.test.ts`**:
  - Create outbox doc → trigger fires → provider called → status=sent.
  - Retryable failure → status=deferred, retryCount++.
  - Retry CAS wins once (second invocation of same retry is no-op).
  - Minute window counters increment correctly.
- **`evaluate-sms-provider-health.integration.test.ts`**:
  - Seed minute windows crossing error-rate threshold → circuit opens.
  - Seed latency spike → circuit opens with latency reason.
  - Seed 5m cooldown → half_open transition.
  - Probe success in half_open → closes.
  - Probe failure in half_open → reopens.
- **`reconcile-sms-delivery-status.integration.test.ts`**:
  - Orphan (queued > 30m) marked abandoned.
  - Deferred row CAS'd to queued.
  - Terminal rows untouched.
- **`cleanup-sms-minute-windows.integration.test.ts`**:
  - Seed 1200 minute-window docs across 3 providers, run cleanup, confirm cursor paginates all docs older than 1h.
- **`sms-delivery-report.integration.test.ts`**:
  - Valid secret + valid payload for `sent` row → transitions to delivered, clears plaintext.
  - Valid secret + payload for `abandoned` row → 200, no mutation, structured log `sms.webhook.callback_after_terminal` emitted.
  - Invalid secret → 401.
  - Unknown `providerMessageId` → 200 + log.

### 5.4 Rules tests

- Citizen cannot read `sms_outbox`.
- Responder cannot read `sms_outbox`.
- Municipal admin **cannot** read `sms_outbox` directly from client in 4a — all admin reads are deferred to a Phase 5 callable. Rule is `allow read: if false` for all client contexts. Server (admin SDK) reads unrestricted.
- No client can write `sms_outbox`, `sms_provider_health`, or `minute_windows`.
- Phase 3a tests continue to pass (no regression in existing rule coverage).

### 5.5 E2E (Playwright)

- **`citizen-sms-consent.spec.ts`** — submit report with phone + consent → inbox doc carries `contact.smsConsent=true`.
- Submit with phone + consent unchecked → form blocks submission.
- Submit without phone → existing happy path still works.

### 5.6 Acceptance gate (`scripts/phase-4a/acceptance.ts`)

Binary pass/fail. Runs against Firebase emulator (Firestore + Functions + Auth). **All scheduled functions invoked via Firebase Functions test SDK (`wrap()` + `httpsOnRequest`) — no wall-clock waits.**

**Baseline fixture:** `FAKE_SMS_FAIL_PROVIDER=''`, `FAKE_SMS_ERROR_RATE=0`, `FAKE_SMS_LATENCY_MS=10`. Each test's `afterEach` explicitly re-applies these values (never `delete process.env.X`).

1. Bootstrap test users (citizen, muni admin, responder) + test municipality.
2. Citizen submits report with phone + consent.
3. Wait for `processInboxItem` to materialize triptych.
4. Assert `sms_outbox` doc exists with `purpose='receipt_ack'`, `status='queued'`.
5. Invoke `dispatchSmsOutbox` via test SDK (simulated onDocumentWritten). Assert `status='sent'`, `providerMessageId` set.
6. POST fake DLR to `smsDeliveryReport` (wrapped via `httpsOnRequest`) with `status='delivered'`. Assert outbox `status='delivered'` + plaintext cleared.
7. Admin calls `verifyReport` → assert new outbox doc `purpose='verification'`, lifecycle completes.
8. Admin calls `dispatchResponder` → assert new outbox `purpose='status_update'`.
9. Admin calls `closeReport` with outcome='resolved' → assert outbox `purpose='resolution'`.
10. **Failover routing end-to-end.** Both providers start `closed`. Set `FAKE_SMS_FAIL_PROVIDER='semaphore'` and `FAKE_SMS_IMPERSONATE` dynamic (the fake inspects the providerId `pickProvider()` returned and decides whether to throw). Send 15 messages in quick succession, driving Semaphore's minute windows to >30% failure. Invoke `evaluateSmsProviderHealth` via test SDK. Assert `sms_provider_health/semaphore.circuitState='open'` and `sms_provider_health/globelabs.circuitState='closed'`. Enqueue a new message and invoke `dispatchSmsOutbox`. **Assert the outbox doc's `providerId === 'globelabs'` (not `'semaphore'`)** — this verifies `pickProvider()` actually routed to the secondary after the primary tripped, not just that the breaker state updated. Also assert `globelabs` minute windows incremented. `afterEach` restores `FAKE_SMS_FAIL_PROVIDER=''` and resets circuit states to `closed`.
11. Retry scenario: inject one transient failure via env flag; enqueue → first attempt deferred; invoke `reconcileSmsDeliveryStatus` via test SDK; assert CAS `deferred→queued`; next `dispatchSmsOutbox` invocation succeeds.
12. Orphan scenario: seed outbox at `status='queued'` with `queuedAt = now - 31m`. Invoke reconcile. Assert `status='abandoned'`.
13. Callback-after-terminal: seed outbox at `status='abandoned'`. POST valid DLR. Assert 200 + no mutation + `sms.webhook.callback_after_terminal` log line present.
14. Idempotency: enqueue same `{reportId, purpose}` twice. Assert only one outbox doc.
15. No-consent path: submit report without consent. Assert no `receipt_ack` outbox doc.

Every test isolates state via emulator reset + uses its own idempotency keys.

### 5.7 Out-of-scope for tests

- Real Semaphore / Globe Labs contract tests — blocked on credentials.
- Load/throughput testing — pilot traffic is below any relevant ceiling.
- Sender-ID approval flow — operations task, not code.

### 5.8 Coverage expectations

- 90%+ unit coverage on `shared-validators` additions.
- 100% rule-test coverage on new `sms_*` collections + subcollections.
- Zero flaky tests: any test that fails intermittently in CI is a blocker for merge (not a "known flake").
- New test count estimate: ~75 tests → total rises from ~142 to ~215.

---

## 6. Rollout + rollback

- **Dev emulator first.** All tests in §5 must pass on emulator before staging deploy.
- **Staging soak:** deploy functions + hosting. Set `SMS_PROVIDER_MODE='fake'`. Run acceptance script. Soak overnight with health metrics visible.
- **Prod rollout plan (not executed in 4a):** gated on 4b (inbound) + real provider credentials. Phase 4a prod deploy is `SMS_PROVIDER_MODE='fake'` — no user-visible SMS sent. Flip to `'real'` is a separate gated change.
- **Rollback:** `SMS_PROVIDER_MODE='disabled'` short-circuits `enqueueSms` to a no-op (with a log line, `sms.disabled.skipped`). Redeploy with the env flag — no data migration required.

### 6.1 Schema version policy

- `sms_outbox` and `sms_provider_health` bump from `schemaVersion: 1` to `schemaVersion: 2`. No existing documents carry `schemaVersion: 1` in any environment (verified pre-deploy with a Firestore query — if any are found, staging deploy is blocked).
- The Zod schema is a discriminated read: documents are parsed with `.passthrough()`-disabled strict mode, and any doc not at `schemaVersion: 2` surfaces a structured log `sms.schema.version_mismatch` and is skipped by downstream triggers. This is the forward-compatibility marker — if Phase 5 bumps to 3, 4a-era triggers skip those docs gracefully rather than crashing on unknown fields.
- Any future schema change documents its migration in `docs/runbooks/schema-migration.md` alongside the code change.

---

## 7. Open questions deferred to implementation

- Exact Cloud Monitoring metric names + alert thresholds — surface during implementation plan.
- Whether to extract `sms-encoding.ts` into its own npm-like package vs keeping in `shared-validators` — keep in shared-validators for 4a; extract if 4b needs it standalone.
- Whether admin queries on `sms_outbox` should be a callable (likely yes, Phase 5).

---

## 8. References

- `prd/bantayog-alert-implementation-plan-v1.0.md` §Phase 4 — pilot blockers #8, #9, #12, #30.
- `prd/bantayog-alert-architecture-spec-v8.md` §3 — SMS architecture, provider contract, content rules.
- `packages/shared-validators/src/sms.ts` — existing schemas (extended in this phase).
- `functions/src/triggers/process-inbox-item.ts` — pattern reference for outbox-then-trigger.
- `packages/shared-validators/src/idempotency.ts` — `withIdempotency` helper.
- `docs/learnings.md` §Phase 3a — idempotency guard fresh-vs-cached pattern, error code exhaustiveness, functions v2 metric filter quirks.
