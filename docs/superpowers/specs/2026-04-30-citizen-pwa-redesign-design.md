# Citizen PWA Redesign — Design Spec

**Date:** 2026-04-30
**Status:** Approved — ready for implementation planning
**Branch:** `feat/citizen-pwa-redesign`
**Aligned to:** Citizen Role Spec v2.0, DESIGN.md (Calm Sentinel system), Architecture Spec v8.0

---

## 1. Scope

Two sequential sub-specs. Sub-spec 1 must ship and pass lint/typecheck before Sub-spec 2 begins.

| Sub-spec          | Focus                           | Gate                                                     |
| ----------------- | ------------------------------- | -------------------------------------------------------- |
| **1 — Polish**    | DESIGN.md compliance violations | All 5 files pass lint + typecheck + existing tests green |
| **2 — Spec Gaps** | Missing role-spec-v2 features   | Each item has a passing test before merge                |

---

## 2. Motion & Ceremony Design Language

Citizens use this app during active emergencies. The design system is "The Calm Sentinel" — it must not feel like a shopping app. But calm and joyless are not the same thing. Three stages of emotional design are threaded through specific moments:

### Stage 1 — Anticipation

Use the moment of uncertainty to build assurance, not anxiety. The citizen just tapped Submit. They don't know if it worked. Every second of uncertainty is a trust opportunity.

- **Submit button morphs** on tap: text changes to "Sending to Daet MDRRMO…" with a pulsing opacity (1.0 ↔ 0.6, 800ms loop). Not a generic spinner — the copy names the receiver so the citizen knows who is getting this.
- **LookupScreen "Checking…"**: three animated dots replace the button text while the callable resolves.
- **OTP input**: each filled box gets a micro-confirmation — a brief `scale(1.0 → 1.06 → 1.0, 150ms)` on the digit, plus a single `navigator.vibrate(15)` pulse. The six boxes become a small ceremony, not a chore.
- **TrackingScreen timeline**: timeline items animate in sequentially with a 60ms stagger. The citizen watches their report's journey populate — not a wall of text landing at once.

### Stage 2 — The Reveal / Ceremony

The moment must land with weight. The citizen filed a report during a disaster. That deserves more than a generic success screen.

- **RevealSheet slide-up**: already has the spring animation (`cubic-bezier(0.34, 1.56, 0.64, 1)`). Add: after the sheet settles (400ms delay), the tracking reference code **types in character-by-character** in JetBrains Mono at 60ms per character. This is the emotional peak — the code appearing proves the report exists.
- **Secret code reveal**: after the reference finishes typing, the secret code fades in (opacity 0 → 1, 300ms). The "SHOWN ONCE" badge pulses once to draw attention.
- **Haptic confirmation**: `navigator.vibrate([15, 80, 25])` fires when the RevealSheet success state first renders — a short-pause-short pattern that reads as "received." Guarded by `'vibrate' in navigator`.
- **OTP verified**: a checkmark SVG draws itself via `stroke-dashoffset` animation (400ms) before auto-advancing to step 3. Does not wait for a button tap — the ceremony is the transition.
- **Status badge transition**: when a report status advances (detected in `useMyActiveReports` via Firestore onSnapshot), the new badge does a `scale(1.0 → 1.1 → 1.0, 300ms)` pulse. Tells the citizen something changed without requiring them to read it first.

### Stage 3 — The Afterglow

The report was sent. The citizen closes the app. When they return, the trace of their action should still be there — visible, named, meaningful.

- **RevealSheet footer**: below the primary button, a quiet line: `"Sent at [time] · Daet MDRRMO is on it"`. Stays on screen as long as the sheet is open. Small, muted — the afterglow, not the headline.
- **Session upgrade prompt** (inside RevealSheet, shown once): `"You've submitted a report. Save it to your account — it'll be here when you come back."` The count of prior reports is shown if >0: `"You have 3 reports. Create an account to keep them."` This is personalised afterglow — the citizen sees their own history reflected back at them.
- **Resolved state in TrackingScreen**: the terminal state of a report gets a full-width treatment: a navy-bordered card with a checkmark, `"Your report helped your community"`, and the time-to-resolve: `"Flood report — verified and resolved in 2h 14m."` This is the citizen's "Spotify Wrapped" moment. It is only shown when `status === 'resolved'` or `status === 'closed'`.
- **Profile registered state**: a summary row below the user identity block — `"X reports submitted · Most recent: 3 days ago"`. Quiet, factual, affirming.
- **`prefers-reduced-motion` rule**: every animation above must have a no-motion fallback. Typewriter → instant reveal. Slide-up → fade-in. Scale pulse → instant swap. Use `@media (prefers-reduced-motion: reduce)` in CSS and a `useReducedMotion()` hook for JS-driven animations.

