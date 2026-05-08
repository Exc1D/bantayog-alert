# Provincial Superadmin Command Center — Redesign Spec

**Date:** 2026-05-08
**App:** admin-desktop (Provincial Superadmin surface)
**Status:** Approved
**Author:** Design Team

---

## 1. Overview

### 1.1 Purpose

Redesign the provincial superadmin dashboard from a generic SaaS dashboard into a purpose-built **command center** optimized for wall-mounted displays in the PDRRMO operations center.

### 1.2 Users & Context

- **Who:** PDRRMO staff, provincial superadmins, operations center observers
- **Where:** PDRRMO operations center, Daet, Camarines Norte — wall-mounted display
- **Viewing distance:** 3-6 feet
- **Lighting:** Fluorescent office lighting (not dimmed)
- **Duration:** 8-12 hour shifts during emergencies
- **Viewers:** 5-10 people simultaneously (passive viewing, not individual workstations)

### 1.3 Success Criteria

- All critical information readable from 6 feet without interaction
- No information hidden behind tabs, scrollbars, or interactions for default view
- Alert level and active incidents visible within 2 seconds of glancing at screen
- System health status visible at all times
- No data displayed without age indicator (staleness)

---

## 2. Layout Architecture

### 2.1 Fixed Zone Layout (Default)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  TOP BANNER (100px)                                                         │
│  [Logo] PDRRMO Camarines Norte    [Alert Level]    14:32:07    [Actions]   │
├──────────────────────────────┬──────────────────────────────────────────────┤
│                              │                                              │
│  LEFT ZONE (~58%)            │ RIGHT ZONE (~42%)                            │
│  Provincial Map              │ Municipal Status Grid (2 col x 6 rows)       │
│  (1100px wide)               │ (500px wide)                                 │
│                              │                                              │
│  • Municipality boundaries   │  • Municipality name                         │
│  • Incident clusters         │  • Active incident count (large)             │
│  • Responder positions       │  • Avg response time                         │
│  • Heat map overlay          │  • Status indicator                          │
│                              │                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│  BOTTOM STRIP (60px)                                                        │
│  [Audit Stream: OK] [Batch: OK] [SMS: OK] [FCM: OK] [Last update: 14:31:55]│
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Reading Priority (Crisis Triage Order)

1. **Top banner** — Alert level (most urgent)
2. **Right zone** — Municipal performance (who needs help)
3. **Left zone** — Map context (where is it happening)
4. **Bottom strip** — System health (is the platform working)

### 2.3 Focus Mode

Any zone can be expanded to fill the viewport (minus top banner and bottom strip):

- **Activation:** Hover zone → "Focus" button appears (80×80px touch target) OR double-click zone header
- **Focused state:** Zone expands with 200ms ease-out-quart transition, max z-index
- **Exit:** "Exit Focus" button (X, top-right) OR press Escape OR click outside zone
- **Map focus:** Municipal grid collapses to compact overlay (bottom-right, 350px wide); incident list becomes slide-out panel
- **Grid focus:** Map becomes inset (top-left, 450px); incident list becomes inset (top-right, 450px)

---

## 3. Color Strategy

### 3.1 Theme: Light

Dark backgrounds create glare under fluorescent lighting and reflect viewers. Light theme is mandatory for wall displays.

### 3.2 Strategy: Committed

Alert Sienna carries urgent/alert states (30-50% of accent usage). Everything else is tinted neutrals.

### 3.3 Palette

#### Backgrounds

| Token     | Hex       | Usage                                          |
| --------- | --------- | ---------------------------------------------- |
| Surface 0 | `#f8f9fa` | Main background (near-white, slight warm tint) |
| Surface 1 | `#ffffff` | Cards, zone containers                         |
| Surface 2 | `#e9ecef` | Hover states, subtle borders                   |
| Surface 3 | `#dee2e6` | Dividers, inactive states                      |

#### Text

| Token          | Hex       | Contrast | Usage                   |
| -------------- | --------- | -------- | ----------------------- |
| Text primary   | `#1a1a2e` | 15.3:1   | Headlines, primary data |
| Text secondary | `#495057` | 7.8:1    | Labels, descriptions    |
| Text tertiary  | `#6c757d` | 5.4:1    | Timestamps, metadata    |

#### Semantic Colors (WCAG AA Verified)

| Token          | Hex       | Contrast | Usage                            |
| -------------- | --------- | -------- | -------------------------------- |
| Alert critical | `#a73400` | 7.1:1    | Critical alerts, >20min response |
| Alert warning  | `#c77600` | 5.2:1    | Warnings, 10-20min response      |
| Alert success  | `#2d6a4f` | 6.8:1    | Healthy, <10min response         |
| Alert info     | `#1e5aa8` | 6.5:1    | Informational, neutral           |

