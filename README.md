# Bantayog Alert

Disaster reporting and coordination platform for the Province of Camarines Norte, Philippines.

Driver documents live in `prd/`:

- `bantayog-alert-architecture-spec-v8.md` — architecture spec (authoritative)
- `bantayog-alert-implementation-plan-v1.0.md` — 13-phase implementation plan

Design specs and execution plans live in `docs/superpowers/`.

## Requirements

- Node 20 (use `nvm use` if you have nvm; see `.nvmrc`)
- pnpm 9 (`corepack enable && corepack prepare pnpm@9.12.0 --activate`)
- Firebase CLI (`npm i -g firebase-tools`) for local emulators
- Terraform 1.8+ for infrastructure validation

## Setup

```bash
pnpm install --frozen-lockfile
```

## Common tasks

```bash
pnpm lint        # ESLint across all packages
pnpm typecheck   # TypeScript strict type check
pnpm test        # Vitest (unit + integration)
pnpm build       # Build all apps and packages
pnpm emulators   # Start Firebase emulator suite
```

## Citizen PWA env vars

Set these in `apps/citizen-pwa/.env.local` for local development:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_APP_CHECK_SITE_KEY`

## Phase 1 verification

- `pnpm test`
- `pnpm --filter @bantayog/functions test:unit`
- `pnpm --filter @bantayog/functions test:rules`
- `pnpm lint && pnpm typecheck && pnpm build`

## Repository layout

See `docs/superpowers/specs/2026-04-17-phase-0-design.md` §1 for the canonical layout.

## Branch protection

The `main` branch requires:

- 1 PR approval (2 for security-surface changes — see `.github/CODEOWNERS`)
- Required CI checks: `lint`, `typecheck`, `test`, `build`, `rules-check`, `terraform-validate`
- No force-push, no direct push
- Linear history (squash-merge only)

These are configured on GitHub; see design spec §6.8.
