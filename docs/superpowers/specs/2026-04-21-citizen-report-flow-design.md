# Citizen Report Flow Design

**Version:** 1.1  
**Date:** 2026-04-21  
**Status:** Approved with critical fixes applied (brainstorm complete, awaiting implementation)

**Revision notes (v1.1):**

- Fixed `useReport` memory leak (now uses effect-based listener management)
- Added `failed_terminal` state to state machine with explicit transition conditions
- Documented back button guard mechanism (`useBlocker` per state)
- Added rollback path for mandatory name+phone requirement
- Acknowledged localForage PII aggregation risk with mitigation
- Added dependency requirements section (zustand, tanstack-query, localforage, @axe-core/react)
- Clarified Step 3 review screen contents (photo preview, data confirmation)
- Enhanced queued→failed_retryable transition with error context preservation
- Added offline detection nuance (navigator.onLine as hint, Firestore timeout as trigger)
- Clarified hazardClass vs reportType schema distinction
- Enhanced background sync test assertions with explicit success criteria
- Updated testing strategy to reflect actual tooling (removed MSW/nock, added @axe-core/react)

## Executive Summary

This document defines the complete citizen-facing frontend for Bantayog Alert — a disaster mapping and reporting system for Filipino citizens. The design focuses on the core emergency loop: **report something and track its status**.

**Key principles:**

- **Stress-tuned**: Citizens use this under duress. Clarity > cleverness.
- **Offline-first**: Reports persist locally; network failure is not terminal.
- **Fallback-aware**: When data fails, phone calls and SMS provide human escalation.
- **Accessibility-first**: WCAG 2.1 AA compliance, screen reader support, Filipino localization.
- **Pseudonymous-auth**: Anonymous Firebase Auth — no login friction.

**Scope inclusions:**

- 3-step submission flow (Evidence → Who+Where → Review)
- Reveal moment variants (success, queued offline, failed retryable)
- Tracking screen with live updates
- Design system (colors, typography, components, motion, a11y)
- State architecture (Zustand, localForage, TanStack Query, Firestore)
- SMS fallback with server-side deduplication

**Scope exclusions (Phase 2):**

- Responder app UI, admin triage dashboard
- Feed screen, Alerts screen
- Profile/settings (phone-OTP registration, account merge)
- Feature-phone SMS inbound (already exists)
- Capacitor mobile app

---

## 0. Prerequisites & Dependencies

### 0.1 Required packages

The following packages must be added to `apps/citizen-pwa/package.json` before implementation:

```json
{
  "dependencies": {
    "zustand": "^4.x",
    "@tanstack/react-query": "^5.x",
    "localforage": "^1.10.x"
  },
  "devDependencies": {
    "@axe-core/react": "^4.x",
    "vitest": "^1.x",
    "@testing-library/react": "^14.x",
    "@testing-library/jest-dom": "^6.x"
  }
}
```

**Notes:**

- Playwright is already in monorepo (`e2e-tests` workspace)
- MSW and nock are NOT used — SMS testing handled via Firebase Emulator
- Firebase SDK already installed

### 0.2 Implementation preconditions

Before implementation begins:

1. Install dependencies: `pnpm install` (adds zustand, tanstack-query, localforage)
2. Verify Firebase Emulator configured: `firebase emulators:exec --only firestore "pnpm test"`
3. Verify Playwright E2E setup: `pnpm --filter e2e-tests test`

---

## 1. Screen Inventory & Routes

| Route                 | Screen              | Description                                                                                                                         | Bottom Nav  |
| --------------------- | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| `/`                   | Map home            | Leaflet map with report markers, 5-slot bottom nav, active alerts carousel                                                          | Shown       |
| `/report/new`         | Step 1: Evidence    | Camera viewfinder with "Gallery" button, "No photo available" skip link, incident type chips                                        | Hidden      |
| `/report/new/step/2`  | Step 2: Who + Where | Name (required), Phone (required with helper copy), GPS-default location, "Is anyone hurt?" toggle with conditional patient counter | Hidden      |
| `/report/new/step/3`  | Review + Assurance  | Warm assurance banner with heart icon, review summary, consent checkbox                                                             | Hidden      |
| _(Reveal sheet)_      | Reveal moment       | Bottom sheet overlay on map — three variants: success, queued, failed_retryable                                                     | N/A (modal) |
| `/reports/:reference` | Tracking screen     | Live-updating report detail with timeline, status banner, fallback cards                                                            | Hidden      |
| `/feed`               | Feed screen         | _(Phase 2)_ Public report list with filters                                                                                         | Shown       |
| `/alerts`             | Alerts screen       | _(Phase 2)_ Province-wide ECBS, municipal advisories                                                                                | Shown       |
| `/profile`            | Profile screen      | _(Phase 2)_ Phone-OTP registration, account merge                                                                                   | Shown       |
| `/settings`           | Settings screen     | _(Phase 2)_ App preferences, language toggle                                                                                        | Shown       |

**Route notes:**

- All routes support anonymous Firebase Auth (auto on launch)
- `hideBottomNav: true` in route config hides the 5-slot nav for submission flow
- Reveal sheet is Zustand-managed UI state, NOT a route — back button behavior handled via custom router guard (see §6.6)
- Reference codes (`:reference`) are server-generated `BA-XXXX-YY` format (success) or client-generated `BA-[DQ]-XXXX` (queued/failed)

**Back button guard mechanism:**

