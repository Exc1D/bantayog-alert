# Feature: Tracking

## Purpose

This boundary owns citizen-safe report lookup, active report status, and
post-submission tracking.

## What belongs here

- Citizen-safe report lookup.
- Active report status display.
- Submitted-report timeline and recovery states.
- Fallback tracking state while a report is not materialized yet.

## What should not belong here

- Reporter private data beyond what the current citizen can access.
- Admin-only operational notes.
- Responder-only assignment details.

## Phase 1 intended work

- Move lookup and active-report presentation into this boundary.
- Define a citizen_tracking projection contract when projections are added.
- Keep fallback behavior for reports that are not materialized yet.
