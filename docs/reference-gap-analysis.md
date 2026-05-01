# Reference Gap Analysis — Bantayog Citizen PWA

**Scan date:** 2026-05-01
**Reference:** `/Users/superman/Downloads/CitizenPWA`
**Branch:** `fix/citizen-pwa-redesign-spec-gaps`

---

## Critical Issue

### Map Tab Broken — Global `border-surface-200` Rule

**Root cause:** The reference `index.css` has:

```css
* {
  @apply border-surface-200;
  -webkit-tap-highlight-color: transparent;
}
```

This applies a 1px border to **every element** in the DOM, including Leaflet's internal `<img>` tile children. Leaflet's box model depends on no border being applied to its internal elements — the border shifts the layout calculations and causes tile rendering to fail.

Our `apps/citizen-pwa/src/styles/globals.css` has the same rule. **Fix required:** scope the border rule to exclude Leaflet internal elements (e.g., `.leaflet-tile-pane *`, `.leaflet-tile img`) or use a different approach like `border-surface-200` only on specific elements rather than globally.

---

## Missing Design Tokens

Both CSS variables and Tailwind config need the full scale:

| Token         | Hex       | Status in our tailwind.config |
| ------------- | --------- | ----------------------------- |
| `surface-950` | `#171A1A` | **MISSING**                   |
| `brand-600`   | `#0D7377` | **MISSING**                   |
| `brand-100`   | `#E8F6F3` | **MISSING**                   |
| `brand-50`    | `#F3FAF9` | **MISSING**                   |
| `surface-800` | `#333A3B` | **MISSING**                   |
| `surface-600` | `#4F5859` | **MISSING**                   |
| `surface-500` | `#5E6667` | **MISSING**                   |
| `surface-400` | `#768081` | **MISSING**                   |
| `surface-300` | `#A3ADAE` | **MISSING**                   |
| `danger-600`  | `#C21F1F` | **MISSING**                   |
| `warning-400` | `#F59E0B` | **MISSING**                   |
| `success-400` | `#10B981` | **MISSING**                   |
| `info-400`    | `#3B82F6` | **MISSING**                   |

Reference defines the full 50–600 scale for surface and brand in both CSS custom properties and Tailwind config. Our config currently only has `surface-900`, `surface-700`, `surface-200`, `surface-100`, `surface-50`, `brand-500`.

### Reference tailwind.config.js colors (full):

**Brand (Teal-Cyan):**

```
brand-600: #0D7377
brand-500: #0F9488
brand-400: #4DB6A8
brand-300: #8FD4CA
brand-200: #C4E8E2
brand-100: #E8F6F3
brand-50:  #F3FAF9
```

**Surface (tinted neutrals):**

```
surface-950: #171A1A
surface-900: #25292A
surface-800: #333A3B
surface-700: #414849
surface-600: #4F5859
surface-500: #5E6667
surface-400: #768081
surface-300: #A3ADAE
surface-200: #D5DEDD
surface-100: #F0F4F4
surface-50:  #F8FAFA
```

**Severity:**

```
danger-600:  #C21F1F
danger-500:  #DC2626
danger-400:  #EF4444
warning-500: #D97706
warning-400: #F59E0B
success-500: #059669
success-400: #10B981
info-500:    #2563EB
info-400:    #3B82F6
```

### Reference CSS custom properties (index.css):

```css
:root {
  --surface-950: #171a1a;
  --surface-900: #25292a;
  --surface-800: #333a3b;
  --surface-700: #414849;
  --surface-600: #4f5859;
  --surface-500: #5e6667;
  --surface-400: #768081;
  --surface-300: #a3adae;
  --surface-200: #d5dedd;
  --surface-100: #f0f4f4;
  --surface-50: #f8fafa;

  --brand-600: #0d7377;
  --brand-500: #0f9488;
  --brand-400: #4db6a8;
  --brand-300: #8fd4ca;
  --brand-200: #c4e8e2;
  --brand-100: #e8f6f3;
  --brand-50: #f3faf9;

  --danger-500: #dc2626;
  --warning-500: #d97706;
  --success-500: #059669;
  --info-500: #2563eb;

  /* Shadcn compatibility */
  --primary: 174 84% 29%;
  --radius: 0.75rem;
}
```

