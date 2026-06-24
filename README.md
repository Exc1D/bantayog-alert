# Bantayog Alert

Bantayog Alert is a local incident reporting and response coordination platform
for LGUs and DRRM offices in Camarines Norte, Philippines.

The product is centered on one MVP loop:

```text
Citizen report -> Admin triage -> Verify or reject -> Dispatch responder ->
Responder status update -> Resolution -> Citizen tracking
```

Anything that changes that loop should be easy to reason about during an
incident. Correct, clear, small beats clever.

## Apps and Packages

| Area            | Path                 | Purpose                                                    |
| --------------- | -------------------- | ---------------------------------------------------------- |
| Citizen PWA     | `apps/citizen-pwa`   | Citizen reporting, local recovery, and safe tracking.      |
| Admin Desktop   | `apps/admin-desktop` | Triage, dispatch, monitoring, and command-center actions.  |
| Responder App   | `apps/responder-app` | Assignments, accept/decline, and field status updates.     |
| Cloud Functions | `functions`          | Command functions and backend domain logic.                |
| Shared packages | `packages`           | Types, validators, Firebase helpers, shared UI, and state. |
| Firebase infra  | `infra/firebase`     | Firestore, RTDB, Storage rules, and indexes.               |
| Terraform infra | `infra/terraform`    | Environment infrastructure validation.                     |

## Requirements

- Node 20 for the root workspace. Run `nvm use` if you use nvm.
- pnpm 9.12.0 through Corepack.
- Firebase CLI for emulators.
- Java 21 for Firebase emulator tests.
- Terraform 1.9.8 for infrastructure validation.

The Functions package targets Node 22 in Firebase. Root workspace commands run
on Node 20 and may print a Functions engine warning; that warning is expected
from the root workspace. Use Node 22 when running commands inside `functions/`
directly.

```bash
corepack enable
corepack prepare pnpm@9.12.0 --activate
pnpm install --frozen-lockfile
```

## Local Development

Start the full local stack:

```bash
pnpm dev:all
```

Local URLs:

| App           | URL                   |
| ------------- | --------------------- |
| Citizen PWA   | http://localhost:5173 |
| Responder App | http://localhost:5174 |
| Admin Desktop | http://localhost:5175 |
| Emulator UI   | http://127.0.0.1:4000 |

Useful seed and proof commands:

```bash
pnpm demo:seed
pnpm demo:reset
pnpm proof:mvp-loop
pnpm proof:local
```

See [Pilot Demo Runbook](docs/runbooks/pilot-demo.md) for the full local
incident lifecycle.

## Verification

Run the narrowest check that proves your change, then run the broader gate
before opening a PR.

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Function and rules checks:

```bash
pnpm --filter @bantayog/functions test:unit
pnpm --filter @bantayog/functions test:rules
firebase emulators:exec --only firestore,database,storage 'cd functions && npx vitest run'
```

Formatting and whitespace:

```bash
pnpm format:check
git diff --check
```

## Documentation

Start here:

- [Contributing](CONTRIBUTING.md)
- [Product direction](PRODUCT.md)
- [MVP scope](docs/mvp-scope.md)
- [Architecture](docs/architecture/README.md)
- [Architecture decision records](docs/adr/)
- [Runbooks](docs/runbooks/)
- [Durable learnings](docs/learnings.md)
- [Progress log](docs/progress.md)

Keep docs current and small. Historical planning notes belong in issues or the
append-only progress log, not as permanent repository navigation.

## Pull Requests

- Branch from `main`.
- Keep one concern per PR.
- Do not commit secrets or local `.env` files.
- Do not deploy from a PR unless that deploy is explicitly approved for the
  current change.
- For Firebase rules, indexes, schema, migration, or production data changes,
  show the diff first and get explicit approval before editing.

See [CONTRIBUTING.md](CONTRIBUTING.md) for the working agreement.
