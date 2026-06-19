# CPWA-03 — Home Header + Alerts Bell (U2)

**Priority:** P1

**Depends on:** cpwa-02 (the `HomeTab` shell + the relocated alert-badge hook must
exist first).

**Goal:** Fill the `HomeTab` header region (§6.3 top row): greeting + 📍location
chip + "Updated <time>" freshness + an alerts **bell with the unread badge**. The
bell is now the only entry to `/alerts` (the route survives; the nav tab is gone),
so its badge is load-bearing — it must show the real unread count cpwa-02 left a
hook for.

## Recon to re-verify before editing (verify, do not trust)

- `apps/citizen-pwa/src/components/HomeTab/index.tsx` — the cpwa-02 shell with the
  header skeleton slot this slice fills.
- Where the alert unread count currently comes from for the old Alerts-tab badge
  (cpwa-02 relocated the badge affordance to the Home bell but deferred wiring the
  count). Re-find the existing alerts/unread hook or store selector; **reuse it**,
  do not add a new listener.
- The existing location/municipality source the app already resolves (used by the
  Map / Nearby). Reuse it for the 📍 chip — do not add a second geolocation path.
- The existing freshness/`timeAgo` helper (DetailSheet's `updatedMeta`, or the
  shared one if it exists). Reuse for "Updated <time>".

## Files (≤3)

- `apps/citizen-pwa/src/components/HomeTab/index.tsx` (render the real header row)
- `apps/citizen-pwa/src/components/HomeTab/HomeHeader.tsx` (new — greeting,
  location chip, freshness, bell+badge; only if the header pushes the shell past
  ~40 added lines, otherwise inline it and keep to 2 files)
- `apps/citizen-pwa/src/components/HomeTab/HomeHeader.test.tsx` (new — red-first)

## Design constraints

- **Two signals on the bell badge** (§14.3): the unread count is a number, not a
  color-only dot. Consume the cpwa-01 `freshness`/status registry token for the
  badge color; never let color be the only signal. Reuse the existing
  `badge-shake` affordance so it matches the old behavior.
- Bell taps navigate to `/alerts`. **No dead end** — this is the sole survivor of
  the dropped nav tab; if the count source is unavailable, the bell still renders
  and still routes (badge simply hidden), it never disappears.
- Greeting copy is calm and time-of-day aware; **English only**, no hardcoded
  strings that would block the `3x-loc` i18n gate.
- Freshness uses Layer-A semantics (§5): "Updated 2 min ago" reflects the brief's
  data, not wall-clock. If unknown, render nothing rather than a fake time
  (truth-gate — same discipline as the rest of the track).
- Layout-stable (§14.4): header occupies the same box whether or not the badge /
  freshness is present.

## Red-first test

`HomeHeader.test.tsx` (fails before the header is wired):

- with N unread alerts, the bell shows the count `N` (text, not just a dot) and
  tapping it routes to `/alerts`;
- with 0 unread, no badge but the bell still renders and still routes;
- a known location renders the 📍 chip; unknown location renders the header
  without a fabricated place name.

## Out of scope

- The secondary module stack (cpwa-04) and the dynamic hero (cpwa-05).
- Any motion (cpwa-06) — static header here; the entrance animates it later.
- Changing `/alerts` itself or its data model.

## Verification

- `pnpm --dir apps/citizen-pwa exec vitest run src/components/HomeTab/HomeHeader.test.tsx`
- `pnpm --dir apps/citizen-pwa exec tsc --noEmit && pnpm --dir apps/citizen-pwa exec eslint src`
