# QA Edge Hunter Fix Plan

**Date:** 2026-04-18
**Source:** `docs/qa-edge-hunter-report.md`
**Scope:** 18 issues — 4 CRITICAL, 4 HIGH, 7 MEDIUM, 3 LOW

---

## CRITICAL Issues

### CRITICAL #1 — EXIF GPS Metadata Survives `sharp.rotate()` — Privacy Leak

**File:** `functions/src/triggers/on-media-finalize.ts:45`

`rotate()` with no args uses EXIF orientation for auto-rotation but does **not strip EXIF metadata**. Uploaded JPEG photos retain GPS coordinates despite the processing pipeline's intent to strip location.

**Fix:**

```ts
cleaned = await sharp(buf).rotate().withMetadata(false).toBuffer()
```

`.withMetadata(false)` strips ALL metadata (EXIF, GPS, XMP, IPTC). Simple, correct.

---

### CRITICAL #2 — Unbounded `pendingMediaIds` Array — DoS via Firestore Read Storm

**File:** `packages/shared-validators/src/reports.ts:196`

`processInboxItemCore` iterates ALL `pendingMediaIds` with individual Firestore reads inside a transaction. An attacker submitting 1000 IDs causes 1000 reads.

**Fix:**

```ts
pendingMediaIds: z.array(z.string().min(1)).max(20).optional(),
```

Cap at 20 — a report with 20+ photos is unreasonable.

---

### CRITICAL #3 — `canonicalPayloadHash` — `undefined` Values Cause Hash Collision

**File:** `packages/shared-validators/src/idempotency.ts:40–42`

`JSON.stringify({ a: 1, b: undefined })` → `'{"a":1}'` — identical to `JSON.stringify({ a: 1 })`. Two payloads differing only by an undefined field produce the **same idempotency hash**.

**Fix:** In `canonicalize()`, throw `TypeError` when encountering `undefined`:

```ts
if (value === undefined) {
  throw new TypeError('undefined is not supported in idempotency payloads')
}
```

Also update `idempotency.test.ts` line 52-59 — the existing test **documents the bug** as expected behavior. Flip it to assert that `undefined` now throws.

---

### CRITICAL #4 — Concurrent `inboxReconciliationSweep` — Duplicate Processing Race

**File:** `functions/src/triggers/inbox-reconciliation-sweep.ts:36–55`

Two scheduler instances can process the same inbox item concurrently. The `processedAt` write is a race condition — one instance may overwrite another's write.

**Fix:** Use a Firestore transaction to atomically claim each item before processing:

```ts
const claimRef = db.collection('report_inbox').doc(d.id)
const claimed = await db.runTransaction(async (tx) => {
  const snap = await tx.get(claimRef)
  if (snap.data()?.processedAt) return false // already claimed/processed
  tx.update(claimRef, { processedAt: now() })
  return true
})
if (!claimed) continue
await processInboxItemCore({ db: input.db, inboxId: d.id, now })
```

Also fix HIGH #7 (see below) in the same file.

---

## HIGH Issues

### HIGH #5 — `reportLookupDocSchema` — No Upper Bound on `expiresAt`

**File:** `packages/shared-validators/src/reports.ts:154`

Malicious admin could set `expiresAt = Number.MAX_SAFE_INTEGER`, persisting lookup docs indefinitely.

**Fix:**

```ts
expiresAt: z.number().int().max(Date.now() + 365 * 24 * 60 * 60 * 1000),
```

---

### HIGH #6 — `smsInboxDocSchema` — `senderMsisdnHash` Accepts Non-Hex Strings

**File:** `packages/shared-validators/src/sms.ts:9`

Passes any 64-character string — `"g".repeat(64)` accepted as valid.

**Fix:**

```ts
senderMsisdnHash: z.string().length(64).regex(/^[a-f0-9]{64}$/),
```

---

### HIGH #7 — `inboxReconciliationSweep` — Empty Sweep Returns `oldestAgeMs = 0` Hiding Stuck State

**File:** `functions/src/triggers/inbox-reconciliation-sweep.ts:35`

When snap is empty, `oldestAgeMs` stays 0. The ERROR log at line 70 (`oldestAgeMs > 15 * 60 * 1000`) never fires on empty sweeps — hiding silent failures.

**Fix:**

```ts
oldestAgeMs: snap.empty ? null : oldestAgeMs,
```

Update `SweepResult` interface to allow `number | null`.

---

### HIGH #8 — `withIdempotency` — `resultPayload` Stored but Never Read Back (Untested)

**File:** `functions/src/idempotency/guard.ts:44–49, 57`

The cached result is stored and read back, but no test verifies the replay path returns the correct `reportId`. Firestore serialization/deserialization could silently corrupt the result.

