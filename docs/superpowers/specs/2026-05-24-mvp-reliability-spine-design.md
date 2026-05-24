# MVP Reliability Spine Design

## Purpose

Make the existing Bantayog MVP reliable and investor-demo-ready around the core loop:

1. Citizens submit reports from the PWA.
2. Municipal admins receive new reports without manual refresh.
3. Admins verify, publish, and dispatch eligible responders.
4. Responders see dispatches plus the same public feed and official alerts citizens see.
5. Municipal and provincial admins declare official alerts to citizens.

This is not a greenfield feature spec. The online report materialization path already exists. The
remaining work is cleanup, reliability proof, and missing role-facing UI.

## Current State Verified in Code

- Online Citizen PWA submission already uses the `submitCitizenReport` callable fast path through
  `apps/citizen-pwa/src/hooks/useSubmissionMachine.ts`.
- `submitCitizenReport` already materializes `reports`, `report_private`, `report_ops`,
  `report_lookup`, `secret_lookup`, status log entries, report events, and media subdocs through
  the shared materialization core in `functions/src/domains/reports/process-inbox-item.ts`.
- `report_inbox` remains the resilience path. It is written by offline replay paths, including the
  in-app retry machine and the service worker Background Sync path in
  `apps/citizen-pwa/public/sw.js` where the browser supports it.
- Callable and inbox materialization are already deduped through `publicRef + secretHash`; matching
  hashes replay the existing report and different hashes conflict.
- Admin FeedPage already includes `new` reports and can advance `new -> awaiting_verify` through
  `verifyReport`.
- Citizen public feed already exists through `FeedTab` and `usePublicIncidents`.
- Admin `declareAlert` already writes `alerts` and performs best-effort FCM without SMS routing.

## Remaining MVP Work

Use Approach A: vertical slices that prove the working loop before wider polish.

Implementation order:

1. Remove stale deferred-feature remnants that still exist in active code and tests.
2. Prove the current citizen submit path, admin live report visibility, and idempotent inbox fallback
   with targeted tests.
3. Add Facebook-familiar public feed and alert views for Admin Desktop and Responder App.
4. Prove `new -> awaiting_verify -> verified` and `verified -> assigned` as two separate
   callable-driven transitions.
5. Update the architecture spec and progress/learnings docs so future work does not resurrect the
   deferred features by accident.

## Deferred-Feature Remnant Checklist

Remove only stale remnants with no active MVP caller. Keep offline report submission support.

Known stale active surfaces:

- `functions/src/index.ts`: remove `smsDeliveryReport` export.
- `functions/src/http/sms-delivery-report.ts`: delete if no longer exported or called.
- `functions/src/domains/dispatches/dispatch-responder-writes.ts`: remove `buildSmsPayload`,
  `SmsPayload`, `BuildSmsPayloadArgs`, and the `report_sms_consent` read if no tests or callers use
  them.
- `functions/src/domains/alerts/declare-data-incident.ts`: remove `sms_outbox` and `sms_inbox`
  from the active incident collection allowlist unless they remain valid historical export targets.
- `infra/firebase/firestore.rules`: remove `breakglass_events` rules and `sms` as a consent method
  only after showing the diff and getting explicit approval, because rules edits are risky.
- `functions/src/__tests__/rules/public-collections.rules.test.ts`: remove breakglass rules tests
  after the rules diff is approved.
- `packages/shared-validators/src/sms.ts`, `sms-encoding.ts`, `sms-templates.ts`, and matching tests:
  delete only if no app or package imports remain.
- `packages/shared-validators/src/coordination.ts`: remove `massAlertRequestDocSchema` and
  `breakglassEventDocSchema` only if no imports remain.
- `packages/shared-validators/src/index.ts`: remove stale SMS, mass-alert, and breakglass exports
  after deleting the backing schemas.
- `prd/bantayog-alert-architecture-spec-v8.md`: rewrite SMS/NDRRMC/PAGASA/break-glass sections as
  deferred, not MVP architecture.

Do not delete:

- `report_inbox`
- `processInboxItem`
- `inboxReconciliationSweep`
- service worker Background Sync for offline report replay
- hotline/SMS-link UX that opens the user's native SMS app, unless product explicitly removes the
  hotline fallback

## Correct Lifecycle Model

Report verification and dispatch are separate server-authoritative steps.

`verifyReport` owns:

- `new -> awaiting_verify`
- `awaiting_verify -> verified`

`dispatchResponder` owns:

- `verified -> assigned`
- creation of `dispatches/{reportId}_{responderUid}`
- report and dispatch event writes
- FCM notification tracking and retry queueing

