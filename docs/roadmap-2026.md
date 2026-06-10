# Bantayog Alert — 2026 Direction

Status: adopted 2026-06-10. Owner: Exc1D. Reviewed monthly (first week of each
month — re-read this doc, mark phase status, adjust dates).

## End Goal (31 December 2026)

**One real LGU pilot, live in production, in one municipality (Daet, Camarines
Norte), with real MDRRMO admins triaging real citizen reports and dispatching
real responders — plus the evidence to decide whether to scale in 2027.**

Concretely, by year end:

1. The MVP core loop (Citizen report → Admin triage → Verify/reject → Dispatch
   → Responder status → Resolution → Citizen tracking) runs in production with
   real accounts, not seed data.
2. Each of the three apps has a **complete** core-loop user experience as
   defined in Phase 3 below — no dead ends, no missing states, notifications
   close the loop.
3. At least 4 weeks of live pilot operation with weekly metrics, zero
   unresolved SEV-1 incidents.
4. A written go/no-go memo for 2027 (scale to more municipalities, seek
   funding, or open-source) backed by pilot data.

## Why This Goal

- **Feature expansion already failed once.** The greenfield PostGIS /
  incident-core rebuild stopped at the contract layer. The lesson (recorded in
  `docs/learnings.md`): big-bang rebuilds and speculative features do not fit a
  solo operator directing AI agents. Small verified slices toward a concrete
  deadline do.
- **The loop is proven; usage is not.** `pnpm proof:mvp-loop` and
  `pnpm proof:local` pass. Staging seed/smoke/health-check scripts pass against
  `bantayog-alert-staging`. The missing value is a real user, not another
  module.
- **A pilot converts the codebase into a product.** It forces the UX gaps the
  user experience audit will find, dictates hardening priorities by evidence,
  and produces the only artifact that matters for any 2027 decision: proof that
  a municipality used it.

**Strategy in one line:** finish the experience of the loop we have, prove it
on staging, run it in production for one municipality, and let pilot evidence —
not speculation — pull new features in.

## Phase Sequence

Numbering continues from `docs/progress.md` (Phase 2A–2E complete).

### Phase 2F — Staging Loop Proof (June, ~2–3 weeks)

Goal: the full lifecycle works through **deployed** infrastructure, not just
emulators.

Slices:

- Fix the two open Firebase Console issues: Phone Auth disabled, App Check 400
  on staging (see `docs/progress.md` → Open).
- Custom-token → ID-token exchange harness against staging Auth.
- Extend `scripts/staging-e2e-proof.ts` to call deployed HTTPS callables via
  the client SDK: submit → verify → dispatch → accept → advance → resolve.
- Deploy the three apps to staging Hosting; manual three-app walkthrough
  documented in `docs/runbooks/pilot-demo.md`.
- One Playwright smoke spec that runs the citizen → admin → responder loop
  against staging URLs.

Exit criteria: extended `pnpm staging:e2e-proof` green through the full
callable loop; three apps load, authenticate, and complete the loop on staging;
walkthrough documented.

### Phase 3 — UX Completeness (July–August)

Goal: the stated pain — "the experience of the users is not yet complete" —
fixed for the core loop only. Every journey in each app has a beginning, a
middle, an end, and designed states for loading / empty / error / offline /
permission-denied.

Method (this is the agent pipeline):

1. Run a structured UX-completeness audit per app (citizen-pwa, admin-desktop,
   responder-app) against the core loop. Use the `evaluate-ux-completeness`
   skill checklist as the instrument.
2. Write the gap inventory as one slice file per gap in `docs/agent-tasks/`
   (convention below), ordered P0/P1/P2.
3. Execute slices in order under the standing rules in `CLAUDE.md` (≤3 files,
   red-first test, full verification).

Known candidates to validate in the audit (not a pre-approved list):

- Citizen push notification when report status changes; "responder on the way"
  and resolution notifications reaching a closed app.
- Responder push on new dispatch with tap-through routing verified on a real
  device.
- Citizen onboarding: anonymous-vs-registered clarity, account recovery,
  PWA install prompt flow.
- Post-resolution citizen feedback ("was this addressed?") — closes the loop
  emotionally, and gives the pilot a satisfaction metric.
- Admin first-run onboarding and empty/error states across `/triage`,
  `/dispatches`, `/map`.
- Filipino (and optionally Bikol) localization of citizen-facing copy —
  **decision gate**: confirm with the pilot LGU; likely required.