---

## 3. Sub-spec 1 — Polish Pass

### 3.1 What Is Changing

| #   | Violation                                   | Location                              | Fix                                              |
| --- | ------------------------------------------- | ------------------------------------- | ------------------------------------------------ |
| 1   | Wordmark `VIGILANT`                         | `CitizenShell.tsx:34`                 | Change to `BANTAYOG ALERT`                       |
| 2   | Emojis as incident icons                    | `FeedTab`, `ProfileTab`, `AlertsTab`  | Replace with Lucide icons via shared module      |
| 3   | Chip style: white bg + border               | `FeedTab.tsx` `chipStyle()`           | Stone Alt `#f2f4f6` bg, no border, per DESIGN.md |
| 4   | Badge size: 0.625rem (Micro)                | `FeedCard`, `ReportCard`, `AlertCard` | 0.75rem (Label), uppercase, 0.05em tracking      |
| 5   | INCIDENT_ICONS/LABELS duplicated in 3 files | All three tabs                        | Extract to shared `src/lib/incident-meta.tsx`    |

### 3.2 `src/lib/incident-meta.tsx` (new file)

Lucide icon mapping — one source of truth for all three tab consumers:

```ts
import { Waves, MountainSnow, Flame, Wind, Building2, Car, HeartPulse, ShieldAlert, AlertTriangle, MapPin, CheckCircle, ClipboardList, BellOff, Siren, Bell } from 'lucide-react'

export const INCIDENT_META: Record<string, { Icon: React.FC<{ size?: number; color?: string; strokeWidth?: number }>; label: string }> = {
  flood:        { Icon: Waves,         label: 'Flood' },
  landslide:    { Icon: MountainSnow,  label: 'Landslide' },
  fire:         { Icon: Flame,         label: 'Fire' },
  typhoon:      { Icon: Wind,          label: 'Typhoon' },
  storm_surge:  { Icon: Waves,         label: 'Storm Surge' },
  structural:   { Icon: Building2,     label: 'Building Collapse' },
  accident:     { Icon: Car,           label: 'Road Accident' },
  medical:      { Icon: HeartPulse,    label: 'Medical' },
  security:     { Icon: ShieldAlert,   label: 'Security' },
  earthquake:   { Icon: AlertTriangle, label: 'Earthquake' },
  other:        { Icon: AlertTriangle, label: 'Other' },
}

export function IncidentIcon({ type, size = 20, color, strokeWidth }: { type: string; size?: number; color?: string; strokeWidth?: number }) {
  const meta = INCIDENT_META[type] ?? INCIDENT_META.other
  return <meta.Icon size={size} color={color} strokeWidth={strokeWidth} aria-hidden="true" />
}

export function incidentLabel(type: string): string {
  return INCIDENT_META[type]?.label ?? type
}
```

Empty state icons: `CheckCircle` (all clear / no incidents), `ClipboardList` (no reports yet), `BellOff` (no alerts). Location pin: `MapPin`. Alert severity icons: `Siren` (high/critical), `Bell` (medium/low/info).

### 3.3 Files Touched

| Action | File                              | Change                                                                                                                                                   |
| ------ | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| NEW    | `src/lib/incident-meta.tsx`       | Lucide icon map + `IncidentIcon` component + `incidentLabel` helper                                                                                      |
| EDIT   | `src/components/CitizenShell.tsx` | Line 34: `VIGILANT` → `BANTAYOG ALERT`                                                                                                                   |
| EDIT   | `src/components/FeedTab.tsx`      | Remove `INCIDENT_ICONS`/`LABELS` objects; import from `incident-meta`; fix `chipStyle()` (Stone Alt bg, no border); fix badge `fontSize` 0.625 → 0.75rem |
| EDIT   | `src/components/ProfileTab.tsx`   | Remove `INCIDENT_ICONS`/`LABELS` objects; import from `incident-meta`; fix badge `fontSize`                                                              |
| EDIT   | `src/components/AlertsTab.tsx`    | Remove emoji `severityIcon()`; use `Siren`/`Bell` from Lucide; fix badge `fontSize`                                                                      |