The UI must not show dispatch controls for `new` or `awaiting_verify` reports. It may show "Send to
moderation" for `new`, "Publish scrubbed copy" for `awaiting_verify`, and dispatch controls only
for `verified` reports.

## Dispatch Eligibility and Errors

Dispatch is not just an admin click. `dispatchResponder` validates:

- actor is a municipal admin or provincial superadmin with active account status
- report exists and belongs to the actor's municipality or permitted municipality set
- report status is exactly `verified`
- responder exists
- responder is active
- responder is inside the actor's municipality scope
- responder has an agency ID
- responder is currently on shift in RTDB at `/responder_index/{municipalityId}/{responderUid}`

Admin UI must surface these failures as operational messages, not generic errors. The most common
demo-time failure is an otherwise valid responder going off-shift between list load and dispatch.

## Shared Feed Design

The feed should feel familiar to citizens who use Facebook:

- vertical scroll
- source/avatar row
- institutional source label
- timestamp and location context
- readable post body
- optional photo or map preview
- large touch targets

It must not copy Facebook branding or add social-network features. No likes, comments, follows, or
personal profiles. Bantayog actions replace social actions:

- Citizen: Track, View Map, Share Hotline
- Admin: Verify, Publish, Unpublish, Dispatch, Declare Related Alert
- Responder: Open Dispatch, View Map, View Alert Details

Current code does not implement geographic coarsening. MVP feed cards should therefore claim only
the privacy behavior the system actually has today: public reports expose `visibilityClass ==
public_alertable`, `barangayId`, `municipalityLabel`, and `publicLocation` through Firestore rules.
If true coarsening is required, that is a separate privacy slice with backend projection, rules, and
map/feed test coverage.

## Admin and Responder Feed/Alerts Scope

Admin Desktop already has a moderation-oriented `FeedPage`. The MVP needs a clearer public-feed
mode or shared feed component so admins can see the citizen-facing feed and official alerts without
leaving the command surface.

Responder App has no public feed or alerts routes today. MVP work must add:

- routes for feed and alerts
- shell navigation entries
- read-only hooks for public reports and official alerts
- tests proving responders can render `public_alertable` reports and `alerts`
- a security check that responder accounts are active and can read only public feed data plus their
  assigned dispatch data

Responder feed and alerts must not expose citizen contact information, `report_private`, or admin
personal identities.

## Alerts Design

Alerts remain simple for MVP. Municipal admins may declare alerts only for their municipality.
Provincial admins may declare alerts for one or more municipalities. `declareAlert` writes to
`alerts` and sends best-effort FCM.

FCM failure does not roll back alert creation. The UI should treat creation as successful if the
callable returns an `alertId`, and the backend should keep logging FCM failures for follow-up. Do
not add SMS, Semaphore, NDRRMC, PAGASA, or mass-alert request routing in this MVP.

## Error Handling Boundaries

The UI should make the failing boundary clear:

- callable submit failed before materialization
- offline replay wrote `report_inbox` but materialization has not completed
- report materialized but admin listener cannot read it
- report visible but in the wrong lifecycle state for the requested action
- verify or dispatch callable rate limit was hit
- App Check/auth rejected a callable
- dispatch rejected because the responder is inactive, off-shift, out of scope, missing agency ID,
  or the report is not verified
- alert declaration succeeded but FCM delivery was best-effort and may require follow-up

Local emulator trigger flakiness must not block the online demo path. The callable path is the demo
path; `report_inbox` plus reconciliation remains the resilience path.

## Testing and Verification

Use test-first development for behavior changes.

Required coverage by slice:

- remnant cleanup: run typecheck/lint and targeted package tests after deletion; do not invent tests
  that assert modules "do not exist"
- citizen submit: prove callable materialization writes `reports` and `report_ops`; prove
  `report_inbox` replay dedups against the callable-created report
- admin visibility: prove `new` reports render and can advance to moderation
- shared feed: prove admin and responder feed views render citizen-facing public reports and alerts
  from live-shaped data
- dispatch loop: prove verified reports can be dispatched to eligible responders and that off-shift
  responders produce a clear UI error
- rules changes: run the relevant Firestore rules tests after an explicitly approved diff

Final MVP verification should include targeted unit tests, app typecheck/lint, functions
typecheck/lint, and a local proof run where practical.

## Scope Boundaries

Not in MVP:

- SMS inbound/outbound providers
- Semaphore or Globe Labs fallback
- NDRRMC escalation queue
- PAGASA weather polling or hazard signal projection
- break-glass access
- bulk mass-alert blast routing
- predictive risk modeling
- citizen social interactions

These features may return later only through new specs and separate implementation plans.
