# Responder App Redesign — Design Spec

**Date:** 2026-05-13
**Branch:** `feature/responder-app-redesign`
**Status:** Approved

## 1. Summary

Full visual and UX redesign of the Responder PWA applying two design principles:

- **Competence Feedback:** Responders see real skill growth through response-time trends, specialization mastery, and personal records — mechanics that signal "you got better at the actual thing," not badge theater.
- **Operational Clarity (Completion Drive):** Game-like visual patterns (progress rings, state timelines, urgency indicators) borrowed from gaming UI only where they improve decision clarity under pressure.

**Platform:** Smartphone-only in the field. All touch targets ≥44px. No tablet/desktop design accommodations — optimize for one-handed thumb use.

**Hard rejections:** No points, badges, leaderboards, streaks, loss aversion, peer comparison, or variable reward schedules that could distract during emergencies. No emojis — use Lucide React icons exclusively.

## 2. Visual Language

### 2.1 Palette

All colors specified in both hex and OKLCH for perceptual consistency. Warm-black base tinted toward amber (chroma 0.005) avoids the harshness of pure `#000`.

| Token                | Hex       | OKLCH                  | Usage                                          |
| -------------------- | --------- | ---------------------- | ---------------------------------------------- |
| `--bg-black`         | `#0D0C08` | `oklch(6% 0.005 95)`   | Main app background                            |
| `--surface-elevated` | `#161610` | `oklch(10% 0.005 95)`  | Cards, modals                                  |
| `--border-default`   | `#292920` | `oklch(18% 0.005 95)`  | Card/separator borders                         |
| `--amber-accent`     | `#F59E0B` | `oklch(78% 0.165 85)`  | Primary actions, urgency, active tab indicator |
| `--red-urgent`       | `#DC2626` | `oklch(52% 0.225 30)`  | High severity, SOS, under-1-min countdown ring |
| `--green-success`    | `#22C55E` | `oklch(68% 0.195 150)` | Resolved, available, progress ring fill        |
| `--blue-responder`   | `#3B82F6` | `oklch(58% 0.185 265)` | Map responder dot                              |
| `--text-primary`     | `#F5F5F5` | `oklch(96% 0.001 95)`  | Headlines, body text                           |
| `--text-secondary`   | `#A3A3A3` | `oklch(68% 0.001 95)`  | Labels, timestamps, meta                       |
| `--text-tertiary`    | `#525252` | `oklch(38% 0.001 95)`  | Disabled, placeholders, inactive borders       |

Sunlight visibility: dark theme provides excellent contrast in bright daylight — critical for responders using the app outdoors during disaster operations. No light mode needed; the high-contrast amber-on-black palette reads clearly under direct sun.

### 2.2 Typography

- Font: Inter (already loaded)
- Scale: 14px base, 24px page titles, 18px card titles, 12px labels, 36px ring numbers
- Weights: 400 regular, 500 medium emphasis, 600 semibold headers only

### 2.3 Elevation

- Solid warm-black (`#0D0C08`) background. Cards: elevated surface (`#161610`) + 1px border (`#292920`).
- Background elevation: `#0D0C08` → `#161610` → `#1C1C16` for stacked layers

### 2.4 Icons

- Lucide React only. No emojis anywhere.
- Current Lucide usage in Shell: `ClipboardList`, `Map`, `User` — keep, add where needed.
- Icon-only buttons get `aria-label`.

### 2.5 Motion

- Transitions: 150–250ms `ease-out` (cubic-bezier(0, 0, 0.2, 1)). No bounce, no elastic.
- Glow pulse (resolved ring, SOS button): ≤400ms, single iteration. Wrapped in `prefers-reduced-motion: reduce` guard.
- Ring depletion: smooth 1s linear transition between percentage steps (avoids jitter on status changes).
- Map fly-to: 250ms `ease-out` on first GPS lock only; subsequent re-centers are user-initiated.
- Progress bar fill: 200ms `ease-out` on specialization mastery bars.
- All animated elements must render a static equivalent when `prefers-reduced-motion: reduce` matches.

### 2.6 Touch Targets

Smartphone-only. Every interactive element follows these rules:

- Minimum touch target: 44×44px (WCAG 2.5.5).
- Primary action buttons: ≥48px height, full-width within their container.
- Adjacent tappable elements: ≥8px gap to prevent mis-taps.
- Critical actions (Accept, Mark Resolved, SOS): positioned in the thumb zone (bottom 60% of screen) where possible. The header SOS button gets a secondary floating FAB in the thumb zone on active dispatch pages.

## 3. Shell Redesign

### 3.1 Header

- Warm-black (`#0D0C08`) background with 1px `#292920` bottom border
- "BANTAYOG ALERT" in 16px semibold uppercase, letter-spacing 0.5px
- Online status dot (`#22C55E`) + amber SOS pill button aligned right
- SOS button: `#F59E0B` background, `#0D0C08` text, 6px border-radius
- SOS disabled state: grayed out with "No active dispatch" tooltip

