# 3C-00 — Admin-Desktop UX-Completeness Backlog (Index)

**Status:** Backlog index. Admin Desktop is the regulating surface for
everything citizens and responders see, so a gap here is a gap in the whole
product. Each `3c-NN` file is one executable slice for one agent on one
branch. Recon facts below were verified 2026-06-13; every slice re-verifies
its own facts before editing.

## Scope of this audit

`evaluate-ux-completeness` was run against the operational control surfaces:
the command shell (`CommandHeader`, navigation), the report-lifecycle surfaces
(`/triage`, `/map`, `/dispatches`), and the regulation surfaces that govern
what citizens/responders see (`FeedPage`, official alerts, citizen-post
moderation, and per-municipality hotline contact). It does **not** re-audit
the Dashboard or the responder-roster surfaces — those are a separate concern
tracked under the broader UX evaluation noted at the bottom.

## UX-completeness scorecard

| Category                       | Score                         | Headline finding                                                                                                                                                                                                                                                                                                                          |
| ------------------------------ | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| States & Feedback              | Partial                       | Report actions have optimistic UI + banners (`useOptimisticFeedActions`, `ActionErrorBanner`); sidebar moderation (alerts, citizen posts) is spinner-only; `FeedPage` shows a false "photos will retry automatically" copy; failed commands strand the operator with no retry (3C-06).                                                    |
| Navigation                     | Partial                       | The 5-tab `CommandHeader` nav is solid (active state, role-scoped). `FeedPage` conflates three unrelated moderation concerns (report publish pipeline, official alerts, citizen posts) on one cramped screen.                                                                                                                             |
| Forms & Input                  | Partial                       | `DeclareAlertModal` is strong (submit confirm + unsaved-changes guard + focus trap). Scrub editor has no char count vs the real backend limit and no "edited from original" indicator; no confirm on publish/verify; sidebar moderation reasons are hardcoded.                                                                            |
| Content & Copy                 | Partial                       | "They will retry automatically" is not implemented (no retry path exists). Mixed-language operator copy in places.                                                                                                                                                                                                                        |
| Edge Cases                     | Partial                       | Official alerts capped at 5 and citizen posts at 10 in sidebar widgets — overflow is silently invisible; no search/pagination; no concurrent-edit/conflict handling on moderation toggles.                                                                                                                                                |
| Accessibility                  | Partial                       | Modals use focus traps and roles; icon-only buttons mostly labelled. Not separately re-audited this pass (use `impeccable audit` after the gaps below close).                                                                                                                                                                             |
| Responsive                     | N/A (desktop)                 | Admin Desktop is an operator workstation app; mobile responsiveness is out of its product scope.                                                                                                                                                                                                                                          |
| Onboarding                     | Partial                       | An onboarding tour exists; empty states on moderation surfaces are thin.                                                                                                                                                                                                                                                                  |
| **Capability: runtime config** | **Missing → shipped (3C-07)** | There was **no** surface to manage the per-municipality MDRRMO hotline citizens see on the post-submission RevealSheet, SMS fallback, and failure states. Only `daet` was seeded; the other 11 municipalities silently fell back to a hardcoded default. Changing a hotline meant a manual Firestore console edit. **3C-07 closes this.** |

## Ranked slices

| Rank | Slice | Concern                                                        | Priority            | Status                |
| ---- | ----- | -------------------------------------------------------------- | ------------------- | --------------------- |
| —    | 3c-01 | Ambient new-report signal (audio + badge + title)              | P0                  | **Done** (2026-06-11) |
| 1    | 3c-02 | SLA countdown on dispatch cards                                | P0                  | Open                  |
| 2    | 3c-03 | Resolved-dispatch closure state                                | P0                  | Open                  |
| 3    | 3c-07 | **Per-municipality hotline config (this session)**             | P1 (capability gap) | **Done** (2026-06-13) |
| 4    | 3c-04 | Reject confirmation modal on /triage                           | P1                  | Open                  |
| 5    | 3c-05 | Designed permission-denied state for admin hooks               | P1                  | Open                  |
| 6    | 3c-06 | Retry affordance on ActionErrorBanner                          | P1                  | Open                  |
| 7    | 3c-08 | Publication-queue hardening (confirm + char count + filter)    | P1                  | Doc only              |
| 8    | 3c-09 | Citizen-post moderation queue (uncapped + reasons)             | P1                  | Doc only              |
| 9    | 3c-10 | Official-alerts manager (uncapped + retire/restore reasons)    | P1                  | Doc only              |
| 10   | 3c-11 | Feed IA split (thin shell + three tabs)                        | P2 (after 08–10)    | Doc only              |
| 11   | 3b-12 | Citizen hotline-fallback cleanup (citizen track)               | P2                  | Doc only              |
| 12   | 3c-17 | Map overlay controls — remove dead toggles (audit N1)          | P1                  | Doc only              |
| 13   | 3c-18 | Map reject — confirmation + reason picker (audit N2)           | P1                  | Doc only              |
| 14   | 3c-19 | Ops-metric truth-gate — FCM `0%`-on-load + poll error (N3)     | P1                  | Doc only              |
| 15   | 3c-20 | Dashboard declare-alert error surfacing (audit N4)             | P1                  | Doc only              |
| 16   | 3c-21 | Municipality drill-down — dead branch + param mismatch (N6+N7) | P2                  | Doc only              |

