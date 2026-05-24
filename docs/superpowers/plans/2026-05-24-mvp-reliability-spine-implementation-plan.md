# MVP Reliability Spine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a robust, testable MVP path where citizens submit reports, admins verify and dispatch them, all roles can view a Facebook-familiar public incident feed, and municipal/provincial admins can declare official alerts.
**Architecture:** Preserve the existing server-authoritative callable flow. `submitCitizenReport` is the primary online path, `report_inbox` is the offline/service-worker replay path, `verifyReport` owns `new -> awaiting_verify -> verified`, and `dispatchResponder` owns `verified -> assigned`. Remove stale SMS/NDRRMC/break-glass surface area without rebuilding the backend around features that are being canceled or deferred.
**Tech Stack:** React 18, Vite, Firebase Auth/Firestore/RTDB/Functions, Vitest, Firestore rules tests, TypeScript strict mode, existing app CSS/Tailwind conventions.

---

## Operating Constraints

- Do not edit `infra/firebase/firestore.rules`, `infra/firebase/firestore.rules.template`, Firestore indexes, RTDB rules, storage rules, or schema/migration files until the exact diff is shown to the user and the user replies with explicit `proceed`.
- Ignore generated `lib/` artifacts during cleanup searches. Delete or edit only `src/`, app source, package source, docs, and tests. Rebuild generated output through package commands.
- Do not revert the existing local changes in:
  - `apps/admin-desktop/src/app/firebase.ts`
  - `apps/responder-app/src/app/firebase.ts`
  - `docs/learnings.md`
  - `scripts/phase-4a/bootstrap.ts`
- No deploy commands in this plan.
- Keep each implementation commit focused on one slice.

## External References Checked

- Firestore query listeners, ordering, and limits: https://firebase.google.com/docs/firestore/query-data/listen and https://firebase.google.com/docs/firestore/query-data/order-limit-data
- Callable Functions client error behavior: https://firebase.google.com/docs/functions/callable and https://firebase.google.com/docs/functions/callable-reference

## Current Repo Facts

- `apps/citizen-pwa/src/hooks/useSubmissionMachine.ts` already calls the online `submitCitizenReport` callable.
- `apps/citizen-pwa/public/sw.js` already contains service-worker Background Sync replay to `report_inbox`.
- `functions/src/domains/reports/submit-citizen-report.ts` and `functions/src/domains/reports/process-inbox-item.ts` share report materialization and idempotency guards.
- `functions/src/domains/reports/verify-report.ts` only supports `new -> awaiting_verify` and `awaiting_verify -> verified`.
- `functions/src/domains/dispatches/dispatch-responder.ts` dispatches only `verified` reports and relies on `dispatch-responder-validation.ts` for active, same-municipality, same-agency, and on-shift checks.
- `apps/admin-desktop/src/pages/FeedPage.tsx` is a moderation feed, not the public feed citizens see.
- `apps/responder-app/src/routes.tsx` and `apps/responder-app/src/components/Shell.tsx` have no feed or alerts routes.
- `apps/citizen-pwa/src/components/FeedTab.tsx` and `apps/citizen-pwa/src/components/AlertsTab.tsx` are the closest existing public UX references.
- `apps/admin-desktop/src/components/DeclareAlertModal.tsx` and `functions/src/domains/alerts/callables.ts` already implement alert declaration.

---

## Task 0: Baseline and Branch Hygiene

- [ ] Run `git status --short` and verify the four existing local modifications above are still the only unrelated dirty files.
- [ ] Run `rg -n "smsDeliveryReport|Semaphore|Globe|sms_outbox|sms_inbox|report_sms_consent|breakglass|NDRRMC|PAGASA|massAlert" functions/src packages apps infra/firebase prd docs/superpowers/specs/2026-05-24-mvp-reliability-spine-design.md`.
- [ ] Run the current focused characterization checks before edits:
  - `pnpm --dir functions exec vitest run src/domains/reports/__tests__/submit-citizen-report.test.ts src/domains/dispatches/__tests__/dispatch-responder.test.ts src/__tests__/report-lifecycle-integration.test.ts`
  - `pnpm --dir apps/admin-desktop exec vitest run src/__tests__/feed-page.test.tsx src/__tests__/map-firestore-wiring.test.tsx`
  - `pnpm --dir apps/responder-app exec vitest run src/components/Shell.test.tsx src/routes.test.tsx`
