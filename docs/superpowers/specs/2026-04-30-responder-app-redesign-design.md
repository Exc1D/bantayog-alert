# Responder App Redesign — Design Spec

**Bantayog Alert — Responder Capacitor App**
**Date:** 2026-04-30
**Branch:** feat/citizen-pwa-redesign (responder sub-branch to follow)
**Aligned to:** Responder Role Spec v2.0 · Architecture Spec v6.0

---

## 1. Scope

Two sequential sub-specs. Sub-spec 1 must pass `pnpm --filter responder-app lint typecheck` and existing tests before Sub-spec 2 begins.

| Sub-spec                 | Focus                                                                                              | Gate                                      |
| ------------------------ | -------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| **1 — Shell + Ceremony** | 4-tab shell, dark operational surface, 5 ceremony moments, stub tabs                               | Lint + typecheck + existing tests green   |
| **2 — Spec Gaps**        | Map tab, Messages tab, Profile tab (full), pre-arrival summary, performance history, shift handoff | Each item has a passing test before merge |

---

## 2. Creative North Star: "The Night Watch"

The responder app is an instrument panel a professional trusts with their life. The citizen PWA is "The Calm Sentinel" — a neighbor who doesn't panic. The responder app is the instrument on their belt: quiet by default, unambiguous under pressure, and capable of landing a moment with weight when the moment earns it.

**Tone: Earned Professional Dignity.** Ceremonies are present but proportional. Resolving an incident after 47 minutes on scene earns a real Resolution Card. Accepting a dispatch earns a haptic double-bump. Decorative animation exists nowhere. Pride is operational, not gamified.

**Field Reality:** Responders use this app in direct sunlight, in rain, with one hand, while moving. Every touch target is minimum 44px. Primary actions are thumb-zone reachable. The 3-second SOS hold is the only deliberate friction in the entire app — everything else must be one tap.

---

## 3. Design Language Extension

The responder app extends `DESIGN.md` (citizen PWA) with a dark operational surface. All citizen PWA tokens remain valid. New tokens are additive only.

### 3.1 New Surface Tokens

| Token            | Value     | Use                    |
| ---------------- | --------- | ---------------------- |
| `shell-bg`       | `#0a1929` | App background         |
| `card-surface`   | `#0e1f33` | Default cards          |
| `card-active`    | `#0e2942` | New dispatch cards     |
| `header-surface` | `#0f2d52` | App header + tab bar   |
| `border-dark`    | `#1e3a5f` | Dividers, card borders |

### 3.2 Operational Accent (replaces Alert Sienna on this surface)

| Token            | Value     | Use                                                   |
| ---------------- | --------- | ----------------------------------------------------- |
| `ops-teal`       | `#0e7490` | Primary interactive (buttons, active states, borders) |
| `ops-teal-dim`   | `#164e63` | Secondary teal backgrounds                            |
| `ops-teal-light` | `#7dd3fc` | Teal text on dark surfaces                            |

**Two-Anchor Rule (extended):** Authority Navy + Ops Teal are the two anchors for the responder surface. Alert Sienna does not appear in this app. No third color is introduced.

### 3.3 Text on Dark Surface

| Token                 | Value     | Use                         |
| --------------------- | --------- | --------------------------- |
| `text-primary-dark`   | `#e2e8f0` | Primary text                |
| `text-secondary-dark` | `#94a3b8` | Supporting text, metadata   |
| `text-muted-dark`     | `#475569` | Timestamps, section headers |

### 3.4 Extended Token Rules

- **JetBrains Mono extended:** Dispatch numbers (e.g., `#0471`) are machine-generated identifiers — the same rationale as tracking reference codes in the citizen PWA. Mono is permitted for dispatch numbers and countdown timers.
- **Lucide icons only.** No emoji anywhere in the app.
- **Status semantics unchanged:** Red/amber/green status pairs from `DESIGN.md` §2 apply on dark surfaces with adjusted opacity (15% background tint instead of solid light bg).
- **No dark mode toggle.** This IS the dark mode — it is the only theme for the responder surface.

---

## 4. Shell

### 4.1 App Header (52px, fixed top)

