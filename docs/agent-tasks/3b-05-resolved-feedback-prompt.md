# 3B-05 — "Was this addressed?" Prompt on Resolved Timeline

**Priority:** P1 (depends on 3B-04)

**Goal:** When a citizen views their resolved report's tracking timeline, they
see a one-time "Was this addressed?" prompt (Yes / No + optional comment) that
submits through the 3B-04 callable and then shows a thank-you state.

## Files (≤3)

- `apps/citizen-pwa/src/components/MapTab/DetailSheet.tsx` (resolved-timeline
  prompt; or a small extracted subcomponent if DetailSheet is already dense —
  recon decides, still ≤3 files)
- `apps/citizen-pwa/src/components/MapTab/DetailSheet.test.tsx` (extend)

## Design constraints

- Show only on the citizen's own resolved report, only if feedback hasn't been
  submitted (persist a local submitted flag keyed by reportId; the callable's
  one-per-report rule is the backend truth).
- Submission states: loading, success (thank-you replaces the prompt), error
  (inline retry — no silent swallow).
- Tone follows ethical-retention rules: one ask, dismissible, never blocks the
  timeline, no gamification.
- Anonymous reporters: recon in-slice — if the callable requires a
  non-anonymous uid match, hide the prompt for anonymous sessions and note it
  in the gate doc trail.

## Red-first test

DetailSheet test: resolved own report renders the prompt; answering calls the
callable with `{reportId, addressed}`; submitted state renders thank-you and
no prompt. Must fail before the change.

## Out of scope

- Backend callable (3B-04), admin-side feedback visibility, re-prompting.

## Verification

- `pnpm --dir apps/citizen-pwa exec vitest run src/components/MapTab/DetailSheet.test.tsx`
- `pnpm --dir apps/citizen-pwa exec tsc --noEmit && pnpm --dir apps/citizen-pwa exec eslint src`
