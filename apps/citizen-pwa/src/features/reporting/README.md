# Feature: Reporting

## Purpose

This boundary owns citizen report draft, review, submission, recovery, and
submission-state behavior.

## MVP responsibility

Reporting owns the Citizen report step of the MVP core loop, including local
draft creation and handoff to the canonical submission command path.

## Should not contain

- Admin verification or rejection decisions.
- Responder assignment or status logic.
- Raw operational documents beyond citizen-scoped submission needs.

## Phase 1 or later work

- Move report form orchestration into this boundary.
- Keep draft persistence and queued submission behavior testable in isolation.
- Align submission code with the canonical callable path after current inbox
  usage is documented.