### 3.2 Tab Bar

- Warm-black (`#0D0C08`) background, top border `#292920`
- 3 tabs: Dispatches (`/`), Map (`/map`), Profile (`/profile`)
- Each tab: Lucide icon above text label (10px, `--text-secondary`) — icons never stand alone
- Active tab: amber (`#F59E0B`) 2px bottom border, amber icon + text
- Inactive tab: `#A3A3A3` icon + text, transparent bottom border
- Pending badge on Dispatches: `#DC2626` filled circle, white text, "9+" overflow
- Use existing Lucide icons: `ClipboardList`, `Map`, `User`

### 3.3 Content Area

- Warm-black (`#0D0C08`) background
- Cards use elevated surface (`#161610`) + 1px border (`#292920`)

## 4. DispatchListPage

### 4.1 Empty State

- Centered layout with checkmark, "All Clear" title, "Stay ready" subtitle
- "View Past Dispatches →" link in amber

### 4.2 Pending Dispatch Card — Ring Timer

- **Ring:** SVG circle, `max(240px, min(280px, 85vw))` responsive size, `#F59E0B` stroke on `#1C1C16` track. 12px stroke width, rounded caps.
- Ring depletes clockwise as acceptance deadline approaches
- When <1 minute remains, ring color transitions to `#DC2626`
- **Center content (inside ring):**
  - "ACCEPT IN" label, 12px `#A3A3A3` uppercase
  - Countdown timer: 36px, bold, `#F59E0B` (e.g., "4:32")
  - Incident type: 16px semibold `#F5F5F5`
  - Severity badge + location chips
  - Brief description clip (1 line)
  - "View & Accept" button: amber pill, full-width within ring
- **Screen reader:** `aria-label` on the countdown ring updates each second (e.g., "Accept in 4 minutes 32 seconds"). When <1 minute: `aria-label` appends "urgent" and `role="alert"` announces the transition.
- **Multiple pending:** Vertical stack, most urgent on top, swipe to reveal next. Page indicator dots below the stack show count and current position.

### 4.3 Active Dispatch Card — Progress Ring

- **Ring:** SVG circle, same dimensions, `#1C1C16` track. Green (`#22C55E`) fill progresses with dispatch state:
  - Accepted: 20% | Acknowledged: 40% | En Route: 60% | On Scene: 80% | Resolved: 100%
- **Center content (inside ring):**
  - "PROGRESS" label, 12px `#A3A3A3` uppercase
  - Percentage: 36px, bold, `#22C55E`
  - Incident type, severity, location (same as pending)
  - Status text (e.g., "3 of 5 steps complete")
  - Action button: green (`#22C55E`) for next state, label matches current transition
- **Resolved card:** Ring at 100% with brief green glow pulse, shows "Mission Complete" + "View Summary" link
- **Auto-redirect:** When only 1 active dispatch exists, auto-navigate to `/dispatches/{id}` (existing behavior, keep)

### 4.4 Error Banner

- Red-tinted banner at top: `role="alert"`, message text, 16px top padding

### 4.5 Offline Transition Resilience

Responders operate in disaster zones with unreliable connectivity. Every state transition must survive network failure.

- **Offline queue:** Transitions attempted without connectivity are written to a local queue (IndexedDB via localForage, `offline-transitions` key). Each entry: `{ dispatchId, transition, payload, timestamp, retryCount }`.
- **Visual feedback on queue:** After a failed transition, the action button shows an amber spinner → "Queued" pill with a progress indicator. The dispatch card remains in its current visual state but the button text changes to "Queued — will retry."
- **Background retry:** On `window.online` event and on app foreground, drain the queue sequentially (oldest first). Each retry: exponential backoff (1s, 2s, 4s, 8s, max 30s). Max 5 retries per entry.
- **Terminal failure:** After max retries, surface an error banner: "Could not sync [N] update(s). Tap to retry." Tapping manually triggers a full queue drain.
- **Queue visibility:** A small amber badge on the Dispatches tab shows queued count when >0. Tapping navigates to the dispatch with the pending queue entry.
- **Conflict resolution:** If a transition is rejected by the server (e.g., dispatch already resolved by another responder), remove the queue entry and refresh dispatch state — surface a brief toast: "Dispatch already updated."

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
- **ARIA:** Wrapper gets `role="progressbar"`, `aria-valuenow` maps to step index (0–4), `aria-valuetext` is the current step name. Each step circle gets `aria-current="step"` (current), `aria-current="true"` (completed), or unset (future). Color is never the sole indicator — step labels convey state.

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
- **Autosave:** Debounced (500ms) Capacitor Preferences persistence on every keystroke. Draft restored on remount via `field-notes/{dispatchId}` key. Cleared on successful submit. Do not block the active page on storage failure; preserve in-memory edits and log the storage error separately.

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

