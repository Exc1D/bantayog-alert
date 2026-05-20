# Design Spec: Reliability Spine For Cross-App Proof

**Date:** 2026-05-20
**Status:** Approved for implementation planning
**Owner:** Senior Pragmatic Engineer (AI)

## 1. Problem

Bantayog Alert has many pieces that look complete in isolation, but the basic cross-app loop is still hard to trust. A citizen report can appear successful in the PWA without showing up in Admin Desktop. An admin alert can be written by the backend without appearing in the Citizen PWA. The responder app has not been tested as part of the same loop.

The current failure mode is unacceptable for an emergency system: a user sees success, an operator sees nothing, and the team has to debug by memory. We need one boring proof path that says whether the product works.

## 2. Goal

Build a Reliability Spine for the core loop:

```
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

### 5.3 Staging Mode

Staging mode should run the same scenario against staging config.

1. Use staging URLs and staging Firebase project settings.
2. Do not run the manual inbox processor.
