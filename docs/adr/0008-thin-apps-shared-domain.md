# ADR 0008: Thin Apps and Shared Domain

## Status

Accepted

## Context

Workflow logic duplicated across apps becomes inconsistent during incidents.
The apps should present state and actions, not invent separate business rules.

## Decision

App surfaces should remain thin shells over shared domain rules.

Create or plan for a shared-domain package containing pure business logic such
as:

- deriveReportSeverity
- deriveCitizenTrackingState
- deriveAdminNextAction
- deriveResponderNextAction
- status transition helpers

Do not create this package unless trivial and safe. Documentation/scaffolding is
enough for this task.

## Consequences

- Apps avoid duplicating workflow logic.
- Tests can target pure functions.
- Shared domain code must stay framework-independent.
- A shared-domain package should not become a dumping ground for UI helpers.
