# Admin Desktop Frontend Design — Provincial Superadmin

**Project:** Bantayog Alert — Disaster Reporting Platform
**Date:** 2026-05-09
**Status:** Approved
**Supersedes:** Previous admin-desktop UI attempts
**Aligned to:** HSU Design System v1.0, Architecture Spec v8.0, Provincial Superadmin Role Spec v2.0

---

## Executive Summary

Complete frontend redesign of the Admin Desktop PWA for the Provincial Superadmin role. The design prioritizes **wall-mounted command center display** (6-10 ft viewing distance) with four core features:

1. **Living Map** — Always-visible provincial situational awareness
2. **Report Triage + Dispatch** — High-volume processing interface
3. **Declare Emergency** — High-stakes, deliberate action
4. **Analytics** — Trend analysis and municipal comparison

The interface follows the HSU (High-Signal Utility) design system: urgent, utility-first, zero-fluff. Every pixel earns its place.

---

## Design Context

### The Human

PDRRMO staff in a dimly-lit command center/war room in Daet, Camarines Norte. Viewing from 6-10 feet on a wall-mounted display. Multiple people glance at it throughout 12-hour shifts. It's the room's "truth source" — when someone asks "what's the situation?", eyes go to the wall.

### The Goal

**At-a-glance situational awareness.** In 3 seconds, anyone walking in should know:

- Are we in crisis or calm?
- Which municipalities are hurting?
- Where are the responders?
- Is the system live?

### The Feel

> "NASA mission control meets typhoon tracker. Authoritative, alive, and commanding. The kind of display that makes a war room feel like a war room."

### Design Principles (from HSU Spec)

1. **Luminance-first depth** — Surface stratification through lightness, not hue
2. **Double-encoded signals** — Color + Shape + Text for every status
3. **Adaptive density** — Card mode ≤10 items, compact row mode >10 items
4. **Data freshness heartbeat** — Desaturation at 30s staleness
5. **Observation/Action bipartite split** — Map on left, panels on right

---

## Color Palette (HSU Tokens)

```css
--hsu-canvas:
  #0a0f1e /* Main background */ --hsu-surface-1: #131b30 /* Primary containers */
    --hsu-surface-2: #1c2642 /* Active items, focused cards */ --hsu-surface-3: #263256
    /* Hover states, popovers */ --hsu-border: #3b4b7a /* High-contrast boundaries */
    /* Semantic Signals (Double-Encoded) */ --hsu-crit: #ef4444 /* CRITICAL + Triangle */
    --hsu-warn: #f59e0b /* WARNING + Diamond */ --hsu-norm: #10b981 /* NORMAL + Circle */
    --hsu-info: #3b82f6 /* INFO + Info icon */ /* Typography */ --hsu-font-primary: 'Inter',
  system-ui, sans-serif --hsu-font-telemetry: 'JetBrains Mono', monospace;
```

---

## Typography Strategy

### Bifurcated Approach

| Use Case           | Typeface   | Rationale                                     |
| ------------------ | ---------- | --------------------------------------------- |
| Human-readable     | Inter      | Optimized for rapid scanning, 1.5 line-height |
| System telemetry   | JetBrains  | Tabular numbers, monospace for alignment      |
| Room-scale headers | Inter Bold | Large, tight tracking, high luminance         |

### Size Scale (6-10 ft viewing)

| Element             | Size | Weight  | Letter-spacing |
| ------------------- | ---- | ------- | -------------- |
| Page heading        | 52px | Bold    | -0.02em        |
| Section heading     | 40px | Bold    | -0.01em        |
| Data value (hero)   | 64px | Bold    | 0              |
| Data value (normal) | 32px | Medium  | 0              |
| Body text           | 18px | Regular | 0              |
| Label (uppercase)   | 16px | Medium  | +0.05em        |

---

## Component Architecture

### 1. The Living Map (Background Stage)

The map is always visible, taking 60% of screen area. It's not a widget — it's the stage everything else performs on.

**Visual Design:**

- Provincial outline of Camarines Norte
- 12 municipal boundaries (glow amber at threshold)
- Incident pins with severity colors
- Responder locations (live GPS)
- Heatmap overlay (toggleable)
- Resource depot icons

