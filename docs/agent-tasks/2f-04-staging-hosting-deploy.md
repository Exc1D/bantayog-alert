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

1. Agent: verify three production builds succeed with staging env
   (`pnpm build` with `.env.staging` per app).
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
