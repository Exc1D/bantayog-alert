# Feature: Tracking

## Purpose

This boundary owns citizen-safe report lookup, active report status, and
post-submission tracking.

## MVP responsibility

Tracking owns the Citizen tracking step of the MVP core loop, showing citizens
the status they are allowed to see after a report is submitted.

## Should not contain

- Reporter private data beyond what the current citizen can access.
- Admin-only operational notes.
- Responder-only assignment details.

## Phase 1 or later work

- Move lookup and active-report presentation into this boundary.
- Define a citizen_tracking projection contract when projections are added.
- Keep fallback behavior for reports that are not materialized yet.
