# Bantayog Alert — Product Requirements Document

**Version:** 1.0
**Date:** 2026-04-17
**Status:** Pilot-bound, pre-implementation
**Owner:** Exxeed (solo developer) + Province of Camarines Norte stakeholders
**Companion documents:**
- Architecture Spec v8.0 — source of truth for technical detail
- Implementation Plan v1.0 — phased delivery schedule
- Role specs v2.x — per-role capability detail

---

## 1. Problem

When a typhoon hits Camarines Norte, the gap between "citizen sees flooding" and "responder reaches the right place" is where people die.

Disaster coordination in the province today is a patchwork: Facebook Messenger groups, municipal radio, verbal reports to barangay captains, handwritten logs at the PDRRMO office. Each link works. The chain doesn't. A citizen reporting knee-deep water in Sitio Calasgasan at 2 AM has no reliable way to reach a dispatcher. A dispatcher has no consolidated view of which responders are on-duty, where they are, or which reports are still open. A provincial superadmin has no way to see the whole picture in time to make escalation decisions.

The specific failures this platform addresses:

**Citizens can't reliably reach responders.** Mobile signal degrades or vanishes during typhoons. SMS stays up longer than data. Feature phones outnumber smartphones in rural barangays. Reports sent through unofficial channels — Messenger, a text to a friend who knows someone — are neither logged nor auditable.

**Dispatchers can't triage at the speed of surge.** During sustained high-volume periods, a municipal admin may see hundreds of reports in an hour. Without duplicate detection, priority sorting, or a clean verify/reject workflow, the queue becomes unusable and decisions become arbitrary.

**Coordination across agencies breaks down.** BFP, PNP, Red Cross, DPWH, and the Philippine Coast Guard all operate their own rosters. A municipal admin requesting fire-rescue assistance currently has no structured way to do so — it happens through radio or phone calls, which leaves no audit trail and creates accountability gaps later.

**Provincial oversight is reactive and blind.** The PDRRMO Director should see trends, hot zones, and escalation candidates in real time. Instead, they receive status updates by radio, often hours late, often filtered through the reporting muni's interpretation.

**Jurisdictional data boundaries aren't enforced at the technical layer.** RA 10173 (Data Privacy Act) requires that cross-municipality data access be logged and controlled. That control exists on paper. In software, admin accounts commonly see things they shouldn't.

**National alerting is a different lane.** Province-wide mass evacuation alerts belong to NDRRMC via the Emergency Cell Broadcast System (ECBS) under RA 10639. Bantayog Alert is not that system. But there is no structured path *from* a provincial-level situation *to* an NDRRMC escalation today — it happens by phone call to a number that may or may not be answered.

---

## 2. Product Vision

Bantayog Alert is the **provincial disaster operations platform** for Camarines Norte — the coordination layer between citizens on the ground, responders in the field, dispatchers at municipal LGUs, agencies with vertical response authority, and the PDRRMO holding the only lawful escalation channel to NDRRMC.

It is not a replacement for cell broadcast. It is not a social network. It is not a predictive modeling system. It is a boring, auditable, surge-resistant operations tool that survives the worst network and the worst night.

**What good looks like:** A grandmother on a feature phone in Sitio Calasgasan texts `BANTAYOG BAHA HANGGANG TUHOD` and gets a reply confirming her report is received. Within three minutes a municipal admin in Jose Panganiban sees her report in their queue, verifies it against an adjacent report from a neighbor, and dispatches the nearest BFP unit. The BFP responder sees the dispatch on their phone with a map, accepts it, and their location becomes visible to the admin at 30-second resolution. The PDRRMO sees the situation building across Jose Panganiban and pre-warms the province for surge. Two hours later, after a dozen more reports cluster in verified flood zones, the PDRRMO director submits an NDRRMC escalation request that lands with a timestamped audit trail, an evidence pack, and a Reach Plan.

---

## 3. Users & Roles

Five distinct user types. Each has different devices, different network conditions, different authority, and different failure modes. The architecture spec §7 is authoritative for capabilities; this section is the product-level view.

### 3.1 Citizen

**Who:** Any resident, visitor, or worker in Camarines Norte. Includes feature-phone users and smartphone users. May be pseudonymous (no account) or registered (account with contact info).