- [ ] If baseline tests fail, record the failing command and failure text before changing implementation files.

## Task 1: Remove Source-Level SMS Delivery Remnants

**Files:**

- `functions/src/index.ts`
- `functions/src/http/sms-delivery-report.ts`
- `functions/src/domains/dispatches/dispatch-responder-writes.ts`
- `functions/src/domains/alerts/declare-data-incident.ts`

**Steps:**

- [ ] Search imports with `rg -n "sms-delivery-report|smsDeliveryReport|buildSmsPayload|report_sms_consent|sms_outbox|sms_inbox" functions/src`.
- [ ] Remove the `smsDeliveryReport` export from `functions/src/index.ts`.
- [ ] Delete `functions/src/http/sms-delivery-report.ts` if the search shows no source imports remain.
- [ ] In `dispatch-responder-writes.ts`, remove `buildSmsPayload`, `SmsPayload`, `BuildSmsPayloadArgs`, and the `report_sms_consent` transaction read. Keep `writeDispatchDocs` report, dispatch, event, and retry-queue writes unchanged.
- [ ] In `declare-data-incident.ts`, remove `sms_outbox` and `sms_inbox` from the allowed affected-collection list.
- [ ] Re-read all changed files.
- [ ] Verify with:
  - `pnpm --dir functions typecheck`
  - `pnpm --dir functions exec vitest run src/domains/dispatches/__tests__/dispatch-responder.test.ts src/domains/alerts/__tests__/callables.test.ts`
- [ ] Commit this slice with message `refactor(functions): remove stale sms delivery remnants`.

## Task 2: Remove Shared Validator Remnants for Canceled SMS, Mass Alert, and Break-Glass Contracts

**Files:**

- `packages/shared-validators/src/index.ts`
- `packages/shared-validators/src/coordination.ts`
- `packages/shared-validators/src/coordination.test.ts`
- `packages/shared-validators/src/sms.ts`
- `packages/shared-validators/src/sms-encoding.ts`
- `packages/shared-validators/src/sms-templates.ts`
- SMS validator tests under `packages/shared-validators/src/`

**Steps:**

- [ ] Run `rg -n "smsDocSchema|smsInbound|smsOutbound|smsEncoding|smsTemplate|massAlertRequestDocSchema|breakglassEventDocSchema|MassAlertRequestDoc|BreakglassEventDoc" packages/shared-validators/src functions/src apps`.
- [ ] If any non-test source imports remain outside `packages/shared-validators/src/index.ts`, stop and list the import sites before editing.
- [ ] Remove SMS exports from `packages/shared-validators/src/index.ts`.
- [ ] Delete SMS-only source files and SMS-only tests after the import search proves they are not consumed.
- [ ] In `coordination.ts`, remove only `massAlertRequestDocSchema`, `breakglassEventDocSchema`, `MassAlertRequestDoc`, and `BreakglassEventDoc`; leave shift handoff, command channel, agency assistance, field mode, and roster schemas intact.
- [ ] Update `coordination.test.ts` by deleting only mass-alert and break-glass cases.
- [ ] Re-read the changed validator files.
- [ ] Verify with:
  - `pnpm --dir packages/shared-validators typecheck`
  - `pnpm --dir packages/shared-validators exec vitest run`
- [ ] Commit this slice with message `refactor(validators): drop canceled sms and break-glass contracts`.

## Task 3: Firebase Rules Cleanup Approval Gate

**Files requiring explicit user approval before edit:**