**Pin Design:**

```
📍 Normal incident    — Green circle, 24px
🔴 Critical incident   — Red triangle, 32px (larger)
🟡 High severity       — Amber diamond, 28px
🚒 Responder unit      — Blue truck icon, 20px
○  Resource depot      — White circle, 16px
```

**Animation:**

- Pins pulse gently (2s cycle, 10% opacity range)
- Municipal borders glow for 5s when threshold crossed
- New incidents drop-in with spring animation (300ms)

**Controls (floating, translucent):**

```
[Layers ▼] [Heatmap] [Responders] [Critical Only] [Fullscreen]
```

---

### 2. Report Triage + Dispatch (Primary Workflow)

High-volume table layout optimized for keyboard operation.

**Triage Queue Table:**

| Column    | Width | Content                                       |
| --------- | ----- | --------------------------------------------- |
| LOCATION  | 30%   | Municipality + Barangay + Map link            |
| TYPE      | 15%   | Report type icon + label                      |
| SUBMITTED | 15%   | Relative time (2m ago) + attachment indicator |
| SEVERITY  | 15%   | Left border color + badge                     |
| ACTION    | 25%   | [Verify] [Dispatch] [Reject] buttons          |

**Row Design:**

- Left border indicates severity (4px solid) — PRIMARY signal
- Critical rows have red background tint (`rgba(239, 68, 68, 0.25)`) for visibility at 6-10ft
- Hover: full row brightens to `hsu-surface-2` (secondary for desktop users)
- Focus: 2px solid `--hsu-info` border around entire row

**Compact Mode (auto-triggers at 11 items):**

- Single-line rows
- Remove description preview
- Prioritize: Status → ID → Location → Time

**Keyboard Shortcuts:**
| Key | Action |
| ----------- | -------------------------- |
| Arrow keys | Navigate rows |
| Enter | Dispatch selected |
| Space | Verify selected |
| Delete | Reject selected |
| Escape | Clear selection / Close panel (focus returns to trigger) |
| Alt+T | Focus triage queue |

**Focus Management:**

- Opening a panel/sliding drawer: Focus moves to first interactive element
- Closing with Escape: Focus returns to the button that opened it
- Modal closes: Focus returns to "Declare" button in TopBanner
- Map pins: Receive 2px solid `--hsu-info` focus ring when keyboard navigated

**Dispatch Panel (slides in from right, 450px):**

```
┌─────────────────────────────────────┐
│ Incident: rep_abc123 · FLOOD        │
│ ─────────────────────────────────── │
│ AVAILABLE RESPONDERS (12/15)        │
│ ┌─────────────────────────────┐   │
│ │ AGENCY    │ UNIT  │ STATUS  │   │
│ ├───────────┼───────┼─────────┤   │
│ │ 🔥BFP Daet│ TRUCK-1│ READY   │   │
│ │ 🔥BFP Daet│ TRUCK-2│ READY   │   │
│ │ 🏥RHU Daet│ MED-1  │ ON-DIS  │   │
│ └───────────┴───────┴─────────┘   │
│ [Select Multiple] [Dispatch All]  │
└─────────────────────────────────────┘
```

---

### 3. Declare Emergency (High-Stakes Modal)

Separate modal that forces deliberation. Not quick-access.

**Modal Layout:**

