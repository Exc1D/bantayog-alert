# Phase 3b Verify + Dispatch Smoke Test Runbook

**Date:** 2026-04-18
**Environment:** Firebase Local Emulator
**Purpose:** Verify admin triage + dispatch flow end-to-end

---

## Prerequisites

```bash
# Start emulators
firebase emulators:start --only firestore,auth,functions,database &
sleep 10

# Seed Phase 1 admin (if not already seeded)
pnpm --filter @bantayog/functions exec tsx scripts/bootstrap-phase1.ts --emulator

# Seed test responder (Task 21)
pnpm --filter @bantayog/functions exec tsx scripts/phase-3b/bootstrap-test-responder.ts --emulator
```

---

## Test Accounts

| Role                   | Email                               | Password  |
| ---------------------- | ----------------------------------- | --------- |
| Municipal Admin (Daet) | daet-admin-01@bantayog.test         | Test1234! |
| Test Responder (BFP)   | bfp-responder-test-01@bantayog.test | Test1234! |

---

## Smoke Test Steps

### 1. Start Admin Desktop

```bash
VITE_USE_EMULATOR=true VITE_FIREBASE_PROJECT_ID=bantayog-alert-dev \
  pnpm --filter @bantayog/admin-desktop dev
```

Open http://localhost:5173 (or the port shown in terminal).

### 2. Sign in as Daet Admin

- Email: `daet-admin-01@bantayog.test`
- Password: `Test1234!`

**Expected:** Redirected to Triage Queue page showing municipality "daet".

### 3. Submit a test report (via Phase 3a acceptance script)

```bash
firebase emulators:exec --only firestore,auth,functions \
  "pnpm exec tsx scripts/phase-3a/acceptance.ts"
```

Or manually submit via citizen PWA at http://localhost:5174.

**Expected:** Report appears in queue with status `new` within ~2 seconds.

### 4. First Verify (new → awaiting_verify)

- Select the `new` report in the queue
- Click **Verify**

**Expected:**

- Status changes to `awaiting_verify`
- Event written to `report_events`
- Panel refreshes showing new status

### 5. Second Verify (awaiting_verify → verified)

- With the same report selected, click **Verify** again

**Expected:**

- Status changes to `verified`
- `verifiedBy` and `verifiedAt` stamped on report
- Second event written to `report_events`

### 6. Dispatch

- Click **Dispatch** button in the report detail panel

**Expected:**

- DispatchModal opens
- Test responder `bfp-responder-test-01` appears in the eligible responders list
- Select the responder and click **Confirm**

### 7. Verify dispatch succeeded

**Expected:**

- Modal closes
- Queue row status changes to `assigned`
- `dispatches/{id}` document created with:
  - `status: 'pending'`
  - `assignedTo.uid: 'bfp-responder-test-01'`
  - `acknowledgementDeadlineAt` set per severity
- Report `status` → `assigned`
- `report_events` entry with `from: 'verified', to: 'assigned'`

### 8. Verify responder can see dispatch (Responder PWA)

```bash
VITE_USE_EMULATOR=true VITE_FIREBASE_PROJECT_ID=bantayog-alert-dev \
  pnpm --filter @bantayog/responder-app dev
```

- Sign in as `bfp-responder-test-01@bantayog.test` / `Test1234!`
- Navigate to dispatch list

**Expected:**

- Dispatch appears with status `pending`
- `acknowledgementDeadlineAt` displayed
- No Accept/Decline buttons (deferred to Phase 3c)

---

## Acceptance Criteria

| #   | Check                                         | Result |
| --- | --------------------------------------------- | ------ |
| 1   | Admin can sign in and see daet queue          | ☐      |
| 2   | Report with status `new` appears in queue     | ☐      |
| 3   | First Verify → `awaiting_verify`              | ☐      |
| 4   | Second Verify → `verified` + verifiedBy stamp | ☐      |
| 5   | DispatchModal shows eligible responder        | ☐      |
| 6   | Confirm dispatch → `assigned` status          | ☐      |
| 7   | Dispatch doc created in Firestore             | ☐      |
| 8   | Responder sees dispatch via onSnapshot        | ☐      |

---

## Troubleshooting

**Queue is empty after submitting report:**

- Check emulator is running (`firebase emulators:start`)
- Verify report has `municipalityId: 'daet'` and `status: 'new'`
- Check `report_ops` subcollection has `assignedMunicipalityAdmins` array

**Dispatch button disabled:**

- Report must be at `verified` status before dispatch is enabled

**Responder not in modal:**

- Verify RTDB `/responder_index/daet/bfp-responder-test-01: { isOnShift: true }`
- Verify responders doc has `isActive: true`

---

## Rollback

If dispatch causes unexpected state:

```bash
# Cancel dispatch via callable (once admin desktop supports it)
# Or manually:
firebase emulators:exec --only firestore "node -e \"
const { getFirestore } = require('firebase-admin/firestore');
const db = getFirestore();
db.collection('reports').doc('<reportId>').update({ status: 'verified', currentDispatchId: null });
db.collection('dispatches').doc('<dispatchId>').update({ status: 'cancelled' });
\""
```
