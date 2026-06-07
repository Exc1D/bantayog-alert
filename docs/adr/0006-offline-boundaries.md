# ADR 0006: Offline Boundaries

## Status

Accepted

## Context

Disaster workflows need resilience, but a fully offline command center would
expand scope and risk before the MVP loop is proven.

## Decision

Offline behavior is intentionally limited:

- Citizen: offline draft and queued submission
- Responder: cached assignment and queued status update later
- Admin: online-first with stale/degraded indicators

## Consequences

- Avoids overbuilding a fully offline command center.
- Keeps citizen reporting resilient.
- Admin reliability depends on connectivity but can clearly show degraded
  state.
- Responder offline command replay remains a later implementation concern.