- Background: `header-surface` (`#0f2d52`)
- Left: `BANTAYOG ALERT` wordmark (Plus Jakarta Sans 800, 11px, 0.08em tracking, uppercase, white) + `RESPONDER` role badge (ops-teal bg, white text, 9px/700, 10px radius)
- Right: SOS button — red (`#b91c1c` bg), white text, 9px/800, Lucide `ShieldAlert` icon (10px), `aria-label="Activate SOS emergency signal"`
- Border-bottom: 1px `border-dark`

### 4.2 Bottom Tab Bar (60px + safe-area-inset-bottom)

- Background: `header-surface` (`#0f2d52`)
- Border-top: 1px `border-dark`
- 4 equal-width tabs: **Dispatches** / **Map** / **Messages** / **Profile**
- Icons (Lucide, 18px): `ClipboardList` / `Navigation` / `MessageSquare` / `User`
- Active: `ops-teal` icon + label. Inactive: `text-muted-dark`.
- Label: 8.5px/700, 0.03em tracking
- No frosted glass on dark surface — solid background only

### 4.3 Availability Pill

Shown at the top of the Dispatches tab, below the header. Three states:

| Status      | Color                                                                     | Text        |
| ----------- | ------------------------------------------------------------------------- | ----------- |
| Available   | `#22c55e` dot + `rgba(34,197,94,0.12)` bg + `rgba(34,197,94,0.25)` border | AVAILABLE   |
| Unavailable | `#f59e0b` dot + amber tints                                               | UNAVAILABLE |
| Off-Duty    | `#ef4444` dot + red tints                                                 | OFF-DUTY    |

Status change: tapping the pill opens a bottom sheet with reason selection (per role-spec §6.1). Blocked when dispatch is `en_route` or `on_scene` — shows a toast: `"Complete or mark unable-to-complete first."`

---

## 5. Dispatch Card

The atom of the Dispatches tab. Extracted to `src/components/DispatchCard.tsx`.

### 5.1 Card Anatomy

```text
[status badge]                    [#NNNN mono]
[Incident Type — Severity]
[Barangay, Municipality · X.X km]
[From: Admin Name, Agency]
[countdown / on-assignment time]
[action buttons]
```

### 5.2 Card States and Borders

| State           | Left border | Background                    | Left border width |
| --------------- | ----------- | ----------------------------- | ----------------- |
| New/Pending     | `#ef4444`   | `card-active`                 | 3px               |
| Accepted/Active | `#f59e0b`   | `card-surface`                | 3px               |
| Resolved        | `#22c55e`   | `card-surface` at 55% opacity | 3px               |

**Note:** `border-left` of 3px is the one permitted exception to DESIGN.md's "no border-left > 1px" rule. The rule targets decorative stripes on citizen-facing cards. Here the border communicates operational status — it is semantic, not decorative, and is always paired with a status badge and label.

### 5.3 Countdown Timer

- Font: JetBrains Mono, 10px/700
- Color progression: `#22c55e` (>60% time) → `#f59e0b` (30–60%) → `#ef4444` (<30%)
- `aria-live="polite"` announces at 60s remaining and 30s remaining only (not every second — avoids screen reader flooding)
- At <30s: card border pulses (CSS animation, 1.5s loop). Reduced motion: static red border.

### 5.4 Offline State

When device is offline, the Accept button renders grayed (`opacity: 0.5`, `cursor: not-allowed`) with a Lucide `WifiOff` icon (10px) and `aria-label="Offline — cannot accept dispatch"`. A caption below: `"Connect to accept."` The `acceptDispatch` callable is not queued — it requires network.

---

## 6. Ceremony Layer

### 6.1 Architecture

**Pattern: Ceremony Hooks.** Each workflow gets a dedicated hook encapsulating both data state and ceremony phase. Pages read `phase` and render accordingly. All haptic calls, reduced-motion checks, and animation timings live inside the hook.

```ts
// Hook shapes (not implementation — types only)
type DispatchCeremonyPhase = 'idle' | 'accepting' | 'race_loss' | 'locked_in' | 'active'
type ResolutionCeremonyPhase = 'idle' | 'submitting' | 'revealed'
type SosHoldPhase = 'idle' | 'holding' | 'activated' | 'cancelled'
```

**Primitives:**

