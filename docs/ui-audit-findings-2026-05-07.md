# Bantayog Alert — UI & Feature Audit Report

**Date:** 2026-05-07
**Auditors:** citizen-pwa-auditor, admin-desktop-auditor, responder-app-auditor (via `/impeccable audit`)
**Reviewed by:** team-lead
**Context loaded:** PRODUCT.md, DESIGN.md, 5 role specs, architecture spec v8

---

## Part 1: UI Audit Scores

| App           | Score     | Band       |
| ------------- | --------- | ---------- |
| citizen-pwa   | **13/20** | Acceptable |
| admin-desktop | **11/20** | Acceptable |
| responder-app | **8/20**  | Poor       |

### Anti-Patterns Verdict

All three apps fail the AI slop test. Common tells:

- **citizen-pwa:** Teal palette (#0d7377) everywhere instead of DESIGN.md Authority Navy (#001e40) + Alert Sienna (#a73400); bounce-adjacent spring easing
- **admin-desktop:** Decorative SVG herringbone pattern on LoginPage, 20-node pulsing particle animation, identical MetricCard grid, purple (#7c3aed) for Superadmin label not in approved palette
- **responder-app:** Severity chips all fail WCAG AA contrast (2.8:1–3.3:1); emoji tab bar icons instead of Lucide SVG; `span` styled as button in DispatchCard

---

## Part 2: UI Issues by App

### citizen-pwa (13/20)

#### P1 — Major

| #   | Issue                                                                                       | Location                            | WCAG / Design Ref          |
| --- | ------------------------------------------------------------------------------------------- | ----------------------------------- | -------------------------- |
| C1  | Teal palette everywhere — `--brand-*` (#0d7377 family) replaces DESIGN.md two-anchor system | `design-tokens.css`, all components | Theming / Anti-Pattern     |
| C2  | React.lazy RevealSheet fails offline — error boundary instead of queued state UI            | App routes using `React.lazy()`     | WCAG 2.1 AAA critical path |
| C3  | Two competing CSS token systems (design-tokens.css vs globals.css)                          | `src/styles/`                       | Theming                    |
| C4  | Inactive nav text `surface-300` (#6a7677) on `surface-50` = 3.2:1 — fails WCAG AA 4.5:1     | `CitizenShell.tsx:175`              | WCAG 1.4.3 AA              |

#### P2 — Minor

| #   | Issue                                                                                                        | Location                                   |
| --- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------ |
| C5  | RevealSheet spring `cubic-bezier(0.34, 1.56, 0.64, 1)` overshoots (1.56 > 1.0) — DESIGN.md prohibits bounce  | `RevealSheet.tsx:313`                      |
| C6  | Guardian pitch card uses `bg-gradient-to-br from-brand-500 to-brand-600` — decorative gradient               | `RevealSheet.tsx:523`, `ProfileTab.tsx:94` |
| C7  | `aria-current={isActive ? 'page' : undefined}` violates `exactOptionalPropertyTypes`                         | `CitizenShell.tsx:161`                     |
| C8  | FeedTab severity badges hardcoded locally — inconsistent with `useSeverityStyle.ts` which has correct values | `FeedTab.tsx:18-26`                        |
| C9  | `StatusBanner variant="danger"` uses solid `#dc2626` — fails WCAG AA for large text                          | `globals.css:214`                          |

#### P3 — Polish

| #   | Issue                                                                                              | Location                   |
| --- | -------------------------------------------------------------------------------------------------- | -------------------------- |
| C10 | `exactOptionalPropertyTypes` aria patterns not applied consistently across all optional aria props | Throughout                 |
| C11 | ReportStatusPill overlap with FAB on very small screens (320px)                                    | `CitizenShell.tsx:120,136` |

---

### admin-desktop (11/20)

#### P0 — Blocking

| #   | Issue                                                                                                                                                           | Location                                                              | Category                   |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | -------------------------- |
| A1  | Design system palette completely mismatched — uses #d64933 (reddish-orange), #7c3aed (purple), generic chart colors; DESIGN.md specifies #001e40 + #a73400 only | `index.css`, all pages                                                | Theming                    |
| A2  | SystemHealthPage uses zero CSS — all inline `React.CSSProperties`                                                                                               | `pages/SystemHealthPage.tsx`                                          | Theming / Anti-Pattern     |
| A3  | LoginPage particle animation (20 DOM nodes, pulsing dots) — pure decorative AI slop                                                                             | `pages/LoginPage.tsx:11-16, :170-182`                                 | Anti-Pattern / Performance |
| A4  | Logo uses `#d64933` but DESIGN.md specifies Alert Sienna `#a73400`                                                                                              | `pages/LoginPage.tsx:449-460`, `components/layout/Header.tsx:148-172` | Theming                    |

#### P1 — Major

| #   | Issue                                                                                                    | Location                                                                | WCAG / Design Ref       |
| --- | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ----------------------- |
| A5  | Chart colors hardcoded (#dc2626, #d97706, #16a34a) — not using design system status tokens               | `pages/DashboardPage.tsx:33-48, :312-344`                               | Theming                 |
| A6  | Header "Superadmin" label `text-purple-700` (#7c21c2) on white — purple not in approved palette          | `components/layout/Header.tsx:24`                                       | Accessibility / Theming |
| A7  | "Declare Alerts" button uses `bg-red-700` instead of Alert Sienna                                        | `pages/DashboardPage.tsx:124`                                           | Theming                 |
| A8  | Pulsing live indicator has no `aria-label` or `role="status"`                                            | `components/layout/Header.tsx:46-51`, `pages/DashboardPage.tsx:101-107` | WCAG 2.1                |
| A9  | TOTP inputs use `type="text"` + `inputMode="numeric"` — should be `type="tel"` for mobile numeric keypad | `pages/LoginPage.tsx:330`                                               | Accessibility           |
| A10 | MetricCard font-size `text-[36px]` not responsive                                                        | `components/common/MetricCard.tsx:54`                                   | Responsive Design       |

#### P2 — Minor

| #   | Issue                                                                               | Location                             |
| --- | ----------------------------------------------------------------------------------- | ------------------------------------ |
| A11 | OTP inputs missing `autocomplete="one-time-code"`                                   | `pages/LoginPage.tsx:274-298`        |
| A12 | Notification dropdown lacks `aria-expanded`, `aria-haspopup`, `role="dialog"`       | `components/layout/Header.tsx:74-98` |
| A13 | Anomaly card uses hardcoded Tailwind colors `bg-red-50 border-red-200 text-red-700` | `pages/DashboardPage.tsx:265-285`    |
| A14 | LoginPage decorative SVG herringbone pattern — AI slop aesthetic                    | `pages/LoginPage.tsx:162-167`        |
| A15 | Identical MetricCard grid (6 cards, SaaS dashboard cliché)                          | `pages/DashboardPage.tsx:164-252`    |
| A16 | No Inter font loaded — falls back to `system-ui`                                    | `index.css:55`                       |
| A17 | No focus ring on interactive elements — DESIGN.md specifies double-ring             | Multiple pages                       |

#### P3 — Polish

| #   | Issue                                                               | Location                              |
| --- | ------------------------------------------------------------------- | ------------------------------------- |
| A18 | Keyboard shortcut hints displayed but no visual feedback on press   | `components/layout/Header.tsx:28-45`  |
| A19 | Pulse animation not wrapped in `prefers-reduced-motion` media query | `components/common/MetricCard.tsx:48` |
| A20 | No skip-to-content link                                             | All pages                             |

---

### responder-app (8/20)

#### P0 — Blocking

| #   | Issue                                                                                                                                                                | Location                                                                       | WCAG     |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | -------- |
| R1  | All severity badges fail WCAG AA contrast — sevHigh (#fee2e2/#991b1b = 3.2:1), sevMedium (#fef3c7/#92400e = 3.3:1), sevLow (#d1fae5/#065f46 = 2.8:1)                 | `DispatchDetailPage.module.css:83-94, :188`                                    | 1.4.3 AA |
| R2  | Severity chips also fail contrast AND inconsistent with DispatchDetailPage (sevLow = #e0f2fe/#075985 = 2.9:1 vs DispatchDetailPage sevLow = #d1fae5/#065f46 = 2.8:1) | `DispatchListPage.module.css:182-195`                                          | 1.4.3 AA |
| R3  | Status pills fail contrast — `pillActive: #d1fae5/#065f46 = 2.8:1`                                                                                                   | `DispatchListPage.module.css:112-120`, `DispatchDetailPage.module.css:117-120` | 1.4.3 AA |

#### P1 — Major

| #   | Issue                                                                               | Location                         | WCAG           |
| --- | ----------------------------------------------------------------------------------- | -------------------------------- | -------------- |
| R4  | Missing `<label>` for resolution summary textarea                                   | `DispatchDetailPage.tsx:318-326` | 1.3.1          |
| R5  | Missing `<label>` for field notes textarea                                          | `DispatchDetailPage.tsx:414-422` | 1.3.1          |
| R6  | DispatchCard action is a `<span>`, not `<button>` — not keyboard accessible         | `DispatchListPage.tsx:66-69`     | 2.1.1 Keyboard |
| R7  | MapPage legend dot `#1d4ed8` on white = 3.6:1 — fails WCAG 1.4.11 non-text contrast | `MapPage.module.css`             | 1.4.11         |
| R8  | Empty state checkmark `✓` has `aria-hidden="true"` with no accessible label         | `DispatchListPage.tsx:93`        | 1.1.1          |

#### P2 — Minor

| #   | Issue                                                                                                             | Location                                                                                                            |
| --- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| R9  | Design tokens bypassed — raw hex values (#fbbf24, #34d399, #fffbeb, etc.) in CSS modules instead of CSS variables | `DispatchListPage.module.css`, `DispatchDetailPage.module.css`, `ProfilePage.module.css`, `MessagesPage.module.css` |
| R10 | Emoji tab bar icons instead of Lucide SVG                                                                         | `Shell.tsx:21-24`                                                                                                   |
| R11 | SosPage emoji `🆘` acceptable contextually but inconsistent with design system                                    | `SosPage.tsx:32`                                                                                                    |
| R12 | No `React.lazy()` for MapPage — Leaflet bundle (~40KB) loaded eagerly                                             | `MapPage.tsx`                                                                                                       |

#### P3 — Polish

| #   | Issue                                                                                                            | Location                 |
| --- | ---------------------------------------------------------------------------------------------------------------- | ------------------------ |
| R13 | Badge on Shell tab bar may overflow on very narrow screens                                                       | `Shell.module.css:84-99` |
| R14 | No `prefers-reduced-motion` handling found — all animations would play for users who've requested reduced motion | Throughout               |

---

## Part 3: Missing Features by App

### Cross-Cutting Systemic Issue

The admin-desktop PWA serves **three distinct roles** (municipal_admin, agency_admin, provincial_superadmin) that share the same shell but have dramatically different workflows. The current implementation is heavily provincial-superadmin-focused with almost no municipal or agency admin surfaces built.

---

### citizen-pwa — Missing from citizen-role-spec-v2.md

| Feature                                                                                    | Spec Section    | Priority |
| ------------------------------------------------------------------------------------------ | --------------- | -------- |
| SMS fallback submission ("Send as SMS" when offline/queued)                                | §3.5 Step 5, §6 | P0       |
| Draft resume prompt on app reopen ("You have a draft from earlier — [Continue] [Discard]") | §4.1, §5.4      | P1       |
| Draft auto-save indicator ("Saving draft..." state, 30s cadence)                           | §5.4            | P1       |
| RA 10173 plain-language privacy notice in-app                                              | §8.1            | P0       |
| "Download My Data" (JSON export in Profile)                                                | §8.3            | P1       |
| "Are you sure?" false-report prevention confirmation before submit                         | §7.4            | P1       |
| Rate limit hard-cap message with barangay hotline fallback                                 | §7.1            | P1       |
| "Request Correction" button post-verification                                              | §4.3            | P2       |
| Tagalog translations on legal/privacy/error text (partially done)                          | DESIGN.md       | P2       |

---

### responder-app — Missing from responder-role-spec-v2.md

| Feature                                                                            | Spec Section | Priority |
| ---------------------------------------------------------------------------------- | ------------ | -------- |
| "Report What I'm Seeing" button (Verified Responder Report entry point)            | §8.1         | P0       |
| Responder Witness Report form (type/severity selectors, GPS+photo both required)   | §8.2         | P0       |
| Pre-arrival information (equipment checklist, recommended gear, distance)          | §6.3         | P1       |
| Unable-to-Complete workflow UI (reason selector, no-penalty confirmation)          | §5.6         | P1       |
| Motion-driven GPS cadence display (10s running / 30s walking / 5min still)         | §6.2         | P2       |
| Responder type display (POL / FIR / MED / ENG / SAR / SW / GEN)                    | §1 table     | P1       |
| Responder specialization tags on profile/dispatch (e.g., "Hazmat Certified")       | §1, §3.2     | P1       |
| Shift handoff outgoing flow (handoff to selector, active dispatch snapshot, notes) | §9.1         | P1       |
| Shift handoff incoming accept/reject (FCM notification, 30-min timeout)            | §9.2         | P1       |
| Ghosted other-agency responder dots on shared incidents                            | §3.3, §11.4  | P2       |
| TOTP enrollment setup flow (mandatory MFA before first login)                      | §11.3        | P0       |

---

### admin-desktop — Missing Municipal Admin (municipal-admin-role-spec-v2.md)

| Feature                                                                         | Spec Section | Priority |
| ------------------------------------------------------------------------------- | ------------ | -------- |
| Triage Panel (slides in from right, map stays visible, verify/reject/merge)     | §3.3         | P0       |
| Surge Triage Mode (V/R/M/S keyboard shortcuts, list view)                       | §3.6         | P0       |
| Dispatch Panel (select responders, deadline, notes, dispatch)                   | §3.4         | P0       |
| Agency Assistance Panel (select agency, type, priority, message, 30-min expiry) | §3.5         | P0       |
| Command Channel (per-incident inter-admin messaging)                            | §4.3         | P0       |
| Citizen messaging (addMessage callable, per-report two-way)                     | §4.4         | P0       |
| Mass Alert Composer + Reach Plan Preview (FCM+SMS estimate, NDRRMC routing)     | §6.2-6.3     | P1       |
| Shift Handoff (initiate/accept, 30-min timeout, active snapshot)                | §7           | P1       |
| Analytics Dashboard (own municipality, vs. provincial average)                  | §8           | P1       |

---

### admin-desktop — Missing Agency Admin (agency-admin-role-spec-v2.md)

| Feature                                                                  | Spec Section | Priority |
| ------------------------------------------------------------------------ | ------------ | -------- |
| Assistance Request Inbox (primary triage, accept/decline/expire)         | §4.1         | P0       |
| Roster Management (create/update/suspend responder, specialization tags) | §4.2         | P0       |
| Bulk shift toggle (bulkSetResponderAvailability)                         | §4.2         | P1       |
| Lost device revoke (revokeResponderAccess — immediately kill session)    | §4.2         | P0       |
| Dispatch Panel (own agency only, agencyId constraint)                    | §4.3         | P0       |
| Ghosted other-agency responder dots                                      | §3.2         | P1       |
| Command Channel with Municipal Admin                                     | §4.4         | P1       |
| Shift Handoff                                                            | §4.5         | P1       |
| Agency Analytics Dashboard                                               | §6           | P2       |
| Monthly PDF accomplishment report export                                 | §6           | P2       |

---

### admin-desktop — Missing Provincial Superadmin (provincial-superadmin-role-spec-v2.md)

| Feature                                                                        | Spec Section | Priority |
| ------------------------------------------------------------------------------ | ------------ | -------- |
| Analytics-first primary layout (municipal comparison table as primary view)    | §2.2         | P0       |
| Anomaly auto-detection (response time spike, resolution drop, admin shift gap) | §4.1         | P0       |
| Municipal drill-down panel (click row → context panel slides in)               | §4.2         | P1       |
| NDRRMC Escalation Queue (`N` keyboard shortcut)                                | §5.1         | P0       |
| NDRRMC Review & Forward flow (forward method, NDRRMC receipt confirmation)     | §5.2         | P0       |
| Emergency Declaration (`A` shortcut + TOTP re-verify)                          | §7           | P0       |
| User Management (create/suspend all roles, TOTP enforced)                      | §6           | Partial  |
| Mutual Aid Authorization toggle (toggleMutualAidVisibility)                    | §4.4         | P1       |
| Break-glass access (72h independent review requirement)                        | §8.3         | P0       |
| Data Subject Erasure approval queue (RA 10173)                                 | §8.4         | P1       |
| Retention Exemptions (setRetentionExempt callable)                             | §8.5         | P2       |
| Shift Handoff province-wide (12 municipalities, 30-min accept window)          | §10          | P1       |
| Provincial Resources (CRUD, map pins)                                          | §9.4         | P2       |
| Keyboard shortcuts — full set (D M U A N R S L H)                              | §2.5         | Partial  |

---

## Part 4: Cross-Cutting Gaps

| Gap                                | Affects                       | Impact                                                            |
| ---------------------------------- | ----------------------------- | ----------------------------------------------------------------- |
| No municipal-admin surface built   | citizen-pwa dispatch workflow | Reports verified but no way to dispatch responders                |
| No agency-admin surface built      | municipal-admin dispatch      | Cannot request agency assistance                                  |
| Command Channel not built          | All three admin roles         | Inter-admin coordination entirely missing                         |
| SMS fallback submission not built  | citizen-pwa                   | Offline/pseudonymous citizens cannot submit via feature-phone SMS |
| Responder Witness Report not built | responder-app                 | Responders cannot file field reports during patrol                |
| TOTP enrollment UX not visible     | All staff logins              | Spec requires mandatory MFA but enrollment flow unseen            |
| No shift handoff in any app        | All roles                     | Operational continuity gap at shift change                        |

---

## Part 5: Recommended Fix Order

### Immediate (P0 — Security / Accessibility / Core Flow Blockers)

1. **Fix severity contrast in responder-app** — all WCAG AA failures are P0 accessibility violations
2. **Fix `<label>` missing on textareas in responder-app** — WCAG 1.3.1 blockers
3. **Replace `<span>` with `<button>` in DispatchCard** — WCAG 2.1.1 keyboard blocker
4. **Build municipal-admin triage panel** — citizen reports verified but undispatchable
5. **Build agency-admin assistance inbox** — municipal admins cannot request agency help
6. **Build NDRRMC Escalation Queue** — mass alert routing to NDRRMC not functional
7. **Build RA 10173 privacy notice in citizen-pwa** — compliance requirement
8. **Build break-glass access UI** — provincial superadmin emergency access not functional

### Short Term (P1 — Significant UX Gaps)

1. **`$impeccable colorize` on all 3 apps** — palette completely off-spec everywhere
2. **Build shift handoff for all three admin roles** — operational continuity
3. **Build citizen-pwa SMS fallback** — offline resilience for feature-phone users
4. **Build responder-app "Report What I'm Seeing"** — accelerated field reporting
5. **Fix React.lazy RevealSheet offline failure in citizen-pwa** — submission status invisible offline
6. **Build Command Channel for all admin roles** — inter-admin messaging
7. **Build Emergency Declaration UI for superadmin** — province-wide alert capability
8. **Fix `$impeccable extract` severity tokens in responder-app** — three inconsistent implementations

### Medium Term (P2 — Polish / Completeness)

1. **`$impeccable polish`** — remove admin-desktop particles and decorative SVG
2. **Build responder-app Unable-to-Complete workflow UI**
3. **Build responder specialization tags display**
4. **Build superadmin anomaly auto-detection**
5. **`$impeccable typeset`** — load Inter font in admin-desktop
6. **Add `prefers-reduced-motion` handling in responder-app**
7. **Build citizen-pwa Download My Data**
8. **Build superadmin municipal drill-down panels**

---

## Appendix: Files Referenced in UI Audit

| App           | Key Files                                                                                                                                                       |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| citizen-pwa   | `src/styles/design-tokens.css`, `src/styles/globals.css`, `CitizenShell.tsx`, `RevealSheet.tsx`, `FeedTab.tsx`, `ProfileTab.tsx`                                |
| admin-desktop | `index.css`, `pages/LoginPage.tsx`, `pages/SystemHealthPage.tsx`, `pages/DashboardPage.tsx`, `components/common/MetricCard.tsx`, `components/layout/Header.tsx` |
| responder-app | `DispatchDetailPage.module.css`, `DispatchListPage.module.css`, `Shell.tsx`, `MapPage.tsx`, `SosPage.tsx`                                                       |

---

_Generated 2026-05-07 — Three parallel `/impeccable audit` runs across all apps + spec-vs-code feature gap analysis_
