# Feature: Assignments

## Purpose

This boundary owns responder-visible dispatch assignments and the responder's
decision to accept or decline work.

## What belongs here

- Responder-visible assignment list and detail views.
- Accept and decline flows.
- Assignment freshness and offline/degraded state.
- Handoff from assignment acceptance into status updates.

## What should not belong here

- Admin dispatch candidate selection.
- Citizen report submission logic.
- Broad analytics or roster administration.

## Phase 1 intended work

- Move dispatch list/detail assignment presentation into this boundary.
- Read from a responder_assignments projection when it exists.
- Preserve scoped access to only the responder's assignments.
