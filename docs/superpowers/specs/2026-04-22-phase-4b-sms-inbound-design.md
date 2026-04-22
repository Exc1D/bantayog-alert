# Phase 4b: SMS Inbound Pipeline — Design Specification

**Date:** 2026-04-22
**Status:** Draft — pending user review
**Phase:** 4b of 12
**Based on:** PRD v1.0 §4, Arch Spec v8.0 §3

---

## Overview

Feature-phone citizens can submit emergency reports via SMS keyword `BANTAYOG <TYPE> <BARANGAY>`. The system parses the inbound message, creates a `report_inbox` item, and sends an auto-reply confirmation. Low-confidence parses are flagged `needsReview: true` and appear in the admin triage queue.

**Not in scope:** PWA degraded-mode "Send as SMS" fallback (Phase 4b net-new scope is feature-phone inbound only).

---

## Architecture

```
Globe Labs → POST /smsInbound → sms_inbox/{msgId}  [msisdnHash only; raw MSISDN to Cloud Logging]
                                  ↓ (Firestore onCreate trigger, guard: status === 'received')
                           smsInboundProcessor
                                  ↓
                           report_inbox/{itemId}  [needsReview: true if confidence: 'low']
                                  ↓
                           sendSMS() → auto-reply to citizen
```

**Pattern: thin webhook → triggered processing.** Consistent with Phase 4a (`processInboxItem` trigger pattern).

**Data privacy:** Raw MSISDN is never written to Firestore. Only `msisdnHash` (SHA-256) is stored in `sms_inbox`. Raw MSISDN is emitted to Cloud Logging for operational debugging only. Per Arch Spec §3 and RA 10173.

---

## Components

### 1. `POST /smsInbound` Webhook

**File:** `functions/src/http/sms-inbound.ts`

**Responsibilities:**

- IP allowlist validation against configured Globe Labs IP range **(see §Globe Labs IP Range below)**
- Shared-secret header validation **(header name TBD — verify against Globe Labs API docs before staging; see §Globe Labs Webhook Secrets below)**
- Per-msisdn rate limit check (5/hour, 20/day) using `msisdnHash`
- Write to `sms_inbox/{msgId}` with fields: `msisdnHash`, `rawBody`, `receivedAt`, `status: 'received'`
- Return 200 immediately (fast ack to Globe Labs)

**Raw MSISDN handling:** The raw `from` field from Globe Labs MUST be hashed before any Firestore write. The raw value is emitted to Cloud Logging (`info` level, not structured PII in Firestore). The `from` field on the `sms_inbox` document is the `msisdnHash` only.

**Rate limit silent drop:** When rate limit is exceeded, the webhook returns 200 (same as success) but does NOT write to `sms_inbox`. This prevents an attacker from enumerating system state. Legitimate users who hit the limit receive no auto-reply — this is intentional per Arch Spec §3. Globe Labs may apply its own spam filtering as a separate layer.

**Duplicate delivery:** If Globe Labs retries the webhook (delivery confirmation gap), the `sms_inbox/{msgId}` write is idempotent via document ID. The trigger guard (`status === 'received'`) prevents double-processing if the trigger ever fires on update.

### 2. `smsInboundProcessor` Firestore Trigger

**File:** `functions/src/firestore/sms-inbound-processor.ts`

**Trigger:** `onCreate` document in `sms_inbox` collection

**Guard:** `if (data.status !== 'received') return` — ensures idempotency if trigger ever fires on update

**publicRef for auto-reply:** The auto-reply SMS must include the `publicRef` generated during triptych materialization. `processInboxItemCore` generates this value internally. The trigger needs it for the SMS reply. Two options:

- (A) `processInboxItemCore` returns `publicRef` in its result object → trigger uses it directly
- (B) Trigger reads back the written `report_inbox` doc after `processInboxItemCore` returns to extract `publicRef`

