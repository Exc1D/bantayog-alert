---
name: Bantayog Alert — Citizen PWA
description: Disaster reporting and coordination for citizens of Camarines Norte, Philippines
colors:
  authority-navy: '#001e40'
  alert-sienna: '#a73400'
  surface: '#f5f7fa'
  surface-alt: '#f2f4f6'
  card: '#ffffff'
  text-primary: '#1d1d1f'
  text-secondary: '#52606d'
  text-muted: '#7b8794'
  border: '#e5e7eb'
  status-success-bg: '#dcfce7'
  status-success-fg: '#16a34a'
  status-queued-bg: '#fef3c7'
  status-queued-fg: '#92400e'
  status-failed-bg: '#fee2e2'
  status-failed-fg: '#991b1b'
  status-amber-bg: '#b45309'
  surface-warn: '#fff5ef'
  border-warn: '#f5d4bb'
typography:
  display:
    fontFamily: "'Plus Jakarta Sans', -apple-system, sans-serif"
    fontSize: '1rem'
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: '0.08em'
  headline:
    fontFamily: 'Inter, -apple-system, sans-serif'
    fontSize: '1.25rem'
    fontWeight: 700
    lineHeight: 1.3
  title:
    fontFamily: 'Inter, -apple-system, sans-serif'
    fontSize: '1.125rem'
    fontWeight: 700
    lineHeight: 1.4
  body:
    fontFamily: 'Inter, -apple-system, sans-serif'
    fontSize: '1rem'
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: 'Inter, -apple-system, sans-serif'
    fontSize: '0.75rem'
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: '0.05em'
  caption:
    fontFamily: 'Inter, -apple-system, sans-serif'
    fontSize: '0.6875rem'
    fontWeight: 400
    lineHeight: 1.4
  mono:
    fontFamily: "'JetBrains Mono', 'SF Mono', monospace"
    fontSize: '1.125rem'
    fontWeight: 700
    lineHeight: 1.2
rounded:
  sm: '8px'
  md: '10px'
  lg: '12px'
  xl: '14px'
  full: '9999px'
spacing:
  xs: '4px'
  sm: '8px'
  md: '12px'
  lg: '16px'
  xl: '24px'
  2xl: '32px'
components:
  button-primary:
    backgroundColor: '{colors.authority-navy}'
    textColor: '#ffffff'
    rounded: '{rounded.lg}'
    padding: '12px 16px'
    typography: '0.875rem/600'
  button-primary-hover:
    backgroundColor: '#032038'
    textColor: '#ffffff'
    rounded: '{rounded.lg}'
    padding: '12px 16px'
    typography: '0.875rem/600'
  button-secondary:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.authority-navy}'
    rounded: '{rounded.lg}'
    padding: '12px 16px'
    typography: '0.875rem/600'
  button-amber:
    backgroundColor: '{colors.status-amber-bg}'
    textColor: '#ffffff'
    rounded: '{rounded.lg}'
    padding: '12px 16px'
    typography: '0.875rem/600'
  button-red:
    backgroundColor: '#b91c1c'
    textColor: '#ffffff'
    rounded: '{rounded.lg}'
    padding: '12px 16px'
    typography: '0.875rem/600'
  chip:
    backgroundColor: '{colors.surface-alt}'
    textColor: '#191c1e'
    rounded: '{rounded.full}'
    padding: '8px 12px'
    typography: '0.75rem/600'
  chip-selected:
    backgroundColor: '{colors.authority-navy}'
    textColor: '#ffffff'
    rounded: '{rounded.full}'
    padding: '8px 12px'
    typography: '0.75rem/600'
  card:
    backgroundColor: '{colors.card}'
    rounded: '{rounded.md}'
    padding: '14px'
---

# Design System: Bantayog Alert — Citizen PWA

## 1. Overview

**Creative North Star: "The Calm Sentinel"**

Bantayog Alert is used during disasters. A flood is rising. A landslide just happened. The person holding this app is scared, possibly moving, and needs to report quickly and feel heard. This design system is the visual language of a calm, trusted neighbor — one who doesn't panic, doesn't waste words, and doesn't decorate. The interface moves with purpose. Every color, every weight, every touch target exists to reduce friction between "I see an emergency" and "I've been heard."

The system's personality is "Caring, Assuring, Urgent" — three qualities that must coexist without canceling each other out. Caring shows up as spacious, legible layouts and warm supporting surfaces. Assuring shows up as unambiguous status communication and a steady, unhurried visual rhythm. Urgent shows up in the high-contrast primary action and the zero-decoration philosophy: nothing here competes with the task.

