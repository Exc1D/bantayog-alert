# 2F-04 — Staging Hosting Deploy of the Three Apps

**Goal:** Citizen PWA, Admin Desktop, and Responder app load and authenticate
against staging from real URLs.

**Blocked by:** 2F-01. **Deploy execution is human-only** — agents prepare
builds and config; the human runs the deploy command (CLAUDE.md §6/§8.4,
fresh approval required).

## Files (agent-preparable)

- Hosting target config for staging in `firebase.json` / `.firebaserc`
  (show full diff before applying — deployment config is a risky change).
- App `.env.staging` files from the examples (local only, never committed).

## Steps

1. Agent: verify three production builds succeed with staging env.
   Each app is a Vite project that loads env files via `loadEnv(mode, process.cwd(),
'VITE_')`. Vite's production build loads `.env.production` by default, not
   `.env.staging`. For each app, copy the staging env file into place so the
   build picks it up, then run the app's build command:
   - citizen-pwa: `cp apps/citizen-pwa/.env.staging apps/citizen-pwa/.env.production.local && pnpm --dir apps/citizen-pwa build`
   - admin-desktop: `cp apps/admin-desktop/.env.staging apps/admin-desktop/.env.production.local && pnpm --dir apps/admin-desktop build`
   - responder-app: `cp apps/responder-app/.env.staging apps/responder-app/.env.production.local && pnpm --dir apps/responder-app build`
     (Alternative: run `vite build --mode staging` directly, which loads
     `.env.staging`, but this bypasses the `tsc --noEmit` step in the package
     `build` script.)
2. Agent: prepare the hosting deploy command and rollback command, present
   both.
3. Human: run the deploy against `bantayog-alert-staging`.
4. Both: manual three-app walkthrough of the loop; document it in
   `docs/runbooks/pilot-demo.md` (Staging section).

## Out of scope

- Production project anything. CI/CD automation (later phase if needed).

## Verification

- Three staging URLs load, login works for seeded accounts, and the manual
  loop completes end-to-end.

## Done evidence

- Walkthrough documented with URLs and accounts used; rollback command
  recorded in the PR description per §8.4.
