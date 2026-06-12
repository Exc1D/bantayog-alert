# RF-06 — Decompose SubmitReportForm `WizardContainer`

**Priority:** P2 (cyclomatic 23 / cognitive 18; 451 LOC — the citizen
emergency-report entry point mixes wizard state, autosave, rate limiting,
and rendering in one component)

**Goal:** `apps/citizen-pwa/src/components/SubmitReportForm/index.tsx`
becomes an orchestrator shell over a `useReportWizard` hook (state, autosave
gating, submission) plus the existing step components — the
DeclareAlertModal / ProfileTab decomposition pattern.

## Recon facts (2026-06-12 — re-verify before editing)

- Safety nets exist: tests under
  `apps/citizen-pwa/src/components/SubmitReportForm/` and app-level
  submit-flow/autosave/ratelimit specs. Locate them all first:
  `pnpm --dir apps/citizen-pwa exec vitest list src | grep -i -E 'submit|wizard|autosave|ratelimit'`
- Wizard contracts that MUST survive (learnings.md): snapshot saves gated on
  `hasLoadedSnapshot`; never persist `File`/`Blob` per keystroke;
  in-progress wizard state kept separate from finalized drafts;
  incident-type aliases normalized at the draft boundary; triage fields stay
  aligned across snapshot ↔ draft ↔ callable payload ↔ shared validator ↔
  `report_ops`.

## Files (≤3)

- `apps/citizen-pwa/src/components/SubmitReportForm/index.tsx` (slim to shell)
- `apps/citizen-pwa/src/components/SubmitReportForm/useReportWizard.ts`
  (new — state machine, autosave effect, submission orchestration)
- `apps/citizen-pwa/src/components/SubmitReportForm/useReportWizard.test.tsx`
  (new)

## Design constraints

- Behavior-neutral: every existing SubmitReportForm/submit-flow test passes
  unchanged. Prop contracts of Step1/Step2/Step3 components untouched.
- React Strict Mode double-invokes mount effects — preserve existing ref
  guards when moving effects into the hook.
- `exactOptionalPropertyTypes`: omit optional keys, never assign
  `undefined`.

## Red-first test

New hook test fails before the hook exists. Cover with fake timers: step
advance/retreat preserves entered data; autosave does not fire before
`hasLoadedSnapshot`; submission builds the payload from the final wizard
state.

## Out of scope

- Step2WhoWhere internals (rf-07); visual/UX changes; new wizard steps;
  offline queue and background-sync paths.

## Verification

- `pnpm --dir apps/citizen-pwa exec vitest run src/components/SubmitReportForm` (all suites green, same counts)
- App-level submit-flow/autosave/ratelimit specs green
- `pnpm --dir apps/citizen-pwa exec tsc --noEmit && pnpm --dir apps/citizen-pwa exec eslint src`; fallow audit gate passes
