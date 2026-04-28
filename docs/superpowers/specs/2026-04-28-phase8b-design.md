# Phase 8B Design — Signal Ingest, Operator Control, Observability & Cost

**Date:** 2026-04-28  
**Status:** Approved  
**Branch:** `codex/phase7-publish` (spec only — implementation branch TBD)

---

## Overview

Phase 8B is the operations control-plane slice of Phase 8. It makes storm-state awareness, operator action, and system-health visibility reliable before and during surge conditions.

It does **not** own the k6 surge/load-validation work itself and it does **not** own the RA 10173 erasure/anonymization execution path. Those are separate specs:

- **Phase 8A** — surge and contention validation
- **Phase 8C** — erasure and anonymization execution

Phase 8B exists so operators can run the system during a storm without leaving the product or guessing which backend state is real.

---

## Scope

### In Scope

- Canonical `hazard_signals` workflow for TCWS-driven storm-state
- Manual signal declaration as the primary operational path
- PAGASA scraper ingest writing into the same signal model
- Province-wide and municipality-scoped signal support
- Required `validUntil` on manual signals plus explicit early clear
- Admin Desktop `System Health` as the primary operator surface
- Minimal guarded actions from the product
- Derived operational state for UI consumption
- Health, backlog, and cost visibility needed to operate during surge
- Honest degraded-state behavior when scraper or derived health data is stale

### Out of Scope

- Dynamic mutation of Cloud Functions `minInstances`
- Non-TCWS hazards driving surge behavior in this phase
- k6 load and contention validation itself
- RA 10173 erasure/anonymization execution
- Broad incident-management workflows already covered in Phase 7
- Turning `System Health` into a generic admin super-console

---

## Core Decisions

1. **`hazard_signals` is the single source of truth.** Manual and scraper-created signals write the same canonical model.
2. **Manual-first operations.** Manual declaration is the hard operational path. The scraper assists but is never the sole dependency.
3. **Static warm capacity, not runtime scaling mutation.** Phase 8B assumes hot paths are already sized to a surge-safe baseline. Signal state drives operator awareness and runbooks, not deployment-time config rewrites.
4. **Admin Desktop is the control plane.** Operators should not need GCP or Firebase consoles to understand or control current storm-state.
5. **TCWS only for surge-driving behavior in 8B.** Other hazard types may exist as data later, but they do not drive this phase’s workflows.
6. **Manual declarations require `validUntil`.** Signals also support explicit early clear to avoid relying on memory.
7. **Manual override wins.** If manual and scraper signals conflict, manual is the effective state until cleared or expired.
8. **Read-first UI, small action surface.** The page prioritizes clear status over more buttons.

---

## Operational Invariants

- `hazard_signals` is the only authoritative input for storm-signal state.
- Manual and scraper-created signals must be behaviorally equivalent after write.
- Manual fallback must remain usable if scraper ingest fails.
- Every signal-control action must be auditable with actor and rationale.
- Signals must end deterministically through expiry or explicit clear.
- The UI must prefer degraded-but-honest over optimistic-but-wrong.
- No live storm-state should require client-side reconstruction from raw history.

---

## Architecture

Phase 8B is a small control loop with one canonical write path and one derived read model.

### Core Components

- **`hazard_signals`**
  Canonical lifecycle documents for TCWS declarations from manual and scraper sources.
- **`hazard_signal_status/current`**
  Derived current-state document for the app. This is the live read model for signal state.
- **Manual signal callables**
  Server-authoritative declare and clear paths from Admin Desktop.
- **Scraper poller**
  Scheduled backend job that parses PAGASA bulletin data and writes canonical signal documents.
- **Signal projector/reconciler**
  Backend logic that computes effective current state from canonical signal documents.
- **System health aggregator**
  Logic that extends `system_health/latest` with signal-aware health, backlog, and degraded-state indicators.
- **Admin Desktop `System Health` page**
  Primary operator surface for visibility and the approved action set.

### Architectural Boundaries

- `System Health` must not write Firestore directly for signal changes.
- Raw `hazard_signals` is audit history, not the main live UI query surface.
- Scraper failure must not block manual declare or clear.
- Phase 8B does not attempt to mutate deployed function scaling at runtime.