---

## Features from plan.md NOT in Reference

The `plan.md` "Afterglow" section describes these, but **none exist in any source file**:

1. **"Your Impact"** — barangays helped, reports count dashboard
2. **"My Achievements"** / milestone badges — First report, 5th report, helped verify neighbor's report
3. **"Days as a Guardian"** — streak counter
4. **Share prompts** — "Share that you helped keep your community safe"
5. **Community stats** — "Together, Bantayog citizens reported 247 incidents this month"

**Critical finding:** `ProfileView.tsx` is literally a stub:

```tsx
<div className="min-h-[100dvh] flex items-center justify-center">
  <h1 className="text-[28px] font-bold text-[surface-900]">Profile</h1>
  <p className="text-base text-[surface-500] mt-2">My reports, stats, milestones</p>
</div>
```

**Implication:** Our existing ProfileTab (badges, milestones, stats) and SettingsPage (toggles, storage estimate, data export) are **more complete than the reference**. For "Your Impact" / badge system, neither the reference nor the plan.md has an implementation — this is ours to design.

---

## ReportCeremony — Reference Implementation Detail

Fully implemented in the reference. Key details:

### useSlotMachine hook

```typescript
const SLOT_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
// 24 chars (no I, O, vowels avoided)

function useSlotMachine(target: string, durationMs: number, startDelayMs: number) {
  // Settles left-to-right, random chars fill unresolved positions
  // duration: 600ms, startDelay: 400ms
}
```

### AnimatedCheck SVG

```typescript
// Circle: pathLength 0→1, duration 0.4s
// Check: pathLength 0→1, delay 0.3s, duration 0.3s
<motion.circle cx="24" cy="24" r="22" stroke="currentColor" strokeWidth="3" fill="none"
  initial={{ pathLength: 0, opacity: 0 }}
  animate={{ pathLength: 1, opacity: 1 }}
  transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
/>
```

### Confetti

```typescript
confetti({
  particleCount: 120,
  spread: 70,
  origin: { y: 0.6 },
  colors: ['#059669', '#0F9488', '#4DB6A8', '#D5DEDD'],
})
// Triggered 300ms after mount (SuccessState)
```

### Success State

- Circle: `w-20 h-20 rounded-full bg-success-500 shadow-glow-success`
- Tracking ref card: `bg-surface-100 rounded-xl border border-surface-200`
- Ref value: `text-3xl font-bold tracking-widest font-mono`
- Buttons: "Track My Report" (`bg-brand-500`) + "Back to Map" (`bg-transparent`)

### Queued State (offline)

- Circle: `w-20 h-20 rounded-full bg-warning-500`
- Icon: `Clock size={36}`
- Ref card: `bg-warning-400/10 rounded-xl border-warning-400/30`
- "Send as SMS Instead" button: `bg-surface-800` + `MessageSquare` icon

### Failed State

- Circle: `w-20 h-20 rounded-full bg-danger-500`
- Icon: `AlertTriangle size={36}`
- Buttons: "Retry" (`bg-brand-500` + `RotateCcw`) → "Send as SMS" (`bg-surface-800`) → "Back to Map"

### Sheet Layout

```tsx
className = 'fixed inset-0 z-emergency flex flex-col justify-end'
// Backdrop: bg-surface-950/60 backdrop-blur-sm
// Sheet: maxHeight: '85vh', minHeight: '60vh', rounded-t-3xl, shadow-2xl
// Drag handle: w-10 h-1 rounded-full bg-surface-300, centered pt-3 pb-1
// Transition: [0.32, 0.72, 0, 1] ease, duration 0.4s
```

---

## ReportWizard — Reference vs Ours