CSS variable migration (hardcoded hex values) is **not** in Sub-spec 1 scope — it is a LOW priority cleanup that belongs in a separate PR.

---

## 4. Sub-spec 2 — Spec Gaps

### 4.1 RevealSheet: secret code + session upgrade prompt + ceremony

**Props change:** `RevealSheet` gains two new optional props:

```ts
secretCode?: string        // shown on success state only, once
reportCount?: number       // total prior reports, used in session upgrade prompt copy
```

**Secret code — success state ref box:**

- Rendered below the reference code, separated by a 1px `rgba(167,52,0,0.15)` divider
- Label: `SECRET CODE` (Label size, uppercase, Alert Sienna) + `SHOWN ONCE` badge (navy bg, white text, tiny)
- Value: JetBrains Mono, same size as the reference code
- Copy button: navy bg, white text, 8px radius, `navigator.clipboard.writeText(secretCode)`
- Sub-copy: `"Save this to check your report without an account."` + Tagalog hint below
- The secret is stored in localForage key `bantayog_secrets` as `{ [publicRef]: secret }` so it survives app restart

**Ceremony — typewriter animation:**

- On mount of success state, reference code renders as empty string
- After 400ms delay, characters are appended one at a time at 60ms intervals
- After reference finishes, secret code fades in (opacity 0 → 1, 300ms)
- `prefers-reduced-motion`: skip animation, show both at once after 0ms delay

**Haptics:** `navigator.vibrate([15, 80, 25])` fires once when `state === 'success'` sheet first renders.

**Session upgrade prompt:**

- Rendered below the secondary button (or below the primary if no secondary)
- Copy (pseudonymous user, `reportCount === 1`): `"Save your report history — create an account."`
- Copy (pseudonymous user, `reportCount > 1`): `"You have [N] reports. Create an account to keep them all."`
- Not rendered for registered users (`user.phoneNumber` set)
- Hidden after one dismissal via `localStorage.bantayog_upgrade_prompted = '1'`
- "Create account" → navigates to `/register`

### 4.2 LookupScreen: full design treatment

Full-screen page, no CitizenShell nav bar. Layout matches other full-screen flows:

- Navy header bar (52px) with back chevron (navigates to `/profile`) + `"Check report status"` title text
- Page heading: `"Track your report"` (Headline) + bilingual sub-copy
- Two inputs: `Reference` + `Secret code` — both use the Material-underline style (Stone Alt bg, 2px Authority Navy border-bottom, 8px radius top corners)
- Both inputs use JetBrains Mono — they are identifiers, not prose
- Submit button: full-width primary
- Result state: card below the form — status badge + municipality label + `"Last updated: [datetime]"` + `"Verified by [institution]"` attribution
- Error state: inline red alert below form, bilingual

**Ceremony — "Checking…" anticipation:**

- On submit, button morphs to `"Checking…"` with three animated dots (CSS dot-dot-dot, 600ms)
- Result card fades in (opacity 0 → 1, 300ms) rather than appearing instantly

Route: `/lookup`. Reached from: Profile tab pseudonymous state → `"Check report status →"` link; localForage-stored tracking references.

### 4.3 ProfileTab: auth-aware redesign

`ProfileTab` reads Firebase Auth state via `onAuthStateChanged`. Three views:

**5a — Pseudonymous (user.isAnonymous === true):**

- Identity block: circular avatar placeholder (Stone Alt, User icon) + `"No account"` + `"Reports tracked by reference"` subline
- Primary CTA: `"Create account"` → navigates to `/register`
- Secondary link: `"Check report status →"` → navigates to `/lookup`
- My Reports section: hidden (requires account)
- Settings link: ⚙️ icon in header row → `/settings`

**5b — Registered (user.phoneNumber set):**

- Identity block: initials avatar (navy circle, white initial letter) + display name + phone number (formatted) + municipality label
- `"Edit profile"` button: secondary style, opens an inline edit form (name + municipality only — phone is immutable post-OTP)
- My Reports section: rendered below identity
- Settings link: ⚙️ icon in header row → `/settings`
- Afterglow summary row: `"[N] reports submitted · Most recent: [relative time]"` — muted caption below identity block, only shown when `reports.length > 0`