**Option A is preferred** (one fewer round-trip, no read-after-write race). Verify `processInboxItemCore` interface signature before implementing. If it does not currently return `publicRef`, this is an interface change — it should be added so the SMS trigger and any future caller can get the ref without a read-back. The existing web citizen submission path does not need the return value.

**Responsibilities:**

1. Read `sms_inbox/{msgId}`
2. Call `parseInboundSms(rawBody)` from shared parser
3. Build `report_inbox` item from parse result
4. Write `report_inbox/{itemId}` via `processInboxItemCore` — get `publicRef` back from result
5. Update `sms_inbox/{msgId}` with `status: 'processed'`, `processedAt`, `reportItemId`
6. Send auto-reply SMS via `sendSMS(to, body, 'high', 'inbound_confirmation')` — using Phase 4a outbound service with circuit-breaker
7. On parse failure: write `status: 'failed'`, `error`, NO auto-reply sent

### 3. SMS Parser

**File:** `packages/shared-sms-parser/src/inbound.ts` _(net-new in Phase 4b)_

**Exported function:** `parseInboundSms(body: string): ParseResult`

```typescript
type Confidence = 'high' | 'medium' | 'low'

interface ParseResult {
  confidence: Confidence
  parsed: {
    reportType: 'flood' | 'fire' | 'landslide' | 'accident' | 'medical' | 'other'
    barangay: string // canonical barangay name
    rawBarangay?: string // original text if fuzzy-matched
    details?: string // remaining text after type + barangay
  } | null
  candidates: string[] // barangay candidates if ambiguous
  autoReplyText: string // pre-computed for trigger to send
}

interface UnparsedResult {
  confidence: 'none'
  parsed: null
  candidates: []
  autoReplyText: string // "We received your message. To report..."
}
```

**Parsing rules:**

- Keyword: `BANTAYOG` (case-insensitive, `.trim()` applied first)
- Whitespace normalization: collapse multiple spaces to single space before matching
- Format: `BANTAYOG <TYPE> <BARANGAY>` or `BANTAYOG <TYPE> <BARANGAY> <DETAILS>`
- Type synonyms (case-insensitive): `FLOOD`/`BAHA`, `FIRE`/`SUNOG`, `LANDSLIDE`/`GUHO`, `ACCIDENT`/`AKSIDENTE`, `MEDICAL`/`MEDIKAL`, `OTHER`/`IBA`
- Barangay: fuzzy match against 12-municipality gazetteer; Levenshtein distance ≤ 2; exact match preferred
- On ambiguous barangay: `candidates` filled, `confidence: 'low'`
- On no barangay match: `confidence: 'none'`, unparseable auto-reply text

**Confidence levels:**
| Level | Criteria | `needsReview` |
|-------|----------|---------------|
| `high` | Type AND barangay both matched cleanly | `false` |
| `medium` | Type matched cleanly, barangay fuzzy-matched | `false` |
| `low` | Type fuzzy-matched OR ambiguous barangay candidates | `true` |
| `none` | No parse possible | N/A (not written to report_inbox) |

**Auto-reply text (pre-computed by parser):**
| Confidence | Text |
|------------|-------|
| `high` | "Received. Ref: {publicRef}. MDRRMO reviewing." |
| `medium` | "Received, Ref: {publicRef}. Our team may contact you for details." |
| `low` | "Received. Ref: {publicRef}. Our team reviewing your report." |
| `none` | "We received your message. To report an emergency, text: BANTAYOG <TYPE> <BARANGAY>. Types: FLOOD, FIRE, ACCIDENT, MEDICAL, LANDSLIDE, OTHER." |

### 4. `report_inbox` Item Shape (SMS-originated)

```typescript
{
  source: 'sms',
  sourceMsgId: string,           // links to sms_inbox/{msgId}

  // common fields
  reportType: ReportType,
  barangay: string,
  rawBarangay?: string,
  requiresLocationFollowUp: true, // SMS has no GPS; always true for SMS-originated

  // Triage queue display: items with requiresLocationFollowUp: true and no coordinates
  // appear with a "Location needed" indicator in the admin triage queue.
  // Admin UI behavior for this flag is Phase 5 scope; the flag is set here.
  needsReview: boolean,          // true when confidence: 'low'
  confidence: 'high' | 'medium' | 'low',

  // source tracking
  reporterMsisdnHash: string,    // SHA-256 hash (same as sms_inbox.msisdnHash)

  // etc. (follows existing report_inbox schema)
}
```

