# DESIGN-AUDIT.md — Current Implementation State

**Generated:** 2026-05-05  
**Purpose:** Document gap between DESIGN.md specification and actual implementation  
**Status:** CRITICAL - Multiple design system violations found

---

## Executive Summary

The DESIGN.md specification defines a light-mode, token-driven design system. The actual implementation has drifted with 26+ hard-coded colors, a dark mode screen (TrackingScreen), and inconsistent token usage. This document captures the current state to inform remediation.

---

## 1. Current Implementation Palette

### What's Actually Used (by frequency)

**Backgrounds:**

- `bg-white` (50×) - Card backgrounds (matches spec)
- `bg-surface-100` (30×) - Main app backgrounds (matches spec)
- `bg-brand-500` (11×) - Primary CTAs (matches spec)
- `bg-surface-900` (6×) - **VIOLATION** - Dark mode usage in TrackingScreen
- `bg-[#0F172A]` - **VIOLATION** - Dark gradient background in TrackingScreen
- `bg-[#f0f4f4]` (hard-coded) - **VIOLATION** - Should be `bg-surface-100`
- `bg-[#d5dedd]` (hard-coded) - **VIOLATION** - Skeleton color, should be token
- `bg-gradient-to-br` (4×) - Used in ProfileTab, RevealSheet

**Text Colors:**

- `text-white` (53×) - **VIOLATION** - Dark mode text in TrackingScreen (spec says light mode only)
- `text-surface-*` (108×) - Token usage (matches spec, good)
- `text-brand-500` (16×) - Primary links/CTAs (matches spec)
- `text-[#768081]` (hard-coded) - **VIOLATION** - Should be `text-surface-500`
- `text-[#25292a]` (hard-coded) - **VIOLATION** - Should be `text-surface-900`

**Severity Colors (INCONSISTENT):**

- `bg-red-100 text-red-800` - FeedTab severity badge (not in DESIGN.md palette)
- `border-l-[#dc2626]` - AlertsTab critical severity (side-stripe violation)
- `border-l-[#d97706]` - AlertsTab high/medium severity (side-stripe violation)
- `border-l-[#2563eb]` - **VIOLATION** - Random blue not in palette ("info = blue" anti-pattern)

**Borders:**

- `border-surface` (39×) - Token usage (good)
- `border-white` (4×) - **VIOLATION** - Dark mode borders in TrackingScreen
- `border-l-[#...]` (3×) - **VIOLATION** - Side-stripe borders (anti-pattern)

---

## 2. Typography Actual Usage

**Sizes by Frequency:**

- `text-sm` (85×) - Secondary text
- `text-xs` (64×) - Labels, metadata
- `text-white` (53×) - **NEW** - Dark mode text
- `text-base` (9×) - Body text
- `text-lg` (13×) - Headers

**Hierarchy Assessment:** Mostly follows DESIGN.md spec, but arbitrary sizes appear in places.

---

## 3. Spacing & Rounded

**Spacing (most common):**

- `px-4` (52×) - 16px horizontal padding
- `p-2` (44×) - 8px all-around padding
- `p-3` (33×) - 12px all-around padding
- `py-3` (26×) - 12px vertical padding
- `p-4` (20×) - 16px all-around padding

**Border Radius:**