- `infra/firebase/firestore.rules`
- `infra/firebase/firestore.rules.template`

**Also affected test files after approval:**

- `functions/src/__tests__/rules/public-collections.rules.test.ts`
- `functions/src/__tests__/rules/user-consents.rules.test.ts`

**Proposed rule changes to show as a full diff before applying:**

- Remove `match /breakglass_events/{id}` from both rules files.
- Remove `'sms'` from the allowed `user_consents.method` list in both rules files.

**Steps:**

- [ ] Prepare the full intended diff in the assistant response without editing the guarded files.
- [ ] Ask the user for explicit `proceed`.
- [ ] After approval, apply the exact diff to both rules files.
- [ ] Remove break-glass read/write/superadmin tests from `public-collections.rules.test.ts`.
- [ ] Add a `user-consents.rules.test.ts` assertion that `method: 'sms'` fails for an otherwise valid owner create.
- [ ] Re-read both rules files and both test files.
- [ ] Verify with `pnpm --dir functions test:rules:firestore`.
- [ ] Commit this slice with message `refactor(rules): remove break-glass and sms consent remnants`.

## Task 4: Admin Public Feed and Citizen-Visible Alerts Surface

**Files:**

- `apps/admin-desktop/src/pages/FeedPage.tsx`
- `apps/admin-desktop/src/__tests__/feed-page.test.tsx`

**Behavior:**

- The `/feed` page keeps moderation actions for `new` and `awaiting_verify` reports.
- The same page gains a citizen-visible public feed mode or panel that renders reports where `visibilityClass === 'public_alertable'`.
- The public feed presentation uses familiar social-feed structure: author/status header, timestamp/location line, incident body, optional media grid, and compact action/status row.
- Recent official alerts from the existing `alerts` listener appear beside or above the public feed so admins can see what citizens see.
- The page does not expose private reporter/contact fields.

**Red test first:**

- [ ] Add tests to `feed-page.test.tsx` proving:
  - public feed cards render `visibilityClass: 'public_alertable'` reports;
  - verified but internal reports do not render in the public feed;
  - recent alert messages from `alerts` render on `/feed`;
  - moderation buttons still call `verifyReport` for pending reports.
- [ ] Run `pnpm --dir apps/admin-desktop exec vitest run src/__tests__/feed-page.test.tsx` and confirm the new assertions fail before implementation.

**Implementation:**

- [ ] Split `FeedPage` rendering into moderation queue and public feed sections without extracting a shared package.
- [ ] Use existing `reports` and `alerts` returned by `useFirestoreListeners`.
- [ ] Sort public feed cards by `submittedAt` descending using existing timestamp conversion style in the app.
- [ ] Render missing location as `Location pending` and missing body as `Report details pending`.
- [ ] Keep existing action-error banner behavior.
- [ ] Re-read changed files.
- [ ] Verify with:
  - `pnpm --dir apps/admin-desktop exec vitest run src/__tests__/feed-page.test.tsx`
  - `pnpm --dir apps/admin-desktop typecheck`
- [ ] Commit this slice with message `feat(admin): show public feed and official alerts`.

## Task 5: Responder Public Feed Data Hook

**Files:**

- `apps/responder-app/src/hooks/usePublicFeed.ts`
- `apps/responder-app/src/hooks/usePublicFeed.test.ts`
- `apps/responder-app/src/lib/to-millis.ts` only if an existing helper needs a narrow export adjustment

**Behavior:**

- Subscribe to Firestore `reports` with:
  - `where('visibilityClass', '==', 'public_alertable')`
  - `orderBy('submittedAt', 'desc')`
  - `limit(50)`
- Map each document to a UI-safe item with `id`, `reportType`, `severity`, `status`, `barangayId`, `municipalityLabel`, `publicLocation`, `submittedAtMillis`, `verifiedAtMillis`, and `featuredMediaUrls`.
- Set `error` to the snapshot error message and keep the last successful items visible.
- Unsubscribe on unmount.