**Primary device:** Feature phone (SMS) or smartphone (web PWA).

**Primary goal:** Report an emergency and get confirmation that help is coming.

**Network profile:** Unreliable. Mountainous terrain, cell-site congestion during typhoons, extended outages after the storm. Must work offline with local queue.

**Key journeys:**
- Submit a report (text, photo, GPS) from the web or by SMS keyword
- Receive status updates (verified, dispatched, resolved) via push or SMS
- Recover a dropped draft after app crash or phone restart
- Look up their own report status using a tracking reference

**Does not:** See admin dashboards. Verify reports. Dispatch responders. See hazard zones (admin-operational data).

### 3.2 Responder

**Who:** Field personnel from an agency (BFP firefighter, Red Cross volunteer, PNP officer, PCG crew, DPWH engineer). Has an agency account managed by their Agency Admin.

**Primary device:** Smartphone running the Capacitor-wrapped responder app. On-duty for multi-hour shifts.

**Primary goal:** Receive dispatches, reach the scene, execute the response, mark complete.

**Network profile:** Typically online while on duty, but transient drops are routine. Battery life over 12-hour shifts is a hard constraint.

**Key journeys:**
- Receive dispatch notification, accept or decline
- Navigate to scene with in-app map
- Post field notes and status updates
- Submit a Verified Responder Report when witnessing an incident firsthand
- Hand off to next shift responder with context
- Trigger SOS or Backup request if the situation escalates

**Does not:** Verify other people's reports. Dispatch other responders. See reports outside their active dispatch. See hazard zones.

### 3.3 Municipal Admin

**Who:** LGU disaster-risk personnel at one of the 12 municipalities (MDRRMO staff). Primary operational role during a surge.

**Primary device:** Desktop or tablet running the Admin Desktop PWA. Requires stable connectivity for writes; narrow offline field mode exists for notes and messages only.

**Primary goal:** Triage the queue, verify reports, dispatch the right responders, close resolved incidents, maintain situational awareness of their municipality.

**Network profile:** Office desk during blue-sky; may operate from an evacuation center or field command post during surge.

**Key journeys:**
- Verify or reject incoming reports, set type and severity
- Dispatch own-muni responders directly; request agency assistance via structured request
- Send municipality-scoped mass alerts with Reach Plan preview (≤5k SMS direct, else NDRRMC escalation)
- Draw and manage custom hazard zones for event-bounded operational situations (evacuations, typhoon impact areas, curfews)
- Communicate with reporters via in-report messages
- Coordinate with adjacent munis on border incidents via Command Channel threads
- Execute shift handoff with active incident snapshot

**Does not:** See or write to other municipalities' data, except explicitly shared border incidents. Modify citizen report content. Upload hazard reference layers (Superadmin-only). Promote users.

### 3.4 Agency Admin

