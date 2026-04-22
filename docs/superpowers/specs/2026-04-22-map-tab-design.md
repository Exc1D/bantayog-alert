# Map Tab — Design Spec

**Date:** 2026-04-22
**Surface:** Citizen PWA (`apps/citizen-pwa`)
**Status:** Approved — ready for implementation planning
**Aligned to:** Architecture Spec v8.0, Citizen Role Spec v2.0
**Design system:** Guardian Chronicle / Calm Urgency (`stitch_the_reveal_experience_framework`)

---

## 1. Overview

The Map Tab is the default home screen (`/`) of the Citizen PWA. It is a full-bleed Leaflet + OSM map with all chrome overlaid as absolutely-positioned layers. It serves two simultaneous purposes:

1. **Public situational awareness** — verified incidents across the province, visible to all citizens.
2. **Personal incident command** — a citizen's own submitted reports appear as personal pins, with live status progression and the Stage 3 afterglow experience when expanded.

---

## 2. Screen Anatomy

```text
┌──────────────────────────────────────┐
│  [☰]   VIGILANT            [🔔]     │  ← TopBar: #001e40, 64px, fixed, z-50
├──────────────────────────────────────┤
│  [Severity: All ▾] [Last 24h ▾]     │  ← FilterBar: floating 8px below TopBar, z-40
│                                      │
│         [full-bleed Leaflet map]     │
│                                      │
│     ● (High — pulsing red)           │  ← IncidentLayer
│             ◎ (Medium — orange)      │
│  ◎ (My report — navy ring + pulse)   │  ← MyReportLayer (own uid only)
│                                      │
│  ══════════════════════════════════  │  ← PeekSheet (80px, z-55, appears on pin tap)
│  🌊 Flood · High · Brgy San Jose    │
│  ↑ Pull up for full detail           │
├──────────────────────────────────────┤
│  [Map] [Feed] [🚨Report] [⚠️] [👤]  │  ← BottomNav: glassmorphic, 88px, z-45
└──────────────────────────────────────┘
```

**Z-index stack (lowest to highest):**

| Layer       | z-index |
| ----------- | ------- |
| Leaflet map | base    |
| FilterBar   | z-40    |
| BottomNav   | z-45    |
| TopBar      | z-50    |
| PeekSheet   | z-55    |
| DetailSheet | z-60    |

PeekSheet at z-55 renders above BottomNav (z-45), allowing the peek strip to visually sit above the nav bar. DetailSheet (z-60) slides over everything including the TopBar.

---

## 3. Architecture

### 3.1 Approach

`CitizenShell` is a thin layout wrapper (TopBar + BottomNav + outlet). `MapTab` is a self-contained vertical slice — it owns all local state, its own Firestore hooks, and its own child components. No Zustand. Other tabs are stubs until specced separately.

### 3.2 File Structure

```text
apps/citizen-pwa/src/
├── components/
│   ├── CitizenShell.tsx          NEW: layout wrapper + BottomNav
│   ├── MapTab/
│   │   ├── index.tsx             NEW: orchestrator, owns all local state
│   │   ├── IncidentLayer.tsx     NEW: public verified pins
│   │   ├── MyReportLayer.tsx     NEW: personal pins (own uid)
│   │   ├── FilterBar.tsx         NEW: glassmorphic pill filters
│   │   ├── PeekSheet.tsx         NEW: peek strip + drag-to-expand
│   │   └── DetailSheet.tsx       NEW: full detail, two modes
│   ├── SubmitReportForm.tsx      existing
│   ├── ReceiptScreen.tsx         existing
│   └── LookupScreen.tsx          existing
├── hooks/
│   ├── usePublicIncidents.ts     NEW: Firestore listener, verified only
│   └── useMyActiveReports.ts     NEW: Firestore listener, own uid, all statuses
└── routes.tsx                    MODIFY: wrap in CitizenShell, add map route
```

### 3.3 Local State in `MapTab/index.tsx`

```ts
const [selectedPin, setSelectedPin] // { id: string; type: 'incident' | 'myReport' } | null
const [sheetPhase, setSheetPhase] // 'hidden' | 'peek' | 'expanded'
const [filters, setFilters] // { severity: 'all'|'high'|'medium'|'low'; window: '24h'|'7d'|'30d' }
```

`selectedPin` persists through map pan and zoom — the user does not lose the selected pin when they move the map. It resets to `null` on: swipe-dismiss gesture, tapping empty map area, or tapping a different pin.

