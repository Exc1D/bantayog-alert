# Plan 8 — Folder Restructure to Spec Layout

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development.
> **Do this LAST.** This is pure churn. Running it before Plans 0–7 causes merge hell.

**Goal:** Restructure `src/` to match the spec §4.1 layout: `app / domain / infrastructure / stores / shared / workers`. Move the domain logic out of `src/domains/<role>/services/` into pure-TS `src/domain/services/`, move Firebase code into `src/infrastructure/`. Behavior-preserving.

**Architecture:** Pure move + import fixups. No logic changes. Tests and typechecker are the safety net.

**Tech Stack:** `git mv`, TypeScript, codemod via search-and-replace.

---

## Prerequisites

All other plans merged. Clean `main` with zero in-flight PRs (or feature freeze while this lands).

## Target Structure (from spec §4.1)

```
src/
├── app/                    # App shell, routing, layouts
│   ├── App.tsx
│   ├── routes/
│   ├── layouts/
│   ├── firebase/config.ts  # keep here
│   └── ErrorBoundary.tsx
├── domain/                 # Pure business logic, NO Firebase imports
│   ├── models/             # Report, Dispatch, Alert, User (interfaces)
│   ├── services/           # SeverityCalculator, DuplicateDetector (client-side stub), TrustScoreEngine
│   └── constants/          # incidentTypes, responderTypes, municipalities
├── infrastructure/
│   ├── firebase/
│   │   ├── converters/
│   │   ├── repositories/
│   │   └── listeners/      # useReportListener etc.
│   ├── rtdb/               # LocationTracker, hooks
│   ├── storage/            # MediaUploader
│   ├── messaging/          # NotificationManager
│   └── offline/            # OfflineQueue, sw registration
├── stores/                 # Zustand: authStore, uiStore, mapStore, offlineStore
├── shared/
│   ├── components/         # Map/, StatusBadge, OfflineIndicator, PhotoUploader, etc.
│   ├── hooks/              # useAuth, useGeolocation, useKeyboardShortcuts, useListenerFedQuery
│   └── utils/
├── features/               # OPTIONAL: keep for UI composition per role
└── workers/sw.ts
```

## File Move Map (high level)

| Current | → | Target |
|---|---|---|
| `src/shared/services/*` | → | `src/infrastructure/firebase/*` (already mostly moved in Plan 3) |
| `src/domains/<role>/services/firestore.service.ts` | → | `src/features/<role>/services/` OR delete (Plan 3 repos replace it) |
| `src/domains/<role>/components/` | → | `src/features/<role>/components/` |
| `src/domains/<role>/hooks/` | → | `src/features/<role>/hooks/` |
| `src/features/report/*`, `src/features/alerts/*`, etc. | → | keep as-is in `features/` |
| Pure logic (trust score calc, severity calc, incident types) | → | `src/domain/` |
| `src/infrastructure/rtdb/` (from Plan 2) | → | stays |
| `src/infrastructure/firebase/repositories/` (from Plan 3) | → | stays |
| `src/shared/hooks/UserContext.tsx` | → | `src/shared/contexts/UserContext.tsx` |

---

## Task 1: Create `src/domain/` for pure logic

- [ ] **Step 1: Identify pure modules**
```bash
grep -rL "firebase/" src/shared/utils src/shared/data src/domains/*/utils 2>/dev/null
```

- [ ] **Step 2: Move incident types, severity calc, municipalities list**
```bash
mkdir -p src/domain/{models,services,constants}
git mv src/shared/data/municipalities.ts src/domain/constants/
git mv src/shared/data/incidentTypes.ts src/domain/constants/
# etc.
```

- [ ] **Step 3:** Run `npm run typecheck` — fix all import path errors using find/replace. Commit.

---

## Task 2: Consolidate `infrastructure/`