| Aspect                   | Reference                                                                    | Ours                           |
| ------------------------ | ---------------------------------------------------------------------------- | ------------------------------ |
| Step indicator           | 3 horizontal bars (`h-2 flex-1 rounded-full`), `animate-pulse` on current    | We recently changed to dots    |
| Step indicator color     | `bg-brand-500` active, `bg-surface-200` pending                              | Need to verify                 |
| Submit button (Step 3)   | **`bg-danger-500`** (red/danger)                                             | We use `brand-500` (teal)      |
| GPS loading animation    | Two concentric rings with `animate-radar-ring`, staggered 0.5s               | We may have radar ring already |
| "Is anyone hurt?" toggle | **NOT PRESENT** anywhere in reference                                        | We have it (keep it)           |
| Incident type icons      | `Waves, Flame, Activity, Wind, Mountain, CloudLightning`                     | Need to verify alignment       |
| Incident type grid       | 2-column, `gap-3`, `min-h-[80px]` per card                                   | Likely similar                 |
| Transitions              | Framer Motion slide (`x: 100%→0` forward, `x: -20%` exit)                    | `AnimatePresence`              |
| Consent checkbox         | Custom animated SVG checkmark via `pathLength`                               | Standard checkbox              |
| Step 2 location inputs   | Municipality + barangay selects, `appearance-none`, focus `border-brand-500` | Similar                        |

### Incident type color map (reference):

| Type        | Icon           | Selected border      | Selected bg         | Selected text      |
| ----------- | -------------- | -------------------- | ------------------- | ------------------ |
| Flood       | Waves          | `border-info-500`    | `bg-info-500/10`    | `text-info-500`    |
| Fire        | Flame          | `border-danger-500`  | `bg-danger-500/10`  | `text-danger-500`  |
| Earthquake  | Activity       | `border-danger-500`  | `bg-danger-500/10`  | `text-danger-500`  |
| Typhoon     | Wind           | `border-warning-500` | `bg-warning-500/10` | `text-warning-500` |
| Landslide   | Mountain       | `border-danger-500`  | `bg-danger-500/10`  | `text-danger-500`  |
| Storm Surge | CloudLightning | `border-danger-500`  | `bg-danger-500/10`  | `text-danger-500`  |

### GPS Button (reference):

```tsx
className="w-full min-h-[56px] rounded-xl bg-brand-500 text-white font-semibold text-base
  flex items-center justify-center gap-2 active:bg-brand-600 transition-colors
  disabled:opacity-70 relative overflow-hidden"
// Loading state: two concentric radar rings, border-white/30 and border-white/20
// w-20 h-20 rounded-full, absolute inset-0, centered
// Both use animate-radar-ring, second has animationDelay: '0.5s'
// Success feedback: "GPS location captured" text with Check icon
```

---

## Navbar — Reference Gold Standard

```tsx
// Container:
fixed bottom-0 left-0 right-0 z-nav
bg-surface-50/90 backdrop-blur-md border-t border-surface-200
h-16 max-w-lg mx-auto
style: paddingBottom: env(safe-area-inset-bottom, 0px)

// Center FAB:
relative -mt-6
w-[72px] h-[72px] rounded-full
bg-gradient-to-br from-brand-500 to-brand-600
shadow-glow-teal
active:scale-95 transition-transform
Icon: size={28} strokeWidth={2.5} className="text-white"

// Regular tabs:
flex flex-col items-center justify-center
w-16 h-16 gap-1 min-w-[48px] min-h-[48px]

// Icon:
size={22}
strokeWidth: isActive ? 2.5 : 1.5
className: isActive ? text-brand-500 : text-surface-300

// Active indicator:
motion.div layoutId="navbar-indicator"
absolute top-0 w-8 h-0.5 bg-brand-500 rounded-full
transition: type: spring, stiffness: 500, damping: 30

// Nav items:
{ path: '/map',      label: 'Map',      Icon: MapPin        }
{ path: '/feed',     label: 'Feed',     Icon: ClipboardList  }
{ path: '/report',   label: 'Report',   Icon: AlertTriangle, isCenter: true }
{ path: '/alerts',   label: 'Alerts',   Icon: Bell           }
{ path: '/profile',  label: 'Profile',  Icon: User           }
```