**Note:** The `report_inbox` item is written by `processInboxItemCore`, which already handles triptych materialization, idempotency, and event logging. The SMS-originated item is distinguished by `source: 'sms'` and the additional SMS-specific fields above.

### 5. Per-msisdn Rate Limiting

**Collection:** `sms_sessions/{msisdnHash}` _(aligns with Arch Spec §5.5 and existing firestore.rules)_

```typescript
{
  hourlyCount: number,      // resets at top of hour
  hourlyWindow: Timestamp,   // start of current hour window
  dailyCount: number,       // resets at midnight
  dailyWindow: Timestamp,   // start of current day window
}
```

**Limits:** 5 per hour, 20 per day. Enforced atomically in the webhook using a Firestore transaction.

**Atomic reset + increment:** When `currentHour > hourlyWindow` (or `currentDate > dailyWindow`), the transaction MUST reset the counter AND increment in the same write — not read-then-write as separate operations. Same pattern for daily. This prevents a race condition where two concurrent requests both see a stale window and each increment past the limit.

**PIN vault (NOT in Phase 4b scope):** Arch Spec §5.5 describes `sms_sessions/{msisdnHash}` as "rate-limit state + tracking-PIN vault." Phase 4b implements only the rate-limit state. The tracking PIN vault (used for citizen status lookup via SMS) is a separate feature added when the outbound status-update SMS path is built.

### 6. Globe Labs Configuration _(runtime — filled before staging)_

**IP Range:** Stored in Secret Manager as `GLOBE_LABS_WEBHOOK_IP_RANGE`. Source from Globe Labs developer documentation at `https://www.globelabs.com.ph/docs/`. Known common ranges for Philippine telco webhooks are in the `47.58.x.x` block — verify against current infrastructure before using.

**Shared-Secret Header:** Stored in Secret Manager as `GLOBE_LABS_WEBHOOK_SECRET`. **Header name TBD** — verify against Globe Labs API docs. Most Philippine telco webhooks use `X-Webhook-Secret` or similar.

**Dev fallback:** Until IP range is confirmed, shared-secret validation is the primary guard.

---

## Error Handling

| Error                                 | Behavior                                                                                  |
| ------------------------------------- | ----------------------------------------------------------------------------------------- |
| Parser throws                         | Trigger catches, writes `status: 'failed'` + `error` to `sms_inbox`, skips auto-reply     |
| sendSMS fails                         | Log error; do not fail the trigger. Auto-reply is best-effort.                            |
| Rate limit exceeded                   | Return 200, no write to `sms_inbox`                                                       |
| Invalid IP/secret                     | Return 403 Forbidden                                                                      |
| Missing/invalid msgId                 | Return 400 Bad Request                                                                    |
| Duplicate delivery (Globe Labs retry) | Idempotent via document ID; trigger guard `status === 'received'` prevents double-process |

---

## Idempotency

1. **Webhook:** `sms_inbox/{msgId}` document ID is assigned by the webhook. Duplicate Globe Labs retries hit the same document ID → `set()` with merge is idempotent. The existing doc (already `status: 'processed'`) is not re-written.
2. **Trigger:** Guard `if (data.status !== 'received') return` — skips if already processed. (onCreate is inherently once-per-new-doc, but the guard protects against future onUpdate re-trigger.)
3. **processInboxItemCore:** Already idempotent via `idempotency_key` — SMS items use `sms_inbox/{msgId}` as the idempotency key.

---

## Testing Requirements