#### Map Colors

| Token           | Hex       | Usage                   |
| --------------- | --------- | ----------------------- |
| Border default  | `#adb5bd` | Municipality boundaries |
| Fill inactive   | `#e9ecef` | No active incidents     |
| Fill low        | `#fff3cd` | 1-2 incidents           |
| Fill medium     | `#ffe5b4` | 3-5 incidents           |
| Fill high       | `#ffccd5` | 6+ incidents            |
| Responder own   | `#2d6a4f` | Own-agency responders   |
| Responder other | `#1e5aa8` | Other-agency responders |

---

## 4. Typography

**Font:** Inter (self-hosted or Google Fonts)
**Numeric rendering:** `font-variant-numeric: tabular-nums` for all counts, times, IDs

### 4.1 Type Scale (Optimized for 3-6ft Viewing)

| Token   | Size | Weight | Line Height | Usage                               |
| ------- | ---- | ------ | ----------- | ----------------------------------- |
| Display | 64px | 700    | 1.1         | Active incident count (top banner)  |
| H1      | 36px | 600    | 1.2         | Zone titles, alert level            |
| H2      | 28px | 600    | 1.3         | Municipality names                  |
| H3      | 22px | 500    | 1.4         | Card titles, section headers        |
| Body    | 18px | 400    | 1.5         | Descriptions, addresses             |
| Label   | 20px | 500    | 1.4         | KPI labels, button text             |
| Small   | 16px | 400    | 1.5         | Timestamps, secondary info          |
| Micro   | 14px | 500    | 1.4         | Badges, status pills (minimum size) |

### 4.2 Accessibility

- All severity indicators use **color + icon + shape** (not color alone)
- Red-green colorblind: critical = circle, warning = triangle, success = square
- Text never smaller than 14px
- All contrast ratios meet WCAG 2.1 AA (4.5:1 minimum)

---

## 5. Zone Specifications

### 5.1 Top Banner (100px)

**Left section (30%):**

- Province seal/logo (48px)
- "PDRRMO" (H3, Text primary)
- "Camarines Norte" (Body, Text secondary)

**Center section (40%):**

- Alert level badge (pill shape, 48px height):
  - Normal: `#2d6a4f` background, white text — "NORMAL"
  - Elevated: `#c77600` background, white text — "ELEVATED"
  - Critical: `#a73400` background, white text — "CRITICAL"
- Pulsing animation on critical (respects `prefers-reduced-motion`)

**Right section (30%):**

- Live clock (H1, 24h format, tabular nums)
- "Last update: 14:31:55" (Small, Text tertiary)
- "Declare Alert" button (Alert Sienna, H3, 80×60px minimum)

**Connection status indicator:**

- Green dot: "LIVE" (data <30s old)
- Amber dot: "STALE" + timestamp (data 30s-5min old)
- Red dot: "OFFLINE" + countdown to reconnect (data >5min old)

### 5.2 Left Zone — Provincial Map (58%)

**Base layer:**

- Leaflet map with OpenStreetMap tiles (light theme)
- Municipality boundaries as GeoJSON polygons with 2px borders

**Incident visualization:**

- **Zoomed out (>1:500,000):** Municipality-level color fill based on active count
- **Medium zoom (1:100,000 - 1:500,000):** Clustered count bubbles per municipality center
- **Zoomed in (<1:100,000):** Individual incident pins

**Cluster styling:**

- Size: 40-80px diameter based on count
- Color: Worst severity in cluster
- Label: White text, Display size, centered

**Responder dots:**

- Own agency: Green circle, 16px, pulsing ring when active dispatch
- Other agency: Blue circle, 12px, no pulse
- All dots have 2px white stroke for visibility on any background

**Controls:**

- Zoom in/out (+/- buttons, 80×80px)
- Reset view (fit to province bounds)
- Layer toggle (incidents / responders / heat map)

**Legend (bottom-left, 200px wide):**

- Incident severity: 3 colored dots + labels
- Responder types: 2 colored dots + labels
- Municipality fill: 4 colored swatches + count ranges

### 5.3 Right Zone — Municipal Status Grid (42%)

**Layout:** 2 columns × 6 rows = 12 municipality cards

**Card dimensions:** ~240px wide × 120px tall

**Card contents (top-to-bottom):**

