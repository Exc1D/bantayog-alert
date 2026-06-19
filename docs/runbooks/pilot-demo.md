# Pilot Demo Runbook

## 1. Purpose

This runbook walks a developer, demo operator, or LGU evaluator through the full Bantayog Alert MVP incident lifecycle on a local emulator setup.

### What this demo proves

- A citizen can submit a disaster report through the PWA.
- An admin can triage, verify, and dispatch a responder from the Admin Desktop.
- A responder can accept the dispatch and advance through status stages.
- The citizen sees a safe tracking timeline of the incident.
- The backend enforces status transitions, data shapes, and PII separation in core function behavior.

### What it does not prove

- Production reliability, scalability, or real-world response time.
- SMS outbound notifications.
- CAP-compatible public alerting.
- Hazard overlays or duplicate clustering.
- Agency coordination, mutual aid, or BigQuery audit export.
- PostGIS runtime migration.
- Any guarantee of actual emergency response.

## 2. Prerequisites

- **Node:** `>=20.0.0 <21.0.0` for root/apps; Functions require Node 22 (matches `engines.node` in `functions/package.json` and `runtime: "nodejs22"` in `firebase.json`)
- **pnpm:** `>=9.0.0`
- **Firebase CLI:** `firebase --version` should report a recent version (13.x or later).
- **OS:** macOS, Linux, or WSL2 recommended.
- **Browsers:** Chrome or Chromium-based browser for responder-app mobile simulation.

## 3. Commands

### One-shot: install

```bash
pnpm install
```

### One-shot: typecheck, build, lint

```bash
pnpm typecheck
pnpm build
pnpm lint
```

### Start the full local stack

```bash
pnpm dev:all
```

This starts in parallel:

- Firebase emulators (Auth 9099, Firestore 8081, RTDB 9000, Storage 9199, Functions 5001)
- citizen-pwa at http://localhost:5173
- responder-app at http://localhost:5174
- admin-desktop at http://localhost:5175
- seeds demo accounts automatically

Wait ~20 seconds for all ports to be ready. Press **Ctrl-C once** to shut everything down cleanly.

### Reset demo data

```bash
pnpm demo:reset
```

Requires `FIRESTORE_EMULATOR_HOST=127.0.0.1:8081`. This deletes only the known seed documents.

### Run staging seed (real staging project)

```bash
# Requires GOOGLE_APPLICATION_CREDENTIALS
pnpm staging:seed
```

**Safety guards:**

- Refuses to run if `FIRESTORE_EMULATOR_HOST` is set.
- Refuses to run against production project `bantayog-alert`.
- Requires `GOOGLE_APPLICATION_CREDENTIALS` or active gcloud auth.

Seeds the same 10 reports, 5 alerts, and demo accounts into the **staging** Firebase project (`bantayog-alert-staging`).

### Reset staging data

```bash
pnpm staging:reset
```

Same safety guards. Deletes only the known seed documents from staging.

### Run the staging callable lifecycle proof (deployed callables)

```bash
# Requires GOOGLE_APPLICATION_CREDENTIALS plus the three env vars below.
GOOGLE_APPLICATION_CREDENTIALS=path/to/staging-sa.json \
STAGING_FIREBASE_API_KEY=<web api key> \
STAGING_FIREBASE_APP_ID=<web appId, e.g. 1:...:web:...> \
STAGING_APP_CHECK_DEBUG_TOKEN=<registered App Check debug token> \
  pnpm staging:callable-proof
```

Drives the full MVP loop through the **deployed** HTTPS callables on
`bantayog-alert-staging` (not emulators): `submitCitizenReport` →
`verifyReport` ×2 → `dispatchResponder` → `acceptDispatch` →
`advanceDispatch` (acknowledged → en_route → on_scene → resolved). It mints
custom tokens for the citizen/admin/responder actors, exchanges the App Check
debug token, sets the responder shift in RTDB, asserts the final report and
dispatch state plus PII isolation via the Admin SDK, then deletes everything it
created.