**Fix:** Requires emulator-based integration test — deferred as separate follow-up (needs full Firebase test harness).

---

## MEDIUM Issues

### MEDIUM #10 — `hazardZoneDocSchema` — `supersededBy` + `supersededAt` Not Enforced as a Pair

**File:** `packages/shared-validators/src/hazard.ts:27–28`

Both independently optional. `supersededBy` without `supersededAt` (or vice versa) is inconsistent.

**Fix:** Add refinement:

```ts
.refine(
  (d) => (d.supersededBy && d.supersededAt) || (!d.supersededBy && !d.supersededAt),
  { message: 'supersededBy and supersededAt must both be present or both absent' }
)
```

---

### MEDIUM #11 — `shiftHandoffDocSchema` — `expiresAt` Not Validated Against `createdAt`

**File:** `packages/shared-validators/src/coordination.ts:83`

`agencyAssistanceRequestDocSchema` has the check; `shiftHandoffDocSchema` doesn't.

**Fix:**

```ts
.refine((d) => d.expiresAt > d.createdAt, {
  message: 'expiresAt must be after createdAt',
})
```

---

## LOW / Informational (Not implementing)

| #   | Issue                                        | Reason                                                     |
| --- | -------------------------------------------- | ---------------------------------------------------------- |
| #9  | `hasPhotoAndGPS` derived field not validated | Data consistency issue only, not functional bug            |
| #12 | Object name check is case-sensitive          | Defense-in-depth gap only; upload URL flow uses lowercase  |
| #13 | `isPseudonymous` hardcoded to `false`        | Will be plumbed when pseudonymous reporting is implemented |
| #14 | MIME type check uses string equality         | Correct per HTTP spec                                      |

---

## Files to Change

| File                                                         | Changes                                                         |
| ------------------------------------------------------------ | --------------------------------------------------------------- |
| `functions/src/triggers/on-media-finalize.ts`                | Add `.withMetadata(false)`                                      |
| `packages/shared-validators/src/reports.ts`                  | Cap `pendingMediaIds.max(20)`, bound `expiresAt`                |
| `packages/shared-validators/src/idempotency.ts`              | Reject `undefined` with `TypeError`                             |
| `functions/src/triggers/inbox-reconciliation-sweep.ts`       | Atomic claim transaction + null `oldestAgeMs`                   |
| `packages/shared-validators/src/sms.ts`                      | Add hex regex to `senderMsisdnHash`                             |
| `packages/shared-validators/src/hazard.ts`                   | Add pairwise `refine` for superseded fields                     |
| `packages/shared-validators/src/coordination.ts`             | Add expiresAt > createdAt refine                                |
| `packages/shared-validators/src/idempotency.test.ts`         | Flip undefined test from "documents bug" to "asserts rejection" |
| `functions/src/__tests__/triggers/on-media-finalize.test.ts` | Add test for EXIF+GPS stripping                                 |

---

## Missing Test Coverage (Deferred)

| Edge Case                                    | Severity | Reason Deferred                      |
| -------------------------------------------- | -------- | ------------------------------------ |
| Replay path returns correct cached result    | HIGH     | Requires emulator integration test   |
| Concurrent sweep race condition              | CRITICAL | Requires multi-instance test harness |
| `publicRef` collision detection              | HIGH     | Requires Firestore transaction test  |
| Very large `pendingMediaIds` (100+ items)    | CRITICAL | Covered by schema fix, not test      |
| `expiresAt` = far future boundary            | MEDIUM   | Covered by schema fix, not test      |
| `supersededBy`/`supersededAt` consistency    | MEDIUM   | Covered by schema fix, not test      |
| `senderMsisdnHash` non-hex validation        | MEDIUM   | Covered by schema fix, not test      |
| Empty sweep returns `null` oldestAgeMs       | MEDIUM   | Covered by schema fix, not test      |
| `shiftHandoffDocSchema` expiresAt validation | MEDIUM   | Covered by schema fix, not test      |

---

## Verification

```bash
pnpm test          # all tests pass including new ones
pnpm lint         # no new violations
pnpm typecheck    # clean
pnpm build        # all artifacts present
```

---

## Risks

1. **CRITICAL #1:** The existing JPEG test fixture (`on-media-finalize.test.ts`) must still pass after EXIF strip — `withMetadata(false)` may change output buffer slightly
2. **CRITICAL #3:** The existing test at `idempotency.test.ts:52-59` currently asserts `undefined` produces same hash as `{}`. This test will FAIL — it must be updated to assert rejection instead
3. **CRITICAL #4:** The atomic claim pattern changes sweep from read-then-write to transaction-based. Transaction holds a read lock — need to confirm this doesn't cause contention with other sweep instances (should be fine given BATCH=100 and short transaction)
