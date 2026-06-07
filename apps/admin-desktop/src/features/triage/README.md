# Feature: Triage

## Purpose

This boundary owns admin review of incoming reports, including verification,
rejection, and routing toward dispatch.

## What belongs here

- Incoming report review.
- Verification and rejection orchestration.
- Triage queue filtering and prioritization.
- Routing verified reports toward dispatch.

## What should not belong here

- Responder-only status entry.
- Citizen draft persistence.
- Advanced analytics or agency coordination workflows.

## Phase 1 intended work

- Move report review and moderation orchestration into this boundary.
- Read from an admin_triage_queue projection when it exists.
- Keep lifecycle writes behind command functions.
