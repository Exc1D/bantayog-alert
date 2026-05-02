# Citizen PWA — Comprehensive Fix-Up Plan

## Context

Following a deep post-implementation review of `apps/citizen-pwa`, six **must-fix issues**, eight **non-blocking concerns**, and five concrete **follow-up items** were identified. This plan addresses every item in a sequence of focused, independently shippable PRs.

The user has explicitly authorized a wider refactor (`max effort`, "address all the concerns now and implement the follow-up items"). Per CLAUDE.md §3, this overrides the default ≤3 files / ≤50 lines rule, but each PR still respects "one concern per branch."

**Out of scope** (deferred for product alignment): "I'm Safe" family circle, voice-note evidence, WhatsApp/Viber webhook, geohash share string, anonymous pulse map layer. These are speculative innovations that need product/UX brainstorming before implementation.

**User approval status:** Cluster 3 (schema change) and Cluster 6 (new backend callable + Storage write) are **pre-approved** for this session per user confirmation. Per CLAUDE.md §6/§8.4 the workflow still requires showing the actual diff before applying schema/rules edits and running emulator tests before any deploy. **No prod deploy in this session.** Staging promotion happens in a follow-up session after a 24h soak.

**Data export scope (locked):** The export envelope contains profile + reports + SMS messages **plus signed download URLs for any associated media**. This is the most RA 10173-compliant option.

---

## Cluster Map (7 PRs, sequenced)

| #   | Branch                            | Theme                                                               | Risk                    | Approval                    |
| --- | --------------------------------- | ------------------------------------------------------------------- | ----------------------- | --------------------------- |
| 1   | `fix/citizen-pwa-correctness`     | 6 must-fix bugs                                                     | LOW                     | implicit                    |
| 2   | `fix/citizen-pwa-reliability`     | retry, errors, FCM                                                  | LOW                     | implicit                    |
| 3   | `feat/per-jurisdiction-config`    | extend MunicipalityDoc, parameterize RevealSheet                    | MED (schema)            | **pre-approved, show diff** |
| 4   | `chore/citizen-pwa-cleanup`       | dead code + lazy-load + register-resume                             | LOW                     | implicit                    |
| 5a  | `feat/citizen-pwa-bg-sync`        | SW background sync                                                  | MED (SW)                | implicit                    |
| 5b  | `feat/citizen-pwa-image-compress` | client image downscale                                              | LOW                     | implicit                    |
| 6   | `feat/data-export-callable`       | real backend export pipeline (profile + reports + SMS + media URLs) | HIGH (new fn + Storage) | **pre-approved, show diff** |

**Hard ordering constraint:** Cluster 2 lands before Cluster 5a (otherwise the SW retry path collides with the in-component retry machine, producing double submits).

---

## Cluster 1 — Critical correctness (`fix/citizen-pwa-correctness`)

### F1. PWA install prompt

**File:** `apps/citizen-pwa/src/main.tsx` (lines 30–40)
**Problem:** `window.deferredInstallPrompt = deferredInstallPrompt` assigns once at module load (always `null`). The `beforeinstallprompt` handler only mutates the local `let`.
**Fix:** Move the `window` assignment INSIDE the handler. Drop the broken outer assignment and the `@ts-expect-error`. Type the window augmentation in `vite-env.d.ts`.

### F2. Wire dead Settings toggles

**Files:**

- `apps/citizen-pwa/src/pages/SettingsPage.tsx`
- `apps/citizen-pwa/src/hooks/useFcmToken.ts` (consume `bantayog_alert_sounds` in the `onMessage` handler — play a short beep via `new Audio('/notification.wav')` if true)
- `apps/citizen-pwa/src/hooks/useGpsLocation.ts` (consume `bantayog_location_auto`; if false, skip auto-fire on mount and require explicit "Use my location" tap in `Step2WhoWhere`)
- Add a tiny `apps/citizen-pwa/src/lib/userSettings.ts` shim with `getAlertSoundsEnabled()` / `getAutoLocationEnabled()` so consumers don't sprinkle `localStorage.getItem` everywhere.

The `bantayog_offline_mode` toggle stays as documentation-only since the SW already caches; if we drop it, that's separate UX. Keep the toggle but add a help tooltip explaining what it controls (current SW behavior).

### F3. Gate "Download my data" button (interim)