The aesthetic reference set is precise and intentional: Apple's whitespace economy, Grab's task-focused mobile efficiency, Google Maps' spatial clarity, and Facebook Feed's familiar browsing rhythm. The anti-reference is equally precise: shopping apps (Shopee, Lazada) — cluttered grids, promotional banners, badge inflation. Visual noise costs lives here.

**Key Characteristics:**

- Light-mode, high-contrast; designed for outdoor use in sunlight and rain
- Mobile-only form factor (max-width 28rem / 448px); no desktop adaptation required on core flows
- WCAG 2.1 AAA on report submission and alerts; AA minimum everywhere else
- Inter for all product copy; Plus Jakarta Sans reserved for the brand wordmark only
- Tonal surfaces over shadows; elevation is earned, not decorative
- Status semantics always use icon + label + color — never color alone

## 2. Colors: The Coastal Authority Palette

Two anchors, one status system, one neutral field. Nothing else.

### Primary

- **Authority Navy** (`#001e40`): The primary surface of trust. Used for all primary CTA backgrounds, the app header, active nav states, field focus indicators, and the focus ring. Everything that says "tap here to move forward" is Authority Navy.

### Secondary

- **Alert Sienna** (`#a73400`): The action color for urgent or destructive secondary actions. Used as the map marker for unresolved incidents, amber action buttons (secondary intensity), and warm-toned warning surfaces. Not used for decoration.

### Tertiary

- **Warm Cream Gradient** (`#fff5ef` → `#ffeee6`): Used exclusively on the tracking reference box inside the RevealSheet — the moment after submission when the citizen receives confirmation. The warmth signals "you are safe, you have been heard." Never used as a general surface.

### Neutral

- **Deep Charcoal** (`#1d1d1f`): Primary text. Near-black, never pure black.
- **Slate Secondary** (`#52606d`): Supporting text, card labels, secondary information rows.
- **Ash Muted** (`#7b8794`): Timestamps, metadata, placeholder copy, tertiary labels.
- **Cloud Surface** (`#f5f7fa`): App shell background. Has a faint navy tint — never pure white.
- **Stone Alt** (`#f2f4f6`): Secondary surfaces, inactive chips, field backgrounds, toggle backgrounds.
- **Porcelain Card** (`#ffffff`): Card surfaces only. Intentionally distinct from Cloud Surface to create visual separation without shadows.
- **Fog Border** (`#e5e7eb`): Dividers and inactive states. Never used as an accent.

### Status Semantics

Status colors are a closed set. They communicate incident state and submission state. Each has a background + foreground pair — both must be used together. Never use the foreground color on a white background alone (contrast fails at small sizes).

- **Resolved / Success:** Background `#dcfce7`, Foreground `#16a34a`
- **Queued / Pending:** Background `#fef3c7`, Foreground `#92400e`
- **Failed / Error:** Background `#fee2e2`, Foreground `#991b1b`
- **Active / Amber Alert:** Background `#b45309` (full saturation, white text only)

**The Two-Anchor Rule.** Authority Navy and Alert Sienna are the only chromatic colors allowed on interactive elements. Every other color on the palette is semantic (status) or neutral (surface). Do not introduce a third accent color.

**The Status Trio Rule.** Status colors are never used decoratively. If a surface uses a status background, it must carry a corresponding status label and icon. A green card with no status meaning is prohibited.

## 3. Typography

**Display Font:** Plus Jakarta Sans (fallback: -apple-system, sans-serif)
**Body Font:** Inter (fallback: -apple-system, system-ui, sans-serif)
**Tracking Reference Font:** JetBrains Mono (fallback: SF Mono, monospace)

**Character:** Plus Jakarta Sans carries the brand mark — it appears only in the app header wordmark at 800 weight with 0.08em tracking. Everywhere else, Inter handles the work. The pairing is clean and functional: Inter's neutrality lets urgency live in the content, not the letterforms. JetBrains Mono appears for one purpose — the human-readable tracking reference code — where its mechanical precision signals "this is your ID."

### Hierarchy

- **Display** (Plus Jakarta Sans, 800, 1rem, tracking 0.08em): Brand wordmark in the fixed header. Uppercased. Nowhere else.
- **Headline** (Inter, 700, 1.25rem, line-height 1.3): Step titles, screen headings, confirmation headlines. The largest Inter weight used.
- **Title** (Inter, 700, 1.125rem, line-height 1.4): Section sub-headers, reference codes (in Mono), drawer titles.
- **Body** (Inter, 400, 1rem, line-height 1.5): Main paragraph content. Capped at 100% viewport width on mobile — no explicit ch limit needed since the max-width container enforces it.
- **Label** (Inter, 700, 0.75rem, uppercase, tracking 0.05em): Card section headers, field labels, badge text. Always uppercase. Always the primary or muted color — never a status color.
- **Caption** (Inter, 400–500, 0.6875rem, line-height 1.4): Timestamps, metadata rows, secondary support text. The smallest size used in production. Do not go below 0.625rem.
- **Micro** (Inter, 700, 0.625rem, tracking 0.05em): Tab bar labels only. No other use.

