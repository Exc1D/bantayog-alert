# ADR 0002: Canonical Submission Path

## Status

Accepted

## Context

Citizen report submission is easier to operate when there is one preferred path
from local draft to materialized report. The repo still contains inbox-based
materialization paths, so the architecture needs a target without pretending the
current implementation has already moved.

## Decision

The canonical citizen web/PWA submission path is:

local draft → submitCitizenReport callable →
validation/rate-limit/idempotency → municipality resolution → materialize
report documents.

The report_inbox/processInboxItem path should be reserved for asynchronous
ingestion channels such as SMS, external integrations, recovery queues, or
legacy compatibility unless existing code still requires it.

## Consequences

- Citizen app submission becomes easier to reason about.
- Duplicate submission paths should be avoided.
- Any existing code using older paths should be documented before removal.
- Phase work must account for current inbox usage before deleting or bypassing
  it.
