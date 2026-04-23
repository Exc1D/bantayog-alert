# Step2WhoWhere Refactoring Plan

**Date:** 2026-04-23
**Issue:** P1 Issue #2 from refactor-audit-2026-04-23.md
**File:** `apps/citizen-pwa/src/components/SubmitReportForm/Step2WhoWhere.tsx` (707 lines)

## Problem

- Oversized component with mixed concerns (GPS, location selection, form validation, UI rendering)
- Large constants inflating file size (283 lines of barangay data)
- Hard to test and maintain
- Every change risks regressing the entire citizen reporting flow

## Solution

Extract into focused, testable units:

### 1. Data Extraction

**File:** `apps/citizen-pwa/src/data/fallback-barangays.ts`

- Move `FALLBACK_BARANGAYS` constant (283 lines)
- Export as typed constant
- Reusable across app

### 2. Extractable Components

#### a. GpsButton

**File:** `apps/citizen-pwa/src/components/SubmitReportForm/GpsButton.tsx`

- Props: `onLocation`, `onError`, `onSelectManual`
- State: `loading`, error handling
- Shows: "Use current location" button with loading state
- Integrates: `useGpsLocation` hook

#### b. MunicipalitySelector

**File:** `apps/citizen-pwa/src/components/SubmitReportForm/MunicipalitySelector.tsx`

- Props: `value`, `onChange`, `error`
- Displays: sorted municipality dropdown
- Validates: required when locationMethod='manual'
- Uses: `CAMARINES_NORTE_MUNICIPALITIES` from shared-validators

#### c. BarangaySelector

**File:** `apps/citizen-pwa/src/components/SubmitReportForm/BarangaySelector.tsx`

- Props: `municipalityId`, `value`, `onChange`
- Displays: barangay dropdown filtered by municipality
- Uses: `FALLBACK_BARANGAYS` from data file
- Optional field

#### d. ContactFields

**File:** `apps/citizen-pwa/src/components/SubmitReportForm/ContactFields.tsx`

- Props: `reporterName`, `reporterMsisdn`, `anyoneHurt`, `patientCount`, and their setters
- Displays: name input, phone input, patient counter
- Validates: required fields
- Handles: localStorage/sessionStorage persistence

### 3. Custom Hooks

#### a. useGpsLocation

**File:** `apps/citizen-pwa/src/hooks/useGpsLocation.ts`

- Returns: `{ location, loading, error, attemptGps, reset }`
- Handles: Geolocation API, error codes, timeout
- Testable: pure logic separated from UI

#### b. useMunicipalityBarangays

**File:** `apps/citizen-pwa/src/hooks/useMunicipalityBarangays.ts`

- Returns: `{ selectedMunicipalityId, selectedBarangayId, barangayOptions, setSelectedMunicipalityId, setSelectedBarangayId }`
- Computes: filtered barangay list
- State management for location selection

### 4. Helper Utilities

**File:** `apps/citizen-pwa/src/utils/storage-errors.ts`

- Extract: `isQuotaExceededError`, `isSecurityError`
- Reusable across app

## Execution Order

1. **Phase 1:** Extract data and utilities
   - Create `fallback-barangays.ts`
   - Create `storage-errors.ts`
   - Update imports in Step2WhoWhere

2. **Phase 2:** Extract custom hooks
   - Create `useGpsLocation.ts`
   - Create `useMunicipalityBarangays.ts`
   - Replace inline state with hooks in Step2WhoWhere

3. **Phase 3:** Extract components
   - Create `GpsButton.tsx`
   - Create `MunicipalitySelector.tsx`
   - Create `BarangaySelector.tsx`
   - Create `ContactFields.tsx`

4. **Phase 4:** Refactor main component
   - Simplify Step2WhoWhere to orchestrate components
   - Remove extracted code
   - Ensure all tests pass

## Testing Strategy

Each extraction will include:

- Unit tests for hooks (Vitest)
- Component tests (React Testing Library)
- Verification that existing behavior is preserved

## Verification

After each phase:

```bash
pnpm --filter @bantayog/citizen-pwa typecheck
pnpm --filter @bantayog/citizen-pwa lint
pnpm --filter @bantayog/citizen-pwa test
```

## Expected Outcome

- Step2WhoWhere.tsx: ~200 lines (from 707)
- Testable, focused components
- Reusable hooks and utilities
- Same user behavior, better code organization
