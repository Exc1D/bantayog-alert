# PR #63 Review — phase5 pre-b schema and rules

**PR:** [#63 `[codex] phase5 pre-b schema and rules`](https://github.com/Exc1D/bantayog-alert/pull/63)
**Branch:** `codex/phase5-pre-b-schema-pr`
**Base:** `main`
**Commit:** `ad8cc8f`
**Files Changed:** 56
**Review Date:** 2026-04-24
**Reviewers:** code-reviewer, pr-test-analyzer, silent-failure-hunter, type-design-analyzer, comment-analyzer (automated)

---

## Executive Summary

This PR lands Phase 5 PRE-B schema amendments, Firestore rules additions, inbox trigger updates, and shared validator extensions. The changes are additive, well-scoped, and follow existing patterns. No critical code bugs or security regressions were found. However, there are **6 critical test-coverage gaps**, **2 high-severity silent-failure risks in the trigger**, and **4 type-design/comment clarity issues** that should be addressed before merge.

---

## Critical Issues (Must Fix Before Merge)

### 1. Silent discard of malformed `exactLocation` — no logging

- **File:** `functions/src/triggers/process-inbox-item.ts:92`
- **Agent:** silent-failure-hunter (Severity: HIGH)
- **Issue:** The `isExactLocation` type guard silently drops invalid `exactLocation` values without logging. If `payload.exactLocation` is malformed (e.g., `lat` is a string, NaN, or has extra fields), the code falls back to `undefined` and proceeds. This masks data quality issues upstream.
- **Fix:** Log a warning when `payload.exactLocation` is present but fails the type guard:

  ```typescript
  const exactLocation = isExactLocation(payload.exactLocation) ? payload.exactLocation : undefined
  if (payload.exactLocation && !exactLocation) {
    log({
      severity: 'WARN',
      code: 'INBOX_EXACT_LOCATION_MALFORMED',
      message: `exactLocation malformed for inbox ${inboxId}`,
      data: { inboxId, received: payload.exactLocation },
    })
  }
  ```

### 2. Missing `location_missing` moderation path test

- **File:** `functions/src/__tests__/triggers/process-inbox-item.test.ts`
- **Agent:** pr-test-analyzer (Rating: 9/10)
- **Issue:** The test covers `out_of_jurisdiction` (lat 0,0) but there is no test for `location_missing` when `publicLocation` is absent from the payload. This is a distinct code path at `process-inbox-item.ts:100` that writes a different `reason` to `moderation_incidents`.
- **Fix:** Add a test case that omits `publicLocation` from the inbox payload and asserts the `moderation_incidents` doc has `reason: 'location_missing'`.

### 3. No SMS salt-missing error path tested

- **File:** `functions/src/__tests__/triggers/process-inbox-item.test.ts`
- **Agent:** pr-test-analyzer (Rating: 8/10)
- **Issue:** When `SMS_MSISDN_HASH_SALT` is absent, the trigger logs an ERROR and skips enqueue (`process-inbox-item.ts:220-225`). No test verifies this graceful degradation.
- **Fix:** Add a test that unsets `SMS_MSISDN_HASH_SALT` and asserts no SMS is enqueued and no unhandled exception is thrown.

### 4. Missing `pending_media` not-found handling test

- **File:** `functions/src/__tests__/triggers/process-inbox-item.test.ts`
- **Agent:** pr-test-analyzer (Rating: 8/10)
- **Issue:** If a `pendingMediaIds` entry references a non-existent doc, the code silently skips it (`process-inbox-item.ts:134`). No test exercises this branch; a regression could cause a crash if the `continue` were accidentally removed.
- **Fix:** Add a test with a `pendingMediaIds` array containing a fake ID and assert the report materializes without media (and ideally with a logged warning).

### 5. No report-sharing events read-rules coverage

- **File:** `functions/src/__tests__/rules/report-sharing.rules.test.ts`
- **Agent:** pr-test-analyzer (Rating: 8/10)
- **Issue:** The test file seeds events and tests writes, but never tests `getDocs` or `getDoc` on `report_sharing/{r}/events` with different roles. The rules restrict reads to `isActivePrivileged() && (isMuniAdmin || isAgencyAdmin || isSuperadmin)`.
- **Fix:** Add read tests for muni-admin, agency-admin, superadmin (positive) and citizen/unauthed (negative).

### 6. Missing `agency_assistance_requests` cross-role negative cases

- **File:** `functions/src/__tests__/rules/coordination.rules.test.ts`
- **Agent:** pr-test-analyzer (Rating: 8/10)
- **Issue:** Only muni-admin positive and generic callable-only negatives are tested. Missing: agency-admin read for matching `targetAgencyId`, superadmin read, and non-matching agency-admin denial.
- **Fix:** Expand the describe block to cover all role combinations.

---

## Important Issues (Should Fix)

### 7. `reportOpsDocSchema.reportType` is `.optional()` but written unconditionally

- **File:** `packages/shared-validators/src/reports.ts:123`
- **Agent:** code-reviewer (Confidence: 82)
- **Issue:** `reportType` in `reportOpsDocSchema` is `.optional()`, but `processInboxItemCore` writes it unconditionally. If a future code path writes `report_ops` without `reportType`, the schema allows it silently. The ops-specific enum also excludes 5 types that are valid in `reportDocSchema`.
- **Fix:** Either remove `.optional()` from `reportOpsDocSchema.reportType` (if all write paths guarantee it), or add a code comment explaining why it must remain optional.

### 8. `commandChannelMessageDocSchema.authorRole` excludes `'responder'`

- **File:** `packages/shared-validators/src/coordination.ts:47`
- **Agent:** code-reviewer (Confidence: 80)
- **Issue:** The `authorRole` enum is `['municipal_admin', 'agency_admin', 'provincial_superadmin']`. Responders are participants in threads (via `participantUids`) but cannot author messages. If this is intentional (responders are read-only), it should be documented. If responders should post updates, the schema will reject them.
- **Fix:** Add a comment above the schema clarifying the design intent.

### 9. Silent skip of missing `pending_media` docs without logging

- **File:** `functions/src/triggers/process-inbox-item.ts:132-140`
- **Agent:** silent-failure-hunter (Severity: MEDIUM)
- **Issue:** The loop over `pendingMediaIds` silently skips entries where `pendingSnap.exists` is false. No log entry records which upload IDs were referenced but missing.
- **Fix:** Log a warning for each missing `pending_media` doc, including the inbox ID and the missing upload ID.

### 10. `messages` read rule: `get()` on `report_ops` without `exists()` guard

- **File:** `infra/firebase/firestore.rules:102-109`
- **Agent:** silent-failure-hunter (Severity: MEDIUM)
- **Issue:** The rule reads `get(/databases/$(database)/documents/report_ops/$(reportId)).data.agencyIds` without verifying the doc exists. Accessing `.data` on a non-existent resource evaluates to `null`; the `in` operator on `null` behaves unpredictably.
- **Fix:** Guard with `exists(...)` before accessing `.data.agencyIds`, or restructure to avoid the nested `get()` without existence check.

### 11. `report_notes` create rule: `get()` on `report_ops` without `exists()` guard

- **File:** `infra/firebase/firestore.rules:157-166`
- **Agent:** silent-failure-hunter (Severity: MEDIUM)
- **Issue:** Same pattern as #10. The create rule reads `get(...report_ops/$(request.resource.data.reportId)).data.municipalityId` without verifying existence.
- **Fix:** Add `exists()` guard or document the intended behavior explicitly.

---

## Type Design Analysis

### Overall Ratings

| File              | Encapsulation | Invariant Expression | Invariant Usefulness | Invariant Enforcement |
| ----------------- | ------------- | -------------------- | -------------------- | --------------------- |
| `coordination.ts` | 8/10          | 6/10                 | 7/10                 | 7/10                  |
| `reports.ts`      | 8/10          | 7/10                 | 8/10                 | 8/10                  |
| `responders.ts`   | 7/10          | **4/10**             | 7/10                 | **2/10**              |
| `users.ts`        | 8/10          | 8/10                 | 8/10                 | 9/10                  |

### Specific Findings

#### `coordination.ts`

- Temporal ordering (`expiresAt > createdAt`) is enforced via `.refine()` on three schemas — good.
- Lifecycle coupling is implicit: `respondedBy` without `respondedAt` is semantically incoherent but not enforced.
- State machine gap: `massAlertRequestDocSchema.status` has 8 states but no cross-field rules (e.g., `sentAt` should be required when `status === 'sent'`).
- `commandChannelThreadDocSchema.reportId` changed from optional to required — **breaking change** for existing threads without `reportId`.

#### `reports.ts`

- `reportOpsReportTypeSchema` (6 values) is a subset of `reportDocSchema.reportType` (11 values). This is intentional but implicit. **Recommendation:** Add a test asserting the subset relationship, or derive the subset from the superset.
- `locationGeohash` length (6) and `exactLocation` lat/lng bounds are well-enforced.
- `reportSharingEventDocSchema` has no `reportId` field — invariant enforced only by Firestore path conventions.

#### `responders.ts` — Weakest type in the PR

- `fcmTokens` (array) and `hasFcmToken` (boolean) are denormalized. The invariant `hasFcmToken === (fcmTokens.length > 0)` is **completely implicit** with no enforcement.
- **Recommendation:** Add `.refine((d) => d.hasFcmToken === (d.fcmTokens.length > 0))` or, better, a `.transform()` that derives `hasFcmToken` from `fcmTokens` on parse.

#### `users.ts`

- `reportSmsConsentDocSchema.smsConsent` is `z.literal(true)` — excellent, prevents accidental `false` writes.
- `phone` uses `.min(1)` instead of `msisdnPhSchema`. If Philippine numbers only, use the shared validator for consistency.

---

## Comment / Documentation Issues

### Critical Comment Inaccuracies

1. **`process-inbox-item.ts:142`** — "pending_media docs are write-once by onMediaFinalize and only deleted here, so reads outside the transaction are safe by design."
   - **This is false.** The code reads `pending_media` docs _before_ the transaction, then deletes them _inside_ the transaction. If `onMediaFinalize` writes between the pre-transaction read and the transaction delete, the delete overwrites fresh data.
   - **Fix:** Change comment to: "Reads outside the transaction are a known race; we accept it because pending_media is append-only and deletion is best-effort."

2. **`process-inbox-item.ts:216`** — "smsConsent check is intentional — presence of contact.phone implies smsConsent=true (schema enforces contact.smsConsent as z.literal(true))."
   - **Partially misleading.** `inboxPayloadSchema` does enforce it, but this code path only checks `payload.contact?.phone` — it does not validate `payload.contact` against that schema here.
   - **Fix:** Clarify that the _payload schema_ guarantees it, not that this code path validates it.

### Improvement Opportunities

3. **`coordination.ts:22`** — `agencyAssistanceRequestDocSchema` has `.refine((d) => d.expiresAt > d.createdAt)` but no comment explaining the business rule.
4. **`reports.ts:123`** — No comment explains why ops uses a narrowed enum. Add: "Ops-facing schemas use a restricted enum to prevent rules/test drift."
5. **`firestore.rules:6-11`** — Header claims "names and role literals match spec §5.7 exactly" but the file contains Phase 5 PRE-B extensions. Update header.
6. **`docs/learnings.md:19`** — Great learning about ops-specific enums, but doesn't reference `reportOpsReportTypeSchema`. Cross-reference would help.

### Recommended Removals

7. **`reports.ts`** — Redundant `// schemaName — description` comments on every export (lines 13, 22, 85, 97, 138, 150, 161, 173, 185, 200, 225). These add no value and will rot.
8. **`users.ts:26`** — `// reportSmsConsentDocSchema — contacts document` is **factually incorrect**. This is the SMS consent document, not the general contacts document.

### Positive Findings

- `docs/learnings.md:16-21` — New learnings about `createTestEnv()`, strict schema transitional fields, ops-specific enums, `z.uuid()` vs `z.string().uuid()`, and collection query vs per-document rules are all accurate and tied to real bugs.
- `docs/progress.md:5-16` — Phase 5 PRE-B entry is precise, lists exact verification commands, and doesn't overclaim.

---

## Additional Test Quality Findings

| #   | Issue                                                                                            | File                                                         | Rating |
| --- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------ | ------ |
| 12  | No `command_channel_messages` write-rules test (callable-only writes not verified)               | `coordination.rules.test.ts`                                 | 7      |
| 13  | Missing `report_notes` agency_admin and superadmin positive cases                                | `report-notes.rules.test.ts`                                 | 7      |
| 14  | No `field_mode_sessions` update/delete rule tests                                                | `field-mode-sessions.rules.test.ts`                          | 6      |
| 15  | Brittle `ngeohash` regex assertion — doesn't verify hash correctness for coordinates             | `process-inbox-item.test.ts:175`                             | 6      |
| 16  | Missing `massAlertRequestDocSchema` boundary tests (body max length, negative reach)             | `coordination.test.ts`                                       | 6      |
| 17  | No `reportOpsDocSchema` `duplicateClusterId` or `hazardZoneIdList` validation                    | `reports.test.ts`                                            | 5      |
| 18  | Schema tests use `not.toThrow()` without asserting parsed output (could mask default-value bugs) | `coordination.test.ts`, `reports.test.ts`                    | 5      |
| 19  | Rules tests use `beforeAll` for seeding without per-test cleanup — cross-test pollution risk     | `coordination.rules.test.ts`, `report-sharing.rules.test.ts` | 5      |

---

## Strengths

- **Additive and safe:** All changes are additive; no breaking changes to existing collections (except `commandChannelThreadDocSchema.reportId` becoming required).
- **Well-tested patterns:** All new schemas have unit tests; all new rules have rules tests.
- **Rules in sync:** Both `firestore.rules` and `firestore.rules.template` updated identically.
- **Minimal dependencies:** Only `@types/ngeohash` and `ngeohash` added — necessary for geohash feature.
- **Security posture maintained:** Default-deny; least-privilege (`isActivePrivileged`, `adminOf` gating).
- **Idempotency tested:** Both materialization and SMS enqueue paths have idempotency coverage.
- **Participant map-key lookup:** `command_channel_threads/messages` rules thoroughly tested with positive and negative cases.
- **Cross-collection validation:** `report_notes` correctly tests the `report_ops` lookup for municipality validation.
- **Prior learning applied:** `reportSmsConsentDocSchema` now requires `municipalityId`, fixing prior schema/trigger drift.

---

## Recommended Action Plan

### Phase 1 — Before Merge (Critical + Important)

1. [ ] Add warning log for malformed `exactLocation` at `process-inbox-item.ts:92`
2. [ ] Add `location_missing` test case to `process-inbox-item.test.ts`
3. [ ] Add SMS salt-missing graceful degradation test
4. [ ] Add `pending_media` not-found test
5. [ ] Add report-sharing events read-rules tests
6. [ ] Add agency-assistance cross-role negative tests
7. [ ] Add warning log for missing `pending_media` docs
8. [ ] Decide on `reportOpsDocSchema.reportType` optionality (remove `.optional()` or document)
9. [ ] Add design comment for `authorRole` responder exclusion
10. [ ] Add `exists()` guards in `messages` and `report_notes` rules (or document intended behavior)

### Phase 2 — Polish (Type Design + Comments)

11. [ ] Add `.refine()` or `.transform()` for `hasFcmToken`/`fcmTokens` consistency in `responders.ts`
12. [ ] Add state-dependent refinements on `massAlertRequestDocSchema` (e.g., `sentAt` required when `status === 'sent'`)
13. [ ] Add subset test for `reportOpsReportTypeSchema` vs `reportDocSchema.reportType`
14. [ ] Fix misleading comments in `process-inbox-item.ts:142` and `:216`
15. [ ] Remove redundant schema name comments in `reports.ts`
16. [ ] Fix incorrect comment in `users.ts:26`
17. [ ] Update `firestore.rules` header to acknowledge Phase 5 PRE-B extensions

### Phase 3 — Test Quality (Optional, Can Defer)

18. [ ] Add `command_channel_messages` write-rules negative test
19. [ ] Add `report_notes` agency_admin/superadmin positive cases
20. [ ] Add `field_mode_sessions` update/delete rule tests
21. [ ] Strengthen `ngeohash` assertion to verify actual coordinate hash
22. [ ] Add boundary tests for `massAlertRequestDocSchema`
23. [ ] Add validation tests for `duplicateClusterId` and `hazardZoneIdList`
24. [ ] Assert parsed output shape in schema tests (not just `not.toThrow()`)
25. [ ] Consider per-test cleanup in rules tests to prevent cross-test pollution

---

## Verification Commands (from progress.md)

```bash
# Shared validators
pnpm --filter @bantayog/shared-validators exec vitest run src/coordination.test.ts src/responders.test.ts src/users.test.ts src/reports.test.ts

# Firestore rules
firebase emulators:exec --only firestore,database,storage "pnpm --filter @bantayog/functions exec vitest run src/__tests__/rules/field-mode-sessions.rules.test.ts src/__tests__/rules/report-notes.rules.test.ts src/__tests__/rules/report-messages.rules.test.ts src/__tests__/rules/coordination.rules.test.ts src/__tests__/rules/report-sharing.rules.test.ts"

# Inbox trigger
firebase emulators:exec --only firestore "pnpm --filter @bantayog/functions exec vitest run src/__tests__/triggers/process-inbox-item.test.ts"

# Lint + typecheck
npx turbo run lint typecheck
```

---

_Review generated by automated PR review toolkit (5 specialized agents)._
