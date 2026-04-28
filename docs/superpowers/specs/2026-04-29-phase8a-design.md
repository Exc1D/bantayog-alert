# Phase 8A Design — Surge Validation: Load, Contention & Pre-warm

**Date:** 2026-04-29
**Status:** Approved
**Phase:** 8A (precedes 8B which is already complete)

---

## Overview

Phase 8A is the **validation half** of Phase 8. Its primary output is confidence — specifically, measured evidence that the dispatch contention path is correct under load, the inbox reconciliation sweep catches failures, and volume throughput holds at pilot-realistic scale.

Phase 8A does **not** add new features. Any backend change introduced is a direct consequence of a failing test, and is capped at 3 files maximum. Anything larger becomes a tracked issue and does not block 8A exit.

Phase 8B (signal ingest, operator control, observability) is already complete. Phase 8C (RA 10173 erasure/anonymization execution) is a separate spec.

---

## Scope

### In Scope

- k6 load test harness: 3 core scenarios with defined pass/fail thresholds
- Surge pre-warm runbook (human-executed Terraform override)
- Backend fix gate: fixes of 3 files or fewer triggered by failing tests
- Deferred scenario documentation (3 scenarios cut from 8A, tracked in `progress.md`)

### Out of Scope

- Dynamic `minInstances` mutation at runtime (decided: static baseline + manual runbook)
- 4 observability dashboards (Ops, Backend, Compliance, Cost) — deferred to Phase 11
- RA 10173 erasure execution — Phase 8C
- `merge-duplicate-race`, `admin-dashboard-load`, `rtdb-reconnect-storm` k6 scripts — deferred
- CI integration for k6 scripts

### Deferred Items (recorded, not forgotten)

| Item                                         | Deferred to                | Rationale                                                                                                                                                        |
| -------------------------------------------- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `merge-duplicate-race` k6 script             | Phase 9 verification       | Operation is rare in normal operations; not a daily dispatch path                                                                                                |
| `admin-dashboard-load` k6 script             | Phase 9 verification       | Run manually during staging soak; Firestore quota risk but not dispatch-critical                                                                                 |
| `rtdb-reconnect-storm` k6 script             | Phase 9 verification       | Manual observation (no k6 script) happens during 8A staging soak per the Observation gate; the k6 script itself is deferred until pilot responder count is known |
| RTDB jitter/backoff client fix               | Conditional on measurement | If reconnect-storm observation at staging soak shows cost more than 5x baseline, fix is tracked and scoped                                                       |
| 4 observability dashboards (Arch Spec §13.9) | Phase 11 (Audit Hardening) | System Health (8B) covers surge-time operator needs; dashboards are a compliance reporting concern                                                               |
| PagerDuty/OpsGenie runbook migration         | Phase 9 exit gate          | Must be migrated before pilot launches if team adopts alerting tooling                                                                                           |

---

## Core Decisions

1. **Validation-first.** Write all k6 scripts, run against staging, measure. Only then consider fixes.
2. **No test-flag contamination.** No `if (testFlag && !env.isProd)` logic in production code paths. Scenarios are designed around existing system behavior.
3. **Runbook over automation.** Pre-warm is a human-executed Terraform override, not a runtime Cloud Functions Admin API mutation. Simpler, lower blast radius.
4. **Hard scope cap on fixes.** Any regression that cannot be fixed in 3 files or fewer is a named tracked issue. 8A exits regardless.
5. **Token safety guard, not refresh loop.** Firebase ID tokens last 1 hour. All scenarios complete in 6 min or less. `firebase-auth.js` asserts token age less than 50 min before each request — descriptive error, not a silent 401.
6. **Admin SDK seed for cold-start scenario.** The reconciliation sweep scenario seeds a stale `pending` item directly via Admin SDK, bypassing `processInboxItem`. This tests the sweep's catch-up path without any production code changes.

---

## Harness Structure

```
e2e-tests/k6/
  lib/
    firebase-auth.js     # getIdToken(email, password) via REST identitytoolkit API
                         # stores fetchedAt; asserts age less than 50 min before each use
    callable.js          # POST to Cloud Functions REST callable endpoint with auth header
  scenarios/
    accept-dispatch-race.js
    citizen-submit-burst.js
    cold-start-inbox.js
  README.md              # required env vars, exact run commands, pass/fail thresholds
```

