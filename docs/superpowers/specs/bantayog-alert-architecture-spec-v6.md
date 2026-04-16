# Bantayog Alert — Unified Architecture Specification

**Version:** 6.0 (Role-Unified; Post Role-Spec Reconciliation)
**Date:** 2026-04-16
**Status:** Pilot-Ready Architecture — Role Contradictions Resolved — Production Hardening Required Before Emergency-Service Dependence
**Supersedes:** Architecture Spec v5.0 (2026-04-16) and role specs dated 2026-04-10
**Stack:** React 18 + Vite + Firebase + Leaflet + Zustand + TanStack Query + Capacitor + Semaphore/Globe Labs (SMS)

---

## 0. Reading This Document

This spec is the **single source of truth** for what gets built. It absorbs:

- Architecture Spec
- Citizen Role Spec
- Responder Role Spec
- Municipal Admin Role Spec
- Agency Admin Role Spec
- Provincial Superadmin Role Spec

**When this document and a role spec disagree, this document wins.** The role specs remain useful as UX intent documentation; they do not govern data model or security rules.

§1 states context and principles. §2 catalogs every contradiction between the source documents and names the winning decision with rationale — read §2 if you have ever seen a different version of any of this. §3 onward is the built system.

---

## 1. Context & Driving Forces

### 1.1 What This System Is

Bantayog Alert is a crowd-sourced disaster reporting and real-time coordination platform for the Province of Camarines Norte, Philippines (12 municipalities, ~600,000 population). Citizens report emergencies; municipal administrators triage and dispatch; agencies coordinate tactical response with their own rosters; the provincial PDRRMO maintains province-wide situational awareness and holds the only escalation channel to NDRRMC.

### 1.2 Constraints That Shape Architecture

Unchanged from v5. Restated for a reader who hasn't seen v5:

- **Connectivity is unreliable.** Citizen capture may begin offline. UI distinguishes `draft`, `queued`, `submitting`, `server_confirmed`, `failed_retryable`, `failed_terminal`. Server acceptance is not guaranteed until ingestion completes.
- **Time pressure is extreme.** Surge-capable triage for sustained high-volume queues, bulk operations, duplicate clustering, degraded-mode operation.
- **Jurisdiction is legal.** RA 10173 (Data Privacy Act) makes cross-municipality data access either explicitly shared-and-logged, or refused at the data layer.
- **Users operate under stress with uneven literacy.** Partial completion, reconnect recovery, permission recovery, low-battery operation, clear failure states.
- **Mobile OS behavior is a first-class constraint, not an assumption.** Background location, notifications, battery policy, app suspension are unreliable and must be observable.
- **Feature phones matter.** SMS inbound/outbound is not a nice-to-have. It's the last 20% of population reach during an emergency.
- **NDRRMC owns province-wide mass alerting.** RA 10639 (Free Mobile Disaster Alerts Act, 2014) assigns cell broadcast to NDRRMC. Bantayog escalates, does not duplicate.

### 1.3 Architectural Principles

Unchanged from v5:

1. Design for the worst network, not the best.
2. Enforce authorization at the data layer.
3. Honest write-authority model — server-authoritative for contention and multi-doc invariants; direct writes for self-service sequential transitions.
4. Optimize for the surge, not the steady state.
5. Test seams, not portable abstractions.
6. Idempotency everywhere.
7. Be explicit about uncertainty — confirmed server state vs local/offline/pending must be visually distinct.
8. Design for operational reversibility.
9. No single channel is trusted for life-safety; know which channel is whose job.
10. State has exactly one authority per category.

### 1.4 New Principles in v6 (Consequences of Role-Unification)

11. **Role capability is defined by data-class reach, not by UI.** If a role sees or writes a data class, that appears in the Access Model (§15) and a security rule enforces it. UI affordances that aren't backed by a rule don't exist.
12. **Three deployment surfaces, one backend.** Citizen PWA, Responder Capacitor app, and Admin Desktop PWA are distinct deployables with distinct state-ownership profiles (§3). They share the same Firestore, rules, functions, and audit plane.
13. **Attribution over anonymity for staff actions.** Every privileged action carries `actorId`, `actorRole`, and where applicable `actorMunicipalityId` / `actorAgencyId`. Admin identity is hidden from citizens and the public feed at the presentation layer only, not at the audit layer.

---

## 2. Resolved Contradictions (Decisions & Rationale)

This section exists because the source documents disagreed with each other. Every contradiction is listed with the decision, the rationale, and the downstream consequences. Treat this as a binding decision log for v6.

### 2.1 Agency Admins do NOT verify reports

**Conflict:** Original Agency Admin spec §Core Features 1 said agencies verify reports and mark them "Verified by [Agency Name]" platform-wide. The "UPDATED Changes" amendment in the same file reversed this: triage is strictly LGU, agencies only see verified incidents and respond to municipal requests.

**Decision:** Agencies do not verify. Only Municipal Admins and Provincial Superadmins can execute the `awaiting_verify → verified` transition on a report.

**Rationale:** Single-actor verification keeps the report state machine clean and the audit trail unambiguous. It matches PH emergency management doctrine where LGUs hold the triage function. It also prevents the race where two agency admins and one municipal admin all hit "Verify" simultaneously with different severity classifications.

**Consequences:**

- Agency Admin UI has no "Verify" button. Instead, an "Agency Assistance Requested" inbox (§7.3).
- Exception: the "Verified Responder Report" bypass (§2.9) — a field responder witnessing an incident directly can create a pre-verified report, but this routes through a scoped callable, not through general agency authority.
- Firestore rule: `verified` transition callable checks `role in ['municipal_admin', 'provincial_superadmin']`, with `provincial_superadmin` restricted to the Verified Responder bypass path and break-glass.

### 2.2 No `trustScore` in v6

**Conflict:** Municipal Admin spec Panel A shows a "TRUST SCORE: 92/100" field and an "Auto-Verify? [Yes] [No]" control. Architecture v5 §4.1 excluded `trustScore` pending governance.

**Decision:** `trustScore` is out. No field, no UI, no rule.

**Rationale:** Assigning per-citizen reliability scores without a documented governance process (how scores are computed, how they're corrected, how they're audited, how citizens appeal) creates RA 10173 profiling exposure and operational risk (a false high score drops real emergencies). The senior-architect review flagged this; that decision stands.

**Consequences:**

- Municipal Admin triage panel shows `reporterType` (`registered` / `pseudonymous` / `sms`) and `hasPhotoAndGPS` — these are factual, not scored.
- Auto-verify is out. All verification requires explicit admin action.
- Revisit in v7 if and only if NPC-compliant governance is drafted and approved by PDRRMO + provincial legal counsel.

### 2.3 Anonymous citizens are pseudonymous, not anonymous

**Conflict:** Citizen spec line 571 claimed "absolute anonymity" — "Even provincial superadmins cannot see identity." Architecture v5 §3.1 stated anonymous Firebase Auth is pseudonymous, not anonymous, and can be linked to a registered account. Citizen spec elsewhere retained IP for 24h and phone numbers "stored but hidden."

**Decision:** Follow architecture spec. Language is `pseudonymous`, not `anonymous`. Citizen-facing privacy notice must say so plainly.

**Rationale:** "Absolute anonymity" is a claim the system cannot honor. Court order can compel linkage. App Check retains abuse signals. Firebase logs retain IP short-term. Telling citizens otherwise is a breach of good-faith notice under RA 10173 and a reputational liability when the first court order arrives.

**Consequences:**

- All citizen-facing copy rewrites "anonymous" → "without registering" or "pseudonymous."
- Privacy notice explicitly lists what is retained for a pseudonymous report: pseudonymous UID, optional voluntary contact (goes to `report_contacts`), GPS, photos (EXIF-stripped), IP (short-term), msisdn hash if SMS.
- Tracking reference + secret model unchanged from v5 §3.2.

### 2.4 Location cadence follows architecture spec (motion-driven)

**Conflict:** Responder spec said flat 30s. Agency Admin spec said 5s own-agency, 30s other-agency. Architecture §8.2 said hardware motion-activity driven: 10s moving, 30s walking, geofence-only when still, 5–10min pings at low battery.

**Decision:** Architecture wins. The cadence in §8.2 is what the responder device **emits**. The numbers in the role specs (5s, 30s) are what admin maps **display as fresh** — and those display rules are rewritten here to match the emission model.

**Rationale:** Flat 30s burns responder batteries in 3–4 hours at real staging durations. A 5s cadence is worse. Hardware motion detection is the only way to get 12+ hour shifts without tethered charging.

**Consequences:**

- Device emission: per §8.2 table (unchanged).
- Admin display freshness bands: `live` (within 2× expected interval for current motion state), `degraded` (within 4×), `stale` (>4×), `offline` (>5min on active dispatch).
- Agency Admin map: own-agency responders rendered from RTDB with full freshness; other-agency responders rendered from a sampled every-30s read projection (§8.5). Cost is bounded because the heavier 10s samples for own-agency are already being written regardless of who reads.

### 2.5 Dispatch timeout is data-driven, not hardcoded

**Conflict:** Responder and Municipal specs said 5-minute accept window, 10-minute auto-escalate. Architecture uses `acknowledgementDeadlineAt` as a per-dispatch field.

**Decision:** Follow architecture. `acknowledgementDeadlineAt` is set per dispatch based on severity and agency defaults.

**Rationale:** A flat 5-minute window is too tight for a structural-engineer callout at 2am and too loose for a high-severity fire. Severity-aware and agency-configurable matters operationally.

**Consequences:**

- `system_config/dispatch_timeouts/{severity}` holds defaults: `high: 3min`, `medium: 5min`, `low: 10min`.
- Agencies can override their own defaults via `agencies/{agencyId}.dispatchDefaults`.
- Scheduled function `dispatchTimeoutSweep` (every 30s) applies `pending → timed_out` when `now > acknowledgementDeadlineAt`.
- Reminder notification fires at 60% of the deadline window.

### 2.6 Municipal mass-alert routing follows architecture escalation rules

**Conflict:** Municipal Admin spec showed a "Send Alert" button that blasts SMS + push + email to ~15,000 citizens in one municipality. Architecture §2.3 said municipality-scoped SMS ≤5,000 via Semaphore priority queue; anything larger escalates to NDRRMC.

**Decision:** Follow architecture. The "Send Alert" UI enforces the routing rule; the admin sees _which channel their message will actually travel on_ before confirming.

**Rationale:** 15,000 SMS via commercial aggregator is slower, more expensive, and legally awkward under RA 10639 than ECBS via NDRRMC. Pretending otherwise sets an expectation the system can't meet during an actual typhoon surge when aggregator queues degrade first.

**Consequences:**

- Municipal mass-alert composer shows a live **Reach Plan** preview: estimated recipients by channel (in-app push, municipality SMS via Semaphore, NDRRMC escalation request).
- If estimated SMS recipients > 5,000 OR alert targets multiple municipalities, the UI routes the send as an **NDRRMC Escalation Request** (§7.4) — the municipal admin submits, the Provincial Superadmin or PDRRMO Director reviews and forwards to NDRRMC.
- A `massAlertReachPlanPreview` callable computes the estimate server-side before the admin hits send.
- FCM push fan-out to in-app users has no size cap (FCM handles it) — SMS is the bounded channel.