- **Legend:** Bottom-left, semi-transparent warm-black card with entries: blue circle (you), colored diamonds per severity (high=red, medium=amber, low=gray)
- **Recenter button:** Bottom-right floating button with `Crosshair` Lucide icon. Disabled when no GPS lock.
- Keep existing GPS lifecycle (watchPosition, visibilitychange pause/resume)

## 7. ProfilePage — Competence Dashboard

### 7.1 Identity + Stats Zone (single card)

Merge identity and stats into one cohesive surface — no nested cards, no hero-metric boxes.

- Avatar circle with `User` icon, 2px amber border
- Display name (large) + station label (muted) + responder type badge on one row
- Specialization chips: amber chip for primary, outlined chips for others
- **Stat row** (horizontal, below identity): three stat values separated by subtle dividers — no card wrappers, no "big number + tiny label" SaaS pattern:
  - `Total Dispatches` in amber · `Resolution Rate` in green · `Avg Response Time` in white
  - Each stat: value in 18px semibold, label in 11px `--text-secondary` below

### 7.2 Specialization Mastery (separate card)

- Progress bars per specialization, filled proportionally to resolved count relative to your most-resolved type
- Label: specialization name + resolved count
- Fill color: `#22C55E` (green) if ≥80% of max, `#F59E0B` (amber) if 50–79%, `#525252` (muted) if <50%. Green signals mastery — amber signals developing — muted signals early stage.
- 200ms `ease-out` fill transition

### 7.3 Personal Bests (separate card)

- List of personal records — each row: label (left, muted) + value (right, bold):
  - Fastest response (single dispatch)
  - Most dispatches in a week
  - Longest availability streak (days)

### 7.4 Availability Control (simple row, no card wrapper)

- Status indicator: colored dot + label
- Select dropdown (Available / Unavailable / Off Duty)
- Reason select (when unavailable/off duty)
- "Update Status" amber button
- Error display for write failures

### 7.5 Quick Links

- "View Dispatch History →" link
- "Start Shift Handoff →" link

### 7.6 Sign Out

- Text button at page bottom, muted color

## 8. First-Run Experience

Minimal onboarding — not a tour, just context. Shown once, stored in `sessionStorage["bantayog.onboarded"]`.

- **Trigger:** First login after app install/update. Single card overlay, not a multi-step wizard.
- **Content:**
  - "Your dispatch ring fills as you progress — aim for the close" with animated ring illustration (pending depleting → active filling → resolved glow)
  - "Check Profile to track your response times and personal records"
  - Single "Got it" button dismisses permanently
- **Accessible:** All text readable by screen readers, illustration is decorative (`aria-hidden="true"`).

## 9. Post-Dispatch Summary (Mission Complete)

### 9.1 Trigger

- Shown after marking a dispatch "Resolved" from DispatchDetailPage
- Can also be reached from the resolved ring card on DispatchListPage

### 9.2 Content

- Large checkmark (Lucide `CheckCircle` icon) + "Mission Complete" title
- Incident type + location subtitle
- **Time Breakdown card:**
  - Per-transition timing: Accepted→En Route, En Route→On Scene, On Scene→Resolved
  - Total time: highlighted with amber top border, amber text
- **Personal Record banner:** Amber card only when a new personal best is hit (e.g., "Fastest flood response this month!"). Omitted otherwise — variable reward.
- **Actions:**
  - "Add Field Notes" — outlined button
  - "Back to Dispatches" — green filled button

### 9.3 Dismissal

- Tap "Back to Dispatches" or swipe down to dismiss
- No auto-dismiss — let the responder review at their own pace on scene

## 10. Remaining Pages

### 10.1 SOS Page

- Full-screen `#DC2626` background
- Large "HOLD TO SEND SOS" button centered in thumb zone (bottom 60% of screen)
- Pulse animation on the button, wrapped in `prefers-reduced-motion` guard
- "Cancel" text button below the hold button
- **Floating SOS FAB:** On active dispatch detail pages, a secondary SOS floating action button (amber, 48px, `Siren` Lucide icon) appears in the bottom-right thumb zone. Tapping it navigates to the SOS page with the current dispatch pre-selected. This ensures one-thumb SOS access without reaching for the header.
- Keep existing hold-to-confirm behavior

### 10.2 BackupRequestPage

- Amber-themed form
- Reason select + urgency indicator + send button
- Style to dark theme

### 10.3 DispatchHistoryPage

- Chronological list, each row: date, incident type, status pill (green=resolved, red=declined, gray=timed_out), total time
- Style to dark theme

### 10.4 ShiftHandoffPage

