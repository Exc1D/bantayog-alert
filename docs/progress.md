# Progress

## Current Status (2026-05-03)

**Citizen PWA -- All major redesign and hardening work COMPLETE.**
7 hardening clusters done, 18 redesign tasks done, auth + wizard resumability merged.

**Phase 7 -- Provincial Superadmin + NDRRMC**
7.A (Security Callables) DONE | 7.B (Superadmin UI) DONE | 7.C (Drill & Verification) IN PROGRESS (TOTP enrollment audit in progress)

**Phase 8C -- RA 10173 Erasure & Anonymization DONE**
All 8 tasks complete. **Production blocker:** Pre-registration SMS data lacks erasure path (needs UID linkage at registration).

**Phase 6 -- Responder App DONE**
All 10 tasks complete. Residual risks: E2E dispatch progression, native push token registration, background geolocation (need physical devices).

---

## Recent Merged Work

### Citizen PWA -- Live Status Sync + Richer Timeline (2026-05-04)

- `useMyActiveReports` now uses live Firestore subscriptions per stored report (`onSnapshot` on `report_lookup/{publicRef}` → `reports/{reportId}`), so the map MyReportLayer pin, Profile tab list, and ReportStatusPill update in real time as the admin advances status (verified, assigned, resolved, rejected, closed). The pill now correctly disappears the moment the report enters a terminal state.
- Permission-denied fallback (covers anonymous→phone-link UID change) keeps the existing `requestLookup` callable wired so a registered user still sees their pre-registration reports.
- `mapReportFromFirestore` synthesizes a multi-step timeline from the per-step timestamp fields callables already write (`verifiedAt`, `assignedAt`, `acknowledgedAt`, `enRouteAt`, `onSceneAt`, `resolvedAt`, `closedAt`, `rejectedAt`, `cancelledAt`, `reopenedAt`), giving the TrackingScreen a real progression instead of just "Report received → current status".
- **Gate:** citizen-pwa vitest 363/363 pass (added 6 new tests across `useMyActiveReports.test.ts` and `mappers.test.ts`), `pnpm lint`, `pnpm typecheck` clean.

### Citizen PWA -- Public Verification Wiring + Live Timeline (2026-05-04)

- Verified reports now flip from `visibilityClass: internal` to `public_alertable` during admin verification, so creators still see fresh submissions immediately while the public Map/Feed sees them only after verification
- Citizen tracking now normalizes Firestore timestamp objects and uses `lastStatusAt` to synthesize the live timeline page/radar status state from real `reports/{id}` docs
- **Gate:** citizen-pwa focused vitest 49/49 pass, `pnpm lint`, `pnpm typecheck`; functions `pnpm typecheck` pass; functions verify-report emulator suite still blocked by pre-existing rules-unit-testing seed issues (Admin `Timestamp` writes / permission-denied harness path), functions lint still has 17 pre-existing warnings

### Citizen PWA — Active Report + Tracking Fixes (2026-05-04)

- Fixed 4 citizen-facing correctness bugs in the report-status flow
- Normalized legacy `public_disturbance` submissions to the supported `security` report type so new reports persist and appear in Map/Profile/pill again
- Tracking page now accepts the real live report doc shape (`publicLocation`, `submittedAt`, no inline `timeline`) and synthesizes a usable citizen timeline view instead of collapsing to the generic processing banner
- Find My Report now normalizes secret-code input and resolves same-device freshly submitted reports from local storage before backend lookup docs exist
- Gate: citizen-pwa focused vitest 43/43 pass, `pnpm lint`, `pnpm typecheck`

### UX Bug Fixes — 10 Issues (2026-05-03)

- **10 issues fixed:** TrackingScreen nav header (back + home), RevealSheet SMS iOS fix, button text → "Create Account", mt-4 spacing, FilterBar z-[800] above Leaflet, municipality chips filter (replaces severity/window), saveReport() wiring so reports appear on map + Profile, bantayog:report-saved event for live refresh, ProfileTab "Check report status" CTA
- **FeedTab** also updated to municipality filter for consistency
- **Gate:** `lint typecheck` clean, vitest 330/330 pass

### QA Findings Sweep (2026-05-03)