**Root `package.json` addition:**

```json
"load-test": "k6 run e2e-tests/k6/scenarios/$SCENARIO.js"
```

**Required env vars:**

| Variable                                                 | Purpose                                          |
| -------------------------------------------------------- | ------------------------------------------------ |
| `K6_FIREBASE_PROJECT_ID`                                 | Target project                                   |
| `K6_FIREBASE_REGION`                                     | Functions region                                 |
| `K6_API_KEY`                                             | identitytoolkit REST auth                        |
| `K6_TEST_ADMIN_EMAIL` / `K6_TEST_ADMIN_PASSWORD`         | Admin test account                               |
| `K6_TEST_RESPONDER_EMAIL` / `K6_TEST_RESPONDER_PASSWORD` | Responder test account                           |
| `K6_SERVICE_ACCOUNT_JSON`                                | Admin SDK seed writes (cold-start scenario only) |

All env vars are staging-scoped. `K6_SERVICE_ACCOUNT_JSON` must never contain a prod service account.

---

## Scenarios

### Scenario 1: `accept-dispatch-race`

**Pilot-blocker:** #26

**What it tests:** Exactly one responder wins a contested dispatch under concurrent retries. No double-acceptance. No silent loss. No server errors.

**Schema constraint (verified in code):** `acceptDispatch` gates on `assignedTo.uid === actor.uid` — a single-UID assignment. Multi-UID contention is not supported by the current schema. The correct contention model is: one dispatch, one assigned responder, 50 concurrent retry attempts from the same responder (simulating network-retry storm). The Firestore transaction ensures the first commit wins; the rest see `status !== 'pending'` and receive `CONFLICT`.

**Setup:**

- Seed one dispatch in `pending` state with `assignedTo: { uid: responderUid }` and all required dispatch schema fields via Admin SDK
- All 50 VUs share one responder account's credentials (the assigned responder)
- Pre-fetch the responder ID token once in k6 `setup`; all VUs reuse it
- Between iterations: Admin SDK resets the dispatch to `{ status: 'pending' }` and removes `acceptedAt` — do not re-seed the full document

**Script behavior:**

- 50 VUs all call `acceptDispatch` with the same `dispatchId` simultaneously (k6 barrier sync — all VUs wait at a shared signal before the timed window begins)
- Each VU generates a **unique `idempotencyKey` UUID** — this bypasses the idempotency dedup cache so all 50 hit the Firestore transaction independently
- Scenario runs 3 consecutive iterations

**Pass criteria:**

- Exactly 1 `ok` response per iteration
- 49 VUs receive `already-exists` HTTP error (mapped from `CONFLICT` — dispatch no longer `pending`)
- 0 `FORBIDDEN` or 5xx responses on any VU in any iteration
- p99 < 2s across all 50 VUs
- All 3 consecutive iterations clean

**If it fails:**

- If losers receive 5xx instead of `already-exists`: the Firestore transaction is not correctly gating on status; likely a 1-file fix in `accept-dispatch.ts`
- If a fix of 3 files or fewer resolves it, apply under the backend fix gate
- If the fix exceeds 3 files, track as named issue in `progress.md` and 8A exits

---

### Scenario 2: `citizen-submit-burst`

**What it tests:** `submitReport` callable and `processInboxItem` trigger handle a submission burst at typhoon-landfall scale without dropping reports or growing the dead-letter queue.

**Setup:**

- 100 anonymous test citizen tokens pre-fetched in k6 `setup`

**Script behavior:**

- 100 VUs start within a 10-second ramp window (simulates burst on initial typhoon landfall news)
- Each VU submits exactly 1 report with unique content
- After submission, the VU polls `report/{reportId}` state until materialized or 60s timeout
- Inbox grows by exactly 100 items total — no re-submissions

**Pass criteria:**

- p99 < 10s for `submitReport` callable response
- Error rate less than 1% (expected rate-limit rejections count as pass, not error)
- 0 dead-letter growth during the run (check `system_health/latest.deadLetterCount` before and after)

**If it fails:**