**Safety guards** match `staging:seed` (refuses emulators, refuses production,
requires ADC). **Required env** fails loudly when missing. Keep the App Check
debug token and API key in local env vars only — never commit them.

> Drift from the emulator `proof:mvp-loop`: the deployed `dispatchResponder`
> requires the responder to be **on shift** in RTDB
> (`/responder_index/daet/bfp-responder-test-01.isOnShift === true`).
> `staging:seed` does not seed shift state, so this proof sets it explicitly
> before dispatching.

### Backend-only operations

These callables are intentionally not exposed as Admin Desktop UI actions for the pilot. Invoke them only through a deployed callable client or operator harness with App Check, an authenticated operator, and an `idempotencyKey` when the payload requires one.

| Callable                                       | Who may invoke                                                                                         | Payload                                                                                                                      | Operational use                                                                |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `setRetentionExempt`                           | `provincial_superadmin` + MFA; document municipality must be permitted by claims                       | `collection`, `documentId`, `exempt`, `reason`                                                                               | Mark a supported document exempt or not exempt from retention automation.      |
| `setErasureLegalHold`                          | `provincial_superadmin` + MFA                                                                          | `erasureRequestId`, `hold`, `reason`                                                                                         | Place or clear a legal hold on a non-terminal erasure request.                 |
| `approveErasureRequest`                        | `provincial_superadmin` + MFA                                                                          | `erasureRequestId`, `approved`, optional `reason`                                                                            | Approve or deny a pending RA10173 erasure request.                             |
| `suspendUser` / `revokeUser` / `resetUserTotp` | `provincial_superadmin` or same-municipality `municipal_admin`; cannot manage a provincial superadmin  | `uid`, `idempotencyKey`                                                                                                      | Staff account governance and MFA reset.                                        |
| `createUser`                                   | Active `provincial_superadmin`                                                                         | `displayName`, `phone`, `role`, optional `municipalityId`, optional `agencyId`, optional `specializations`, `idempotencyKey` | Provision a non-responder staff account.                                       |
| `suspendResponder` / `revokeResponder`         | Active `agency_admin` for the responder's agency                                                       | `uid`, `idempotencyKey`                                                                                                      | Responder account governance.                                                  |
| `bulkAvailabilityOverride`                     | Active `agency_admin` for the responder agency                                                         | `uids`, `status`, `idempotencyKey`                                                                                           | Batch-set responder availability to `available`, `unavailable`, or `off_duty`. |
| `cancelDispatch`                               | Active `municipal_admin` or `provincial_superadmin`; dispatch must be in the actor municipality        | `dispatchId`, `reason`, `idempotencyKey`                                                                                     | Cancel a non-terminal dispatch and release its report when safe.               |
| `closeReport`                                  | Active `municipal_admin` or `provincial_superadmin`; municipal admins are scoped to their municipality | `reportId`, `idempotencyKey`, optional `closureSummary`                                                                      | Close a resolved report and cancel any still-active dispatch.                  |
| `reopenReport`                                 | Active `municipal_admin` or `provincial_superadmin`; municipal claims scope report access              | `reportId`, `reason`, `idempotencyKey`                                                                                       | Reopen a closed report with an audit reason.                                   |
| `mergeDuplicates`                              | Active `municipal_admin` or `provincial_superadmin`; municipal admins are scoped to their municipality | `primaryReportId`, `duplicateReportIds`, `idempotencyKey`                                                                    | Merge clustered duplicate reports into the primary report.                     |

### Seed demo data

```bash
pnpm demo:seed
```

Seeds 10 reports, 10 `report_ops`, 1 dispatch, and 5 alerts with Camarines Norte data. Idempotent — re-runs overwrite.

### Run the MVP lifecycle proof (backend-only)

```bash
pnpm proof:mvp-loop
```

Runs a deterministic backend test that exercises verify → dispatch → accept → advance → resolve and asserts final state. Requires emulators.

