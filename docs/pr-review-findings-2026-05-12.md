# PR Review Findings — 2026-05-12

Reviewed uncommitted changes via 10 parallel specialized agents.

## Files Changed

```text
apps/admin-desktop/src/components/CommandHeader.tsx
functions/src/admin-init.ts
functions/vitest.config.ts
functions/src/__tests__/callables/close-report.unit.test.ts
functions/src/__tests__/callables/declare-emergency.test.ts
functions/src/__tests__/callables/reject-report.test.ts
functions/src/__tests__/firestore.rules.test.ts
functions/src/__tests__/rtdb.rules.test.ts
functions/src/__tests__/rules/admin-onsnapshot.rules.test.ts
functions/src/__tests__/triggers/inbox-reconciliation-sweep.test.ts
functions/src/__tests__/triggers/process-inbox-item-prc2.test.ts
functions/lib/admin-init.{js,d.ts.map,js.map}
```

---

## Critical Issues (1)

### 1. `process-inbox-item-prc2.test.ts` — ZERO behavioral coverage

**Severity:** CRITICAL (9/10)

All 4 tests replaced with a 9-line placeholder:

```typescript
it('SMS consent features removed in commit 9f520d99', () => {
  // report_sms_consent collection and related SMS pipeline features were
  // removed as part of the Phase 5 feature deferral. This placeholder
  // preserves the test file location for future re-implementation.
})
```

`processInboxItemCore` is a production Firestore trigger that:

- Reads from `report_inbox`, writes to 7 collections (`reports`, `report_private`, `report_ops`, `report_events`, `report_lookup`, `moderation_incidents`, `idempotency_keys`)
- Materializes location data, severity, contact info
- Handles idempotency via `idempotencyKey`

A regression in this function could silently fail to create reports or corrupt data across multiple collections. The placeholder does not preserve regression protection.

**Recommendation:** Restore functional tests for the non-SMS portions of `processInboxItemCore`. At minimum: successful materialization, idempotency (same key = no double-write), and missing inbox item handling. The SMS consent tests were the removed portion; the core materialization logic was NOT SMS-specific and should have been retained.

---

## Important Issues (4)

### 2. `reject-report.test.ts` — Inconsistent emulator host

**Severity:** MEDIUM (6/10)

`reject-report.test.ts` uses `localhost` for Firestore emulator while all other files use `127.0.0.1`:

```typescript
// reject-report.test.ts line 18
firestore: { host: 'localhost', port: 8081 },

// All other files use
firestore: { host: '127.0.0.1', port: 8081 },
```

On macOS, `localhost` can resolve to `::1` (IPv6) while the Firebase emulator binds to `127.0.0.1` (IPv4). This can cause intermittent connection failures.

**Recommendation:** Standardize to `127.0.0.1` across all test files.

---

### 3. `close-report.unit.test.ts` — Schema only, no behavioral tests

**Severity:** MEDIUM (7/10)

The file only tests `closeReportRequestSchema` Zod validation. The actual `closeReportCore` callable handler has zero test coverage. The callable handles:

- Status transitions (`verified → closed`)
- `report_events` audit writes
- Authorization (municipal_admin vs agency_admin scope)
- Idempotency

A schema test catches input-shape errors but not logic errors.

**Recommendation:** Add tests for `closeReportCore`: happy-path status transition, authorization scope, already-closed idempotency, and invalid status transitions.

---

### 4. `admin-init.ts` — Silent fallback with no config

**Severity:** MEDIUM

```typescript
const app =
  getApps()[0] ??
  initializeApp(process.env.VITEST ? { databaseURL: 'http://localhost:9000?ns=demo' } : undefined)
```

When `VITEST` is unset and no Firebase app exists, `initializeApp(undefined)` creates a broken Admin SDK state. All subsequent calls to `adminAuth`, `adminDb`, `rtdb` throw cryptic "Firebase App not initialized" errors rather than a clear startup failure.

**Recommendation:** Either ensure `getApps()[0]` always exists before this module is imported (guaranteed in Cloud Functions environments), or throw early:

