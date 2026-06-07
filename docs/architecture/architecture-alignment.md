# Bantayog Alert Architecture Alignment

## Purpose

Bantayog Alert is a local incident reporting and response coordination platform
for LGUs and DRRM offices in Camarines Norte, Philippines.

This document aligns the repository around the MVP core loop before Phase 0 and
Phase 1 implementation work. It narrows architectural attention without
deleting existing broader code.

Bantayog Alert is not a national emergency alert replacement, a replacement for
official emergency hotlines, a guaranteed life-saving system, or a complete
provincial disaster-management operating system on day one.

## Product architecture principle

The architecture exists to protect and accelerate the incident lifecycle.

## MVP core loop

Citizen report → Admin triage → Verify/reject → Dispatch responder → Responder
status update → Resolution → Citizen tracking

Every near-term architecture decision should make this loop easier to reason
about, test, operate, and explain.

## Target architecture

- Thin client apps that present workflows and call explicit backend commands.
- Command-driven backend modules that own lifecycle writes and business rules.
- Firestore read models and projections shaped for each app surface.
- Shared domain rules for lifecycle status, eligibility, validation, and
  next-action derivation.
- Modular later-phase domains that stay present but do not pull MVP work away
  from the incident lifecycle.

## App surfaces

| Surface       | MVP responsibility                                                                                                 | Later-phase responsibility                                                                                            | What should not belong there                                                                                                               |
| ------------- | ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Citizen PWA   | Capture report drafts, submit reports, preserve local recovery state, and show citizen tracking.                   | Public information feeds, richer alert views, account privacy flows, and resilient queued submission.                 | Admin triage rules, responder assignment logic, raw operational records, or privileged moderation decisions.                               |
| Admin Desktop | Triage reports, verify or reject, dispatch responders, monitor active incidents, and show degraded state honestly. | Advanced analytics, agency coordination, mutual aid workflows, audit/export operations, and broader governance tools. | Citizen-only draft state, responder-only status entry, direct client writes that bypass command functions, or national alerting semantics. |
| Responder App | Show assigned dispatches, accept/decline, update status, request help, and submit responder-witnessed reports.     | Cached assignments, queued status updates, richer responder telemetry, history, and field collaboration.              | Admin verification decisions, citizen PII beyond scoped operational need, dispatch candidate selection, or analytics ownership.            |

## Backend domain boundaries

| Domain                | MVP or Later | Responsibility                                                        | Notes                                                                                                   |
| --------------------- | ------------ | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| incident              | MVP          | Own the report lifecycle root and incident status transitions.        | This is the center of the architecture.                                                                 |
| dispatch              | MVP          | Assign responders and advance dispatch state.                         | Dispatch state mirrors back to the incident/report lifecycle.                                           |
| identity              | MVP          | Own account roles, active status, and access claims.                  | MVP roles stay narrow: citizen, municipal_admin, responder.                                             |
| media                 | MVP          | Handle signed uploads and validated media attachment flow.            | Keep media validation out of app surfaces.                                                              |
| notifications         | MVP          | Send essential lifecycle notifications without owning incident state. | Outbox/adapters are future architecture.                                                                |
| citizen tracking      | MVP          | Provide citizen-safe lookup and lifecycle tracking.                   | Must never expose private operational or responder-only state.                                          |
| admin triage          | MVP          | Verify, reject, and route reports toward dispatch.                    | Should use command functions for lifecycle writes.                                                      |
| responder assignments | MVP          | Present scoped assignments and status actions.                        | Should read assignment projections when they exist.                                                     |
| alerts                | Later        | Public alerting and official advisories.                              | Existing code can remain, but Phase 0/1 should not expand it unless it directly supports the core loop. |
| agency coordination   | Later        | Cross-agency assistance and shared operations.                        | Keep out of the MVP critical path.                                                                      |
| mutual aid            | Later        | Partner-agency visibility and aid coordination.                       | Defer role and rules expansion.                                                                         |
| duplicate clustering  | Later        | Detect and merge related incidents.                                   | Useful after report volume justifies it.                                                                |
| hazard zones          | Later        | Maintain hazard reference zones and map overlays.                     | Do not make MVP triage depend on this.                                                                  |
| analytics             | Later        | Aggregate operational metrics and trends.                             | MVP dashboards should drive action, not become a BI platform.                                           |
| audit export          | Later        | Export auditable records to external stores such as BigQuery.         | Keep incident state correct before optimizing export.                                                   |
| erasure/retention     | Later        | Automate privacy retention and erasure workflows.                     | Preserve required privacy boundaries; defer advanced automation.                                        |

## Target repository structure

Recommended future structure, without moving files in this task:

```text
functions/src/domains/
  incident/
    commands/
    projections/
    events/
    policies/
  dispatch/
    commands/
    projections/
  media/
  identity/
  notifications/
  governance/
  analytics/

apps/citizen-pwa/src/features/
  reporting/
  tracking/

apps/admin-desktop/src/features/
  triage/
  dispatch/
  map/
  dashboard/

apps/responder-app/src/features/
  assignments/
  status-updates/

packages/
  shared-types/
  shared-validators/
  shared-state-machines/
  shared-domain/
  shared-ui/
  shared-firebase/
```

## Runtime rule

Clients may read Firestore projections and scoped documents, but lifecycle
writes should go through command functions.

## MVP role scope

MVP roles are:

- citizen
- municipal_admin
- responder

Later-phase roles are:

- agency_admin
- provincial_superadmin
- mutual aid operators or partner-agency roles

Existing broader roles are not deleted by this alignment; they are deferred
from the MVP implementation focus.

## Offline boundaries

- Citizen: offline draft and queued submission.
- Responder: cached assignment and queued status update later.
- Admin: online-first with stale/degraded indicators.

## Later-phase modules

These modules are later-phase for Phase 0/1 architecture focus:

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

## Non-goals

This architecture-alignment task does not implement:

- folder migration
- Firestore rule rewrite
- Cloud Functions rewrite
- new UI pages
- new dependencies
- production alerting