- `useHaptic()` — returns `{ fire(pattern: number | number[]): void }`. Guards with `'vibrate' in navigator`. No-ops silently on iOS Safari.
- `useReducedMotion()` — returns `boolean`. Reads `window.matchMedia('(prefers-reduced-motion: reduce)')` and subscribes to changes.

### 6.2 Moment 1: Dispatch Acceptance

**Stage 1 — Anticipation (card at rest):**

- New dispatch card border pulses (`border-left-color` cycles red → light-red, 1.5s CSS loop)
- Countdown timer in JetBrains Mono counts in real time, color shifts at thresholds
- Reduced motion: static red border, static countdown

**Stage 2 — Ceremony (tap Accept):**

1. Button transforms to `"Confirming…"` with Lucide `Loader2` spinning (8s timeout — if callable takes >8s, error toast: `"Could not confirm — try again."` with Accept/Decline restored)
2. Card border shifts teal; background holds
3. On `acceptDispatch` callable success:
   - Card background briefly flashes teal (`#0e7490`, 150ms) then returns — CSS `animation: flashTeal 150ms ease`
   - `useHaptic().fire([20, 60, 30])` — double-bump "locked in" signal
   - "Locked-in" banner slides down from header (translateY -100% → 0, spring ease, 250ms): `"DISPATCH #0471 — Assigned to you"` in JetBrains Mono, teal background, 800ms duration
   - After 800ms: navigate to `DispatchDetailPage`
4. On race loss: card shake (`translateX: -4px → 4px → -3px → 3px → 0`, 300ms) then navigate to `RaceLossScreen`

**Reduced motion:** No flash, no shake, no slide. Banner appears instantly. Navigate immediately after callable resolves.

### 6.3 Moment 2: Race Loss

`RaceLossScreen` shows after the card shake:

- Large Lucide `CircleAlert` icon (amber)
- `"Already Taken"` — Headline, white
- Dispatch number in JetBrains Mono
- `"Another responder accepted first."` — caption, secondary
- CTA: `"Stay Available"` (primary teal button) → navigates back to dispatch list
- No apology copy. No retry. Dignity, not failure.

### 6.4 Moment 3: On Scene Arrival

When responder taps "Mark On Scene" from quick status bar or dispatch detail:

**Progress Stepper** (`ProgressStepper.tsx`):

- 4 nodes: Acknowledged → En Route → **On Scene** → Resolved
- Each node: 18px circle. Done: teal fill + check icon. Active: teal fill + pulse animation (`scale 1.0 → 1.15 → 1.0, 300ms, ease`). Pending: `card-surface` bg + muted text.
- Connecting lines: teal when segment is complete, `border-dark` otherwise

**Ceremony:**

1. Stepper active node pulses (single pulse, not loop)
2. Situation note textarea auto-slides up (translateY 24px → 0, 200ms ease-out). Field label: `"SITUATION UPDATE"` (Label size, uppercase, teal). Required field.
3. `useHaptic().fire([15, 40, 15])` — light-pause-light "arrival" pattern
4. Reduced motion: instant field appearance, no pulse

### 6.5 Moment 4: Incident Resolution

When `markResolved` callable succeeds:

**ResolutionCard** (`ResolutionCard.tsx`) — full-screen overlay:

- Background: `linear-gradient(160deg, #0a1929 0%, #0e2942 100%)`
- Lucide `CheckCircle2` icon — 32px, ops-teal
- `"Incident Resolved"` — Headline, `text-primary-dark`
- Dispatch number + incident type + municipality — JetBrains Mono, 9px, teal-light
- **Time on assignment** (large): JetBrains Mono, 22px/800, `ops-teal-light`. Count-up animation: starts at `0`, reaches actual value over 800ms linear. `aria-live="polite"` announces final value.
- `"Accepted in Xm Ys"` — caption, `text-secondary-dark`
- `"Your community is safer."` — caption, teal-light, italic
- `useHaptic().fire([10, 40, 10, 40, 25])` — deliberate 5-pulse rhythm, fires once when card mounts
- CTA: `"Return to Dispatches"` — primary teal button

**Reduced motion:** No count-up. Number appears instantly. No layout shift.

**Afterglow (dispatch history):**
The resolved dispatch card in the history list shows a compact summary: teal-left-bordered card with `"Resolved · X min"`, incident type, location, dispatch number in JetBrains Mono, and the time window (`14:38–15:25`). This is the persistent afterglow — the responder's operational record.