```typescript
const app =
  getApps()[0] ??
  initializeApp(
    process.env.VITEST
      ? { databaseURL: 'http://localhost:9000?ns=demo' }
      : (() => {
          throw new Error('Firebase Admin not configured')
        })(),
  )
```

---

### 5. `CommandHeader.tsx` — Icon buttons lack focus rings

**Severity:** MEDIUM

Icon-only buttons (audio, notifications, shortcuts) have `hover:bg-white/10` but no `focus-visible:ring-2`. Keyboard users cannot see focus state.

**Recommendation:** Add `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50` to all icon buttons.

---

## Suggestions (5)

### 6. Apply `admin-onsnapshot` skip pattern consistently

`admin-onsnapshot.rules.test.ts` has a robust try/catch + `itif(firestoreAvailable)` pattern for graceful emulator unavailability. Other emulator-dependent test files (`firestore.rules.test.ts`, `rtdb.rules.test.ts`, `inbox-reconciliation-sweep.test.ts`) hard-fail without the emulator.

**Recommendation:** Apply the same skip pattern to all emulator-dependent tests for consistency.

---

### 7. `CommandHeader.tsx` — Notification badge uses severity token

Line 86 uses `bg-[var(--color-sienna)]` which maps to `#a73400`. `--color-sienna` is a severity color (medium). Using a semantic severity token for a notification badge risks design drift if the token changes.

**Recommendation:** Use `--color-warning` directly, or a dedicated badge token.

---

### 8. `CommandHeader.tsx` — Muted audio icon uses opacity

When muted, the `VolumeX` icon uses `text-white/50`. Using `text-[var(--color-text-muted)]` would be more consistent with the design system.

---

### 9. `admin-init.ts` — Comment omits fallback condition

The comment says "In vitest environments" but the actual guard is `process.env.VITEST`. The comment should also explain that the dummy URL only applies when no app exists (`getApps()[0] ??`).

**Suggested comment improvement:**

```typescript
// When VITEST is set and no Firebase app is already initialized (i.e., no
// service-account credentials or FIREBASE_DATABASE_URL in the environment),
// provide a dummy databaseURL so getDatabase() does not crash at module-import
// time. Actual RTDB operations still require a running emulator.
```

---

### 10. `admin-init.ts` — Failure shifted to operation time

The dummy `databaseURL` shifts RTDB failure from module-import time to operation time. Tests may pass without exercising real RTDB, masking configuration issues.

**Recommendation:** Consider adding a warning log when the dummy URL is used:

```typescript
if (process.env.VITEST && !getApps()[0]) {
  console.warn('[admin-init] VITEST mode: using dummy RTDB URL. Emulator must be running.')
}
```

---

## Positive Findings

- `as const` additions on `ROLE_ACCENT`/`ROLE_LABEL` — correct TypeScript narrowing, prevents accidental mutation
- Explicit `host: '127.0.0.1', port: 8081` on emulator configs — resolves the documented ECONNREFUSED pitfall (`learnings.md` §8.7)
- `admin-onsnapshot.rules.test.ts` try/catch + `itif()` skip pattern — gold standard for emulator-dependent tests
- `WindowRole` type narrowing (`string` → union) — correct type improvement
- `declare-emergency.test.ts` correctly removes tests for deferred Phase 5 features
- `reject-report.test.ts` state machine coverage is solid (4 edge cases tested)
- All changes are minimal, YAGNI-compliant, follow established project patterns
- No OWASP Top 10 vulnerabilities in the changes
- Backend architecture sound — idempotent singleton, correct vitest guard, no NODE_ENV misuse

---

## Verdict

**Merge readiness:** Issues #1, #4, and #5 should be addressed before merge. #1 (zero test coverage on `process-inbox-item-prc2`) is the highest priority — it's a production Firestore trigger with no regression protection. #2 and #6 are consistency improvements that don't block merge.

**Recommended action:**

1. Restore functional tests in `process-inbox-item-prc2.test.ts`
2. Add focus rings to `CommandHeader.tsx` icon buttons
3. Standardize `localhost` → `127.0.0.1` in `reject-report.test.ts`
4. Consider adding skip logic to other emulator-dependent test files
