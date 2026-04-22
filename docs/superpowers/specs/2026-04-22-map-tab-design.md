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

```
┌──────────────────────────────────────┐
│  [☰]   VIGILANT            [🔔]     │  ← TopBar: #001e40, 64px, fixed, z-50
├──────────────────────────────────────┤
│  [Severity: All ▾] [Last 24h ▾]     │  ← FilterBar: floating 8px below TopBar
│                                      │
│         [full-bleed Leaflet map]     │
│                                      │
│     ● (High — pulsing red)           │  ← IncidentLayer
│             ◎ (Medium — orange)      │
│  ◎ (My report — navy ring + pulse)   │  ← MyReportLayer (own uid only)
│                                      │
│  ══════════════════════════════════  │  ← PeekSheet (80px, appears on pin tap)
│  🌊 Flood · High · Brgy San Jose    │
│  ↑ Pull up for full detail           │
├──────────────────────────────────────┤
│  [Map] [Feed] [🚨Report] [⚠️] [👤]  │  ← BottomNav: glassmorphic, 88px, z-50
└──────────────────────────────────────┘
```

DetailSheet (pulled up from PeekSheet) is a full-height bottom sheet that slides over the BottomNav. Content is determined by which pin was tapped — see §5.

---

## 3. Architecture

### 3.1 Approach

`CitizenShell` is a thin layout wrapper (TopBar + BottomNav + outlet). `MapTab` is a self-contained vertical slice — it owns all local state, its own Firestore hooks, and its own child components. No Zustand. Other tabs are stubs until specced separately.

### 3.2 File Structure

```
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
const [filters, setFilters] // { severity: 'all'|'high'|'med'|'low'; window: '24h'|'7d'|'30d' }
```

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
- Query: `status == 'verified'`, filtered by `severity` and `createdAt` window
- Limit: 100 documents (arch spec §9.6 — clustering above cap)
- Returns: `{ incidents: PublicIncident[]; loading: boolean; error: unknown }`

### 4.2 `useMyActiveReports(uid)`

- Firestore listener on `reports` collection
- Query: `reporterUid == uid` — **all statuses** (new, awaiting_verify, verified, dispatched, resolved)
- No limit — a citizen's own reports are bounded by rate limits (10/day)
- Returns: `{ reports: MyReport[]; loading: boolean }`

### 4.3 Layer Deduplication

`MyReportLayer` renders on top of `IncidentLayer` (higher z-index). When a verified own report appears in both datasets, `IncidentLayer` must suppress its pin for any `incidentId` present in `myActiveReports` — preventing a filled dot and an ownership ring from stacking on the same coordinate.

```ts
const suppressed = new Set(myActiveReports.map((r) => r.id))
const visibleIncidents = incidents.filter((i) => !suppressed.has(i.id))
```

---

## 5. Pin Styles

| Pin type                 | Visual                                                   | When                                                                                                                        |
| ------------------------ | -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Public verified — High   | Filled red dot (`error`), red ripple pulse (2s infinite) | `status == 'verified'`, `severity == 'high'`                                                                                |
| Public verified — Medium | Filled orange dot (`secondary`), no pulse                | `severity == 'medium'`                                                                                                      |
| Public verified — Low    | Filled navy dot (`primary`), no pulse                    | `severity == 'low'`                                                                                                         |
| My report — pending      | Navy outlined ring + slow inner pulse (unclassified)     | Own report, `status ∈ ['new','awaiting_verify']`                                                                            |
| My report — verified     | Severity-colored ring + pulse                            | Own report, `status ∈ ['verified','dispatched','resolved']` — inherits severity color, retains ring shape to mark ownership |

All pins: minimum touch target 44×44px (arch spec §9.8).

---

## 6. Pin Tap Interaction — Hybrid Peek → Expand

**Pattern:** Tap pin → (1) mini label tooltip appears above pin + (2) PeekSheet strip slides up from bottom (80px). Pull the strip up (or tap it) → DetailSheet expands to full height.

**PeekSheet** (80px, `translateY` slide-up, 200ms `ease-out`):

```
▬▬▬  (drag handle)
🌊 Flood · High · Brgy San Jose, Daet
↑ Pull up for full detail
```

**Dismiss:** Swipe PeekSheet down, or tap the map outside the sheet.

**DetailSheet** expands from peek height to full, 250ms spring. Slides over BottomNav (`z-60`).

---

## 7. DetailSheet Content

### 7.1 Mode: `'public'` — verified public incident

