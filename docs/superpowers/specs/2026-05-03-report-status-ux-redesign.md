# Spec: Report Status UX Redesign

**Date:** 2026-05-03
**Status:** Approved (v2 — post-review)
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

- `requestLookup` callable extended to accept `{ secret }` alone and returns `publicRef` in all responses.
- `LookupScreen` reduced to one field; navigates to `/reports/:publicRef` on success.
- `TrackingScreen` redesigned with radar animation, status-aware hero, human timeline labels.
- `ReceiptScreen` elevates secret code visually, adds copy button, navigates directly to TrackingScreen.
- `CitizenShell` gains a persistent `ReportStatusPill` above the nav bar.

---

## Architecture

### Touch Points

| File                                                   | Change                                                                                                          |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| `apps/citizen-pwa/src/components/LookupScreen.tsx`     | Secret-only form; navigate to `/reports/:publicRef` on success                                                  |
| `apps/citizen-pwa/src/components/TrackingScreen.tsx`   | Radar animation, status-aware hero, human timeline labels                                                       |
| `apps/citizen-pwa/src/components/CitizenShell.tsx`     | Mount `ReportStatusPill` above nav                                                                              |
| `apps/citizen-pwa/src/components/ReceiptScreen.tsx`    | Elevate secret code; add copy button; "Track" navigates directly to `/reports/:publicRef`; extract `RadarRings` |
| `apps/citizen-pwa/src/components/ui/RadarRings.tsx`    | **New** — extracted from `ReceiptScreen`, shared with `TrackingScreen`                                          |
| `apps/citizen-pwa/src/components/ReportStatusPill.tsx` | **New** — persistent active-report chip                                                                         |
| `functions/src/callables/request-lookup.ts`            | Accept `{ secret }` alone (new path); extend return type to include `publicRef`; update Zod schema              |
| `functions/src/triggers/process-inbox-item.ts`         | Write `secret_lookup/{tokenHash}` for `source: 'web'` submissions only                                          |

### Backend Data Flow — Secret-Only Path

```
User enters secret
→ LookupScreen calls requestLookup({ secret })
→ server: sha256(secret) → query secret_lookup/{hash} → { publicRef, reportId }
→ returns { publicRef, status, lastStatusAt, municipalityLabel }
→ navigate('/reports/:publicRef')
→ TrackingScreen: live Firestore subscription via useReport(publicRef)
```

### Backend Data Flow — Existing Both-Codes Path (unchanged)

```
requestLookup({ publicRef, secret })
→ server: lookup report_lookup/{publicRef}, verify sha256(secret) == tokenHash
→ returns { publicRef, status, lastStatusAt, municipalityLabel }  ← publicRef now echoed back
```

Existing callers (`useMyActiveReports`, `ProfileTab`) already have `publicRef` locally and ignore the newly-returned field — no breakage.

---

## Section 1: Callable — `requestLookup`

### Updated Zod Input Schema

Replace the current strict single-shape schema with a discriminated union:

```typescript
const payloadSchema = z.union([
  z.object({
    publicRef: z.string().regex(/^[a-z0-9]{8}$/),
    secret: z.string().min(1).max(64),
  }),
  z.object({
    secret: z.string().min(1).max(64),
  }),
])
```

### Updated Return Type

```typescript
export interface RequestLookupResult {
  publicRef: string // ← NEW: echoed/resolved publicRef
  status: string
  lastStatusAt: number
  municipalityLabel: string
}
```

Existing callers already have `publicRef` locally and can safely ignore the new field.

### Auth Requirement for Secret-Only Path

The callable receives `request.auth`. For the secret-only path, **`request.auth` must be non-null** (i.e., the caller must be authenticated). The existing `ensureSignedIn()` call in `LookupScreen` handles this client-side, but the callable enforces it server-side:

```typescript
if (!publicRef && !request.auth) {
  throw new HttpsError('unauthenticated', 'Authentication required for secret-only lookup.')
}
```

The existing both-codes path (`{ publicRef, secret }`) retains its current auth behavior (unauthenticated callers allowed, e.g., `useMyActiveReports`).

### `secret_lookup` Collection

- Document ID: `tokenHash` (= `sha256(secretPlaintext)` hex — the same value stored as `report_lookup.tokenHash`)
- Fields: `{ publicRef: string, reportId: string, expiresAt: number }`
- Security rules: `allow read: if request.auth != null`
- Written alongside `report_lookup` in `process-inbox-item.ts` **for `source: 'web'` submissions only** (SMS submissions generate a random `secretHash` never shown to the user — no `secret_lookup` entry is created for them)
- Lifecycle: expires via `expiresAt` (same 90-day window as `report_lookup`). `close-report.ts` does NOT delete `report_lookup` documents — entries expire naturally. `secret_lookup` follows the same pattern.

