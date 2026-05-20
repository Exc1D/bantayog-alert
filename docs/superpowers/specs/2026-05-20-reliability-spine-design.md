# Design Spec: Reliability Spine For Cross-App Proof

**Date:** 2026-05-20
**Status:** Revised after adversarial review
**Owner:** Senior Pragmatic Engineer (AI)

## 1. Problem

Bantayog Alert has many pieces that look complete in isolation, but the basic cross-app loop is still hard to trust. A citizen report can appear successful in the PWA without showing up in Admin Desktop. An admin alert can be written by the backend without appearing in the Citizen PWA. The responder app has not been tested as part of the same loop.

The current failure mode is unacceptable for an emergency system: a user sees success, an operator sees nothing, and the team has to debug by memory. We need one proof path that says whether the product works and tells us exactly where it broke.

## 2. Goal

Build a Reliability Spine for the core loop:

```text
Citizen PWA submits report
  -> report_inbox receives valid intake doc
  -> backend materializes reports/report_ops/lookup docs
  -> Admin Desktop sees the report in its role-scoped listener result
  -> Admin Desktop declares an alert
  -> Citizen PWA sees the alert from Firestore
  -> Admin Desktop dispatches a responder
  -> Responder App sees and progresses the dispatch
```

The first implementation plan must make this loop repeatable locally and against staging. Local development may use an explicit inbox-processing workaround for the known Firebase emulator trigger bug. Staging must rely on deployed Cloud Functions.

## 3. Non-Goals

- Do not rewrite all Firebase setup across apps.
- Do not edit Firestore, Realtime Database, Storage rules, indexes, or schema files in this slice.
- Do not deploy as part of implementation without explicit fresh approval.
- Do not solve SMS, media uploads, offline retry, or FCM delivery in the first implementation slice.
- Do not include report photos, voice notes, or other Storage-backed media in this proof. Storage access is a separate slice because storage rules and media processing are intentionally out of scope here.
- Do not run heavy load tests until the proof loop can pass deterministically.

Those channels stay on the roadmap, but they should not block the first reliable cross-app proof.

## 4. Current Findings

### 4.1 Citizen Report Intake

The Citizen PWA writes directly to `report_inbox/{clientDraftRef}`. The backend materializer validates the inbox payload and creates `reports`, `report_private`, `report_ops`, lookup docs, and events.

Local docs already record a confirmed Firebase emulator issue: `onDocumentCreated` triggers can fail before user code runs. The workaround is to run `functions/scripts/process-inbox-manual.ts` against the Firestore emulator after the PWA writes an inbox doc. Production impact is documented as zero because deployed Cloud Functions process the trigger normally.

### 4.2 Admin Report Visibility

Admin Desktop reads `reports` and `report_ops` through role-scoped Firestore listeners. A report will not appear if materialization fails, municipality data is missing, admin claims are scoped differently, or the client points at a different Firebase target than the PWA.

### 4.3 Alert Visibility

`declareAlertCore` writes `alerts/{alertId}` with `declaredAt`. The Citizen PWA shared alert listener queries `alerts` ordered by `publishedAt`. Firestore `orderBy()` only returns documents containing the ordered field, so alerts missing `publishedAt` can be invisible even when alert creation succeeds.

For the proof loop, Firestore visibility is the source of truth. FCM push is best-effort and must not be required to prove that alerts work.

### 4.4 Responder Dispatch Visibility

The responder app listens to `dispatches` where `assignedTo.uid` matches the responder, status is active, and `dispatchedAt` exists for sorting. Dispatch creation must produce the fields used by this query and by the responder state machine.

### 4.5 Test Harness Drift

`scripts/dev-all.mjs` starts Admin Desktop on `4173` and Responder App on `3001`, while the E2E Playwright config expects `5175` and `5174`. This is a hard blocker, not a footnote. The proof command must own the ports it uses and verify each app identity before running user actions.

### 4.6 App Check And Auth State

