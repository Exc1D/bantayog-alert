# Bantayog Citizen PWA — QA Findings

**Staging URL:** https://bantayog-citizen-staging.web.app
**Date:** 2026-05-03
**Scope:** Citizen PWA — All tabs and flows

---

## 🔴 P0 — PRODUCTION BLOCKERS

| #        | Issue                                                                          | Root Cause                                                                                                                                                                                                                                                                                                                                                                                                                    | Fix                                                                                                        | Files                                             |
| -------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| **P0-1** | Receipt page stuck forever — "being processed" indefinitely; no tracking codes | `SubmitReportForm` routes to `TrackingScreen` (`/reports/{uuid}`) which fetches Firestore (async write may not be complete). `ReceiptScreen` at `/receipt` is **orphaned dead code** — requires `useLocation().state` with `{publicRef, secret}` but navigator passes **no state**. The emotional peak (RevealSheet warm cream gradient + JetBrains Mono reference code) is **trapped in a component that is never reached**. | Route to RevealSheet confirmation flow on submit success, or pass `{publicRef, secret}` via location state | `SubmitReportForm/index.tsx`, `ReceiptScreen.tsx` |
| **P0-2** | CORS error on `requestLookup` — users cannot track reports by code             | **Misdiagnosed**: Actually an **auth dependency**. `requestLookup` uses Firebase `onCall` which requires Firebase Auth. `LookupScreen` calls the callable with no sign-in attempt. Browser CORS preflight fails before response is read; the friendly error catch block never fires. Fix is a one-liner.                                                                                                                      | Add `await ensureSignedIn()` before the callable                                                           | `LookupScreen.tsx`                                |
| **P0-3** | SW registration fails silently — no retry, no user notification                | `main.tsx` `catch` block writes only to `console.error`. Users think they're offline-capable but are not. In a crisis this breaks trust completely.                                                                                                                                                                                                                                                                           | Add retry (3 attempts with backoff) + user-visible banner when SW fails                                    | `main.tsx`                                        |
| **P0-4** | iOS PWA not installable — all 5 meta tags missing                              | `index.html` missing `apple-mobile-web-app-capable`, `apple-touch-icon`, `apple-mobile-web-app-status-bar-style`, `apple-mobile-web-app-title`, `mask-icon`. iOS users entirely locked out.                                                                                                                                                                                                                                   | Add iOS PWA meta tags to `index.html`                                                                      | `index.html`                                      |
| **P0-5** | Push notifications toggle lies about its own state                             | When browser denies permission, toast fires "Failed" but `aria-checked` stays pre-click state. UI doesn't reflect actual permission outcome. Trust-through-calm violation.                                                                                                                                                                                                                                                    | Fix toggle state to reflect actual permission outcome                                                      | `SettingsPage.tsx`, `Toggle.tsx`                  |
| **P0-6** | GPS button missing from Step 2                                                 | `useGpsLocation` hook exists in code but the button UI is not rendered in `Step2WhoWhere`. Only manual barangay/municipality entry works.                                                                                                                                                                                                                                                                                     | Render the GPS/Use My Location button                                                                      | `Step2WhoWhere.tsx`                               |
| **P0-7** | Sign-out button missing from Settings                                          | Only "Delete my account" in Danger Zone. Canonical settings page has no session end action. `ProfileTab` has `signOut` but Settings (the canonical account controls) doesn't.                                                                                                                                                                                                                                                 | Add standalone Sign-out button                                                                             | `SettingsPage.tsx`                                |

---

## 🟡 P1 — HIGH PRIORITY