3C-07 was promoted ahead of 3C-04..06 this session because it was the one
**Missing-grade capability gap** (no surface existed at all), whereas 3C-04..06
harden surfaces that already function.

`3c-17`–`3c-21` were added 2026-06-14 from the end-to-end control audit
(`docs/admin-control-contract.md`), covering the newly-discovered truth defects
with no prior slice: the Map's entirely-dead 5-toggle overlay panel (N1 → 3c-17),
the Map's hardcoded confirmation-less reject (N2 → 3c-18), the FCM `0%`-on-load +
silent ops-poll error on Dashboard + Dispatches (N3 → 3c-19), the Dashboard
declare-alert `onError` swallow (N4 → 3c-20), and the municipality drill-down that
is broken on both paths — the dead cross-window `select:municipality` branch (N6)
and the Dashboard→Map URL param mismatch (N7, found while verifying N6) — sliced
together as 3c-21. N5 (false "retry automatically" copy) folds into `3c-08`. All
audit findings are now sliced.

## Execution rules (binding for every slice)

1. One slice = one branch = one PR. Branch name `feat/3c-NN-<slug>` (or
   `feat/3b-NN-<slug>`). Never bundle slices or mix tracks.
2. Before editing: re-run the slice's recon. If a fact drifted (a callable
   gained/lost a caller, a file moved), stop and report instead of proceeding.
3. Red-first. Write one failing test, run it, see it fail with a meaningful
   error, then implement. New pure modules get their own focused tests that
   fail before the module exists.
4. **Zero rules/index/schema edits without explicit approval** (CLAUDE.md
   §8.4). 3C-07 deliberately uses an Admin SDK callable precisely so that
   `firestore.rules` is untouched — the SDK bypasses rules and the role gate
   lives in the callable. Apply the same pattern to any future config slice.
5. Worktree hygiene: `git branch -vv` + clean `git status` before edits; in a
   fresh worktree `pnpm install --frozen-lockfile`; **build `@bantayog/shared-validators`
   and `functions` `lib/` before trusting emulator tests** — they import
   `lib/`, not `src` (learnings.md).
6. The admin-desktop test env in this worktree has **no `VITE_FIREBASE_API_KEY`**,
   so any test file that imports `../app/firebase` without mocking it crashes
   at module load on `getAuth` (`auth/invalid-api-key`, `firebase.ts:51`).
   New/edited firebase-touching test files MUST add
   `vi.mock('../app/firebase', () => ({ db: {} }))`. Six pre-existing files
   (`MapPage.test.tsx`, `MapPage.ux-completeness.test.tsx`,
   `dashboard-firestore-wiring.test.tsx`, `dashboard-redispatch.test.tsx`,
   `map-firestore-wiring.test.tsx`, `services/callables.test.ts`) fail this way
   in the full suite; they are pre-existing and out of scope — do not "fix" them
   inside an unrelated slice.
7. Finish each slice by appending to `docs/progress.md` (and `docs/learnings.md`
   if a durable rule emerged), then two-stage review (spec compliance → code
   quality) before merge.

## Explicitly rejected

- A general `system_config` Settings page. The only runtime-config need today
  is the hotline (3C-07); a generic settings framework is speculative
  (YAGNI). Revisit only when a third config knob appears.
- Implementing the feed restructure (3C-08..11) in the same session as 3C-07.
  Feed IA is a multi-surface change that demands its own red-first slices and
  its own review; bundling it would violate one-concern-per-branch.
- Editing `firestore.rules`/indexes for hotline config. Admin SDK + callable
  role gate is sufficient and safer (safety memory: never auto-stage rules).

## Out of scope for this index (tracked in 3c-12)

The Dashboard and Dispatch/Responder surfaces have their own UX-completeness
pass in **`3c-12-dashboard-responder-ops-index.md`**: responder roster management
(`3c-13`), create/delete responder accounts, and the wired-vs-unwired state of
`createResponder` (wired), `suspendResponder`/`revokeResponder`/
`bulkAvailabilityOverride` (orphaned; the last lost its Dispatch wiring per
`rf-00`) → slices `3c-14`/`3c-15`, plus the false "uncovered municipalities"
Dashboard metric (`3c-16`). That backlog still requires sign-off before any build.