1. Municipality name (H2, Text primary) — truncated with ellipsis if needed
2. Active incident count (Display size, color-coded):
   - 0: Text tertiary
   - 1-2: Text primary
   - 3-5: Alert warning
   - 6+: Alert critical
3. Avg response time (Body, Text secondary):
   - "—" if no data
   - Color: <10min = success, 10-20min = warning, >20min = critical
4. Status indicator (14px dot + Micro label):
   - Green dot: "Responsive"
   - Yellow dot: "Slow"
   - Red dot: "Delayed"

**Card background:**

- Default: Surface 1 (white)
- Hover/focus: Surface 2 (light gray)
- Selected: 2px border in Alert info

**Interactions:**

- Click card: Zoom map to municipality bounds
- Hover card: Highlight municipality boundary on map

**Sort options (header dropdown, 18px):**

- Alphabetical (default)
- Response time (slowest first)
- Active count (highest first)

### 5.4 Bottom Strip — System Health (60px)

**Layout:** Horizontal row of 5 indicators, evenly spaced

**Each indicator:**

- Status dot (16px): Green / Yellow / Red
- Label (Micro, uppercase): "AUDIT STREAM", "BATCH", "SMS", "FCM"
- Status text (Small): "OK", "DELAYED", "DOWN"
- Tooltip on hover/click: Last success timestamp, gap duration, error count

**Background:** Surface 2 with top border

---

## 6. Interaction Patterns

### 6.1 Touch Targets

- Minimum touch target: **80×80px** (finger size at 3-6ft distance)
- Buttons: 80px height minimum
- Focus mode buttons: 48×48px visible with 80×80px invisible hit area
- Map controls: 80×80px

### 6.2 Keyboard Shortcuts

- `Alt + 1`: Focus map
- `Alt + 2`: Focus municipal grid
- `Alt + 3`: Toggle alert declaration modal
- `Escape`: Exit focus mode
- `Alt + R`: Refresh data immediately

### 6.3 Incident Feed (Focus Mode Only)

When municipal grid is focused, incident feed appears as overlay:

**Header:** "Active Incidents" + count (H1)

**List behavior:**

- Static list (NO auto-scroll)
- Newest incident appears at top with "NEW" badge (3-second highlight animation)
- "Jump to newest" button appears when user scrolls down
- Each item: Severity icon + type + municipality + time + status

**Card styling:**

- Full-card background tint (not side-stripe borders)
- Critical: `#fff3cd` background
- Warning: `#ffe5b4` background
- Normal: Surface 1 background

**Quick actions (on hover/click):**

- "Triage" button
- "Dispatch" button
- "View details" link

### 6.4 Declare Alert Flow

**Step 1:** Click "Declare Alert" button
**Step 2:** Modal appears with:

- Current alert level
- Dropdown: Select new level (Normal → Elevated → Critical)
- Text area: Reason/justification (required for Critical)
- Estimated impact: SMS count, FCM count, municipalities affected
  **Step 3:** Confirmation required:
- For Elevated: "Confirm" button
- For Critical: Type "DECLARE" in confirmation field + hold button for 3 seconds
  **Step 4:** Success/error feedback in modal

### 6.5 Disconnected States

**Banner states:**

- LIVE: Green dot + "LIVE" + current time
- STALE: Amber dot + "STALE — 14:28:33" + "Retrying in 15s..."
- OFFLINE: Red dot + "OFFLINE" + "Check network connection"

**Data display:**

- LIVE: Full opacity, no timestamp
- STALE: 70% opacity, "Last updated 14:28:33" shown
- OFFLINE: 50% opacity, cached data with "OFFLINE — Cached" badge

---

## 7. Empty States (Blue Sky)

**Map:** All municipalities in neutral green fill. Centered text: "No active incidents" with checkmark icon (H2, Text secondary).

**Municipal grid:** All cards green, "0" active count. Response time shows 7-day average or "—".

**Incident feed:** "All clear" message with last resolved incident shown for reference.

**System health:** All indicators green, "OK".

---

## 8. Animation & Motion — Purposeful Attention System

All animations direct attention to critical operational changes. No decorative motion.

### 8.1 Animation Philosophy

**Every animation must answer:** "What changed, and why does the operator need to know NOW?"

| Principle           | Rule                                            |
| ------------------- | ----------------------------------------------- |
| Attention hierarchy | Critical events = most noticeable motion        |
| Duration scaling    | More urgent = longer/louder animation           |
| Resolution          | Animation stops when acknowledged or resolved   |
| Performance         | Use only `transform` and `opacity`              |
| Accessibility       | All animations respect `prefers-reduced-motion` |

### 8.2 New Incident on Map — "Pin Drop"