### Backend Write Path — `process-inbox-item.ts`

Add inside the existing Firestore transaction, after the `report_lookup` write, conditioned on source:

```typescript
if (payload.source === 'web') {
  tx.set(db.collection('secret_lookup').doc(inbox.tokenHash), {
    publicRef: inbox.publicRef,
    reportId,
    expiresAt: createdAt + 90 * 24 * 60 * 60 * 1000,
  })
}
```

`inbox.tokenHash` = `inbox.secretHash` (already available at this point in the transaction). No change needed to `submit-responder-witnessed-report.ts` — it generates a random tokenHash the user never sees.

### Expired Report Error UX

The callable already throws `NOT_FOUND` for expired entries (`expiresAt < Date.now()`). `LookupScreen`'s `friendlyLookupError` maps this to the existing not-found message. Spec explicitly defines this copy: **"We couldn't find a report with that secret code. It may have expired (reports are tracked for 90 days)."**

---

## Section 2: LookupScreen

### Form

- Remove `publicRef` / "Reference Code" field entirely.
- Single field: secret code input (`type="password"`, `autoComplete="new-password"`, monospace).
- Label: `KeyRound` icon (lucide) + `"Secret Code"` in bold teal (`text-brand-600`).
- Placeholder: `"Your secret code"`.
- Validation: trim + non-empty only (no format constraint — secret is 16 chars but we don't hint this to avoid confusion).
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
- Not-found / permission-denied / expired: `"We couldn't find a report with that secret code. It may have expired (reports are tracked for 90 days)."`
- Rate-limit and unauthenticated messages unchanged.

### Unchanged

- Route `/lookup`.
- `ensureSignedIn()` call before callable.

---

## Section 3: TrackingScreen

### Status-Aware Hero Banner

Full-width hero replacing the current `bg-surface-100` header. Color and copy keyed to status group.

**Note on color divergence from `statusMeta`:** The hero uses urgency-signaling colors (amber = active responders) rather than the passive status-tracking palette used in ProfileTab (`statusMeta` shows green for `assigned`/`acknowledged`). This is intentional — TrackingScreen is the emotional focal point where "something is actively happening" needs to register immediately.

| Status group                                                                | Color token      | Hero copy                                    |
| --------------------------------------------------------------------------- | ---------------- | -------------------------------------------- |
| `new` / `awaiting_verify`                                                   | `bg-brand-500`   | "Your report is in the queue. We've got it." |
| `verified` / `assigned` / `acknowledged`                                    | `bg-warning-500` | "Responders have been notified."             |
| `en_route` / `on_scene`                                                     | `bg-warning-600` | "Help is on the way."                        |
| `resolved` / `closed`                                                       | `bg-success-500` | "Situation resolved. Thank you."             |
| `rejected` / `cancelled` / `cancelled_false_report` / `merged_as_duplicate` | `bg-surface-600` | "This report was closed."                    |

### Radar Animation

- Import `RadarRings` from `components/ui/RadarRings.tsx` (extracted from `ReceiptScreen`; see Section 5).
- Rendered inside the hero banner, centered behind the status icon.
- **Persistent** (no timeout) while status is non-terminal.
- **Hidden** when status is terminal (`resolved`, `closed`, `rejected`, `cancelled`, `cancelled_false_report`, `merged_as_duplicate`).
- Ring color: `brand-500` for queued states, `warning-500` for active-responder states — passed via `color` prop (see RadarRings API in Section 5).
- Respects reduced motion: rings rendered but `animate` prop omitted — rings visible at resting opacity, no pulse.

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

## Section 4: ReportStatusPill

### Component: `ReportStatusPill.tsx`

Reads from `useMyActiveReports()` independently (no prop drilling from CitizenShell).

**Important — staleness tradeoff:** `useMyActiveReports` calls the `requestLookup` callable (not a live Firestore subscription). The pill will reflect the status as of the last `bantayog:report-saved` event or last app open. This is acceptable: the pill is a _reminder_ that an active report exists, not a live feed. The authoritative real-time view is `TrackingScreen`. When the user taps the pill and visits TrackingScreen, they see live status. The pill disappears on next app session once the hook detects a terminal status.

**Performance note:** `useMyActiveReports` fires one `requestLookup` callable call per stored report on mount. With the pill mounting in CitizenShell alongside ProfileTab (which also calls the hook), there is a brief period where both components trigger independent fetches. This is acceptable for the current volume but should be addressed by lifting the hook to a shared context in a follow-up if the callable cost becomes significant.

### Visibility Predicate

```typescript
const NON_TERMINAL: Set<string> = new Set([
  ...ACTIVE_REPORT_STATUSES, // from @bantayog/shared-types
  'reopened',
])

const hasActivePill = reports.some((r) => r.status === 'queued' || NON_TERMINAL.has(r.status))
```

`'queued'` is a frontend pseudo-status (report saved locally, not yet in Firestore). It's non-terminal by definition. `'reopened'` is a valid `ReportStatus` but is not in `ACTIVE_REPORT_STATUSES` — include it explicitly.

### Appearance

```
[ ● Flood · Daet  ·  Under Review   › ]
```

- `bg-surface-900/90 backdrop-blur-sm` dark pill — contrasts against map tiles and light tab backgrounds.
- Severity dot (`severityDotColor`) + `incidentLabel(reportType)` + municipality.
- Status badge (same `statusMeta` pill style as `ReportCard` in `ProfileTab`).
- `ChevronRight` icon to signal tappability.
- Multiple active reports: show the one with the highest `submittedAt` + `+N more` count badge.

### Positioning in CitizenShell

```css
position: fixed;
bottom: calc(4rem + env(safe-area-inset-bottom, 0px));
left: 50%;
transform: translateX(-50%);
z-index: z-toast;
```

Clears the nav bar on all devices including iPhone notch. The offline banner sits at the top of the content area (`shrink-0` in the flex column) — the two elements don't overlap.

### Animation

- `framer-motion` `AnimatePresence` — slides up from nav (`y: 40 → 0`, `opacity: 0 → 1`).
- Mirrors the offline banner animation pattern already in `CitizenShell`.
- Respects `useReducedMotion`.

### On Tap

Navigate to `/reports/:publicRef` of the report with the highest `submittedAt` among active reports. `TrackingScreen` is outside `CitizenShell`, so the pill is naturally absent when the user is viewing their report.

### Persistence

- Shown until ALL reports reach terminal status.
- No dismiss button. No session storage. Reappears on every app open until resolved/rejected.

---

## Section 5: ReceiptScreen + RadarRings Extraction

### RadarRings Component API (`components/ui/RadarRings.tsx`)

```typescript
interface RadarRingsProps {
  color: string // CSS color string, e.g. 'rgb(15,148,136)' or 'var(--color-brand-500)'
  autoHideMs?: number // if set, hides rings after this many ms (ReceiptScreen uses 6000)
  animate?: boolean // defaults true; false = rings visible at resting opacity, no pulse
}
```

- `ReceiptScreen`: `<RadarRings color="rgb(5,150,105)" autoHideMs={6000} />`
- `TrackingScreen`: `<RadarRings color={heroColor} />` (persistent, no autoHide)
- `AnimatedCheck` is also extracted to `RadarRings.tsx` (used only by ReceiptScreen; exported for future reuse).
- Both `RadarRings` and `AnimatedCheck` respect `prefers-reduced-motion`: wrap animations in `motion-safe:` or pass `animate={false}` when `useReducedMotion()` returns true.

### Secret Code Box

- Background: `bg-brand-50`, border: `border-brand-400` (currently `bg-surface-100`, `border-surface-200`).
- Label row: `KeyRound` icon (lucide, `text-brand-500`) + `"Your Secret Code"` in `text-brand-600 font-bold`.
- Code display: unchanged (`text-2xl font-bold tracking-widest font-mono`).
- Subtext: `"This is the only code you need to track your report. Save it somewhere safe."` — `text-sm text-surface-600` (currently `text-xs text-surface-400`).
- **Copy button**: inline below the code. `navigator.clipboard.writeText(state.secret)`. Shows `"Copied!"` for 1.5s then reverts. Wrapped in `try/catch` — failure (unsupported browser/insecure context) silently ignored, matching the `handleShare` pattern in `ProfileTab`.

### "Track My Report" Button

Change navigate target from `/lookup` to `/reports/:publicRef` using `state.publicRef` (already available in `ReceiptScreen`'s location state). User should never need to re-enter their secret code immediately after submission.

### Unchanged

- Sheet/backdrop layout, slot machine reference display, haptic feedback, back-to-map button.

---

## Out of Scope

- Reverse geocoding for report location.
- Push notification on status change.
- Re-open report flow.
- Bilingual copy on hero/pill/timeline labels (deferred to a localization pass).
- Any changes to `report_lookup` collection or the existing both-codes callable path.

---

## Verification

```bash
cd apps/citizen-pwa && pnpm lint && pnpm typecheck && pnpm vitest run
cd functions && pnpm lint && pnpm typecheck && pnpm test
```

All existing tests must pass. New tests required for:

- `LookupScreen`: secret-only submit, error states (not-found, expired, rate-limit), navigation on success
- `ReportStatusPill`: renders when active reports exist, hidden on all-terminal status, `queued` treated as non-terminal, `reopened` treated as non-terminal
- `RadarRings`: renders with color prop, respects `animate={false}`, `autoHideMs` hides rings after timeout
- `requestLookupImpl`: secret-only path resolves via `secret_lookup`, returns `publicRef`; both-codes path unaffected; expired entry returns not-found
