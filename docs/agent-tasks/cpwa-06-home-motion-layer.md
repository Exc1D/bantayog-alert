# CPWA-06 — Home Motion Layer (M-A / M-B / M-C + reduced-motion)

**Priority:** P2 (decoration on settled structure — must land after the Home
content is correct, not before)

**Depends on:** cpwa-03, cpwa-04, cpwa-05 (motion decorates a settled layout; if
it chases a moving structure it gets rebuilt).

**Goal:** Apply the three motion classes the product owner authorized when they
lifted spec §14.2's blanket ban **for the Home tab only** ("the Home tab must be
the most humane tab"). Entrance reveal, restrained idle, and an emergency state
that _calms_ — all degrading cleanly under `prefers-reduced-motion`.

## Recon to re-verify before editing

- `framer-motion` is already a dependency and `AnimatePresence` + `PAGE_VARIANTS`
  are already used in `CitizenShell`. **Reuse it — add no animation library.**
- The app already ships `prefers-reduced-motion` CSS and a `fab-breathe`
  animation. Re-find both; the reduced-motion path must defer to the existing CSS
  contract, and idle motion reuses `fab-breathe` rather than inventing a loop.
- cpwa-05 hero states (calm/incident/alert) — M-C keys off the alert state.

## Motion contract (settled in the index; encode, do not redesign)

- **M-A entrance (one-shot):** skeletons hold layout → location chip confirms →
  headline rises+fades (~300 ms, emphasized `cubic-bezier(0.2, 0, 0, 1)`) →
  secondary cards stagger ~40–60 ms (spring stiffness ~260 / damping ~30) →
  freshness fades last. Runs once per Home mount, not on every re-render.
- **M-B idle (ambient, restrained):** live freshness-dot pulse + existing
  `fab-breathe`; spring microinteractions — press scale ~0.97 (optional haptic),
  card expand/collapse springs, pull-to-refresh that "settles" the brief.
  **No looping backgrounds.**
- **M-C emergency:** when cpwa-05 is in alert state, playful/ambient motion
  **stops**; the hero shows **one restrained single-shot cue** (not looping);
  secondary modules settle and recede. Motion must never imply unconfirmed
  progress (§14.2 — that ban is _not_ lifted).

## Design constraints

- **Reduced motion is mandatory and non-negotiable** (CLAUDE.md a11y): with
  `prefers-reduced-motion: reduce`, entrance degrades to opacity-only crossfade —
  no transform, no stagger, no pulse — and content appears immediately. Never
  override the media query.
- Motion is **additive only**: removing every animation must leave a fully
  correct, usable Home (it already is correct after cpwa-03..05). No layout or
  data depends on an animation firing.
- Layout stability (§14.4): animations move opacity/transform, never reserved
  box size — no reflow during reveal.
- Scope strictly to `HomeTab`. Do not touch `PAGE_VARIANTS` or other tabs; §14.2
  still bans motion everywhere else.

## Red-first test

New `HomeTab/motion.test.tsx`:

- under `matchMedia('(prefers-reduced-motion: reduce)')` = true, the hero/cards
  render immediately with no transform/stagger (assert the reduced-motion branch
  via the same pattern existing reduced-motion tests use);
- entrance variant runs once on mount (assert it is not re-triggered on a state
  update that is not a remount).

## Out of scope

- Any new Home content (cpwa-03..05 own it).
- Motion on Map/Feed/Profile/Alerts — still banned by §14.2.
- Haptics beyond the optional press cue if the platform API isn't already wired
  (don't add a native bridge for this).

## Verification

- `pnpm --dir apps/citizen-pwa exec vitest run src/components/HomeTab/motion.test.tsx`
- `pnpm --dir apps/citizen-pwa exec tsc --noEmit && pnpm --dir apps/citizen-pwa exec eslint src`
