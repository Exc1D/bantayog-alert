# 3B-07 — PWA Install Prompt Surfacing

**Priority:** P2 (polish — installed app = reliable notifications + offline)

**Goal:** The citizen PWA surfaces an install affordance at two natural
moments — onboarding and post-submission success — using the captured
`beforeinstallprompt` event (Chromium) and an iOS instructions fallback.

## Files (≤3)

- `apps/citizen-pwa/src/hooks/useInstallPrompt.ts` (new — capture
  `beforeinstallprompt`, expose `canInstall`/`promptInstall`/platform)
- wiring into onboarding + RevealSheet success (recon in-slice: exact spots;
  if both can't fit with the hook in 3 files, wire onboarding only and note
  the second surface as follow-up)
- `apps/citizen-pwa/src/hooks/useInstallPrompt.test.ts` (new)

## Design constraints

- `beforeinstallprompt` is Chromium-only (learnings.md Background Sync
  precedent): iOS shows a short "Add to Home Screen" instruction sheet
  instead; already-installed (`display-mode: standalone`) shows nothing.
- One dismissal per surface persists (localStorage flag) — never re-nag in the
  same context; ethical-retention tone.
- Do not delay or gate report submission on installation — strictly optional.

## Red-first test

Hook test: synthetic `beforeinstallprompt` event → `canInstall` true and
`promptInstall` calls the captured event's `prompt()`; standalone display
mode → `canInstall` false. Must fail before the hook exists.

## Out of scope

- Push permission flows (3B-03), service worker changes, responder/admin
  install prompts.

## Verification

- `pnpm --dir apps/citizen-pwa exec vitest run src/hooks/useInstallPrompt.test.ts`
- `pnpm --dir apps/citizen-pwa exec tsc --noEmit && pnpm --dir apps/citizen-pwa exec eslint src`