Staging can fail before the product loop starts if App Check, callable region, or Firebase Auth state is wrong. The proof must preflight App Check and sign in inside each browser context that uses an app. A seeded user existing in Firebase Auth is not enough.

## 5. Design

### 5.1 Proof Run Identity

Every proof run must create a unique `testRunId` and carry it through all observable artifacts:

- A run ledger maps `testRunId` to `clientDraftRef`, `publicRef`, `reportId`, `alertId`, `dispatchId`, admin uid, responder uid, and cleanup status.
- Alert `message` must include `[TEST:<testRunId>]`, and the run ledger must store `alertId`.
- Firestore assertions must use exact ids from the ledger, not "most recent" queries.
- UI assertions must locate visible text or stable test ids tied to `testRunId`, `publicRef`, `reportId`, or `dispatchId`.

The harness must not search for "any recent report" or "any alert." It must prove the documents and UI rows created by this run.

### 5.2 Canonical Checkpoints

| ID  | Checkpoint             | Required assertion                                                                                                                                                                        | Timeout                  |
| --- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| C00 | Environment preflight  | Correct target project, app ports, app identities, Firebase region, emulator/staging mode, App Check status, and auth readiness are verified before writing data.                         | 30s                      |
| C01 | Citizen inbox write    | `report_inbox/{clientDraftRef}` exists with exact `reporterUid`, `publicRef`, `correlationId`, `idempotencyKey`, `payload.reportType`, `payload.severity`, and location.                  | 10s                      |
| C02 | Materialization        | `reports/{reportId}`, `report_ops/{reportId}`, and `report_lookup/{publicRef}` exist; `reports.municipalityId` matches the test municipality; `report_ops.status=new`.                    | 30s local / 120s staging |
| C03 | Admin listener result  | The signed-in admin's role scope includes the report municipality, and Admin Desktop displays a stable row/card for that exact report in the listener result set.                         | 15s after C02            |
| C04 | Alert write contract   | `alerts/{alertId}` exists with `publishedAt` as the citizen-visible sort timestamp, plus expected `message` containing `[TEST:<testRunId>]`, `hazardType`, and `affectedMunicipalityIds`. | 15s                      |
| C05 | Citizen alert listener | Citizen PWA displays the exact alert message/testRunId from Firestore and does not show an alert listener error state.                                                                    | 15s after C04            |
| C06 | Dispatch write         | `dispatches/{dispatchId}` exists with exact `reportId`, `assignedTo.uid`, `assignedTo.municipalityId`, `status=pending`, and `dispatchedAt`.                                              | 15s                      |
| C07 | Responder listener     | Responder App, signed in as `assignedTo.uid`, displays the exact pending dispatch from the listener result set and no listener error state.                                               | 15s after C06            |
| C08 | Responder progression  | `acceptDispatch` moves status to `accepted`; `advanceDispatch` moves through `acknowledged`, `en_route`, and `on_scene`; each step writes the expected dispatch status.                   | 30s total                |
| C09 | Materialization replay | Re-running local materialization for the same inbox does not create a second report and returns or proves the same `reportId`.                                                            | 30s local only           |

For UI checks, "renders" means specific visible text or a stable `data-testid` tied to the expected run artifact. Waiting for a loading spinner to disappear is never a pass condition.

### 5.3 Local Mode

Local mode must:

1. Start Firebase emulators and all three app dev servers with `VITE_USE_EMULATOR=true`.
2. Use the same app ports as Playwright and Vite defaults: Citizen PWA `5173`, Admin Desktop `5175`, Responder App `5174`.
3. Refuse to reuse an existing server unless the harness verifies app identity and port.
4. Seed municipalities, admin user, citizen auth path, responder user, responder custom claims, and responder availability.
5. Submit a report through the Citizen PWA or a browser-level equivalent that exercises the same client write path.
6. Run the manual inbox processor because the local Firestore trigger is known to be unreliable in the emulator.
7. Assert that the manual processor ran: non-zero candidate count before processing, successful exit code, processed count logged, `processedAt` written, and exactly one report materialized.
8. Re-run the manual processor once and assert no duplicate report was created.
9. Verify Admin Desktop, Citizen PWA alerts, and Responder App through the checkpoint assertions above.