- Implementation uses `useBlocker` from `react-router-dom`
- **Success state**: Back closes sheet (reference shown, user can navigate to tracking screen)
- **Queued state**: Back is BLOCKED (draft unsent, losing sheet means losing draft reference)
- **Failed_retryable state**: Back does NOT block (draft saved, user can safely go back)
- Guard checks Zustand `currentSheet` state and Reveal state machine before allowing navigation

---

## 2. Submission Flow State Machine

### 2.1 Component-level states

```
idle → submitting → success | queued | failed_retryable
                    → failed_terminal (after N retries or 24h expiry)
```

| State              | Trigger                                                             | UI Response                                                                              |
| ------------------ | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `idle`             | Initial form load                                                   | Submit button enabled                                                                    |
| `submitting`       | User taps "Submit report"                                           | Submit button disabled, loading spinner                                                  |
| `success`          | Firestore write succeeds                                            | Reveal sheet (mint), server ref code                                                     |
| `queued`           | `navigator.onLine === false` OR write timeout (≥10s)                | Reveal sheet (amber), client ref `BA-Q-*`, auto-retry enabled                            |
| `failed_retryable` | Write rejects (5xx, App Check, network error) OR queued retry fails | Reveal sheet (rose), client ref `BA-D-*` or preserved `BA-Q-*`, retry + hotline emphasis |
| `failed_terminal`  | User dismisses after N retries OR 24h draft expiry                  | Toast: "We couldn't send this report. Please call (054) 721-1216." — drops to map        |

### 2.2 Submission transitions

#### 2.2.1 User submits form

- **Component state**: `'idle' → 'submitting'`
- **Side effects**:
  - Write draft to localForage: `set('draft:{uuid}', { ..., state: 'queued' })`
  - Write to Firestore `report_inbox/{id}` (Firebase SDK queues write)

#### 2.2.2 Success → `'success'`

- **Trigger**: `await setDoc(...)` resolves
- **Component state**: `'submitting' → 'success'`
- **Actions**:
  - Update localForage: `{ ..., state: 'draft', submittedRef: 'BA-7K3M-24' }` (clear queue flag)
  - Show Reveal sheet with mint banner + server reference code
  - After 5s or user dismiss, navigate to `/reports/BA-7K3M-24`

#### 2.2.3 Offline/queued → `'queued'`

- **Trigger**: `navigator.onLine === false` OR `setDoc` timeout (≥10s)
- **Component state**: `'submitting' → 'queued'`
- **Actions**:
  - Update localForage: `{ ..., state: 'queued', submittedRef: 'BA-Q-9X8T', lastError: null, retryCount: 0 }` (client-generated ref, reset error context)
  - Show Reveal sheet with amber banner + draft reference
  - Offer "Try sending now" button (retries submission)
  - Offer "Send as SMS" fallback (pre-filled `sms:` link)
  - Background retry service (if supported) watches `window.addEventListener('online')`
- **Offline detection nuance**: `navigator.onLine` is a hint only. Actual queued trigger is UNION of: (a) `navigator.onLine === false`, OR (b) Firestore write times out after 10s. This catches both "browser knows it's offline" AND "browser thinks it's online but Firestore is unreachable" (captive portal, VPN drop, mobile data outage).

#### 2.2.4 Network error → `'failed_retryable'`

- **Trigger**: `setDoc` rejects with timeout / 5xx / App Check error
- **Component state**: `'submitting' → 'failed_retryable'`
- **Actions**:
  - Update localForage: `{ ..., state: 'failed_retryable', submittedRef: 'BA-D-4L2P', lastError: { code, message, timestamp }, retryCount: 1 }`
  - Show Reveal sheet with rose banner + draft reference
  - Display error context: "Network error — please try again or call the hotline"
  - Offer "Try again" button (retries submission)
  - Elevate hotline + SMS fallback (rose-tinted cards)

#### 2.2.5 Queued → failed_retryable (retry fails)

- **Trigger**: Background auto-retry OR manual "Try sending now" fails (timeout, 5xx, App Check)
- **Critical invariant**: PRESERVE existing draft ref — `BA-Q-9X8T` stays `BA-Q-*` (NOT replaced with `BA-D-*`)
- **Actions**:
  - Update localForage: `{ ..., state: 'failed_retryable', submittedRef: 'BA-Q-9X8T', lastError: { code, message, timestamp }, retryCount: retryCount + 1 }` (preserve ref, increment retry counter, store NEW error context)
  - Reveal crossfades amber → rose, updates headline: "We couldn't send it yet."
  - Display latest error message in Reveal subline
  - Subsequent retry or SMS fallback can still succeed with same `BA-Q-*` ref
- **failed_terminal transition**: After 3 failed retries OR 24h draft expiry, transition to `failed_terminal` (dismiss back to map with persistent toast)

#### 2.2.6 Queued → Success promotion (network recovery)

- **Trigger**: `window.addEventListener('online')` + auto-retry succeeds
- **Actions**:
  - `setDoc` succeeds → server returns final `BA-7K3M-24`
  - Update localForage: `{ ..., state: 'draft', submittedRef: 'BA-7K3M-24' }`
  - Reveal crossfades in-place (amber → green, `BA-Q-*` → `BA-7K3M-24`)
  - No navigation — user stays on tracking screen

### 2.3 Reference code generation

