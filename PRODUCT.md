# Product

## Register

product

## Users

Citizens of Camarines Norte, Philippines. Reporting during active emergencies — flood water rising, a landslide just happened, they smell smoke. Time-pressured, scared, often in motion. Tech literacy ranges from first-time smartphone users to daily app users; the interface must work for both without condescending to either. Mobile-first: iOS Safari and Android Chrome on mid-range to low-end Android devices. Connectivity is unreliable during the exact moments the app matters most. Many will report without creating an account — pseudonymous use is supported and respected, not treated as a lesser experience.

## Product Purpose

Bantayog Alert gives citizens the fastest path from "I see an emergency" to "I've reported it and I'm being heard." Secondary jobs: stay spatially aware of what's happening nearby, browse the public incident feed, receive official government alerts, and track the status of their own reports. Success looks like a report submitted under 60 seconds, a citizen who feels their report mattered, and a community better coordinated during a crisis.

## Brand Personality

Caring, Assuring, Urgent.

The app speaks the way a calm, trusted neighbor would during a crisis — it does not panic, it does not waste words, it does not decorate. It moves with purpose. Every interaction should leave the user feeling: "I was heard, I am safe, I know what happens next."

## References

- **Apple.com** — for cleanliness: generous whitespace, precise typography, nothing that doesn't earn its place on the screen.
- **Grab mobile** — for efficiency: task-focused flows, obvious primary actions, no detours between intent and completion.
- **Facebook feed** — for the Feed tab only: familiar infinite scroll, card rhythm, recognizable interaction patterns citizens already know.
- **Google Maps** — for the Map tab: spatial clarity, intuitive pin interactions, minimal chrome around the map surface itself.

## Anti-references

Shopping apps (Shopee, Lazada aesthetic): cluttered grids, promotional banners, badge inflation, competing CTAs, anything that optimizes for attention over task completion. This app is used during emergencies. Visual noise costs lives.

## Design Principles

1. **Clarity under pressure.** Every screen must work at a glance for someone who is scared, moving, and has 4% battery. If a screen requires reading to understand, it has failed.
2. **Speed is care.** The fastest path to a submitted report is the most caring UX. Fewer taps, fewer decisions, fewer chances to abandon. Urgency and care are the same thing here.
3. **Trust through calm.** The UI must never feel chaotic, even when reporting chaos. Calm visual weight, unambiguous status, no jank. A panicked user needs an unshakeable interface.
4. **Familiar over clever.** When a pattern is already trusted (Maps-style pins, Feed-style cards, Apple-style form fields), use it. Novel UX patterns are a liability in a crisis.
5. **Inclusive by default.** WCAG 2.1 AAA on report submission and alerts. Colorblind-safe status indicators. Legible at arm's length in rain. Subtle Tagalog translations on any sentence that could confuse a first-time user.

## Accessibility & Inclusion

- **WCAG 2.1 AAA** on critical paths: report submission flow, alerts tab, and any error or status message.
- **WCAG 2.1 AA** minimum on all other surfaces.
- Colorblind-safe status palette (never rely on red/green alone — pair with icons and labels).
- Touch targets minimum 44×44px; prefer 48px on interactive elements in the report flow.
- Reduced-motion: all animations must respect `prefers-reduced-motion`.
- Tagalog subtitles or inline translations on complex English sentences (legal disclosures, privacy notices, error explanations). Inline, subtle — not a separate language toggle.
- Tested on low-end Android (Chrome) at 110% system font scale.