### 3.4 DetailSheet Props (discriminated union)

```ts
type DetailSheetProps =
  | { mode: 'public'; incident: PublicIncident }
  | { mode: 'myReport'; report: MyReport }
```

TypeScript enforces at compile time that Edit/Cancel never appear on a public incident.

---

## 4. Data Layer

### 4.1 `usePublicIncidents(filters)`

- Firestore listener on `reports` collection
- Query: `visibilityClass == 'public_alertable'` and `submittedAt >= cutoff`
- Limit: 100 documents (arch spec §9.6 — clustering above cap)
- Severity is filtered client-side after snapshot mapping
- Returns: `{ incidents: PublicIncident[]; loading: boolean; error: unknown }`

### 4.2 `useMyActiveReports(uid)`

- Firestore listener on `reports` collection
- Query: `reporterUid == uid`, **all statuses** (`new`, `awaiting_verify`, `verified`, `dispatched`, `resolved`)
- Why all statuses: the hook serves two independent purposes — (a) rendering pending own pins (`new`, `awaiting_verify`) and (b) rendering verified own pins with the ownership ring style and suppressing the duplicate public pin (`verified`, `dispatched`, `resolved`). Narrowing the query would drop either pending pins or the deduplication set.
- No limit — a citizen's own reports are bounded by rate limits (10/day per arch spec §7.1)
- Returns: `{ reports: MyReport[]; loading: boolean }`

### 4.3 Layer Deduplication

`MyReportLayer` renders on top of `IncidentLayer` (higher z-index). When a verified own report appears in both datasets, `IncidentLayer` must suppress its filled-dot pin for any report ID present in `myActiveReports` — preventing a filled dot and an ownership ring from stacking on the same coordinate.

```ts
const suppressed = new Set(myActiveReports.map((r) => r.id))
const visibleIncidents = incidents.filter((i) => !suppressed.has(i.id))
```

Pending own reports (`new`, `awaiting_verify`) are also in `suppressed` but have no effect — they never appear in `incidents` since `usePublicIncidents` queries `status == 'verified'` only.

---

## 5. Pin Styles

| Pin type                 | Visual                                                           | When                                                                                                                                               |
| ------------------------ | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Public verified — High   | Filled red dot (`#dc2626`), red ripple pulse 2s infinite         | `status == 'verified'`, `severity == 'high'`                                                                                                       |
| Public verified — Medium | Filled orange dot (`#a73400`), no pulse                          | `severity == 'medium'`                                                                                                                             |
| Public verified — Low    | Filled navy dot (`#001e40`), no pulse                            | `severity == 'low'`                                                                                                                                |
| My report — pending      | Navy (`#001e40`) outlined ring + slow inner pulse (unclassified) | Own report, `status ∈ ['new','awaiting_verify']`                                                                                                   |
| My report — verified     | Severity-colored ring + severity-colored pulse                   | Own report, `status ∈ ['verified','dispatched','resolved']` — ring color AND pulse color both inherit severity (`#dc2626` / `#a73400` / `#001e40`) |

All pins: minimum touch target 44×44px (arch spec §9.8).

**Token note:** High severity uses `#dc2626` (matching existing `--color-failed-fg` in `design-tokens.css`). The Guardian Chronicle mockups use `#ba1a1a` — this spec defers to the codebase token. Medium orange (`#a73400`) and surface-container variants from the design system do not yet exist in `design-tokens.css` and must be added as part of implementation.

---

## 6. Pin Tap Interaction — Hybrid Peek → Expand

**First tap on any pin:**

1. Mini label tooltip appears above the pin (incident type + severity, e.g. "🌊 Flood · High").
2. PeekSheet strip slides up from below BottomNav (80px tall, 200ms `ease-out` `translateY`).

**PeekSheet content:**

```text

▬▬▬▬▬▬ ← drag handle: 32×4px rounded pill, on-surface-variant at 40% opacity,
centered, 8px below sheet top
🌊 Flood · High · Brgy San Jose, Daet
↑ Pull up for full detail

```

**Expanding to DetailSheet:** Pull the PeekSheet upward (or tap it) → DetailSheet expands to full height, 250ms spring. DetailSheet renders at z-60, sliding over BottomNav and TopBar.

### 6.1 Full Gesture Matrix