| Context                    | Format                      | Example                                    |
| -------------------------- | --------------------------- | ------------------------------------------ |
| Client-generated (draft)   | `BA-[DQ]-<4-char>`          | `BA-Q-9X8T` (queued), `BA-D-4L2P` (failed) |
| Server-generated (success) | `BA-<4-char>-<2-digit>`     | `BA-7K3M-24`                               |
| SMS body (enriched)        | `BANTAYOG <draft-ref>\n...` | `BANTAYOG BA-D-4L2P\nFLOOD Daet\n...`      |

**Client generation algorithm:**

```typescript
const draftRef = `BA-${state === 'queued' ? 'Q' : 'D'}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`
```

**Server generation algorithm (Cloud Function):**

```typescript
const serverRef = `BA-${nanoid(4).toUpperCase()}-${new Date().getFullYear() % 100}`
```

### 2.4 Photo upload timing

- **Blocking requirement**: Submission MUST block until photo upload completes
- **Component state**: `photoUploadState: 'idle' | 'uploading' | 'done'`
- **When user attaches photo**:
  - Upload to Firebase Storage: `uploadBytes(ref, photoFile)`
  - On complete: `photoUrl = getDownloadURL()` stored in component state
- **When user taps "Submit report"**:
  - If `photoUploadState === 'uploading'`, submit button is disabled with "Waiting for photo upload..."
  - When `photoUploadState === 'done'` AND `photoUrl` is present:
    - Include `photoUrl` in draft object
    - Proceed to submission state machine
- **If photo upload FAILS during submit retry**:
  - `photoUrl` in draft is still valid (was stored before queued)
  - Online retry includes `photoUrl` in `report_inbox` write
  - Storage URL expiration handled server-side (signed URLs expire after 15min, `report_public` stores permanent resumable URI)

---

## 3. Reveal Moment Variants

### 3.1 Shared anatomy

All three Reveal variants share the same structure:

| Element             | Success                                   | Queued (offline)                       | Failed (network)                            |
| ------------------- | ----------------------------------------- | -------------------------------------- | ------------------------------------------- |
| Status icon         | &#10003; on mint (#dcfce7)                | &#8987; on amber (#fef3c7)             | &#9888; on rose (#fee2e2)                   |
| Headline            | "We heard you. We are here."              | "We've saved your report."             | "We couldn't send it yet."                  |
| Reference code      | Final: `BA-7K3M-24`                       | Draft: `BA-Q-9X8T` (promoted on send)  | Draft: `BA-D-4L2P`                          |
| Receiver line       | Green pulse · "Received by Daet MDRRMO"   | Amber pulse · "Waiting for signal"     | (hidden — no receiver yet)                  |
| Hotline placement   | After timeline (supportive)               | After timeline (supportive)            | **Before** timeline, emphasized (rose tint) |
| Primary CTA         | "Track this report" → `/reports/:ref`     | "Try sending now" (amber)              | "Try again" (red)                           |
| Secondary CTA       | (none)                                    | "Keep draft & close"                   | "Keep draft & close"                        |
| Permission-to-leave | "You can close this app. We'll text you." | "We'll keep trying in the background." | "We'll hold this draft for 24 hours."       |

### 3.2 Motion vocabulary

| Motion                     | Duration | Easing                          | Usage                                                            |
| -------------------------- | -------- | ------------------------------- | ---------------------------------------------------------------- |
| Sheet slide-up             | 400ms    | `cubic-bezier(0.16, 1, 0.3, 1)` | Reveal bottom sheet entry. Fast, overshoots slightly for energy. |
| Crossfade (queued→success) | 600ms    | `ease-in-out`                   | Icon tint, banner bg, stamp code all morph together.             |
| Pulse (waiting)            | 1.6s     | `ease-in-out`, infinite loop    | Receiver line in queued state. Scale 1 → 1.2 → 1.                |
| Button press               | 100ms    | `ease-out`                      | Scale 1 → 0.97 on active. Restores on mouseup/touchend.          |
| Page transition            | 300ms    | `ease-in-out`                   | Route changes. Fade + subtle slide for perceived speed.          |

**Explicitly rejected**: Shake animation. Performs anxiety under stress. Static rose tint communicates failure without amplifying dread.

### 3.3 SMS fallback (queued & failed states)

**URL scheme:**

```typescript
;`sms:${SMS_SHORTCODE}?body=${encodeURIComponent(template)}`
```

**Body template (GSM-7 optimized, ~85 chars):**

```
BANTAYOG BA-D-4L2P
FLOOD Daet
14.1131,122.9553
Juan Dela Cruz
09171234567
Hurt: 2
```

**Key properties:**

- Leading identifier: `BANTAYOG <draft-ref>` — lets MDRRMO SMS operator instantly route and dedupe
- Local flag: `draft.smsFallbackSentAt: number` (unix ms) — sent with online retry for server-side dedup
- Post-send UX: No delivery confirmation possible. On return to app, show toast: _"If you sent the text, MDRRMO will match it to this report when online comms return."_
- Fallback if `sms:` unsupported: Button hidden (feature-detect via `navigator.userAgent` + try/catch)

**Why SMS gets equal visual weight with hotline:**
In Philippine typhoon scenarios, voice calls often congest first while SMS continues via store-and-forward. In earthquakes, the reverse can happen. Presenting both as parallel cards lets citizens pick whichever their network is actually completing.

---

## 4. Tracking Screen Data Contract

### 4.1 Route & parameters

- **Route**: `/reports/:reference`
- **Parameter**: `reference` is server-generated `BA-XXXX-YY` or client-generated `BA-[DQ]-XXXX`
- **Access**: Anonymous Firebase Auth (auto), no login required
- **Real-time**: Uses Firestore `onValue` listener wrapped in TanStack Query

