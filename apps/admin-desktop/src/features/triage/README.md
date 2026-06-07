# Feature: Triage

## Purpose

This boundary owns admin review of incoming reports, including verification,
rejection, and routing toward dispatch.

## MVP responsibility

Triage owns the Admin triage and Verify/reject steps of the MVP core loop.

## Should not contain

- Responder-only status entry.
- Citizen draft persistence.
- Advanced analytics or agency coordination workflows.

## Phase 1 or later work

- Move report review and moderation orchestration into this boundary.
- Read from an admin_triage_queue projection when it exists.
- Keep lifecycle writes behind command functions.