The manual processor must be visible in the logs. It should not masquerade as production behavior.

### 5.4 Staging Mode

Staging mode must:

1. Require an explicit staging flag such as `BANTAYOG_PROOF_TARGET=staging` and a non-production project id guard.
2. Preflight all three apps before creating data: app boot succeeds, App Check does not report failure, callable region is `asia-southeast1`, and no console errors match Firebase App Check/Auth configuration failures.
3. Use staging URLs and staging Firebase project settings.
4. Sign in inside the Admin Desktop and Responder App browser contexts. Do not assume a script-authenticated Firebase user is visible to app tabs.
5. Let the Citizen PWA create its own pseudonymous auth state inside its browser context.
6. Do not run the manual inbox processor.
7. Wait for deployed Cloud Functions to materialize `report_inbox`.
8. Use seeded staging test accounts only.
9. Clean up all created documents by exact id in reverse dependency order.
10. If cleanup fails, exit non-zero and print the exact purge command/document ids.

Staging alert messages must be visibly prefixed with `[TEST:<testRunId>]` and must be deleted during cleanup. Staging proof writes require deliberate opt-in; they must never run as an accidental side effect of local testing.

### 5.5 Auth And Scope Strategy

The proof must sign in users in the same browser context that renders each app:

- Citizen PWA: rely on the app's pseudonymous sign-in path.
- Admin Desktop: sign in through the app UI with a seeded municipal admin account.
- Responder App: sign in through the app UI with the seeded responder account.

Before C03, the harness must assert that the admin's custom claims include the test report municipality. Before C07, it must assert that the responder UID equals `dispatches/{dispatchId}.assignedTo.uid`.

### 5.6 Callable Contracts In The Proof

The proof must use the existing callable contracts:

- `dispatchResponder`: `{ reportId, responderUid, idempotencyKey } -> { dispatchId, status, reportId }`. Expected initial dispatch status is `pending`.
- `acceptDispatch`: `{ dispatchId, idempotencyKey } -> { status: "accepted", dispatchId }`. Expected errors include unauthenticated, permission denied, not found, conflict, and rate limited.
- `advanceDispatch`: `{ dispatchId, to, resolutionSummary?, idempotencyKey } -> { status }`. The proof uses `to` values `acknowledged`, `en_route`, and `on_scene`. Resolution is not required in this first spine proof.

Each callable checkpoint must assert both the returned data and the backing `dispatches/{dispatchId}` document state.

### 5.7 Contract Fixes Required Before The Smoke Proof Can Pass

These are not optional follow-ups:

- Alert documents must use the same citizen-visible sort field that the Citizen PWA query orders by. Current recon shows `declareAlertCore` writes `declaredAt` while the shared listener orders by `publishedAt`; Slice 1 must fix this or change both sides to a single shared field with tests.
- The proof command must eliminate port drift. Either update `dev-all` to `5173`/`5175`/`5174` or make the proof harness start its own servers and refuse to use `dev-all`.
- Materialization must remain idempotent. Current code uses `withIdempotency` keyed by inbox id; the proof must lock this behavior with C09.
- The proof must verify role-scoped listener results, not only backing Firestore documents.

Any rule, index, or schema file change requires the risky-change protocol and explicit user approval before editing.

## 6. Failure Output

The proof must emit structured output for every checkpoint:

```json
{
  "testRunId": "proof-20260520-abc123",
  "checkpoint": "C02",
  "status": "failed",
  "target": "local",
  "expected": "reports/{reportId}, report_ops/{reportId}, report_lookup/{publicRef}",
  "observed": {
    "inboxExists": true,
    "processedAt": null,
    "moderationIncidentReason": "payload_schema_invalid"
  },
  "nextHint": "Inspect moderation_incidents/{clientDraftRef} and manual processor output"
}
```

If C02 fails, the output must distinguish at least these cases:

- Inbox doc missing.
- Manual processor did not run or exited non-zero.
- Inbox payload validation failed.
- Materialization wrote a moderation incident.
- `reports` exists but `report_ops` or lookup docs are missing.
- Staging trigger did not complete within the configured timeout.

## 7. Verification Strategy

### 7.1 Fast Contract Tests

Add or adjust focused tests before implementation:

- `declareAlertCore` writes a citizen-visible sort timestamp.
- The Citizen PWA alert listener can read a freshly declared alert document.
- `processInboxItemCore` creates report fields required by Admin Desktop listeners.
- Replaying materialization for the same inbox does not create duplicate reports.
- `dispatchResponder` creates fields required by Responder App listeners.
- `acceptDispatch` and `advanceDispatch` move the backing dispatch document through the expected states.

### 7.2 Full-Loop Smoke Proof

Replace the skipped full-loop placeholder with one executable smoke proof that supports:

- `local` mode: emulators plus manual inbox processor.
- `staging` mode: staging URLs plus deployed Cloud Functions.

The smoke proof should cover only the core loop in this spec. It should not include SMS, media uploads, offline retry, Storage reads, or push notification delivery yet.

### 7.3 Repeatability Proof

Minimum acceptance is three independent proof runs:

- Local: three runs may execute concurrently once the single-run proof is green.
- Staging: three runs may execute serially by default to reduce operational noise, but each must use a unique `testRunId` and cleanup ledger.

All three runs must pass with distinct `clientDraftRef`, `reportId`, `alertId`, and `dispatchId` values. If one run fails, the harness must preserve that run's artifacts and still attempt cleanup for successful runs.

### 7.4 Heavy Traffic Follow-Up

After the repeatable core proof is green, add traffic slices:

1. Citizen report burst: intake accepts load and backlog drains.
2. Alert fanout: Firestore alert visibility remains reliable under many readers.
3. Dispatch contention: only one responder wins where the state machine requires a single winner.
4. Inbox backlog recovery: delayed materialization is observable and recoverable.

Existing k6 scenarios should be reused where they match these checks.

## 8. Implementation Slices

### Slice 1: Make The Core Contracts True

Fix the blocking contract mismatches:

- Alert timestamp mismatch (`publishedAt` vs `declaredAt`).
- Proof port drift (`dev-all` vs Playwright/Vite ports).
- Manual processor output/exit assertions.
- Materialization replay assertion.

### Slice 2: Local Proof Command

Create a repeatable local proof that starts or reuses local services only after identity checks, seeds required data, runs the core loop, and prints checkpoint results.

### Slice 3: Staging Proof Mode

Point the same proof at staging test accounts and staging URLs. Add App Check/Auth preflight, explicit staging opt-in, exact-id cleanup, and failure artifact preservation.

### Slice 4: Follow-Up Channel Specs

Write separate small specs or plans for SMS, media uploads, offline retry, FCM delivery, Storage-backed media reads, and load. Each should have its own pass/fail proof.

## 9. Success Criteria

- One command or documented script path can prove the local core loop.
- One command or documented script path can prove the staging core loop.
- A failed proof identifies the first broken checkpoint with structured observed state.
- Citizen alert visibility does not depend on FCM push.
- Admin report visibility does not depend on tribal knowledge of manual emulator steps.
- Responder dispatch visibility is included in the same proof.
- Port drift cannot cause the proof to test the wrong server.
- Staging proof artifacts are cleaned up by exact id, or the run fails with purge instructions.

## 10. Implementation Planning Decisions

- Use Playwright for user-visible steps and Firestore assertions for hidden checkpoints.
- Keep the proof command responsible for the ports it uses, so it cannot silently target a different dev server than the one it started.
- Clean up test artifacts on success.
- Preserve test artifacts on failure so the first broken checkpoint can be inspected in the emulator or staging console.
- Treat media, SMS, offline retry, FCM push delivery, and Storage reads as follow-up slices, not hidden requirements of the first spine proof.
