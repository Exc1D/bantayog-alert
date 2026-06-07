# Feature: Status Updates

## Purpose

This boundary owns responder status progression while a dispatch is active.

## MVP responsibility

Status Updates owns the Responder status update and Resolution steps of the MVP
core loop.

## Should not contain

- Admin verification or rejection decisions.
- Citizen tracking copy.
- Background GPS architecture beyond explicit later-phase work.

## Phase 1 or later work

- Move status transition controls into this boundary.
- Add queued status update behavior when the offline boundary is implemented.
- Keep status writes behind command functions.