### 6.6 Moment 5: SOS Activation

**SOS Button** (`SosButton.tsx`) — always visible in the app header, right side:

- Resting state: `#b91c1c` bg, white `SOS` text + Lucide `ShieldAlert` icon, 9px/800
- `aria-label="Activate SOS emergency signal"` at rest

**Hold mechanic (3 seconds):**

- On `pointerdown`: begin hold timer
- SVG progress ring fills via `stroke-dashoffset` animation (3000ms linear, red, `#b91c1c`)
- `useHaptic().fire(200)` — continuous pulse during hold (fires once per second: `vibrate(200)` each tick)
- `aria-label` updates to `"Hold for SOS — X% charged"` at 33%, 66%, 100%
- On `pointerup` before 3s: cancel, ring resets instantly
- On `pointerup` after 3s: SOS activates

**Activation:**

1. Full-screen red overlay flashes once (100ms, `background: #b91c1c`, `opacity: 0 → 0.4 → 0`)
2. Navigate to `SosPage`
3. `useHaptic().fire([30, 50, 30, 50, 50])` — three assertive pulses

**SOS Page:**

- `SOS ACTIVATED` badge (`#b91c1c` bg, white/800/uppercase)
- Lucide `MapPin` + current location (barangay, municipality)
- `"Emergency signal sent to all admins."` — caption
- `"Stay safe. Help is coming."` — Body, white
- Cancel button with 30s countdown ring (same SVG ring mechanic, but a single tap to activate — no hold required)
- Cancel: single tap → `vibrate([10])` → navigate back. Silent (no toast) — the responder knows they cancelled.

**Reduced motion:** No flash, no ring fill animation. SOS button immediately shows "SOS activated" state after 3s hold.

---

## 7. 12-Hour Re-Auth Ceremony

Responder sessions expire every 12h (per role-spec §11.3). When Firebase token requires re-auth:

- `ResponderShell` detects expired session state (from `useAuthState`)
- Renders a **non-dismissible full-screen modal** above all tab content (not a navigation — sheet overlays current view)
- Header: `"Session Expired"` + `"Re-enter your OTP to continue"` subline
- 6-digit OTP input — same digit micro-ceremony as citizen PWA: each filled box gets `scale(1.0 → 1.06 → 1.0, 150ms)` + `vibrate(15)` pulse
- On verify: modal dismisses, current screen resumes (no navigation)
- On failure (wrong OTP): inline error, attempt counter shown (Firebase allows 3)
- Cannot dismiss without re-authing. No "Cancel" option. Responders cannot operate with an expired session.

---

## 8. Sub-Spec 1 — Files

### New Files

| Path                                 | Purpose                                                                        |
| ------------------------------------ | ------------------------------------------------------------------------------ |
| `src/components/ResponderShell.tsx`  | 4-tab shell, header, SOS button, re-auth modal                                 |
| `src/components/DispatchCard.tsx`    | Ceremony-aware dispatch card, offline state                                    |
| `src/components/SosButton.tsx`       | 3-second hold with SVG ring                                                    |
| `src/components/ResolutionCard.tsx`  | Full-screen resolution ceremony overlay                                        |
| `src/components/ProgressStepper.tsx` | Dispatch status stepper with pulse                                             |
| `src/hooks/useDispatchCeremony.ts`   | Phases: `idle \| accepting \| race_loss \| locked_in \| active`                |
| `src/hooks/useResolutionCeremony.ts` | Phases: `idle \| submitting \| revealed`                                       |
| `src/hooks/useSosHold.ts`            | Hold timer, ring progress, phases: `idle \| holding \| activated \| cancelled` |
| `src/hooks/useHaptic.ts`             | `navigator.vibrate` guard + named patterns                                     |
| `src/hooks/useReducedMotion.ts`      | `prefers-reduced-motion` media query + subscription                            |
| `src/lib/responder-tokens.ts`        | Design token constants (dark palette)                                          |

### Modified Files

