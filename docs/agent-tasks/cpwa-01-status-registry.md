# CPWA-01 — Shared Two-Signal Status Registry (U3)

**Priority:** P0 (foundation — every revamp surface renders status, and today
the maps are fragmented and one of them violates §14.3)

**Depends on:** none. This is the first slice; it has no UI dependency.

**Goal:** One module owns the mapping from each status axis to its presentation
triple `{ colorToken, icon/shape, textLabel }`, so the §14.3 two-signal contract
(color is never the only signal) is guaranteed in one place. The four scattered
maps converge on it over the following slices; this slice creates the registry,
proves it, and re-points `useSeverityStyle` as the first consumer.

## Recon to re-verify before editing

- `apps/citizen-pwa/src/utils/useSeverityStyle.ts` — severity-only map
  (`high`/`medium`/`low`) with `{ fg, bg, label, dotHex, icon }` on CSS vars.
- `apps/citizen-pwa/src/utils/incident-meta.ts` — `statusMeta(status)` returns
  `{ bg, color, label }` (**no icon**) and `severityDotColor(severity)` drives a
  **color-only** dot. `incidentLabel` lives here too.
- `apps/citizen-pwa/src/components/ReportStatusPill.tsx` — renders that
  color-only `severityDotColor` dot (the §14.3 violation this track fixes).
- The two other severity maps (`AlertsTab`, `FeedTab`/situation-updates) are
  **not** migrated here — they migrate when those surfaces are next touched
  (index execution rule 7). Confirm they still exist; do not edit them now.

## Files (≤3)

- `apps/citizen-pwa/src/utils/status-registry.ts` (new — the registry)
- `apps/citizen-pwa/src/utils/status-registry.test.ts` (new — red-first)
- `apps/citizen-pwa/src/utils/useSeverityStyle.ts` (re-point `getSeverityStyle`
  to delegate to the registry's severity axis; keep its exported type/signature
  byte-compatible so no caller changes)

## Design constraints

- Four **separate** axes (do not merge them — §5 keeps them orthogonal):
  - `severity`: high / medium / low (port the existing `useSeverityStyle` values
    and icons exactly — `AlertTriangle` / `Bell` / `Info`).
  - `operationalStage`: the §9.2 five groups (saved/sending · received ·
    being reviewed · response coordinated · addressed/closed) **plus** the
    terminal not-accepted variant. This is the Layer-C public projection, not the
    raw enum.
  - `hazardType`: the hazard categories already used by `AlertsTab` (re-confirm
    the set before encoding — do not invent categories).
  - `freshness`: Layer-A info-freshness (live / recent / stale) for the dot the
    Home header and cards show.
- Every entry returns **all three** of `{ colorToken, icon, label }`. Colors are
  CSS-variable tokens on the existing teal/severity system — **extend tokens,
  never replace `#0d7377`** (U6). Icons are `lucide-react` components (match the
  `ComponentType<{ size?: number; className?: string }>` shape already in
  `useSeverityStyle`). Shape/icon is the mandatory second signal so color is
  never load-bearing alone.
- Pure module: no React, no DOM, no I/O. Unknown inputs return a defined,
  non-throwing default (mirror `getSeverityStyle`'s `?? DEFAULT`).
- `exactOptionalPropertyTypes` / `noUncheckedIndexedAccess`: registry lookups are
  `T | undefined` — guard and fall back, never assert.

## Red-first test

`status-registry.test.ts` (fails before the module exists):

- every `operationalStage` value returns a non-empty `label` AND a defined
  `icon` (proves two signals — no color-only entry can exist);
- a known severity (`high`) returns the same label/icon the old map returned
  (port-fidelity);
- an unknown key returns the default without throwing.

## Out of scope

- Migrating `incident-meta.statusMeta`, `ReportStatusPill`'s dot, `AlertsTab`,
  or `FeedTab` (each migrates inside the slice that rebuilds that surface).
- Any visual/layout change. This slice changes no rendered output —
  `useSeverityStyle` delegates to identical values.

## Verification

- `pnpm --dir apps/citizen-pwa exec vitest run src/utils/status-registry.test.ts src/utils/useSeverityStyle.test.ts`
- `pnpm --dir apps/citizen-pwa exec tsc --noEmit && pnpm --dir apps/citizen-pwa exec eslint src`
