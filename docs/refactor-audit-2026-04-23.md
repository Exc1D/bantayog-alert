# Refactor Audit — 2026-04-23

**Scope:** Full monorepo (apps/_, packages/_, functions)  
**Health Check:** Lint/Typecheck ✅ 25/25 passing | Tests ❌ 2 failures in `shared-sms-parser`

---

## 🔴 P0 — Fix Before Anything Else

### 1. `shared-sms-parser` has 2 failing tests

- **File:** `packages/shared-sms-parser/src/__tests__/inbound.test.ts`
- **Failures:**
  1. `returns candidates on ambiguous barangay match` — expects `confidence: 'low'`, gets `'none'`
  2. `parses accident synonym AKSIDENTE` — expects `confidence: 'high'`, gets `'low'`
- **Impact:** SMS ingestion pipeline is unreliable. Broken parser = lost disaster reports.
- **Action:** Fix parser logic in `packages/shared-sms-parser/src/inbound.ts` (lines 419+), or update tests if expectations drifted.
- **Effort:** Small (~1 file, ~20 lines)

---

## 🟠 P1 — High Risk / Hard to Maintain

### 2. `Step2WhoWhere.tsx` is a 707-line god component

- **File:** `apps/citizen-pwa/src/components/SubmitReportForm/Step2WhoWhere.tsx`
- **Issues:**
  - 707 lines in a single React component
  - 2 bare `catch {}` blocks (lines 380, 423) that swallow errors silently
  - Mixes GPS logic, municipality selection, form validation, UI rendering
- **Impact:** Impossible to test. Every change risks regressing the entire citizen reporting flow.
- **Action:** Extract sub-components: `GpsButton`, `MunicipalitySelector`, `BarangaySelector`, `ContactFields`. Extract hooks: `useGpsLocation`, `useMunicipalityBarangays`.
- **Effort:** Medium (~3-5 files, ~150 lines)

### 3. `inbound.ts` is a 541-line parser with multiple responsibilities

- **File:** `packages/shared-sms-parser/src/inbound.ts`
- **Issues:**
  - Contains gazetteer loading, Levenshtein distance, auto-reply building, AND parsing logic
  - 6 `@ts-expect-error` comments (lines 360-376) indicating fragile array logic
  - 1 bare `catch {}` (line 45)
- **Impact:** The failing tests live here. High cyclomatic complexity makes bugs likely.
- **Action:** Split into `levenshtein.ts`, `gazetteer.ts`, `auto-reply.ts`, `parser.ts`.
- **Effort:** Medium (~4 files, ~80 lines of changes)

### 4. `dispatch-responder.ts` is 307 lines of callable logic

- **File:** `functions/src/callables/dispatch-responder.ts`
- **Impact:** Core responder dispatch function. Long functions = hard to reason about security rules.
- **Action:** Extract validation, notification, and Firestore write logic into separate functions.
- **Effort:** Medium (~1 file refactored, ~2 new files)

---

## 🟡 P2 — Structural / Consistency Debt

### 5. Entire apps/packages have zero tests

| Package/App             | Source Files | Tests |
| ----------------------- | ------------ | ----- |
| `apps/admin-desktop`    | 18           | **0** |
| `apps/responder-app`    | 23           | **1** |
| `packages/shared-data`  | 1            | **0** |
| `packages/shared-types` | 8            | **0** |
| `packages/shared-ui`    | 2            | **0** |

- **Impact:** Regressions in admin/responder flows are only caught in manual QA or production.
- **Action:** Add characterization tests for critical paths first:
  1. `admin-desktop`: `LoginPage`, `TriageQueuePage`, `DispatchModal`
  2. `responder-app`: `DispatchListPage`, `DispatchDetailPage`, `useAcceptDispatch`
  3. `shared-ui`: render tests for shared components
- **Effort:** Large (spread across sprints)

### 6. Auth boilerplate duplicated across 2 apps

- **Files:**
  - `apps/admin-desktop/src/app/auth-provider.tsx` vs `apps/responder-app/src/app/auth-provider.tsx`
  - `apps/admin-desktop/src/app/protected-route.tsx` vs `apps/responder-app/src/app/protected-route.tsx`
  - `apps/admin-desktop/src/app/firebase.ts` vs `apps/responder-app/src/app/firebase.ts`