**File:** `apps/citizen-pwa/src/pages/SettingsPage.tsx` (lines 124–142, 239–252)
**Fix:** Replace the misleading success copy `"We'll email your data within 24 hours."` with an honest disabled-state badge: button label becomes `"Coming soon"`, hover/tap shows a small note: `"Data export is being rebuilt — available in the next release."`. The cooldown sessionStorage key can stay so we don't break existing tests, but the callable invocation is removed for now. Cluster 6 restores full functionality.

### F4. `failed_terminal` RevealSheet variant

**Files:**

- `apps/citizen-pwa/src/components/RevealSheet.tsx` — add a 4th entry to `REVEAL_VARIANTS` keyed `'failed_terminal'`. Copy: headline `"We couldn't send. Please call now."`, subline emphasising the hotline, banner variant `'danger'` (new), no auto-retry timeline.
- `apps/citizen-pwa/src/components/SubmitReportForm/index.tsx` (lines 249–259) — switch `failed_terminal` branch to use `state="failed_terminal"`.
- `apps/citizen-pwa/src/components/ui/StatusBanner.tsx` — add `'danger'` variant if missing (red bg, white text).

### F5. LoginPage tests (2 failures)

**File:** `apps/citizen-pwa/src/pages/__tests__/LoginPage.test.tsx`
**Approach:** Run the failing tests live (`cd apps/citizen-pwa && npx vitest run src/pages/__tests__/LoginPage.test.tsx`), read full stack trace and rendered DOM, identify whether the `RecaptchaVerifier` mock fails to populate `recaptchaVerifierRef.current` (most likely) or there's a real component regression. Likely fix: change mock from `vi.fn(() => mockRecaptchaVerifier)` to `vi.fn(function (this: unknown) { return mockRecaptchaVerifier })` so `new` semantics work cleanly. If a real bug appears, escalate per CLAUDE.md §7 before fixing.

### F6. Photo file size + MIME validation

**File:** `apps/citizen-pwa/src/components/SubmitReportForm/Step1Evidence.tsx` (line 144 `handlePhotoChange`)
**Fix:** Add limits as constants at top of file:

```js
const MAX_PHOTO_BYTES = 5 * 1024 * 1024 // 5 MB
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp'])
```

On selection: reject if `file.size > MAX_PHOTO_BYTES` or `!ALLOWED_MIME.has(file.type)`. Surface via existing toast (or local error state). Reset file input on rejection. Add 2 unit tests.

### F7. registerCitizen rollback / resume (promoted from Cluster 4)

**Files:**

- `apps/citizen-pwa/src/pages/RegisterPage.tsx` (lines 101–113)
- New: `apps/citizen-pwa/src/hooks/useResumeRegistration.ts` — on app bootstrap, detects "phone-linked auth user without `users/{uid}` doc" and routes to `/register?resume=true` (skip phone/OTP steps, jump straight to consent step).
- `apps/citizen-pwa/src/App.tsx` mounts the hook.

### Cluster 1 verification

- `pnpm lint && pnpm typecheck && npx vitest run` — all green
- Manual smoke: open Settings → toggle alert sounds → submit a fake FCM message via dev tools → hear beep
- Manual smoke: trigger PWA install prompt in Chrome devtools → verify `window.deferredInstallPrompt` is now non-null after the event fires

---

## Cluster 2 — Reliability (`fix/citizen-pwa-reliability`)

### R1. Exponential backoff in submission retry

**File:** `apps/citizen-pwa/src/hooks/useSubmissionMachine.ts` (lines 191–208)
**Fix:** Replace the instant `triggerRetry()` with a `setTimeout`-scheduled retry where delay = `Math.min(2 ** retryCount * 1000, 30_000)` (2s / 4s / 8s, capped 30s). Track timer in a ref and clear on unmount. Add 2 unit tests covering the timing behavior with `vi.useFakeTimers()`.

### R2. Sanitize LookupScreen errors

**File:** `apps/citizen-pwa/src/components/LookupScreen.tsx` (lines 42–43)
**Fix:** Map known `httpsCallable` error codes to friendly strings:

- `not-found` → "We couldn't find that report. Check your codes and try again."
- `permission-denied` → same friendly message (don't leak existence)
- `unauthenticated` → "Please refresh and try again."
- default → "Something went wrong. Please try again or call the hotline."
  Never surface raw `e.message` to the user. Keep `console.error(e)` for diagnostics.

### R3. useFcmToken complete rollback + setDoc merge

**File:** `apps/citizen-pwa/src/hooks/useFcmToken.ts`
**Fixes:**

- Replace `getDoc` + conditional `updateDoc` (lines 91–96, 161–164) with `setDoc(userRef, { fcmToken, fcmTokenUpdatedAt }, { merge: true })`. Saves a round-trip and removes the silent "doc doesn't exist" branch (a registered user always has a doc; if missing, that's a real bug worth surfacing).
- In the `requestPermission` rollback path (line 116–128), also call `unsubscribeFromAlerts({ token })` and clear `fcmToken: null` from Firestore. Currently leaves topic + Firestore desynced.
- Cleanup the `onMessage` listener if it was attached before failure.

### Cluster 2 verification

- `pnpm lint && pnpm typecheck && npx vitest run`
- Manual: throttle network to "Slow 3G" in devtools, submit a report, watch retry timing in console (should be 2s → 4s → 8s, not instant).
- Manual: deny notification permission mid-flow, verify Firestore `users/{uid}.fcmToken` is cleared.

---

## Cluster 3 — Per-jurisdiction config (`feat/per-jurisdiction-config`)

**Status: pre-approved this session. Show the actual `municipalities.ts` diff before saving.**

### R4. Extend `MunicipalityDoc`

**File:** `packages/shared-validators/src/municipalities.ts`
**Diff:** Add three optional fields to `municipalityDocSchema`:

```ts
mdrrmoLabel: z.string().min(1).max(80).optional(),         // "Daet MDRRMO"
mdrrmoHotline: z.string().regex(/^\+?\d[\d\s\-()]{6,20}$/).optional(),
mdrrmoSmsShortCode: z.string().regex(/^\d{3,6}$/).optional(),
```

Backfill all 12 entries in `CAMARINES_NORTE_MUNICIPALITIES` with defaults (Daet gets the existing values; others get pilot placeholders that match the project's documented rollout state, or `undefined` until verified).

### R5. Re-seed via existing bootstrap script

**File:** `scripts/bootstrap-municipalities.ts`
The script uses `batch.set()` (idempotent overwrite). Re-run on emulator first, then staging after explicit approval. No data migration needed beyond re-running this.

### R6. New hook `useMunicipalityContact`

**New file:** `apps/citizen-pwa/src/hooks/useMunicipalityContact.ts`
**Behavior:** Takes a `municipalityId` (or undefined for fallback), `onSnapshot`s `municipalities/{id}`, returns `{ label, hotline, smsShortCode }`. Falls back to a project-wide default when the municipality doc lacks fields (from a `DEFAULT_CONTACT` constant in the hook). Renders synchronously with the fallback while the snapshot loads.

### R7. Parameterize RevealSheet

**File:** `apps/citizen-pwa/src/components/RevealSheet.tsx`
**Diff:**

- Remove `HOTLINE_NUMBER` constant (line 14).
- Accept new props: `municipalityId?: string`.
- Replace hardcoded "Daet MDRRMO" in `REVEAL_VARIANTS` strings with a function that takes `contact.label` and returns the templated copy.
- `handleCallHotline` reads `contact.hotline`; `handleSmsFallback` uses `contact.smsShortCode`.
- Replace fake timestamp literals (`'2:14 PM'`) in `timelineEvents` with a `formatTime(now)` call so users see a real timestamp.

### R8. Wire municipalityId from caller

**File:** `apps/citizen-pwa/src/components/SubmitReportForm/index.tsx`
**Diff:** When rendering RevealSheet inside `SubmissionPanel`, pass `municipalityId={draft.municipalityId}`.

### Cluster 3 verification

- Re-run `bootstrap-municipalities.ts` against emulator
- Submit a Daet report, verify RevealSheet shows "Daet MDRRMO" + correct hotline
- Submit a Mercedes report, verify it shows "Mercedes MDRRMO" + the seeded contact (or fallback)
- `pnpm typecheck` across all packages (schema is consumed by both apps + functions)
- Confirm `infra/firebase/firestore.rules` — no `keys().hasOnly()` constraint on `municipalities/*` collection (verified during planning: no rules block exists for it; admin-only writes via Admin SDK)

---

## Cluster 4 — Performance & cleanup (`chore/citizen-pwa-cleanup`)

### P1. Lazy-load RevealSheet

**Files:**

- `apps/citizen-pwa/src/components/SubmitReportForm/index.tsx`
- New: `apps/citizen-pwa/src/components/RevealSheet.lazy.tsx` (1-line `React.lazy(() => import('./RevealSheet'))` wrapper)
  Wrap usages in `<Suspense fallback={null}>` since the sheet is only shown after submission button press — bundle saves ~40KB (framer-motion + this 500-line component).

### P2. Delete dead code

**Files to delete:**

- `apps/citizen-pwa/src/lib/photoUpload.ts` (no consumers)
- `apps/citizen-pwa/src/lib/draftManager.ts` (no consumers)
- `apps/citizen-pwa/src/lib/localforage.ts` (only `draftManager.ts` imports it, which is also dead)
- The unused `submitReport` export in `apps/citizen-pwa/src/services/submit-report.ts` (keep `createDraft`)

Run `pnpm lint && pnpm typecheck` to confirm no orphaned imports.

### P3. Replace `getDoc`+`updateDoc` with `setDoc({merge:true})` in any other site

Sweep `apps/citizen-pwa/src/` for the same anti-pattern. Already covered in R3 for FCM; verify nothing else does it.

### Cluster 4 verification

- `pnpm lint && pnpm typecheck && npx vitest run`
- Build size: `pnpm build` and compare `dist/assets/*.js` sizes before/after lazy-load

---

## Cluster 5a — Service Worker background sync (`feat/citizen-pwa-bg-sync`)

**Lands AFTER Cluster 2 to avoid double-retry collision.**

### I1. Background sync for queued submissions

**Files:**

- `apps/citizen-pwa/public/sw.js` — extend with `self.addEventListener('sync', ...)` listener. On `'submit-report'` tag, open IndexedDB (same `bantayog-drafts` store), iterate queued drafts with `syncState === 'syncing' || 'local_only'`, and POST them to `report_inbox` directly via fetch (Firestore REST, since SW can't use Firebase JS SDK without bundling).
- `apps/citizen-pwa/src/hooks/useSubmissionMachine.ts` — when entering `queued` state, call `navigator.serviceWorker.ready.then(reg => reg.sync.register('submit-report'))` if `'sync' in registration`. The SW path is best-effort, complementary to the in-app retry (which still wins if the tab is open).
- The shared `idempotencyKey` ensures dedup if SW and in-app machine both succeed.

**Caveat:** Background Sync API is Chrome/Edge only; iOS Safari users still rely on the in-app machine. Document this in the SW file.

### Cluster 5a verification

- Submit a report offline (devtools "Offline"), close the tab, go online, observe network panel for the SW-issued POST
- Verify Firestore `report_inbox` has exactly one doc (no duplicate from SW + reopen-tab retry)
- `pnpm lint && pnpm typecheck && npx vitest run`

---

## Cluster 5b — Client-side image compression (`feat/citizen-pwa-image-compress`)

### I2. Downscale photos before save

**New file:** `apps/citizen-pwa/src/lib/imageCompress.ts`
**Behavior:**

- `async function compressImage(file: File, opts?: { maxEdge?: number; quality?: number }): Promise<Blob>`
- Default `maxEdge=1080`, `quality=0.8`
- Uses `createImageBitmap` (already proven in `Step1Evidence.tsx` preview) → `OffscreenCanvas` (with `<canvas>` fallback) → `canvas.convertToBlob({ type: 'image/jpeg', quality })`
- Skip compression if `file.size < 200_000` (already small)
- Skip if `OffscreenCanvas` unsupported (return original file)

**Files modified:**

- `apps/citizen-pwa/src/components/SubmitReportForm/index.tsx` (lines 79–83) — replace the raw `arrayBuffer()` Blob conversion with `await compressImage(formData.step1.photoFile)`
- Add 4 unit tests with synthetic image data

### Cluster 5b verification

- Upload an 8MB iPhone photo → verify the stored blob is ~300KB
- Upload a 100KB thumbnail → verify it passes through unchanged
- `pnpm lint && pnpm typecheck && npx vitest run`

---

## Cluster 6 — Real data export backend (`feat/data-export-callable`)

**Status: pre-approved this session. Show full diff before saving. Emulator-first, no prod deploy this session.**

### B1. Implement `requestDataExport` properly

**File:** `functions/src/callables/request-data-export.ts`

**Design (mirrors `requestDataErasure` shape, includes media URLs per locked scope):**

```text
1. Auth gate: requireAuth(request, ['citizen']) + enforceAppCheck (already there)
2. Rate limit: check `data_exports` for any doc by this uid with status 'pending'/'ready'
   created in last 60s — reject with 'resource-exhausted'
3. Aggregate (parallel via Promise.all):
   - users/{uid}                                        → profile object
   - reports where reporterUid == uid                   → reports array (full docs)
   - report_media where reportId in (collected ids)     → mediaRefs with storagePaths
   - sms_inbox where senderMsisdnHash == users/{uid}.msisdnHash (skip if no hash)
4. For each media storagePath, generate a signed URL (V4 sig, 1h expiry, GET only)
5. Marshal as JSON envelope:
   { schemaVersion: 1, generatedAt, profile, reports: [...], smsMessages: [...],
     media: [{ reportId, storagePath, downloadUrl, expiresAt, contentType, sizeBytes }] }
6. Upload envelope to Cloud Storage at
   `data_exports/{uid}/{timestamp}-{requestId}.json`
   with metadata.contentType='application/json' and `metadata.requestedBy=uid`
7. Generate signed URL for the envelope (V4 sig, 1h expiry)
8. Write `data_exports/{requestId}` doc:
   { citizenUid, status: 'ready', storagePath, expiresAt, mediaCount, reportCount }
9. Stream audit event 'data_export_generated' with counts (no PII)
10. Return { downloadUrl, expiresAt, mediaCount, reportCount }
```

**Media URL caveat:** Signed URLs for media expire alongside the envelope (1h). User can re-request export to get fresh URLs. Document this in the export's top-level JSON as `mediaUrlExpiresAt` so future tooling parsing the export knows to re-resolve.

**Storage rules update needed** (`infra/firebase/storage.rules`): allow read on `data_exports/{uid}/{file}` only if `request.auth.uid == uid` AND through signed URL (signed URLs bypass rules but defense-in-depth: explicit deny for non-owners).

**TTL cleanup:** Add to existing scheduled `retentionSweep` (or new `dataExportSweep` scheduled function): delete Storage objects + Firestore docs older than 7 days. Scope this in plan but defer execution to a follow-up if it blows out the cluster.

**Frontend changes:**
**File:** `apps/citizen-pwa/src/services/callables.ts`

- `requestDataExport()` returns `{ downloadUrl: string; expiresAt: number }`

**File:** `apps/citizen-pwa/src/pages/SettingsPage.tsx`

- Restore the button (remove the F3 interim "Coming soon" gate)
- On success: trigger immediate download via `<a href={downloadUrl} download="bantayog-export.json">` programmatic click + show toast "Your data is downloading."
- Show a "Generating…" state during the callable round-trip
- On `resource-exhausted`: show "You requested an export recently. Try again in a minute."

### Cluster 6 verification

- Emulator suite: 10 tests for the callable (auth gate, rate limit, large user, empty user, signed URL expiry, audit event)
- Manual: trigger from local citizen-pwa pointed at staging, verify download contains expected fields
- Verify storage cleanup leaves no orphans
- Lint/typecheck across functions + citizen-pwa

---

## Cluster 7 — Documentation (folded into final cluster's PR)

### D1. `docs/progress.md`

Add a "## 2026-05-02 — Citizen PWA Hardening Sweep" section listing all 7 clusters with their PR numbers and status.

### D2. `docs/learnings.md`

Add new entries for the rules learned during this sweep:

- "Window properties can't be assigned once at module load if their value is set asynchronously — use a getter or update inside the handler."
- "LocalStorage-backed UI toggles require a documented consumer; otherwise they are visual lies."
- "Hardcoded municipality strings in user-facing copy block multi-jurisdiction rollout — keep contact info in the data model from day one."
- "Firebase Storage signed URLs are the right pattern for one-time data export delivery; expiry must be shorter than session token TTL."
- "Background Sync API works on Chromium only; pair with in-app retry machine and dedupe on idempotency key."

---

## Critical files summary

**Citizen PWA — modified across all clusters:**

- `apps/citizen-pwa/src/main.tsx` (Cluster 1)
- `apps/citizen-pwa/src/pages/SettingsPage.tsx` (Clusters 1, 6)
- `apps/citizen-pwa/src/pages/RegisterPage.tsx` (Cluster 1)
- `apps/citizen-pwa/src/pages/__tests__/LoginPage.test.tsx` (Cluster 1)
- `apps/citizen-pwa/src/components/RevealSheet.tsx` (Clusters 1, 3, 4)
- `apps/citizen-pwa/src/components/SubmitReportForm/index.tsx` (Clusters 1, 3, 4, 5b)
- `apps/citizen-pwa/src/components/SubmitReportForm/Step1Evidence.tsx` (Cluster 1)
- `apps/citizen-pwa/src/components/LookupScreen.tsx` (Cluster 2)
- `apps/citizen-pwa/src/components/ui/StatusBanner.tsx` (Cluster 1)
- `apps/citizen-pwa/src/hooks/useSubmissionMachine.ts` (Clusters 2, 5a)
- `apps/citizen-pwa/src/hooks/useFcmToken.ts` (Clusters 1, 2)
- `apps/citizen-pwa/src/hooks/useGpsLocation.ts` (Cluster 1)
- `apps/citizen-pwa/src/services/callables.ts` (Cluster 6)
- `apps/citizen-pwa/public/sw.js` (Cluster 5a)
- `apps/citizen-pwa/src/App.tsx` (Cluster 1, hook mount)

**Citizen PWA — new files:**

- `apps/citizen-pwa/src/lib/userSettings.ts` (Cluster 1)
- `apps/citizen-pwa/src/lib/imageCompress.ts` (Cluster 5b)
- `apps/citizen-pwa/src/hooks/useResumeRegistration.ts` (Cluster 1)
- `apps/citizen-pwa/src/hooks/useMunicipalityContact.ts` (Cluster 3)
- `apps/citizen-pwa/src/components/RevealSheet.lazy.tsx` (Cluster 4)

**Citizen PWA — deleted:**

- `apps/citizen-pwa/src/lib/photoUpload.ts`
- `apps/citizen-pwa/src/lib/draftManager.ts`
- `apps/citizen-pwa/src/lib/localforage.ts`

**Backend / shared:**

- `packages/shared-validators/src/municipalities.ts` (Cluster 3)
- `scripts/bootstrap-municipalities.ts` (Cluster 3 — re-run only)
- `functions/src/callables/request-data-export.ts` (Cluster 6)
- `infra/firebase/storage.rules` (Cluster 6)

**Reused (no modification):**

- `functions/src/callables/request-data-erasure.ts` — reference shape for Cluster 6
- `functions/src/idempotency/guard.ts` — already dedupes inbox writes by doc ID, so the existing submission machine and new SW background sync are both safe
- `functions/src/services/audit-stream.ts` — used by Cluster 6
- `apps/citizen-pwa/src/services/callables.ts` `httpsCallable` wrapper — used by Cluster 6

---

## End-to-end verification (after all clusters land)

1. `pnpm lint && pnpm typecheck && npx vitest run` from `apps/citizen-pwa/` — all green, all 318 tests pass
2. `pnpm exec turbo run lint typecheck` from repo root — passes across all packages
3. Manual smoke test in dev emulator:
   - Submit report online → verify RevealSheet shows correct municipality contact + real timestamp
   - Submit report offline → verify queued state with exponential backoff visible in console
   - Submit report offline + close tab + go online → verify SW background sync delivers it (Chrome only)
   - Upload 8MB photo → verify compressed to <500KB before storage
   - Toggle alert sounds + simulate FCM message → verify sound plays
   - Toggle auto-location off → verify Step2WhoWhere shows manual "Use my location" button
   - Click "Download my data" → verify JSON downloads with profile + reports
   - Trigger PWA install prompt in devtools → verify `window.deferredInstallPrompt` populated
   - Force `failed_terminal` state → verify new RevealSheet variant renders with hotline-first copy
4. Bundle size check: confirm initial JS is smaller after RevealSheet lazy-load
5. Update `docs/progress.md` and `docs/learnings.md`
6. Stage to dev environment for 24h soak before staging promotion (per CLAUDE.md §8.4 for schema/Storage changes)