```
▬▬▬
🌊 Flood                     [HIGH]
📍 Barangay San Jose, Daet
   Reported 12 minutes ago

▌ Status              Dispatched       ← tonal banner, left primary accent bar

Verified by Daet MDRRMO                ← institutional attribution, no admin name

[Close]
```

No edit actions. Exact reporter identity never shown.

### 7.2 Mode: `'myReport'` — own report (Stage 3 afterglow)

```
▬▬▬
★ Your Report
🌊 Flood · Awaiting Review             ← severity shown only if classified

┌─────────────────────────────┐
│  TRACKING CODE              │        ← "the reveal" — large, selectable text
│  DAET-2026-0471  [Copy]     │
└─────────────────────────────┘

○──●──○──○──○
Received  Under Review  Verified  Dispatched  Resolved
          ↑ current

── if dispatched: ──────────────────────
●  En Route                            ← pulsing dot, tertiary-fixed background
   Response Team Dispatched
────────────────────────────────────────

[Edit]  [Cancel]                       ← if status ∈ ['new', 'awaiting_verify']
── OR ──
[Request Correction]                   ← if status ∈ ['verified','dispatched','resolved']
```

`actionsFor(status)` is a pure function — derived, never stored.

---

## 8. FilterBar

Floating glassmorphic pills, 8px below TopBar, `z-40`:

- Style: `backdrop-blur-[24px]`, `bg-surface-container-lowest/85`, `rounded-full`, ambient shadow
- Tapping a pill opens a bottom action sheet (not a dropdown)
- **Severity:** All / High / Medium / Low
- **Time window:** Last 24h / 7 days / 30 days
- Active non-default filter: pill background → `primary-container`, text → `on-primary`
- Pills disabled while offline (no new queries)

---

## 9. Empty and Offline States

**Empty state** (no incidents match current filter):

```
        (map still visible beneath)

   ┌──────────────────────────────────┐
   │  No reported incidents in this   │   ← centered card, surface-container-low
   │  area in the last 24 hours.      │
   │  [Clear filters]                 │
   └──────────────────────────────────┘
```

**Offline banner** — persistent strip above BottomNav:

```
📶 Offline — showing last known incidents
```

- Map tiles render from 24h service worker cache
- Filter pills disabled
- Pending own reports from localForage still render in `MyReportLayer` with a "⏳ Queued" label on the pin

---

## 10. Animation Rules

From the Guardian Chronicle design system — no playful motion, no bounce, no overshoot:

| Element            | Animation                                   |
| ------------------ | ------------------------------------------- |
| PeekSheet slide-up | `translateY`, 200ms, `ease-out`             |
| DetailSheet expand | 250ms spring from peek height to full       |
| Pin ripple pulse   | 2s infinite, `cubic-bezier(0.4, 0, 0.6, 1)` |
| Filter pill active | 150ms color transition                      |
| Sheet dismiss      | `translateY` down, 150ms, `ease-in`         |

---

## 11. Design System Tokens (Guardian Chronicle)

| Token                      | Value                     | Usage                         |
| -------------------------- | ------------------------- | ----------------------------- |
| `primary`                  | `#001e40`                 | TopBar, active nav, navy pins |
| `error`                    | `#ba1a1a`                 | High severity pin + ripple    |
| `secondary`                | `#a73400`                 | Medium severity pin           |
| `surface-container-lowest` | `#ffffff`                 | Filter pill base              |
| `surface-container-low`    | `#f2f4f6`                 | DetailSheet background        |
| Font headline              | Plus Jakarta Sans 700/800 | Incident type, tracking code  |
| Font body/label            | Inter 400/500/600         | Location, status, actions     |
| Border radius              | `0.125rem` (DEFAULT)      | Most elements                 |
| Border radius              | `999px` (full)            | Filter pills, severity chips  |
| Touch targets              | min 44×44px               | All interactive elements      |

**No-line rule:** No 1px borders for sectioning. Depth via tonal surface shifts only.
**Glass rule:** Filter bar and BottomNav use `backdrop-blur` glassmorphism.

---

## 12. Out of Scope

- Feed Tab, Alerts Tab, Profile Tab — stubs only in this spec
- Map tile download for offline (future enhancement, citizen role spec §Future)
- Clustering UI detail (Leaflet default cluster markers acceptable for pilot)
- Report submission flow (existing `SubmitReportForm` wired to Report tab CTA)
- Deep-linking to a specific incident via URL (deferred — no Zustand/URL state in this iteration)
