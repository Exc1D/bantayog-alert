# UX Completeness Evaluation: @bantayog/admin-desktop

**Date:** 2026-05-25
**Scope:** Full application UX audit using evaluate-ux-completeness skill matrix

---

## Completeness Scorecard

```
States & Feedback:     Partial
Navigation:            Partial
Forms & Input:         Partial
Content & Copy:        Complete
Edge Cases:            Partial
Accessibility:         Partial
Responsive:            Partial
Onboarding:            Missing
```

**Overall Assessment: Needs Work**

The admin-desktop app has solid foundations with good accessibility primitives, proper form handling, and comprehensive error states. However, it lacks onboarding, has gaps in edge case handling, and needs better navigation/orientation support. The desktop-only constraint is by design but limits accessibility.

---

## 1. States & Feedback — Partial

### What's Present

- **Loading states:** Spinners on all main pages (Dashboard, Map, Feed, DispatchMonitor) during initial data load
- **Empty states:** `AllClearState` component shows when no incidents exist
- **Error states:** `OfflineBanner` for network errors, `ActionErrorBanner` for action failures
- **Success states:** `SuccessBanner` for confirmed actions (re-dispatch)
- **Async action feedback:** Buttons show loading state with text changes ("Publishing", "Unpublishing", "Sending...")
- **Offline detection:** Browser online/offline events monitored
- **Degraded mode:** Dashboard opacity reduced when in 'degraded' mode

### What's Missing

- **Skeleton screens:** Only spinners used, no content skeletons for progressive loading
- **Retry mechanisms:** No "Retry" button on failed data loads; users must refresh the page
- **Partial data display:** All-or-nothing loading — if one hook fails, the entire page is affected
- **Map progressive loading:** MapPage shows only a spinner, no progressive loading of map tiles or data pins
- **Stale data indicators:** No visual indication when displayed data is stale (only `lastUpdatedAt` timestamp)
- **Toast notifications:** Success/Error banners are inline, no floating toast system

### Red Flags Found

- `DashboardPage.tsx` line 192: Loading state only triggers when ALL data is empty, creating a flash of empty content if one hook loads faster than others
- `FeedPage.tsx` lines 124-163: Media fetch effect has `// eslint-disable-next-line react-hooks/exhaustive-deps` — missing dependency on `db`
- `MapPage.tsx` line 160: Loading state shows spinner even if error exists simultaneously

---

## 2. Navigation & Orientation — Partial

### What's Present

- **Active tab highlighting:** CommandHeader shows active tab with `aria-current="page"` and color accent
- **Window role chips:** Visual indicator showing current view (Dashboard/Map/Feed/Dispatches)
- **Role-based color coding:** Each view has a distinct color accent (danger, info, success, warning)
- **Keyboard shortcuts:** Documented in HelpModal (R, D, F, ?, Esc)

### What's Missing

- **Breadcrumbs:** No navigation breadcrumbs for nested views
- **Back navigation:** No UI back button; users rely on browser back
- **Deep linking:** Only basic route params (municipality on map). No URL state for filters, modals, or selections
- **Navigation history:** No preserved scroll position or filter state on browser back/forward
- **Active state on reload:** Tab highlight relies on windowRole prop, but URL matching could fail if routes change
- **Orphaned page handling:** Catch-all route redirects to dashboard, but no 404 state shown

### Red Flags Found

- `routes.tsx` line 42: Mobile check is done at module load time (`const isMobile = ...`), not responsive to window resize
- No "You are here" indicator beyond the tab bar
- Selected report/municipality state in map is not URL-synced (lost on refresh)

---

## 3. Forms & Input — Partial

### What's Present

- **Login form:** Labels, required attributes, autocomplete, error display, loading state
- **DeclareAlertModal:** Form validation, character limits (500), required field indication, cancel button
- **Feed moderation:** Action buttons with loading states and disabled states
- **All inputs have labels:** Proper `<label htmlFor="...">` associations
- **Error proximity:** Error messages shown near problematic fields or actions
- **Loading during submission:** Buttons disabled and show loading text during async operations

### What's Missing

- **Destructive action confirmation:** No confirmation dialog before "Unpublish", "Reject", or "Delete All Users"
- **Inline validation:** Only submit-time validation; no real-time feedback as user types
- **Auto-save:** No draft recovery for long forms (DeclareAlertModal loses data if accidentally closed)
- **Unsaved changes warning:** Navigating away from partially filled forms doesn't warn users
- **Form reset:** No explicit reset/clear functionality on DeclareAlertModal (other than closing)
- **Field-level error association:** No `aria-describedby` linking errors to specific fields