| #        | Issue                                                  | Root Cause                                                                                                                                                                            | Fix                                                                       | Files                                             |
| -------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------- |
| **P1-1** | Step 3 Submit button uses `danger-500` red             | DESIGN.md: "Red...never used as a primary CTA." Submit IS the primary forward action. Red = destructive = wrong at the moment of confirmation.                                        | Change to `bg-authority-navy` / `text-white`                              | `Step3Review.tsx`                                 |
| **P1-2** | FilterBar.tsx fully implemented but never rendered     | `MapTab/index.tsx` never imports or renders it. Filters state is hardcoded as a constant. Users see 36 markers with no way to filter by type.                                         | Import and render `<FilterBar>` with live `filters`/`setFilters` state    | `MapTab/index.tsx`                                |
| **P1-3** | Map marker icons have no click affordance              | Bare 16×16 circles with `cursor: grab`, no hover scale, no tooltip. Users don't know markers are tappable. Root cause of "36 markers but no click interaction."                       | Add `cursor: pointer`, scale transform on hover, or tooltip               | `IncidentLayer.tsx`, `MyReportLayer.tsx`          |
| **P1-4** | Feed shows empty while Map has 36 markers              | Different Firestore queries: Feed filters `where('visibilityClass', '==', 'public_alertable')`; Map does NOT use this filter. Different data sources = empty Feed = users lose trust. | Align `usePublicIncidents` query with Map marker query                    | `usePublicIncidents.ts`                           |
| **P1-5** | DeleteAccountFlow renders inline, not as a true dialog | `role="dialog"` content inline inside Settings page — no backdrop, no focus trap, no Escape handler, no return focus. Not discoverable as a dialog.                                   | Implement proper dialog with backdrop, focus trap, keyboard a11y          | `DeleteAccountFlow.tsx`                           |
| **P1-6** | Step 2 form data NOT persisted on page refresh         | `wizard-snapshot` IndexedDB exists but Step 2 fields are not restored after refresh.                                                                                                  | Ensure `Step2WhoWhere` accepts and uses `initialValues` wired to snapshot | `SubmitReportForm/index.tsx`, `Step2WhoWhere.tsx` |
| **P1-7** | Name input clears on Step 2 validation failure         | No inline error displayed; form state resets rather than showing error.                                                                                                               | Show inline `role="alert"` error below field, preserve form state         | `Step2WhoWhere.tsx`                               |
| **P1-8** | `beforeinstallprompt` captured but never surfaced      | `window.deferredInstallPrompt` stored on event but nothing ever reads it. No "Add to Home Screen" UI.                                                                                 | Add install button in Settings wired to `deferredInstallPrompt.prompt()`  | `SettingsPage.tsx`, `main.tsx`                    |

---

## 🟠 P2 — MEDIUM PRIORITY

| #         | Issue                                                        | Location      | Fix                                                                                |
| --------- | ------------------------------------------------------------ | ------------- | ---------------------------------------------------------------------------------- |
| **P2-1**  | Incident type buttons have no padding (cramped pills)        | Wizard Step 1 | Add `px-3 py-2` per DESIGN.md chip spec (8px v × 12px h)                           |
| **P2-2**  | Section labels not uppercase, wrong color/size               | All steps     | Apply DESIGN.md: `0.75rem/700 uppercase authority-navy`                            |
| **P2-3**  | Select dropdown has no bottom margin (stacks on name input)  | Wizard Step 2 | Add `mb-3` to dropdown                                                             |
| **P2-4**  | Review section rows bunched together (no vertical spacing)   | Wizard Step 3 | Add `gap-3` or `mb-3` between summary rows                                         |
| **P2-5**  | Consent text no margin from disabled Submit button           | Wizard Step 3 | Add `mb-3` below consent text                                                      |
| **P2-6**  | `MyReportLayer` markers identical to public incident markers | Map tab       | Make own-report markers visually distinct                                          |
| **P2-7**  | `issuedBy` missing on all alert cards AND detail sheet       | Alerts tab    | **Firestore data issue** — alerts in staging don't have `issuedBy` field populated |
| **P2-8**  | `issuedBy` missing on Feed tab alerts                        | Feed tab      | Same Firestore data population issue                                               |
| **P2-9**  | Tagline excessive top margin (32px)                          | Home page     | Reduce to 8–16px                                                                   |
| **P2-10** | DetailSheet unmounts/remounts on pin-type switch             | Map tab       | Unify to single render block with mode-aware content                               |
| **P2-11** | GPS coordinates in raw decimal format, not human-readable    | Wizard Step 2 | Show human-readable place name, not `14.10870, 122.94280`                          |
| **P2-12** | `#a73400` medium severity = 3.5:1 contrast on white          | Map markers   | Off-palette; adjust to meet 4.5:1 WCAG AA                                          |
| **P2-13** | Back navigation exits wizard entirely                        | Wizard        | Add explicit Back button within wizard (not browser back)                          |
| **P2-14** | No "Track another report" after successful lookup            | LookupScreen  | Add secondary action to dismiss or start new lookup                                |

---

## 🟢 P3 — DESIGN LAW VIOLATIONS (Polish / Brand Consistency)