**Red test first:**

- [ ] Add `usePublicFeed.test.ts` with mocked Firestore `collection`, `query`, `where`, `orderBy`, `limit`, and `onSnapshot`.
- [ ] Assert that the hook builds the query constraints above.
- [ ] Assert that a mock snapshot maps one public report into the expected item shape.
- [ ] Assert that the error callback sets `error` without clearing existing items.
- [ ] Run `pnpm --dir apps/responder-app exec vitest run src/hooks/usePublicFeed.test.ts` and confirm failure.

**Implementation:**

- [ ] Implement the hook using the app's existing Firebase db export.
- [ ] Reuse `toMillis` if it already supports Firestore Timestamp-like values; otherwise make a small typed helper in the hook.
- [ ] Re-read changed files.
- [ ] Verify with:
  - `pnpm --dir apps/responder-app exec vitest run src/hooks/usePublicFeed.test.ts`
  - `pnpm --dir apps/responder-app typecheck`
- [ ] Commit this slice with message `feat(responder): subscribe to public incident feed`.

## Task 6: Responder Alerts Data Hook

**Files:**

- `apps/responder-app/src/hooks/useOfficialAlerts.ts`
- `apps/responder-app/src/hooks/useOfficialAlerts.test.ts`

**Behavior:**

- Subscribe to Firestore `alerts` with `orderBy('publishedAt', 'desc')` and `limit(20)`.
- Map alert docs to `id`, `message`, `hazardType`, `affectedMunicipalityIds`, `declaredAtMillis`, `publishedAtMillis`, and `declaredBy`.
- Set `error` to the snapshot error message and keep the last successful alerts visible.
- Unsubscribe on unmount.

**Red test first:**

- [ ] Add tests proving query constraints, mapping, error retention, and cleanup.
- [ ] Run `pnpm --dir apps/responder-app exec vitest run src/hooks/useOfficialAlerts.test.ts` and confirm failure.

**Implementation:**

- [ ] Implement the hook with direct Firebase imports; do not add a new package dependency.
- [ ] Re-read changed files.
- [ ] Verify with:
  - `pnpm --dir apps/responder-app exec vitest run src/hooks/useOfficialAlerts.test.ts`
  - `pnpm --dir apps/responder-app typecheck`
- [ ] Commit this slice with message `feat(responder): subscribe to official alerts`.

## Task 7: Responder Feed and Alerts Pages

**Files:**

- `apps/responder-app/src/pages/FeedPage.tsx`
- `apps/responder-app/src/pages/FeedPage.test.tsx`
- `apps/responder-app/src/pages/AlertsPage.tsx`
- `apps/responder-app/src/pages/AlertsPage.test.tsx`
- `apps/responder-app/src/pages/FeedPage.module.css`
- `apps/responder-app/src/pages/AlertsPage.module.css`

**Behavior:**

- Feed page is a scrollable, Facebook-familiar incident stream:
  - compact top header;
  - repeated feed cards with avatar/severity marker, location/time header, report body, media grid when present, and status row;
  - loading, empty, and error states that fit in the existing responder app shell.
- Alerts page is a scrollable official-alert list:
  - newest alert first;
  - hazard type and municipality scope visible;
  - loading, empty, and error states.
- No composer, comments, reactions, sharing, or citizen social interactions.

**Red test first:**

- [ ] Mock `usePublicFeed` in `FeedPage.test.tsx` and assert loading, empty, error, report card, and media states.
- [ ] Mock `useOfficialAlerts` in `AlertsPage.test.tsx` and assert loading, empty, error, and alert card states.
- [ ] Run `pnpm --dir apps/responder-app exec vitest run src/pages/FeedPage.test.tsx src/pages/AlertsPage.test.tsx` and confirm failure.

**Implementation:**

