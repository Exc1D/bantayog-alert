# 3C-04 — Reject Confirmation Modal on /triage

**Priority:** P1 (verify has confirmation on /map; reject — the destructive
twin — commits instantly)

**Goal:** Single and bulk rejection on the /triage workbench show a
confirmation modal with the selected reason and note visible before the
`rejectReport` call commits.

## Files (≤3)

- `apps/admin-desktop/src/pages/TriagePage.tsx` (gate the reject handlers
  behind confirmation)
- `apps/admin-desktop/src/pages/TriagePage.test.tsx` (extend)
- (only if needed) reuse `ConfirmationModal.tsx` — recon in-slice checks its
  contract first; do not create a new modal if the shared one fits
  (learnings.md: shared modal reuse only when role/name/disabled/backdrop
  contracts already match)

## Design constraints

- The modal restates: how many reports, the chosen reason enum, and the
  trimmed note (or "no note"). Confirm = existing reject path unchanged;
  cancel = no call.
- Bulk rejection shows the count prominently; selection-clearing-on-filter
  behavior (learnings.md) is untouched.
- Real `<form>`/dialog semantics, focus the dialog on open, restore focus on
  close — match existing modal a11y patterns.

## Red-first test

Page test: clicking reject opens the confirmation with reason+note visible
and does NOT call the callable; confirming calls it once with the same
payload as today. Must fail before the change.

## Out of scope

- New rejection reasons, free-text reasons, verify-flow changes, backend
  changes.

## Verification

- `pnpm --dir apps/admin-desktop exec vitest run src/pages/TriagePage.test.tsx`
- `pnpm --dir apps/admin-desktop exec tsc --noEmit && pnpm --dir apps/admin-desktop exec eslint src`
