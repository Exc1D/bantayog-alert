# Phase 1 Progress

## 2026-06-08 - Phase 1L Admin Rejection Notes

- Added an optional Admin note control to the `/triage` workbench and threaded trimmed notes into existing `rejectReport` calls.
- Kept the slice on the existing callable contract: blank notes are omitted, notes remain capped at the backend's 500-character limit, and verify actions were not changed because the Admin wrapper does not expose verification notes.
- Verification: red-first `TriagePage` test failed on the missing Admin note control, then `pnpm --dir apps/admin-desktop exec vitest run src/pages/TriagePage.test.tsx` passed.

## 2026-06-08 - Phase 1K Responder Status Queue

- Expanded Admin dispatch lifecycle reads to include active field statuses: `acknowledged`, `en_route`, and `on_scene`.
- Added a read-only `/dispatches` responder status queue so Admin operators can see accepted/acknowledged/en-route/on-scene progress without mutating responder state.
- Verification: red-first hook test failed on the missing lifecycle query statuses, red-first page test failed on the missing status queue, then `pnpm --dir apps/admin-desktop exec vitest run src/hooks/useDispatchLifecycle.test.ts` and `pnpm --dir apps/admin-desktop exec vitest run src/__tests__/DispatchMonitorPage.test.tsx` passed.

## 2026-06-08 - Phase 1J Triage Stale Data Messaging

- Added a triage-specific stale-data banner when the `/triage` queue has not refreshed for more than five minutes.
- Kept listener error/offline handling on the existing `OfflineBanner`; the new stale banner is a degraded-data warning rather than a blocking error.
- Verification: red-first fake-timer test failed on the missing stale status, then `pnpm --dir apps/admin-desktop exec vitest run src/pages/TriagePage.test.tsx`, focused triage/header/table tests, Admin Desktop typecheck, and Admin Desktop lint passed.

## 2026-06-08 - Phase 1I Basic Incident Export

- Added a basic CSV export button to Admin `/triage` that downloads the currently visible filtered triage rows.
- Kept export intentionally limited to non-private operational fields already visible to operators: report ID, type, severity, status, municipality, barangay, description, and created time.
- Verification: red-first CSV export test failed on the missing builder, then `pnpm --dir apps/admin-desktop exec vitest run src/pages/TriagePage.test.tsx`, focused triage/header/table tests, Admin Desktop typecheck, and Admin Desktop lint passed.

## 2026-06-08 - Phase 1H Rejection Reason Selection

- Added a rejection-reason selector to the Admin `/triage` workbench and threaded the selected reason into single and bulk `rejectReport` calls.
- Preserved the existing default `insufficient_detail` reason, so current behavior remains the default until an operator chooses `duplicate`, `obviously_false`, or `test_submission`.
- Verification: red-first `TriagePage` test failed on the missing rejection selector, then `pnpm --dir apps/admin-desktop exec vitest run src/pages/TriagePage.test.tsx`, focused triage/header/table tests, Admin Desktop typecheck, and Admin Desktop lint passed.

## 2026-06-08 - Phase 1G Triage Filters

- Added local filters to the Admin `/triage` workbench for status, severity, report type, and free-text search across summary/place/type/report ID.
- Kept the slice frontend-only and command-safe: scoped Firestore reads, verify/reject callables, bulk actions, and Map routing are unchanged; changing filters clears selected rows so hidden rows cannot be bulk-commanded accidentally.
- Verification: red-first `TriagePage` test failed on missing filter controls, then `pnpm --dir apps/admin-desktop exec vitest run src/pages/TriagePage.test.tsx`, focused triage/header/table tests, Admin Desktop typecheck, and Admin Desktop lint passed.

## 2026-06-08 - Phase 1F Demo Seed/Reset Scripts

- Added local demo seed/reset/reseed package scripts around the existing fixed-ID Camarines Norte incident seed data.
- Extended the seed companion script with explicit reset paths for seeded `reports`, `report_ops`, `dispatches`, and `alerts`, guarded so resets only run against a Firestore emulator.
- Kept this slice local-demo only: no production/staging reset command, no broad collection wipe, no Firestore rules/index edits, no backend callable changes, and no deploy.
- Verification: `pnpm exec vitest run scripts/dev-all.ports.test.ts scripts/seed-staging-incidents.test.ts` passed 13 tests; `firebase emulators:exec --only firestore 'pnpm demo:reseed'` reset 26 fixed demo docs and seeded 10 reports, 10 `report_ops`, 1 dispatch, and 5 alerts; root TypeScript passed. The focused script ESLint command completed but reported both seed files are ignored by the repo ignore pattern, so there is no lint coverage for these script files yet.