- [ ] **Step 1:** Move converters + repositories (from Plan 3) here if not already:
```bash
# Already at src/infrastructure/firebase/ from Plan 3
```
- [ ] **Step 2:** Move storage code:
```bash
git mv src/features/report/services/reportStorage.service.ts src/infrastructure/storage/MediaUploader.ts
```
- [ ] **Step 3:** Move messaging/FCM setup from wherever it lives → `src/infrastructure/messaging/`.
- [ ] **Step 4:** Move offline queue:
```bash
git mv src/features/report/services/reportQueue.service.ts src/infrastructure/offline/OfflineQueue.ts
```
- [ ] **Step 5:** Fix imports with a codemod (example):
```bash
# Use sed or VSCode global replace
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i \
  's|@/features/report/services/reportStorage.service|@/infrastructure/storage/MediaUploader|g'
```
- [ ] **Step 6:** `npm run typecheck && npm test -- --run`. Commit each move as a separate commit.

---

## Task 3: Consolidate `stores/`

- [ ] **Step 1:** Create `src/stores/` if missing. Move any Zustand stores scattered across `features/*/stores/` or `shared/hooks/` here.
- [ ] **Step 2:** Canonical stores per spec: `authStore`, `uiStore`, `mapStore`, `offlineStore`.
- [ ] **Step 3:** Update imports. Commit.

---

## Task 4: Collapse `domains/` into `features/` or delete

Per spec §4.1, `domains/` doesn't exist — role-specific code lives under `features/<role>/` or `app/routes/<role>/`.

- [ ] **Step 1:** For each `src/domains/<role>/`:
  - Components → `src/features/<role>/components/`
  - Hooks → `src/features/<role>/hooks/`
  - Route files → `src/app/routes/<role>/`
  - Service files → delete (replaced by repositories in Plan 3)
- [ ] **Step 2:** After each role: typecheck + tests. Commit.
- [ ] **Step 3:** Remove empty `src/domains/` directory.

---

## Task 5: Fix `app/` layer

- [ ] **Step 1:** `src/app/firebase/config.ts` — keep (already here).
- [ ] **Step 2:** Create `src/app/layouts/` if missing; move layout components.
- [ ] **Step 3:** Create `src/app/routes/{citizen,responder,admin,agency,superadmin}/` per spec §4.1.
- [ ] **Step 4:** Update `src/app/routes.tsx` → lazy-load per role:
```tsx
const CitizenRoutes = lazy(() => import('./routes/citizen'))
const AdminRoutes = lazy(() => import('./routes/admin'))
// verify each chunk stays under 300KB via `npm run build` + bundle analyzer
```
- [ ] **Step 5:** Commit.

---

## Task 6: Bundle size verification

- [ ] **Step 1:** Add `rollup-plugin-visualizer` to Vite config for `build --analyze`.
- [ ] **Step 2:** Run `npm run build`. Confirm per-role chunk budgets:
  - citizen ≤ 120KB gzipped
  - responder ≤ 100KB
  - admin ≤ 180KB
  - agency ≤ 140KB
  - superadmin ≤ 200KB
- [ ] **Step 3:** Add CI gate (already partial in Plan 7):
```yaml
- run: npm run build -- --report
- run: node scripts/check-bundle-sizes.js  # fail if over budget
```
- [ ] **Step 4:** Commit.

---

## Task 7: Final sweep

- [ ] **Step 1:** `npm run typecheck` clean.
- [ ] **Step 2:** `npm test -- --run` all green.
- [ ] **Step 3:** `npm run build` passes, chunks under budget.
- [ ] **Step 4:** Grep for dead paths: `grep -rn "@/domains\b" src/` → empty.
- [ ] **Step 5:** Update `CLAUDE.md` with new folder conventions.
- [ ] **Step 6:** Update `docs/progress.md` — migration complete.

```bash
git commit -m "chore: complete restructure to spec §4.1 layout"
```

---

## Self-Review

Every folder in spec §4.1 exists. No `domains/` remnant. Bundle budgets enforced. Pure import fixups, zero behavior change. Safe-net tests catch regressions.
