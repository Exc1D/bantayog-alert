# Provincial Superadmin Command Center — Implementation Plan

**Date:** 2026-05-08
**Spec:** `docs/superpowers/specs/2026-05-08-provincial-superadmin-redesign.md`
**Target:** `apps/admin-desktop/src/pages/ProvinceDashboardPage.tsx` + related components

---

## Overview

Transform the existing `ProvinceDashboardPage` from a generic KPI dashboard into a purpose-built command center with fixed zones, purposeful motion, and wall-display optimization.

**Estimated effort:** 3-4 days (single developer)
**Files to change:** ~8-12 files
**Breaking changes:** Yes — replaces existing `ProvinceDashboardPage` entirely

---

## Phase 1: Foundation (Day 1)

### 1.1 Design Token Setup

**File:** `apps/admin-desktop/src/styles/design-tokens.css` (new)

Create CSS custom properties for the command center palette:

- Surface colors (0-3)
- Text colors (primary, secondary, tertiary)
- Semantic colors (critical, warning, success, info)
- Map colors
- Typography scale
- Animation durations
- Touch target sizes

**Verification:** `grep` for hardcoded colors in `ProvinceDashboardPage.tsx` — should find 0 after migration.

### 1.2 Typography & Font Loading

**File:** `apps/admin-desktop/index.html`

Add Inter font loading:

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link
  href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
  rel="stylesheet"