| #         | Violation                                                                                | Rule                                                                                    | Fix                                                    |
| --------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| **P3-1**  | `GuardianPitchCard` uses `bg-gradient from-brand-500 to-brand-600`                       | DESIGN.md anti-reference: shopping-app gradient forbidden; brand-500/600 not in palette | Replace with solid authority-navy or remove gradient   |
| **P3-2**  | Primary CTA in GuardianPitchCard uses `text-brand-600` on white                          | DESIGN.md: primary CTA must be authority-navy (#001e40) with white text                 | Use `button-primary` component spec                    |
| **P3-3**  | `animate-pulse` without `prefers-reduced-motion` guard                                   | DESIGN.md Do: all animations must have no-motion alternative                            | Add `useReducedMotion` guard                           |
| **P3-4**  | `overflow-x-auto no-scrollbar` hides badge content                                       | PRODUCT.md inclusivity: hidden content not accessible to first-time smartphone users    | Add visible scroll indicator                           |
| **P3-5**  | 7 equal-weight sections on ProfileTab (registered user)                                  | PRODUCT.md: "every screen must work at 4% battery at 2am" — no primary action hierarchy | Establish visual hierarchy with one dominant CTA       |
| **P3-6**  | Selected filter chips use teal `#0f9488`                                                 | DESIGN.md Two-Anchor Rule: only navy + sienna                                           | Change selected chips to `authority-navy`              |
| **P3-7**  | Empty Feed shows green CheckCircle "All clear"                                           | DESIGN.md: false reassurance during active disaster erodes trust                        | Neutral "No incidents in this filter" instead          |
| **P3-8**  | Severity badges lack icons (alerts + feed)                                               | DESIGN.md Status Trio Rule: icon + label + color always                                 | Add Siren/Bell/Info icons to severity pills            |
| **P3-9**  | 4px left border stripes on alert cards                                                   | DESIGN.md 1px border limit rule                                                         | Reduce to 1px max or replace with leading icon         |
| **P3-10** | Severity badge colors entirely off-palette                                               | DESIGN.md: only 4 status colors defined                                                 | Map to spec or formally extend                         |
| **P3-11** | Fabricated colors not in palette: `#f0f4f4`, `#0f9488`, `#25292a`                        | DESIGN.md tonal surface system                                                          | Replace with palette tokens                            |
| **P3-12** | Body copy at `text-xs` (12px) in alert cards                                             | DESIGN.md Body spec: `1rem/400` minimum                                                 | Bump to `text-sm` minimum                              |
| **P3-13** | Filipino caption at `0.6875rem` (11px) below WCAG AA                                     | WCAG AA minimum 12px for body text                                                      | Bump to `0.75rem` minimum                              |
| **P3-14** | Toggle `aria-label` collision (button inside `role="group"`)                             | a11y best practice                                                                      | Deduplicate or remove `role="group"` wrapper           |
| **P3-15** | Tagalog absent on core field labels                                                      | PRODUCT.md inclusive-by-default                                                         | Add Tagalog equivalents to "Your name", "Phone number" |
| **P3-16** | `DeleteAccountFlow` "Delete" button uses `style={{ color: 'red' }}` without `aria-label` | a11y                                                                                    | Add `aria-label` or use semantic color class           |

---

## ✅ CONFIRMED WORKING

| Feature                                                                | Status                     |
| ---------------------------------------------------------------------- | -------------------------- |
| Wizard E2E flow (Step 1 → 2 → 3 → Submit)                              | ✅ Functional end-to-end   |
| Step 2 validation (disabled Continue until fields complete)            | ✅ Correct                 |
| Error `role="alert"` for missing incident type                         | ✅ Accessible              |
| RevealSheet component (9/10 — Excellent)                               | ✅ Best-designed component |
| Onboarding flow                                                        | ✅ Works                   |
| Map tab Leaflet + OSM tiles rendering                                  | ✅                         |
| Alerts tab severity icons and border colors                            | ✅                         |
| `sw.js` implementation (rejection-gating, SPA fallback, cache cleanup) | ✅                         |
| Profile tab for unauthenticated users (8/10 visual)                    | ✅                         |
| LookupScreen error messages (friendly, non-technical)                  | ✅                         |
| `requestPermission` / `disable` Firebase messaging wrappers            | ✅                         |
| Storage estimate display in Settings                                   | ✅                         |
| Step 2 back-navigation state loss (known gap, deferred)                | ⚠️                         |

---

## ❌ MISSING ALTOGETHER

| Feature                            | Status                                 |
| ---------------------------------- | -------------------------------------- |
| Filter bar on Map tab              | Code exists, not rendered              |
| Data Export button in Settings     | Not in UI (callable exists)            |
| Sign-out button in Settings        | Only Delete account present            |
| GPS button in Step 2               | Hook exists, button not rendered       |
| Alert filter/sort controls         | Not implemented                        |
| Back button within wizard          | Browser back exits entirely            |
| "Track another report" post-lookup | Not implemented                        |
| SW failure user notification       | Not implemented                        |
| iOS PWA install path               | Meta tags missing                      |
| installed prompt UI                | Deferred install prompt never surfaced |

---

## Priority Fix Order

1. **P0-2** — `await ensureSignedIn()` before `requestLookup` (1 line)
2. **P0-6** — GPS button in Step 2 (small UI addition)
3. **P0-1** — Receipt page routing (architectural — biggest UX gap)
4. **P1-2** — FilterBar rendered in MapTab (1 import line + state)
5. **P1-3** — Marker click affordance (CSS change)
6. **P1-1** — Submit button color: danger-500 → authority-navy
7. **P0-3** + **P0-4** — SW retry + iOS meta tags
8. **P0-5** — Push toggle state fix
9. **P1-8** — Install prompt UI in Settings
10. **P1-4** — Feed/Map query alignment (data correctness)