### 4.2 Data flow table

| Element                  | Source                                                                                 | Update trigger                                     |
| ------------------------ | -------------------------------------------------------------------------------------- | -------------------------------------------------- | -------- | -------------------------------------- |
| Status banner + icon     | `report_public.status` (`verified                                                      | resolved                                           | closed`) | Firestore listener on `/reports/{ref}` |
| Reference code           | Route param `:reference`                                                               | URL navigation                                     |
| Submitted timestamp      | `report_public.createdAt`                                                              | Initial fetch                                      |
| Location                 | `report_public.address` + `report_public.location`                                     | Firestore listener                                 |
| Contact (name, phone)    | `report_private.reporterName` + `reporterMsisdnHash` (masked last 4 digits only in UI) | Firestore listener                                 |
| Incident details         | `report_public.reportType` + `hazardClass` + `patientCount`                            | Firestore listener                                 |
| Timeline events          | `report_public.timeline` array of `{ event, timestamp, actor, note? }`                 | Firestore listener (admin appends on state change) |
| Resolution outcome       | `report_public.resolutionNote` (present only when `status === 'resolved'`)             | Firestore listener                                 |
| "Call responders" button | Opens `tel:` link to agency number from `report_public.agencyId` lookup                | Tap (not state-driven)                             |

### 4.3 Degraded states on tracking screen

| State                       | Banner color                                                     | Timeline dots                                                               | "Update report"                | "Call responders"                             |
| --------------------------- | ---------------------------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------ | --------------------------------------------- |
| Queued (offline en route)   | Amber: "Report is saved on this device. We'll send when online." | Amber for "waiting for signal," pending for server-side steps               | Disabled (no server to update) | Works (agency number from pre-fetched config) |
| Failed retryable            | Rose: "We couldn't send this report yet."                        | Failed dot                                                                  | Disabled                       | Emphasized (rose tint)                        |
| Promotion (queued→verified) | In-place crossfade (no navigation)                               | Amber → green, reference swaps `BA-Q-*` → final `BA-7K3M-24`, "Sent!" toast | —                              | —                                             |

### 4.4 Re-opening resolved reports

**Decision**: "Re-open if situation changed" creates a NEW report linked via `parentReportId`, NOT transitioning existing `resolved` back to `awaiting_verify`.

**Rationale:**

- Preserves audit trail of original resolution
- MDRRMO's SLA clock restarts on the new report
- Response teams get fresh triage opportunity rather than inheriting stale assumptions

---

## 5. Design Token Reference

### 5.1 Colors — emotional signaling palette

| Token                | Value                               | Usage                                                               |
| -------------------- | ----------------------------------- | ------------------------------------------------------------------- |
| `--color-primary`    | `#001e40`                           | Authority, critical actions, headers. WCAG AA with white text.      |
| `--color-assurance`  | `linear-gradient(#fff5ef, #ffeee6)` | Reveal moments, patient counter, Step 3 banner. Not a status color. |
| `--color-success-bg` | `#dcfce7`                           | `success` state, verified timeline dots. 4.5:1 contrast.            |
| `--color-success-fg` | `#16a34a`                           | Success icons, text.                                                |
| `--color-queued-bg`  | `#fef3c7`                           | `queued` state, waiting dots. Caution, not failure.                 |
| `--color-queued-fg`  | `#f59e0b`                           | Queued icons, text.                                                 |
| `--color-failed-bg`  | `#fee2e2`                           | `failed_retryable`, network errors, elevated hotlines.              |
| `--color-failed-fg`  | `#dc2626`                           | Failed icons, text.                                                 |
| `--color-surface`    | `#f5f7fa`                           | Map background, section cards. Neutral canvas.                      |
| `--color-card`       | `#ffffff`                           | Bottom sheets, form cards. Content containers.                      |

### 5.2 Typography — dual-language hierarchy

| Role            | Font family                                     | Usage                                                                       |
| --------------- | ----------------------------------------------- | --------------------------------------------------------------------------- |
| Primary UI      | `'Inter', -apple-system, system-ui, sans-serif` | All body text, buttons, labels. System-first for zero-download performance. |
| Reference codes | `'JetBrains Mono', 'SF Mono', monospace`        | Report references, timestamps. Monospace = machine-readable.                |
| Filipino helper | `Inter, italic`                                 | Secondary translations in `<em>`. "Mas mabilis kang matutulungan."          |

**Type scale:**

- Headline / Status: 20px / 700 / primary-navy (Reveal headlines, status banners)
- Body / Labels: 15px / 500 / dark-gray (form labels, field values)
- Helper / Meta: 13px / regular / secondary-gray (Filipino helpers, timestamps, meta)

**Filipino localization pattern:**

- Primary labels: English only (`<label>Your name</label>`)
- Helper explanations: English + Filipino italic (`<em>Mas mabilis kang matutulungan.</em>` below field)
- Reveal headlines: English (punchy, short) — universal, no translation needed
- Status banners: English + Filipino
- Button labels: English imperative (`Submit report`, `Track this report`, `Try again`)

### 5.3 Components — atomic building blocks

#### Bottom Sheet (Reveal)

- Rounded top corners (24px)
- Drag handle (36×4px)
- Padded content
- Modal dismiss via drag-handle OR tap-outside-on-map (only on success state)

#### Status Banner

