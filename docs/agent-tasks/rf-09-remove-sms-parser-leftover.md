# RF-09 — Remove the Leftover `shared-sms-parser` Package

**Priority:** P2 (zero-risk cleanup; also corrects a false progress.md
claim — the 2026-06-06 entry says this package was removed, but it is still
on disk and still a workspace member via the `packages/*` glob)

**Goal:** `packages/shared-sms-parser/` is gone: directory, lockfile
entries, and any lint-baseline/config rows. The repo record is corrected.

## Recon facts (2026-06-12 — re-verify before editing)

- `packages/shared-sms-parser/` exists with `package.json`
  (`@bantayog/shared-sms-parser`, private), `src/index.ts`, `tsconfig.json`,
  and an installed `node_modules`.
- Zero consumers: `grep -rln "shared-sms-parser" apps packages functions e2e-tests --include='*.ts*' --include='*.json' | grep -v node_modules`
  matches only the package's own `package.json`. Re-run this before
  deleting; abort if anything else appears.
- The SMS inbound pipeline itself was removed in `9f520d99` (2026-05-11).
  Canonical geography lives in `@bantayog/shared-validators` — nothing here
  to migrate.

## Files (≤3 — plus lockfile regeneration)

- `packages/shared-sms-parser/` (delete the directory)
- `pnpm-lock.yaml` (regenerate via `pnpm install`)
- Any config that names the package: check `turbo.json`, root
  `tsconfig*.json`, eslint baselines, `.fallowrc.json`
  (`grep -rn "sms-parser" --include='*.json' --include='*.yaml' --include='*.yml' . | grep -v node_modules | grep -v pnpm-lock`)

## Design constraints

- Full-surface removal per learnings.md: source, manifest, lockfile
  references, lint-baseline rows, generated lib output — together in one
  commit. Leaving one layer is how this leftover happened.
- `git rm -r` the tracked files; do not use broad `rm -rf` beyond the
  package directory.

## Red-first test

Not applicable (pure deletion with zero consumers) — justification: there
is no behavior to pin. The proof is the post-delete green build.

## Out of scope

- rf-11's broader package consolidation; touching shared-validators;
  rewriting the 2026-06-06 progress entry (append a correction instead —
  progress.md is append-only).

## Verification

- `pnpm install` succeeds; `git status` shows only the expected deletions +
  lockfile
- `pnpm typecheck && pnpm lint && pnpm test` at root — green
- `pnpm build` at root — green (proves no package `exports` pointed here)
- `grep -rn "sms-parser" . --include='*.ts*' --include='*.json' --include='*.yaml' | grep -v node_modules | grep -v docs/` → empty
- Append the correction note to `docs/progress.md`