---

## Data Model

### `hazard_signals/{signalId}`

Canonical lifecycle document for one TCWS declaration.

**Required fields**

- `hazardType: 'tropical_cyclone'`
- `signalLevel: 1 | 2 | 3 | 4 | 5`
- `source: 'manual' | 'scraper'`
- `scopeType: 'province' | 'municipalities'`
- `affectedMunicipalityIds: string[]`
- `status: 'active' | 'cleared' | 'expired' | 'superseded'`
- `validFrom: Timestamp`
- `validUntil: Timestamp`
- `recordedAt: Timestamp`
- `rawSource: string`

**Manual-only fields**

- `recordedBy: string`
- `reason: string`

**Lifecycle fields**

- `clearedAt?: Timestamp`
- `clearedBy?: string`
- `supersededBy?: string`

**Model rule**

One document represents one declared signal lifecycle. Lifecycle state updates happen on that document instead of through a separate “surge mode” toggle model.

For `scopeType: 'province'`, `affectedMunicipalityIds` is normalized to the full set of 12 Camarines Norte municipalities. The system does not allow an empty array as an alternate representation of province-wide scope.

### `hazard_signal_status/current`

Derived read model for live operator state.

**Fields**

- `active: boolean`
- `effectiveSignalId?: string`
- `effectiveLevel?: 1 | 2 | 3 | 4 | 5`
- `effectiveSource?: 'manual' | 'scraper'`
- `scopeType?: 'province' | 'municipalities'`
- `affectedMunicipalityIds: string[]`
- `validUntil?: Timestamp`
- `manualOverrideActive: boolean`
- `scraperLastSuccessAt?: Timestamp`
- `scraperLastFailureAt?: Timestamp`
- `scraperDegraded: boolean`
- `lastProjectedAt: Timestamp`
- `degradedReasons: string[]`

### `system_health/latest`

Remains the broad health document, but gains signal-aware summary fields so the UI does not have to stitch operational state together from multiple raw collections.

---

## Backend Behavior

### Manual Declare

1. Superadmin uses `System Health` to declare a TCWS signal.
2. Client submits level, scope, affected municipalities, rationale, and `validUntil` to a callable.
3. Callable validates:
   - caller is superadmin
   - caller has the required privileged auth state
   - hazard type is supported by 8B
   - scope is province-wide or municipality-scoped
   - `validUntil` exists and is in the future
4. Callable writes canonical `hazard_signals`.
5. Projector recomputes `hazard_signal_status/current`.
6. `system_health/latest` reflects the effective signal state.

### Manual Clear

1. Superadmin clears an active manual signal from `System Health`.
2. Client calls a guarded clear callable.
3. Backend records the clear through canonical signal lifecycle state.
4. Projector recomputes effective state.
5. If a valid scraper-derived signal still exists, it becomes the visible effective state.

### Automatic Expiry

1. A scheduled backend sweep closes expired manual signals.
2. Expiry updates canonical lifecycle state to `expired`.
3. Projector recomputes effective state immediately after expiry handling.

### Scraper Ingest

1. Scheduled poller fetches PAGASA bulletin data.
2. If parse succeeds, backend writes canonical scraper-sourced `hazard_signals`.
3. Projector recomputes effective state.
4. If parse fails, scraper health degrades visibly and dead-letter/audit signals are emitted.

### Precedence Rules

- Manual declaration is the trusted operational override.
- Manual active signal outranks active scraper state.
- New manual declaration supersedes older active manual declaration.
- Clearing or expiring manual state reveals the best still-valid scraper-derived state, if one exists.

---

## Admin Desktop Surface

`System Health` becomes the operator control plane for Phase 8B. It stays read-heavy with a small, guarded action surface.

### Cards

- **Current Signal**
  - current TCWS level
  - source: manual or scraper
  - province-wide or municipality-scoped
  - affected municipalities
  - valid-until / time remaining
  - degraded badge if scraper or projection is stale

- **Signal Controls**
  - `Declare Signal`
  - `Clear Active Signal`
  - visible only to superadmin
  - every action requires rationale and confirmation