- **45 findings addressed:** 7 P0, 8 P1, 10 P2/P3
- Key fixes: RevealSheet nav, CORS/auth on lookup, SW retry backoff, iOS PWA meta tags, push toggle state, GPS auto-start fallback, sign-out button, FilterBar wiring, marker cursors, delete account modal rewrite, contrast fixes, motion-safe guards, Tagalog labels
- **Skipped:** Firestore data population, visual design work, structural refactors, reverse geocoding, nav stack behavior, off-palette token migration
- **Gate:** `lint` 0 errors

### PR #91 Review Follow-ups (2026-05-03)

- Sourcery: SW individual precache failure handling, `aria-hidden` -> spinner + `role="status"`, extracted `phone-session-storage.ts`
- CodeRabbit: Added `.catch()` on wizard load, removed redundant `aria-live`, fixed TTL test false-positive
- **Gate:** `lint typecheck` clean, vitest 243/243 pass

### Auth + Wizard Resumability (2026-05-02)

- RegisterPage a11y (`id`/`name`/`autocomplete`)
- Phone number preserved across login/register via `sessionStorage`
- Step 1 validates report type before advancing
- New `wizard-snapshot` service (localforage, 24h TTL) -- persists step/formData, clears on success
- **Gate:** `lint typecheck` clean, vitest 327/327 pass, build +1 KB

### QA Follow-ups Round 1 (2026-05-02)

- Offline mode: precache root + manifest, cache version bumped
- Settings contrast: `#768081` -> `text-surface-600`, `#a3adae` -> `text-surface-500`
- Settings `<main>` landmark
- Wizard Step 2: hint visible before location method selected
- **Gate:** `lint typecheck` clean, vitest 319/319 pass, build emits 5 precache URLs

### Hardening Sweep (2026-05-02)

All 7 clusters complete:

1. Correctness fixes (PWA install, toggles, RevealSheet, photo validation)
2. Reliability (backoff, error sanitization, FCM rollback)
3. Per-jurisdiction config (municipality schema ext, contact hook)
4. Performance (lazy RevealSheet, dead code deletion)
5. Background sync + image compression
6. Data export backend (GCS signed URLs)

- **New files:** `useMunicipalityContact.ts`, `RevealSheet.lazy.tsx`, `imageCompress.ts` + tests
- **Deleted:** `lib/photoUpload.ts`, `lib/draftManager.ts`, `lib/localforage.ts`
- **Gate:** `lint typecheck vitest` all green (318 tests)

---

## Older Completed Phases

| Phase                             | Status | Notes                                                                                                                                                            |
| --------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Phase 9: Citizen PWA Redesign     | DONE   | 18 tasks -- Feed/Profile/Alerts tabs, RevealSheet, Toggle, Toast, offline banner, auth-aware ProfileTab, RegisterPage, SettingsPage, routes, data export wrapper |
| Phase 8C: RA 10173 Erasure        | DONE   | 8 tasks -- callables, sweeps, rules, delete-account flow                                                                                                         |
| Phase 7.A: Security Callables     | DONE   | 7 callables + Firestore rules                                                                                                                                    |
| Phase 7.B: Superadmin UI          | DONE   | Analytics dashboard, NDRRMC drawer, emergency declaration, break-glass, TOTP enrollment                                                                          |
| Phase 6: Responder App            | DONE   | Native foundation, push, telemetry, location projection, field UX, handoffs                                                                                      |
| Phase 5: Cluster C + PRE-C        | DONE   | Mass alerts, NDRRMC escalation, analytics                                                                                                                        |
| Phase 4b: SMS Inbound Pipeline    | DONE   | Globe Labs webhook, parser, fuzzy barangay matching                                                                                                              |
| Phase 3b: Admin Triage + Dispatch | DONE   | Code complete (staging UI blocked by cert issues)                                                                                                                |
| Phase 0: Foundation               | DONE   | All tooling passing                                                                                                                                              |

---

## Open Blockers & Deferred Items

1. **Production blocker (Phase 8C):** Pre-registration SMS data erasure gap -- needs UID-linkage mechanism
2. **Firebase Console:** Phone Auth disabled; App Check 400 errors on staging
3. **Deploy needed:** Staging redeploy required to verify many code fixes
4. **Phase 7.C:** Staff TOTP enrollment audit in progress
5. **Deferred to Phase 11:** 4 observability dashboards (Ops, Backend, Compliance, Cost)
