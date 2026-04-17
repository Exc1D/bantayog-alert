# Schema Migration Protocol

Source of truth: Arch Spec §13.12.

## When this runbook applies

Any breaking change to a Firestore document shape that already has production data:

- Adding a required field without a default
- Renaming a field
- Changing an enum value set (removing or renaming literals)
- Changing field types (e.g., `number` → `string`)
- Collapsing or splitting collections

Purely additive optional fields do NOT trigger this protocol — they follow the normal PR workflow.

## Stage 1 — Plan document

Before any code change, write a short migration plan covering:

1. **Old schema** (link to current Zod schema in `packages/shared-validators/src/<file>.ts`)
2. **New schema** (PR-drafted definition)
3. **Trigger compatibility matrix**: for each Cloud Function that reads or writes this collection, which branch handles old vs new
4. **Backfill strategy**: batched scheduled function, size limits, throttle
5. **Rollback plan**: exact `firebase deploy --only functions:<name>` command to revert
6. **Monitoring signals**: what dashboards confirm progress; what alert fires if progress stalls

The plan lives in `docs/runbooks/migrations/<YYYY-MM-DD>-<schema>.md`.

## Stage 2 — `schemaVersion` guard

Every document class carries `schemaVersion: number`. New writes must increment. Read paths must accept both old and new versions during the migration window.

## Stage 3 — Migration window

Default 30 days. Both versions accepted; triggers have branched code paths with explicit unit tests for each branch. The date is recorded in `system_config/migration_progress/<schemaKey>`.

## Stage 4 — Backfill

A scheduled function reads old-version documents in batches, rewrites them to the new shape inside a transaction, and updates `system_config/migration_progress/<schemaKey>.completed`. Runs during low-traffic hours (01:00–05:00 Asia/Manila). Respect Firestore write quotas — default 500 docs/sec.

## Stage 5 — Cutover

When backfill `completed == true` AND zero old-version writes for 7 consecutive days, remove the old-version branches in a follow-up PR. This PR must include:

- A counting query proving zero old-version documents remain
- A screenshot of the monitoring dashboard showing the steady-state
- The `system_config/migration_progress/<schemaKey>` document marked `closed: true`

## Stage 6 — Rollback

During the migration window, rollback is a function-only redeploy from the prior tag. Post-window rollback requires a reverse migration plan — treat it as a new migration.

## Definition of done

The migration is not complete until:

- [ ] Counting query confirms zero old-version documents
- [ ] Monitoring signal shows zero old-version writes for 7 consecutive days
- [ ] Old-version trigger branches removed
- [ ] Runbook entry closed in `docs/runbooks/migrations/`
- [ ] Post-migration review logged in `docs/learnings.md`