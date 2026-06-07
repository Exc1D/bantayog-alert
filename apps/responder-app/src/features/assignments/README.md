# Feature: Assignments

## Purpose

This boundary owns responder-visible dispatch assignments and the responder's
decision to accept or decline work.

## MVP responsibility

Assignments owns the responder handoff after admin dispatch and prepares the
responder for status updates.

## Should not contain

- Admin dispatch candidate selection.
- Citizen report submission logic.
- Broad analytics or roster administration.

## Phase 1 or later work

- Move dispatch list/detail assignment presentation into this boundary.
- Read from a responder_assignments projection when it exists.
- Preserve scoped access to only the responder's assignments.