- [ ] Build pages with existing responder visual tokens and CSS module style.
- [ ] Keep cards at 8px radius or less.
- [ ] Use lucide icons for empty/error/status affordances.
- [ ] Re-read changed files.
- [ ] Verify with:
  - `pnpm --dir apps/responder-app exec vitest run src/pages/FeedPage.test.tsx src/pages/AlertsPage.test.tsx`
  - `pnpm --dir apps/responder-app typecheck`
- [ ] Commit this slice with message `feat(responder): add feed and alerts pages`.

## Task 8: Responder Routing and Bottom Navigation

**Files:**

- `apps/responder-app/src/routes.tsx`
- `apps/responder-app/src/routes.test.tsx`
- `apps/responder-app/src/components/Shell.tsx`
- `apps/responder-app/src/components/Shell.test.tsx`
- `apps/responder-app/src/components/Shell.module.css` only if five tabs need spacing fixes

**Behavior:**

- Add protected `/feed` route rendered inside `Shell`.
- Add protected `/alerts` route rendered inside `Shell`.
- Bottom navigation order: `Dispatches`, `Map`, `Feed`, `Alerts`, `Profile`.
- Keep pending-dispatch badge on `Dispatches`.
- Detail, handoff, history, login, and TOTP routes remain outside the bottom-tab shell exactly as they are now.

**Red test first:**

- [ ] Update route tests to expect `/feed` and `/alerts` inside `Shell`.
- [ ] Update shell tests to expect five links and the existing pending badge behavior.
- [ ] Run `pnpm --dir apps/responder-app exec vitest run src/routes.test.tsx src/components/Shell.test.tsx` and confirm failure.

**Implementation:**

- [ ] Import the two new pages in `routes.tsx`.
- [ ] Add `Newspaper` and `Bell` lucide icons in `Shell.tsx`.
- [ ] Adjust CSS only if labels wrap or overlap at mobile width.
- [ ] Re-read changed files.
- [ ] Verify with:
  - `pnpm --dir apps/responder-app exec vitest run src/routes.test.tsx src/components/Shell.test.tsx`
  - `pnpm --dir apps/responder-app typecheck`
- [ ] Commit this slice with message `feat(responder): expose feed and alerts navigation`.

## Task 9: Dispatch Error Clarity in Admin UI

**Files:**

- `apps/admin-desktop/src/pages/MapPage.tsx`
- `apps/admin-desktop/src/__tests__/map-firestore-wiring.test.tsx`
- `apps/admin-desktop/src/__tests__/MapPage.test.tsx` if existing coverage is the better fit after re-reading

**Behavior:**

- Dispatch remains server-authoritative through `dispatchResponder`.
- When dispatch fails because the responder is off shift, inactive, wrong municipality, or the report is not `verified`, the admin sees the callable message in the action-error banner instead of a generic failure.
- The UI clears the old action error before a new verify or dispatch attempt.

**Red test first:**

- [ ] Add a test where mocked `dispatchResponder` rejects with `new Error('Responder is off shift')`.
- [ ] Assert that the page renders `Responder is off shift` in the alert region.
- [ ] Add a test that `dispatchResponder` is called only for the selected verified report and selected responder.
- [ ] Run `pnpm --dir apps/admin-desktop exec vitest run src/__tests__/map-firestore-wiring.test.tsx` and confirm failure.

**Implementation:**

- [ ] Keep `MapPage` dispatch flow unchanged except for preserving specific error text.
- [ ] If Firebase callable errors expose only `.message`, use that message; if `.message` is empty, render `Dispatch failed`.
- [ ] Re-read changed files.
- [ ] Verify with:
  - `pnpm --dir apps/admin-desktop exec vitest run src/__tests__/map-firestore-wiring.test.tsx`
  - `pnpm --dir apps/admin-desktop typecheck`
- [ ] Commit this slice with message `fix(admin): surface dispatch rejection reasons`.

## Task 10: MVP Architecture Docs and Progress Notes

**Files:**

- `prd/bantayog-alert-architecture-spec-v8.md`
- `docs/progress.md`
- `docs/learnings.md`

