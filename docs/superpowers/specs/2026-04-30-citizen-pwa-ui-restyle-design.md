# Citizen PWA UI Restyle — Design Spec

**Date:** 2026-04-30  
**Branch:** fix/citizen-pwa-redesign-spec-gaps  
**Approach:** Visual restyle only — all Firebase, XState, offline, and test logic is untouched.

---

## 1. Summary

Adapt the reference design (`Downloads/Citizen_PWA`) as the visual shell for the production citizen PWA. The reference has a polished Tailwind + framer-motion design system but stub business logic. The production PWA has full Firebase auth, Firestore, XState submission machine, localForage offline queue, and 203 passing tests but plain inline-CSS styling.

**Goal:** Lift the visual experience of the production PWA to match the reference design — same animations, same token system, same layout patterns — without touching any business logic, Firebase wiring, or test files.

---

## 2. Scope

### In scope

- Tailwind CSS + design token migration
- `framer-motion` integration (page transitions, navbar, offline banner, toast, splash, ceremony)
- `SplashScreen` — new animated entry (1.5s, radar rings)
- `Onboarding` — new 3-step first-run flow (Welcome → Privacy → How It Works)
- `CitizenShell` + `Navbar` — floating Report button, spring active indicator, page transition wrapper
- `ReceiptScreen` — calm radar pulse ceremony (no confetti, replaces bare `<section>`)
- All tab screens: `FeedTab`, `AlertsTab`, `ProfileTab`
- Secondary screens: `SettingsPage`, `RegisterPage`, `LookupScreen`, `RevealSheet`
- `Toast` + `Toggle` — restyle to match design system
- Offline banner — animated slide-in (framer-motion)

### Out of scope

- All Firebase, XState, localForage, and submission logic
- All test files (`*.test.tsx`, `*.test.ts`)
- Firestore rules, Cloud Functions, shared packages
- `MapTab` **Leaflet map tiles and incident layer logic** — untouched; only the UI chrome overlaid on the map is restyled (see §7.4a)
- `TrackingScreen`, `GoodbyeScreen`, `IncidentDetailPage` (functional, not high-visibility)

---

## 3. Dependencies

Add to `apps/citizen-pwa/package.json`:

```json
"framer-motion": "^12.0.0"
```

Add to devDependencies:

```json
"tailwindcss": "^3.4.19",
"autoprefixer": "^10.4.23",
"postcss": "^8.5.6",
"tailwindcss-animate": "^1.0.7"
```

No other new runtime deps. `canvas-confetti` is NOT added.

---

## 4. Design Token System

### 4.1 Tailwind config

New file: `apps/citizen-pwa/tailwind.config.js`

Port the full token set from the reference:

**Brand (teal):** `brand-50` → `brand-600` (#0F9488 as brand-500)  
**Surface (tinted neutrals):** `surface-50` → `surface-950` (#25292A as surface-900)  
**Semantic:** `danger-500` (#DC2626), `warning-500` (#D97706), `success-500` (#059669), `info-500` (#2563EB)  
**Shadows:** `shadow-glow-teal`, `shadow-glow-success`, `shadow-glow-red`  
**Keyframes:** `shimmer`, `pulse-glow`, `radar-ring`, `pulse-scale`  
**Z-index:** `float:20`, `nav:30`, `modal:40`, `toast:50`, `splash:60`, `emergency:70`  
**Border radius:** `sm:8px`, `md:12px`, `lg:16px`, `xl:24px`  
**Font:** `-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif`

### 4.2 CSS update

Replace `src/styles/design-tokens.css` content with:

1. `@tailwind base; @tailwind components; @tailwind utilities;`
2. `:root` block with all CSS custom properties from the reference `index.css` (safe-area insets, surface scale, brand scale, semantic colors, shadcn HSL compat vars)
3. Global body: `background: var(--surface-100)`, system font stack, `-webkit-font-smoothing: antialiased`, `overscroll-behavior-y: none`
4. Reduced-motion media query disabling all animations
5. `.no-scrollbar` utility

The existing `src/lib/design-tokens.ts` file is removed (replaced by Tailwind).

### 4.3 PostCSS config

New file: `apps/citizen-pwa/postcss.config.js`

```js
export default { plugins: { tailwindcss: {}, autoprefixer: {} } }
```

---

## 5. New UI Store

New file: `src/lib/uiStore.ts`

Minimal Zustand store for UI-only state (no business logic):

```ts
interface UIState {
  navDirection: 'forward' | 'backward'
  setNavDirection: (d: 'forward' | 'backward') => void
  hasCompletedOnboarding: boolean
  setHasCompletedOnboarding: (v: boolean) => void
}
```

`hasCompletedOnboarding` persists to `localStorage`. Online/offline state stays in the existing `useOnlineStatus` hook — no duplication.

---

## 6. Routing Changes

Add two new routes to `routes.tsx` (before the tabbed routes):

| Path          | Component      | Notes            |
| ------------- | -------------- | ---------------- |
| `/splash`     | `SplashScreen` | No shell, no nav |
| `/onboarding` | `Onboarding`   | No shell, no nav |

`App.tsx` entry point: render `SplashScreen` first on fresh install (check `uiStore.hasCompletedOnboarding`). After splash → onboarding (if first run) or `/` (if returning user).

The existing tabbed routes (`/`, `/feed`, `/alerts`, `/profile`) are wrapped by the redesigned `CitizenShell` which now includes `AnimatePresence` for page transitions.

---

## 7. Component Designs

### 7.1 SplashScreen

**File:** `src/pages/SplashScreen.tsx` (new)

- Full-screen dark background: `radial-gradient(circle at center, #0F172A 0%, #0F9488 100%)`
- Three animated radar rings: framer-motion `scale: [0.5, 1.5]`, `opacity: [0.6, 0]`, `duration: 2s`, staggered `delay: 0 / 0.4 / 0.8`
- Center shield icon (Lucide `Shield`, 32px, white) in a glowing circle
- `BANTAYOG` wordmark + `ALERT` subtitle (Montserrat-weight via font-weight, not @fontsource — system font stack)
- Cycling status messages (3 messages, 800ms interval)
- Progress bar: **1.5s** linear fill (down from 3.2s)
- Auto-navigate after 1.6s: → `/onboarding` if first run, → `/` if returning
- Reduced-motion: skip all animations, navigate immediately after 100ms

### 7.2 Onboarding

**File:** `src/pages/Onboarding.tsx` (new)

3 steps, swipe-gesture capable via `framer-motion` drag:

**Step 0 — Welcome**

- Watchtower SVG illustration (copy `dist/watchtower.svg` to citizen-pwa `public/`)
- "Welcome to Bantayog" headline
- "Your community watchtower" subheading
- Body copy about Camarines Norte + "Bayanihan sa Panahon ng Sakuna" tagline badge

**Step 1 — Privacy**

- "Your privacy matters" headline
- Three info cards (Report without account / Data protected / Transparency first)
- Consent checkbox with animated SVG checkmark via framer-motion `pathLength`
- Cannot proceed without consent checked; shakes on attempt

**Step 2 — How It Works**

- "Three steps to help your community" headline
- Three steps with icon circles + connecting dashed line
- "Start Reporting" CTA (larger button, brand gradient)

**Navigation:** Swipe left/right (dragElastic 0.2, threshold 50px), pagination dots (active dot widens to 24px), Skip button top-right on Step 0 only.

On completion → `uiStore.setHasCompletedOnboarding(true)` → navigate to `/`.

**Privacy consent storage:** `localStorage.setItem('bantayog_onboarding_complete', 'true')`. The existing Firebase-based privacy consent in `PrivacyNoticeModal.tsx` is unchanged (that's a separate, auth-triggered flow).

### 7.3 CitizenShell + Navbar

**File:** `src/components/CitizenShell.tsx` (restyle)

Remove the `<header>` wordmark bar entirely — the reference design has no top header on tabbed screens. The navbar is bottom-only.

**Layout wrapper:**

- `min-h-[100dvh] bg-surface-100 relative`
- `<main className="pb-20">` wraps children in `AnimatePresence mode="wait"` with directional page transitions:
  - forward: enter from `x: 10%, opacity: 0`; exit to `x: -10%, opacity: 0`
  - backward: reverse
  - duration 0.3s, ease `[0.4, 0, 0.2, 1]`

**Offline banner** (replaces existing inline `div`):

- framer-motion `AnimatePresence` → slides from `y: -40` to `y: 0`
- Amber tinted background (`bg-warning-400/10 border-warning-400/30`)
- `WifiOff` icon + "You're offline. Reports saved on device."
- Shows when `!isOnline` (from existing `useOnlineStatus` hook — no change)

**Bottom Navbar:**

- `fixed bottom-0`, `bg-surface-50/90 backdrop-blur-md border-t border-surface-200`
- 5 items: Map | Feed | **Report (center)** | Alerts | Profile
- **Center Report button:** `-mt-6`, `w-[72px] h-[72px]`, `rounded-full`, `bg-gradient-to-br from-brand-500 to-brand-600`, `shadow-glow-teal`, `active:scale-95`
- Other items: icon + label, active = `text-brand-500` strokeWidth 2.5, inactive = `text-surface-300` strokeWidth 1.5
- **Active indicator:** `motion.div` with `layoutId="navbar-indicator"` — 2px teal line at top of item, springs between tabs (`stiffness: 500, damping: 30`)
- Safe area bottom: `paddingBottom: 'env(safe-area-inset-bottom, 0px)'`
- navDirection is set by comparing route index on each navigation

### 7.4 ReceiptScreen — Calm Radar Pulse Ceremony

**File:** `src/components/ReceiptScreen.tsx` (restyle)

Replaces the bare `<section>` with a bottom-sheet overlay matching the reference `ReportCeremony` pattern, adapted to the existing router-state data model (`{ publicRef, secret }`).

**Success state — Calm Radar Pulse:**

- Full-screen dark backdrop (`bg-surface-950/60 backdrop-blur-sm`)
- Sheet slides up from bottom (`y: '100%'` → `y: 0`, spring ease `[0.32, 0.72, 0, 1]`)
- Drag handle pill at top
- Center: `w-20 h-20 rounded-full bg-success-500 shadow-glow-success` with animated SVG checkmark (circle draws in 0.4s, tick draws in 0.3s at delay 0.3s)
- **Radar rings:** 3 `motion.div` rings absolutely positioned behind the checkmark circle:
  - `border-2 border-success-500/60` (inner), `/40` (middle), `/20` (outer)
  - `scale: [1, 2.5]`, `opacity: [0.7, 0]`, duration 2s, stagger delay 0 / 0.5 / 1.0s, repeat: `Infinity`
  - Rings stop animating after 4s (3 pulses = enough afterglow)
- **Haptic:** `navigator.vibrate?.([100, 50, 100])` on mount (double-pulse, not party buzz)
- **Reference reveal:** slot-machine typewriter (`useSlotMachine` — port from reference, same `SLOT_CHARS` alphabet, 600ms duration, 400ms delay)
- "Report Received" headline, calm subtext: "Emergency responders have been notified."
- Two CTAs: "Track My Report" → `/lookup`, "Back to Map" → `/`
- **No confetti. No emoji. No exclamation marks on subtext.**

**Queued state:** Amber icon (Clock), "Report Saved", warm amber reference card, "Send as SMS" CTA — matches reference QueuedState. No animation rings.

**Failed state:** Red icon (AlertTriangle), Retry + SMS CTAs — matches reference FailedState.

The slot-machine `useSlotMachine` hook is extracted to `src/hooks/useSlotMachine.ts`.

### 7.4a MapTab — UI Chrome Only

**Design inspiration: Google Maps** — the map fills 100% of the viewport with UI elements floating over it as frosted-glass cards. The Leaflet map and all incident/report layers are left completely unchanged. Only the chrome is restyled.

**File:** `src/components/MapTab/index.tsx` (chrome restyle only — no logic changes)

**Search bar (top float):**

- `absolute top-3 left-3 right-3 z-float`
- `bg-white/90 backdrop-blur-md rounded-full shadow-md h-12 px-4`
- `Search` icon (Lucide, `text-surface-400`) + placeholder "Search Camarines Norte..."
- Mirrors Google Maps search pill — floats above the map, not in a header

**Filter chips (below search bar):**

- Horizontal scroll row of incident-type chips: `absolute top-[68px] left-3 right-3 z-float`
- `no-scrollbar flex gap-2`
- Each chip: `bg-white/90 backdrop-blur-sm rounded-full px-3 py-1.5 text-xs font-medium shadow-sm`
- Active: `bg-brand-500 text-white`

**My Location FAB:**

- `absolute bottom-32 right-4 z-float` (above nav, below any sheet)
- `w-12 h-12 rounded-full bg-white shadow-md flex items-center justify-center`
- `Crosshair` icon, `text-surface-700` — taps existing GPS hook

**Peek sheet (incident selected):**

- Existing `PeekSheet.tsx` and `DetailSheet.tsx` logic untouched
- Restyle container: `bg-white rounded-t-2xl shadow-2xl` with drag handle pill
- Mirrors Google Maps bottom card: business name = incident type (bold, large), address row = barangay/municipality, action buttons row = "Track" + "Report Similar"
- Sheet slides up with framer-motion `y: '100%' → 0`, spring ease

**File change:** `src/components/MapTab/index.tsx` — RESTYLE chrome only; `PeekSheet.tsx`, `DetailSheet.tsx` — restyle container/card only, zero logic changes.

---

### 7.5 FeedTab

**Design inspiration: Facebook News Feed** — familiar infinite-scroll card stream, each card feels like a social post: avatar/icon area, bold title, subtext, timestamp, and a subtle action row. The familiarity lowers the cognitive load for first-time reporters.

**File:** `src/components/FeedTab.tsx` (restyle)

- **Sticky top bar:** `bg-surface-50/90 backdrop-blur-md` with "Community Reports" title + filter icon (right) — mirrors Facebook's top bar pattern
- **Filter chips row** (horizontal scroll, `no-scrollbar`): All / Flood / Fire / Medical / etc. — active chip = `bg-brand-500 text-white`, inactive = `bg-surface-100 text-surface-600`. Matches Facebook's Stories/filter row.
- **Feed cards** (`bg-white rounded-xl shadow-sm mx-3 my-2`):
  - **Header row:** Incident type icon in a colored circle (left) + incident type label (bold) + municipality/barangay (subtext) + timestamp (right, `text-xs text-surface-400`)
  - **Severity badge:** Pill chip, color-coded (danger / warning / info / success) — positioned top-right of card like Facebook's reaction count bubble
  - **Body:** One-line description if available; photo thumbnail (right-aligned, `w-20 h-20 rounded-lg object-cover`) if present
  - **Footer action row:** `border-t border-surface-100 mt-3 pt-2 flex gap-4` — "Track" link (brand color) + status label (`text-xs text-surface-400`) — mirrors Facebook's Like/Comment/Share row in weight and position
- Skeleton loader cards while loading (`animate-shimmer` on placeholder rows)
- Empty state: centered icon + "No reports yet" in `text-surface-400`

### 7.6 AlertsTab

**File:** `src/components/AlertsTab.tsx` (restyle)

- Red tinted header strip for active emergency alerts (if any): `bg-danger-500/10 border-b border-danger-500/20`
- Alert cards: left border color by severity (danger / warning / info)
- `issuedBy` attribution row: `text-xs text-surface-400 flex items-center gap-1`
- Lucide severity icons (existing pattern preserved)

### 7.7 ProfileTab

**File:** `src/components/ProfileTab.tsx` (restyle)

- Auth-aware: pseudonymous banner (existing logic unchanged)
- "My Reports" stats row: report count, verified count
- Settings gear → `/settings` navigation
- Cards use `bg-white rounded-lg shadow-sm` pattern

### 7.8 SettingsPage

**File:** `src/pages/SettingsPage.tsx` (restyle)

- Section headers: `text-xs font-semibold text-surface-400 uppercase tracking-wider px-4 pt-6 pb-2`
- Setting rows: `bg-white` grouped list, `divide-y divide-surface-100`
- Toggle rows use existing `Toggle` component (already built) — restyle to use brand-500 when active
- Destructive row (Sign Out / Delete Account): `text-danger-500`

### 7.9 RegisterPage

**File:** `src/pages/RegisterPage.tsx` (restyle)

- Full-screen white background, no navbar
- Progress steps: dot indicators (same pagination dot pattern as Onboarding)
- Input fields: `rounded-lg border border-surface-200 px-4 h-14 text-base`
- OTP input: large monospace digits, `rounded-xl`
- CTA button: brand gradient, `rounded-xl h-14`
- Back arrow top-left (existing navigate logic unchanged)

### 7.10 LookupScreen

**File:** `src/components/LookupScreen.tsx` (restyle)

- Navy header (existing dark header pattern preserved)
- Two code input fields (publicRef + secret) styled as `font-mono tracking-widest`
- Primary CTA: brand gradient button

### 7.11 Toast

**File:** `src/components/Toast.tsx` (restyle)

- `fixed bottom-24 left-4 right-4 z-toast`
- framer-motion: `y: 80 → 0` on enter, `y: 80` on exit, spring ease `[0.16, 1, 0.3, 1]`
- Color variants: success=`bg-success-400`, error=`bg-danger-500`, warning=`bg-warning-400`, info=`bg-info-500`
- `rounded-lg shadow-lg text-white text-sm font-medium text-center px-4 py-3`

### 7.12 RevealSheet

**File:** `src/components/RevealSheet.tsx` (restyle)

- Existing typewriter animation and vibrate logic unchanged
- Sheet container: `bg-surface-50 rounded-t-3xl shadow-2xl`
- Drag handle pill: `w-10 h-1 bg-surface-300 rounded-full`
- Secret code display: `text-4xl font-extrabold tracking-widest text-surface-900 font-mono`
- Copy button: brand-tinted, Lucide `Copy` icon

---

## 8. Animation System Summary

| Moment                  | Mechanism                                                             | Duration      |
| ----------------------- | --------------------------------------------------------------------- | ------------- |
| Page transition         | framer-motion `AnimatePresence`, x-slide + opacity                    | 0.3s          |
| Splash radar rings      | framer-motion scale + opacity, 3 rings staggered                      | 2s loop       |
| Splash progress bar     | framer-motion width 0→100%                                            | **1.5s**      |
| Onboarding swipe        | framer-motion drag + AnimatePresence x-slide                          | 0.3s          |
| Navbar active dot       | framer-motion `layoutId` spring                                       | stiffness 500 |
| Offline banner          | framer-motion y-slide                                                 | 0.3s          |
| Toast                   | framer-motion y-slide                                                 | 0.3s          |
| Report ceremony sheet   | framer-motion y-slide                                                 | 0.4s spring   |
| Radar pulse rings       | framer-motion scale+opacity, 3 rings, repeat Infinity, stops after 4s | 2s            |
| Checkmark SVG draw      | framer-motion `pathLength`                                            | 0.4s + 0.3s   |
| Slot machine ref reveal | rAF loop, settles left-to-right                                       | 600ms         |
| Haptic                  | `navigator.vibrate([100, 50, 100])`                                   | —             |
| Reduced-motion fallback | CSS media query kills all transitions                                 | instant       |

---

## 9. Test Preservation Strategy

All 203 existing tests must remain green.

- **No DOM structure changes that break queries:** `getByRole`, `getByText`, `getByLabelText` selectors work on semantic elements — Tailwind classes are invisible to these. Safe.
- **New components (SplashScreen, Onboarding):** Must have their own tests added as part of implementation. `App.routes.test.tsx` needs mocks for both new routes.
- **framer-motion in tests:** Add `vi.mock('framer-motion', ...)` in test-utils if animation callbacks cause act() warnings. Otherwise `happy-dom` handles CSS animations silently.
- **ReceiptScreen restyle:** Existing test asserts on `publicRef` and `secret` values displayed. DOM structure changes but values stay — update selectors in the test to use `getByText` with the actual ref value.
- **uiStore:** No test impact — it's purely UI state with no Firebase dependency.

---

## 10. File Change Summary

| File                                                     | Action                                              |
| -------------------------------------------------------- | --------------------------------------------------- |
| `apps/citizen-pwa/tailwind.config.js`                    | CREATE                                              |
| `apps/citizen-pwa/postcss.config.js`                     | CREATE                                              |
| `apps/citizen-pwa/src/styles/design-tokens.css`          | REPLACE (add Tailwind directives + new tokens)      |
| `apps/citizen-pwa/src/lib/design-tokens.ts`              | DELETE                                              |
| `apps/citizen-pwa/src/lib/uiStore.ts`                    | CREATE                                              |
| `apps/citizen-pwa/src/hooks/useSlotMachine.ts`           | CREATE                                              |
| `apps/citizen-pwa/src/pages/SplashScreen.tsx`            | CREATE                                              |
| `apps/citizen-pwa/src/pages/Onboarding.tsx`              | CREATE                                              |
| `apps/citizen-pwa/src/routes.tsx`                        | UPDATE (add /splash, /onboarding routes)            |
| `apps/citizen-pwa/src/App.tsx`                           | UPDATE (entry point logic for splash/onboarding)    |
| `apps/citizen-pwa/src/components/CitizenShell.tsx`       | RESTYLE                                             |
| `apps/citizen-pwa/src/components/ReceiptScreen.tsx`      | RESTYLE (ceremony)                                  |
| `apps/citizen-pwa/src/components/FeedTab.tsx`            | RESTYLE                                             |
| `apps/citizen-pwa/src/components/AlertsTab.tsx`          | RESTYLE                                             |
| `apps/citizen-pwa/src/components/ProfileTab.tsx`         | RESTYLE                                             |
| `apps/citizen-pwa/src/pages/SettingsPage.tsx`            | RESTYLE                                             |
| `apps/citizen-pwa/src/pages/RegisterPage.tsx`            | RESTYLE                                             |
| `apps/citizen-pwa/src/components/LookupScreen.tsx`       | RESTYLE                                             |
| `apps/citizen-pwa/src/components/RevealSheet.tsx`        | RESTYLE                                             |
| `apps/citizen-pwa/src/components/MapTab/index.tsx`       | RESTYLE chrome only (search bar, FAB, filter chips) |
| `apps/citizen-pwa/src/components/MapTab/PeekSheet.tsx`   | RESTYLE container only                              |
| `apps/citizen-pwa/src/components/MapTab/DetailSheet.tsx` | RESTYLE container only                              |
| `apps/citizen-pwa/src/components/Toast.tsx`              | RESTYLE                                             |
| `apps/citizen-pwa/src/components/Toggle.tsx`             | RESTYLE                                             |
| `apps/citizen-pwa/public/watchtower.svg`                 | COPY from reference dist/                           |
| `apps/citizen-pwa/package.json`                          | UPDATE (add framer-motion + tailwind devDeps)       |
| `apps/citizen-pwa/src/App.routes.test.tsx`               | UPDATE (mock SplashScreen, Onboarding)              |

---

## 11. Verification

```bash
cd apps/citizen-pwa
pnpm install
pnpm typecheck
pnpm lint
npx vitest run
pnpm dev   # visual smoke test in browser
```

All 203+ tests must pass. Zero new lint errors. TypeScript strict — no `any`.