**Who:** Head or designated manager of a response agency (BFP Provincial Fire Marshal, PNP Provincial Director's office, Red Cross Chapter, etc.).

**Primary device:** Desktop Admin Desktop PWA.

**Primary goal:** Manage their agency's responder roster and respond to assistance requests from municipal admins.

**Network profile:** Typically office-based. Connectivity generally good.

**Key journeys:**
- Create, edit, suspend responder accounts within their agency
- Set shifts and specialization tags (Swift Water Rescue, Hazmat Certified, etc.)
- Accept or decline assistance requests from municipal admins
- Dispatch own-agency responders to reports the agency is engaged on
- View own agency responders at full telemetry fidelity; see other-agency responders at 30-second 100m-grid projection
- Revoke responder access (lost device)

**Does not:** Verify reports (LGU function). Dispatch other agencies' responders. Manage other agencies' rosters. See hazard zones. Send mass alerts to citizens.

### 3.5 Provincial Superadmin (PDRRMO)

**Who:** Provincial Disaster Risk Reduction and Management Office director and designated deputies.

**Primary device:** Dual-monitor Admin Desktop. Analytics on primary, operational map on secondary.

**Primary goal:** Maintain province-wide situational awareness, approve NDRRMC escalations, manage provincial resources, oversee pilot municipalities.

**Network profile:** Command-center grade. Backup connectivity expected.

**Key journeys:**
- All Municipal Admin capabilities, province-wide
- Create, suspend, promote staff accounts across all roles
- Declare provincial emergency (fans out FCM + SMS)
- Review and forward mass-alert escalations to NDRRMC
- Upload hazard reference layers (PAGASA flood, MGB landslide, PAGASA storm surge) and supersede prior versions
- Author province-wide custom hazard zones
- Trigger surge pre-warm manually (normally automatic on PAGASA signal)
- Review break-glass session actions post-event
- Read `report_private` and `report_contacts` data with streaming audit on every read
- Declare and manage data-breach incidents under the 72-hour clock (Arch Spec §14)

**Does not:** Change own role. Disable audit streaming. Bypass the 4-hour re-auth interval.

### 3.6 Break-Glass Accounts

Not a regular user type. Two sealed envelopes held physically by the Office of the Governor and PDRRMO Director. Activated only when the superadmin is incapacitated during an emergency. Dual-control unseal, 4-hour auto-expiring session, every action streaming-audited.

---

## 4. Goals & Success Metrics

Measured during the Camarines Norte pilot. Each metric has a target and a measurement approach. Targets are commitments the provincial government has signed on to.

### 4.1 Availability & Reach

| Goal | Metric | Target |
|---|---|---|
| Citizens can reach the system | Report acceptance latency, network present | p95 < 3s |
| Feature-phone citizens aren't second-class | SMS inbound parse accuracy (Tagalog + English) | ≥ 95% on ground-truth sample |
| No report is silently dropped | Dead-letter items unresolved > 24h | Zero tolerance; every item replayed or escalated |
| System survives the surge | Cost during pre-warmed surge | ≤ 2× baseline daily spend |
| Regional outage has a fallback | Degraded-mode runbook execution | SMS-only fallback + paper forms within 15 min of declared outage |

### 4.2 Operational Speed

| Goal | Metric | Target |
|---|---|---|
| Dispatchers move fast | Dispatch creation latency (admin click → responder FCM) | p95 < 10s |
| Agencies respond to requests | Agency assistance accept/decline | p95 < 3 min |
| Responder-witness verification is fast | Submit → muni admin verify | p95 < 5 min |
| Push notifications land | FCM delivery attempt success | > 95% over rolling 1h |
| Priority SMS lands | SMS priority delivery | > 90% over rolling 1h |
| Transaction contention holds under load | p99 on hot paths (`acceptDispatch`, `verifyReport`) | < 5s at 500 concurrent |

### 4.3 Data Boundaries & Audit

| Goal | Metric | Target |
|---|---|---|
| No cross-municipality leakage | Negative-test coverage on Firestore rules | 100% (CI-enforced) |
| Privileged reads are auditable | Superadmin reads of `report_private` / `report_contacts` | 100% streaming-audited within 60s |
| Breach notification can happen | Annual 72-hour drill | Runbook executes end-to-end |
| MFA is real | Staff MFA adoption | 100% for admin+ roles before production cutover |
| Capability contract holds | UI-to-rule capability contract tests | 100% passing in CI |

### 4.4 Hazard & Geoanalytics

| Goal | Metric | Target |
|---|---|---|
| Reference layers load cleanly | Upload-simplify-persist fidelity | ≥ 95% IoU vs source GeoJSON |
| Custom zones re-tag correctly | Sweep accuracy on edit (≤100km²) | ≥ 99% re-tagged within 10s |
| Auto-tag at ingest | Accuracy on verified sample of 100 reports | 100% agreement with Turf.js ground truth |
| Polygon mass alerts estimate well | Reach Plan vs actual delivery | Within ±10% |
| Analytics are fast | p95 dashboard query over 30-day window | < 3s |

### 4.5 User Experience

| Goal | Metric | Target |
|---|---|---|
| Citizens trust the system | Status update receipt | ≥ 95% of verified reports receive push or SMS within 5 min of status change |
| Responders don't burn batteries | Battery drop at 12-hour shift | < 15% with motion-activity sampling |
| Dropped drafts recover | localForage recovery post-IndexedDB-eviction | ≥ 99% on iOS test fleet |
| Shift handoffs happen | Unaccepted handoffs over 30-day window | < 10% |
| Admins use the right channel | Mass alert Reach Plan preview surfaces SMS-vs-NDRRMC correctly | 100% — no silent routing |

### 4.6 Adoption (Pilot Municipality)

| Goal | Metric | Target |
|---|---|---|
| Staff actually use the tool | Active muni admin sessions | ≥ 80% of rostered admins log in during any given weekly window |
| Responders accept and execute | Dispatch accept rate | ≥ 75% within 5 min during active incidents |
| Citizens submit real reports | Citizen submissions | ≥ 50 per week per municipality during blue-sky, ≥ 500 per week during typhoon |
| SMS citizens are reached | SMS-submitted reports | ≥ 10% of total submissions (signal of feature-phone reach) |

---

## 5. Scope

### 5.1 Pilot Scope (Phase 0 → Phase 12)

The full architecture spec ships in the pilot, staged across 12 phases. Every capability listed in Arch Spec §7 is in scope. The implementation plan sequences them. The PRD does not re-enumerate them.

**What the pilot must demonstrate before production expansion** is defined by Arch Spec §20 pilot acceptance criteria (39 items). These are signoff gates, not targets.

### 5.2 Pilot Municipality

Daet (provincial capital) is the primary pilot municipality. Capstone workflow is extended to a second adjacent municipality (likely Jose Panganiban or San Vicente) at Phase 10 for border-incident sharing validation. Full 12-municipality rollout follows pilot signoff.

### 5.3 Explicit Non-Goals

These are out of scope for v1. Revisited in v2 after pilot data exists.

- **Not a predictive modeling system.** Risk scoring beyond "count of tagged reports per zone" is deferred. Probabilistic risk surfaces, exposure indices, actuarial modeling — all v2 at earliest.
- **Not a replacement for ECBS.** Province-wide mass evacuation alerts remain NDRRMC's job under RA 10639.
- **Not an automated integration with PAGASA/MGB/PHIVOLCS feeds.** Hazard reference data enters via manual Superadmin upload. `hazard_signals` ingest (PAGASA TCWS levels for surge pre-warm, Arch Spec §10.2) has a three-tier ingest with manual fallback; no other automated feeds in pilot scope.
- **Not a general-purpose inter-agency messaging app.** Command Channel threads are tied to specific incidents.
- **Not a citizen social feed.** The public feed is the alert stream, not user-generated content. No likes, no comments, no follows.
- **Not a Facebook Messenger integration for any role.** RA 10173 data residency plus no SLA plus no audit hook makes this a non-starter (Arch Spec decision #42).
- **Not multi-region.** Primary `asia-southeast1`; degraded-mode runbook covers regional outage.
- **Not post-Firebase.** Postgres migration evaluated per Arch Spec §19 triggers; not in pilot scope.
- **Not a mobile app for admins.** Admin Desktop is a PWA targeted at desktops and tablets. A dedicated admin mobile app is out of scope.
- **Not an incident-commander role.** Arch Spec decision #45: existing state machine answers every operational ownership question. No new tag.
- **Not a seismic-hazard feature.** Camarines Norte's risk profile is typhoon-dominated; seismic added in v2 if pilot warrants.

### 5.4 Geographic Scope

Camarines Norte only. 12 municipalities: Basud, Capalonga, Daet (pilot primary), Jose Panganiban, Labo, Mercedes, Paracale, San Lorenzo Ruiz, San Vicente, Santa Elena, Talisay, Vinzons. Province-wide rollout is part of Phase 12 graduation, not pilot.

### 5.5 Language Scope

Tagalog + English for all user-facing text. Bikol (regional) for pilot-validated phrases; full Bikol UI translation is v2. SMS inbound parser handles Tagalog + English with regional-spelling tolerance (Arch Spec §15 pilot scenario #8).

---

## 6. Product Principles

These govern product decisions across the 12 phases. They mirror and complement the architectural principles in Arch Spec §1.3.

1. **Reach over polish.** A feature-phone citizen reaching the system beats a smartphone citizen seeing a beautiful UI. When trading between SMS fidelity and web polish, we pick SMS.
2. **Institutional attribution, never personal.** Citizens see "Daet MDRRMO" and "BFP Responder", never a named human. Admin identity lives in the audit log, not the UI.
3. **The system must admit what it doesn't know.** `queued` is not `sent`. `verified by Muni Admin` is not `verified by NDRRMC`. Uncertainty is surfaced, not smoothed over.
4. **Staff actions are accountable.** Every privileged write carries an actor, a role, and a timestamp. Break-glass sessions stream every action.
5. **Design for the night shift in a typhoon.** If a tired admin at 2 AM can't use it after a 40-minute network outage, it doesn't work.
6. **Graceful degradation is a feature, not a fallback.** SMS-only submission is a first-class path, not a sad-path.
7. **No feature crosses a legal line.** RA 10173 (Data Privacy Act), RA 10639 (ECBS), National Privacy Commission guidance — if a feature needs a legal carve-out, it doesn't ship in v1.
8. **Pilot is where we find out what was wrong.** The provincial government signed the SLOs; the product team commits to honest measurement. Metrics that miss are reported up, not buried.

---

## 7. Dependencies & Assumptions

### 7.1 External Dependencies

| Dependency | Owner | Criticality | Fallback |
|---|---|---|---|
| Firebase (Firestore, RTDB, Auth, Functions, Storage, Hosting) | Google | Core platform; entire stack | None — migration to Postgres triggered per Arch Spec §19 if thresholds cross |
| Semaphore SMS API | Semaphore (PH aggregator) | Primary outbound SMS | Globe Labs failover via circuit-breaker |
| Globe Labs SMS API | Globe Telecom | Secondary outbound SMS + inbound routing | Semaphore primary still available |
| PAGASA public bulletins | PAGASA (national weather agency) | TCWS signal ingest (§10.2) | Scraper tier; manual superadmin toggle as last resort |
| MGB hazard maps | Mines and Geosciences Bureau | Reference layer source | Data entered manually by Superadmin; no automated feed |
| NDRRMC escalation channel | National agency | Province-wide mass alerts | Escalation workflow is the fallback; direct SMS blast is not permitted |
| Barangay boundary dataset | LGU survey / OpenStreetMap-derived | Polygon mass alert reverse-geocoding | Dataset versioned per CF deploy; sourcing is an implementation-plan prerequisite |

### 7.2 Organizational Dependencies

- **PDRRMO engagement** — the pilot cannot happen without an identified PDRRMO superadmin and signed SLOs.
- **Municipal LGU staffing** — Daet MDRRMO must assign 2-3 trained admins for pilot operations.
- **Agency MOU signatures** — BFP, PNP, Red Cross, DPWH, PCG must each designate an Agency Admin. MOUs are parallel-tracked with implementation; missing MOUs block the corresponding agency's onboarding, not the whole pilot.
- **NPC pre-registration** — RA 10173 requires DPIA registration with the National Privacy Commission. This is a prerequisite for pilot launch, not a parallel task.
- **Third-party security review** — required per Arch Spec §13.11 before production cutover. Budgeted as a pre-production checklist item.

### 7.3 Technical Assumptions

- Firebase pricing holds roughly consistent over pilot duration.
- Semaphore and Globe Labs continue operating under current commercial terms.
- PAGASA public bulletin structure doesn't change radically (the scraper is flagged as a fragile dependency in Arch Spec §15).
- 3G/4G coverage in Camarines Norte baseline municipalities is sufficient for admin desktops. Citizen PWAs must work on 2G.
- The solo developer (Exxeed) remains engaged through pilot completion. Operational dependence on the primary engineer is an acknowledged residual risk in Arch Spec §16, owned by the provincial government.

---

## 8. Risks & Mitigations

Product-level risks. Technical risks are in Arch Spec §16.

| Risk | Severity | Mitigation |
|---|---|---|
| PDRRMO commitment wavers mid-pilot | High | MOU signed at Phase 0; monthly steering committee through Phase 12 |
| Pilot muni staff don't adopt | High | Training curriculum built in Phase 11; usage metrics reviewed weekly from Phase 9 onward |
| Citizens don't trust SMS channel | Medium | Tracking reference as paper-like artifact; confirmation SMS on every submit; public barangay outreach in Phase 11 |
| Agency MOUs delayed | Medium | Parallel-track; per-agency onboarding decoupled from platform readiness |
| Typhoon hits mid-development | High | Development sequenced so SMS + basic triage ship by Phase 6 (before season peak); degraded-mode runbook written before Phase 7 |
| Single-developer bus factor | High | Architecture spec + implementation plan + role specs are the recovery artifacts; runbooks written to be executed by a generalist engineer |
| Legal/regulatory interpretation shifts | Medium | DPIA review quarterly; legal counsel on retainer for NPC questions; break-glass procedure drilled quarterly |
| Break-glass procedure fails in real emergency | High | Quarterly drill with fake envelopes in staging; physical chain-of-custody reviewed annually |
| Pilot extended beyond typhoon season | Medium | Each phase has independent value; platform is deployable at Phase 9 even if Phase 10-12 slips |
| Cost explodes under real surge | Medium | Cost dashboard from Phase 5 onward; 5× baseline alert; circuit breakers on hot paths (Arch Spec §10.4) |

---

## 9. Go-to-Production Criteria

The 39 pilot acceptance criteria in Arch Spec §20 are the technical signoff. In addition, these product-level gates must be cleared before production expansion beyond Daet:

1. **Signed SLOs** — Arch Spec §13.2 targets committed in writing by PDRRMO Director.
2. **Operator training** — minimum 5 trained muni admins across pilot munis; 10 trained responders per agency in pilot.
3. **NPC DPIA registration** — confirmed filed and acknowledged.
4. **Third-party security review signoff** — findings resolved to consultant's satisfaction.
5. **Quarterly break-glass drill successful** — at least one full-dress drill executed within 90 days of cutover.
6. **Incident-response runbook validated** — Arch Spec §14 72-hour drill completed.
7. **30-day continuous operation** — platform runs for 30 continuous days at pilot muni without SLO-breaking incident.
8. **Post-pilot review** — PDRRMO + provincial government sign off on pilot outcomes; v2 roadmap adjusted based on findings.

---

## 10. Post-Pilot Roadmap (Forward-Looking)

Directional only. Pilot findings will re-shape this.

**v1.1 — Post-pilot stabilization (months 1-3 after pilot signoff)**
- Bikol UI translation
- Admin mobile companion app (read-only situational awareness)
- Expanded hazard analytics beyond tag counts
- Automated PAGASA webhook integration (if NDRRMC coordination yields the endpoint)

**v2 — Province-wide rollout with lessons learned (months 3-12)**
- Full 12-municipality rollout
- Seismic hazard support if pilot data justifies
- Risk-scoring formulas informed by pilot data
- Possible Postgres hybrid migration if Arch Spec §19 triggers fire

**v3 — Horizons**
- Multi-province deployment (another PDRRMO adopts)
- Deeper PAGASA/NDRRMC integration if API channels open
- Citizen-facing hazard awareness (public reference layer visibility) — only if legal + operational review clears

These are not commitments. The pilot may surface a need that outranks anything listed here.

---

## 11. Open Questions for Stakeholder Review

Questions the product team wants answered before committing v1 scope.

1. **PDRRMO endpoint for NDRRMC escalation.** Who is the named human who receives `requestMassAlertEscalation` submissions? What's their backup?
2. **Barangay boundary dataset provenance.** Does the LGU already have a survey-grade dataset, or do we derive from OpenStreetMap + manual reconciliation? This is a Phase 1-2 unblocker.
3. **Agency MOU timeline.** Which agencies commit by Phase 6 (when dispatch flow ships)? Which wait for pilot proof?
4. **Retention schedule interpretation.** RA 10173 requires data minimization, but operational retention needs (post-incident review, audit) pull the other way. We've proposed 90-day active + archive-to-BigQuery per Arch Spec §11.2; PDRRMO counsel needs to confirm.
5. **Break-glass envelope custodians.** Named individuals, named backups, named review authority. This is a Phase 0 unblocker.
6. **Pilot duration target.** 30 days minimum per Arch Spec §20; is there an upper bound before provincial government expects decisions?
7. **Language coverage.** Is Bikol-speaking citizen reach a v1 requirement or v1.1? This materially affects SMS parser scope.

---

**End of PRD v1.0**
