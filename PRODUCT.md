---
register: product
---

# Bantayog Alert — Admin Desktop

## Users

Provincial DRRMO staff in Camarines Norte command centers. 12-hour shifts, wall-mounted 6-10ft displays, dim ambient lighting. Multiple staff glance simultaneously; the display is the room's "truth source."

## Product Purpose

At-a-glance situational awareness for disaster response. In 3 seconds, anyone walking in should know: crisis or calm, which municipalities are affected, where responders are, if the system is live.

## Tone

Authoritative, alive, commanding. NASA mission control meets typhoon tracker. Zero-fluff, utility-first. Every pixel earns its place.

## Anti-References

- No decorative glassmorphism or blur effects
- No gradient text or decorative backgrounds
- No side-stripe colored borders as primary signals
- No identical card grids with icon+heading+text repetition
- No modals as first-choice interaction pattern
- No em dashes in copy

## Strategic Principles

1. **Luminance-first depth** — Surface stratification through lightness, not hue
2. **Double-encoded signals** — Color + Shape + Text for every status indicator
3. **Adaptive density** — Card mode ≤10 items, compact row mode >10 items
4. **Data freshness heartbeat** — Desaturation at 60s staleness, visual degradation
5. **Observation/Action bipartite split** — Map stage left, workflow panels right
6. **Keyboard-first triage** — High-volume report processing via arrow keys + shortcuts
7. **Deliberate high-stakes actions** — Emergency declaration requires TOTP + double-confirm

## Color Strategy

Committed: dark theme with semantic signals carrying 30-60% of visual weight. HSU token palette: `--hsu-crit: #ef4444`, `--hsu-warn: #f59e0b`, `--hsu-norm: #10b981`, `--hsu-info: #3b82f6`. Neutrals tinted toward brand hue (chroma 0.005-0.01).

## Typography

Bifurcated: Inter for human-readable content (1.5 line-height, 65-75ch max), JetBrains Mono for telemetry/tabular data. Scale: 52px page headings, 64px hero data values, 18px body.

## Motion

≤200ms transitions, deceleration easing only. Gentle pulse for fresh data pins (2s cycle), drop-in spring for new incidents. No bounce, no elastic. Respect `prefers-reduced-motion`.