**Key detail:** The active indicator uses `layoutId` for a shared layout animation — this is the Framer Motion pattern for the sliding pill indicator. Our current nav may not have this animation.

---

## Onboarding — Reference Implementation

**3-step swipeable** via Framer Motion `drag="x"` + `useMotionValue`. Steps:

### Step 0 — Welcome

- Watchtower SVG: `max-w-[280px] h-[200px]`
- Headline: `text-[28px] font-bold text-surface-900`: "Welcome to Bantayog"
- Subheadline: `text-[18px] font-semibold text-surface-500`: "Your community watchtower"
- Tagline badge: `px-4 py-2 rounded-full` with `background: rgba(15,148,136,0.08)`
- Animated text: `x: [-2, 2, -2]` 4s infinite — "Bayanihan sa Panahon ng Sakuna"

### Step 1 — Privacy

- 3 cards: `EyeOff` (brand-500 border), `Shield` (success-400 border), `Scale` (warning-400 border)
- Custom animated checkbox: SVG checkmark via `pathLength`
- Shake animation on error: `@keyframes shake` 0.3s ease-in-out

### Step 2 — How It Works

- SVG dashed connecting line: `stroke-dasharray="6 4"`, `pathLength: 0→1` over 1.5s
- Icon circles: `w-14 h-14 rounded-full bg-gradient-to-br from-brand-500 to-brand-600`
- Icons: `AlertTriangle`, `Send`, `ShieldCheck`

### Bottom Nav

- Pagination dots: animated width 8→24px, `bg-brand-500` active
- Continue button: gradient `brand-500→brand-600`, grows `h-14` on final step
- Labels: "Get Started" → "I Understand — Continue" → "Start Reporting"
- Final step has `box-shadow: 0 0 24px rgba(13,148,136,0.3)` glow

### Easing constants:

```typescript
const easeSmooth = [0.4, 0, 0.2, 1]
const easeAnticipate = [0.34, 1.56, 0.64, 1]
```

---

## Layout Component (reference)

```tsx
// Offline banner:
sticky top-0 z-toast
bg-warning-400/10 border-b border-warning-400/30
WifiOff icon + "You're offline. Reports saved on device."

// Page transitions:
key={location.pathname}
variants: x: 10%/-10% → 0, opacity: 0→1
duration: 0.3, ease: [0.4, 0, 0.2, 1]

// Toast:
fixed bottom-24 left-4 right-4 z-toast
bg-success-400 | bg-danger-500 | bg-warning-400 | bg-info-400
slide up: y: 80 → 0, duration 0.3

// main.pb-20 (accounts for navbar)
```

---

## UI Store (reference) — `uiStore.ts`

```typescript
interface UIState {
  currentRoute: string
  isOffline: boolean
  showNavbar: boolean
  toast: { message: string; type: 'success' | 'error' | 'warning' | 'info' } | null
  hasCompletedOnboarding: boolean
  navDirection: 'forward' | 'backward'
}

// Offline detection: navigator.onLine + window event listeners
// Toast auto-dismiss: 3000ms
// LocalStorage: onboardingComplete
// SessionStorage: bantayog_phone (user's phone for pre-fill)
```

---

## Report Store (reference) — `reportStore.ts`

```typescript
interface ReportFormState {
  step: 1 | 2 | 3
  incidentType: string | null
  photo: string | null
  location: { mode: 'gps' | 'manual'; municipality; barangay; lat?; lng? }
  contact: { name; phone }
  consent: boolean
  submitting: boolean
  submitStatus: 'idle' | 'success' | 'queued' | 'failed'
  trackingRef: string | null // 8-char alphanumeric
  secretCode: string | null // 6-digit numeric (NOT shown to user)
}

// Draft localStorage key: 'bantayog_draft_report', auto-save every 10s
// Tracking ref charset: 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' (no I,O,0,1)
```

---

## Tailwind Animations Missing in Our Config

The `radar-ring` animation exists in our config but may not be in globals.css:

```css
@keyframes radar-ring {
  '0%' {
    transform: 'scale(0.5)';
    opacity: '0.6';
  }
  '100%' {
    transform: 'scale(1.5)';
    opacity: '0';
  }
}
```