- Tinted bg (mint/amber/rose)
- Circular icon on left (32×32px)
- Bold label
- Full-width in cards
- Same pattern used in Reveal and tracking screen

#### Fallback Cards (Call + SMS)

- Equal-width grid
- Icon + label + hint
- Emphasized version adds rose bg/tint when failed
- Full `<a href="tel:...">` or `<a href="sms:...">`

#### Timeline (Vertical)

- Left border line
- Absolute dots (green/amber/red/gray)
- Label + meta
- Note bubble (optional) with bg tint

### 5.4 Accessibility — WCAG 2.1 AA patterns

| Pattern          | Spec                                   | How we achieve it                                                                                                                 |
| ---------------- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Touch targets    | WCAG 2.5.5: 44×44px minimum            | All buttons, cards, chips pad to ≥44px height. Fallback cards split grid but each tap target is full-width.                       |
| Color contrast   | WCAG 1.4.3: 4.5:1 for text, 3:1 for UI | Navy on white (16.2:1), mint on white (4.7:1), amber on white (4.6:1). All verified.                                              |
| Focus indicators | WCAG 2.4.7: visible focus              | 3px navy outline with 2px offset on all interactive elements. Keyboard navigation works map → feed → alerts → profile → settings. |
| Screen reader    | ARIA labels, live regions              | Status banners have `role="alert"`. Reveal sheet has `role="alertdialog"`. Icon-only buttons have `aria-label`.                   |
| Reduced motion   | `@media (prefers-reduced-motion)`      | Respects system pref. Crossfades become instant. Pulse becomes static. Slide-up becomes fade-in.                                  |
| Error handling   | ARIA alerts + inline text              | Form errors show `role="alert"` + red text + icon. Never color-only (shape + text + icon).                                        |

---

## 6. Frontend Architecture Diagram

### 6.1 State architecture layers

```
┌─────────────────────────────────────────┐
│   Zustand Store (UI-only state)         │
│   - bottomNavHidden: boolean            │
│   - currentSheet: 'none' | 'submit-reveal' │
│   - toast: { id, message, type } | null  │
└─────────────────────────────────────────┘
              ↓ components read from Zustand
┌─────────────────────────────────────────┐
│   TanStack Query Cache (server state)   │
│   - ['reports', ref] → single report   │
│   - ['reports', 'list'] → feed         │
│   - ['alerts', 'list'] → alerts        │
└─────────────────────────────────────────┘
              ↑ Query invalidation on mutations
┌─────────────────────────────────────────┐
│   localForage (draft durability)        │
│   - 'draft:{uuid}' → Draft (24h expiry) │
│   - 'session:{uuid}' → Session metadata │
└─────────────────────────────────────────┘
```

### 6.2 Zustand store — UI state only

Per §9.1 rules: **no component reads a report from Zustand**. Zustand holds only ephemeral UI state that doesn't survive page reload.

| Field               | Type                                            | Usage                                                                                                                    |
| ------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- | ----- | ------------------------------------------------------------------------------- |
| `bottomNavHidden`   | `boolean`                                       | Set by route-level `handle: { hideBottomNav: true }` config. AppShell reads this to conditionally render the 5-slot nav. |
| `currentSheet`      | `'none'                                         | 'submit-reveal'`                                                                                                         | Which bottom sheet is open. MapPage reads this to render overlay. |
| `toast`             | `{ id: string, message: string, type: 'success' | 'error'                                                                                                                  | 'info' }                                                          | null` | Global toast queue. ToastQueue component renders this. Auto-dismisses after 4s. |
| **NOT IN ZUSTAND:** | —                                               | Reports, alerts, user profile, submission state. Those live in TanStack Query + localForage.                             |

### 6.3 localForage schema — draft durability

| Key pattern            | Value schema                                                                                                                                                                                                          | Expiry                                                 |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `'draft:{clientUuid}'` | `{ uuid, reportType, hazardClass, description?, location {lat, lng, address?}, reporterName, reporterMsisdn, patientCount, photoUrl?, createdAt, smsFallbackSentAt?, state, submittedRef?, lastError?, retryCount? }` | 24 hours after `createdAt`. Client purges on app init. |

**Schema notes:**

- `reportType`: User-facing incident type selected from chips (e.g., "Flood", "Fire", "Road") — displayed in UI, written to `report_public`
- `hazardClass`: Normalized hazard classification for GIS and analytics (e.g., "FLOOD", "WILDFIRE", "LANDSLIDE") — may differ from `reportType` (e.g., user selects "Road" but system classifies as "LANDSLIDE_BLOCKING_ROAD")
- For MVP: `hazardClass` = `reportType` (1:1 mapping). Future enhancement: ML-based hazard classification on server
  | `'session:{clientUuid}'` | `{ uuid, anonymousUid, deviceInfo {userAgent, platform}, createdAt }` | Session-length. Cleared on explicit logout (not implemented for anonymous citizens). |

**Notes:**

