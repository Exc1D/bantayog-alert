# MVP Reliability Spine Design

## Purpose

Ship a robust, investor-demo-ready MVP around the core Bantayog loop:

1. Citizens submit reports from the PWA.
2. Municipal admins receive new reports reliably.
3. Admins verify, publish, and dispatch responders.
4. Responders see their dispatches plus the same public feed and alerts citizens see.
5. Municipal and provincial admins declare official alerts to citizens.

The MVP deliberately defers SMS provider integrations, NDRRMC escalation, PAGASA weather
automation, break-glass access, and mass-alert blast routing.

## Approved Approach

Use Approach A: vertical slice first.

Implementation order:

1. Remove stale SMS, NDRRMC, PAGASA, mass-alert, and break-glass remnants from active backend,
   rules, validators, app services, and architecture docs.
2. Stabilize citizen online submission through the `submitCitizenReport` callable fast path,
   keeping `report_inbox` only as the offline/background replay fallback.
3. Add Facebook-familiar feed and alerts surfaces for admins and responders, using the same
   public feed/alert data shape citizens already see.
4. Stabilize admin verify-to-dispatch and responder dispatch visibility with focused tests.

## Core Data Flow

Citizen online submission should call `submitCitizenReport`, which validates the existing inbox
payload shape and writes the report triptych (`reports`, `report_private`, `report_ops`) in one
server transaction. This avoids relying on local emulator `onDocumentCreated` behavior for the
demo path. Offline/background replay may still write `report_inbox`, and the materializer must
remain idempotent with the callable path by using `publicRef + secretHash` as the replay key.

Admin Desktop listens to role-scoped `reports`, `report_ops`, `alerts`, and responders. A new
report must appear without manual refresh. Admin actions should follow the current lifecycle:
`new -> awaiting_verify -> verified -> assigned`. Dispatch remains server-authoritative through
`dispatchResponder`.

Responder App keeps the existing dispatch-first workflow, then adds read-only public feed and
official alerts tabs/pages. These views must not expose citizen contact information or admin
personal identities.

## Feed Design

The feed should feel familiar to citizens who use Facebook:

- vertical scroll
- source/avatar row
- institutional source label
- timestamp and location context
- readable post body
- optional photo or map preview
- large touch targets

It must not copy Facebook branding or add social network features. No likes, comments, follows, or
personal profiles. Bantayog actions replace social actions:

- Citizen: Track, View Map, Share Hotline
- Admin: Verify, Publish, Unpublish, Dispatch, Declare Related Alert
- Responder: Open Dispatch, View Map, View Alert Details

Feed cards must show only public-safe data: coarsened location, incident type, severity, status,
institutional source, scrubbed description, and selected public media.

## Alerts Design

Alerts remain simple for MVP. Municipal admins may declare alerts only for their municipality.
Provincial admins may declare alerts for one or more municipalities. `declareAlert` writes to
`alerts` and sends best-effort FCM. It must not route through SMS, Semaphore, NDRRMC, PAGASA, or
mass-alert request flows.

All roles can read official alerts. Admin and responder views should reuse the same alert card
language citizens see, with role-specific actions only where useful.

## Error Handling

The UI should show the failing boundary clearly:

- submission failed before server materialization
- report materialized but not yet visible to admin listener
- report visible but not actionable because it is not in the right lifecycle state
- dispatch rejected because responder is unavailable, out of scope, or not on shift

Local emulator trigger flakiness is not allowed to block the online demo path. The callable path is
the demo path; `report_inbox` replay is the resilience path.

## Testing

Each implementation slice needs a failing test first:

- stale-remnant removal: export/type/rules tests fail before cleanup, then pass after removal
- citizen submit: callable materialization test proves `reports` and `report_ops` are written
- admin visibility: listener/page test proves `new` reports render and can advance to moderation
- shared feed: admin/responder page tests prove public reports and alerts render from live-shaped data
- dispatch loop: backend and UI tests prove verified reports can be dispatched to eligible responders

Verification for final MVP should include targeted unit tests, app typecheck/lint, functions
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