### Run the full browser-based reliability proof

```bash
pnpm proof:local
```

Starts the stack, runs Playwright E2E tests, and shuts down. Heavier; requires all apps + emulators.

## 4. Demo Accounts

| Role            | Email                            | Password   | UID                   |
| --------------- | -------------------------------- | ---------- | --------------------- |
| Municipal Admin | daet-admin-test-01@test.local    | test123456 | daet-admin-test-01    |
| Responder       | bfp-responder-test-01@test.local | test123456 | bfp-responder-test-01 |
| Citizen         | _(anonymous — no login)_         | —          | —                     |

These accounts are created by `scripts/seed-demo-accounts.ts` during `pnpm dev:all` startup.

## 5. App URLs (local)

| App           | URL                   |
| ------------- | --------------------- |
| Citizen PWA   | http://localhost:5173 |
| Responder App | http://localhost:5174 |
| Admin Desktop | http://localhost:5175 |
| Emulator UI   | http://127.0.0.1:4000 |

## 6. Demo Scenario

**Narrative:** Heavy rainfall in Daet causes flooding near Bagasbas Creek. A resident submits a report. The Daet MDRRMO triages and dispatches a BFP responder, who updates status as they respond and resolve.

### Step-by-step

| Step | Actor     | Action                                                                                                                  | Expected State                                                                                                                  |
| ---- | --------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| 1    | Citizen   | Open http://localhost:5173, tap **Report**, choose **Flood**, fill description, pick Daet, submit.                      | Citizen sees confirmation with tracking ref. `report_lookup/{ref}` and `reports/{id}` created with status `new`.                |
| 2    | Admin     | Open http://localhost:5175, sign in as `daet-admin-test-01`. Navigate to **/triage**. Find the new report.              | Report visible in triage queue with status `new`.                                                                               |
| 3    | Admin     | Select report, tap **Verify** (twice: new → awaiting_verify → verified).                                                | Report status becomes `verified`. `report_events` has two status events.                                                        |
| 4    | Admin     | On the map or dispatch queue, select the verified report, pick responder `bfp-responder-test-01`, hold to **Dispatch**. | `dispatches/{reportId}_{responderUid}` created with status `pending`. Report status becomes `assigned`.                         |
| 5    | Responder | Open http://localhost:5174, sign in as `bfp-responder-test-01`. Tap **Dispatches**, open the new dispatch.              | Dispatch detail shows status `pending` with Accept button.                                                                      |
| 6    | Responder | Tap **Accept**.                                                                                                         | Dispatch status → `accepted`. Report status mirrors → `acknowledged`.                                                           |
| 7    | Responder | Tap **Acknowledged** → **En Route** → **On Scene**.                                                                     | Each advance writes `dispatch_events` and mirrors to `report_events`. Report follows: `acknowledged` → `en_route` → `on_scene`. |
| 8    | Responder | Tap **Resolve**, enter summary: _"Flooding contained, no injuries. Area secured."_                                      | Dispatch status → `resolved`. Report status → `resolved`. `resolutionSummary` and `resolvedAt` stored on dispatch.              |
| 9    | Citizen   | Return to PWA, enter tracking ref, view report.                                                                         | Citizen sees tracking timeline ending in "Resolved". No responder names, admin notes, or dispatch IDs visible.                  |

### Expected final state

- **Admin view:** `/triage` no longer shows the report (resolved reports leave the triage queue). `/dispatches` shows dispatch as `resolved`.
- **Responder view:** Dispatch detail shows final status `resolved` with resolution summary.
- **Citizen view:** Tracking page shows timeline through New → Verified → Dispatched → Resolved. No privileged fields.
- **Firestore:**
  - `reports/{id}`: status `resolved`, `lastStatusAt` set, `lastStatusBy` is responder UID.
  - `dispatches/{id}`: status `resolved`, `resolvedAt` set, `resolutionSummary` present, 8 dispatch events.
  - `report_events`: 7 events total.
  - `report_lookup/{ref}`: only `reportId` and `publicTrackingRef` — no `assignedTo`, `responderUid`, `resolutionSummary`, `dispatchId`.

