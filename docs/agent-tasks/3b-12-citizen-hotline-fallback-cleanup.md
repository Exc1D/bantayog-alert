# 3B-12 — Citizen Hotline-Fallback Cleanup

**Priority:** P2 (citizen track)

**Status:** Doc only (not implemented). Frontend-only when built; no backend.

**Goal:** Make the rate-limit fallback show the **same** municipality hotline
3C-07 lets admins manage, instead of a second, divergent, env-var-gated
hardcoded number. Today a rate-limited citizen sees a different number than the
RevealSheet shows for the same municipality.

## Recon facts (verified 2026-06-13, re-verify before editing)

- `apps/citizen-pwa/src/components/SubmitReportForm/RateLimitError.tsx:3`:
  `const BARANGAY_HOTLINE = import.meta.env.VITE_BARANGAY_HOTLINE ?? 'tel:+63-054-440-1234'`.
  This `'+63-054-440-1234'` diverges from the seeded Daet hotline
  `(054) 721-1216` that `useMunicipalityContact` returns — two sources of truth.
- `RateLimitError` currently takes **no props**, so wiring the hook requires
  threading the citizen's selected `municipalityId` from the submit wizard into
  the component (recon in-slice: where `RateLimitError` is rendered and whether
  the wizard's selected municipality is in scope there).
- `apps/citizen-pwa/src/hooks/useMunicipalityContact.ts` already exists and
  returns `{ label, hotline }`, falling back to `DEFAULT_CONTACT` while loading
  or for unknown jurisdictions.

## Decision to make in-slice

Keep `DEFAULT_CONTACT` as the last-resort fallback (recommended): it covers the
loading window and unknown/unset jurisdictions, which a per-municipality lookup
cannot. The change is to **stop using the env var / second hardcoded number**
and route the displayed hotline through `useMunicipalityContact`, not to remove
the safety default.

## Files (≤2 + tests)

- `apps/citizen-pwa/src/components/SubmitReportForm/RateLimitError.tsx`
  (modify): accept a `municipalityId` prop, call `useMunicipalityContact`,
  render its `hotline`/`label`; delete the `VITE_BARANGAY_HOTLINE` constant.
- Its render site (modify): pass the wizard's selected `municipalityId`.

## Red-first test

- `SubmitReportForm.ratelimit.test.tsx` (exists): assert the rendered hotline
  comes from the municipality contact (mock `useMunicipalityContact`), and that
  the env-var path is gone.

## Out of scope

- Backend/callable/rules changes. The admin hotline editor (3C-07, shipped).
  Removing `DEFAULT_CONTACT`. The citizen-pwa teal palette (deliberate brand —
  do not touch).

## Verification

- `pnpm --dir apps/citizen-pwa exec vitest run src/__tests__/SubmitReportForm.ratelimit.test.tsx`
- `pnpm --dir apps/citizen-pwa exec tsc --noEmit && pnpm --dir apps/citizen-pwa exec eslint src`
