# CPWA-00 — Citizen PWA v2.0 Revamp Backlog (Index)

**Status:** Backlog index. Derived from the `/grill-me` interview against
`docs/bantayog-alert-citizen-pwa-spec.md` (v2.0). Every architecture (B-tree)
and UI/UX (U-tree) branch below was resolved with the product owner before this
backlog was written. Each `cpwa-NN` file is one executable slice for one agent
on one branch. Recon anchors were verified 2026-06-19; **every slice re-verifies
its own facts before editing.**

## Resolved design decisions (the contract this backlog implements)

These are settled. A slice that wants to deviate must stop and escalate, not
reinterpret.

### Information architecture / navigation (U1, U2)

- Bottom nav becomes **`Home · Map · Report · Feed · Profile`**. Report stays the
  elevated center `fab-breathe` FAB. **Alerts leaves the nav.**
- Alerts is reached via a **bell in the Home header**. The `/alerts` route
  survives; it is simply no longer a bottom-nav tab.
- Home is the new default (`/`); Map moves to `/map`; the Response Thread gets a
  dedicated `/track/:id`.

### Home — "Your Local Brief" (B2, B4, B6, U2, motion)

- **Split-brief: dynamic hero + stable secondary stack** (§6.3 order: hero →
  Your Report → Nearby → Today's Weather → Emergency contacts), with
  **independent per-module skeletons and per-module error annotation** (§14.4,
  §14.6) — a failed module annotates itself, never the whole page.
- Nearby uses **client-side distance bands** (B4). Weather uses the **hybrid
  weather source** (B6).
- **Motion — spec §14.2 ban lifted for Home only**, by explicit product-owner
  override ("the Home tab must be the most humane tab"):
  - **Entrance (M-A):** staggered spring reveal — skeletons hold layout →
    location chip confirms → headline rises+fades (~300 ms, emphasized
    `cubic-bezier(0.2, 0, 0, 1)`) → secondary cards stagger ~40–60 ms (spring
    stiffness ~260 / damping ~30) → freshness fades last.
  - **Idle (M-B):** restrained ambient (live freshness-dot pulse + existing
    `fab-breathe`) + spring microinteractions (press scale ~0.97, optional
    haptic; card expand/collapse springs; pull-to-refresh that "settles" the
    brief). **No looping backgrounds.**
  - **Emergency (M-C):** playful/ambient motion **stops** in P1/P2; the hero
    shows one restrained single-shot cue (not looping); secondary modules settle
    and recede.
  - **Emergency-hero ceiling:** an emergency always renders as the **dominant
    in-Home hero within Home's normal layout — never a full-screen takeover.**
    The secondary stack recedes but stays present and scrollable; Report + nav
    stay reachable (§14.4). The CitizenShell foreground-alert **modal** remains
    the separate interrupt-on-arrival channel.
  - **Reduced motion:** entrance degrades to opacity-only crossfade — no
    transform, no stagger, no pulse, content appears immediately. Never override
    `prefers-reduced-motion`.

### Status semantics (U3, §14.3) — applies to every surface

- **One shared status registry** maps each axis to
  `{ color token, icon/shape, text label }`, guaranteeing the two-signal
  contract (color is never the only signal) in one place. **The axes stay
  separate** (§5): severity · operational-stage (Layer C / the §9.2 five groups)
  · hazard-type · info-freshness (Layer A). Each surface renders its own layout
  from the registry. This consolidates the four scattered maps
  (`useSeverityStyle`, `incident-meta.statusMeta`, `AlertsTab`,
  `FeedTab`/`situation-updates`) and fixes the current color-only status dot in
  `ReportStatusPill`.

### Response Thread (U5, §9) — the primary tracking surface

- **Dedicated `/track/:id` route** (`hideBottomNav`), the single convergence
  point for Home "Your Report", Profile report list, `ReportStatusPill`, Map
  marker, and notification taps.
- Internal layout: **sticky §9.4 header → §9.2 five-stage stepper → §9.8 dated
  narrative**, single scroll. Stepper stages are tappable to progressively
  disclose the finer Layer-C states (verified / assigned / acknowledged /
  en route / on scene) **without fabricating progress** (§9.6).
- Map's `DetailSheet` is demoted to a **peek** that deep-links here.

### Map (U4, U6)

- Secondary **spatial situational-awareness** surface at `/map`: public incident
  pins + official alert / affected-area zones + own-report pins. Reuses the
  existing teal system (U6) extended with the U3 status tokens. The `DetailSheet`
  peek deep-links to `/track/:id` (own) or `/incidents/:id` (public, exists).

## Routing delta (target end state — all slices converge here)

| Route         | Now (verified)                                 | Target                                                 |
| ------------- | ---------------------------------------------- | ------------------------------------------------------ |
| `/` (index)   | `CitizenShell > MapTab`                        | `CitizenShell > HomeTab` (new)                         |
| `/map`        | —                                              | `CitizenShell > MapTab` (moved off index)              |
| `/track/:id`  | —                                              | `ResponseThread` (new, `hideBottomNav`)                |
| `/alerts`     | nav tab                                        | route kept, dropped from `TAB_PATHS`, opened via bell  |
| `DetailSheet` | tracking home (in MapTab)                      | peek → `/track/:id` (own) or `/incidents/:id` (public) |
| `TAB_PATHS`   | `['/','/feed','/report','/alerts','/profile']` | `['/','/map','/report','/feed','/profile']`            |

## Ranked phased slices

| Phase | Slice   | Concern                                                          | Priority | Depends on       | Status   |
| ----- | ------- | ---------------------------------------------------------------- | -------- | ---------------- | -------- |
| R0    | cpwa-01 | Shared two-signal status registry (U3)                           | P0       | —                | Doc only |
| R1    | cpwa-02 | IA / routing migration spine (Home·Map·Track·nav)                | P0       | —                | Doc only |
| R2    | cpwa-03 | Home header + alerts bell                                        | P1       | cpwa-02          | Doc only |
| R2    | cpwa-04 | Home secondary stack (Your Report / Nearby / Weather / Contacts) | P1       | cpwa-01, cpwa-02 | Doc only |
| R2    | cpwa-05 | Home dynamic hero (truth-gated, dominant-not-takeover)           | P1       | cpwa-01, cpwa-04 | Doc only |
| R2    | cpwa-06 | Home motion layer (M-A / M-B / M-C + reduced-motion)             | P2       | cpwa-03–05       | Doc only |
| R3    | cpwa-07 | Response Thread route `/track/:id` (§9.4/§9.2/§9.8)              | P0       | cpwa-01, cpwa-02 | Doc only |
| R3    | cpwa-08 | `DetailSheet` → peek + deep-link out                             | P1       | cpwa-02, cpwa-07 | Doc only |
| R4    | cpwa-09 | Map secondary surface (alert zones + entry points)               | P2       | cpwa-01, cpwa-02 | Doc only |

**Sequencing rationale.** R0/R1 are the foundations every surface depends on:
the status registry (cpwa-01) has no UI dependency and unblocks the two-signal
contract everywhere; the IA spine (cpwa-02) introduces the `/map`, `/track/:id`,
and `HomeTab` shell so the surfaces have somewhere to land. R2 fills Home content
on the spine, motion last (cpwa-06) so it decorates settled structure rather than
chasing a moving layout. R3 builds the primary tracking surface and demotes the
Map sheet. R4 finishes the Map's reduced role.

## Execution rules (binding for every slice)

1. One slice = one branch = one PR. Branch `feat/cpwa-NN-<slug>`. Never bundle
   slices or mix tracks.
2. Before editing: re-run the slice's recon. If a fact drifted (a file moved, a
   prop changed, a route already exists), **stop and report** instead of
   proceeding.
