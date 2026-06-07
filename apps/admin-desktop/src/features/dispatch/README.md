# Feature: Dispatch

## Purpose

This boundary owns admin dispatch selection, assignment, and incident response
coordination for verified reports.

## MVP responsibility

Dispatch owns the Dispatch responder step of the MVP core loop and hands active
assignments to responder workflows.

## Should not contain

- Citizen report draft logic.
- Responder-only field status entry.
- Mutual aid or agency assistance workflows unless explicitly pulled into a
  later phase.

## Phase 1 or later work

- Move dispatch candidate selection and assignment orchestration into this
  boundary.
- Read responder assignment and roster projections when available.
- Keep assignment writes behind command functions.