**The Mono One-Purpose Rule.** JetBrains Mono is used for the tracking reference code in the RevealSheet. It must not appear in any other context. Monospace signals "this is a machine-generated identifier." Overuse breaks that signal.

## 4. Elevation

This system is tonal and flat-by-default. Surfaces are separated by background color, not by shadow depth. Shadows appear only when an element physically floats above the app content layer.

### Shadow Vocabulary

- **Hair Lift** (`box-shadow: 0 1px 3px rgba(0,0,0,0.10)`): Cards at rest. The minimum shadow — barely perceptible. Used to distinguish card surface from the Cloud Surface background. This is the single exception to the Flat-By-Default Rule.
- **Sheet Rise** (`box-shadow: 0 -10px 40px rgba(0,0,0,0.20)`): Bottom sheets (RevealSheet) floating over the app layer. The upward direction signals "this is above everything."
- **Focus Ring** (`box-shadow: 0 0 0 2px #fff, 0 0 0 4px #001e40`): Double-ring on all interactive elements at focus. White inner ring separates the ring from any background color. Authority Navy outer ring provides AAA contrast.
- **Frosted Nav** (`background: rgba(255,255,255,0.85); backdrop-filter: blur(24px)`): The bottom navigation bar. The only glassmorphic surface in the system, justified by its function: it must appear above the map layer without fully obscuring it. Do not use blur + transparency anywhere else.

**The Flat-By-Default Rule.** If an element is not physically floating above other content (drawer, sheet, toast), it has no shadow. Background color differentiation handles the rest. Shadows on static content cards, list items, or inputs are prohibited beyond the Hair Lift shadow on cards.

## 5. Components

### Buttons

Rounded edges (12px / `{rounded.lg}`), full-weight at 14px/600. Touch target minimum 44px height; 48px preferred in the report flow.

- **Primary** (Authority Navy `#001e40`, white text, 12px radius, 12px vertical × 16px horizontal padding): The single forward action on any screen. One primary button per screen — never two.
- **Primary Hover/Focus** (deepens to `#032038`): 150ms transition. No scale transform — scale transforms cause layout reflow on low-end devices.
- **Secondary** (Cloud Surface `#f5f7fa` background, Authority Navy text): Back actions, "cancel," non-critical paths.
- **Amber** (Alert Amber `#b45309`, white text): Caution-level confirmations — moderation actions, rate-limit warnings.
- **Red** (`#b91c1c`, white text): Destructive confirmations — cancel report, delete account. Never used as a primary CTA.
- **Disabled** (any variant at `opacity: 0.5`, `cursor: not-allowed`): Always via opacity, never by removing the button.

### Chips

Pill shape (9999px radius), 8px vertical × 12px horizontal padding, 12px/600 text.

- **Default**: Stone Alt background (`#f2f4f6`), Charcoal text.
- **Selected**: Authority Navy background, white text.
- **Use**: Incident type selector (report form), filter selectors (map, feed). Never used for navigation or structural tabs.

### Toggle Buttons

Equal-width siblings in a row, 8px radius, 10px vertical × 10px horizontal padding, 12px/600.

- **Default**: Stone Alt background, Charcoal text.
- **Selected**: Authority Navy background, white text.
- **Use**: Binary or small-set selection (Severity: High/Medium/Low, Time: Last 24h/7 days/30 days). Max 3-4 options. Beyond 4, use chips.

### Cards

10px radius (`{rounded.md}`), Porcelain Card background (`#ffffff`), 14px padding, Hair Lift shadow. Cards are content containers — they hold incident summaries, report status rows, and review confirmations. They are not used for navigation, for calls to action, or as list item wrappers around simple text.

Card anatomy: optional `card-header` (Label size, uppercase, muted, `text-transform: uppercase`) → content rows (body/label sizes) → optional action at bottom. No nested cards. No shadow-on-shadow.

### Inputs / Fields

Text inputs use a distinctive Material-inspired underline variant: Stone Alt background, no surrounding border, 2px Authority Navy border-bottom, 8px radius on the top two corners only. This conveys "editable" without the visual weight of a full-border field.