```
┌─────────────────────────────────────────────────────────────┐
│ ⚠️  DECLARE PROVINCIAL EMERGENCY                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ This action will IMMEDIATELY alert all staff and citizens.  │
│ This cannot be undone.                                      │
│                                                             │
│ Emergency Type:            [Select ▼]                       │
│ ○ Warning                  ○ Emergency                      │
│                                                             │
│ Affected Municipalities:                                    │
│ [☑ All 12]  [☑ Daet]  [☑ Labo]  [☑ Capalonga] ...          │
│                                                             │
│ Declaration Text:                                           │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │                                                         │ │
│ │  Typhoon signal #2 raised. All coastal residents       │ │
│ │  should evacuate immediately. Proceed to evacuation   │ │
│ │  centers.                                              │ │
│ │                                                         │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ Estimated Affected: ~180,000 people                         │
│                                                             │
│ [Cancel]                   [CONFIRM DECLARATION]            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Confirmation Flow:**

1. User fills form and clicks [CONFIRM]
2. Modal shows TOTP input
3. User enters TOTP code
4. **Second confirmation** with impact summary
5. Emergency declared

**Visual Design:**

- Modal has red border (`--hsu-crit`, 4px) — PRIMARY danger signal
- Modal background: light red tint (`rgba(239, 68, 68, 0.08)`) — NOT full red wash
- Confirm button: solid `--hsu-crit` with white text (passes WCAG AA)
- Warning banner: red background with white text at top
- Population estimate prominently displayed in large type
- Focus trap: Tab cycles through form elements; Escape closes (focus returns to "Declare" button)

---

### 4. Analytics Dashboard

Side panel (450px) with trend charts and comparisons.

**Panel Contents:**

```
┌─────────────────────────────────────────────┐
│ 📊 ANALYTICS          [Last 7 Days ▼] [Export]│
├─────────────────────────────────────────────┤
│                                             │
│ ┌─────────┐  ┌─────────┐  ┌─────────┐       │
│ │ INCIDENT│  │ RESPONSE│  │ RESOURCE│       │
│ │ VOLUME  │  │ TIME    │  │ UTIL    │       │
│ │         │  │         │  │         │       │
│ │ [chart] │  │ [chart] │  │ [chart] │       │
│ │ 47 avg  │  │ 12m avg │  │ 72%     │       │
│ │ ▲ 23%   │  │ ▼ 8%    │  │ ⚠️ Near │       │
│ └─────────┘  └─────────┘  └─────────┘       │
│                                             │
│ Municipal Comparison (Radar Chart)          │
│ [radar chart showing 12 municipalities]     │
│                                             │
│ [Trend Analysis] [Drill-down] [History]     │
└─────────────────────────────────────────────┘
```

**Chart Design:**

- Line charts for trends over time
- Bar charts for comparisons
- Radar chart for municipal comparison
- All charts use HSU color palette
- Trend indicators (▲▼) with percentage change
- Sparklines for quick scanning

---

## Unified Layout Structure

### Full Command Center Display

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  🏛️ PDRRMO CAMARINES NORTE                     [LIVE ●] [❄️ Freeze] [⚠️ DECLARE]    │
│  Province-wide situational awareness · Updated 5s ago                                        │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│  [Map] [Triage] [Analytics]                                                                    │
│                                                                                          │
│  ┌────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                                                                                    │ │
│  │                      THE LIVING MAP (always background)                            │ │
│  │                                                                                    │ │
│  │     12 municipalities · Incident pins · Responder locations · Heatmap            │ │
│  │                                                                                    │ │
│  └────────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                          │
│  ┌─────────────────────┐ ┌─────────────────────┐ ┌─────────────────────────────────┐ │
│  │  ACTIVE INCIDENTS   │ │  RESPONDERS STATUS  │ │  SYSTEM HEALTH                   │ │
│  │       47 🔴         │ │   156/203 🟢        │ │  Firestore 🟢 · RTDB 🟢          │ │
│  │                     │ │                     │ │  SMS 🟡 · FCM 🟢                │ │
│  └─────────────────────┘ └─────────────────────┘ └─────────────────────────────────┘ │
│                                                                                          │
│  ┌────────────────────────────────────────────────────────────────────────────────────┐ │
│  │  MUNICIPAL STATUS GRID (static — all 12 visible at once)                           │ │
│  │  ┌───────────┬───────────┬───────────┬───────────┐                                 │ │
│  │  │ Daet:🟢   │ Labo:🟡  │ Capalonga:🔴│ Paracale:🟢│ ...                           │ │
│  │  └───────────┴───────────┴───────────┴───────────┘                                 │ │
│  └────────────────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### Sliding Panels (Right Side, 450px)

| Panel        | Trigger           | Content                 | Map Behavior                                    |
| ------------ | ----------------- | ----------------------- | ----------------------------------------------- |
| Triage Queue | Default view      | Pending reports table   | Compresses to 40%                               |
| Dispatch     | Click [Dispatch]  | Responder selection     | Semi-transparent overlay (never fully obscured) |
| Analytics    | Click [Analytics] | Charts and trends       | Compresses to 40%                               |
| User Mgmt    | Click [Users]     | CRUD for admin accounts | Full overlay                                    |
| Audit Log    | Click [Audit]     | Activity history        | Full overlay                                    |

**Note:** Map visibility is preserved during Triage, Dispatch, and Analytics operations. The map is the primary situational awareness tool and should never be fully hidden during active incident response.

---

## Animation & Motion

### Micro-interactions

| Element          | Animation                         | Duration |
| ---------------- | --------------------------------- | -------- |
| Incident pin     | Gentle pulse (opacity 100% → 90%) | 2s loop  |
| New incident     | Drop-in with spring               | 300ms    |
| Threshold breach | Border flare + pulse              | 5s then  |
| Panel slide-in   | Ease-out from right               | 200ms    |
| Status change    | Background flash                  | 500ms    |
| Stale data       | Desaturate to 50%                 | 1s       |

### Principles

- All transitions ≤200ms for responsiveness
- No bounce effects in professional interface
- Deceleration easing (`cubic-bezier(0.4, 0, 0.2, 1)`)
- `prefers-reduced-motion` respected

---

## System States

### Loading States

| Component        | Loading Indicator                          | Notes                           |
| ---------------- | ------------------------------------------ | ------------------------------- |
| Triage queue     | Skeleton rows (4-6) with pulse animation   | Maintains layout stability      |
| Map pins         | Pins appear incrementally (stagger 50ms)   | OR show "Loading map..." badge  |
| Analytics charts | Sparkline skeleton + gray placeholder bars | Data labels visible during load |
| Dispatch panel   | Spinner + "Loading responders..." text     | Centered in panel               |
| Municipal grid   | Gray pills with subtle shimmer effect      | 12 pills, all same size         |

### Error States

| Component              | Error Display                             | Recovery Action                     |
| ---------------------- | ----------------------------------------- | ----------------------------------- |
| Firestore/RTDB failure | Red banner top: "Connection lost" + retry | Auto-retry with exponential backoff |
| Map tile failure       | Gray tiles + "Map unavailable" overlay    | Continue with triage queue          |
| Analytics failure      | Error card: "Analytics unavailable"       | Hide panel, retain map access       |
| Callable timeout       | Toast notification + retry button         | User-initiated retry                |

### Empty States

| Component              | Empty Display                           |
| ---------------------- | --------------------------------------- |
| Triage queue (0 items) | "No active incidents" + green checkmark |
| Map (0 pins)           | Semi-transparent overlay: "All Clear"   |
| Analytics (no data)    | "No data for selected time range"       |
| Dispatch panel         | "No responders available" + amber badge |

### Stale Data Indicator

Data is considered stale after 30 seconds without updates. Visual treatment:

- **Desaturation:** Colors fade to 50% saturation
- **Badge:** "STALE AS OF [timestamp]" appears in top-right
- **Animation:** All pulse animations stop
- **Recovery:** Returns to normal when fresh data arrives

---

## Freeze Display Mode

Command centers need to brief incoming staff without live updates causing distraction.

**Trigger:** "Freeze Display" button in TopBanner (icon: ❄️ + label)

**When Frozen:**

- All Firestore/RTDB subscriptions pause
- Live indicator changes: "LIVE ●" → "FROZEN ❄️ AS OF [timestamp]"
- Map pin pulse animations stop
- Triage queue updates stop
- Visual indicator: semi-transparent blue overlay on entire display (10% opacity)

**Resume:** Click "Resume Live" button (replaces Freeze button)

**Use Case:** Staff briefing, screenshot capture, incident review

---

## Accessibility

### WCAG AA Compliance

- Color contrast ≥4.5:1 for all text
- Color contrast ≥3:1 for large text (≥18px)
- All interactive elements have focus indicator
- Keyboard navigation complete
- Screen reader announcements for status changes

### Focus Management

- Focus visible: 2px solid `--hsu-info` border around focused element
- Focus traps in modals (Tab cycles within modal, Escape closes)
- Focus returns to trigger after modal/panel close
- Map pins: Receive 2px solid `--hsu-info` focus ring when keyboard navigated
- Skip-to-content link (hidden until focused) jumps to map zone
- Panel slide-in: Focus moves to first interactive element
- Panel Escape: Returns focus to button that opened the panel

---

## Responsive Behavior

### Desktop (1920×1080) — Primary Target

Full layout as designed above. Optimal for command center displays.

### Tablet (1024×768) — Field Mode

- Map takes 100% width (no side panel)
- Panels slide up from bottom (500px)
- Typography scaled to 0.85x

### Mobile (<768px) — Not Supported

Shows "Please use a desktop or tablet" message with link to Citizen PWA.

---

## Technical Specifications

### Platform

- **Build:** Vite + React 18
- **Styling:** CSS Modules + design tokens
- **State:** Zustand (UI ephemeral) + Firestore SDK (server cache)
- **Maps:** Leaflet + OSM tiles
- **Fonts:** Inter (Google Fonts) + JetBrains Mono

### Performance Budgets

- Initial load: <5s p95
- First Contentful Paint: <2s
- Map with 50 pins + 30 responders: 30fps pan/zoom
- Triage queue (47 items): <2s first render

### Offline Behavior

Admin Desktop has **no offline write queue**. All mutations require connectivity. When offline:

- Show "CONNECTION LOST" banner
- Disable all mutation buttons
- Read-only mode: can view but not act

---

## Deferred Features (Out of Scope)

These features are acknowledged in the role spec but **deferred to future work**:

- NDRRMC escalation workflow
- Break-glass protocol
- Data subject erasure approvals
- BigQuery audit access
- Mutual-aid authorization
- Shift handoff UI

These will be designed as separate follow-up specs.

---

## Design Tokens Reference

All visual decisions map to HSU design tokens. No arbitrary values.

```css
/* Surfaces */
--hsu-canvas:
  #0a0f1e --hsu-surface-1: #131b30 --hsu-surface-2: #1c2642 --hsu-surface-3: #263256
    --hsu-border: #3b4b7a /* Semantic */ --hsu-crit: #ef4444 --hsu-warn: #f59e0b --hsu-norm: #10b981
    --hsu-info: #3b82f6 /* Typography */ --hsu-font-primary: 'Inter',
  system-ui, sans-serif --hsu-font-telemetry: 'JetBrains Mono', monospace;
