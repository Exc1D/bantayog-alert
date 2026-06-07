# MVP Scope

## Product Positioning

Bantayog is a local incident reporting and response coordination platform for
LGUs and DRRM offices.

It helps a municipality receive citizen reports, triage them, dispatch
responders, and show citizens a safe tracking view of their submitted incident.

Bantayog is not:

- a national emergency alert replacement
- a replacement for official emergency hotlines
- a guaranteed life-saving system
- a complete provincial disaster-management platform on day one

## MVP Core Loop

The MVP is centered on one operational loop:

Citizen report -> Admin triage -> Verify/reject -> Dispatch responder ->
Responder status update -> Resolution -> Citizen tracking

Phase 0 and Phase 1 work should make this loop easier to understand, test, and
operate. Work that does not strengthen this loop is later-phase unless it is
needed to keep existing behavior safe.

## In-Scope Roles

The MVP role set is intentionally small:

- `citizen` submits reports and tracks their own submitted incidents.
- `municipal_admin` triages, verifies or rejects, dispatches, and closes the
  loop for the municipality.
- `responder` receives assignments and updates field status.

## Out of Scope for Phase 0 and Phase 1

These areas can remain in the repository, but they should not expand during
Phase 0 or Phase 1:

- national emergency alerting semantics
- agency administration workflows
- provincial superadmin workflows
- mutual aid coordination
- duplicate clustering
- hazard overlays as a triage dependency
- BigQuery or external audit export
- retention and erasure automation beyond preserving current safety
- SMS provider failover and advanced notification routing
- background responder GPS as an MVP dependency

## Phase 1 Readiness Checklist

- The MVP loop is documented in one place.
- ADRs make the submission path, lifecycle write boundary, report triptych,
  offline boundary, notification boundary, and role scope explicit.
- Advanced modules are labeled as later-phase rather than removed.
- Feature boundary folders exist for reporting, tracking, triage, dispatch, and
  assignments.
- The Phase 1 backlog is ordered by P0, P1, and P2.
- Demo seed and rule-test gaps are visible before Phase 1 work starts.

## Non-Goals

Phase 0 does not:

- rewrite the application
- delete working advanced modules
- change Firestore rules
- change Cloud Functions behavior
- add dependencies
- rename major runtime folders
- build new Phase 1 UI

## Definitions

**MVP:** The smallest useful local incident loop that can move from a citizen
report to admin triage, responder dispatch, field status, resolution, and
citizen tracking.

**Pilot-ready:** Safe enough for a constrained LGU pilot with seeded demo data,
documented operator paths, clear degraded-state behavior, and passing focused
tests for the MVP loop.

**Production-ready:** Safe enough for real operational dependence, including
strong rule coverage, abuse resistance, monitoring, rollback plans, support
processes, data retention controls, and proven reliability under realistic use.