| Current state | Gesture                        | Result                          |
| ------------- | ------------------------------ | ------------------------------- |
| `hidden`      | Tap pin                        | → `peek`                        |
| `peek`        | Pull up / tap strip            | → `expanded`                    |
| `peek`        | Swipe down                     | → `hidden`, selectedPin cleared |
| `peek`        | Tap empty map area             | → `hidden`, selectedPin cleared |
| `expanded`    | Swipe down (partial)           | → `peek`                        |
| `expanded`    | Swipe down (full / fast flick) | → `hidden`, selectedPin cleared |
| `expanded`    | Tap drag handle                | → `peek`                        |
| `expanded`    | Tap [Close] button             | → `hidden`, selectedPin cleared |
| `expanded`    | Tap different pin              | → `peek` with new pin data      |

`[Close]` performs a full dismiss to `hidden` — it does not collapse to `peek`. This distinguishes the intentional "done" action from the drag gesture's intermediate state.

---

## 7. DetailSheet Content

### 7.1 Mode: `'public'` — verified public incident

```text

▬▬▬▬▬▬ (drag handle — same spec as PeekSheet)

🌊 Flood [HIGH] ← type + severity chip (full border-radius)
📍 Barangay San Jose, Daet
Reported 12 minutes ago

▌ Status Dispatched ← tonal banner, left primary accent bar (3px wide)

Verified by Daet MDRRMO ← institutional attribution, no admin name

[Close] → sheetPhase: 'hidden'

```

No edit actions. Exact reporter identity never shown.

### 7.2 Mode: `'myReport'` — own report (Stage 3 afterglow)

```text
▬▬▬▬▬▬  (drag handle)

★ Your Report
🌊 Flood · Awaiting Review             ← severity shown only if admin has classified

┌─────────────────────────────────┐
│  TRACKING CODE                  │    ← container has `user-select: all` on the code
│  DAET-2026-0471    [Copy]       │    ← [Copy] triggers clipboard write
└─────────────────────────────────┘        → button label changes to "Copied ✓"
                                            → resets after 2 seconds (no toast)

○──●──○──○──○
Received  Under Review  Verified  Dispatched  Resolved
          ↑ current step highlighted

── if dispatched: ─────────────────────────────────────
  ● En Route                           ← pulsing dot, tertiary-fixed background
    Response Team Dispatched
───────────────────────────────────────────────────────

[Edit]  [Cancel]                       ← status ∈ ['new', 'awaiting_verify']
── OR ──
[Request Correction]                   ← status ∈ ['verified', 'dispatched', 'resolved']
```

`actionsFor(status)` is a pure function — derived at render time, never stored.

---

## 8. FilterBar

Floating glassmorphic pills, 8px below TopBar, z-40:

- Style: `backdrop-blur-[24px]`, `bg-surface-container-lowest/85`, `rounded-full`, ambient shadow
- Tapping a pill opens a **bottom action sheet** (not a dropdown)
- **Severity:** All / High / Medium / Low
- **Time window:** Last 24h / 7 days / 30 days
- Active non-default filter: pill background → `primary-container`, text → `on-primary`
- Pills disabled while offline (no new queries can be issued)

---

## 9. Empty and Offline States

**Empty state** (no incidents match current filter):

```text
        (Leaflet map still renders beneath)

   ┌──────────────────────────────────┐
   │  No reported incidents in this   │   ← centered card, surface-container-low
   │  area in the last 24 hours.      │
   │  [Clear filters]                 │
   └──────────────────────────────────┘
```

**Offline banner** — persistent strip rendered between map and BottomNav when connectivity is lost:

```text
📶 Offline — map data may be outdated
```

- Firestore SDK offline cache is used for any previously loaded incident data. There is **no service worker tile cache** in this implementation (see §12). Leaflet may fail to load new tiles while offline — this is acceptable for the pilot.
- Filter pills are disabled while offline.
- Own pending reports that are queued in localForage (not yet server-confirmed) still render in `MyReportLayer` with a "⏳ Queued" label on the pin tooltip.

---

## 10. Animation Rules

From the Guardian Chronicle design system — no playful motion, no bounce, no overshoot:

| Element                      | Animation                                    |
| ---------------------------- | -------------------------------------------- |
| PeekSheet slide-up           | `translateY`, 200ms, `ease-out`              |
| DetailSheet expand           | 250ms spring from peek height to full        |
| DetailSheet collapse to peek | 200ms, `ease-in`                             |
| Sheet full dismiss           | `translateY` to off-screen, 150ms, `ease-in` |
| Pin ripple pulse             | 2s infinite, `cubic-bezier(0.4, 0, 0.6, 1)`  |
| Filter pill active           | 150ms color transition                       |
| Copy button reset            | 2s timeout, no animation — label swap only   |