- Form: target responder select + reason + confirm button
- Style to dark theme

### 10.5 ResponderWitnessReportPage

- Form: photo upload, description textarea, severity select
- Style to dark theme

### 10.6 LoginPage

- Warm-black (`#0D0C08`) background, centered card with "BANTAYOG ALERT" title
- "Responder Portal · Camarines Norte" subtitle
- Phone number input + amber "Sign In" button
- Error display below button

### 10.7 TotpEnrollmentPage / TotpGuard

- Dark themed card with 6-digit input fields
- Amber verify button
- Keep existing TOTP flow logic

## 11. CSS Strategy

### 11.1 Design Tokens

Create `apps/responder-app/src/styles/design-tokens.css` with all palette tokens as CSS custom properties on `:root`.

### 11.2 Global Styles

Update `apps/responder-app/src/styles/globals.css`:

- Set `body` background to `var(--bg-black)` (`#0D0C08`), color to `var(--text-primary)`
- Remove any navy palette references (pre-existing in current codebase)
- Add `prefers-reduced-motion` guards per §2.5

### 11.3 Per-Component Styles

Each page gets updates to its CSS Module file. No inline styles in JSX except for truly dynamic values (e.g., ring dashoffset, severity color). Follow the existing CSS Modules convention.

## 12. Data Requirements

### 12.1 Existing Data (no backend changes needed)

- `useOwnDispatches` — groups (active/pending), rows, error
- `useDispatch` — dispatch detail with status, reportId, timestamps
- `useReport` — report summary with severity, location, type, description
- `useResponderProfile` — displayName, stationLabel, responderType, specializations
- `useResponderAvailability` — status, setAvailability
- `useDispatchHistory` — history list with status, timestamps
- `useAcceptDispatch`, `useAdvanceDispatch`, `useDeclineDispatch`, `useMarkDispatchUnableToComplete` — state transitions
- `useAddFieldNote` — field notes

### 12.2 Derived Metrics (computed client-side)

- **Resolution Rate:** `resolvedCount / totalCount` from dispatch history
- **Avg Response Time:** Average of per-dispatch total times
- **Specialization Mastery:** Count resolved dispatches per incident type (categorized into three tiers: ≥80% green, 50–79% amber, <50% muted)
- **Personal Bests:** Min response time, max weekly count, max availability streak
- **Ring Progress:** Map `dispatch.status` → percentage (pending=0, accepted=20, acknowledged=40, en_route=60, on_scene=80, resolved=100)

### 12.3 New Client-Side State

- **Offline transition queue:** localForage key `offline-transitions`, array of `{ dispatchId, transition, payload, timestamp, retryCount }`. Drained on connectivity restore.
- **Field notes drafts:** Capacitor Preferences key `field-notes/{dispatchId}`, string. Debounced save, restored on revisit, cleared on submit without overwriting newer in-memory edits if hydration resolves late.
- **Onboarding flag:** `sessionStorage["bantayog.onboarded"]`, boolean. Set on first dismiss.

## 13. Testing Strategy

### 13.1 Existing Tests

- 35 test files, 173 tests — all must continue passing
- Update Shell.test.tsx (already at 3 tabs from messaging removal)
- Update routes.test.tsx (already updated from messaging removal)
- Update page test files as needed for new markup/classes

### 13.2 New Tests Needed

- **Progress ring rendering:** Verify ring dashoffset maps correctly to each status
- **Countdown ring depletion:** Verify under-1-min triggers red color + `role="alert"` announcement
- **Personal record detection:** Verify banner shows only on actual PB
- **Specialization mastery bars:** Verify proportional fill calculation + three-tier color mapping
- **Post-dispatch summary:** Verify time breakdown + PB banner logic
- **Offline transition queue:** Verify queue write on network failure, drain on `online` event, exponential backoff, max-retry terminal state, conflict-resolution refresh
- **Field notes autosave:** Verify debounced Preferences write, draft restoration on remount, no overwrite when hydration settles after user input, and clear on submit
- **First-run overlay:** Verify one-time display, permanent dismiss via sessionStorage

## 14. Implementation Order

1. `design-tokens.css` + `globals.css` — establish warm-black palette
2. Shell — header + tab bar restyle (icons + text labels), floating SOS FAB
3. DispatchListPage — ring cards + offline queue + page indicators + screen reader announcements
4. DispatchDetailPage — state timeline ARIA + field notes autosave + dark restyle
5. ProfilePage — competence dashboard with three-tier mastery bars
6. First-run onboarding overlay
7. MapPage — dark tiles + fixed legend
8. Post-dispatch summary — Mission Complete overlay, no auto-dismiss
9. Remaining pages — dark restyle
10. CSS cleanup — remove stale navy/emojis
11. Test updates + new tests (offline queue, autosave, onboarding, accessibility)