## 7. Reset Procedure

```bash
# 1. Stop all running processes (Ctrl-C in the dev:all terminal)
# 2. Reset demo data
pnpm demo:reset

# 3. Reseed
pnpm demo:seed

# 4. Restart stack if needed
pnpm dev:all
```

Or, reset only (no reseed):

```bash
pnpm demo:reset
```

## 8. Troubleshooting

### Emulator unavailable / tests skipped

**Symptom:** Test output says "Emulator unavailable; tests will skip."
**Fix:** Start emulators first: `pnpm emulators` or `pnpm dev:all`. Run `firebase emulators:start --only firestore,database` separately if the full stack is not running.

### Stale functions/lib after source edit

**Symptom:** `FirebaseError: internal` or unexpected behavior.
**Fix:** Rebuild functions: `pnpm --dir functions exec tsc --noEmit` then `pnpm build` or `pnpm --dir functions exec tsc`.

### Wrong Functions region

**Symptom:** Callables return "unauthenticated" even with valid auth.
**Fix:** All functions deploy to `asia-southeast1`. Verify client requests target the correct region, not `us-central1`.

### Firestore/RTDB port mismatch

**Symptom:** `ECONNREFUSED 127.0.0.1:8081` or `9000`.
**Fix:** Confirm emulators are running on expected ports. Check `firebase.json` emulator config. Clear zombie Java processes: `killall java` or `pkill -f cloud-firestore-emulator`.

### Demo data not reset

**Symptom:** Old reports still appear after reset.
**Fix:** `demo:reset` only deletes known seed documents. If manual data was created outside the seed script, it persists. Use the Firestore Emulator UI (port 4000) to delete manually, or run `pnpm demo:reset && pnpm demo:reseed`.

### App fails to load on first boot

**Symptom:** Vite dev server shows blank page or "cannot connect".
**Fix:** Wait longer on first boot (up to 60s for Admin Desktop). Refresh the page. Check the dev server logs in the `dev:all` terminal for build errors.

## 9. Known Limitations

### Deployment & Environment

- **Staging environment exists with scoped safety guards.** `pnpm staging:seed` and `pnpm staging:reset` target the real staging project `bantayog-alert-staging`, but they refuse to run when `FIRESTORE_EMULATOR_HOST` is set, refuse production project `bantayog-alert`, and require `GOOGLE_APPLICATION_CREDENTIALS` or active gcloud auth. Seed and reset only affect the known seed documents; other data in the staging project is untouched.
- **Not a national emergency alert replacement.** This is a municipal LGU coordination tool, not a life-saving guaranteed-response system.

### Alerts & Notifications

- **Not implemented:** SMS outbound updates, CAP-compatible alerting, or automated public notification channels. Alerts are Firestore documents; citizens must check the PWA manually.

### Mapping & Geospatial

- **Clustering and hazard overlays not implemented.** Two reports of the same flood remain separate unless manually merged, and hazard zones are not rendered on the map.
- **PostGIS runtime not migrated.** Geospatial queries use Firestore `locationGeohash`.

### Agency Coordination & Responder Features

- **Single-agency dispatch only.** BFP responders only; multi-agency coordination and cross-municipality mutual aid are not supported in the demo seed.
- **Background GPS and offline queue not implemented.** Responder location updates and status changes require an active app connection.

### Data & Export

- **No BigQuery or audit-grade export.** CSV export is frontend-only from the triage table; no backend compliance pipeline exists.

## 10. Related Runbooks

- [Rollback Runbook](./rollback.md) — Reverting bad deploys and data mutations.
- [Incident Response Runbook](./incident-response.md) — Who to call, what to check, and how to escalate during a system failure.
- [Data Privacy Runbook](./data-privacy.md) — PII locations, retention policy, erasure procedures, and compliance checklist.