- **Scraper Health**
  - last successful scrape
  - last failed scrape
  - current health state
  - explicit fallback reminder that manual declaration remains available

- **Operational Health**
  - inbox reconciliation backlog
  - dead-letter count
  - audit streaming gap
  - audit batch gap
  - SMS provider health
  - function error-rate summary

- **Cost Snapshot**
  - current day vs 7-day baseline
  - anomaly state if above threshold
  - simple operator signal, not billing-console depth

- **Guarded Actions**
  - `Replay Dead Letter`
  - `Run Health Check`

### UI Constraints

- The page is read-first, action-second.
- Live storm-state must be obvious within one screen.
- Stale data must be shown as stale, not healthy.
- Phase 8B does not add a large set of emergency buttons.

---

## Failure Handling

### Principles

- Scraper failure degrades visibility, not operator control.
- Manual declare and clear remain available when scraper ingest is broken.
- Projection failure must be visible as stale, not silently wrong.
- Expired manual signals must clear from effective state without operator intervention.
- Conflicting writes resolve server-side with deterministic precedence.

### Failure Behaviors

**PAGASA parse failure**

- Poller writes failure telemetry and dead-letter context.
- `hazard_signal_status/current.scraperDegraded = true`.
- `System Health` shows degraded scraper state and fallback guidance.
- Existing manual signal remains authoritative.

**Projector failure**

- The UI does not guess from raw signal documents.
- `lastProjectedAt` becomes stale and degraded state is surfaced.
- Manual actions remain available, but operators are warned that projected live state is stale.

**Manual clear while scraper signal exists**

- Clearing a manual override reveals the best still-valid scraper-derived state.
- It must not force “no signal” if valid scraper state exists.

**Overlapping manual declarations**

- Later valid manual declaration supersedes earlier active manual declaration.
- Older document transitions to `superseded`.
- Default UI shows only the effective declaration.

**Expired manual declaration**

- Scheduled sweep marks it `expired`.
- Projected status recomputes immediately after expiry handling.

**Health-data staleness**

- If `system_health/latest` is stale, the page shows stale data instead of green badges.
- Stale health is itself an operator-facing incident signal.

---

## Verification

### Required Tests

**Callable tests**

- manual declare rejects non-superadmin callers
- manual declare rejects missing `validUntil`
- manual declare rejects past `validUntil`
- manual declare accepts province-wide and municipality-scoped TCWS inputs
- manual clear only clears an active manual signal
- newer manual declaration supersedes older active manual declaration deterministically

**Projector tests**

- manual signal becomes effective state
- active manual signal outranks active scraper signal
- clearing manual signal reveals valid scraper state if present
- expired manual signal drops out of effective state
- overlapping scoped signals produce one deterministic effective status document

**Scraper tests**

- valid PAGASA parse writes canonical scraper-sourced signal document
- unchanged source bulletin does not create noisy duplicate writes
- unparseable source marks scraper degraded and produces dead-letter/audit signal
- scraper failure does not alter manual control availability

**Health aggregation tests**

- `system_health/latest` reflects signal summary fields correctly
- stale projection is surfaced as degraded
- stale scraper is surfaced as degraded
- stale health document is surfaced as stale in UI semantics

**UI tests**

- `System Health` shows active signal state from the projected read model
- superadmin sees guarded actions and non-superadmin does not
- degraded scraper state is explicit and understandable
- stale health/projection state is visibly not healthy
- declare and clear actions require confirmation and rationale

### Required Staging Drills

- manual declare drill
- manual clear drill
- expiry drill
- scraper degradation drill
- area-scoped declaration drill

---

## Exit Criteria

Phase 8B is complete when all of these are true:

- canonical `hazard_signals` path works for manual and scraper sources
- projected `hazard_signal_status/current` is the stable UI source
- `System Health` is the primary operator surface for signal state
- manual declare, clear, and expiry all work in staging
- scraper failure degrades honestly and preserves manual fallback
- audit trail exists for all signal-control actions
- operators do not need GCP console access to understand current storm-state

---

## Summary

Phase 8B is intentionally narrow. It creates one boring, auditable control plane for TCWS storm-state, keeps manual operations as the reliable fallback, and upgrades `System Health` into the place operators can trust during surge conditions.