Definition of "complete UX" per app (exit checklist):

- No interactive journey ends without a next step or a designed terminal state.
- Every async surface has loading, empty, error, and offline states.
- Notifications exist for every cross-role handoff in the loop (citizen→admin
  arrival is implicit; admin→responder and responder→citizen need push).
- The audit re-run reports no P0/P1 gaps; `pnpm proof:local` extended to cover
  the notification paths.

### Phase 4 — Production Hardening (September)

Goal: safe to point real citizens at it.

Slices:

- The four deferred observability dashboards (`docs/progress.md` → Open #4),
  plus alerting and basic SLOs (uptime, callable error rate, time-to-triage).
- App Check enforced on production; rate limits verified under load.
- Backup/restore drill executed and logged (`docs/runbooks/restore-drill-log.md`).
- Production project setup checklist (separate Firebase project, IAM, budget
  alerts) — **every deploy requires fresh human approval per CLAUDE.md §8.4**.
- One game-day exercise validating `docs/runbooks/incident-response.md`.

Exit criteria: dashboards live and alerting; restore drill logged; game-day
findings fixed; production project exists with the soak rules of §8.4 honored.

### Phase 5 — Pilot Package (September–October, overlaps Phase 4)

Goal: an LGU can say yes and start. (Recruiting the LGU is human work, not
agent work — start conversations during Phase 3.)

Slices:

- Pilot launch statement from `docs/pilot-launch-statement-template.md`.
- Operator training guide (admin + responder) and a citizen-facing one-pager.
- Training environment = staging with the existing seed/reset scripts.
- Support channel, escalation card, and agreed pilot success metrics.

Exit criteria: one MDRRMO committed (at minimum verbally) with named admin and
responder participants; metrics agreed; training materials delivered.

### Phase 6 — Live Pilot (October–December)

Staged rollout:

- **Stage A (1–2 weeks):** MDRRMO staff only — they submit, triage, and
  dispatch internally.
- **Stage B (2–4 weeks):** controlled citizen group (barangay captains, CSO
  volunteers).
- **Stage C:** public announcement in the municipality — only if Stage B is
  stable.

Weekly cadence: metrics review → pick the top 3 fix slices → execute → deploy
under §8.4 soak rules.

Metrics (refine with the LGU): reports/week, median time-to-triage, median
time-to-dispatch, % of reports reaching a terminal state, responder
acknowledgement time, uptime, crash-free sessions, citizen feedback score.

Exit criteria: ≥4 weeks at Stage B or beyond; year-end go/no-go memo written.

## Standing Rules for Agent Execution

`CLAUDE.md` already governs how agents work (≤3 files per slice, red-first
tests, verification before completion, risky-change protocol). This roadmap
adds:

- **Task slice convention:** one file per slice in
  `docs/agent-tasks/<phase>-<seq>-<slug>.md` containing: Goal (one sentence),
  Files expected to change, Out of scope, Verification commands, and the
  evidence that defines done. A slice an agent cannot finish in one session is
  two slices.
- **One phase active at a time.** No Phase 4 work while Phase 3 audits are
  open, except P0 bugs.
- **Deploys are never agent-initiated.** Agents prepare; the human deploys.

## Decision Gates (features wait for evidence)

| Deferred feature                                                        | Gate that unlocks it                                                            |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| SMS outbound status updates                                             | Pilot LGU confirms citizens lack reliable data access, or tracking usage is low |
| Filipino/Bikol localization                                             | Decide in Phase 3 audit with LGU input (expected: yes for citizen copy)         |
| Second municipality                                                     | ≥4 stable pilot weeks plus an explicit request                                  |
| PostGIS / incident-core runtime                                         | **Not in 2026.** Revisit in 2027 planning with pilot data-volume evidence       |
| Duplicate clustering, hazard overlays, CAP, mutual aid, BigQuery export | Pilot evidence demands it; otherwise 2027 backlog                               |

## Not Doing in 2026

- Resuming the greenfield PostGIS/incident-core runtime migration (contracts
  stay as-is in `@bantayog/shared-validators`).
- Multi-agency coordination, mutual aid, provincial workflows.
- National alerting semantics or CAP XML.
- BI/analytics platform work beyond the operational dashboards in Phase 4.
- Scaling past one municipality.

Anything on this list proposed mid-year must displace something above and be
justified by pilot evidence — not by "since we're here."