**5c — My Reports (both states if registered):**
Report card action buttons depend on status:

| Status                                                         | Buttons                     |
| -------------------------------------------------------------- | --------------------------- |
| `new`, `awaiting_verify`                                       | [View] [Edit] [Cancel]      |
| `verified`, `assigned`, `acknowledged`, `en_route`, `on_scene` | [View] [Request correction] |
| `resolved`, `closed`, `rejected`, `cancelled`                  | [View]                      |

- **Edit**: navigates to `/report?edit=:publicRef`. The form renders normally; pre-fill logic from that reference is deferred to Phase 10 — the button exists and navigates, but the form does not auto-populate until Phase 10 implements it.
- **Cancel**: confirmation bottom sheet (`"Cancel this report?"` + bilingual) → calls `cancelReport` callable → optimistic status update
- **Request correction**: bottom sheet with a text area (`"What needs to be corrected?"`) → calls `requestReportCorrection` callable → success toast

**Resolved state afterglow:**

- For reports with `status === 'resolved'` or `status === 'closed'`, the ReportCard shows a full-bleed `"Resolved"` state with time-to-resolve: `"Resolved in [Xh Ym]"` — computed from `submittedAt` to `resolvedAt` field

### 4.4 `/register` route: 4-step phone OTP flow

New route `/register`, no CitizenShell nav. Full-screen wizard. Step state managed by local `useState<1|2|3|4>`. The overall structure is a progress bar (4 segments, Alert Sienna fill) + step content + back button top-left.

**Step 1 — Phone number:**

- Label: `"Your phone number"` + bilingual subline
- Country code: non-editable `🇵🇭 +63` pill (Stone Alt bg) + local number input (Material-underline, numeric input mode)
- Privacy note: `"Visible only to MDRRMO staff if included in a report."` (Caption, muted)
- Submit: `"Send code"` → calls `linkWithPhoneNumber(user, '+63' + localNumber, recaptchaVerifier)`
- reCAPTCHA: invisible verifier, appended to a hidden `<div id="recaptcha-container">` on mount, destroyed on unmount
- Error: phone already linked to another account → `"This number is already registered. Please contact your Barangay MDRRMO for help."` — no self-service resolution path. There is no standalone login flow for citizens; the phone number is the identity. A conflict means a prior anonymous session already linked this number.

**Ceremony — Step 1 → 2 transition:** submit button morphs to `"Sending code…"` (pulsing opacity). On code sent, the step advances with a slide-left transition (`translateX(0) → translateX(-100%)` out, `translateX(100%) → translateX(0)` in, 250ms ease-out). `prefers-reduced-motion`: instant swap.

**Step 2 — OTP verification:**

- 6 individual single-character inputs, auto-focus advances on each digit
- Each digit entry: `navigator.vibrate(15)` + `scale(1.06 → 1.0, 150ms)` on the filled box
- Countdown timer: `"Resend code in 0:43"`. At 0:00: `"Resend code"` link activates
- Submit: `"Verify"` (or auto-submits when 6th digit is filled)

**Ceremony — OTP verified:** SVG checkmark draws itself (`stroke-dashoffset` 0 → total length, 400ms) → auto-advances to step 3 after 600ms. `prefers-reduced-motion`: instant checkmark + instant advance.

**Step 3 — Optional details:**

- Name field (optional) + email field (optional for recovery)
- `"Both optional. Used for your profile only."` (Body, secondary color)
- Skip link at bottom (same as Continue with empty fields)
- Updates Firebase Auth profile: `updateProfile(user, { displayName: name })` + writes `users/{uid}` doc with `{ displayName, email, phoneNumber, municipalityId: null }` (municipality set later from GPS or manual)

**Step 4 — Consent:**

- Progress bar fills completely (full Alert Sienna)
- Copy: `"Your previous reports are already linked to this account."` — confirms session preservation
- Privacy notice block (Stone Alt bg, rounded) — bilingual
- Required checkbox: `"I have read and agree to the Terms of Use and Privacy Notice"`
- Submit: `"Create account"` → writes `privacyNoticeVersion: '1.0'` to `users/{uid}` → navigates to `/profile` + success toast `"Welcome to Bantayog Alert"`

