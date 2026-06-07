# ADR 0003: Client Read, Command Function Write

## Status

Accepted

## Context

Lifecycle writes from clients make rules, auditing, idempotency, and status
transitions harder to enforce consistently.

## Decision

Clients may read Firestore documents/projections allowed by rules, but
lifecycle writes must go through command functions.

Examples:

- verifyReport
- rejectReport
- dispatchResponder
- acceptDispatch
- advanceDispatch
- closeReport
- reopenReport
- cancelDispatch

## Consequences

- Firestore rules can become stricter over time.
- Business rules stay in functions/shared-domain code.
- Clients become thinner and safer.
- Command functions must remain well-tested because they own critical state
  changes.