## 2026-06-08 - Phase 1E MVP Firestore Rule Tests

- Added `mvp-loop.rules.test.ts` to cover the MVP security spine across reporter tracking reads, anonymous public lookup recovery, municipal verified-report assignment queries, and callable-only dispatch creation.
- Kept this slice test-only: no `firestore.rules`, rules template, Firestore index, backend callable, schema/migration, or deploy changes.
- Verification: `firebase emulators:exec --only firestore 'npx vitest run src/__tests__/rules/mvp-loop.rules.test.ts'` passed 5 tests; `firebase emulators:exec --only firestore 'npx vitest run src/__tests__/rules'` passed 28 files / 220 tests; Functions typecheck and lint passed.

## 2026-06-08 - Phase 1D Responder Assignment Screen

- Added a first-dispatch responder assignment queue to the existing `/dispatches` Ops surface, so verified reports can be assigned without hunting through the map panel.
- Reused existing scoped report listeners, responder fleet data, `dispatchResponder`, idempotency keys, and success/error banners; re-dispatch monitoring remains unchanged.
- Kept this slice frontend-only: no new route, backend callable, Firestore rules/index edits, schema/migration files, responder mobile changes, auto-ranking, or deploy config.
- Verification so far: red-first `DispatchMonitorPage` test failed on the missing assignment queue, then focused dispatch monitor/map/triage tests passed; Admin Desktop typecheck and lint passed.

## 2026-06-08 - Phase 1C Citizen Tracking Timeline

- Replaced the Citizen PWA own-report progress strip with a status-derived tracking timeline in the detail sheet, using only existing citizen-safe `MyReport` fields.
- Covered active responder progress and terminal rejected outcomes so the timeline does not imply pending dispatch after a report is not accepted.
- Kept this slice frontend-only: no Firestore rules, backend callables, public projections, schema/migration files, deploy config, or new dependencies.
- Verification so far: red-first `DetailSheet` tests failed on the missing timeline/terminal outcome, then `pnpm --dir apps/citizen-pwa exec vitest run src/components/MapTab/DetailSheet.test.tsx`, `pnpm --dir apps/citizen-pwa exec tsc --noEmit`, and `pnpm --dir apps/citizen-pwa exec eslint src` passed.

## 2026-06-08 - Phase 1B Admin Triage Workbench

- Added `/triage` as a dedicated Admin Desktop workbench for scoped incoming reports, using the existing Firestore listener, `TriageQueueTable`, and command callables for review/verify/reject actions.
- Added the Triage command tab so operators can reach the workbench from the shared command header, and added report summaries to the triage table so rows are actionable without jumping back to Dashboard.
- Kept dispatch ownership on the Map: verified triage rows route to `/map?reportId=...` instead of assigning responders inside triage.
- Verification so far: red-first `TriagePage` test failed on the missing page, then `TriagePage`, `CommandHeader`, and `TriageQueueTable` focused tests passed; Admin Desktop typecheck, lint, and the full `pnpm --dir apps/admin-desktop exec vitest run` suite passed.

## 2026-06-07 - Phase 1A Citizen Report Form Improvements

- Added the MVP Citizen report fields: short description, people injured, people trapped, location confidence, and optional urgency reason.
- Replaced the Citizen wizard's hardcoded severity with `deriveReportSeverity`, using trapped/injured signals plus incident type.
- Preserved the existing three-step wizard, local draft, offline retry, idempotency, public reference, secret, and photo behavior.
- Added triage payload persistence from wizard snapshot to draft, callable submission, shared validator schema, and `report_ops` materialization.
- Kept Phase 1A narrow: no admin triage console, SMS work, Firestore rules/index edits, deploy config, or new dependencies.

## Next

- Phase 1 P0/P1 tracked backlog is implemented. Keep Phase 2 work behind explicit scope, especially CAP alerts, hazard overlays, clustering, mutual aid, SMS, and export pipelines.