**Error handling:**

- Network failure on any step: inline error card (failed bg/fg colors) + retry button
- Phone already registered: step 1 error with log-in path
- Wrong OTP: step 2 inline error, counter shows remaining attempts (Firebase allows 3)
- Session link failure (anonymous account conflict): graceful degradation — offer to sign in with phone instead, preserving UID linkage

### 4.5 `/settings` route

New route `/settings`, no CitizenShell nav. Full-screen. Back navigates to `/profile`.

Sections:

**Notifications:**

- `Push notifications` toggle: on → `Notification.requestPermission()` + FCM `getToken({ vapidKey })` → write token to `users/{uid}.fcmTokens` array (arrayUnion). Off → FCM `deleteToken()` + remove from Firestore.
- `Alert sounds` toggle: persisted to `localStorage.bantayog_alert_sounds`. Read by AlertsTab and the push notification handler before playing the Web Audio API tone.

**Location:**

- `Auto-detect location` toggle: persisted to `localStorage.bantayog_location_auto`. Read by `useGpsLocation` hook — when false, hook skips `navigator.geolocation.getCurrentPosition` and returns null immediately, falling back to manual municipality/barangay selection.

**Data & Storage:**

- `Offline mode` toggle: persisted to `localStorage.bantayog_offline_mode`. Read by the service worker's fetch handler — when true, the SW applies a cache-first strategy for map tiles and the public feed. When false, network-first.
- `Storage used`: reads `navigator.storage.estimate()` on mount, formatted as `"X MB"`.
- `Privacy Policy`: external link (opens in new tab).
- `Download my data`: calls `requestDataExport` callable → success toast `"We'll email your data within 24 hours."` Button disabled for 60s after tap (tracked via `sessionStorage.bantayog_export_requested`) to prevent double-calls. **Dependency:** `requestDataExport` callable does not yet exist in `functions/src`; it must be built as part of Sub-spec 2 before this button can be fully wired. If callable is absent at deploy time, button renders disabled with label `"Coming soon"`.

**Account (registered users only — hidden for anonymous):**

- `Log out`: confirmation dialog (`"Log out of Bantayog Alert?"`) → `signOut(auth())` + `localForage.clear()` + navigate to `/`
- `Delete account`: navigates to the existing `DeleteAccountFlow` modal (already built in `DeleteAccountFlow.tsx`)

**Toggle component:**
Native iOS-style toggle: 44px × 26px, Authority Navy track when on, Stone Alt when off, white knob with Hair Lift shadow. Transition 200ms. Built as a shared `<Toggle checked onToggle />` component in `src/components/ui/Toggle.tsx`.

### 4.6 CitizenShell: offline queue banner

New hook `src/hooks/useOfflineQueueCount.ts`:

- Subscribes to `useOnlineStatus()` (existing hook)
- Polls localForage outbox (via `draftStore`) for items with `syncState: 'queued' | 'syncing' | 'failed_retryable'` on a 2s interval when offline; clears interval when online
- Returns `{ isOnline: boolean; queueCount: number }`

**Banner renders in CitizenShell** between the header and `<main>`:

- Visible when `!isOnline && queueCount > 0`
- Appearance: `#92400e` (Queued fg) background, 8px padding, flex row
- Left: pulsing amber dot + `"You're offline · [N] report[s] waiting"`
- Right: muted `"Will send automatically"` caption
- On reconnect + `queueCount === 0`: replace banner with `"✓ Report sent"` (success bg/fg) for 3s, then fade out (opacity 1 → 0, 400ms)

### 4.7 AlertsTab: source attribution

`AlertDoc` has an `issuedBy` field (institution string). `AlertCard` updated:

- After the severity badge, show `issuedBy` in bold secondary color + timestamp
- Fallback: if `issuedBy` absent, show `"Camarines Norte PDRRMO"` (spec §3.5)
- Severity icon: `Siren` (Lucide) for critical/high, `Bell` for medium/low/info (replaces emojis — Sub-spec 1 already covers this; this section adds the attribution layout)

---

## 5. New Files Summary