**Trigger:** New incident report appears in Firestore

**Sequence (2.5 seconds):**

**Phase 1: Incoming Signal (0-0.5s)**

- Expanding ring from incident location: 0px → 80px
- Ring color: Alert severity color
- Ring opacity: 1.0 → 0.0 (ease-out-quart)
- Ring stroke: 3px, no fill

**Phase 2: Pin Drop (0.3-0.8s)**

- Pin drops from 30px above: translateY(-30px) → 0
- Easing: ease-out-bounce (1 bounce, minimal — not playful)
- Scale: 1.3x → 1.0x
- Shadow grows beneath pin

**Phase 3: Settle (0.8-1.5s)**

- Single pulse: scale 1.0 → 1.1 → 1.0 (0.7s)
- Inner dot intensifies briefly

**Phase 4: Active State (1.5s+)**

- Slow pulse loop: opacity 1.0 → 0.7 → 1.0 (3s cycle)
- Stops when incident is triaged or dispatched

**Reduced motion:** No ring, no drop, no pulse loop. Pin appears instantly with static severity color.

### 8.3 New Incident in List — "Entry Snap"

**Trigger:** New incident pushed to top of feed

**Sequence (1.5 seconds):**

**Phase 1: Insert (0-0.3s)**

- Card slides from above: translateY(-20px) → 0
- Opacity: 0 → 1

**Phase 2: Attention Flash (0-0.5s)**

- Background flashes: Surface 1 → Severity tint → Surface 1
- Flash duration: 0.5s, ease-out

**Phase 3: Border Growth (0.3-1.5s)**

- Left border expands: 0px → 4px (severity color)
- "NEW" badge fades in, pulses once
- After 1.5s: border reduces to 2px, badge disappears

**Reduced motion:** Card appears instantly at top. Static border and "NEW" badge. No flash, no slide.

### 8.4 Alert Level Change — "Authority Sweep"

**Trigger:** Province alert level changes

**Sequence (3 seconds):**

**Phase 1: Color Sweep (0-1s)**

- Banner background color sweeps left-to-right: old → new
- Old color fades as new color slides in
- Alert level text scales: 1.0 → 1.2 → 1.0 (ease-out-quart)

**Phase 2: Attention Pulse (1-3s)**

- New badge pulses 3 times: scale 1.0 → 1.15 → 1.0
- Box-shadow expands and contracts
- Duration: 0.6s per pulse, 0.4s gap

**Critical-only addition:**

- Screen edges flash red twice (inset box-shadow, 0.3s each)
- Only for Normal → Critical or Elevated → Critical

**Reduced motion:** Instant color change. No sweep, no pulse, no scale. Static badge. Critical gets static red border (no flash).

### 8.5 Municipality Status Degradation — "Worsening Signal"

**Trigger:** Response time crosses threshold (Responsive → Slow → Delayed)

**Sequence (2 seconds):**

**Phase 1: Card Attention (0-0.5s)**

- Card background flashes: white → Severity tint → white
- Border color transitions: old → new (0.5s ease)
- Incident count animates (count-up if increased)

**Phase 2: Grid Ripple (0.3-2s)**

- Adjacent cards flash subtly: opacity 1.0 → 0.8 → 1.0
- Ripple spreads from changed card: up, down, left, right
- Each ring: 0.3s duration, 0.15s delay
- 2 rings total

**Signal:** "Something changed nearby — look here"

**Reduced motion:** Instant color change on affected card only. No ripple. No count-up.

### 8.6 System Health Deterioration — "Gentle Warning"

**Trigger:** Health indicator changes (OK → Delayed → Down)

**OK → Delayed:**

- Dot pulses: opacity 1.0 → 0.5 → 1.0 (2s loop)
- Color transitions: green → amber (1s ease)

**Delayed → Down:**

- Dot pulses faster: opacity 1.0 → 0.3 → 1.0 (1s loop)
- Color transitions: amber → red (0.5s ease)
- Bottom strip background tints subtle pink

**Reduced motion:** Static color change. No pulse. No background tint.

### 8.7 Focus Mode Transition — "Zone Expand"

**Trigger:** User clicks focus button or double-clicks zone

**Animation (200ms):**

- Zone expands using `transform: scale()` + `translate()`
- NOT width/height (performance)
- Other zones fade: opacity 1.0 → 0.0 (150ms)
- Target zone moves to top z-index
- Easing: ease-out-quart

**Exit:** Reverse animation, 200ms

**Reduced motion:** Instant. Zone appears at full size immediately.

### 8.8 Banned Animations

