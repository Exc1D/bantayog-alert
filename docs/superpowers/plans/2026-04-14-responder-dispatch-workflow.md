# Responder Dispatch Workflow — Implementation Plan

**Date:** 2026-04-14
**Branch:** `feat/responder-dispatch-workflow-2026-04-14`
**Status:** In Progress

## Overview

Implement the responder dispatch workflow for the Bantayog Alert App. Responders receive emergency dispatches, update their status in real-time, and can trigger SOS emergency signals.

---

## Task Checklist

### Phase 1: Core Infrastructure

| #  | Task                                    | Status   | Notes                                                        |
|----|----------------------------------------|----------|--------------------------------------------------------------|
| 1  | Type Definitions                       | ✅ Done  | `QuickStatus`, `AssignedDispatch`, `SOSEvent`, error types   |
| 2  | Configuration Constants                 | ✅ Done  | `urgency.config.ts` — timeouts, windows, limits             |
| 3  | Validation Service                      | ✅ Done  | `canActivateSOS`, `validateGPSLocation`, `canUpdateStatus`   |

### Phase 2: Data Hooks

| #  | Task                                    | Status   | Notes                                                        |
|----|----------------------------------------|----------|--------------------------------------------------------------|
| 4  | `useDispatches` Hook                   | ✅ Done  | One-shot + real-time subscription via `onSnapshot`           |
| 5  | `useQuickStatus` Hook                  | ✅ Done  | Optimistic updates with rollback, pre-flight validation     |
| 6  | `useSOS` Hook                         | ✅ Done  | Activate/cancel SOS, GPS tracking, Firestore mutex pattern  |

### Phase 3: UI Components

| #  | Task                                    | Status   | Notes                                                        |
|----|----------------------------------------|----------|--------------------------------------------------------------|
| 7  | `DispatchList` Component               | ✅ Done  | Real-time dispatch feed for responders                        |
| 8  | `QuickStatusButtons` Component         | ⬜ Pending | Status update buttons (en_route, on_scene, needs_assistance, completed) |
| 9  | `SOSButton` Component                  | ⬜ Pending | Emergency SOS activation with cancellation window             |

### Phase 4: Backend & Infrastructure

| #  | Task                                    | Status   | Notes                                                        |
|----|----------------------------------------|----------|--------------------------------------------------------------|
| 10 | Firestore Security Rules                | ⬜ Pending | `report_ops`, `sos_events` collection rules for responders   |
| 11 | Firestore Indexes                      | ⬜ Pending | Composite indexes for dispatch queries                        |
| 12 | Data Migration Script                  | ⬜ Pending | Migrate existing responders to new dispatch schema           |

### Phase 5: Testing & Rollout

| #  | Task                                    | Status   | Notes                                                        |
|----|----------------------------------------|----------|--------------------------------------------------------------|
| 13 | E2E Tests                              | ⬜ Pending | Playwright E2E for dispatch + SOS flows                      |
| 14 | Feature Flags                          | ⬜ Pending | `responder_dispatch_enabled`, `sos_enabled` for gradual rollout |

---

## File Map

```
src/domains/responder/
├── config/
│   ├── urgency.config.ts       ✅  SOS_EXPIRATION_MS, CANCELLATION_WINDOW_MS, etc.
│   └── errorMessages.config.ts ✅  Error message templates
├── types/
│   ├── dispatch.types.ts       ✅  QuickStatus, AssignedDispatch, DispatchesError
│   └── sos.types.ts           ✅  SOSEvent, SOSError, RichLocation
├── services/
│   ├── validation.service.ts   ✅  canActivateSOS, validateGPSLocation, canUpdateStatus
│   └── firestore.service.ts    ⬜ Pending  (dispatch + sos_events CRUD)
├── hooks/
│   ├── useDispatches.ts        ✅  One-shot + subscribe modes, error discrimination
│   ├── useQuickStatus.ts       ✅  Optimistic update + rollback on failure
│   ├── useSOS.ts              ✅  Activate/cancel with GPS tracking + mutex
│   └── __tests__/
│       ├── useDispatches.test.ts   ✅  10 tests
│       ├── useQuickStatus.test.ts  ✅  7 tests
│       └── useSOS.test.ts          ✅  9 tests
└── components/
    └── DispatchList.tsx        ✅  Real-time dispatch feed

docs/superpowers/plans/
└── 2026-04-14-responder-dispatch-workflow.md  📋 This file
```

---

## Key Design Decisions

### Optimistic Updates with Rollback

`useQuickStatus` uses optimistic UI — local state updates immediately, Firestore write happens async. On failure, state rolls back. Pre-flight validation via `canUpdateStatus` prevents obviously invalid transitions from being attempted.

### SOS Firestore Mutex Pattern

`useSOS.activateSOS` uses a Firestore transaction to implement a mutex: before creating a new SOS, it queries `sos_events` for any existing active SOS for `responderId`. If one exists, the transaction throws and the error is surfaced as `ALREADY_ACTIVE`.

### Cancellation Window

Responders can cancel their own SOS within a configurable window (`SOS_CANCELLATION_WINDOW_MS = 30s`). After the window expires, cancellation is rejected server-side by the transaction's `cancellationWindowEndsAt` check.

### Pre-flight Validation

`canActivateSOS` is synchronous — checks `getAuth().currentUser` and `navigator.onLine` before attempting a network request. This avoids a network round-trip for obviously invalid states.

### GPS Tracking

Once SOS is activated, `navigator.geolocation.watchPosition` starts continuous tracking. The last known position is cached in a `useRef` and updated on each geolocation event.

---

## Commits

```
b48de11 fix(responder): add auth check, SOS mutex, GPS permission-denied, and error logging
553d52b feat(responder): add configuration constants
22b431e docs(qa): add qa edge case scan findings and update learnings
```

---

## Next Steps

1. **Task 8 — `QuickStatusButtons`**: Build button component with `useQuickStatus`, wire to `DispatchList` item
2. **Task 9 — `SOSButton`**: Build SOS button with `useSOS`, cancellation UI
3. **Task 10 — Firestore Rules**: Secure `report_ops` (read: responder assigned, write: responder or system) and `sos_events` (read: system only, write: authenticated responder)
4. **Task 11 — Firestore Indexes**: `report_ops` composite index on `(responderId, status)` and `sos_events` on `(responderId, status)`
5. **Task 12 — Migration Script**: One-time script to backfill `responderId` on existing `report_ops` documents
6. **Task 13 — E2E Tests**: Playwright tests for full dispatch acceptance → status update → SOS flow
7. **Task 14 — Feature Flags**: Add Firebase Remote Config keys `responder_dispatch_enabled` and `sos_enabled`