| Action | Path                                             | Purpose                                                                                          |
| ------ | ------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| NEW    | `src/lib/incident-meta.tsx`                      | Lucide icon map, `IncidentIcon` component, `incidentLabel` helper                                |
| NEW    | `src/pages/RegisterPage.tsx`                     | 4-step phone OTP registration wizard                                                             |
| NEW    | `src/pages/SettingsPage.tsx`                     | Full settings page with real toggles                                                             |
| NEW    | `src/hooks/useOfflineQueueCount.ts`              | Outbox count + online status subscription                                                        |
| NEW    | `src/hooks/useReducedMotion.ts`                  | Reads `prefers-reduced-motion` media query, subscribes to changes                                |
| NEW    | `src/components/ui/Toggle.tsx`                   | Shared iOS-style toggle for settings                                                             |
| NEW    | `src/components/ui/Toast.tsx`                    | Shared toast for success/error feedback (used by register, settings, cancel, request-correction) |
| NEW    | `functions/src/callables/request-data-export.ts` | `requestDataExport` callable — queues JSON export, emails within 24h                             |

---

## 6. Changed Files Summary

| File               | Changes                                                                                                     |
| ------------------ | ----------------------------------------------------------------------------------------------------------- |
| `CitizenShell.tsx` | Wordmark fix; offline banner integration                                                                    |
| `FeedTab.tsx`      | `incident-meta` import; chip style fix; badge size fix                                                      |
| `ProfileTab.tsx`   | Auth-aware views (5a/5b/5c); report action buttons; afterglow summary row; ⚙️ settings link                 |
| `AlertsTab.tsx`    | `incident-meta` import; badge size fix; `issuedBy` attribution                                              |
| `RevealSheet.tsx`  | `secretCode` + `reportCount` props; typewriter animation; haptics; session upgrade prompt; afterglow footer |
| `LookupScreen.tsx` | Full redesign — styled form, result card, "Checking…" ceremony                                              |
| `routes.tsx`       | Add `/register` and `/settings` routes                                                                      |

---

## 7. Motion Constraints

All animations must respect `prefers-reduced-motion: reduce`:

| Animation             | Full motion                | Reduced motion |
| --------------------- | -------------------------- | -------------- |
| RevealSheet slide-up  | Spring ease-out (existing) | Fade-in only   |
| Reference typewriter  | 60ms/char typing           | Instant reveal |
| Secret code fade-in   | opacity 0→1, 300ms         | Instant reveal |
| OTP digit scale pulse | scale 1.0→1.06→1.0, 150ms  | None           |
| OTP checkmark draw    | stroke-dashoffset, 400ms   | Instant fill   |
| Step transition slide | translateX, 250ms          | Instant swap   |
| Status badge pulse    | scale 1.0→1.1→1.0, 300ms   | None           |
| Result card fade-in   | opacity 0→1, 300ms         | Instant reveal |
| Banner fade-out       | opacity 1→0, 400ms         | Instant hide   |
| Timeline stagger      | 60ms per item              | All at once    |

Implement via a `useReducedMotion()` hook that reads `window.matchMedia('(prefers-reduced-motion: reduce)')` and subscribes to changes.

---

## 8. Deferred (Out of Scope)

- CSS variable migration (hardcoded hex → CSS custom properties) — LOW priority, separate PR
- Push notification opt-in prompt on first load — deferred to post-pilot analytics review
- Edit report form at `/report?edit=:ref` — the route and pre-fill logic is a new sub-task scoped to Phase 10
- Edit report pre-fill at `/report?edit=:ref` — route exists, pre-fill logic deferred to Phase 10
- Dark mode — explicitly out of scope per DESIGN.md

---

## 9. Key Constraints

- **RA 10173:** Secret code must never be persisted server-side in a way that links to personal identity. It is a random token stored only in `report_lookup/{ref}` (citizen-facing, no actorId). The copy-to-clipboard action operates only on the client.
- **reCAPTCHA:** Invisible verifier for phone auth must be destroyed on component unmount (`recaptchaVerifier.clear()`). Leaking verifiers causes `auth/too-many-requests` on re-render.
- **Typewriter animation:** Must not start until the RevealSheet spring animation completes (400ms). Starting earlier makes the sheet feel janky — the reference types in while the sheet is still moving.
- **Haptics:** Guard with `'vibrate' in navigator`. iOS Safari does not support the Vibration API — fail silently.
- **FCM token write:** Do not write the token to Firestore until push permission is `'granted'`. Permission `'default'` (not yet asked) should not trigger Firestore writes.