```

---

## Success Criteria

Per Architecture Spec §18, the Admin Desktop is validated against:

1. **Triage throughput:** 47 reports processed in <5 minutes
2. **Dispatch latency:** From report to dispatch assignment <2 minutes
3. **Map performance:** 50 pins + 30 markers at 30fps
4. **Anomaly detection:** Threshold breach visible within 5 seconds
5. **Declaration accuracy:** Zero false emergency declarations in pilot

---

## Sources

Design informed by:

- [Emergency Operations Center Design Best Practices](https://www.cti.com/core-design-principles-for-eocs/)
- [FEMA EOC Quick Reference Guide](https://www.fema.gov/sites/default/files/documents/fema_eoc-quick-reference-guide.pdf)
- [FDNY Computerized Triage Software](https://www.fdnypro.org/fdny-computerized-triage-software/)
- [UMass E-Triage Research](https://scholarworks.umass.edu/)
- [Bureau of Justice Assistance CAD Guidelines](https://bja.ojp.gov/)

---

## Version History

| Version | Date       | Changes                                                                                                            |
| ------- | ---------- | ------------------------------------------------------------------------------------------------------------------ |
| 1.1     | 2026-05-09 | UI review fixes: modal contrast, row visibility, static municipal grid, system states, freeze display, focus paths |
| 1.0     | 2026-05-09 | Initial design — wall-mounted command center                                                                       |

---

## Next Steps

This design document serves as the specification for the implementation plan. The following work will proceed via the `writing-plans` skill to create a detailed implementation plan with:

- File-by-file breakdown
- Component hierarchy
- Data flow diagrams
- Testing strategy
- Rollout phases

---

**Document Status:** Approved for implementation planning