| Test                    | Description                                                                               |
| ----------------------- | ----------------------------------------------------------------------------------------- |
| Parser: high confidence | `BANTAYOG FLOOD CALASGASAN` → confidence high, type flood, barangay "Calasgasan"          |
| Parser: synonym         | `BANTAYOG BAHA LABO` → type flood                                                         |
| Parser: fuzzy barangay  | `BANTAYOG FIRE CALASGAN` (typo) → confidence low, needsReview true, barangay "Calasgasan" |
| Parser: ambiguous       | `BANTAYOG FLOOD DA` → candidates ["Daet", "Daanbayan"]                                    |
| Parser: unparseable     | `BANTAYOG HELP ME` → confidence none                                                      |
| Rate limit: 5th hour    | 5th SMS returns 200 but no sms_inbox write                                                |
| Dedup: Globe Labs retry | Same msgId delivered twice → single report_inbox item                                     |
| Full flow               | Webhook → trigger → report_inbox item → auto-reply SMS delivered                          |
| Parser throws           | report_inbox NOT written, sms_inbox status 'failed', no auto-reply                        |
| msisdnHash in sms_inbox | Verify raw MSISDN is NOT in Firestore document                                            |

## Acceptance Gate

**Pilot-blocker scenario #8** is the acceptance gate for Phase 4b. All other tests are required but this is the hard gate.

| Criterion                                             | Target                                                   |
| ----------------------------------------------------- | -------------------------------------------------------- |
| `BANTAYOG BAHA CALASGASAN` → report in `report_inbox` | < 60s from webhook receipt                               |
| Auto-reply SMS delivered                              | < 60s from webhook receipt                               |
| Barangay precision                                    | Canonical "Calasgasan" (fuzzy-matched from "CALASGASAN") |
| `needsReview` flag                                    | `false` (high-confidence parse)                          |
| `requiresLocationFollowUp`                            | `true` (SMS has no GPS)                                  |
| Rate-limit silent drop                                | 5th SMS in same hour → 200 OK, no write, no auto-reply   |
| Parser accuracy on ground-truth sample                | ≥ 95% (measured separately)                              |

---

## File Inventory

| File                                                       | Action                                                       |
| ---------------------------------------------------------- | ------------------------------------------------------------ |
| `functions/src/http/sms-inbound.ts`                        | New                                                          |
| `functions/src/firestore/sms-inbound-processor.ts`         | New                                                          |
| `packages/shared-sms-parser/src/inbound.ts`                | New (parser module)                                          |
| `packages/shared-sms-parser/src/index.ts`                  | Update: re-export inbound parser                             |
| `packages/shared-validators/src/sms.ts`                    | Update: add SMS-originated report_inbox fields to Zod schema |
| `firestore.rules`                                          | Update: add sms_inbox read/write rules                       |
| `functions/src/__tests__/sms-inbound.test.ts`              | New                                                          |
| `packages/shared-sms-parser/src/__tests__/inbound.test.ts` | New                                                          |
| `scripts/phase-4b/acceptance.ts`                           | New (acceptance harness)                                     |

---

## Open Questions

1. **Globe Labs IP range + header name:** Not yet sourced — needed before staging deployment. See §6 above.
2. **Barangay gazetteer:** The 12-municipality barangay list is a Phase 0 deliverable (§0.10 in implementation plan). Confirm it's available in `packages/shared-data/` before parser development starts.
3. **Globe Labs test webhook:** Need a test keyword and test MSISDN range for acceptance testing. May require a separate Globe Labs test account.

## Implement-Time Actions (verify before writing trigger code)

1. **Verify `processInboxItemCore` interface:** Read the current signature from `functions/src/`. Confirm:
   - It accepts the deps object documented in Phase 4a (after the 2026-04-21 fixes)
   - It returns `{ publicRef }` — if not, this is an interface change needed before Phase 4b trigger is built
2. **Confirm `sendSMS` signature:** Phase 4a sendsms outbox call signature for auto-reply purpose parameter
3. **Read existing `firestore.rules`:** Confirm `sms_sessions/{msisdnHash}` rules at ~line 306 — no changes needed for rate-limit use