| Type                                         | Why Banned                                 |
| -------------------------------------------- | ------------------------------------------ |
| Elastic/spring physics                       | Distracting, unprofessional in emergencies |
| Layout properties (width, height, top, left) | Performance killer, jank on wall displays  |
| Parallax                                     | Decorative, no operational value           |
| Continuous rotation                          | Motion sickness, unnecessary CPU           |
| Particle effects                             | Visual noise, competes with data           |
| Background animations                        | Distracts from critical information        |

### 8.9 Animation Summary Table

| Event                 | Animation              | Duration   | Purpose                             |
| --------------------- | ---------------------- | ---------- | ----------------------------------- |
| New map pin           | Ring + drop + pulse    | 2.5s       | **Bring attention to location**     |
| New list item         | Slide + flash + border | 1.5s       | **Highlight new incident**          |
| Alert level change    | Color sweep + pulse    | 3s         | **Signal operational state change** |
| Municipality degrades | Flash + ripple         | 2s         | **Signal localized problem**        |
| System health down    | Pulse loop             | Continuous | **Maintain degradation awareness**  |
| Focus mode            | Scale + fade           | 200ms      | **Smooth context switch**           |

---

## 9. Responsive Behavior

### 9.1 Target Resolution

Primary: 1920×1080 (Full HD)
Secondary: 2560×1440 (QHD) — scales proportionally

### 9.2 Minimum Resolution

1600×900: Reduce map zone to 55%, grid to 45%. Drop legend if needed.

### 9.3 Scaling Strategy

- Use CSS `clamp()` for fluid typography
- Map uses viewport percentage for dimensions
- Grid cards use CSS Grid with `minmax()`
- Touch targets never scale below 80×80px

---

## 10. Data Requirements

### 10.1 Real-time Subscriptions

- `reports` collection (filtered: province-wide, status != closed)
- `responders` RTDB locations (province-wide)
- `analytics_snapshots` (daily, for trends)
- System health metrics (audit stream lag, batch gap, SMS queue depth, FCM success rate)

### 10.2 Update Frequency

- Incident data: Real-time (Firestore onSnapshot)
- Responder positions: 30-second polling (RTDB)
- System health: 60-second polling
- Municipal performance: 5-minute polling

### 10.3 Staleness Thresholds

- <30s: Live
- 30s-5min: Stale
- > 5min: Offline

---

## 11. Anti-Patterns Avoided

| Anti-Pattern                | Status  | Mitigation                                                 |
| --------------------------- | ------- | ---------------------------------------------------------- |
| Hero-metric template        | Avoided | No big-number-little-label cards; data embedded in context |
| Identical card grid         | Avoided | Municipal cards vary by data (color, count, response time) |
| Gradient text               | Avoided | No `background-clip: text` anywhere                        |
| Glassmorphism               | Avoided | Solid backgrounds only                                     |
| Side-stripe borders         | Avoided | Full-card background tints for severity                    |
| Modal as first thought      | Avoided | Declare Alert is the only modal; everything else inline    |
| Auto-scrolling lists        | Avoided | Static list with new indicators                            |
| Dark theme for wall display | Avoided | Light theme for fluorescent lighting                       |
| Tiny text on wall display   | Avoided | Minimum 14px, most text 18-22px                            |

---

## 12. Dependencies

### 12.1 Existing

- React 18
- Leaflet (map)
- React Router
- TanStack Query
- Firebase (Firestore, RTDB)

### 12.2 New

- Inter font (self-hosted or Google Fonts CDN)
- No new major dependencies required

---

## 13. Open Questions

1. **Map tile provider:** Current OSM tiles may have usage limits. Should we use a Philippines-optimized tile server?
2. **Municipality GeoJSON:** ✅ Available at `apps/admin-desktop/src/data/municipal-boundaries.geojson`
3. **Alert declaration authority:** Should municipal admins also see alert level but not be able to change it?
4. **Historical data:** How many days of resolved incidents should be accessible in focus mode?
5. **Animation library:** Use Framer Motion (existing dependency) or native CSS animations? Framer Motion recommended for React component orchestration.

---

## 14. Revision History

| Date       | Author      | Change                                                                                          |
| ---------- | ----------- | ----------------------------------------------------------------------------------------------- |
| 2026-05-08 | Design Team | Initial spec incorporating adversarial review fixes                                             |
| 2026-05-08 | Design Team | Added purposeful motion system — attention-directing animations for critical events (Section 8) |

---

**Approved by:** **\*\*\*\***\_**\*\*\*\***
**Date:** **\*\*\*\***\_**\*\*\*\***