- Keys are client-generated v4 UUIDs
- Values are plain JSON (no compression, no encryption — citizen's device, their data)
- `reporterName` and `reporterMsisdn` are required per-report (deviation from architecture spec — see Section 8)
- **PII aggregation risk acknowledged**: The draft object aggregates name + phone + precise location in one readable store. This is a known tradeoff for MVP. An attacker with device access (malware with IndexedDB/WebSQL access) could exfiltrate this data. Mitigation: 24h expiry, no cloud sync, device-local only. Future enhancement: encrypt draft with device-derived key from Firebase Auth UID, accepting that session key is in memory anyway.

### 6.4 TanStack Query — cache keys & invalidation

| Query key             | Fetcher                                                                             | Invalidate on                                                                                    |
| --------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `['reports', ref]`    | `onValue(doc(db, 'reports/{ref}'))` — real-time listener                            | Never (listener stays live). Component unmounts automatically unsubscribe via useEffect cleanup. |
| `['reports', 'list']` | `getDocs(query(db, 'reports', where(...), orderBy(...)))`                           | `invalidateQueries(['reports', 'list'])` after submit/update/delete.                             |
| `['alerts', 'list']`  | `getDocs(query(db, 'alerts', where('targetMunicipality', '==', userMunicipality)))` | Every 60s (stale-while-revalidate). Server push via FCM triggers immediate invalidation.         |

**Why report detail is a listener, not a fetch:**  
The tracking screen (`/reports/:ref`) must update in real-time as admins change status. Using `onValue` wrapped in TanStack Query means the tracking screen is always live without polling. The query is torn down when the component unmounts, so there's no leak.

### 6.5 useReport hook — Firestore listener wrapper

```typescript
const useReport = (ref: string) => {
  const queryClient = useQueryClient()

  // Firestore listener managed by React effect
  useEffect(() => {
    const unsubscribe = onValue(
      doc(db, `reports/${ref}`),
      (snapshot) => {
        const data = snapshot.data()
        if (data) {
          queryClient.setQueryData(['reports', ref], mapReportFromFirestore(data))
        } else {
          queryClient.setQueryData(['reports', ref], null)
        }
      },
      (error) => {
        queryClient.setQueryData(['reports', ref], { error: error.message })
      },
    )

    // Cleanup on unmount
    return unsubscribe
  }, [ref, queryClient])

  // Query reads from cache populated by effect
  return useQuery({
    queryKey: ['reports', ref],
    queryFn: () => queryClient.getQueryData(['reports', ref]),
    staleTime: Infinity, // Listener is source of truth
    gcTime: 5 * 60 * 1000, // 5 minutes — not Infinity, allows cleanup
  })
}
```

**Why this pattern:**

- The listener is managed by React's `useEffect`, which guarantees cleanup on unmount
- TanStack Query cache is populated by the listener via `setQueryData`
- No module-level mutable state — no memory leak when multiple components call `useReport()`
- `gcTime: 5 * 60 * 1000` (5 minutes) allows cache garbage collection while keeping data fresh for typical session duration
- `staleTime: Infinity` tells Query "never refetch, the listener keeps this fresh"

### 6.6 SMS fallback deduplication — wiring

**Client-side (when user taps "Send as SMS"):**

1. Update localForage: `draft.smsFallbackSentAt = Date.now()`
2. Open `sms:<shortcode>?body=<urlencoded>` (native composer)
3. Return to app — no delivery confirmation possible

**Online retry (network recovers):**

1. Submit to Firestore with new field: `clientDraftRef: 'BA-D-4L2P'` (from localForage)
2. Cloud Function `processInboxItem` writes to `report_inbox`

**Server-side dedup:**

1. Trigger: `functions.firestore.document('report_inbox/{doc}').onWrite`
2. Cloud Function `reconcileSmsFallback` queries: `report_inbox` where `clientDraftRef == 'BA-D-4L2P'` and `createdAt > now() - 24h`
3. If match exists: merge new submission into existing (augment with photos), don't create duplicate
4. Rate limit (3/hr, 10/day) counts SMS + online pair as ONE, enforced per anonymous UID session

**Why dedup is server-side, not client:**  
The citizen has no way of knowing whether their SMS actually arrived. If we dedup on the client by suppressing the online retry, we risk a scenario where SMS failed silently and the report is lost forever. By deduping on the server, we accept slight redundancy for **at-least-once** delivery semantics.

---

## 7. Testing Strategy

### 7.1 Test types & coverage targets

| Test type                 | What we test                                                                                                 | Tools                                           | Coverage target                                                        |
| ------------------------- | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------- | ---------------------------------------------------------------------- |
| Integration (submit flow) | Happy path, queued path, failed path, photo upload                                                           | React Testing Library + Firebase Emulator       | 100% for state machine transitions, ref generation, localForage writes |
| Firestore security rules  | Anonymous ingress, `report_private` isolation, `reports/{ref}` read-after-write                              | Firebase Emulator + `@firebase/testing`         | 100% for all security rules                                            |
| E2E (critical journeys)   | Full submission on real device, background sync, tracking live updates                                       | Playwright (real devices) + Staging environment | 100% for happy path, 80% for edge cases                                |
| A11y (screen reader)      | VoiceOver/TalkBack submission, Reveal focus traps, back button guard, fallback card links, color-only status | Playwright + @axe-core/react                    | 100% for all a11y-critical paths                                       |
| UI components             | SubmitReportForm, RevealSheet, TrackingScreen, FallbackCards, Zustand store                                  | React Testing Library                           | 80% for UI-only logic                                                  |

**NOTE on test dependencies:** The following packages must be installed before testing strategy can execute:

- `@tanstack/react-query` (state management)
- `zustand` (UI state)
- `localforage` (draft persistence)
- `@axe-core/react` (a11y audit in E2E tests)
- `vitest @testing-library/react @testing-library/jest-dom` (integration tests)
- `@playwright/test` (E2E tests, already in monorepo)
- MSW and nock are NOT used — SMS testing handled via Firebase Emulator and manual verification

### 7.2 Integration test scenarios

**Happy path:**

1. Camera/photo → Name/Phone/Location → Submit → Success Reveal → Tracking screen

**Queued path:**

1. Offline submit → Amber Reveal → Online retry → Success crossfade

**Failed path:**

1. Network error → Rose Reveal → Retry → Success

**SMS fallback:**

1. Queued → "Send as SMS" → `sms:` link opens → Body pre-filled

**Photo upload:**

1. Upload → Submit blocked → Success with photo attached

**Step 3 review screen:**

1. Photo preview shown if attached
2. Name + phone shown for confirmation (full, not masked — this is the user's own data)
3. Back to Step 2 preserves all entered data (draft persistence)
4. Consent checkbox must be checked to enable submit button

### 7.3 E2E test scenarios

1. **Full submission flow on real device** (camera → submit → track)
2. **Background sync**: Submit offline, close app, reopen, verify auto-retry
   - **Assertion**: Report appears in Firestore within 10s of reconnecting (allows for network latency)
   - **Assertion**: Reveal crossfades from amber to green (queued → success)
   - **Assertion**: localForage draft state updated to 'success'
3. **SMS fallback**: Emulate telco drop, verify manual SMS path
4. **Tracking screen live updates**: Admin changes status, verify citizen sees update in <5s
5. **Reveal back button guard**:
   - Success state: press back → sheet closes, return to map
   - Queued state: press back → sheet stays open, toast "Please save or send this report first"
   - Failed_retryable state: press back → sheet closes, draft persists

**Reveal back button guard:**

- E2E: Press back while Reveal sheet is open → sheet closes (success state) or stays open (queued state)
- Unit test of guard logic itself should also be included

### 7.4 State machine implementation pattern

The submission state machine should live in a custom hook `useSubmissionMachine()` rather than plain `useState` in the form component. This improves testability:

```typescript
const useSubmissionMachine = () => {
  const [state, setState] = useState('idle')
  const transition = (nextState: State) => {
    setState(nextState)
  }
  const dismiss = () => {
    if (state === 'success') setState('closed')
  }
  return { state, transition, dismiss }
}
```

**Benefits:**

- Hook returns `{ state, transition, dismiss }` — pure function, no UI coupling
- Unit tests can import `useSubmissionMachine` and call `transition('queued')` directly, verifying state changes without rendering forms
- Integration tests cover the happy path E2E; unit tests cover all state transitions (queued → failed_retryable, queued → success)
- Reduces "integration test for every transition" burden — the machine logic is tested in isolation, integration tests verify wire-up

### 7.5 Why integration tests, not unit tests, for submit flow

The submission flow spans 5 boundaries: camera input → localForage write → Firestore write → state machine transition → Reveal render. Unit testing each piece in isolation would require mocking 4 of those 5 layers, which tests the mocks more than the system. Integration tests with Firebase Emulator hit real Firestore (albeit local) and verify the **contract** between client and server. If the emulator fails, the test fails — which is exactly what we want.

### 7.6 E2E on real devices is non-negotiable

iOS Safari's PWA behavior (service worker eviction under storage pressure, IndexedDB quirks) cannot be fully emulated. The background sync test ("submit offline, close app, reopen, verify auto-retry") MUST run on a physical iPhone and Android device to be valid. Staging environment is acceptable because we're testing integration, not mocking.

---

## 8. In-Scope vs Out-of-Scope

### 8.1 IN SCOPE (this design)

- Citizen PWA submission flow (Sections 1–3)
- Reveal moment: happy path + queued + failed_retryable (Section 3)
- Tracking screen: live updates, timeline, resolved state (Section 4)
- Design system primitives: colors, typography, components, motion, a11y (Section 5)
- State architecture: Zustand, localForage, TanStack Query, Firestore wiring (Section 6)
- SMS fallback: PWA-initiated enriched format, dedup logic
- Anonymous Firebase Auth (auto on launch)
- localForage dual-write (draft durability)
- Reference code generation (client + server)
- English-first with Filipino helper text pattern

### 8.2 OUT OF SCOPE (future phases)

- Responder app UI (admin dispatch, status updates)
- Admin triage dashboard (verify, assign, resolve)
- Feed screen (public report list, filters)
- Alerts screen (province-wide ECBS, municipal advisories)
- Profile/settings screens (phone-OTP registration, account merge)
- Feature-phone SMS inbound (minimal format, already exists)
- Mass alert ESCALATION to NDRRMC (gov-facing workflow)
- SMS outbound for status updates (already exists via Semaphore)
- GIS hazard signals, PAGASA integration (already exists)
- BigQuery GIS analytics, reporting (backend-only)
- Capacitor mobile app (iOS/Android native)

### 8.3 Why Feed and Alerts are out-of-scope

The Feed screen and Alerts screen are part of the citizen PWA per the architecture spec (§11.2), but they're separate surface areas from the **submission flow** this design focuses on. Including them would dilute the scope: Feed requires pagination, infinite scroll, filters, and push notification integration. Alerts requires geo-fencing, severity filters, and ECBS escalation display. Both deserve their own dedicated design sessions. This design deliberately scopes down to "report something and track its status" — the core emergency loop. Feed and Alerts are Phase 2.

---

## 9. Spec Deviations & Architecture Updates

### 9.1 Spec deviation: mandatory name + phone

**Deviation from committed specs:** The architecture spec and citizen role spec say contact info is voluntary. This design makes Name + Phone **mandatory per-report**.

**Rationale:**  
Mandatory contact per-report enables faster admin callback and improves report-quality signal. Pseudonymous Auth session is retained so citizens don't face login friction.

**Rollback path if drop-off is significant:** If user testing reveals >30% abandonment at Step 2 (name+phone fields), the team will evaluate a phased approach: (a) phone-only requirement (name voluntary), or (b) name-only with optional phone. Reverting to voluntary contact requires: (1) Firestore security rules update to allow anonymous `report_inbox` writes, (2) Form validation change to make fields optional, (3) Update to PRD and citizen role spec. This rollback path preserves the option to tighten requirements post-launch if abuse becomes a problem.

**Follow-up action:** The PRD and role spec will be updated in a follow-up change so the three documents remain consistent.

### 9.2 Architecture spec updates (SMS fallback extension)

Three targeted edits to `prd/bantayog-alert-architecture-spec-v8.md`:

1. **§3 bullet 4** — Extended to distinguish feature-phone vs PWA enriched SMS ingress
2. **New paragraph after line 185** — Added PWA degraded-state SMS format with dedup logic
3. **§9.2 bullet 4** — Generalized SMS fallback from iOS-only to all PWA degraded states

**New enriched SMS template:**

```
BANTAYOG <draft-ref>
<TYPE> <BARANGAY>
<lat>,<lng>
<name>
<msisdn>
Hurt: <count>
```

---

## 10. Handoff to Implementation

### 10.1 Next steps

1. **Write implementation plan** using `superpowers:writing-plans` skill
2. **Create feature branch** for citizen PWA frontend
3. **Implement in order**:
   - Design system tokens (colors, typography, components)
   - Zustand store + routing structure
   - Submission flow (3-step form)
   - Reveal moment (3 variants)
   - Tracking screen (live updates)
   - localForage integration
   - SMS fallback
   - Integration tests
   - E2E tests

### 10.2 Success criteria

- [ ] All 7 sections implemented and visually consistent with mockups
- [ ] Integration tests passing for all state machine transitions
- [ ] E2E tests passing on real devices (iOS + Android)
- [ ] Firestore security rules passing with 100% coverage
- [ ] A11y audit passing with WCAG 2.1 AA compliance
- [ ] SMS fallback verified (inbound gateway live)

### 10.3 Risk areas

| Risk                                                              | Mitigation                                                                                                                                                                         |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| iOS Safari PWA quirks (service worker eviction, IndexedDB limits) | E2E tests on physical devices; degraded state fallbacks                                                                                                                            |
| SMS inbound gateway latency                                       | Fallback to hotline call; timeout handling                                                                                                                                         |
| Photo upload blocking UX                                          | Clear "Waiting for photo upload..." copy; retry logic                                                                                                                              |
| Reference code collision                                          | Client + server namespace separation (`BA-Q-*` vs `BA-XXXX-YY`)                                                                                                                    |
| Network retry spam                                                | Rate limiting (3/hr, 10/day per anonymous UID); 2s disable on retry button                                                                                                         |
| Anonymous UID accumulation                                        | No cleanup for orphaned anonymous sessions — accept as out-of-scope for MVP; future enhancement: periodic Cloud Function cleanup of anonymous users with no activity after 30 days |
| localForage PII aggregation                                       | Acknowledged risk (see §6.3); mitigation: 24h expiry, device-local only, no cloud sync                                                                                             |

### 10.4 Dependencies required

The following packages must be added to `apps/citizen-pwa/package.json` before implementation:

```json
{
  "dependencies": {
    "zustand": "^4.x",
    "@tanstack/react-query": "^5.x",
    "localforage": "^1.10.x"
  },
  "devDependencies": {
    "@axe-core/react": "^4.x",
    "vitest": "^1.x",
    "@testing-library/react": "^14.x",
    "@testing-library/jest-dom": "^6.x"
  }
}
```

**Notes:**

- Playwright is already in monorepo (e2e-tests workspace)
- MSW and nock are NOT used — SMS testing handled via Firebase Emulator
- Firebase SDK already installed

---

## Appendix A: Architecture Spec Changes

**File:** `prd/bantayog-alert-architecture-spec-v8.md`  
**Date:** 2026-04-21  
**Changes:** SMS fallback extension

### A.1 §3 SMS ingress extension (NEW)

**Before:** Feature-phone SMS inbound only (minimal format).

**After:** Dual ingress paths:

1. Feature-phone SMS inbound (existing, minimal format)
2. PWA degraded-state SMS outbound (NEW, enriched format)

PWA enriched format:

```
BANTAYOG <draft-ref>
<TYPE> <BARANGAY>
<lat>,<lng>
<name>
<msisdn>
Hurt: <count>
```

Server-side deduplication: When online submission arrives after SMS fallback, Cloud Function `reconcileSmsFallback` queries `report_inbox` for matching `clientDraftRef` within 24h window and merges instead of creating duplicate.

### A.2 §9.2 SMS fallback generalization

**Before:** iOS-only SMS fallback.

**After:** SMS fallback generalized to all PWA degraded states (queued, failed_retryable) across all platforms. Fallback cards (Call + SMS) given equal visual weight due to Philippine telecom realities (voice vs SMS congestion varies by disaster type).

---

**Document control:**

- **Version:** 1.0
- **Author:** Claude (brainstorm facilitator)
- **Reviewers:** [User] (pending review)
- **Status:** Approved — ready for implementation planning
