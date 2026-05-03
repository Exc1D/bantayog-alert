# Spec: Report Status UX Redesign

**Date:** 2026-05-03  
**Status:** Approved  
**Scope:** Citizen PWA + `requestLookup` Firebase callable

---

## Problem

1. `LookupScreen` requires two codes (publicRef + secret) — too much friction. Users who saved the secret code have no standalone path to status.
2. `TrackingScreen` is functional but emotionally flat — no animation, generic copy, raw status strings in the timeline.
3. After submission, the secret code on `ReceiptScreen` is visually indistinct from the reference code — users don't know it's the more important one.
4. Users with a pending/unverified report have no passive signal — they must navigate to Profile or remember `/lookup` exists.

---

## Solution Overview

Option A (approved): Thin `LookupScreen` entry → enhanced `TrackingScreen` destination.

- `requestLookup` callable extended to accept secret-only.
- `LookupScreen` reduced to one field; navigates to `/reports/:publicRef` on success.
- `TrackingScreen` redesigned with radar animation, status-aware hero, human timeline labels.
- `ReceiptScreen` elevates secret code visually and adds a copy button.
- `CitizenShell` gains a persistent `ReportStatusPill` above the nav bar.

---

## Architecture

### Touch Points

| File                                                   | Change                                                                 |
| ------------------------------------------------------ | ---------------------------------------------------------------------- |
| `apps/citizen-pwa/src/components/LookupScreen.tsx`     | Secret-only form; navigate to `/reports/:publicRef` on success         |
| `apps/citizen-pwa/src/components/TrackingScreen.tsx`   | Radar animation, status-aware hero, human timeline labels              |
| `apps/citizen-pwa/src/components/CitizenShell.tsx`     | Mount `ReportStatusPill` above nav                                     |
| `apps/citizen-pwa/src/components/ReceiptScreen.tsx`    | Elevate secret code; add copy button; extract `RadarRings`             |
| `apps/citizen-pwa/src/components/ui/RadarRings.tsx`    | **New** — extracted from `ReceiptScreen`, shared with `TrackingScreen` |
| `apps/citizen-pwa/src/components/ReportStatusPill.tsx` | **New** — persistent active-report chip                                |
| `functions/src/requestLookup` (or equivalent)          | Accept `{ secret }` alone via `secret_lookup/{secretHash}` collection  |

### Backend Data Flow

```
User enters secret
→ LookupScreen calls requestLookup({ secret })
→ server: sha256(secret) → query secret_lookup/{hash} → { publicRef, reportId }
→ returns { publicRef, status, municipalityLabel, lastStatusAt }
→ navigate('/reports/:publicRef')
→ TrackingScreen: live Firestore subscription via useReport(publicRef)
```

The `secret_lookup` collection mirrors the existing `report_lookup` pattern:

- Document ID: `sha256(secretPlaintext)` (hex)
- Fields: `{ publicRef: string, reportId: string }`
- Written at report creation time alongside `report_lookup`
- Security rules: allow read if `request.auth != null` (same as `report_lookup`)

---

## Section 1: LookupScreen

### Form

- Remove `publicRef` / "Reference Code" field entirely.
- Single field: secret code input (`type="password"`, `autoComplete="new-password"`, monospace).
- Label: `KeyRound` icon (lucide) + `"Secret Code"` in bold teal (`text-brand-600`).
- Placeholder: `"Your secret code"`.
- Validation: trim + non-empty only (no format constraint).
- Submit button: `"Find My Report"`.

### Header

- Replace dark navy (`bg-[#25292a]`) header with the app's standard teal gradient (`bg-brand-500`).
- Heading: `"Track your Report"`.
- Bilingual subtext: `"Ang iyong secret code ang susi sa iyong ulat."`.

### On Success

- Callable returns `{ publicRef, ... }`.
- Immediately `navigate('/reports/:publicRef')` — no intermediate state shown.

### On Error

- Same `friendlyLookupError` mapping, copy updated to remove reference-code mentions.
- Not-found / permission-denied: `"We couldn't find a report with that secret code. Check for typos and try again."`

### Unchanged

- Route `/lookup`.
- `ensureSignedIn()` call before callable.
- Rate-limit and auth error handling.

---

## Section 2: TrackingScreen

### Status-Aware Hero Banner

Full-width hero replacing the current `bg-surface-100` header. Color and copy keyed to status group:

| Status group                                      | Color token      | Hero copy                                    |
| ------------------------------------------------- | ---------------- | -------------------------------------------- |
| `new` / `awaiting_verify`                         | `bg-brand-500`   | "Your report is in the queue. We've got it." |
| `verified` / `assigned` / `acknowledged`          | `bg-warning-500` | "Responders have been notified."             |
| `en_route` / `on_scene`                           | `bg-warning-600` | "Help is on the way."                        |
| `resolved` / `closed`                             | `bg-success-500` | "Situation resolved. Thank you."             |
| `rejected` / `cancelled*` / `merged_as_duplicate` | `bg-surface-600` | "This report was closed."                    |

### Radar Animation

- Import `RadarRings` from `components/ui/RadarRings.tsx` (extracted from `ReceiptScreen`).
- Rendered inside the hero banner, centered behind the status icon.
- **Persistent** (no timeout) while status is non-terminal (`awaiting_verify`, `verified`, `assigned`, `acknowledged`, `en_route`, `on_scene`).
- **Hidden** when status is terminal (`resolved`, `closed`, `rejected`, `cancelled*`, `merged_as_duplicate`).
- Ring color matches hero zone: `brand-500` for queued, `warning-500` for active responders.
- Respects `motion-safe` — rings rendered but `animate` prop omitted (rings visible at resting opacity, no pulse) when `prefers-reduced-motion: reduce`.

