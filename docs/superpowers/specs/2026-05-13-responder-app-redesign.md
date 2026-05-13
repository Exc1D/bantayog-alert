# Responder App Redesign — Design Spec

**Date:** 2026-05-13
**Branch:** `feature/responder-app-redesign`
**Status:** Approved

## 1. Summary

Full visual and UX redesign of the Responder PWA applying two design principles:

- **Competence Feedback:** Responders see real skill growth through response-time trends, specialization mastery, and personal records — mechanics that signal "you got better at the actual thing," not badge theater.
- **Operational Clarity (Completion Drive):** Game-like visual patterns (progress rings, state timelines, urgency indicators) borrowed from gaming UI only where they improve decision clarity under pressure.

**Hard rejections:** No points, badges, leaderboards, streaks, loss aversion, peer comparison, or variable reward schedules that could distract during emergencies. No emojis — use Lucide React icons exclusively.

## 2. Visual Language

### 2.1 Palette

| Token                | Hex       | Usage                                          |
| -------------------- | --------- | ---------------------------------------------- |
| `--bg-black`         | `#0A0A0A` | Main app background                            |
| `--surface-elevated` | `#141414` | Cards, modals                                  |
| `--border-default`   | `#262626` | Card/separator borders                         |
| `--amber-accent`     | `#F59E0B` | Primary actions, urgency, active tab indicator |
| `--red-urgent`       | `#DC2626` | High severity, SOS, under-1-min countdown ring |
| `--green-success`    | `#22C55E` | Resolved, available, progress ring fill        |
| `--blue-responder`   | `#3B82F6` | Map responder dot                              |
| `--text-primary`     | `#F5F5F5` | Headlines, body text                           |
| `--text-secondary`   | `#A3A3A3` | Labels, timestamps, meta                       |
| `--text-tertiary`    | `#525252` | Disabled, placeholders, inactive borders       |

### 2.2 Typography

- Font: Inter (already loaded)
- Scale: 14px base, 24px page titles, 18px card titles, 12px labels
- Weights: 400 regular, 500 medium emphasis, 600 semibold headers only

### 2.3 Elevation

