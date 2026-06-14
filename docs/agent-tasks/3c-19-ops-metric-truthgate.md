# 3C-19 — Ops-Metric Truth-Gate (FCM rate `0%`-on-load + silent poll error)

**Priority:** P1 (a load-time `0%` reads as "notifications are totally failing";
a swallowed poll error hides real degradation). Shared across two surfaces.

**Status:** Doc only (not implemented). Frontend-only; no backend, no rules, no
schema.

**Origin:** `docs/admin-control-contract.md` finding **N3**. The FCM-success-rate
metric on both the Dashboard status bar and the Dispatch monitor defaults a
missing value to `0` (`?? 0`), so on first paint — before `getOpsMetrics` has
returned — the operator sees **0% notification success**, which reads as a total
outage. `useOpsMetrics` also exposes an `error`, but neither surface renders it,
so a failing metrics poll is silent.

**Goal:** The FCM metric must distinguish "not measured yet / failed to measure"
from "measured and genuinely 0%." Show `—` / "measuring…" when there is no value,
and surface a poll error instead of swallowing it. Never display a fabricated
`0%`.

## Recon facts (verified 2026-06-14, re-verify before editing)

- `apps/admin-desktop/src/pages/DashboardPage.tsx`
  - `getStatusFcmSuccessRate(opsMetrics)` returns `opsMetrics?.fcmSuccessRate ?? 0`
    (`:208`–`:209`) and feeds the status bar (`:353`).
  - **Telling asymmetry:** `getModeFcmSuccessRate` defaults the _same_ missing
    value `?? 1.0` (`:204`–`:205`) so the calm/degraded **mode** does not falsely
    trip on load — but the **displayed number** defaults pessimistically to `0`.
    The display and the mode disagree about what "no data" means; the display is
    the wrong one.
  - The hook already yields a usable error/loading handle:
    `const { metrics: opsMetrics, loading: metricsLoading, error: metricsError }
= useOpsMetrics('24h')` (`:543`). `metricsError` is currently unused on the bar.
- `apps/admin-desktop/src/pages/DispatchMonitorPage.tsx`
  - `const fcmSuccessRate = opsMetrics?.fcmSuccessRate ?? 0` (`:184`), fed to the
    metric display at `:534`.
  - Here the hook is destructured as only `{ metrics: opsMetrics }` (`:155`) — the
    `error`/`loading` fields are discarded entirely.
- **Unverified — confirm first:** whether the Dashboard status bar and the Dispatch
  monitor render the FCM number through the **same** display component or two
  different ones. If shared, fix the null-rendering once there; if not, each
  surface needs the same `null → "—"` handling. Check the components consuming the
  `fcmSuccessRate` prop at `DashboardPage.tsx:353` and `DispatchMonitorPage.tsx:534`
  before deciding the file list.
- `learnings.md` (UX): _"Truth-gate derived live fields: make uncertain data
  optional and render a clear fallback."_ This is the canonical case.

## Approach (recommended: `null` means unknown, render a fallback)

- Change both surfaces to pass `opsMetrics?.fcmSuccessRate ?? null` (not `?? 0`).
  Widen the display component's `fcmSuccessRate` prop to `number | null`; render
  `—` (or "measuring…" while `loading`) for `null`, and the real percentage only
  when a value exists.
- Surface the poll error: when `metricsError` is set (Dashboard already has it;
  Dispatch monitor must start destructuring it), show a small non-alarmist
  indicator on the bar ("metrics unavailable") rather than leaving the operator
  with a silent stale/zero number. Reuse existing degraded/offline affordances if
  one fits; do not invent a modal.
- Leave `getModeFcmSuccessRate`'s `?? 1.0` **as-is** — defaulting the _mode_
  optimistically is correct (missing data should not trip "degraded"); only the
  _displayed value_ was lying. Document this asymmetry in the progress entry so a
  later reader does not "fix" the mode default and reintroduce false degraded.

## Files (≤3 + tests)

- The shared (or per-surface) FCM-metric display component(s) (modify) — accept `number | null`,
  render `—`/"measuring…" for `null`, show the error indicator.
- `apps/admin-desktop/src/pages/DashboardPage.tsx` (modify) — `?? null`; thread
  `metricsError` to the bar.
- `apps/admin-desktop/src/pages/DispatchMonitorPage.tsx` (modify) — `?? null`;
  destructure and thread `error` from `useOpsMetrics`.
- Tests below. **If the two surfaces use different display components, the file
  budget is exceeded — split into 3c-19a (Dashboard) / 3c-19b (Dispatch) rather
  than touching >3 source files in one slice.**

## Red-first tests

- With `opsMetrics === undefined` (pre-poll), the FCM display shows `—`/"measuring",
  **not** `0%`. Fails today (`?? 0` renders 0%).
- With `metricsError` set, the bar shows the error indicator. Fails today (silent).
- With a real `fcmSuccessRate` of `0`, it still shows `0%` (genuine zero must not
  be masked by the null path).
- `vi.mock('../app/firebase', () => ({ db: {} }))` per 3c-00 rule 6 on any
  firebase-touching test file.

## Out of scope

- Changing `getOpsMetrics`/`getOpsMetricsCore` or the backend metric. The
  avg-response / avg-accept numbers (real backend; their poll-error silence is the
  same root and may ride along _only_ if it stays within the file budget — else
  note as follow-up). The Dashboard coverage metric (that is 3c-16). Any
  rules/index/schema/deploy change.

## Verification

- `pnpm --dir apps/admin-desktop exec vitest run` (the touched display + page test files)
- `pnpm --dir apps/admin-desktop exec tsc --noEmit && pnpm --dir apps/admin-desktop exec eslint src`