### Timeline Labels

Map raw status strings to human labels in `TrackingScreen` before passing to `<Timeline>`:

| Raw status                             | Timeline label                     |
| -------------------------------------- | ---------------------------------- |
| `new`                                  | `"Report received"`                |
| `awaiting_verify`                      | `"Under review by MDRRMO"`         |
| `verified`                             | `"Verified — responders notified"` |
| `assigned`                             | `"Responder assigned"`             |
| `acknowledged`                         | `"Responder acknowledged"`         |
| `en_route`                             | `"Responder en route"`             |
| `on_scene`                             | `"Responder on scene"`             |
| `resolved`                             | `"Situation resolved"`             |
| `closed`                               | `"Report closed"`                  |
| `rejected`                             | `"Report rejected"`                |
| `cancelled` / `cancelled_false_report` | `"Report cancelled"`               |
| `merged_as_duplicate`                  | `"Merged as duplicate"`            |

**Pending future event:** When status is non-terminal, append one greyed-out `state: 'pending'` timeline item labeled `"Awaiting resolution"` — makes the timeline feel like a live tracker, not a backward-looking log.

### Unchanged

- `useReport` hook (live Firestore subscription).
- Location card, contact card, resolution note card.
- "Call responders" and "Update report" action buttons.
- Back/home header buttons.

---

## Section 3: ReportStatusPill

### Component: `ReportStatusPill.tsx`

Reads from `useMyActiveReports()` independently (no prop drilling from CitizenShell).

**Visibility condition:** At least one report with a non-terminal status:

- Non-terminal: `queued`, `new`, `awaiting_verify`, `verified`, `assigned`, `acknowledged`, `en_route`, `on_scene`, `reopened`
- Terminal (hide): `resolved`, `closed`, `rejected`, `cancelled`, `cancelled_false_report`, `merged_as_duplicate`

**Not shown** when current route is `/reports/:reference` (user already viewing that screen).

### Appearance

```
[ ● Flood · Daet  ·  Under Review   › ]
```

- `bg-surface-900/90 backdrop-blur-sm` dark pill — contrasts against map and light tab backgrounds.
- Severity dot (`severityDotColor`) + `incidentLabel(reportType)` + municipality.
- Status badge (same `statusMeta` pill style as `ReportCard` in `ProfileTab`).
- `ChevronRight` icon to signal tappability.
- Multiple active reports: show the one with the highest `submittedAt` + `+N more` badge.

### Positioning in CitizenShell

```
position: fixed
bottom: calc(4rem + env(safe-area-inset-bottom, 0px))
left: 50%
transform: translateX(-50%)
z-index: z-toast
```

Clears the nav bar on all devices including iPhone notch.

### Animation

- `framer-motion` `AnimatePresence` — slides up from nav (`y: 40 → 0`, `opacity: 0 → 1`).
- Mirrors the offline banner animation pattern already in `CitizenShell`.
- Respects `useReducedMotion`.

### On Tap

- Navigate to `/reports/:publicRef` of the most recently submitted active report.

### Persistence

- Shown until ALL reports reach terminal status.
- No dismiss button. No session storage. Reappears on every app open until resolved/rejected.

---

## Section 4: ReceiptScreen

### Secret Code Box

- Background: `bg-brand-50`, border: `border-brand-400` (currently `bg-surface-100`, `border-surface-200`).
- Label row: `KeyRound` icon (lucide, `text-brand-500`) + `"Your Secret Code"` in `text-brand-600 font-bold`.
- Code display: unchanged (`text-2xl font-bold tracking-widest font-mono`).
- Subtext: `"This is the only code you need to track your report. Save it somewhere safe."` — `text-sm text-surface-600` (currently `text-xs text-surface-400`).
- **Copy button**: inline below the code. `navigator.clipboard.writeText(state.secret)`. Shows `"Copied!"` for 1.5s then reverts to `"Copy secret code"`. Follows the same try/catch pattern as `handleShare` in ProfileTab.

### RadarRings Extraction

- Move `RadarRings` and `AnimatedCheck` from `ReceiptScreen.tsx` to `components/ui/RadarRings.tsx`.
- `ReceiptScreen` imports from new location.
- `TrackingScreen` imports `RadarRings` from same location.
- `AnimatedCheck` stays in `RadarRings.tsx` (used only on receipt; export it anyway for future use).

### Unchanged

- Sheet/backdrop layout, slot machine reference display, haptic feedback, navigation buttons.

---

## Out of Scope

- Reverse geocoding for report location.
- Push notification on status change.
- Re-open report flow.
- Any changes to `report_lookup` collection or existing callable for users who still have both codes.

---

## Verification

```bash
cd apps/citizen-pwa && pnpm lint && pnpm typecheck && pnpm vitest run
```

All 330 existing tests must pass. New tests required for:

- `LookupScreen`: secret-only submit, error states, navigation on success
- `ReportStatusPill`: renders when active reports exist, hidden on terminal status, hidden on `/reports/:ref` route
- `RadarRings`: renders rings, respects `prefers-reduced-motion`
