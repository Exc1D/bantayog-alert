# Feature: Dispatch

## Purpose

This boundary owns admin dispatch selection, assignment, and incident response
coordination for verified reports.

## What belongs here

- Verified-report dispatch preparation.
- Responder candidate selection.
- Assignment command orchestration.
- Dispatch monitoring entry points for active incidents.

## What should not belong here

- Citizen report draft logic.
- Responder-only field status entry.
- Mutual aid or agency assistance workflows unless explicitly pulled into a
  later phase.

## Phase 1 intended work

- Move dispatch candidate selection and assignment orchestration into this
  boundary.
- Read responder assignment and roster projections when available.
- Keep assignment writes behind command functions.