- No box-shadows on black backgrounds (they don't read)
- Border elevation: 1px solid `--border-default` for card boundaries
- Background elevation: `#0A0A0A` → `#141414` → `#1A1A1A` for stacked layers

### 2.4 Icons

- Lucide React only. No emojis anywhere.
- Current Lucide usage in Shell: `ClipboardList`, `Map`, `User` — keep, add where needed.
- Icon-only buttons get `aria-label`.

## 3. Shell Redesign

### 3.1 Header

- Black (`#0A0A0A`) background with 1px `#262626` bottom border
- "BANTAYOG ALERT" in 16px semibold uppercase, letter-spacing 0.5px
- Online status dot (`#22C55E`) + amber SOS pill button aligned right
- SOS button: `#F59E0B` background, `#0A0A0A` text, 6px border-radius
- SOS disabled state: grayed out with "No active dispatch" tooltip

### 3.2 Tab Bar

- Black (`#0A0A0A`) background, top border `#262626`
- 3 tabs: Dispatches (`/`), Map (`/map`), Profile (`/profile`)
- Active tab: amber (`#F59E0B`) 2px bottom border, amber text
- Inactive tab: `#A3A3A3` text, transparent bottom border
- Pending badge on Dispatches: `#DC2626` filled circle, white text, "9+" overflow
- Use existing Lucide icons: `ClipboardList`, `Map`, `User`

### 3.3 Content Area

- Black (`#0A0A0A`) background
- Cards use elevated surface (`#141414`) + 1px border (`#262626`)

## 4. DispatchListPage

### 4.1 Empty State

- Centered layout with checkmark, "All Clear" title, "Stay ready" subtitle
- "View Past Dispatches →" link in amber

### 4.2 Pending Dispatch Card — Ring Timer

- **Ring:** SVG circle, `max(240px, min(280px, 85vw))` responsive size, `#F59E0B` stroke on `#1A1A1A` track. 12px stroke width, rounded caps.
- Ring depletes clockwise as acceptance deadline approaches
- When <1 minute remains, ring color transitions to `#DC2626`
- **Center content (inside ring):**
  - "ACCEPT IN" label, 12px `#A3A3A3` uppercase
  - Countdown timer: 42px, bold, `#F59E0B` (e.g., "4:32")
  - Incident type: 16px semibold `#F5F5F5`
  - Severity badge + location chips
  - Brief description clip (1 line)
  - "View & Accept" button: amber pill, full-width within ring
- **Multiple pending:** Vertical stack, most urgent on top, swipe to reveal next

### 4.3 Active Dispatch Card — Progress Ring

- **Ring:** SVG circle, same dimensions. Green (`#22C55E`) fill progresses with dispatch state:
  - Accepted: 20% | Acknowledged: 40% | En Route: 60% | On Scene: 80% | Resolved: 100%
- **Center content (inside ring):**
  - "PROGRESS" label, 12px `#A3A3A3` uppercase
  - Percentage: 42px, bold, `#22C55E`
  - Incident type, severity, location (same as pending)
  - Status text (e.g., "3 of 5 steps complete")
  - Action button: green (`#22C55E`) for next state, label matches current transition
- **Resolved card:** Ring at 100% with brief green glow pulse, shows "Mission Complete" + "View Summary" link
- **Auto-redirect:** When only 1 active dispatch exists, auto-navigate to `/dispatches/{id}` (existing behavior, keep)

### 4.4 Error Banner

- Red-tinted banner at top: `role="alert"`, message text, 16px top padding

## 5. DispatchDetailPage

### 5.1 Header

- Back arrow button (←) + incident type title + severity badge
- SOS link icon in header when in active state

### 5.2 State Machine Timeline

- Horizontal stepper: Accepted → Acknowledged → En Route → On Scene → Resolved
- Completed steps: `#22C55E` filled circles with checkmark, connecting line green
- Current step: `#F59E0B` filled circle (slightly larger) with amber glow, connecting line amber
- Future steps: outlined circles `#525252`, connecting line `#525252`
- Labels beneath each step in 10px

### 5.3 Incident Card

- Elevated surface card with location, report ID, severity badge, description

### 5.4 State-Specific Actions

| State        | Primary Action                      | Secondary Actions                  |
| ------------ | ----------------------------------- | ---------------------------------- |
| Pending      | Accept / Decline (reason select)    | —                                  |
| Accepted     | Auto-acknowledge (with spinner)     | —                                  |
| Acknowledged | Mark En Route                       | Backup, Call Admin                 |
| En Route     | Mark On Scene                       | Backup, Call Admin, Witness Report |
| On Scene     | Mark Resolved (resolution textarea) | Unable to Complete (reason select) |

### 5.5 Pre-Arrival Info Card

- Shown in En Route state
- Distance to scene (meters, from geolocation + haversine)
- Suggested prep based on incident type (e.g., "Bring life jackets — flood reported waist-deep")

### 5.6 Field Notes

- Textarea + "Add Note" button section, always visible during active states

### 5.7 Terminal Screens

- **CancelledScreen:** Existing, keep. Style to dark theme.
- **RaceLossScreen:** Existing, keep. Style to dark theme.

## 6. MapPage

### 6.1 Map Tiles

- Switch from OpenStreetMap light tiles to CartoDB Dark Matter: `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png`
- Dark tiles match app theme and reduce glare in bright daylight

### 6.2 Markers

- **Responder dot:** Blue (`#3B82F6`) 18px circle with white 3px border, blue glow — keep existing `L.divIcon`
- **Incident pins:** Severity-colored diamonds using `L.divIcon` — keep existing pattern
  - High: `#DC2626`, Medium: `#F59E0B`, Low: `#475569`
- Use existing severity color constants

### 6.3 Controls

- **Legend:** Bottom-left, semi-transparent black card with blue dot + red diamond entries
- **Recenter button:** Bottom-right floating button with `Crosshair` Lucide icon. Disabled when no GPS lock.
- Keep existing GPS lifecycle (watchPosition, visibilitychange pause/resume)

## 7. ProfilePage — Competence Dashboard

### 7.1 Identity Card

- Avatar circle with `User` icon, 2px amber border
- Display name (large), station label (muted), responder type badge
- Specialization chips: amber chip for primary, outlined chips for others

### 7.2 Stats Grid

- 3-column grid with elevated surface boxes:
  - **Total Dispatches** — number in amber
  - **Resolution Rate** — percentage in green
  - **Avg Response Time** — time in white

### 7.3 Specialization Mastery

- Progress bars per specialization, filled proportionally to resolved count relative to your most-resolved type
- Label: specialization name + resolved count
- Fill color: `#F59E0B` if ≥50% of max, `#22C55E` if <50%

### 7.4 Personal Bests

- List of personal records:
  - Fastest response (single dispatch)
  - Most dispatches in a week
  - Longest availability streak (days)
- Each row: label (left, muted) + value (right, bold)

### 7.5 Availability Control

- Status indicator: colored dot + label
- Select dropdown (Available / Unavailable / Off Duty)
- Reason select (when unavailable/off duty)
- "Update Status" amber button
- Error display for write failures

### 7.6 Quick Links

- "View Dispatch History →" link
- "Start Shift Handoff →" link

### 7.7 Sign Out

- Text button at page bottom, muted color

## 8. Post-Dispatch Summary (Mission Complete)

### 8.1 Trigger

- Shown after marking a dispatch "Resolved" from DispatchDetailPage
- Can also be reached from the resolved ring card on DispatchListPage

### 8.2 Content

- Large checkmark (Lucide `CheckCircle` icon) + "Mission Complete" title
- Incident type + location subtitle
- **Time Breakdown card:**
  - Per-transition timing: Accepted→En Route, En Route→On Scene, On Scene→Resolved
  - Total time: highlighted with amber top border, amber text
- **Personal Record banner:** Amber card only when a new personal best is hit (e.g., "Fastest flood response this month!"). Omitted otherwise — variable reward.
- **Actions:**
  - "Add Field Notes" — outlined button
  - "Back to Dispatches" — green filled button

### 8.3 Dismissal

- Tap "Back to Dispatches" or auto-dismiss after 30s timeout
- Can also swipe down to dismiss

## 9. Remaining Pages

### 9.1 SOS Page

- Full-screen `#DC2626` background
- Large "HOLD TO SEND SOS" button with pulse animation
- `prefers-reduced-motion` guard on pulse
- "Cancel" button at bottom
- Keep existing hold-to-confirm behavior + keyboard support

### 9.2 BackupRequestPage

- Amber-themed form
- Reason select + urgency indicator + send button
- Style to dark theme

### 9.3 DispatchHistoryPage

- Chronological list, each row: date, incident type, status pill (green=resolved, red=declined, gray=timed_out), total time
- Style to dark theme

### 9.4 ShiftHandoffPage

- Form: target responder select + reason + confirm button
- Style to dark theme

### 9.5 ResponderWitnessReportPage

- Form: photo upload, description textarea, severity select
- Style to dark theme

### 9.6 LoginPage

- Black background, centered card with "BANTAYOG ALERT" title
- "Responder Portal · Camarines Norte" subtitle
- Phone number input + amber "Sign In" button
- Error display below button

### 9.7 TotpEnrollmentPage / TotpGuard

- Dark themed card with 6-digit input fields
- Amber verify button
- Keep existing TOTP flow logic

## 10. CSS Strategy

### 10.1 Design Tokens

Create `apps/responder-app/src/styles/design-tokens.css` with all palette tokens as CSS custom properties on `:root`.

### 10.2 Global Styles

Update `apps/responder-app/src/styles/globals.css`:

- Set `body` background to `var(--bg-black)`, color to `var(--text-primary)`
- Remove any navy palette references
- Add `prefers-reduced-motion` guards

### 10.3 Per-Component Styles

Each page gets updates to its CSS Module file. No inline styles in JSX except for truly dynamic values (e.g., ring dashoffset, severity color). Follow the existing CSS Modules convention.

## 11. Data Requirements

### 11.1 Existing Data (no backend changes needed)

- `useOwnDispatches` — groups (active/pending), rows, error
- `useDispatch` — dispatch detail with status, reportId, timestamps
- `useReport` — report summary with severity, location, type, description
- `useResponderProfile` — displayName, stationLabel, responderType, specializations
- `useResponderAvailability` — status, setAvailability
- `useDispatchHistory` — history list with status, timestamps
- `useAcceptDispatch`, `useAdvanceDispatch`, `useDeclineDispatch`, `useMarkDispatchUnableToComplete` — state transitions
- `useAddFieldNote` — field notes

### 11.2 Derived Metrics (computed client-side)

- **Resolution Rate:** `resolvedCount / totalCount` from dispatch history
- **Avg Response Time:** Average of per-dispatch total times
- **Specialization Mastery:** Count resolved dispatches per incident type
- **Personal Bests:** Min response time, max weekly count, max availability streak
- **Ring Progress:** Map `dispatch.status` → percentage (pending=0, accepted=20, acknowledged=40, en_route=60, on_scene=80, resolved=100)

## 12. Testing Strategy

### 12.1 Existing Tests

- 35 test files, 173 tests — all must continue passing
- Update Shell.test.tsx (already at 3 tabs from messaging removal)
- Update routes.test.tsx (already updated from messaging removal)
- Update page test files as needed for new markup/classes

### 12.2 New Tests Needed

- **Progress ring rendering:** Verify ring dashoffset maps correctly to each status
- **Countdown ring depletion:** Verify under-1-min triggers red color
- **Personal record detection:** Verify banner shows only on actual PB
- **Specialization mastery bars:** Verify proportional fill calculation
- **Post-dispatch summary:** Verify time breakdown + PB banner logic

## 13. Implementation Order

1. `design-tokens.css` + `globals.css` — establish black palette
2. Shell — header + tab bar restyle
3. DispatchListPage — ring cards
4. DispatchDetailPage — state timeline + dark restyle
5. ProfilePage — competence dashboard
6. MapPage — dark tiles
7. Post-dispatch summary — Mission Complete overlay
8. Remaining pages — dark restyle
9. CSS cleanup — remove stale navy/emojis
10. Test updates + new tests