### Red Flags Found

- `FeedPage.tsx` lines 360-371: "Unpublish" button has no confirmation — irreversible action with one click
- `FeedPage.tsx` lines 318-328: Textarea for "scrubbed copy" has no character limit shown (though backend may enforce)
- `LoginPage.tsx` lines 29-34: Role check happens after sign-in, then signs user out — could show a flash of dashboard before redirect

---

## 4. Content & Copy — Complete

### What's Present

- **No placeholder text:** No "Lorem ipsum", "TODO", or "FIXME" visible in production components
- **Human-readable labels:** All user-facing text is clear and descriptive
- **Good button labels:** "Sign In", "Declare Alert", "Send to moderation", "Publish scrubbed copy"
- **Fallback text:** "Unknown municipality", "Location pending", "Time pending" for missing data
- **Descriptive statuses:** "Published", "Pending publication", "Unpublished", "Intake"
- **Error messages:** Human-readable (though sometimes raw backend errors)

### What's Missing

- **Error message refinement:** Some errors show raw backend messages that may contain technical details
- **Empty state copy:** Could be more actionable ("Get started by..." instead of just "No reports")
- **Help text:** Limited contextual help within the interface itself

### Red Flags Found

- None significant. Content quality is good throughout.

---

## 5. Edge Cases & Resilience — Partial

### What's Present

- **Mobile gate:** `MobileGate` component blocks mobile access with clear messaging
- **Error boundary:** `ErrorBoundary` catches React rendering errors with a fallback UI
- **Empty data handling:** Multiple components handle empty arrays gracefully
- **Offline detection:** `OfflineBanner` monitors `navigator.onLine`
- **Character limits:** DeclareAlertModal textarea limited to 500 chars with visual counter
- **Image fallback:** Media URLs that fail to resolve are handled with console.error (not ideal but handled)
- **Null safety:** Many optional chaining and null coalescing operators used

### What's Missing

- **Very long content:** No explicit overflow handling for very long descriptions or municipality names
- **Network retry:** No exponential backoff or retry for failed Firestore reads
- **Permission denied:** No dedicated UI for authz failures (falls back to generic error)
- **Rate limiting:** No handling for API quota exceeded
- **Concurrent edits:** No conflict detection if two admins edit the same report
- **Browser zoom:** No testing at 200% zoom; some fixed widths may break
- **Slow connections:** No throttled loading states or timeout handling
- **Data corruption:** No validation that loaded data matches expected schema

### Red Flags Found

- `FeedPage.tsx` lines 126-162: Media fetch fires for ALL reports simultaneously — could overwhelm slow connections
- `ErrorBoundary.tsx`: Only shows "Something went wrong" with a Refresh button — no error details or recovery options
- `MapPage.tsx` line 66-68: `mapReportDocToReport` can return null, but filtering may still leave gaps

---

## 6. Accessibility — Partial

### What's Present

- **SkipLink:** First focusable element jumps to main content
- **LiveAnnouncer:** `aria-live="polite"` region for screen reader announcements
- **ARIA labels:** Icon-only buttons have descriptive `aria-label` attributes
- **Focus indicators:** `focus-visible:ring` styles on interactive elements
- **Active state:** `aria-current="page"` on active navigation tab
- **Modal accessibility:** `role="dialog"`, `aria-modal="true"`, `aria-labelledby` on modals
- **Alert roles:** Error banners use `role="alert"`
- **Screen reader text:** `sr-only` spans provide context for icon buttons and photos
- **Keyboard shortcuts:** Documented and implemented for power users
- **Form labels:** All inputs have associated `<label>` elements

### What's Missing

- **Focus management:** No focus trap in modals (user can tab outside modal)
- **Focus return:** Focus not returned to triggering element after modal closes
- **Reduced motion:** No `prefers-reduced-motion` handling for the spinner animation
- **Error association:** Form errors not linked to fields via `aria-describedby`
- **Landmarks:** No `<main>`, `<nav>`, `<aside>` semantic landmarks (only `header`)
- **Heading hierarchy:** Screen reader-only `<h1>` on dashboard, but no clear hierarchy on other pages
- **Color independence:** Some status indicators may rely solely on color (though many have icons)