- **Issues:** Same patterns, slightly different implementations (claims types, role checks). Fixes in one don't propagate.
- **Action:** Move auth provider + protected route to `shared-ui` or `shared-firebase`. Keep role-checking as props/config.
- **Effort:** Medium (~2 new files in shared package, ~4 files deleted from apps)

### 7. Inconsistent error handling (6+ catch patterns)

- **Patterns found:**
  - `catch (err: unknown)` — 33 occurrences
  - `catch {}` — 13 occurrences (swallows errors)
  - `catch (err)` — 10 occurrences (implicit any)
  - `catch (error)` — 4 occurrences
  - `catch ((_e: unknown) => {` — 3 occurrences
  - `catch (e: unknown)` — 2 occurrences
- **Files with bare `catch {}`:**
  - `apps/citizen-pwa/src/components/SubmitReportForm/Step2WhoWhere.tsx` (2×)
  - `apps/citizen-pwa/src/services/draft-store.ts` (1×)
  - `apps/citizen-pwa/src/hooks/useOnlineStatus.ts` (1×)
  - `packages/shared-sms-parser/src/inbound.ts` (1×)
  - `packages/shared-validators/src/msisdn.ts` (1×)
  - `functions/src/services/fcm-send.ts` (2×)
  - `functions/src/services/sms-providers/semaphore.ts` (1×)
  - `functions/src/triggers/inbox-reconciliation-sweep.ts` (1×)
  - `functions/src/triggers/on-media-finalize.ts` (1×)
  - `functions/src/http/sms-inbound.ts` (1×)
  - `functions/src/firestore/sms-inbound-processor.ts` (1×)
- **Impact:** Silent failures in production. Error monitoring tools see nothing.
- **Action:** Enforce `catch (err: unknown) { logError(err) }` via lint rule or codemod. Start with citizen-pwa and functions.
- **Effort:** Medium (~14 files, ~30 lines)

### 8. `console.log` in production code

- **File:** `packages/shared-validators/src/logging.ts:87`
- **Impact:** Pollutes production logs. Could leak PII.
- **Action:** Replace with structured logger or remove.
- **Effort:** Tiny (~1 file, ~3 lines)

---

## 🟢 P3 — Cleanup / Polish

### 9. `any` types in source and tests

- **Source files:**
  - `functions/src/services/fcm-send.ts` — `batchResponse: any`
- **Test files (acceptable but should be typed):**
  - `functions/src/__tests__/rules/*.test.ts` — `db: any`
  - `functions/src/__tests__/callables/close-report.test.ts` — `doc: any`
  - `functions/src/__tests__/acceptance/phase-4a-acceptance.test.ts` — `db: any`, `rtdb: any`
- **Action:** Replace with proper Firestore types or `unknown`.
- **Effort:** Small

### 10. Single lingering TODO

- **File:** `packages/shared-validators/src/sms-templates.ts:1`
- **Text:** `// TODO(phase-5): move template bodies to Firestore for CMS-driven editing.`
- **Action:** Ticket it or implement if Phase 5 is active.
- **Effort:** N/A (planning)

---

## Recommended Execution Order

1. **P0:** Fix `shared-sms-parser` tests (1 session)
2. **P1:** Extract `Step2WhoWhere.tsx` into sub-components (2-3 sessions)
3. **P1:** Split `inbound.ts` into modules + fix `catch {}` (1-2 sessions)
4. **P2:** Add tests to `admin-desktop` critical paths (3-4 sessions)
5. **P2:** Consolidate auth provider into `shared-firebase` (2 sessions)
6. **P2:** Standardize error handling across `catch {}` sites (1 session)
7. **P3:** Remove `any` types and `console.log` (1 session)

---

## Stats

- **Total source files:** ~250
- **Total test files:** ~410 (but heavily concentrated in `functions`)
- **Lines of code:** ~14,665
- **Test coverage gaps:** 5 packages/apps at 0-1 tests
- **Bare `catch {}` blocks:** 13
- `console.log` in src: 1
- `TODO` in src: 1