- `rounded-full` (68×) - Pills, circles (matches spec)
- `rounded-xl` (51×) - 12px cards (matches spec's `rounded.lg`)
- `rounded-lg` (16×) - 8px
- `rounded-2xl` (5×) - 16px
- `rounded-md` (1×) - **UNDERUSED** - Spec prefers this but `rounded-xl` dominates

---

## 4. Component Patterns

### Buttons (actual usage)

- Primary: `bg-brand-500 text-white rounded-lg px-4 py-3` (matches spec)
- Secondary: `bg-surface-100 text-surface-700` - **VIOLATION** - Should use token
- Ghost: `bg-white/10 text-white` - **NEW** - Dark mode variant (not in spec)

### Cards (actual usage)

- Background: `bg-white` (50×) - Matches spec
- Shadow: `shadow-[0_1px_2px_rgba(0,0,0,0.05)]` - "Hair Lift" shadow (matches spec)
- Radius: `rounded-xl` (12px) - Slightly larger than spec's 10px

### Navigation

- Bottom nav: `bg-surface-50/90 backdrop-blur-md` - **VIOLATION** - Only nav should have blur per spec, but now 9 components use it
- Active state: `bg-brand-600` - Matches spec

---

## 5. CRITICAL VIOLATIONS

### Violation 1: Dark Mode in TrackingScreen (P0)

**Location:** `apps/citizen-pwa/src/components/TrackingScreen.tsx`  
**What:** Dark gradient background + white text throughout  
**Spec Says:** "Don't implement a dark mode. The scene for this app is: a citizen in daylight, rain, or bright sunlight, outdoors, on a low-end Android. Light mode with AAA contrast is the correct answer."  
**Impact:** Inconsistent UX - users navigate from light (Map, Feed) to dark (Tracking) to light (Profile).  
**Evidence:**

- 1× `bg-[#0F172A]/80` (dark header)
- 5× `style={{ background: 'radial-gradient(circle at center, #0F172A 0%, #0F9488 100%)' }}` (dark gradient background)
- 14× `text-white` (white text for dark mode)
- 1× `border-white/10` (dark mode border)

### Violation 2: Hard-Coded Colors Everywhere (P0)

**Count:** 26+ instances of `bg-[#...]` and `text-[#...]`  
**Examples:**

- `bg-[#f0f4f4]` - Should be `bg-surface-100`
- `text-[#768081]` - Should be `text-surface-500`
- `bg-[#d5dedd]` - Should be `bg-surface-200`
- `text-[#25292a]` - Should be `text-surface-900`
- `border-[#f0f4f4]` - Should be `border-surface-200`

**Impact:** Design tokens ignored, making theming impossible and creating inconsistency.

### Violation 3: Glassmorphism Overuse (P0)

**Count:** 9 instances of `backdrop-blur`  
**Spec Says:** "use backdrop-filter: blur(24px) exclusively on the bottom navigation bar. This is the system's one glassmorphic surface."  
**Found In:**

- CitizenShell nav (ONLY correct usage per spec)
- TrackingScreen header (NEW violation)
- FeedTab header
- AlertsTab header
- AlertDetailSheet overlay
- RevealSheet overlay
- DeleteAccountFlow overlay
- ReportStatusPill
- SubmitReportForm headers/footers

**Impact:** Visual inconsistency + performance issues on low-end Android devices.

### Violation 4: Side-Stripe Border Anti-Pattern (P0)

**Count:** 6 instances in AlertsTab  
**What:** `border-l-[#dc2626]`, `border-l-[#d97706]`, etc.  
**Spec Says:** "Don't use border-left or border-right greater than 1px as a colored stripe on cards, list items, alerts, or callouts."  
**Impact:** Lazy design that fails colorblind users (WCAG AAA violation).

### Violation 5: Severity Color Inconsistency (P0)

**Problem:** Severity colors recalculated in every component  
**FeedTab:** `bg-red-100 text-red-800` for high  
**AlertsTab:** `border-l-[#dc2626]` for critical  
**DESIGN.md:** `severity-high-fg: #991b1b`, `severity-high-bg: #fee2e2`  
**Impact:** Same semantic meaning has different visual treatments across screens.

---

## 6. Missing Implementation

### Alt Text (P0)

**Found:** 0 alt attributes on images  
**Required:** All non-decorative images must have alt text (WCAG 2.1 Level A)  
**Impact:** Screen reader users cannot understand image content.

### Focus Styles (P1)

**Good:** CitizenShell has excellent focus styles (skip link, ring on nav)  
**Problem:** Many inline buttons in cards/sheets lack visible focus indicators  
**Impact:** Keyboard navigation gaps.

---

## 7. What's Working Well

✅ **Semantic HTML:** Good use of `<button>`, `<main>`, `<nav>`  
✅ **Reduced Motion:** All animations use `motion-safe:` prefix (WCAG 2.1 AAA)  
✅ **Icon System:** Consistent Lucide React usage, no emojis  
✅ **Touch Targets:** Most meet/exceed 44px minimum  
✅ **Mobile-First:** All screens designed for 448px max-width  
✅ **ARIA:** Proper `aria-live`, `aria-atomic`, `role="status"` usage  
✅ **Tokens Where Used:** `border-surface-*`, `text-surface-*` applied correctly  
✅ **Offline Resilience:** Excellent offline banner with proper announcements

---

## 8. Remediation Priority

### Phase 1: P0 Blocking (Fix Immediately)

1. **Revert TrackingScreen to light mode** or update DESIGN.md to permit dark mode app-wide
2. **Extract all hard-coded colors to tokens** - Create centralized color mapping
3. **Remove all backdrop-blur except nav** - Performance + design consistency
4. **Redesign severity indicators** - Remove side-stripe borders, use proper affordances
5. **Add alt text to all images** - WCAG compliance

### Phase 2: P1 Major (Fix Before Release)

1. **Fix 15 undersized touch targets** (36px → 44px)
2. **Enforce typography scale** - Remove arbitrary text sizes
3. **Add focus styles** to all interactive elements
4. **Standardize severity colors** across all components

### Phase 3: P2 Minor (Fix in Next Pass)

1. **Convert 106 inline styles to classes/tokens**
2. **Standardize card shadows**
3. **Extract timeAgo to shared utility**

---

## 9. Token Migration Guide

### Replace Hard-Coded Colors

| Hard-Coded                | Should Use                       |
| ------------------------- | -------------------------------- |
| `bg-[#f0f4f4]`            | `bg-surface-100`                 |
| `bg-[#f8fafa]`            | `bg-surface-50`                  |
| `bg-[#d5dedd]`            | `bg-surface-200`                 |
| `text-[#768081]`          | `text-surface-500`               |
| `text-[#25292a]`          | `text-surface-900`               |
| `text-[#7b8794]`          | `text-surface-600`               |
| `border-[#f0f4f4]`        | `border-surface-200`             |
| `border-[#d5dedd]`        | `border-surface-200`             |
| `border-[#e0e3e5]`        | `border-surface-300`             |
| `bg-red-100 text-red-800` | Use status tokens from DESIGN.md |

### Severity Color Standardization

Create shared utility:

```typescript
// utils/severityStyles.ts
export const severityStyles = {
  critical: { bg: 'bg-danger-100', text: 'text-danger-800', border: 'border-danger-600' },
  high: { bg: 'bg-danger-100', text: 'text-danger-800', border: 'border-danger-600' },
  medium: { bg: 'bg-warning-100', text: 'text-warning-800', border: 'border-warning-700' },
  low: { bg: 'bg-surface-200', text: 'text-surface-700', border: 'border-surface-400' },
}
```

---

## 10. Next Steps

This document identifies the gaps. To fix:

1. **Run `$impeccable audit apps/citizen-pwa/src/components/TrackingScreen.tsx`** - Audit the dark mode changes
2. **Run `$impeccable colorize`** - Create centralized color token mapping
3. **Run `$impeccable optimize`** - Remove backdrop-blur overuse
4. **Run `$impeccable layout`** - Fix side-stripe borders
5. **Run `$impeccable harden`** - Add alt text and fix focus styles

After all fixes, re-run audit to verify score improves from 13/20 → 18+/20.
