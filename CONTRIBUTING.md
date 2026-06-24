# Contributing

Thanks for helping keep Bantayog Alert boring in the best way: clear, tested,
and understandable when someone is tired.

## Start Here

1. Read [MVP scope](docs/mvp-scope.md) so the core incident loop is fresh.
2. Search for the existing owner of the behavior before adding anything new.
3. Keep the change to one concern. Split broad work into follow-up PRs.
4. Prefer deleting stale code or docs over adding a new abstraction.

## Local Setup

```bash
corepack enable
corepack prepare pnpm@9.12.0 --activate
pnpm install --frozen-lockfile
pnpm dev:all
```

Use the local URLs in [README.md](README.md#local-development). The demo
accounts and full incident walkthrough live in
[docs/runbooks/pilot-demo.md](docs/runbooks/pilot-demo.md).

## Before You Edit

- Read the relevant app/package/function file before changing it.
- Check for existing helpers, validators, state machines, or runbooks.
- For bug fixes, reproduce the failure or identify the failing CI/test first.
- For docs, remove stale permanent docs instead of adding another planning file.

## Verification

Run focused checks first:

```bash
pnpm --dir apps/citizen-pwa exec vitest run path/to/test.ts
pnpm --dir apps/admin-desktop exec vitest run path/to/test.ts
pnpm --dir apps/responder-app exec vitest run path/to/test.ts
pnpm --filter @bantayog/functions test:unit
```

Run broader checks before review:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm format:check
git diff --check
```

For rules or emulator-heavy Function work:

```bash
firebase emulators:exec --only firestore,database,storage 'cd functions && npx vitest run'
```

## Risky Changes

Ask before editing or deploying any of these:

- Firebase rules or indexes in `infra/firebase`
- schema or migration files
- production or staging data scripts
- auth, App Check, IAM, retention, erasure, or account-governance behavior
- deploy configuration

Never commit secrets, service-account JSON, or real user data.

## Pull Request Checklist

- The PR has one reason to exist.
- The README or runbook changed if behavior changed.
- The verification commands and results are in the PR body.
- UI changes include screenshots or browser proof.
- Security-surface changes call out rollback and review risk.
