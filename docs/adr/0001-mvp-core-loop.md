# ADR 0001: MVP Core Loop

## Status

Accepted

## Context

The repository contains or anticipates many disaster-response domains. That
width makes the next implementation phases harder to sequence and review.

## Decision

The core architectural center is:

Citizen report → Admin triage → Verify/reject → Dispatch responder → Responder
status update → Resolution → Citizen tracking.

## Consequences

- All near-term architecture work must support this flow.
- Advanced modules are later-phase unless they directly support the core loop.
- This prevents the repo from becoming a broad disaster-management platform
  before the MVP is proven.
- Some existing production-minded modules will remain present but outside the
  MVP focus.