- **Default**: Stone Alt background (`#f2f4f6`), no border.
- **Focus**: Border-bottom color shifts to Authority Navy (`#001e40`). No glow, no shadow. The line shift is the only focus indicator (paired with the focus ring via `:focus-visible`).
- **Field labels**: Label-size (`0.75rem/700`), uppercase, 0.05em tracking, Authority Navy color. Required fields carry no asterisk — all fields without an "(optional)" marker are required.
- **Error**: Inline error text below the field at 12px/`#dc2626`. Never a banner for a single field error.

### Navigation

**Header** (64px, fixed top, Authority Navy background, white `BANTAYOG ALERT` wordmark at Plus Jakarta Sans 800 / 0.08em tracking): Always visible. No actions in the header — notifications and profile live in the bottom nav.

**Bottom Tab Bar** (88px including safe-area, frosted glass): Five equal-width tabs: Map, Feed, Report, Alerts, Profile. Icon (20px Lucide) + label (10px/Micro). Active state: Authority Navy icon + label. Inactive: `#43474f` Ash Muted. No border-top on the nav. The blur creates separation.

The Report tab (center, AlertTriangle icon) is visually equal to the others — the form itself is the prominent action, not an oversized FAB. Do not float a large button above the nav bar.

### Reveal Sheet (Signature Component)

The moment of confirmation after a report is submitted. A bottom sheet rising 24px/24px rounded at the top corners, white background, Sheet Rise shadow. Contains: drag handle → headline → tracking reference box (warm cream gradient, Authority Navy reference code in JetBrains Mono) → receiver status row → primary action.

The reference box is the emotional peak of the submission flow. It signals: "Your report exists. Here is proof." The warm cream gradient is reserved for this moment and nowhere else.

## 6. Do's and Don'ts

### Do:

- **Do** use a 2px double ring (`0 0 0 2px #fff, 0 0 0 4px #001e40`) as the universal focus indicator on all interactive elements.
- **Do** pair every status color with a matching icon and text label — never use color as the only status signal. Colorblind citizens must receive the same information.
- **Do** place one, and only one, primary button (Authority Navy) per screen. If two actions are equal-weight, use Secondary for the less destructive path.
- **Do** maintain 48px touch targets on all interactive elements within the report submission flow. Use 44px minimum everywhere else.
- **Do** use `backdrop-filter: blur(24px)` exclusively on the bottom navigation bar. This is the system's one glassmorphic surface.
- **Do** use tonal background differences (Cloud Surface vs Porcelain Card) to separate content layers. Shadows are for floating elements only.
- **Do** include a subtle Tagalog translation on all complex English sentences in legal disclosures, privacy notices, and error explanations. Inline, below the English line, at caption size and muted color.
- **Do** respect `prefers-reduced-motion` — all animations must have a no-motion alternative. Fade replaces slide; instant replaces eased.
- **Do** test every new screen at 110% system font scale on Chrome Android before shipping.

### Don't:

- **Don't** use shopping-app patterns: promotional banners, badge counts on tabs for non-critical information, competing CTAs, decorative hero sections. This app is used during emergencies. Visual noise costs lives.
- **Don't** add a third accent color. Authority Navy and Alert Sienna are the complete interactive palette. Resist adding teal, purple, or any additional brand hue — they have no semantic role here.
- **Don't** use `border-left` or `border-right` greater than 1px as a colored stripe on cards, list items, alerts, or callouts. Use a full border, a background tint, or a leading icon instead.
- **Don't** use gradient text (`background-clip: text` with a gradient background). Status information must be a solid color.
- **Don't** put two primary buttons on the same screen. If you find yourself reaching for two, one of the actions is not primary.
- **Don't** use JetBrains Mono outside the tracking reference context. It is reserved for machine-generated identifiers.
- **Don't** use Plus Jakarta Sans for anything other than the app wordmark. Inter handles all product copy.
- **Don't** add shadows to static cards, list items, or inputs. The Hair Lift shadow on `.card` is the ceiling. Inputs have no shadow at rest.
- **Don't** use the warm cream gradient surface (`#fff5ef` → `#ffeee6`) as a general card or section background. It belongs to the RevealSheet tracking reference box — its emotional weight depends on its rarity.
- **Don't** implement a dark mode. The scene for this app is: a citizen in daylight, rain, or bright sunlight, outdoors, on a low-end Android. Light mode with AAA contrast is the correct answer for that scene.
- **Don't** use cards for navigation. Cards are content containers. Navigation belongs in the bottom tab bar or in button elements.
- **Don't** use emojis, use lucide react icons instead.
