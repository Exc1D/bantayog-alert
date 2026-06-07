# Feature: Reporting

## Purpose

This boundary owns citizen report draft, review, submission, recovery, and
submission-state behavior.

## What belongs here

- Citizen report draft state.
- Report form orchestration.
- Submission recovery and queued submission behavior.
- Handoff to the canonical citizen submission command path.

## What should not belong here

- Admin verification or rejection decisions.
- Responder assignment or status logic.
- Raw operational documents beyond citizen-scoped submission needs.

## Phase 1 intended work

- Move report form orchestration into this boundary.
- Keep draft persistence and queued submission behavior testable in isolation.
- Align submission code with the canonical callable path after current inbox
  usage is documented.