- Classify root cause as **environment-constrained** (staging quota or limits that differ from prod) or **real regression**
- Environment-constrained: document in `progress.md` with estimated prod impact assessment
- Real regression: triggers the backend fix gate (3 files or fewer, or tracked issue)
- The classification is documented before 8A exits regardless of outcome

---

### Scenario 3: `cold-start-inbox`

**Pilot-blocker:** #10

**What it tests:** The reconciliation sweep catches an inbox item that was never processed (trigger missed). No item silently disappears.

**Sweep behavior (verified in code):** `inboxReconciliationSweep` runs every 5 minutes. It queries `report_inbox` where `clientCreatedAt < (now - 2min)` and `processedAt` is not set. It claims items by atomically setting `processedAt` before calling `processInboxItemCore`. Once `processedAt` is set, the item is considered accounted for — regardless of whether processing succeeded or failed.

**Setup:**

- k6 `setup` uses Admin SDK (`K6_SERVICE_ACCOUNT_JSON`) to write one document to `report_inbox` with:
  - `clientCreatedAt: Date.now() - 10 * 60 * 1000` (10 min in the past — well within sweep staleness threshold)
  - All other required `report_inbox` schema fields
  - No `processedAt` field set
- This bypasses the `processInboxItem` Firestore trigger entirely — the sweep is the only recovery path
- No test-flag code in any production function

**Script behavior:**

- Seed the stale item via Admin SDK in `setup`
- Poll `report_inbox/{itemId}` document every 30s
- Pass when `processedAt` field is set on the item document (item claimed and processed by sweep)
- Timeout at 6 min
- After each trial: delete the seeded item via Admin SDK cleanup before next trial

**Pass criteria:**

- `processedAt` set on seeded item within 5 min
- 0 items where `processedAt` remains unset at timeout ("missing")
- 3 consecutive clean trials

**If a trial fails (item still pending at 5:01 min):**

- Investigate root cause
- If 3 files or fewer fixes it, apply under the backend fix gate and re-run
- If root cause is environment-constrained, document in `progress.md` with estimated prod impact; 8A continues
- If root cause is a real regression exceeding 3 files, track as named issue; 8A exits

---

## Scenario Cleanup

Each scenario leaves Firestore artifacts. Cleanup is required between repeated runs and after the full suite.

