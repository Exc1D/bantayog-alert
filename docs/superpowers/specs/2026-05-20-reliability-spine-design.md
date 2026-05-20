# Design Spec: Reliability Spine For Cross-App Proof

**Date:** 2026-05-20
**Status:** Approved for implementation planning
**Owner:** Senior Pragmatic Engineer (AI)

## 1. Problem

Bantayog Alert has many pieces that look complete in isolation, but the basic cross-app loop is still hard to trust. A citizen report can appear successful in the PWA without showing up in Admin Desktop. An admin alert can be written by the backend without appearing in the Citizen PWA. The responder app has not been tested as part of the same loop.

The current failure mode is unacceptable for an emergency system: a user sees success, an operator sees nothing, and the team has to debug by memory. We need one boring proof path that says whether the product works.

## 2. Goal

Build a Reliability Spine for the core loop:

```text
Citizen PWA submits report
  -> report_inbox receives valid intake doc
  -> backend materializes reports/report_ops/lookup docs
  -> Admin Desktop sees the report
  -> Admin Desktop declares an alert
  -> Citizen PWA sees the alert from Firestore
  -> Admin Desktop dispatches a responder
  -> Responder App sees and progresses the dispatch
```

The first implementation plan should make this loop repeatable locally and against staging. Local development may use an explicit inbox-processing workaround for the known Firebase emulator trigger bug. Staging must rely on deployed Cloud Functions.

## 3. Non-Goals

- Do not rewrite all Firebase setup across apps.
- Do not edit Firestore, Realtime Database, Storage rules, indexes, or schema files in this slice.
- Do not deploy as part of implementation without explicit fresh approval.
- Do not solve SMS, media uploads, offline retry, or FCM delivery in the first implementation slice.
- Do not load test until the proof loop can pass deterministically.

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

The responder app listens to `dispatches` where `assignedTo.uid` matches the responder and status is active. Dispatch creation must produce the fields used by this query and by the responder state machine.

### 4.5 Test Harness Drift

`scripts/dev-all.mjs` starts Admin Desktop on `4173` and Responder App on `3001`, while the E2E Playwright config expects `5175` and `5174`. Any proof command must remove or document this drift so engineers do not test the wrong server.

## 5. Design

### 5.1 Canonical Checkpoints

The proof harness should assert each checkpoint separately:

1. `report_inbox/{clientDraftRef}` exists after citizen submission.
2. `reports/{reportId}` exists after materialization.
3. Admin Desktop renders the materialized report for the signed-in admin scope.
4. `alerts/{alertId}` exists with the timestamp field the Citizen PWA query orders by.
5. Citizen PWA renders the alert from Firestore.
6. `dispatches/{dispatchId}` exists with `assignedTo.uid`, `status`, `reportId`, and `dispatchedAt`.
7. Responder App renders the dispatch.
8. Responder callable actions can accept and progress the dispatch.

The failure output should name the first failed checkpoint. A timeout without context is a bug in the proof harness.

### 5.2 Local Mode

Local mode should:

1. Start Firebase emulators and all three app dev servers with `VITE_USE_EMULATOR=true`.
2. Seed municipalities, admin user, citizen auth path, responder user, and responder availability.
3. Submit a report through the Citizen PWA or a browser-level equivalent that exercises the same client write path.
4. Run the manual inbox processor because the local Firestore trigger is known to be unreliable in the emulator.
5. Verify Admin Desktop, Citizen PWA alerts, and Responder App through the UI or explicit Firestore-backed assertions.

The manual processor must be visible in the logs. It should not masquerade as production behavior.

### 5.3 Staging Mode

Staging mode should run the same scenario against staging config:

1. Use staging URLs and staging Firebase project settings.
2. Do not run the manual inbox processor.
3. Wait for deployed Cloud Functions to materialize `report_inbox`.
4. Use seeded staging test accounts only.
5. Clean up test artifacts when the scenario finishes.

Staging mode may be slower, but it must prove the real deployed integration path.

### 5.4 Data Contract Fixes Expected In Implementation

The implementation plan should include small contract fixes if recon confirms they are still present:

- Alert docs must include the field the Citizen PWA orders by, or the Citizen PWA query must order by the field the backend actually writes. Prefer one shared field name with a contract test.
- The proof command must align app ports between `dev-all` and Playwright, or the command must own its own server startup.
- Report materialization tests must assert the fields consumed by admin listeners.
- Dispatch creation tests must assert the fields consumed by responder listeners.

Any rule, index, or schema file change requires the risky-change protocol and explicit user approval before editing.

## 6. Error Handling

- Inbox validation failures should create or preserve a readable moderation incident.
- Local trigger failures should direct engineers to the manual processor instead of looking like a successful end-to-end pass.
- Alert creation success should mean Firestore visibility. Push notification failures should be logged but must not fail alert creation.
- Responder actions should be idempotent, using existing idempotency keys where available.
- The smoke proof should stop at the first broken checkpoint and print the collection/document or UI selector it expected.

## 7. Verification Strategy

### 7.1 Fast Contract Tests

Add or adjust focused tests before implementation:

- `declareAlertCore` writes a citizen-visible sort timestamp.
- The Citizen PWA alert listener can read a freshly declared alert document.
- `processInboxItemCore` creates report fields required by Admin Desktop listeners.
- Dispatch creation creates fields required by Responder App listeners.

### 7.2 Full-Loop Smoke Proof

Replace the skipped full-loop placeholder with one executable smoke proof that supports:

- `local` mode: emulators plus manual inbox processor.
- `staging` mode: staging URLs plus deployed Cloud Functions.

The smoke proof should cover only the core loop in this spec. It should not include SMS, media uploads, offline retry, or push notification delivery yet.

### 7.3 Heavy Traffic Follow-Up

After the core proof is green, add traffic slices:

1. Citizen report burst: intake accepts load and backlog drains.
2. Alert fanout: Firestore alert visibility remains reliable under many readers.
3. Dispatch contention: only one responder wins where the state machine requires a single winner.
4. Inbox backlog recovery: delayed materialization is observable and recoverable.

Existing k6 scenarios should be reused where they match these checks.

## 8. Implementation Slices

### Slice 1: Make The Core Contracts True

Fix the smallest set of contract mismatches found during implementation recon. Expected candidates are alert timestamp naming and dev server port drift.

### Slice 2: Local Proof Command

Create a repeatable local proof that starts or reuses local services, seeds required data, runs the core loop, and prints checkpoint results.

### Slice 3: Staging Proof Mode

Point the same proof at staging test accounts and staging URLs. Keep cleanup explicit.

### Slice 4: Follow-Up Channel Specs

Write separate small specs or plans for SMS, media uploads, offline retry, FCM delivery, and load. Each should have its own pass/fail proof.

## 9. Success Criteria

- One command or documented script path can prove the local core loop.
- One command or documented script path can prove the staging core loop.
- A failed proof identifies the first broken checkpoint.
- Citizen alert visibility does not depend on FCM push.
- Admin report visibility does not depend on tribal knowledge of manual emulator steps.
- Responder dispatch visibility is included in the same proof.

## 10. Implementation Planning Decisions

- Use Playwright for user-visible steps and Firestore assertions for hidden checkpoints.
- Keep the proof command responsible for the ports it uses, so it cannot silently target a different dev server than the one it started.
- Clean up test artifacts on success.
- Preserve test artifacts on failure so the first broken checkpoint can be inspected in the emulator or staging console.