3. Red-first. Write one failing test, run it, see it fail with a meaningful
   error, then implement. New pure modules get their own focused tests that fail
   before the module exists.
4. **Frontend-only. Zero `firestore.rules` / `database.rules.json` /
   `firestore.indexes.json` / schema / migration edits in this entire track**
   (CLAUDE.md §8.4). If a slice appears to need one, that is an escalation, not a
   slice.
5. **Preserve the teal `#0d7377` brand system** (U6, product decision) — extend
   tokens, never replace them.
6. Worktree hygiene: `git branch -vv` + clean `git status` before edits; in a
   fresh worktree `pnpm install --frozen-lockfile`, and build any imported
   workspace `lib/` (e.g. `@bantayog/shared-validators`) before trusting tests.
7. Each surface slice that touches a status/severity display **consumes the
   cpwa-01 registry and deletes its local color map** as part of that slice —
   that is how the four scattered maps get retired without a big-bang migration.
8. Finish each slice by appending to `docs/progress.md` (and `docs/learnings.md`
   if a durable rule emerged), then two-stage review (spec compliance → code
   quality) before merge.

## Open seams / decision gates (resolve at execution, not now)

- **§6.14 "deliberate ending" copy** ("You're caught up through 7:12 AM") — a
  freshness/Layer-A wording choice settled inside cpwa-05, not a structural fork.
- **Weather source contract (B6 hybrid)** — cpwa-04 must re-confirm the exact
  endpoint/caching shape against whatever the B6 decision recorded before wiring;
  if no implementation exists yet, the Weather module ships as a truth-gated slot
  that renders nothing rather than a fabricated forecast.
- **Localization** — Filipino/Bikol copy is gated separately (`3x-loc`), blocked
  on pilot-LGU confirmation. All cpwa copy ships in English with the register the
  spec mandates; no hardcoded strings that would block later i18n.

## Explicitly rejected

- A full-screen emergency takeover on Home (the ceiling decision forbids it; the
  modal is the only full-bleed interrupt).
- Looping/animated hazard backgrounds or any motion that implies unconfirmed
  progress (spec §14.2 — the ban is lifted only for the calming/orienting motion
  classes above, not for these).
- Keeping tracking inside the Map sheet, or fragmenting it into Profile (U5a
  rejected both — one dedicated route).
- A second status component per surface (U3 rejected per-surface maps and a
  single rigid `<StatusIndicator>` everywhere; the registry + per-surface
  presentation is the contract).
