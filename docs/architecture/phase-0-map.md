# Phase 0 Architecture Map

## Current App Surfaces

| Current area    | Keep                                                                     | Simplify                                                             | Later-phase                                                                 |
| --------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Citizen PWA     | Report draft, submission, recovery, active report tracking.              | Center reporting and tracking around the canonical MVP loop.         | Public content expansion, richer alert consumption, privacy self-service.   |
| Admin Desktop   | Triage, verification/rejection, dispatch, monitoring, operator view.     | Make operator actions obvious and keep lifecycle writes in commands. | Analytics, agency coordination, mutual aid, export, governance workflows.   |
| Responder App   | Assignment list/detail, accept/decline, status update, field safety.     | Keep assignment and status flows separate from admin decision logic. | Cached assignments, queued status updates, richer telemetry, collaboration. |
| Shared packages | Validators, types, state machines, Firebase helpers, shared UI.          | Keep domain rules reusable without inventing new abstractions early. | Dedicated shared domain package only after repeated real usage.             |
| Functions       | Report, dispatch, media, identity, notification, and lifecycle commands. | Group future work around incident and dispatch command boundaries.   | Broad analytics, provider routing, agency workflows, retention automation.  |
| Infra/Firebase  | Hosting targets, rules, indexes, emulators, storage.                     | Preserve current topology and document MVP access assumptions.       | Rule rewrites, schema migrations, and production deploy changes.            |

## Current Backend Domains

Current backend code is broader than the MVP. It includes reports, dispatches,
alerts, erasure, analytics, agency coordination, duplicate clustering, responder
management, media, ops, users, and shared helpers.

Phase 0 does not delete these domains. It labels which domains are MVP-critical
and which should stop pulling review attention away from the incident loop.

## MVP Core Domains

| Domain                | MVP responsibility                                                  |
| --------------------- | ------------------------------------------------------------------- |
| reports/incidents     | Materialize citizen reports and own report lifecycle state.         |
| admin triage          | Review, verify, reject, and route reports toward dispatch.          |
| dispatches            | Assign responders and mirror dispatch progress back to reports.     |
| responder assignments | Present scoped assignments and collect field status updates.        |
| citizen tracking      | Show citizen-safe report status without exposing private ops state. |
| identity/users        | Enforce active account and role scope for MVP users.                |
| media                 | Keep upload validation and attachment handling out of app surfaces. |
| notifications         | Send essential lifecycle notifications without owning state.        |

## Later-Phase Domains

These areas are useful, but they are not the Phase 0/Phase 1 center:

- alerts
- agency coordination
- mutual aid
- duplicate clustering
- hazard zones
- BigQuery/audit export
- erasure/retention automation
- advanced analytics
- SMS provider failover
- background responder GPS

## Recommended Target Structure

No large move happens in Phase 0. This is the direction to use when Phase 1 work
starts extracting code into clearer homes.

| Current area                       | Keep                                                     | Simplify                                                      | Later-phase                                      |
| ---------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------ |
| `apps/citizen-pwa/src/components`  | Existing working report and tracking UI.                 | Move reporting orchestration into `features/reporting`.       | Public content and richer alert surfaces.        |
| `apps/citizen-pwa/src/hooks`       | Current data hooks while behavior is stable.             | Put citizen tracking hooks behind `features/tracking`.        | Offline replay beyond queued submission.         |
| `apps/admin-desktop/src/pages`     | Current triage, map, feed, dashboard, dispatch surfaces. | Route triage and dispatch orchestration into feature folders. | Analytics, agency, export, and governance pages. |
| `apps/admin-desktop/src/services`  | Callable wrappers for command functions.                 | Keep lifecycle writes explicit and command-shaped.            | Backend-only wrappers with no operator surface.  |
| `apps/responder-app/src/pages`     | Current assignment and dispatch-detail screens.          | Move assignment presentation into `features/assignments`.     | History, collaboration, and richer telemetry.    |
| `functions/src/domains/reports`    | Report materialization and lifecycle commands.           | Treat it as the incident/report lifecycle core.               | Duplicate clustering expansion.                  |
| `functions/src/domains/dispatches` | Dispatch command and mirror logic.                       | Keep responder assignment state transitions in commands.      | Complex redispatch or mutual aid workflows.      |
| `functions/src/domains/alerts`     | Existing alert code needed by current app behavior.      | Do not expand during Phase 0/1 unless tied to the core loop.  | CAP-compatible alert model.                      |
| `functions/src/domains/agency`     | Existing code that still supports live flows.            | Keep out of MVP critical path.                                | Agency coordination and mutual aid.              |
| `functions/src/domains/erasure`    | Current privacy safety behavior.                         | Avoid new retention automation in Phase 0.                    | Full retention automation and compliance export. |
