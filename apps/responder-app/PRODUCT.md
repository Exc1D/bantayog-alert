---
register: product
---

# Bantayog Alert — Responder PWA

## Users

Municipal and agency responders in Camarines Norte. Field deployment: smartphones (Android/iOS), outdoor lighting conditions (glare, rain, night), one-handed operation while wearing gear. Single user, high-stress, time-critical.

## Product Purpose

Dispatch acceptance, navigation, and on-scene reporting. In 3 seconds: know if you're dispatched, where to go, what severity. Zero ambiguity, glove-friendly taps, works offline.

## Tone

Urgent, clear, action-oriented. Emergency radio meets field manual. Every screen has one primary action.

## Anti-References

- No light theme pages (glare reduction, battery life)
- No emoji as icons (accessibility, professionalism)
- No decorative animations (distraction during emergencies)
- No modals blocking emergency actions
- No gradient text or decorative backgrounds
- No side-stripe colored borders as primary signals

## Strategic Principles

1. **Thumb-zone priority** — Primary actions within 44px thumb target, bottom-half screen
2. **Offline-first resilience** — Queue actions, sync when connected, clear offline indicators
3. **Battery-conscious design** — Dark theme default, minimal GPS polling when stationary
4. **Glove-friendly touch targets** — 44px minimum, high contrast, clear affordances
5. **Single-task focus** — One dispatch, one action, one screen at a time
6. **Status clarity** — Color + text + icon for every state (pending, active, resolved)
7. **Location-first navigation** — Map always one tap away, recenter button visible

## Color Strategy

Restrained: dark theme with single amber accent (#a73400) for primary actions. Semantic signals: red urgency (#991b1b), green success (#22c55e), blue info (#3b82f6). Neutrals aligned with admin-desktop for cross-product consistency.

## Typography

Inter only. Scale: 20px page titles, 16px body, 14px secondary. 700 weight for status/labels, 400 for body. Minimum 16px for all inputs (iOS zoom prevention).

## Motion

≤200ms transitions, ease-out only. No bounce, no elastic. Respect `prefers-reduced-motion`. Hold-to-confirm for SOS (3s) prevents accidental triggers.

## Physical Scene

Responder on motorcycle at night, rain, one hand on phone, wearing gloves. Screen must be readable under streetlights, taps must work through glove material, battery must last 12-hour shift.
