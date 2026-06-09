# Pilot Demo Runbook

## 1. Purpose

This runbook walks a developer, demo operator, or LGU evaluator through the full Bantayog Alert MVP incident lifecycle on a local emulator setup.

### What this demo proves

- A citizen can submit a disaster report through the PWA.
- An admin can triage, verify, and dispatch a responder from the Admin Desktop.
- A responder can accept the dispatch and advance through status stages.
- The citizen sees a safe tracking timeline of the incident.
- The backend enforces status transitions, rules, and PII separation.

### What it does not prove

- Production reliability, scalability, or real-world response time.
- SMS outbound notifications.
- CAP-compatible public alerting.
- Hazard overlays or duplicate clustering.
- Agency coordination, mutual aid, or BigQuery audit export.
- PostGIS runtime migration.
- Any guarantee of actual emergency response.

## 2. Prerequisites

- **Node:** `>=20.0.0 <21.0.0`
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
| 8    | Responder | Tap **Resolve**, enter summary: _"Flooding contained, no injuries. Area secured."_                                      | Dispatch status → `resolved`. Report status → `resolved`. `resolutionSummary` stored on dispatch.                               |
| 9    | Citizen   | Return to PWA, enter tracking ref, view report.                                                                         | Citizen sees tracking timeline ending in "Resolved". No responder names, admin notes, or dispatch IDs visible.                  |

### Expected final state

- **Admin view:** `/triage` shows report as `resolved`. `/dispatches` shows dispatch as `resolved`.
- **Responder view:** Dispatch detail shows final status `resolved` with resolution summary.
- **Citizen view:** Tracking page shows timeline through New → Verified → Dispatched → Resolved. No privileged fields.
- **Firestore:**
  - `reports/{id}`: status `resolved`, `resolvedAt` set, `lastStatusBy` is responder UID.
  - `dispatches/{id}`: status `resolved`, `resolutionSummary` present, 8 dispatch events.
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

- **Local demo only.** No production deployment. No staging seed/reset safety guards.
- **Not a national emergency alert replacement.** This is a municipal LGU coordination tool.
- **No SMS outbound updates.** Citizens must check the PWA manually for tracking updates.
- **No CAP-compatible alerting.** Alerts are Firestore documents, not CAP XML.
- **No hazard overlays.** Map shows reports and responders; hazard zones are not implemented.
- **No duplicate clustering.** Two reports of the same flood remain separate unless manually merged.
- **No agency coordination.** Only single-agency (BFP) responder dispatch in this demo.
- **No mutual aid.** Cross-municipality dispatch is not supported in the demo seed.
- **No BigQuery/audit export.** CSV export is frontend-only from the triage table.
- **No PostGIS runtime migration.** Geospatial queries use Firestore `locationGeohash`.
- **No background responder GPS.** Responder location requires active app usage.
- **No offline responder queue.** Status updates require active connection.