| File                               | Change                                                        |
| ---------------------------------- | ------------------------------------------------------------- |
| `src/App.tsx`                      | Integrate `ResponderShell`                                    |
| `src/routes.tsx`                   | Add stub routes for Map, Messages, Profile                    |
| `src/pages/DispatchListPage.tsx`   | Use `DispatchCard`; integrate `useDispatchCeremony`           |
| `src/pages/DispatchDetailPage.tsx` | Integrate `ProgressStepper` + `useResolutionCeremony`         |
| `src/pages/SosPage.tsx`            | Replace hold mechanic with `SosButton`; implement cancel ring |
| `src/pages/RaceLossScreen.tsx`     | Add card shake animation entry                                |

---

## 9. Sub-Spec 2 — Spec Gaps

Scope for the follow-on spec (not yet designed in detail):

| Feature                    | Role-Spec Reference                                                            |
| -------------------------- | ------------------------------------------------------------------------------ |
| Map Tab                    | §3.3 — Own location (blue dot), assigned incidents (red pins), navigate button |
| Messages Tab               | §3.4 — Per-incident threads with admin, photo attach, offline queue            |
| Profile Tab — Availability | §3.5, §6.1 — Status pill + reason bottom sheet, blocking rules                 |
| Profile Tab — Stats        | §10.1 — Completion rate arc (circular), response time, monthly summary         |
| Profile Tab — Settings     | §3.5 — Notifications, location opt-out (moves to unavailable), log out         |
| Pre-Arrival Summary Card   | §6.3 — Equipment checklist, citizen description, distance                      |
| Performance History        | §10.2 — Full dispatch history list, tap → incident timeline                    |
| Shift Handoff Page         | §9 — Form: incoming responder select, active dispatch snapshot, notes          |

Shift handoff error case: if responder initiates handoff during `en_route` or `on_scene`, the callable rejects → toast: `"Complete or mark unable-to-complete this dispatch first."` No recovery path — the responder must resolve the dispatch.

---

## 10. Motion Constraints

All animations must respect `prefers-reduced-motion: reduce`:

| Animation                  | Full motion               | Reduced motion       |
| -------------------------- | ------------------------- | -------------------- |
| Dispatch card border pulse | CSS keyframe 1.5s loop    | Static red border    |
| Accept card flash          | `flashTeal` 150ms         | None                 |
| Locked-in banner slide     | translateY spring, 250ms  | Instant appear       |
| Card shake (race loss)     | translateX ±4px, 300ms    | Instant navigation   |
| Step node pulse            | scale 1.0→1.15→1.0, 300ms | Instant teal fill    |
| Situation field slide      | translateY 24px→0, 200ms  | Instant appear       |
| Resolution count-up        | 800ms linear count        | Instant number       |
| SOS ring fill              | stroke-dashoffset 3000ms  | Instant state change |
| SOS activation flash       | opacity overlay 100ms     | None                 |
| OTP digit scale            | scale 1.0→1.06→1.0, 150ms | None                 |

Implement via `useReducedMotion()` hook. CSS animations additionally use `@media (prefers-reduced-motion: reduce)`.

---

## 11. Accessibility

- Touch targets: ≥ 44×44px everywhere. 48px for dispatch Accept/Decline.
- Countdown timer: `aria-live="polite"` announces at 60s and 30s remaining only. Never every second.
- Progress stepper: each node has `aria-label="Step N of 4: [state name]"`.
- SOS button: `aria-label` updates during hold: `"Activate SOS"` → `"Hold for SOS — X% charged"` → `"SOS activated"`.
- Resolution card time: `aria-live="polite"` announces final value when count-up completes.
- Re-auth modal: `role="dialog"` + `aria-modal="true"` + `aria-label="Session expired — re-authentication required"`. Focus trapped inside.
- All Lucide icons are `aria-hidden="true"` — semantic text labels carry the meaning.

---

## 12. Deferred (Out of Scope for Sub-spec 1)

- Full Map tab implementation (Sub-spec 2)
- Full Messages tab (Sub-spec 2 — stub route ships in Sub-spec 1)
- Profile tab beyond availability pill stub (Sub-spec 2)
- Pre-arrival summary card (Sub-spec 2)
- Performance history and stats arc (Sub-spec 2)
- Shift handoff form (Sub-spec 2)
- Push notification permission flow
- In-app call-log auto-entry ("Called admin at [time]") — this is a messages subcollection write, deferred to Messages tab