### 2.7 Admin identity is hidden from citizens and the public feed

**Conflict:** Municipal Admin spec said "Admin identity hidden from citizens (admin anonymity)." Responder spec surfaced admin names to responders. Citizen-facing notification templates in the citizen spec named institutions ("MDRRMO") not individuals.

**Decision:** Admin identity is hidden from citizens AND the public feed. Admin identity IS visible to responders on the same incident (operational necessity) and IS logged in audit.

**Rationale:** Citizens get institutional attribution ("Verified by Daet MDRRMO"). Responders get individual attribution ("Dispatched by Admin Santos") because they need to know who to call back. Audit gets full attribution because compliance requires it.

**Consequences:**

- `report_events` stream stores `actorId` and `actorRole` (always). The citizen-facing status-tracking view projects this to institutional labels via a Cloud Function that strips `actorId` and renders `actorRole + actorMunicipalityId` as "Daet MDRRMO."
- Responder dispatch detail shows `dispatchedBy` as the admin's display name + role.
- Public feed (pseudonymous read) never includes `actorId` on any event.
- Firestore rule on the citizen-facing `report_lookup/{publicRef}` document excludes `actorId` fields; the document is CF-written from `report_events` and only contains institution-level fields.

### 2.8 No "Incident Commander" tag

**Conflict:** Agency Admin spec introduced an "Incident Commander" tag for inter-admin conflict resolution. Architecture has no such concept.

**Decision:** No Incident Commander field. Follow architecture: the admin who creates the dispatch owns it; `cancelDispatch` is server-authoritative; `closeReport` is server-authoritative and restricted to the municipal admin of the report's municipality or a superadmin.

**Rationale:** An "Incident Commander" tag without strict transition rules is ambiguous ownership with extra vocabulary. The existing state machine already answers every operational question: who can cancel a dispatch (admin of that dispatch + superadmin), who can close a report (municipal admin of that municipality + superadmin), who can redispatch (same).

**Consequences:**

- Agency and Municipal admin UIs show a read-only "Owning Admin" derived from the report's `municipalityId` and the most recent `dispatchedBy` on active dispatches.
- Inter-agency conflicts are resolved via the Command Channel messaging thread (§7.3), not a tag.

### 2.9 Verified Responder Report bypass — designed in

**Conflict:** Agency spec edge case proposed a bypass for field responders witnessing an incident. Architecture had no such path.

**Decision:** Implement as a scoped callable `submitResponderWitnessedReport` that writes directly to `new` state, skipping `draft_inbox → new` but NOT skipping `awaiting_verify → verified`. It's an accelerated intake, not a verification bypass.

**Rationale:** A responder on patrol sees a real incident. Making them text-message it through the citizen SMS path is absurd; making them mark it "verified" without any LGU review breaks §2.1. The right middle is: responder creates a pre-classified report, it hits the admin queue with a `source: 'responder_witness'` flag that elevates it in triage priority, and the municipal admin verifies fast because the reporter is a credentialed staff account.

**Flow:**

1. Responder taps "Report What I'm Seeing" in their app.
2. Fills short form: type, severity (suggested), GPS (auto-captured and required), photo (required), short description.
3. Calls `submitResponderWitnessedReport` with an idempotency key.
4. Server writes `reports/{reportId}` directly at state `new` with:
   - `source: 'responder_witness'`
   - `reporterId` = responder's UID
   - `reporterRole` = `'responder'`
   - `witnessPriorityFlag: true` (surfaces in municipal admin queue top)
5. FCM fires to the municipal admin of the geo-resolved municipality AND to the responder's own agency admin (so the agency knows one of their units is on an incident).
6. Municipal admin sees a "Responder-Witnessed" badge; still must execute `awaiting_verify → verified` but the `hasPhotoAndGPS` fields are guaranteed true so verification is fast.
7. Audit log records both the bypass of `draft_inbox` and the identity of the responder.

**Consequences:**

- New callable: `submitResponderWitnessedReport`.
- New rule: only accounts with `role == 'responder'` and `accountStatus == 'active'` can invoke it.
- New Firestore field on `reports`: `source` (enum: `citizen_app`, `citizen_sms`, `responder_witness`, `admin_entry`).
- New flag on `report_ops`: `witnessPriorityFlag`.
- Rate limit: max 10 witness reports per responder per 24h to prevent misuse.
- If the responder is geo-resolved to a municipality outside their permitted jurisdiction, the report is still created (they may be in transit or providing mutual aid) but flagged for superadmin attention.

### 2.10 Three deployment surfaces, explicitly named

**Conflict:** Role specs described UIs without clearly separating "the Bantayog app" into its distinct deployables.

**Decision:** There are three surfaces. Each has its own bundle, its own state-ownership profile, its own offline strategy, its own auth friction level.

**Summary table — full detail in §3:**

| Surface       | Audience                        | Platform                                               | Offline Strategy                                                                                    | Auth                                        |
| ------------- | ------------------------------- | ------------------------------------------------------ | --------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| Citizen PWA   | Citizens                        | React PWA (iOS Safari, Android Chrome)                 | localForage + Firestore SDK dual-write; SMS fallback for submission                                 | Pseudonymous (auto) or phone-OTP registered |
| Responder App | Responders                      | Capacitor wrapper over React                           | Firestore SDK cache; Capacitor plugins for background location, foreground service, motion activity | Managed staff + MFA                         |
| Admin Desktop | Municipal / Agency / Superadmin | React PWA (desktop-first, dual-monitor for superadmin) | Firestore SDK cache only — admins require connectivity                                              | Managed staff + MFA + TOTP for superadmin   |

**Consequences:**

- Three separate Vite build targets, one monorepo.
- Shared `@bantayog/shared-types`, `@bantayog/shared-validators`, `@bantayog/shared-ui-primitives` packages.
- Citizen-app state ownership matrix (§9.3) includes localForage outbox. Admin-app matrix does NOT — admins working without connectivity is an anti-pattern that would quietly drop mutations. They get a blocking "reconnect required" modal instead.
- Responder-app state ownership matrix adds Capacitor Preferences for foreground-service state.

---

## 3. Deployment Surfaces

### 3.1 Citizen PWA

**What it is:** A progressive web app at `bantayog.daet.gov.ph` (or equivalent provincial domain). No app store. Installable as PWA on iOS and Android. Also accessible as regular website.

**Target devices:** Any smartphone with Chrome 90+ (Android) or Safari 14+ (iOS). Also usable on desktop browser for citizens who happen to be at a computer.

**Offline strategy:**

