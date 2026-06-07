# ADR 0007: MVP Role Scope

## Status

Accepted

## Context

More roles mean more rules paths, UI states, onboarding flows, and tests. The
MVP loop needs the fewest roles that can complete a local incident lifecycle.

## Decision

MVP supports only:

- citizen
- municipal_admin
- responder

Later-phase roles:

- agency_admin
- provincial_superadmin
- mutual aid / partner-agency roles

## Consequences

- Fewer access paths to test during MVP.
- Simpler UX and rules verification.
- Existing broader roles are not deleted, only deferred from MVP work.
- Later governance work must re-open role and rules coverage deliberately.
