# 3C-01 — Admin New-Report Signal

**Priority:** P0 (a new report arrival is invisible unless staring at /triage)

**Goal:** Admin Desktop gives ambient awareness of new report arrivals: an
audio tone, a populated `CommandHeader.notificationCount`, and a document
title badge — driven by the existing triage listener, no new backend.

## Files (≤3)

- `apps/admin-desktop/src/hooks/useNewReportSignal.ts` (new — watches the
  existing scoped report listener data for new arrivals since mount/last-seen)
- `apps/admin-desktop/src/components/CommandHeader.tsx` + page wiring (recon
  in-slice: where the triage listener lives so the hook can subscribe once at
  shell level, not per-page)
- `apps/admin-desktop/src/hooks/useNewReportSignal.test.ts` (new)

## Design constraints

- Derive "new" from report docs with status `new` whose `createdAt` is after
  the session's last-seen watermark; clear the count when the operator visits
  /triage. No Firestore reads beyond the listener already mounted.
- Audio: reuse the existing `useAudioAlerts` tone path (it exists, wired to
  nothing); respect a mute/sound setting if one exists — recon confirms.
- Title badge: `(N) Bantayog Command` via `document.title`; restore on clear.
- Dedup across windows follows the existing window-sync dedup pattern
  (learnings.md: `crypto.randomUUID()` + TTL map) only if multi-window is
  already handled for other signals — otherwise single-window is acceptable
  for this slice.

## Red-first test

Hook test with mocked listener data: a report arriving after the watermark
increments the count, fires the audio callback once, and updates the title;
visiting triage resets. Must fail before the hook exists.

## Out of scope

- Browser/system push for admins, SLA countdown (3C-02), backend changes.

## Verification

- `pnpm --dir apps/admin-desktop exec vitest run src/hooks/useNewReportSignal.test.ts`
- `pnpm --dir apps/admin-desktop exec tsc --noEmit && pnpm --dir apps/admin-desktop exec eslint src`