- Firestore SDK IndexedDB persistence enabled.
- `localForage` dual-write for drafts and queued submissions (Architecture §9.1.1, Decision #23). This is the critical iOS PWA hedge against service-worker eviction.
- Service worker caches app shell and map tiles.
- SMS fallback (§4) is the universal escape hatch when the PWA can't submit.

**Auth profile:**

- `signInAnonymously()` on app launch → pseudonymous Firebase UID.
- Optional upgrade to registered account via phone OTP (`linkWithCredential()` preserves UID and report history).
- No MFA. No password complexity requirements (phone-OTP is the primary credential for registered citizens).

**State ownership (§9.3):**

- Firestore SDK: server-sourced documents (reports, alerts, tracking lookups).
- Zustand: UI state only.
- TanStack Query: `lookupReportByToken` callable results, non-Firestore aggregates.
- localForage: drafts, queued submissions, tracking secrets.

**Performance budget:**

- First Contentful Paint < 2s on 3G.
- Bundle < 500KB gzipped initial route; map tiles and Leaflet lazy-loaded.
- Report submission acceptance latency p95 < 3s (network present) per SLO in §11.2.

### 3.2 Responder App (Capacitor Wrapper)

**What it is:** A Capacitor-wrapped React app distributed as a signed APK and a TestFlight-then-App-Store iOS build. Loaded onto responder-issued devices by agency admins during onboarding.

**Why not PWA:** Architecture §2.1 — background location and foreground-service execution are unreliable on PWA, especially iOS. Capacitor gives us Android foreground service, iOS background location entitlement, and hardware motion activity API access. The architecture is explicit that Capacitor _reduces but does not eliminate_ mobile OS background execution risk.

**Target devices:**

- Android 10+ (API 29+) — foreground service required for reliable background tracking.
- iOS 15+ — background location mode, CMMotionActivityManager access.

**Capacitor plugins required:**

- `@capacitor-community/background-geolocation` — hardware motion + geofence-aware GPS polling.
- `@capacitor/push-notifications` — FCM on Android, APNS on iOS.
- `@capacitor/preferences` — persisted state (foreground service status, last-known motion activity).
- `@capacitor/network` — online/offline detection (more reliable than `navigator.onLine` on mobile WebView).
- `@capacitor/device` — device info for audit trail.
- Custom plugin: `BantayogForegroundService` — Android foreground service with persistent notification mandated by Play Store policy for background location.

**Offline strategy:**

- Firestore SDK IndexedDB persistence.
- No localForage outbox — responder dispatches are read-heavy and the writes that matter (`acknowledged → en_route → on_scene → resolved`) are sequential single-actor direct writes that the SDK queue handles well.
- Capacitor Preferences stores foreground-service state so the native layer knows whether to show the tracking notification.
- GPS writes to RTDB, not Firestore — these are fire-and-forget telemetry, not queued.

**Auth profile:**

- Phone-OTP first-factor (responders need phone numbers on file anyway for admin callback).
- MFA mandatory — TOTP via Google Authenticator or equivalent.
- Account created and activated by Agency Admin only; self-registration not allowed.
- `role: 'responder'` custom claim; `agencyId` and `permittedMunicipalityIds` set on the account.

**State ownership:**

- Firestore SDK: dispatches, own profile, assigned reports, messages, equipment checklists.
- Zustand: UI state, current dispatch selection.
- TanStack Query: performance stats callable results.
- Capacitor Preferences: foreground-service state, last motion activity.
- RTDB: GPS telemetry (write-only from responder side).

**Performance budget:**

- App cold start < 3s on mid-range Android (Cherry Mobile / Vivo entry tier common in PH).
- Background battery consumption: < 15% per 12-hour shift at typical motion mix. Measured in pilot per §18.
- Dispatch-received to notification-visible: < 5s p95.

### 3.3 Admin Desktop PWA

**What it is:** A desktop-first React PWA at `admin.bantayog.daet.gov.ph`. Optimized for 1920×1080 monitors, dual-monitor-capable for superadmin workstations.

**Target devices:**

- Desktop Chrome/Edge 100+.
- Tablet-responsive down to 1024px for "mobile command post" scenarios in agency/municipal field deployments.
- Not mobile-optimized. Phone-sized viewport renders a "please use a desktop" gate with a link back to the citizen PWA for anyone who hits it by accident.

**Offline strategy:**

- Firestore SDK cache for fast re-open of recent views, not as a write buffer.
- **No offline write queue.** If an admin loses connectivity, all mutation UI is disabled with a blocking "reconnect to continue" banner.
- **Rationale:** Admin writes are high-stakes multi-document operations (dispatch, verify, mass-alert). An admin silently queuing a `sendMassAlert` for replay 2 hours later is a worse failure mode than forcing them to wait for connectivity. Mixed-mode writes (§5) use server-authoritative callables for everything an admin does; callables require connectivity.
- **Exception:** Field notes and in-app messages use the citizen-app outbox pattern when an admin is using a tablet in the field and explicitly opts into "field mode." This is an explicit mode switch, not a silent fallback.

**Auth profile by role:**

- Municipal Admin: phone-OTP + MFA (TOTP mandatory).
- Agency Admin: phone-OTP + MFA (TOTP mandatory).
- Provincial Superadmin: phone-OTP + MFA + TOTP + `isPrivileged()` session check (§3 architecture spec). Break-glass as separate account with dual-control unseal (§11.6.1).

**State ownership:**

- Firestore SDK: authoritative server state.
- Zustand: map viewport, selected entity, open panel, filter state.
- TanStack Query: analytics aggregates, user management list views, export status polling.
- No outbox layer.

**Performance budget:**

- Admin dashboard p95 load time < 5s under normal conditions (§17 migration trigger if this degrades).
- Queue triage mode: 47 pending reports must render and be interactable within 2s on first load.
- Map with 50 incident pins + 30 live responder markers must maintain 30fps pan/zoom.

### 3.4 Shared Foundation

**One monorepo. Three Vite build targets. Shared packages:**

```
bantayog-alert/
├── apps/
│   ├── citizen/          # PWA, anonymous-first
│   ├── responder/        # Capacitor wrapper
│   └── admin/            # Desktop PWA (all three admin roles)
├── packages/
│   ├── shared-types/     # TypeScript: Report, Dispatch, User, Alert, etc.
│   ├── shared-validators/# Zod schemas used client-side AND by Cloud Functions
│   ├── shared-ui/        # Primitive components (Button, Modal, MapPin)
│   ├── shared-firebase/  # Firestore converters, auth helpers, idempotency key generation
│   └── shared-sms-parser/# SMS inbound parser (shared between CF and test harness)
├── functions/            # Cloud Functions (Node.js 20)
├── infra/
│   ├── terraform/        # GCP/IAM/BigQuery (Decision #30)
│   └── firebase/         # rules, indexes, CLI config
└── docs/                 # This spec and related design docs
```

**One Firebase project per environment** (`bantayog-dev`, `bantayog-staging`, `bantayog-prod`). All three apps deploy to the same project and share security rules, Firestore, RTDB, Storage, Auth, and FCM.

**Three Firebase Hosting sites per environment:**

- `bantayog-dev.web.app` → citizen
- `admin-bantayog-dev.web.app` → admin desktop
- Responder app ships as APK/IPA, not hosting.

---

## 4. SMS Architecture

Unchanged from v5 §2.3 in technical substance. Restated with role-spec consequences folded in.

### 4.1 Four Purposes, Four Reliability Tiers

1. **Targeted citizen status updates** (outbound, one-to-one). "Your report has been received, reference 2026-DAET-0471." Ordinary Semaphore queue. Highest legitimate volume.
2. **Municipality-scoped operational advisories** (outbound, ≤5,000 recipients). Semaphore priority queue. Municipal Admin authority per §2.6.
3. **Province-wide or multi-municipality mass alerts** → **NDRRMC Escalation Workflow** (§7.4). The system does NOT blast these itself.
4. **Inbound citizen reports** (feature phones). Globe Labs keyword routing → Cloud Function webhook → `report_inbox`.

### 4.2 Provider Selection (Unchanged)

Semaphore primary, Globe Labs secondary:

- Semaphore ~₱0.50/SMS vs Twilio $0.20/SMS — 20× cheaper for PH delivery.
- Semaphore priority queue routes over OTP-grade SMS paths; delivers under telco congestion.
- Globe blocks VRN/long codes for A2P; Smart blocks URL shorteners. Domestic aggregators handle sender ID registration; Twilio abstracts this and loses.
- Globe Labs is required anyway for inbound keyword routing. Using it as outbound secondary adds no new vendor surface.

### 4.3 Content Rules

Enforced in the `sendSMS(to, body, priority, purpose)` abstraction:

- Alphanumeric sender ID only (`BANTAYOG`).
- No URL shorteners. Full URLs or no URL.
- ASCII-only. Emojis and special characters stripped at abstraction layer with warning log. Tagalog ASCII is fine.
- 160-char segments. Long alerts split with `(1/3)`, `(2/3)`, `(3/3)` footers.
- Circuit-breaker: if Semaphore p95 > 30s or error rate > 5% over 5 min window, new sends route to Globe Labs. Health probe continues hitting Semaphore. Re-entry after 5 minutes of healthy probes.

### 4.4 Inbound Format

`BANTAYOG <TYPE> <BARANGAY>` → parsed by CF webhook → `report_inbox` with `source: 'sms'`.

Parser acceptance:

- TYPE synonyms: `FLOOD` / `BAHA`, `FIRE` / `SUNOG`, `LANDSLIDE` / `GUHO`, `ACCIDENT` / `AKSIDENTE`, `MEDICAL` / `MEDIKAL`, `OTHER` / `IBA`.
- BARANGAY: fuzzy-matched against the 12-municipality barangay gazetteer with Levenshtein distance ≤ 2. On ambiguous match, auto-reply lists candidates.
- On parse failure: auto-reply with format instructions.

Location precision is barangay-level only. Reports flagged `requiresLocationFollowUp: true`. Admin triage treats these with the same priority as GPS-lacking web submissions.

### 4.5 SMS Out Is An Attempt, Not A Guarantee

Architecture v5 principle #9: no single channel is trusted for life-safety. Critical citizen-facing messages fan out over FCM + SMS. Telcos may queue during congestion and drop after TTL. The `sms_outbox/{msgId}` provider callback updates record delivery status but "delivered" ≠ "read."

---

## 5. Identity & Authentication Model

### 5.1 Identity Matrix

| Identity Level         | Auth Method                      | UID                     | Surface         | MFA                                        | Notes                                     |
| ---------------------- | -------------------------------- | ----------------------- | --------------- | ------------------------------------------ | ----------------------------------------- |
| Pseudonymous citizen   | `signInAnonymously()`            | Temporary               | Citizen PWA     | No                                         | Auto on launch                            |
| SMS-identified citizen | `sms_sessions/{msisdnHash}`      | Implicit                | None (SMS only) | No                                         | Phone number = credential via rate limits |
| Registered citizen     | Phone OTP (`linkWithCredential`) | Persistent              | Citizen PWA     | Optional (phone-OTP repeat)                | Links pseudonymous history                |
| Responder              | Managed staff + phone OTP        | Persistent              | Responder App   | **Required (TOTP)**                        | Created by Agency Admin                   |
| Municipal Admin        | Managed staff + phone OTP        | Persistent              | Admin Desktop   | **Required (TOTP)**                        | Created by Superadmin                     |
| Agency Admin           | Managed staff + phone OTP        | Persistent              | Admin Desktop   | **Required (TOTP)**                        | Created by Superadmin                     |
| Provincial Superadmin  | Managed staff + phone OTP        | Persistent              | Admin Desktop   | **Required (TOTP) + isPrivileged session** | Quarterly re-verify                       |
| Break-glass            | Sealed escrow + dual-control     | Persistent but disabled | Admin Desktop   | **Required (TOTP)**                        | §11.6.1                                   |

### 5.2 Custom Claims

```typescript
interface CustomClaims {
  role: 'citizen' | 'responder' | 'municipal_admin' | 'agency_admin' | 'provincial_superadmin'
  municipalityId?: string // For municipal_admin; and for agency_admin scoped to one muni
  agencyId?: string // For agency_admin and responder
  permittedMunicipalityIds?: string[] // For responders serving multiple munis; for SAR cross-muni
  mfaVerified: boolean
  claimsVersion: number
  accountStatus: 'active' | 'suspended' | 'disabled'
  responderType?: 'POL' | 'FIR' | 'MED' | 'ENG' | 'SAR' | 'SW' | 'GEN'
  breakGlassSession?: boolean
}
```

Claims refresh on sign-in, privileged status change, and explicit revocation events. Authorization fails closed when claims are missing, stale, or inconsistent with server-side account status.

### 5.3 JWT Staleness Bounding (Unchanged from v5 §3.4)

Three-layer mitigation:

1. **Force-refresh signal:** server writes to `claim_revocations/{uid}` on status change; client subscribes to its own doc and calls `getIdToken(true)` on change.
2. **`active_accounts/{uid}` lookup** on privileged paths — `isActivePrivileged()` rule reads this doc (1 extra read per privileged op; acceptable).
3. **60-second server-side session check** for break-glass and high-privilege mutations.

### 5.4 Anonymous Report Tracking (Unchanged)

- Public tracking reference: `2026-DAET-0471` — human-readable, shareable alone is insufficient.
- Tracking secret: ≥128-bit high-entropy string, surfaced once, stored in localForage.
- `lookupReportByToken(ref, secret)` callable — rate-limited per IP and per UID, App Check protected. Direct Firestore reads not used for anonymous lookup.
- SMS users: tracking secret is a 6-digit PIN (lower entropy, bounded by per-msisdn rate limits).

### 5.5 Account Lifecycle for Staff

**Creation path:**

- Responder: Agency Admin creates via `createResponder` callable → responder receives SMS invite with one-time link → completes phone OTP → sets TOTP → account activated.
- Municipal Admin: Superadmin creates via `createMunicipalAdmin` → invite → phone OTP → TOTP → activated.
- Agency Admin: Superadmin creates via `createAgencyAdmin` → invite → phone OTP → TOTP → activated.

**"Revoke Access" on lost device** (Agency Admin power from Agency spec):

- `revokeResponderAccess(responderUid)` callable available to owning Agency Admin.
- Sets `accountStatus: 'suspended'`, writes `claim_revocations/{uid}` with server timestamp, forces token refresh, streams audit event.
- Next time the lost device attempts any authenticated call, it fails closed.
- **Note on "wiping cached offline data":** Firebase SDK cannot remotely wipe IndexedDB on a device we don't control. What we CAN do is refuse authorization on every call, which makes the cached data useless. The Agency spec's language of "wiping cached offline data on next ping" is inaccurate — we reject auth instead. The UX consequence is equivalent.

**Session timeout clarification** (responder spec said "8 hours"):

- Firebase ID tokens are 1h TTL with auto-refresh. "Session timeout" at the app level means re-auth interval.
- Responder re-auth interval: **12 hours** (covers a full shift). After 12h, prompt for phone OTP re-entry on next app resume.
- Admin re-auth interval: **8 hours** for municipal/agency, **4 hours** for superadmin.
- Break-glass session: auto-disables at 4 hours regardless of activity (§11.6.1).

---

## 6. Data Model

### 6.1 Report Triptych (Plus)

Unchanged from v5. A single report is split across three documents to serve as a document-level security boundary:

```typescript
reports / { reportId } // Public-classifiable metadata
report_private / { reportId } // PII: msisdnHash, raw description
report_ops / { reportId } // Operational state: status, activeResponderCount, severity
report_contacts / { reportId } // Voluntary contact info (restricted access, independent retention)
report_lookup / { publicRef } // CF-maintained: publicRef → reportId mapping for tracking
report_notes / { noteId } // Narrative notes, classification, timestamps (no PII on parent doc)
```

New in v6:

```typescript
reports/{reportId}
  // ... all v5 fields ...
  source: 'citizen_app' | 'citizen_sms' | 'responder_witness' | 'admin_entry'  // NEW (§2.9)
  witnessPriorityFlag?: boolean                                                 // NEW for responder-witness
  hasPhotoAndGPS: boolean                                                       // NEW — replaces trustScore
  reporterRole?: 'citizen' | 'responder' | 'admin'                              // NEW — for responder-witness path
  visibility: {
    scope: 'municipality' | 'shared' | 'provincial'
    sharedWith: string[]                        // Municipality IDs when scope=shared
    sharedReason?: string
    sharedAt?: Timestamp
    sharedBy?: string                           // UID of admin who initiated sharing
  }
  updatedAt: Timestamp
  schemaVersion: number
```

**`trustScore` remains excluded** (§2.2). Any UI control referencing it is out.

**Free-form admin notes containing PII prohibited on the parent doc.** All narrative goes to `report_notes/{noteId}`.

### 6.2 Dispatches (Unchanged Structure, New Authority)

```typescript
dispatches/{dispatchId}
  reportId: string
  responderId: string
  municipalityId: string
  agencyId: string
  dispatchedBy: string                 // UID of admin (municipal OR agency)
  dispatchedByRole: 'municipal_admin' | 'agency_admin'    // NEW — attribution
  dispatchedAt: Timestamp
  status: DispatchStatus
  statusUpdatedAt: Timestamp
  acknowledgementDeadlineAt: Timestamp // NEW: per-dispatch, per §2.5
  acknowledgedAt?: Timestamp
  inProgressAt?: Timestamp
  resolvedAt?: Timestamp
  cancelledAt?: Timestamp
  cancelledBy?: string
  cancelReason?: string
  timeoutReason?: string
  declineReason?: string
  resolutionSummary?: string
  proofPhotoUrl?: string
  requestedByMunicipalAdmin?: boolean  // NEW (§7.3): true when agency dispatched in response to muni request
  requestId?: string                    // NEW: ref to agency_assistance_requests/{id}
  idempotencyKey: string
  schemaVersion: number
```

### 6.3 Dispatch State Machine

Unchanged from v5 §4.3:

- `pending → accepted` — **server-authoritative callable** `acceptDispatch`. Cannot be direct write (race hazard).
- `pending → declined` — responder direct write.
- `pending → timed_out` — server scheduled job (`dispatchTimeoutSweep`).
- `pending → cancelled` — server-authoritative admin action.
- `accepted → acknowledged` — responder direct write.
- `acknowledged → in_progress` — responder direct write.
- `in_progress → resolved` — responder direct write.
- `accepted | acknowledged | in_progress → cancelled` — server-authoritative admin action.
- `declined | timed_out | cancelled → superseded` — server-authoritative redispatch workflow.

Responder-direct transitions (`accepted → acknowledged`, etc.) are validated by Firestore rules. All privileged transitions go through callables.

### 6.4 Report State Machine (v5 §4.3.1, Retained)

```
draft_inbox → new → awaiting_verify → verified → assigned → acknowledged → en_route → on_scene → resolved → closed
                 ↓                 ↓                                                                          ↓
              rejected      merged_as_duplicate                                                           reopened
                            cancelled_false_report
                            cancelled
```

Transitions, actor, write authority per v5 §4.3.1. Unchanged. The Verified Responder path (§2.9) enters at `new` and proceeds normally through `awaiting_verify → verified`.

### 6.5 New Collections for v6

```
firestore/
  # From v5 — unchanged
  report_inbox, reports, report_private, report_ops, report_contacts, report_lookup,
  report_notes, report_events, dispatches, dispatch_events, users, responders, agencies,
  alerts, emergencies, provincial_resources, mutual_aid_requests, audit_logs,
  rate_limits, system_config, idempotency_keys, dead_letters, metrics_province,
  active_accounts, claim_revocations, device_registrations, moderation_incidents,
  sync_failures, sms_outbox, sms_inbox, sms_sessions, sms_provider_health,
  breakglass_events

  # NEW in v6
  agency_assistance_requests/{requestId}   # Municipal admin → agency admin dispatch requests (§7.3)
  mass_alert_requests/{requestId}          # NDRRMC escalation submissions (§7.4)
  command_channel_threads/{threadId}       # Inter-admin messaging, per-incident (§2.8, §7.3)
  command_channel_messages/{messageId}     # Messages within threads
  shift_handoffs/{handoffId}               # Admin shift handoff notes (§7.5)
  responder_shift_handoffs/{handoffId}     # Responder → responder handoff (§10)

rtdb/
  responder_locations/{uid}                # Unchanged from v5
  responder_index/{uid}                    # CF-maintained {municipalityId, agencyId}
  agency_responder_projection/{agencyId}/{uid}  # NEW: 30s-sampled read projection for
                                           # cross-agency map display (§8.5)
```

### 6.6 Agency Assistance Request (New)

When a Municipal Admin needs agency capability (e.g., PNP requested, BFP requested):

```typescript
agency_assistance_requests/{requestId}
  reportId: string
  requestedByMunicipalId: string       // Municipal admin UID
  requestedByMunicipality: string
  targetAgencyId: string
  requestType: 'BFP' | 'PNP' | 'PCG' | 'BFP' | 'RED_CROSS' | 'DPWH' | 'OTHER'
  message: string                       // "Fire spreading to adjacent building. Need 2 trucks."
  priority: 'urgent' | 'normal'
  status: 'pending' | 'accepted' | 'declined' | 'fulfilled' | 'expired'
  declinedReason?: string               // If status=declined
  fulfilledByDispatchIds: string[]     // Which dispatches satisfy this request
  createdAt: Timestamp
  respondedAt?: Timestamp
  expiresAt: Timestamp                  // Auto-expire 30 min if no response
```

Write authority:

- `requestAgencyAssistance` callable (municipal admin) creates the doc. Notifies target agency via FCM + command-channel message.
- `acceptAgencyAssistance` / `declineAgencyAssistance` callables (agency admin) transition state. Declining auto-notifies requesting municipal admin.
- Dispatches created by the agency admin after accepting carry `requestedByMunicipalAdmin: true` and `requestId: {requestId}` for attribution.

### 6.7 Firestore Security Rules — Additions

All v5 rules stand. New rules:

```javascript
// Agency assistance requests
match /agency_assistance_requests/{requestId} {
  allow read: if isActivePrivileged() && (
    // Municipal admin who requested, or any municipal admin of that muni
    (isMuniAdmin() && resource.data.requestedByMunicipality == myMunicipality())
    // Agency admin of the target agency
    || (isAgencyAdmin() && resource.data.targetAgencyId == myAgency())
    // Superadmin always
    || isSuperadmin()
  );
  allow write: if false;  // Callable only
}

// Command channel threads — inter-admin only, never readable by citizens or responders
match /command_channel_threads/{threadId} {
  allow read: if isActivePrivileged()
              && (isMuniAdmin() || isAgencyAdmin() || isSuperadmin())
              && request.auth.uid in resource.data.participantUids;
  allow write: if false;
}

match /command_channel_messages/{messageId} {
  allow read: if isActivePrivileged()
              && (isMuniAdmin() || isAgencyAdmin() || isSuperadmin())
              && get(/databases/$(database)/documents/command_channel_threads/$(resource.data.threadId))
                   .data.participantUids[request.auth.uid] != null;
  allow write: if false;
}

// Mass alert requests — visible to superadmin and requesting municipal admin
match /mass_alert_requests/{requestId} {
  allow read: if isActivePrivileged() && (
    isSuperadmin()
    || (isMuniAdmin() && resource.data.requestedByMunicipality == myMunicipality())
  );
  allow write: if false;
}

// Shift handoffs — own role scope only
match /shift_handoffs/{handoffId} {
  allow read: if isActivePrivileged()
              && (request.auth.uid == resource.data.fromUid
                  || request.auth.uid == resource.data.toUid
                  || isSuperadmin());
  allow write: if false;
}

// Reports — source field constrains writers
match /reports/{reportId} {
  // ... v5 rules ...
  // Additional: responder-witness source only writable via submitResponderWitnessedReport callable
  // Enforced by: resource.data.source in ['citizen_app', 'citizen_sms', 'responder_witness', 'admin_entry']
  //              AND request direct write path rejects source=responder_witness
}
```

### 6.8 RTDB: Agency Responder Projection (New)

The Agency Admin map must show other-agency responders on active incidents (ghosted dots per Agency spec). Letting 12 agencies each subscribe to every other agency's full RTDB tree is a cost and privacy problem.

**Solution:** A CF projection writes every active responder's location to `rtdb/agency_responder_projection/{agencyId}/{uid}` every 30 seconds with reduced precision (rounded to 100m grid) and minimal payload (`{lat, lng, agencyId, status}` — no battery, no accuracy, no motion state).

**Projection rule:**

```json
{
  "agency_responder_projection": {
    "$agencyId": {
      ".read": "auth != null
                && auth.token.accountStatus === 'active'
                && (auth.token.role === 'agency_admin'
                    || auth.token.role === 'municipal_admin'
                    || auth.token.role === 'provincial_superadmin')",
      "$uid": { ".write": false }
    }
  }
}
```

Own-agency responders are read directly from `responder_locations/{uid}` at full fidelity via the unchanged v5 rule.

---

## 7. Role Workflows — Canonical Definitions

This section defines what each role actually does in the system, absorbing the role specs. UX details (exact tab labels, panel layouts) remain in the role specs as design references; the authoritative functional contracts are below.

### 7.1 Citizen

**Primary surface:** Citizen PWA. Feature-phone users hit the SMS ingest path.

**Capabilities:**

- Submit reports (via app form or SMS keyword).
- Upload photos/videos (EXIF-stripped server-side).
- Provide GPS location (auto-detected) or select municipality/barangay as fallback.
- View public map and feed (verified incidents, location-blurred for pseudonymous feed).
- Receive official alerts (FCM + SMS depending on registration).
- Track own report status (via tracking reference + secret, OR via registered account).
- Edit unverified reports (before municipal admin verifies).
- Cancel pending reports (before verification).
- Request correction on verified reports (admin approval required).
- Upgrade pseudonymous session to registered account (preserves UID and history).

**Constraints (per §2):**

- No verification authority.
- No dispatch visibility beyond own report status.
- No citizen contact info of others visible.
- Admin identity (individual names) never surfaced; institutional labels only.

**Submit flow data boundary:**

- Client writes to `report_inbox/{id}` (direct, rate-limited, App Check required).
- CF trigger `processInboxItem` materializes the triptych (`reports`, `report_private`, `report_ops`, optional `report_contacts`, `report_lookup`).
- Reconciliation sweep every 5 min catches trigger failures.

**Offline submission path:**

- Draft auto-saved to localForage every 30s during composition.
- On submit: Firestore SDK offline write queues via IndexedDB persistence; localForage outbox also writes.
- On reconnect: Firestore SDK replays; localForage outbox detects successful write and clears; if Firestore write failed, localForage retries via explicit replay handler (§9.3).
- Tracking reference is generated client-side as a UUID until server confirmation; after confirmation, the user-facing human-readable reference is swapped in.

**Rate limits:**

- Per pseudonymous UID: 3 reports / hour, 10 / day.
- Per msisdn hash (SMS): 3 reports / hour, 10 / day.
- Per IP (fallback gate): 20 reports / day (protects against App Check bypass attempts at CDN level).
- Rate limit counters in `rate_limits/{key}` with 1h and 24h windows. Soft limit triggers moderation queue elevation, hard limit returns error with suggested alternate contact (barangay hotline).

### 7.2 Responder

**Primary surface:** Responder Capacitor app.

**Capabilities:**

- Receive dispatch notifications (FCM high-priority).
- Accept (via `acceptDispatch` callable — server-authoritative, resolves races) or decline (direct write with reason).
- Transition own dispatch through `acknowledged → en_route → on_scene → resolved` (direct writes, rule-validated).
- SOS emergency signal — dedicated callable `triggerSOS` that fires FCM + SMS to all admins in responder's municipality/agency, logs `breakglass_events`-equivalent entry, and never silently fails.
- Quick status toggles (per responder spec §6) — map to the same transitions; one-tap UX only.
- Add field notes (direct write to `reports/{id}/field_notes/{noteId}`, rule validates responder is assigned).
- Upload field photos (signed URL via `requestUploadUrl`, per v5 §10.4).
- Request backup / additional resources via `requestBackup` callable — routes to assigned municipal admin.
- Request provincial escalation via `requestProvincialEscalation` callable — routes to superadmin.
- "Unable to complete" workflow via `markDispatchUnableToComplete` callable — admin-reviewable, no penalty, triggers reassignment.
- Set availability: `available` / `unavailable` / `off_duty` — direct write to `responders/{self}.availabilityStatus` with required reason.
- View own performance metrics (via TanStack Query callable).
- Shift handoff to another responder: `initiateResponderHandoff` callable (§10.1).
- **Verified Responder Report** (§2.9) — `submitResponderWitnessedReport` callable, rate-limited 10/24h per responder.
- One-tap call admin (native `tel:` intent, no in-app calling).

**Constraints:**

- Cannot verify, classify, or change severity of reports.
- Cannot see reports outside active assignment (jurisdiction scope).
- Cannot see citizen contact info (privacy).
- No direct responder-to-responder messaging (explicit architectural choice; all comms through admin or command channel threads they're not in).
- **No Facebook Messenger integration** (rejected — external third-party, RA 10173 data residency, no SLA, no audit).

**Location sharing:**

- Active only during `acknowledged → en_route → on_scene` states (dispatch active).
- Motion-driven cadence per §8.2 (v5, unchanged).
- Retention: 90 days (overrides responder spec's 24h — 90 days needed for post-incident review per architecture §6.4).
- Opt-out exists in settings but breaks active-dispatch acceptance (admin must have telemetry on live dispatches; opting out moves responder to `unavailable`).

**Auth friction:**

- Phone OTP + TOTP mandatory.
- 12-hour re-auth interval.
- Cannot self-register (Agency Admin creates).

### 7.3 Municipal Admin

**Primary surface:** Admin Desktop PWA.

**Scope:** One municipality. No cross-municipality authority except shared border incidents (§7.3.3).

**Capabilities:**

- **Verify reports:** `verifyReport` callable, transitions `awaiting_verify → verified`, sets `reportType` and `severity`, triggers FCM + SMS to reporter (per §2.7, institutional attribution).
- **Reject reports:** `rejectReport` callable, transitions `awaiting_verify → cancelled_false_report`, logs moderation incident.
- **Merge duplicates:** `mergeReports` callable, sets `mergedInto` on duplicate, updates duplicate cluster.
- **Dispatch own municipality's responders directly:** `dispatchResponder` callable, creates `dispatches/{id}` entry at `pending`.
- **Request agency assistance:** `requestAgencyAssistance` callable (§6.6), creates `agency_assistance_requests/{id}`, notifies target agency.
- **Cancel dispatches:** `cancelDispatch` callable, routes any active dispatch to `cancelled` with reason.
- **Redispatch after decline / timeout:** `redispatchReport` callable creates new dispatch, marks old as `superseded`.
- **Communicate with citizens:** via `addMessage` callable writing to `reports/{id}/messages`.
- **Command Channel threads** with agency admins and superadmins (§7.3.4).
- **Send municipality-scoped mass alerts** via `sendMassAlert` callable — routing enforced per §2.6:
  - If estimated SMS recipients ≤ 5,000 AND target is single municipality → sent directly via FCM + Semaphore priority queue.
  - Else → UI routes as NDRRMC Escalation Request (§7.4).
- **View own municipality's responders' real-time telemetry** (RTDB direct read, rule-scoped).
- **View other-agency responders on incidents in own municipality** (ghosted projection, §6.8).
- **Close resolved incidents:** `closeReport` callable, transitions `resolved → closed`.
- **Reopen closed incidents:** `reopenReport` callable, transitions `closed → assigned` with audit.
- **View municipality analytics:** response times, resolution rates, anonymized provincial comparison (via TanStack Query callables).
- **Shift handoff** (§7.5).

**Constraints:**

- Cannot view or write to reports outside own municipality, EXCEPT shared border incidents.
- Cannot dispatch responders outside own municipality (responders have `permittedMunicipalityIds`).
- Cannot see other municipalities' analytics (anonymized comparisons OK).
- Cannot modify citizen reports (only classify).
- Cannot bypass responder opt-in (dispatches go to `pending`, responder accepts).
- Cannot promote users or change roles (superadmin only).

#### 7.3.1 Surge Triage Mode

Address of the municipal spec §1 "Process 50+ reports/hour" requirement:

- Activated via UI toggle on the Admin Desktop; client-side filter/sort optimization only, no server behavior change.
- Queue renders in a scannable list view instead of map overlays.
- Single-key shortcuts: `V` verify, `R` reject, `M` merge-with-selected, `S` skip.
- Bulk operations use the same per-report callables — no special "bulk verify" that short-circuits rule checks.
- Loading bound: 100 reports rendered, older paginated. Pre-warmed server instances (§10.1) absorb the callable rate.

#### 7.3.2 Auto-Verify Is Gone

Per §2.2. The Panel A "TRUST SCORE" and "Auto-Verify" controls from the Municipal Admin spec are cut. Replacement:

- Panel A surfaces `hasPhotoAndGPS: true`, `source`, `reporterRole` (if responder-witness), reporter registered/pseudonymous flag.
- Verification remains one-tap for the admin but is never executed without that tap.

#### 7.3.3 Border Incidents (Shared Visibility)

- A report's `visibility.scope = 'shared'` sets `sharedWith` to a list of municipality IDs.
- Sharing is initiated by:
  - CF trigger when geo-intersection of report location + municipal boundary buffer (500m) detects the report is near a border.
  - Explicit share by a municipal admin via `shareReportWithMunicipality` callable.
- All sharing actions write to audit (`sharedBy`, `sharedReason`, `sharedAt`).
- Adjacent municipal admins see a "Shared Incident" badge; can dispatch their own responders; cannot modify verification status (originator municipality owns that).

#### 7.3.4 Command Channel Threads

Per-incident messaging between admins (municipal ↔ agency, municipal ↔ municipal on shared incidents, any ↔ superadmin).

- `command_channel_threads/{threadId}` created automatically when: report is shared, agency assistance is requested, provincial escalation is requested.
- Participants: all admins with operational stake in the incident.
- Messages written via `postCommandChannelMessage` callable.
- Retention: same as parent report.
- All messages are audit-streamed to BigQuery (batch path).

### 7.4 Agency Admin

**Primary surface:** Admin Desktop PWA.

**Scope:** One agency (BFP Daet, PNP Daet, Red Cross Camarines Norte, DPWH, etc.). May operate across multiple municipalities if the agency does (PNP Provincial, for example).

**Capabilities:**

- **Manage agency roster:** create/edit/suspend responders (`createResponder`, `updateResponder`, `suspendResponder` callables, all rule-gated to own `agencyId`).
- **Set shifts:** bulk on-duty / off-duty toggles at shift change times via `bulkSetResponderAvailability` callable.
- **Tag responder specializations** (`Swift Water Rescue`, `Hazmat Certified`, etc.) — fields on `responders/{uid}.specializations[]`.
- **View verified incidents** in agency's operational jurisdiction (no pending-queue visibility per §2.1).
- **View agency assistance requests** from municipal admins; `accept` or `decline` with reason.
- **Dispatch own agency's responders** to any incident they have access to (verified, assistance-requested, or responder-witnessed with their agency involvement).
- **View own agency responder status** at full telemetry fidelity.
- **View other-agency responders** at 30s-sampled 100m-grid projection (§6.8).
- **Communicate with own responders** via `reports/{id}/messages` subcollection.
- **Command Channel threads** with municipal admins on incidents their agency is engaged in.
- **View agency-scoped analytics:** response time, personnel-hours, incident heatmap for own agency.
- **Export monthly accomplishment report** (agency-specific PDF per Agency spec §Analytics).
- **Revoke responder access** (lost device) via `revokeResponderAccess` callable.
- **Decline assistance requests** when no units available (`declineAgencyAssistance`).

**Constraints:**

- **No report verification authority** (§2.1). Even the responder-witness bypass goes through a municipal admin, not the agency admin.
- **No mass alerts to citizens** — neither municipality-scoped nor province-wide. Operational messaging to own responders only, via the normal message subcollection.
- **No dispatching other agencies.**
- **No managing other agencies' rosters.**
- **No system-wide analytics** (agency-scoped only).

#### 7.4.1 Hub-and-Spoke Model (Agency Spec "UPDATED")

Retained as primary flow:

1. Citizen submits → `report_inbox`.
2. Municipal Admin verifies → `verified`.
3. Municipal Admin clicks "Request Agency Assistance" → creates `agency_assistance_requests/{id}`.
4. Agency Admin receives FCM + command-channel notification.
5. Agency Admin reviews verified report, clicks "Dispatch Team Alpha" → creates `dispatches/{id}` with `requestId` linked and `requestedByMunicipalAdmin: true`.
6. Municipal Admin dashboard auto-updates: "BFP Daet dispatched Team Alpha."
7. Responder acknowledges, proceeds, resolves.
8. Agency Admin marks their agency's dispatches as resolved; Municipal Admin closes the report.

The older "Self-Dispatch (Agency First)" flow from the Agency spec is **rejected** because it required agency verification (§2.1). The Verified Responder Report path (§2.9) covers the legitimate "responder sees something" case.

### 7.5 Provincial Superadmin

**Primary surface:** Admin Desktop PWA, dual-monitor.

**Scope:** Entire province (12 municipalities). Analytics-first interface (per superadmin spec §Interface Design).

**Capabilities:**

- **All Municipal Admin capabilities, province-wide.**
- **User management:** create/suspend/promote staff accounts for all roles. `createUser` callable with role parameter. Self-demotion prohibited.
- **Declare provincial emergency:** `declareEmergency` callable, sets `emergencies/{id}`, fans out FCM + SMS to all active staff + authorized citizen subset.
- **Approve NDRRMC escalation requests:** reviews `mass_alert_requests/{id}` and forwards to NDRRMC via `forwardMassAlertToNDRRMC` workflow (§7.4 below).
- **Toggle mutual-aid visibility** for cross-municipality agency response (per Agency spec edge case).
- **Manage provincial resources:** `provincial_resources/{id}` CRUD via callables.
- **View all audit logs** (streaming + batch BigQuery access via separate IAM).
- **Retention exemptions:** `setRetentionExempt` callable, streams audit.
- **Approve data subject erasure requests.**
- **Trigger surge pre-warm manually** (normally automatic on PAGASA signal).
- **Break-glass review:** any break-glass session actions get independent review within 72h.
- **Read `report_private` and `report_contacts`** — streaming audit on every such read.
- **View SMS audit** (`sms_outbox`), provider health, system-health dashboards.

**Constraints:**

- Still requires MFA + TOTP + 4h re-auth interval.
- Cannot read citizen data without audit trail.
- Cannot change own role.
- Cannot disable audit streaming.

#### 7.5.1 NDRRMC Escalation Workflow

Per v5 §2.3 and §2.6:

1. Municipal admin (or superadmin) composes mass alert.
2. UI Reach Plan preview shows estimated recipients per channel.
3. If SMS recipients > 5,000 OR multi-municipality → UI routes as escalation.
4. `requestMassAlertEscalation` callable creates `mass_alert_requests/{id}` with:
   - Draft message, target areas, hazard class, evidence pack (linked reports, PAGASA ref).
   - `status: 'pending_pdrrmo_review'`.
5. FCM + priority SMS to PDRRMO Director.
6. Superadmin reviews in Admin Desktop. Approves → `status: 'forwarded_to_ndrrmc'` + captures forward method (phone, email, formal letter) + NDRRMC receipt acknowledgment timestamp.
7. NDRRMC decides to dispatch via ECBS or not; their decision is recorded but not executed by Bantayog.
8. Audit captures end-to-end latency (submission → NDRRMC receipt → ECBS dispatch if any).

**Critically:** The UI everywhere distinguishes "Escalation submitted to NDRRMC" from "Sent via our SMS layer." We do not claim to have issued an ECBS alert (v5 §2.3, unchanged).

### 7.6 Admin Shift Handoff (All Admin Roles)

- `initiateShiftHandoff` callable creates `shift_handoffs/{id}` with:
  - `fromUid`, `toUid`, `fromRole`, `toRole`
  - `activeIncidentSnapshot`: array of active incident summaries (IDs, status, age, responders assigned)
  - `urgentItems`: array of admin-flagged concerns
  - `pendingRequests`: array of open agency requests / escalations
  - `generalNotes`: free-form narrative
  - `status: 'pending_acceptance'`
- Incoming admin receives FCM + in-app notification.
- Incoming admin accepts via `acceptShiftHandoff` → `status: 'accepted'`.
- If no acceptance within 30 min, superadmin notified.
- Handoff doc is immutable after acceptance; modifications are new handoff docs (append-only).
- Retention: 2 years (operational record, not PII-heavy).

---

## 8. Responder Location & Mobile Execution

### 8.1 Telemetry Model (Unchanged from v5)

Written to RTDB only while on active assignment or explicit duty state. Record: `capturedAt`, `receivedAt` (server), `lat`, `lng`, `accuracy`, `batteryPct`, `motionState`, `appVersion`, `telemetryStatus`.

### 8.2 Motion-Driven Sampling (Unchanged from v5)

| Hardware-reported activity               | GPS polling                | Rationale                        |
| ---------------------------------------- | -------------------------- | -------------------------------- |
| `running` / `in_vehicle` (high priority) | 10s ± 2s                   | Real-time during active response |
| `walking` (normal priority)              | 30s ± 5s                   | Moving but not urgent            |
| `still` + on active dispatch             | Geofence-only + 5min ping  | Stationary at staging            |
| `still` + low battery (<20%)             | Geofence-only + 10min ping | Battery preservation             |
| No active dispatch                       | No tracking                | Off-duty zero telemetry          |

Geofence: 50m radius around responder's position at `acknowledged`. Exit resumes active polling. Jitter prevents thundering-herd reconnection.

### 8.3 Stale-State Display (Unchanged from v5)

| `telemetryStatus` | Definition                                  | UX                      |
| ----------------- | ------------------------------------------- | ----------------------- |
| `live`            | `receivedAt` within 2× expected interval    | Normal                  |
| `degraded`        | Within 4× expected interval                 | Yellow, age label       |
| `stale`           | Exceeds 4× expected interval                | Gray, "last seen X ago" |
| `offline`         | No receivedAt for 5+ min on active dispatch | Red, dispatcher alert   |

### 8.4 Cost Behavior Under Degraded Networks (Unchanged)

Baseline ~$0.40/day at 30 responders × 24h. Under reconnection storms, 10×–100× multiplier is realistic. Budget alerts at 5×, 10×, 25× baseline. Connection backoff is exponential with jitter.

### 8.5 Cross-Agency Visibility Projection

New in v6 to support agency admin "ghosted other-agency responders" view:

- CF `projectResponderLocationsForAgencies` runs every 30s.
- Iterates active dispatches, grouped by municipality.
- For each responder on active dispatch, writes to `rtdb/agency_responder_projection/{peerAgencyId}/{responderUid}`:
  - `lat`, `lng` rounded to 100m grid (privacy-preserving)
  - `agencyId` of responder
  - `status` (`en_route` | `on_scene`)
  - `updatedAt` server timestamp
- Each entry has 90s TTL; if not refreshed, cleared.
- RTDB rules allow read to `agency_admin`, `municipal_admin`, `provincial_superadmin` (active) regardless of peer ID — this is the inter-agency coordination surface.

**Cost note:** 30 responders × 12 projections each = 360 writes/30s = 720 writes/min on RTDB. At RTDB bandwidth pricing (Firebase RTDB charges per-GB downloaded), this is negligible. At Firestore write pricing this would be expensive; that's why it's on RTDB.

---

## 9. Frontend Architecture

### 9.1 Three-App State Ownership

Per §3, three surfaces have three state profiles. The State Ownership Matrix (v5 §9.1.1) is extended:

### 9.2 Citizen PWA State Ownership

| Data category                                   | Authority                             | Everything else must     | Rationale                                                  |
| ----------------------------------------------- | ------------------------------------- | ------------------------ | ---------------------------------------------------------- |
| Server documents (reports, alerts)              | Firestore SDK                         | Read via listeners       | Single server truth; SDK-native offline                    |
| UI state (modal, form field, tab)               | Zustand                               | Never touch server cache | UI only                                                    |
| Non-Firestore HTTP (callables, tracking lookup) | TanStack Query                        | Never hand-cache         | Built-in invalidation + retry                              |
| **Drafts + queued submissions**                 | **localForage + Firestore SDK queue** | Always write to both     | SDK queue alone is vulnerable to IndexedDB eviction on iOS |
| Tracking secrets                                | localForage                           | Never in Zustand         | Survives app restart                                       |

### 9.3 Responder App State Ownership

| Data category                                    | Authority                                |
| ------------------------------------------------ | ---------------------------------------- |
| Server documents (dispatches, reports, messages) | Firestore SDK                            |
| UI state                                         | Zustand                                  |
| Non-Firestore HTTP (callables)                   | TanStack Query                           |
| Foreground-service status                        | Capacitor Preferences                    |
| Last known motion activity                       | Capacitor Preferences + in-memory        |
| GPS telemetry                                    | Write-only to RTDB; no local persistence |

No outbox layer. Responder writes are single-actor sequential transitions on dispatches the responder owns; SDK queue handles reconnection correctly.

### 9.4 Admin Desktop State Ownership

| Data category                                                 | Authority                       |
| ------------------------------------------------------------- | ------------------------------- | --------------------------------------------- |
| Server documents (reports, dispatches, responders, analytics) | Firestore SDK                   |
| UI state (map viewport, selected entity, panel, filters)      | Zustand                         |
| Non-Firestore HTTP (callables, analytics aggregates, exports) | TanStack Query                  |
| **No outbox, no offline writes**                              | Blocked at UI when disconnected | Admin mutations are high-stakes, never queued |

### 9.5 Listener Management

TanStack Query wraps Firestore `onSnapshot` listeners with a listener registry preventing duplicates. TanStack Query is **not** the consistency layer — Firestore is. This is unchanged from v5.

### 9.6 Map Rendering

All three apps use Leaflet + OSM tiles.

- Citizen PWA: client-rendered pins with 100-pin cap, clustering above.
- Responder app: own dispatches + route overlay only.
- Admin Desktop: full-density map with clustering, per-role overlays, real-time responder markers.
- Tile caching: 24h browser cache for citizen/responder; no tile caching assumed for admin (always online).

---

## 10. Backend Architecture

### 10.1 Cloud Functions Configuration (Unchanged from v5)

- `processInboxItem`: `minInstances: 3`, `maxInstances: 100`, `concurrency: 80`, `timeout: 120s`, `memory: 512MiB`.
- `inboxReconciliationSweep`: every 5 min, scans for unprocessed inbox items > 5 min old, retries up to 3 times, dead-letters on 3 fails.
- `smsOutboxCleanup`: daily, purges 90-day-old SMS records.
- `smsProviderHealthProbe`: every 2 min.
- `dispatchTimeoutSweep`: every 30s, applies `pending → timed_out` per §2.5.
- `projectResponderLocationsForAgencies`: every 30s (§8.5).
- Typhoon pre-warm on PAGASA Signal-2+: `minInstances` bumped for `processInboxItem`, `acceptDispatch`, `sendSMS` from 3 → 20. Reverts 6h after signal drops.

### 10.2 New Callables in v6

| Callable                                                   | Actor Role                                           | Purpose                                                    |
| ---------------------------------------------------------- | ---------------------------------------------------- | ---------------------------------------------------------- |
| `submitResponderWitnessedReport`                           | responder                                            | Pre-classified report with elevated triage priority (§2.9) |
| `requestAgencyAssistance`                                  | municipal_admin                                      | Create assistance request to agency (§7.3)                 |
| `acceptAgencyAssistance` / `declineAgencyAssistance`       | agency_admin                                         | Respond to municipal request                               |
| `createResponder` / `updateResponder` / `suspendResponder` | agency_admin                                         | Roster management                                          |
| `bulkSetResponderAvailability`                             | agency_admin                                         | Shift toggle                                               |
| `revokeResponderAccess`                                    | agency_admin                                         | Lost device                                                |
| `shareReportWithMunicipality`                              | municipal_admin                                      | Explicit cross-muni share                                  |
| `initiateShiftHandoff` / `acceptShiftHandoff`              | municipal_admin, agency_admin, provincial_superadmin | Admin handoff                                              |
| `initiateResponderHandoff`                                 | responder                                            | Responder shift handoff (§10.1)                            |
| `triggerSOS`                                               | responder                                            | SOS broadcast                                              |
| `requestBackup`                                            | responder                                            | Backup request routing                                     |
| `requestProvincialEscalation`                              | responder                                            | Provincial escalation request                              |
| `markDispatchUnableToComplete`                             | responder                                            | Unable-to-complete workflow                                |
| `requestMassAlertEscalation`                               | municipal_admin, provincial_superadmin               | NDRRMC escalation submission                               |
| `forwardMassAlertToNDRRMC`                                 | provincial_superadmin                                | Forward escalation with receipt                            |
| `postCommandChannelMessage`                                | admin roles                                          | Inter-admin messaging                                      |
| `massAlertReachPlanPreview`                                | municipal_admin, provincial_superadmin               | Preview recipient estimates before send                    |

All callables: App Check required, idempotency key required, correlation ID propagated, fail-closed on missing claims.

### 10.3 Concurrency & Cross-Doc Invariants

Mutations spanning multiple documents execute in Firestore transactions. Examples:

- `acceptDispatch`: transaction on `dispatches/{id}` + `report_ops/{reportId}` (activeResponderCount increment).
- `verifyReport`: transaction on `reports/{reportId}` + `report_ops/{reportId}` + append to `report_events/{eventId}`.
- `submitResponderWitnessedReport`: transaction on `reports/{id}` + `report_private/{id}` + `report_ops/{id}` + `report_lookup/{ref}` + `report_events/{eventId}`.

### 10.4 Failure Handling (Unchanged)

- Transient failures: CF native retry, exponential backoff, max 5.
- Downstream API calls (SMS, NDRRMC, external agency APIs): Cloud Tasks with 72h retry windows.
- Permanent failures: `dead_letters/{id}` with payload, correlation ID, failure category, retry history, operator action.
- Dead-letter replay: superadmin-only workflow, audit-logged.

### 10.5 Signed URL Hardening (Unchanged)

`Content-Type` restriction, `x-goog-content-length-range` 0–20MB images / 0–200MB video, 10-min expiry, per-UID rate limits, magic-byte verification on finalize.

---

## 11. Deployment & Operations

### 11.1 Environments

- `bantayog-dev` — emulators, developer testing.
- `bantayog-staging` — pre-production, integration testing, load testing.
- `bantayog-prod` — production.

Credentials never shared across environments. Staff accounts separate.

### 11.2 Service Level Objectives

| Metric                                                              | Target                         | Window         |
| ------------------------------------------------------------------- | ------------------------------ | -------------- |
| Citizen report acceptance latency (network present)                 | p95 < 3s                       | rolling 5min   |
| Dispatch creation latency (admin click → responder FCM)             | p95 < 10s                      | rolling 5min   |
| Push delivery attempt success                                       | > 95%                          | rolling 1h     |
| SMS delivery attempt success (priority)                             | > 90%                          | rolling 1h     |
| SMS delivery attempt success (normal)                               | > 80%                          | rolling 1h     |
| Telemetry freshness (live responders)                               | > 90% of dispatched responders | rolling 5min   |
| RPO                                                                 | ≤ 24h                          | per incident   |
| RTO                                                                 | ≤ 4h                           | per incident   |
| Audit export gap (streaming)                                        | ≤ 60s                          | continuous     |
| Audit export gap (batch)                                            | ≤ 15min                        | continuous     |
| Inbox reconciliation backlog                                        | < 5 items older than 5min      | continuous     |
| Admin dashboard load (p95)                                          | < 5s                           | rolling 1h     |
| **Agency assistance request response time (p95)**                   | **< 3min accept/decline**      | **rolling 1h** |
| **Responder-witnessed report → municipal admin verification (p95)** | **< 5min**                     | **rolling 1h** |

### 11.3 Backup and Recovery (Unchanged)

- Firestore: daily managed exports, 30-day retention.
- RTDB: daily backups, 7-day retention.
- Storage: object versioning, 12-month lifecycle on non-current versions.
- Quarterly full-stack restore drills.
- Terraform state in GCS with versioning + state lock.
- Firebase CLI artifacts in git with tagged releases.
- Restore command: `terraform apply` + `firebase deploy --project bantayog-prod`.

### 11.4 Rollout and Rollback (Unchanged)

- Hosting: instant via Firebase Hosting release channels.
- Functions: targeted rollback via `firebase deploy --only functions:<n>`.
- Rules: redeploy from known-good git commit; rules history audited.
- Schema changes: backward-compatible across one rolling window. Breaking changes use `schemaVersion` + migration window.
- Forced client upgrade: `system_config/min_app_version` with separate floors for citizen vs admin vs responder to avoid blocking emergency reporting during a partial deploy issue.

### 11.5 Security Operations

- MFA mandatory for all staff. TOTP for staff above responder, plus phone OTP for all.
- Secrets in Secret Manager, rotated quarterly.
- Lost-device runbook with `revokeResponderAccess` / `suspendAdmin` callables.
- Emergency access revocation < 30s via force-refresh + `active_accounts` check.

### 11.6 Break-Glass (Unchanged from v5 §11.6.1)

Sealed escrow at Governor's Office + PDRRMO Director. Dual-control unseal via named authorizers + Architecture Team on-call. 4-hour auto-expiring session. Every action streaming-audited. 72h post-event review. Quarterly drill.

### 11.7 Observability Dashboards

Four dashboards, named owners:

- **Operations** (Ops on-call): queue depths, stale telemetry, dispatch acceptance latency, FCM+SMS delivery, **agency assistance response time**, **responder-witness verification latency**.
- **Backend** (Backend on-call): function invocations/errors/p95, dead-letter growth, Firestore/RTDB quota, Cloud Tasks depth.
- **Compliance** (Compliance officer): audit gaps, privileged reads of `report_private`/`report_contacts`, cross-muni access events, erasure requests, retention-exempt counts, break-glass activations.
- **Cost** (Ops + Finance): daily spend by service (including SMS Semaphore + Globe Labs separately), 7-day baseline, surge pre-warm hours, per-municipality allocation.

Alerts without runbooks are noise and must be downgraded or removed.

---

## 12. Testing Strategy

Prioritizes failure behavior over coverage percentages.

### 12.1 Test Layers

| Layer          | Tool                                 | Target                                                                                                                                                                                          |
| -------------- | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit           | Vitest                               | Domain logic, validation, state-machine transitions                                                                                                                                             |
| Security rules | Firebase Emulator + Vitest           | Positive AND negative cases per rule; cross-muni leakage attempts; **agency write-to-other-agency-responder attempts must fail**; **responder write-to-another-responder's-dispatch must fail** |
| RTDB rules     | Firebase Emulator                    | Positive + negative for every path; timestamp validation; **cross-agency projection read permissions**                                                                                          |
| Integration    | Emulator + staging                   | Callable commands, retries, dedup, event fan-out, restore compatibility                                                                                                                         |
| E2E            | Playwright + real-device smoke tests | Critical workflows under reconnect, permission revocation, stale claims, failed push, app restart during queue replay                                                                           |
| Load           | k6 + synthetic replay                | Surge patterns beyond peak: 500 concurrent citizen submits, 100 admin dashboards, 60 GPS streams, duplicate submissions, notification bursts, websocket reconnection storms                     |
| Chaos          | Scripted fault injection             | Network loss mid-submission, delayed retries, dead-letter growth, regional dependency drills, FCM degradation                                                                                   |

### 12.2 Pilot-Blocker Scenarios

**From v5:**

1. Two responders accept same dispatch within 100ms (one offline) → exactly one wins.
2. Citizen on 2G submits, locks phone, reopens 2h later → `server_confirmed` within 60s.
3. Suspended admin's token refresh within 60s of suspension.
4. Cross-muni read attempt rejected at rule layer.
5. Audit export pause 30min → alert + backfill.
6. RTDB websocket reconnection storm → cost stays within 5×.
7. IndexedDB eviction during offline draft → localForage recovers.
8. Feature-phone user texts `BANTAYOG FLOOD CALASGASAN` → parsed, materialized, auto-reply.
9. Semaphore 500 for 30s → circuit-break to Globe Labs, no dropped alerts.
10. `processInboxItem` fails for specific item → reconciliation sweep retries within 5min, no dead-letter.
11. 100k-recipient mass alert at staging → routes as NDRRMC escalation, not blast.
12. Break-glass drill: dual-control → 4h session → auto-deactivation → audit verifiable.
13. Responder stationary 4h at staging → battery drop <15%.
14. Typhoon pre-warm on Signal-2 → minInstances raised → verified warm → reverts 6h post-signal.

**New in v6:** 15. **Agency admin attempts `verifyReport` callable** → rejected with `PERMISSION_DENIED`. Rule test confirms. 16. **Responder submits witness report in municipality outside `permittedMunicipalityIds`** → report created with `crossJurisdictionFlag: true`, superadmin notified. 17. **Responder-witness report → municipal admin sees "Responder-Witnessed" badge → verifies → verification latency p95 < 5min** in drill. 18. **Municipal admin attempts mass alert with 15,000 estimated recipients** → UI routes as NDRRMC escalation; `sendMassAlert` callable refuses direct send. 19. **Agency admin revokes responder access** → responder's next authenticated call fails; offline-cached data unreadable due to auth rejection. 20. **Citizen-facing UI never renders `actorId`** on any report event, only institutional labels. Regression test across all report state transitions. 21. **Shift handoff not accepted within 30min** → superadmin alerted. 22. **Agency assistance request not responded to within 30min** → auto-escalates to superadmin. 23. **Two municipal admins simultaneously attempt to merge overlapping duplicate clusters** → one wins via transaction, other retries with refreshed state. 24. **Command channel thread retains full history across report lifecycle; archived with report.** 25. **Responder "Unable to complete" → report returns to admin queue → admin reassigns → audit trail continuous across dispatch supersession.**

Success criteria tied to §11.2 SLOs, not coverage %.

---

## 13. Risks & Residual Reality

Unchanged v5 risks remain. New and updated risks:

| Risk                                                          | Residual Reality                                                            | Mitigation                                                                                                                |
| ------------------------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **Role capability drift between UI and rules**                | UI shows a button the rules reject → user confused, audit noisy             | Capability contract tests: every UI action maps to a rule check; CI enforces                                              |
| **Verified Responder Report abuse**                           | Responders create fake reports to inflate metrics                           | 10/24h rate limit + GPS + photo required + audit trail on bypass + superadmin review of cross-jurisdiction flags          |
| **Agency assistance requests pile up during surge**           | Municipal admin blocked waiting for agency response                         | 30-min auto-escalate to superadmin; request UI shows "pending N minutes" age prominently                                  |
| **Admin without connectivity tries to write**                 | Silent queuing creates stale mutations replayed out of order                | Admin Desktop explicitly blocks writes when offline (§3.3); blocking modal instead of outbox                              |
| **Command channel messages leak between unrelated incidents** | PII or operational info crosses incident boundaries                         | Thread ID is tied to report; membership controlled by incident stake; rule tests for negative cases                       |
| **"Admin identity hidden" not enforced at data layer**        | Citizen discovers admin UID through aggregation                             | `report_lookup` and citizen-facing listeners never include actor fields; CF-projected from `report_events` with stripping |
| **Projection staleness for cross-agency map**                 | Agency Admin sees outdated position of other-agency responder               | 90s TTL on projection entries; "last updated X ago" shown on ghosted markers                                              |
| **Responder-witness report floods triage queue**              | Well-meaning responders create many reports                                 | Witness priority flag is triage hint, not bypass; admin still verifies each; rate limit caps 10/24h per responder         |
| **Shift handoff never accepted**                              | Incoming admin doesn't see notification                                     | 30-min escalation to superadmin; handoff doc persists even if unread so context isn't lost                                |
| **SMS content policy drift**                                  | Admin composes message with emoji / shortener; aggregator rejects or strips | Server-side sanitization in `sendSMS` abstraction; UI preview shows exactly what will send                                |

---

## 14. Open Risks Pilot Must Validate

From v5, retained:

1. iOS PWA storage eviction real-world rate.
2. External agency API readiness (Cloud Tasks assumes eventual recovery).
3. MFA adoption friction with field staff.
4. Tracking-secret loss rate for pseudonymous citizens.
5. Cost under real surge.
6. SMS provider reliability during real typhoon.
7. Feature-phone SMS parsing accuracy in Tagalog + regional variants.
8. Break-glass drill fidelity.
9. Battery life on real responder devices.

New in v6:

10. **Agency assistance response time** — does the 30-min auto-escalate threshold match operational reality, or does it need to be per-agency configurable?
11. **Verified Responder Report usage rate and accuracy** — does the 10/24h rate limit match legitimate field use? Is the priority-flag actually speeding verification?
12. **Command channel thread adoption** — do admins actually use it, or do they default to phone calls bypassing audit?
13. **Cross-agency projection cost and latency** — does 30s sampling hold up at 203 active responders province-wide?
14. **Municipal mass alert routing friction** — when does the 5,000 threshold surprise an admin who thought they could blast their municipality?
15. **Responder-app Capacitor upgrade cycle** — how painful is pushing a new APK/IPA to active responders during an operational period? Needs a pilot-validated rollout playbook.

---

## 15. Access Model Summary

System defines access by **data class**, not collection name:

| Data Class                                                | Permitted Roles                                                                                 | Conditions                      |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------- |
| Public alertable (feed, alerts, public map)               | All authenticated (including pseudonymous)                                                      | Institutional attribution only  |
| Restricted operational (reports, dispatches)              | Municipal admin of muni; agency admin of assigned agency; assigned responder                    | `isActivePrivileged()` required |
| Restricted personal (`report_private`, `report_contacts`) | Data subject; municipal admin of muni (with streaming audit); superadmin (with streaming audit) |                                 |
| Responder telemetry (RTDB full fidelity)                  | Self; municipal admin of muni; agency admin of agency; superadmin                               | Active status required          |
| Responder telemetry (RTDB cross-agency projection)        | All admin roles                                                                                 | 100m grid, 30s sampled          |
| SMS audit (`sms_outbox`, `sms_inbox`, `sms_sessions`)     | Superadmin only                                                                                 | Streaming audit on every read   |
| Break-glass audit (`breakglass_events`)                   | Superadmin + Governor's Office designated reviewer                                              | Append-only                     |
| Agency assistance requests                                | Requesting muni admin; target agency admin; superadmin                                          |                                 |
| Command channel threads                                   | Participating admins; superadmin                                                                | Tied to incident                |
| Shift handoffs                                            | From/to admins; superadmin                                                                      |                                 |
| Audit data (BigQuery)                                     | Separate IAM; superadmin read via documented request path                                       |                                 |

**New collections must declare data class, permitted roles, sharing conditions, and rule block with negative tests before implementation.**

---

## 16. Decision Log (v6 Additions)

v5 decisions 1–33 stand. New decisions:

| #   | Decision                                                       | Rationale                                                                         | Rejected Alternative                  | Residual Cost / Risk                                                      |
| --- | -------------------------------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------- |
| 34  | **Three deployment surfaces, not one app**                     | Citizen/Responder/Admin have incompatible offline, auth, device profiles          | Monolithic PWA                        | 3× build targets, shared packages discipline required                     |
| 35  | **Agency admins do NOT verify reports**                        | Clean state machine; matches PH LGU doctrine; prevents verification races         | Agencies verify in their jurisdiction | Muni admin is bottleneck during surge; pre-warm + reconciliation mitigate |
| 36  | **`trustScore` permanently excluded until governance drafted** | RA 10173 profiling exposure without governance                                    | Keep as advisory field                | Manual triage only                                                        |
| 37  | **Verified Responder Report = accelerated intake, not bypass** | Legitimate field-witness case without compromising verification                   | Full bypass (skip `awaiting_verify`)  | Still requires admin tap; trade speed for review                          |
| 38  | **Admin Desktop does NOT queue offline writes**                | Mutations are high-stakes; silent replay is worse than blocking                   | localForage outbox for admins too     | Admins must be online for mutations; field mode is explicit               |
| 39  | **Citizen-facing projection strips `actorId`**                 | Admin identity hidden at data layer, not just UI                                  | Rely on UI to hide                    | CF projection adds complexity; worth it for rule-level enforcement        |
| 40  | **Cross-agency responder visibility via RTDB projection**      | Privacy-preserving (100m grid) + cost-bounded + enables coordination              | Full RTDB cross-reads                 | Projection staleness bounded by 30s cadence + 90s TTL                     |
| 41  | **Municipal mass alerts route through Reach Plan**             | Surfaces SMS-vs-ECBS decision to admin before send                                | Silent routing based on thresholds    | UI complexity; admin must understand channels                             |
| 42  | **Agency assistance requests are first-class documents**       | Audit trail for inter-agency coordination; timeout escalation                     | Informal via command channel          | New collection + rules + callables                                        |
| 43  | **No Facebook Messenger integration for any role**             | RA 10173 data residency, no SLA, no audit hook, unreliable in degraded networks   | Keep as fallback per responder spec   | Responders must use in-app messages + PSTN calls                          |
| 44  | **Responder GPS retention: 90 days, not 24h**                  | Post-incident review needs it; responder spec's 24h insufficient                  | 24h                                   | Privacy notice must state clearly                                         |
| 45  | **Session timeout is re-auth interval, not token TTL**         | Firebase ID tokens are 1h regardless; "timeout" at app layer means prompt-for-OTP | Hard-expire sessions at 8h            | Requires explicit handling at app level                                   |

---

## 17. The Postgres Question (v5 §17, Unchanged)

Stay on Firebase for v6. Migration triggers documented in v5 §17.2 stand:

| Trigger                                    | Threshold                     | Why                                      |
| ------------------------------------------ | ----------------------------- | ---------------------------------------- |
| Admin dashboard p95 load time              | > 5s                          | Firestore client-side join cost exceeded |
| Concurrent active dispatches province-wide | > 500 sustained               | Contention on dispatch collection        |
| Cross-collection reporting queries / day   | > 1,000                       | BigQuery batch too slow                  |
| Firestore doc update amplification         | > 10× write fan-out per event | Denormalization > relational             |
| Firestore read cost                        | > ₱50,000/month               | Relational model becomes favorable       |
| Compliance FK enforcement required         | Any case                      | Firestore can't enforce FK               |
| Regulatory SQL audit access                | Any formal audit request      | Relational tools assumed                 |

Any TWO triggers observed for 30+ consecutive days initiates a hybrid migration plan per v5 §17.3. v6 does not change this.

---

## 18. Pilot Acceptance Criteria

v5's list (1–17) remains. v6 extends:

18. **Role capability contract tests pass 100%** — every UI action maps to a rule-enforced callable or direct write, CI-verified.
19. **Three-surface build pipeline produces three distinct deployables** reproducibly from a clean tag.
20. **Responder-witness report drill**: responder submits → municipal admin verifies → dispatch → resolution, full audit trail, p95 verification < 5 min.
21. **Agency assistance workflow drill**: muni requests → agency accepts → dispatches → resolves. Latency measured end-to-end.
22. **Mass alert reach plan preview accuracy**: preview estimate within ±10% of actual recipient count post-send.
23. **NDRRMC escalation workflow**: tabletop drill with PDRRMO Director exercising the full submission → forward → receipt → audit flow. Latency baseline established.
24. **Cross-agency projection accuracy**: during a live multi-agency incident, all agency admins see peer responders with <90s staleness and <100m positional uncertainty.
25. **Shift handoff discipline**: 30-day measurement of admin handoff acceptance rate. < 10% unaccepted handoffs required for production.

Production hardening revisits this document only after pilot data exists.

---

## 19. Implementation Sequence (Guidance for Phases 3+)

Given current state (Phases 1–2 complete: foundation, Firestore converters, Cloud Functions, emulator seed, test coverage), v6 suggests the remaining phase structure:

**Phase 3: Citizen PWA core** — submit flow, offline draft, tracking, public feed, alerts reception. Delivers end-to-end citizen value on its own.

**Phase 4: Responder Capacitor app** — dispatch accept/decline, status transitions, RTDB GPS telemetry, SOS, field notes. Requires Phase 3 reports to exist.

**Phase 5: Municipal Admin Desktop** — triage queue, verify/reject/merge, dispatch to own municipality, cancel, close, shift handoff. Requires Phase 4 responders.

**Phase 6: Agency Admin Desktop** — roster management, assistance-request inbox, dispatch own agency. Requires Phase 5 muni flows.

**Phase 7: Provincial Superadmin Desktop** — analytics dashboard, user management, NDRRMC escalation, declare emergency, break-glass drill.

**Phase 8: SMS layer** — Semaphore + Globe Labs, circuit breaker, inbound parser, outbound abstractions, reconciliation with main report flow.

**Phase 9: Audit streaming + compliance dashboards** — BigQuery streaming path for security events, compliance officer surface.

**Phase 10: Surge pre-warm + PAGASA integration** — auto-scale on weather signals.

**Phase 11: Pilot prep** — training materials, runbooks, restore drill, break-glass drill, SLO instrumentation.

**Phase 12: Pilot (single municipality, probably Daet)** — measure §18 acceptance criteria, iterate. Expand municipality-by-municipality post-stabilization.

This sequence lets each phase deliver a working slice while building on predecessors. Skipping SMS to later is deliberate: the PWA+Capacitor paths must be stable before adding another channel to reason about.

---

## 20. What This Spec Is Not

- **Not a UX spec.** Layouts, pixel-precise designs, exact copy, icon choices remain in the role specs or in a forthcoming design system. This spec defines capabilities, boundaries, and data; the design team chooses how to express them.
- **Not an API reference.** Callable signatures are named here; their exact schemas live in `packages/shared-validators` (Zod) and are source-of-truth when implementation disagrees with prose.
- **Not a runbook.** Operational procedures (break-glass drill, restore drill, degraded-mode) have their own living documents under `docs/runbooks/`.
- **Not immutable.** v7 will happen after pilot data exists. The §2 Resolved Contradictions and §16 Decision Log are the right places to reopen a decision; new decisions go below #45 with rationale.

---

## 21. Summary of Changes from v5

- Folded in all five role specs as canonical behavior (§7).
- Resolved 10 contradictions between role specs and architecture; decisions in §2.
- Introduced explicit three-deployment-surface model with distinct state-ownership profiles (§3, §9.2–9.4).
- New collections: `agency_assistance_requests`, `command_channel_threads`/`messages`, `mass_alert_requests`, `shift_handoffs`, `responder_shift_handoffs`, RTDB `agency_responder_projection` (§6).
- Verified Responder Report designed in as scoped callable with rate limits, not a bypass (§2.9, §7.2).
- Agency admin capability strictly narrowed: no verification, no citizen mass alerts, own-agency only (§7.4).
- Municipal mass alert routing enforces the v5 architecture's 5,000-recipient threshold via UI Reach Plan preview with explicit NDRRMC escalation path (§7.3, §7.5.1).
- Admin identity hidden at data layer via projection stripping, not just UI hiding (§2.7, §7.3).
- Added 17 new pilot scenarios and 8 new risk entries reflecting role-spec consequences (§12, §13).
- Decision log extended with entries 34–45 (§16).

---

**End of Unified Architecture Specification v6.0**