**Steps:**

- [ ] Rewrite the architecture spec sections that still present Semaphore/Globe Labs SMS, NDRRMC escalation, break-glass, PAGASA polling, and bulk mass-alert routing as MVP commitments.
- [ ] State the MVP scope explicitly:
  - online citizen report submission;
  - offline PWA replay through `report_inbox`;
  - admin verification and dispatch;
  - public feed across citizen/admin/responder apps;
  - official alert declaration and read-only alert display.
- [ ] Add a `docs/learnings.md` entry that records:
  - generated `functions/lib/` can retain stale SMS strings after source cleanup;
  - `firestore.rules.template` must be changed with `firestore.rules`;
  - responder public feed must use public reports, not dispatch-only hooks.
- [ ] Add a `docs/progress.md` entry summarizing the MVP reliability spine shipped and remaining deferred features.
- [ ] Re-read changed docs.
- [ ] Verify with `git diff --check`.
- [ ] Commit this slice with message `docs(mvp): align architecture with reliability spine`.

## Task 11: Final Verification

- [ ] Run focused app and package gates:
  - `pnpm --dir functions typecheck`
  - `pnpm --dir functions exec vitest run src/domains/reports/__tests__/submit-citizen-report.test.ts src/domains/dispatches/__tests__/dispatch-responder.test.ts src/__tests__/report-lifecycle-integration.test.ts`
  - `pnpm --dir apps/admin-desktop typecheck`
  - `pnpm --dir apps/admin-desktop exec vitest run src/__tests__/feed-page.test.tsx src/__tests__/map-firestore-wiring.test.tsx`
  - `pnpm --dir apps/responder-app typecheck`
  - `pnpm --dir apps/responder-app exec vitest run src/hooks/usePublicFeed.test.ts src/hooks/useOfficialAlerts.test.ts src/pages/FeedPage.test.tsx src/pages/AlertsPage.test.tsx src/routes.test.tsx src/components/Shell.test.tsx`
  - `pnpm --dir packages/shared-validators typecheck`
  - `pnpm --dir packages/shared-validators exec vitest run`
- [ ] If the rules approval gate was completed, run `pnpm --dir functions test:rules:firestore`.
- [ ] Run `pnpm lint` if the targeted gates pass.
- [ ] Start the relevant dev server after frontend changes:
  - Admin: `pnpm --dir apps/admin-desktop dev --host 127.0.0.1`
  - Responder: `pnpm --dir apps/responder-app dev --host 127.0.0.1`
- [ ] Use browser verification for both feed pages at desktop and mobile widths:
  - Admin `/feed`
  - Responder `/feed`
  - Responder `/alerts`
- [ ] Confirm no overlapping nav labels, feed card text, or alert text.
- [ ] Run final `rg -n "smsDeliveryReport|Semaphore|Globe|sms_outbox|sms_inbox|report_sms_consent|breakglass|NDRRMC|PAGASA|massAlert" functions/src packages/shared-validators/src apps/admin-desktop/src apps/responder-app/src infra/firebase prd/bantayog-alert-architecture-spec-v8.md docs/progress.md docs/learnings.md` and explain any intentional remaining historical references.
- [ ] Run `git status --short` and `git diff --stat`.

## Acceptance Checklist

- [ ] Citizen online submission remains covered by existing tests.
- [ ] Offline/service-worker replay remains covered by existing submit/inbox tests.
- [ ] Admin `/feed` shows public report feed and recent official alerts.
- [ ] Responder app has `/feed` and `/alerts` in bottom navigation.
- [ ] Dispatch failure messages distinguish off-shift, wrong municipality, inactive responder, and wrong report status whenever the backend returns that text.
- [ ] Stale source-level SMS/NDRRMC/break-glass exports and validators are removed.
- [ ] Firebase rules cleanup is applied only after explicit approval.
- [ ] Architecture/progress/learnings docs reflect the MVP scope and deferrals.
