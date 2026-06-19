# CPWA-04 — Home Secondary Stack (Your Report / Nearby / Weather / Contacts) (B4, B6, U2)

**Priority:** P1

**Depends on:** cpwa-01 (status registry, for Your Report + Nearby status
display), cpwa-02 (the `HomeTab` shell with the module slots).

**Goal:** Fill the stable secondary stack below the hero in §6.3 order —
**Your Report → Nearby → Today's Weather → Emergency contacts** — each module an
independent unit with **its own skeleton, its own error annotation, and its own
empty state** (§14.6, §14.4). A failed module annotates itself; it never blanks
the page or the other modules.

## Recon to re-verify before editing

- `apps/citizen-pwa/src/components/HomeTab/index.tsx` — cpwa-02 module slots.
- **Your Report:** the existing own-report source the app already reads
  (`useMyActiveReports` / the My Reports list in `ProfileTab`). Reuse it; the
  Home card is a compact projection that deep-links to `/track/:id` (cpwa-07).
  Until cpwa-07 lands, link to the current own-report surface and leave a
  one-line `// cpwa: repoint to /track/:id once cpwa-07 lands` marker.
- **Nearby (B4):** the existing public-incident source
  (`usePublicIncidents` + `public-incident-mapping.filterPublicIncidentsByMunicipality`).
  B4 = **client-side distance bands** — compute bands from the already-resolved
  user location + incident coords on the client; **no new query, no backend
  distance field.**
- **Weather (B6):** re-confirm what the B6 "hybrid weather source" decision
  actually recorded. **If no implementation exists, ship a truth-gated slot that
  renders nothing (or a quiet "Weather unavailable") rather than a fabricated
  forecast.** Do not invent an API client in this slice — wiring a real endpoint
  is its own follow-up if B6 has no backing service yet.
- **Emergency contacts:** the existing per-municipality hotline source
  (`useMunicipalityContact`, shipped in 3c-07). Reuse it; do not duplicate the
  fallback logic.

## Files (≤3)

This is four modules; **≤3 files is not realistic for all of them at once.** Per
the index, split the stack across sibling slices if needed — but the lazy path is
one `HomeTab/modules/` folder added incrementally. Recommended first cut (one PR):

- `apps/citizen-pwa/src/components/HomeTab/modules/YourReportCard.tsx` +
  `NearbyCard.tsx` (new — the two status-bearing modules that consume cpwa-01)
- `apps/citizen-pwa/src/components/HomeTab/index.tsx` (mount them in their slots)
- `apps/citizen-pwa/src/components/HomeTab/modules/secondary-stack.test.tsx` (new)

Weather + Emergency contacts land in a thin follow-up PR (same slice number, a
`cpwa-04b` continuation) so each PR stays ≤3 files and red-first. **Do not bundle
all four into one oversized PR.**

## Design constraints

- **Per-module independence (§14.6/§14.4):** each module owns
  `{ loading | empty | error | ready }`. Module error renders an inline annotation
  ("Couldn't load nearby incidents — Retry") scoped to that card; siblings keep
  rendering. No shared `if (error) return null` across the stack.
- **Two-signal status (§14.3):** Your Report stage and Nearby severity both render
  via the cpwa-01 registry (icon + label + token), never a bare color.
- **Truth-gate everything derived (§5):** no fabricated distances, no fabricated
  weather, no fabricated freshness. Unknown → quiet fallback, not a guess.
- **Reuse, don't re-fetch:** every module rides an existing hook/source. Adding a
  new Firestore listener for Home would duplicate live subscriptions — reuse the
  ones already mounted.
- **Preserve teal tokens** (U6); extend with cpwa-01 status tokens only.
- Layout-stable: skeletons occupy the final box size so swapping in data does not
  reflow the stack (§14.4).

## Red-first test

`secondary-stack.test.tsx` (fails before the modules exist):

- Your Report card renders the §9.2 stage via the registry (icon **and** label)
  and links to the tracking surface;
- Nearby computes client-side distance bands from a fixed user location + fixed
  incident coords (assert band assignment, the B4 contract);
- a module whose source errors renders its **own** inline error + Retry while a
  sibling module still renders its data (proves §14.6 isolation).

## Out of scope

- The dynamic hero (cpwa-05) and header (cpwa-03).
- Motion / stagger (cpwa-06).
- A real Weather API client if B6 has no backing service — slot renders nothing
  until that decision is resolved (open seam in the index).
- The `/track/:id` destination itself (cpwa-07); link to the current surface with
  the marked TODO until then.

## Verification

- `pnpm --dir apps/citizen-pwa exec vitest run src/components/HomeTab/modules/secondary-stack.test.tsx`
- `pnpm --dir apps/citizen-pwa exec tsc --noEmit && pnpm --dir apps/citizen-pwa exec eslint src`
