# ADR 0004: Report Triptych and Read Projections

## Status

Accepted

## Context

The system already separates report data by audience and sensitivity. The apps
also need simpler read shapes as the MVP loop becomes more focused.

## Decision

Keep the report triptych:

- reports
- report_private
- report_ops

Later, add purpose-built read projections:

- admin_triage_queue
- responder_assignments
- citizen_tracking

Do not implement projections in this task.

## Consequences

- Privacy separation remains strong.
- Apps can later read simpler projection documents.
- There is some duplication, but it is intentional for performance and clarity.
- Projection code will need clear ownership and backfill strategy when added.