---

## 11. Design System Tokens

Tokens used in this feature. Existing `design-tokens.css` tokens are marked **existing**; new ones must be added during implementation.

| Token                              | Value                     | Usage                                              | Status                         |
| ---------------------------------- | ------------------------- | -------------------------------------------------- | ------------------------------ |
| `--color-primary`                  | `#001e40`                 | TopBar, active nav, low-severity pin, pending ring | existing                       |
| `--color-failed-fg`                | `#dc2626`                 | High severity pin + ripple                         | existing                       |
| `--color-secondary`                | `#a73400`                 | Medium severity pin                                | **new**                        |
| `--color-surface-container-low`    | `#f2f4f6`                 | DetailSheet background, empty state card           | **new**                        |
| `--color-surface-container-lowest` | `#ffffff`                 | FilterBar pill base                                | **new**                        |
| `--color-on-surface-variant`       | `#43474f`                 | Drag handle, secondary text                        | **new**                        |
| `--color-tertiary-fixed`           | `#d1e4ff`                 | Dispatch "En Route" banner bg                      | **new**                        |
| Font headline                      | Plus Jakarta Sans 700/800 | Incident type, tracking code                       | **new** (currently not loaded) |
| Font body/label                    | Inter 400/500/600         | Location, status, actions                          | **new**                        |

**Rule:** No 1px borders for sectioning. Depth via tonal surface shifts only.
**Glass rule:** FilterBar and BottomNav use `backdrop-blur` glassmorphism.
**Border radius:** `0.125rem` for most elements; `999px` for pills and severity chips.

---

## 12. Testing

### 12.1 Hooks

`usePublicIncidents`:

- Returns empty array when no verified incidents match filters
- Applies severity filter correctly
- Applies time window filter correctly
- Handles Firestore listener error (returns `error` field, not throw)

`useMyActiveReports`:

- Returns all own reports regardless of status
- Returns empty array for unauthenticated user (uid is null)
- Handles Firestore listener error gracefully

### 12.2 Pure Functions

`actionsFor(status)`:

- `'new'` → `['edit', 'cancel']`
- `'awaiting_verify'` → `['edit', 'cancel']`
- `'verified'` → `['request_correction']`
- `'dispatched'` → `['request_correction']`
- `'resolved'` → `['request_correction']`

Layer deduplication (`suppressed` set):

- Own verified report ID is excluded from `visibleIncidents`
- Own pending report ID in `suppressed` has no effect on `visibleIncidents` (pending reports are not in `incidents`)

### 12.3 Component Behavior

`PeekSheet`:

- Renders at z-55 (above BottomNav at z-45)
- Drag handle is 32×4px centered pill
- Swipe-down gesture from `peek` → `hidden`
- Tap gesture → triggers `onExpand` callback

`DetailSheet` (mode: `'myReport'`):

- Copy button changes label to "Copied ✓" after clipboard write, resets after 2s
- `[Close]` sets `sheetPhase` to `'hidden'` (not `'peek'`)
- Swipe-down partial → `sheetPhase: 'peek'`
- Swipe-down full flick → `sheetPhase: 'hidden'`
- Edit/Cancel visible only when `status ∈ ['new', 'awaiting_verify']`
- Request Correction visible only when `status ∈ ['verified', 'dispatched', 'resolved']`

`DetailSheet` (mode: `'public'`):

- Edit, Cancel, Request Correction never rendered (enforced by discriminated union)

---

## 13. Out of Scope

- Feed Tab, Alerts Tab, Profile Tab — stubs only in this spec
- **Service worker map tile caching** — no service worker exists in `citizen-pwa` currently. Offline tile rendering is a future prerequisite. Implementation must NOT add a claim of offline tile support to the UI.
- Map tile download for offline (citizen role spec §Future Enhancements)
- Clustering UI detail — Leaflet default cluster markers acceptable for pilot
- Report submission flow — existing `SubmitReportForm` wired to Report tab CTA
- Deep-linking to a specific incident via URL — deferred (no Zustand / URL state in this iteration)
- Confirmation dialog for "Cancel report" action — that detail belongs in the Report Tab spec