| Scenario               | Cleanup action                                                                                                                                                                                                                                                            |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `accept-dispatch-race` | Between iterations: Admin SDK resets dispatch `status: 'pending'`, removes `acceptedAt`. After all iterations: delete the dispatch document.                                                                                                                              |
| `citizen-submit-burst` | After run: delete the 100 seeded `report_inbox` items and any materialized `reports` documents. The dead-letter baseline check is relative (before vs after), so leftover items from previous runs do not affect the gate — but delete them anyway to keep staging clean. |
| `cold-start-inbox`     | After each trial: delete the seeded `report_inbox` item via Admin SDK (already in the script's `teardown` block).                                                                                                                                                         |

Run order (3 → 1 → 2) ensures cold-start resolves before the burst scenario measures dead-letter baseline.

---

## Pre-warm Runbook

**Location:** `infra/runbooks/surge-prewarm.md`

**Note:** `infra/runbooks/` directory does not exist — must be created. The `surge_min_instances` Terraform variable also does not exist in `infra/terraform/variables.tf` — must be added during implementation.

**Linked from:** System Health page in Admin Desktop — a static `Surge Runbook` link added to the Signal Controls card in `apps/admin-desktop/src/pages/SystemHealthPage.tsx`. A runbook not findable during an incident is worthless.

**Trigger:** TCWS signal level 2 or higher is active on the System Health page.

**Target functions:** `processInboxItem`, `acceptDispatch`, `dispatchResponder`, `projectResponderLocations`

**Execution steps:**

1. Open `infra/terraform/variables.tf` — set `surge_min_instances = 20` (default: `3`)
2. Run `terraform apply` targeting the 4 hot-path functions with `surge_min_instances=20` (exact targets listed in the runbook file)
3. Verify in Firebase Console → Functions — each target function shows `minInstances: 20`
4. Estimated apply time: ~3 min

**Revert trigger:** Revert when signal drops below level 2, or if signal stays elevated, revert automatically after 6 hours — whichever comes first.

**Revert steps:** Set `surge_min_instances = 3`, re-apply with same targets.

**Automation gap (tracked):** There is no automated trigger. If the team adopts PagerDuty or OpsGenie before Phase 9 exit, this runbook must be migrated there before the pilot launches. Tracked as a named item in `progress.md`.

---

## Exit Criteria

Phase 8A is complete when all of the following are true:

### Correctness gates (pilot-blocking)

| Gate                   | Pass                                                                           | Failure path                                                      |
| ---------------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| `accept-dispatch-race` | Exactly 1 winner; 0 server errors; p99 < 2s @ 50 VUs; 3 consecutive clean runs | Real regression → fix gate or tracked issue; 8A blocks            |
| `cold-start-inbox`     | Item accounted for within 5 min; 3 consecutive clean trials                    | Investigate → fix or classify → 8A blocks only on real regression |

### Volume gate (must be classified on failure — not skippable)

| Gate                   | Pass                                                       | Failure path                                                                     |
| ---------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `citizen-submit-burst` | p99 < 10s @ 100 VUs; error rate < 1%; 0 dead-letter growth | Classify as environment-constrained or real regression; document before 8A exits |

### Observation gate (no hard pass — documented result required)

| Gate                                 | Required output                                                             |
| ------------------------------------ | --------------------------------------------------------------------------- |
| RTDB reconnect (manual staging soak) | Cost multiplier documented; fix-or-defer decision recorded in `progress.md` |

### Runbook gate (blocking)

- `infra/runbooks/surge-prewarm.md` committed and linked from Admin Desktop System Health page
- Manual drill executed once in staging: apply → verify `minInstances` → revert → verify

### Backend fix gate

- Any fix introduced by a failing test: 3 files or fewer, passing tests, clean lint/typecheck
- Any regression exceeding 3 files: named tracked issue in `progress.md` with risk assessment; 8A exits regardless

### Deferred items gate

- All deferred items listed in the Deferred Items table above are recorded in `progress.md` with rationale before 8A exits

---

## Run Order & Verification Plan

**Pre-run checklist:**

- k6 scripts parse cleanly (`k6 inspect scenarios/<name>.js`)
- Staging test accounts seeded and env vars exported
- `system_health/latest.deadLetterCount` baseline recorded before burst scenario
- `minInstances` baseline verified before pre-warm drill

**Run order:**

1. Scenario 3 (cold-start) — clean reconciliation sweep queue needed
2. Scenario 1 (contention) — clean dispatch collection needed
3. Scenario 2 (burst) — run after contention to avoid dispatch-collection noise
4. Pre-warm drill — last, since it changes infrastructure config

**Post-run:**

- Re-read `system_health/latest` for dead-letter delta and backlog state
- Run `pnpm exec turbo run lint typecheck` if any backend fix was applied
- Update `progress.md` with scenario results and any tracked issues

---

## Files to Create

| File                                             | Purpose                                         |
| ------------------------------------------------ | ----------------------------------------------- |
| `e2e-tests/k6/lib/firebase-auth.js`              | REST identitytoolkit auth with age assertion    |
| `e2e-tests/k6/lib/callable.js`                   | Firebase callable HTTP wrapper with auth header |
| `e2e-tests/k6/scenarios/accept-dispatch-race.js` | Contention scenario                             |
| `e2e-tests/k6/scenarios/citizen-submit-burst.js` | Volume scenario                                 |
| `e2e-tests/k6/scenarios/cold-start-inbox.js`     | Fault injection / sweep scenario                |
| `e2e-tests/k6/README.md`                         | Run guide, env vars, thresholds                 |
| `infra/runbooks/surge-prewarm.md`                | Pre-warm operator runbook                       |

**Root `package.json`:** add `load-test` script.

**Files to modify (existing):**

- `apps/admin-desktop/src/pages/SystemHealthPage.tsx` — add static `Surge Runbook` link in Signal Controls card
- `infra/terraform/variables.tf` — add `surge_min_instances` variable (default: `3`)
- Root `package.json` — add `load-test` script

**Possible backend fixes (conditional, 3 files or fewer):**

- `functions/src/callables/accept-dispatch.ts` — if race test reveals state-gate bug
- `functions/src/idempotency/guard.ts` — if dedup logic needs tuning