The reference also has these keyframes:

- `pulse-glow` — teal glow pulse, 3 iterations
- `pulse-scale` — scale 1→1.02→1, 3 iterations
- `caret-blink` — opacity blink for cursor
- `shimmer` — background position shimmer

---

## Z-Index Scale

| Token       | Value | Usage                   |
| ----------- | ----- | ----------------------- |
| `float`     | 20    | FAB, bottom sheets      |
| `nav`       | 30    | Bottom navbar           |
| `modal`     | 40    | Modal dialogs           |
| `toast`     | 50    | Toast notifications     |
| `splash`    | 60    | Splash screen           |
| `emergency` | 70    | Report ceremony overlay |

---

## Packages Reference Uses That We May Need

| Package                  | Version    | Notes                                            |
| ------------------------ | ---------- | ------------------------------------------------ |
| `framer-motion`          | `^12.38.0` | Page transitions, slot machine, navbar indicator |
| `canvas-confetti`        | `^1.9.4`   | Report ceremony celebration                      |
| `lucide-react`           | `^0.562.0` | Icons (we already use)                           |
| `zustand`                | `^5.0.12`  | State management (we use React context)          |
| `zod`                    | `^4.3.5`   | Validation (we use zod v3)                       |
| `@fontsource/montserrat` | `^5.2.8`   | Splash screen title font                         |
| `@fontsource/inter`      | `^5.2.8`   | Body font                                        |

Note: **No Firebase** in the reference app — it uses LocalForage + Zustand.

---

## What We Have That Reference Doesn't (Preserve)

These are our differentiating features — must be preserved during any adaptation:

1. **SMS fallback** — `SmsFallbackButton.tsx`, `OfflineBanner.tsx`. The reference has NO SMS fallback whatsoever. The queued state in ReportCeremony has a "Send as SMS Instead" button that triggers a `sms:?body=` link, but no offline queue management.

2. **Firebase integration** — auth, Firestore, offline persistence. Reference uses LocalForage only.

3. **`useOfflineQueueCount` hook** — our offline queue management, polling draftStore every 5s.

4. **Our ProfileTab** — already has achievement badges, milestone tracker, stats. Reference's ProfileView is a stub.

5. **Our SettingsPage** — push toggles, storage estimate, data export, delete account flow. Reference's SettingsView is a stub.

6. **"Is anyone hurt?" toggle** — not present in reference.

7. **`subscribeAlerts` Firebase integration** — reference has no alerts system at all.

---

## Priority Work Items

### P0 — Breaking

1. **Fix MapTab** — scope or remove `* { @apply border-surface-200 }` from globals.css

### P1 — Design Token Parity

2. **Add missing tokens** to `tailwind.config.cjs`: `surface-950`, `brand-600`, `brand-100`, `brand-50`, full surface/brand/severity scales
3. **Add missing CSS custom properties** to `globals.css`

### P2 — Report Ceremony

4. **Implement `useSlotMachine` hook** — 600ms, 400ms delay, `SLOT_CHARS`
5. **Implement `AnimatedCheck` SVG** — pathLength animations
6. **Add confetti** — `canvas-confetti`, 120 particles, teal palette
7. **Change submit button color to `bg-danger-500`** on Step 3 (red is the reference convention for critical submit)

### P3 — Align Icons & Animations

8. **Verify incident type icons** match `Waves, Flame, Activity, Wind, Mountain, CloudLightning`
9. **Add `animate-radar-ring`** to globals.css if not present
10. **Align step indicator** — reference uses 3 horizontal bars with `animate-pulse`; our recent commit uses dots (check if this is an intentional departure)

### P4 — Design "Afterglow" Features

11. **Design "Your Impact" section** — since neither reference nor plan.md has an implementation, this is ours to create
12. **Design badge/milestone system** — same situation; our existing ProfileTab badges are a good start

### Not Needed (Reference is a Stub)

- MapView, FeedView, AlertsView, ProfileView, SettingsView, StatusTracker in reference are all stubs — our implementations are more complete and should not be replaced with placeholder reference code.