/>
```

**File:** `apps/admin-desktop/src/index.css`

Apply `font-variant-numeric: tabular-nums` globally for numeric elements.

### 1.3 Base Layout Shell

**File:** `apps/admin-desktop/src/components/CommandCenterShell.tsx` (new)

Create the fixed zone layout container:

- Top banner (100px)
- Left zone (58%)
- Right zone (42%)
- Bottom strip (60px)
- CSS Grid or Flexbox with `position: fixed` zones
- Focus mode state management (`useState` for focused zone)

**Key decisions:**

- Use CSS Grid for main layout (responsive to viewport)
- Zones use `overflow: hidden` (content scrolls internally)
- Focus mode uses CSS `transform` for performance

---

## Phase 2: Zones (Day 1-2)

### 2.1 Top Banner

**File:** `apps/admin-desktop/src/components/TopBanner.tsx` (new)

Components:

- Province logo/seal (placeholder if no asset)
- Alert level badge with color sweep animation
- Live clock (updates every second)
- Connection status indicator (LIVE/STALE/OFFLINE)
- "Declare Alert" button with two-step confirmation modal

**Data hooks:**

- `useProvinceAlertLevel()` — subscribe to current alert level
- `useConnectionStatus()` — track Firestore connection state

### 2.2 Provincial Map (Left Zone)

**File:** `apps/admin-desktop/src/components/ProvincialMap.tsx` (new)

**Reuse:** Existing Leaflet setup from `ProvinceMapPage.tsx`

Enhancements:

- Municipality GeoJSON boundaries (need data source)
- Color-fill based on active incident count
- Incident clustering logic
- Responder dots with pulsing animation
- Heat map overlay toggle
- Legend component

**Animation:**

- Pin drop animation for new incidents (Section 8.2 of spec)
- Map pan/zoom animations (Leaflet native)

**Data hooks:**

- `useProvinceIncidents()` — real-time Firestore subscription
- `useResponderLocations()` — RTDB polling (30s)

### 2.3 Municipal Status Grid (Right Zone)

**File:** `apps/admin-desktop/src/components/MunicipalGrid.tsx` (new)

Components:

- 2-column × 6-row grid layout
- Municipal card component
- Sort controls (alphabetical, response time, active count)
- Status indicator dots

**Animation:**

- Worsening signal ripple (Section 8.5)
- Card flash on data update

**Data hooks:**

- `useMunicipalPerformance()` — 5-minute polling
- `useActiveIncidentsByMunicipality()` — derived from incident data

### 2.4 System Health Strip (Bottom)

**File:** `apps/admin-desktop/src/components/SystemHealthStrip.tsx` (new)

Components:

- 4 health indicators in a row
- Status dot with pulse animation
- Tooltip on hover/click

**Animation:**

- Gentle warning pulse (Section 8.6)
- Color transitions on status change

**Data hooks:**

- `useSystemHealth()` — 60-second polling

---

## Phase 3: Interactions & Focus Mode (Day 2)

### 3.1 Focus Mode System

**File:** `apps/admin-desktop/src/hooks/useFocusMode.ts` (new)

State management:

- `focusedZone: 'map' | 'grid' | null`
- `enterFocusMode(zone)`
- `exitFocusMode()`
- Keyboard shortcut handlers (`Alt + 1/2`)

### 3.2 Map Focus Mode

**File:** `apps/admin-desktop/src/components/MapFocusOverlay.tsx` (new)

When map is focused:

- Map expands to 100% width (minus banner/strip)
- Municipal grid becomes compact overlay (bottom-right, 350px)
- Incident list becomes slide-out panel from right

### 3.3 Grid Focus Mode

**File:** `apps/admin-desktop/src/components/GridFocusOverlay.tsx` (new)

When grid is focused:

- Grid expands to 100% width
- Map becomes inset (top-left, 450px)
- Incident list becomes inset (top-right, 450px)

### 3.4 Incident Feed Overlay

**File:** `apps/admin-desktop/src/components/IncidentFeed.tsx` (new)

Used in focus mode and as slide-out panel:

- Static list (no auto-scroll)
- New incident entry snap animation (Section 8.3)
- "Jump to newest" button
- Quick action buttons (Triage, Dispatch, View)

---

## Phase 4: Purposeful Motion (Day 3)

### 4.1 Animation Utilities

**File:** `apps/admin-desktop/src/lib/animations.ts` (new)

Helper functions:

- `usePrefersReducedMotion()` — media query hook
- `animatePinDrop()` — GSAP or Framer Motion timeline
- `animateAlertSweep()` — banner color sweep
- `animateGridRipple()` — municipal card ripple effect
- `animateCountUp()` — number counting animation

**Decision:** Use Framer Motion (already in project via `DashboardPage.tsx`) for React component animations. Use CSS animations for simple transitions. No GSAP needed — Framer Motion is sufficient.

### 4.2 Pin Drop Animation

**File:** `apps/admin-desktop/src/components/MapPin.tsx` (new)

Implementation:

- Framer Motion `motion.div` with keyframes
- `initial`, `animate`, `transition` props
- `scale`, `y`, `opacity` transforms only
- Respects `prefers-reduced-motion`

### 4.3 Alert Level Sweep

**File:** `apps/admin-desktop/src/components/AlertLevelBadge.tsx` (new)

Implementation:

- CSS `background-position` animation for color sweep
- Framer Motion `scale` for pulse
- `AnimatePresence` for enter/exit

### 4.4 Grid Ripple Effect

**File:** `apps/admin-desktop/src/components/MunicipalCard.tsx` (new)

Implementation:

- CSS Grid with `grid-row` and `grid-column`
- Calculate adjacent cells
- Staggered opacity animation with Framer Motion `staggerChildren`

---

## Phase 5: Declare Alert Flow (Day 3)

### 5.1 Alert Declaration Modal

**File:** `apps/admin-desktop/src/components/DeclareAlertModal.tsx` (new)

Steps:

1. Current level display
2. Level selector dropdown
3. Justification text area (required for Critical)
4. Impact preview (SMS count, FCM count, municipalities)
5. Confirmation:
   - Elevated: "Confirm" button
   - Critical: Type "DECLARE" + hold button 3 seconds
6. Success/error feedback

**Data hooks:**

- `useDeclareAlert()` — callable mutation
- `useAlertImpact()` — calculate affected users

### 5.2 Two-Step Confirmation

**File:** `apps/admin-desktop/src/components/HoldToConfirmButton.tsx` (new)

Reusable component:

- Hold for N seconds to activate
- Visual progress indicator (circular or linear)
- Cancel on release before threshold
- Accessible (aria-live announcement)

---

## Phase 6: Polish & Integration (Day 4)

### 6.1 Replace Existing Page

**File:** `apps/admin-desktop/src/pages/ProvinceDashboardPage.tsx`

- Replace entire page content with `<CommandCenterShell />`
- Remove old KPI cards, charts, mock data
- Keep data hooks if reusable

### 6.2 Route Updates

**File:** `apps/admin-desktop/src/routes.tsx`

- Ensure `/province/dashboard` renders new page
- Remove legacy redirect if applicable

### 6.3 Empty States

**File:** `apps/admin-desktop/src/components/EmptyStates.tsx` (new)

- Blue sky (no incidents) state for each zone
- "All clear" messaging
- Last resolved incident reference

### 6.4 Accessibility Audit

- Keyboard navigation (Tab, Enter, Escape, Alt+1/2/3)
- Screen reader testing (aria-labels, live regions)
- Color contrast verification (all combinations)
- `prefers-reduced-motion` testing
- Touch target size verification (80×80px)

### 6.5 Performance Optimization

- Lazy load map (code split)
- Memoize municipal cards
- Debounce incident updates (batched re-renders)
- Verify no layout thrashing during animations

---

## Testing Strategy

### Unit Tests

- `CommandCenterShell`: Focus mode state transitions
- `TopBanner`: Clock updates, alert level changes
- `MunicipalCard`: Status color logic, click handlers
- `useFocusMode`: Keyboard shortcuts

### Integration Tests

- Full command center render with mock data
- Focus mode activation/deactivation
- Alert declaration flow (mock callable)
- Connection status changes (mock Firestore)

### Visual Tests

- Screenshot tests for each zone at 1920×1080
- Focus mode screenshots
- Empty state screenshots
- Mobile breakpoint (1600×900)

### Accessibility Tests

- Keyboard-only navigation
- Screen reader flow
- Color contrast (automated)
- Reduced motion preference

---

## Risk Assessment

| Risk                                    | Likelihood | Impact | Mitigation                                                   |
| --------------------------------------- | ---------- | ------ | ------------------------------------------------------------ |
| Municipality GeoJSON unavailable        | Low        | High   | ✅ Data available at `src/data/municipal-boundaries.geojson` |
| Map performance with 50+ incidents      | Medium     | High   | Implement clustering, lazy loading                           |
| Firestore subscription costs            | Low        | Medium | Batch updates, debounce re-renders                           |
| Touch targets too small on wall         | Low        | High   | Verify 80×80px minimum, test on actual display               |
| Animation performance on low-end device | Medium     | Medium | Use `transform` only, test on target hardware                |

---

## Dependencies

### New (to add)

- None — Framer Motion already in project

### Existing (to use)

- `framer-motion` — Component animations
- `react-leaflet` — Map (already used)
- `@tanstack/react-query` — Data fetching
- `firebase` — Firestore, RTDB

---

## File Inventory

### New Files (~15)

1. `src/styles/design-tokens.css`
2. `src/components/CommandCenterShell.tsx`
3. `src/components/TopBanner.tsx`
4. `src/components/ProvincialMap.tsx`
5. `src/components/MunicipalGrid.tsx`
6. `src/components/MunicipalCard.tsx`
7. `src/components/SystemHealthStrip.tsx`
8. `src/components/MapFocusOverlay.tsx`
9. `src/components/GridFocusOverlay.tsx`
10. `src/components/IncidentFeed.tsx`
11. `src/components/DeclareAlertModal.tsx`
12. `src/components/HoldToConfirmButton.tsx`
13. `src/components/EmptyStates.tsx`
14. `src/hooks/useFocusMode.ts`
15. `src/lib/animations.ts`

### Modified Files (~3)

1. `src/pages/ProvinceDashboardPage.tsx` — Complete rewrite
2. `src/routes.tsx` — Verify routing
3. `index.html` — Add Inter font

---

## Milestones

| Day | Milestone                    | Verification                       |
| --- | ---------------------------- | ---------------------------------- |
| 1   | Foundation + Layout shell    | Visual inspection at 1920×1080     |
| 2   | All zones render with data   | Check data flow, no console errors |
| 3   | Focus mode + animations work | Keyboard shortcuts, reduced motion |
| 4   | Full integration + polish    | Lighthouse audit, a11y tests       |

---

## Rollback Plan

If critical issues found:

1. Revert `ProvinceDashboardPage.tsx` to previous version
2. Keep new components in repo (unused)
3. Fix issues in isolation
4. Re-deploy

**Previous version commit:** `git log --oneline apps/admin-desktop/src/pages/ProvinceDashboardPage.tsx | head -5`

---

## Next Steps

1. **Review this plan** — Any concerns or changes?
2. **Confirm municipality list** — All 12 LGUs correct?
3. **Approve Phase 1 start** — Begin with design tokens + layout shell
4. **Assign developer** — Who implements?

---

**Plan written:** 2026-05-08
**Ready for implementation:** Pending approval