### Red Flags Found

- `HelpModal.tsx` lines 35-41: Backdrop click dismisses modal but doesn't restore focus
- `LoginPage.tsx`: No `aria-invalid` or `aria-describedby` on inputs when error shows
- `routes.tsx` line 12: Mobile check uses `window.innerWidth` which may not account for zoom

---

## 7. Responsive & Cross-Platform — Partial

### What's Present

- **Mobile gate:** Blocks mobile with clear explanation
- **Some responsive grids:** `lg:grid-cols-[3fr_2fr]` on dashboard, `xl:grid-cols-[minmax(0,1fr)_minmax(340px,420px)]` on feed
- **Modal sizing:** Max-width constraints and max-height (90vh) on modals
- **Overflow handling:** `overflow-auto` on main content areas

### What's Missing

- **Desktop breakpoints:** No handling for intermediate widths (tablets, small laptops)
- **Touch targets:** No explicit guarantee of 44x44px minimum for buttons
- **Hover alternatives:** Some features may rely on hover (not verified in all components)
- **Landscape mode:** No explicit landscape orientation handling
- **High DPI:** No retina image handling
- **Font scaling:** Layout may break at 200% browser font scaling

### Red Flags Found

- App is explicitly desktop-only by design, which is a business decision but limits accessibility for users who need larger text or assistive devices
- Fixed header heights and sidebar widths may not adapt to user font preferences

---

## 8. Onboarding & Discovery — Missing

### What's Present

- **HelpModal:** Keyboard shortcuts reference
- **Empty states:** Basic messaging when no data exists

### What's Missing

- **First-run experience:** No guided tour or onboarding for new admins
- **Feature discovery:** No tooltips or highlights for new features
- **Contextual help:** No inline help icons or info tooltips
- **Search:** No global search or in-page search functionality
- **Documentation links:** No links to external documentation or help center
- **Tutorial:** No walkthrough of the triage workflow for new users
- **Empty state actions:** Empty states don't suggest next steps (e.g., "Declare your first alert")

### Red Flags Found

- New admin users must discover keyboard shortcuts by pressing "?" or clicking the button — no visual cue
- Complex moderation workflow (verify → scrub → publish) has no inline guidance
- Map overlays and filters have no explanation of what each layer shows

---

## Top 10 UX Gaps (Prioritized)

| Priority | Category      | Issue                                                          | Impact                       |
| -------- | ------------- | -------------------------------------------------------------- | ---------------------------- |
| **P1**   | Forms         | No confirmation before destructive actions (unpublish, reject) | Data loss risk               |
| **P1**   | Edge Cases    | No retry mechanism for failed data loads                       | App appears broken           |
| **P1**   | Accessibility | Focus not trapped or returned in modals                        | Keyboard users trapped       |
| **P2**   | States        | Skeleton screens instead of spinners                           | Better perceived performance |
| **P2**   | Navigation    | Deep-linking for selected reports/filters                      | Lost state on refresh        |
| **P2**   | Onboarding    | First-run tutorial for new admins                              | Adoption friction            |
| **P2**   | Forms         | Unsaved changes warning                                        | Accidental data loss         |
| **P3**   | Edge Cases    | Very long content overflow handling                            | Layout breakage              |
| **P3**   | Accessibility | `prefers-reduced-motion` support                               | Motion-sensitive users       |
| **P3**   | Onboarding    | Contextual help tooltips                                       | Feature discovery            |

---

## Recommendations

### Immediate (This Sprint)

1. Add confirmation dialogs for all destructive actions (Unpublish, Reject, Delete)
2. Add "Retry" buttons to OfflineBanner and error states
3. Implement focus trap and focus return in all modals

### Short-term (Next 2 Sprints)

4. Replace spinners with skeleton screens for initial page loads
5. Sync selected report/municipality/filters to URL query params
6. Add `aria-describedby` linking form errors to inputs
7. Create a first-run onboarding flow (3-step tour of dashboard)

### Medium-term (Next Quarter)

8. Add contextual help tooltips to complex features (map overlays, moderation workflow)
9. Implement `prefers-reduced-motion` throughout
10. Add global search for reports, dispatches, and alerts
11. Consider progressive enhancement for tablet-sized viewports

---

_Evaluation completed using evaluate-ux-completeness skill matrix_
