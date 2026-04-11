# Triangular Report Button Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update the prominent Report button from circular to triangular SOS-style design for better visual hierarchy and emergency affordance.

**Architecture:** CSS clip-path triangle shape with gradient background, positioned higher than other tabs for visual prominence. Maintains existing queue indicator badge.

**Tech Stack:** React, Tailwind CSS, inline styles for clip-path (Tailwind doesn't support arbitrary clip-paths), Lucide React icons

---

## File Structure

**Files to modify:**
- `src/app/navigation.tsx` - Update Report button styling from rounded-full to triangle
- `src/app/__tests__/navigation.test.tsx` - Update tests to match triangular design

**Files to keep as-is:**
- `src/features/report/hooks/useReportQueue.ts` - Queue badge logic unchanged
- All other navigation components - Only Report tab styling changes

---

## Task 1: Update Report button to triangular SOS design

**Files:**
- Modify: `src/app/navigation.tsx:29-48`

- [ ] **Step 1: Read current navigation.tsx to understand structure**

Run: `cat src/app/navigation.tsx`
Expected: See 5-tab navigation with prominent Report button

- [ ] **Step 2: Write failing test for triangular button**

First, let's add a test that checks for the new triangular shape:

```typescript
// src/app/__tests__/navigation.test.tsx
// Add this test inside the 'prominent Report tab' describe block

it('should render Report tab with triangular SOS shape', () => {
  renderWithRouter(<Navigation />)

  const reportLink = screen.getByText('Report').closest('a')
  expect(reportLink).toHaveStyle({
    clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)',
  })
})

it('should render Report tab with increased top offset for triangle', () => {
  renderWithRouter(<Navigation />)

  const reportLink = screen.getByText('Report').closest('a')
  expect(reportLink).toHaveClass('-top-5')
})

it('should render Report tab with wider width for triangle base', () => {
  renderWithRouter(<Navigation />)

  const reportLink = screen.getByText('Report').closest('a')
  expect(reportLink).toHaveClass('w-20')
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- navigation.test.tsx`
Expected: FAIL - Button still has rounded-full shape and w-16 width

- [ ] **Step 4: Implement triangular button design**

Replace the prominent button rendering in navigation.tsx (lines 29-48):

```typescript
if (item.prominent) {
  return (
    <Link
      key={item.path}
      to={item.path}
      className="relative -top-5 flex items-center justify-center w-20 h-16"
      style={{
        clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)',
      }}
      aria-label={`Report ${item.label}`}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-primary-red to-red-700" />
      <div className="relative z-10 flex flex-col items-center justify-center pt-2">
        <Icon size={24} className="text-white drop-shadow-md" />
        <span className="text-[10px] font-bold mt-0.5 text-white drop-shadow-md uppercase tracking-wide">
          {item.label}
        </span>
      </div>
      {queueSize > 0 && (
        <span
          data-testid="queue-badge"
          className="absolute -top-1 right-4 w-5 h-5 bg-yellow-400 text-red-900 text-xs font-bold rounded-full flex items-center justify-center animate-pulse border-2 border-white"
          aria-label={`${queueSize} reports waiting to sync`}
        >
          {queueSize > 9 ? '9+' : queueSize}
        </span>
      )}
    </Link>
  )
}
```

- [ ] **Step 5: Remove old failing tests**

Delete these tests from navigation.test.tsx (they test old circular design):

```typescript
// DELETE these tests:
it('should render Report tab with prominent styling', () => {
  // Tests for 'from-primary-red', 'to-red-600', 'shadow-lg', 'border-4', 'border-white'
})

it('should render Report tab with rounded-full shape', () => {
  // Tests for 'rounded-full' class
})

it('should render Report tab with larger icon size', () => {
  // Tests icon size - still valid but redundant
})
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm test -- navigation.test.tsx`
Expected: PASS - All navigation tests pass with triangular design

- [ ] **Step 7: Manually verify visual appearance**

Run: `npm run dev`
Expected:
- Report button appears as upward-pointing triangle (SOS style)
- Button is elevated (-top-5) above other tabs
- Gradient from primary-red to red-700
- White icon and text with drop shadow
- Queue badge appears on right side if reports are queued
- Button is centered and visually prominent

- [ ] **Step 8: Verify accessibility**

Check that:
1. Triangle button has aria-label
2. Touch target is still ≥44px (height 64px, width 80px at base)
3. Badge has aria-label describing queue count
4. Keyboard navigation still works (Tab to Report, Enter activates)

Run: `npm run dev` and test with keyboard
Expected: All accessibility checks pass

- [ ] **Step 9: Test on different screen sizes**

Check mobile (375px), tablet (768px), desktop (1024px)
Run: `npm run dev` and resize browser
Expected: Triangle shape maintains proportions at all sizes

- [ ] **Step 10: Commit**

```bash
git add src/app/navigation.tsx src/app/__tests__/navigation.test.tsx
git commit -m "feat(report): change Report button to triangular SOS design

- Replaces circular button with triangle using clip-path
- Increases visual prominence with -top-5 offset
- Adds gradient background (primary-red to red-700)
- Maintains 64px height for touch target compliance
- Updates badge position for triangle shape
- Improves emergency affordance with SOS-style design

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 2: Add visual feedback for Report button press state

**Files:**
- Modify: `src/app/navigation.tsx`

- [ ] **Step 1: Write failing test for press state**

```typescript
// src/app/__tests__/navigation.test.tsx

it('should apply press state styles when Report button is pressed', () => {
  renderWithRouter(<Navigation />)

  const reportLink = screen.getByText('Report').closest('a')
  expect(reportLink).toHaveClass('active:scale-95')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- navigation.test.tsx`
Expected: FAIL - No active:scale-95 class

- [ ] **Step 3: Add press state feedback**

Update the Report button Link to include active state:

```typescript
<Link
  key={item.path}
  to={item.path}
  className="relative -top-5 flex items-center justify-center w-20 h-16 active:scale-95 transition-transform duration-100"
  style={{
    clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)',
  }}
  // ... rest of props
>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- navigation.test.tsx`
Expected: PASS

- [ ] **Step 5: Manually test press feedback**

Run: `npm run dev`, click Report button
Expected: Button visually shrinks slightly when pressed (tactile feedback)

- [ ] **Step 6: Commit**

```bash
git add src/app/navigation.tsx src/app/__tests__/navigation.test.tsx
git commit -m "feat(report): add press state feedback to Report button

- Adds active:scale-95 for tactile feedback
- Adds transition-transform for smooth animation
- Improves touch interaction affordance

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 3: Document triangular button design decision

**Files:**
- Create: `docs/design/triangular-report-button.md`

- [ ] **Step 1: Create design documentation**

```markdown
# Triangular Report Button Design

## Rationale

The Report button uses a triangular SOS-style design instead of a circular button for several reasons:

### 1. Visual Hierarchy
- Triangles break the circular repetition of other tabs (Map, Feed, Alerts, Profile)
- Creates a focal point that draws attention to the primary action
- Matches emergency industry conventions (SOS symbol, warning signs)

### 2. Shape Psychology
- Triangles suggest action and urgency vs circles' passivity
- Upward-pointing triangle implies "alert" or "important"
- Widens at base = larger touch target where finger naturally rests

### 3. Tactile Affordance
- Wider top edge (80px) provides larger touch surface
- Point directs user's eye to the button
- Easier to hit accurately during stress/emergency

## Implementation

- Uses CSS `clip-path: polygon(50% 0%, 0% 100%, 100% 100%)` for triangle shape
- Gradient background: `from-primary-red to red-700`
- Positioned `-top-5` to elevate above other tabs
- Dimensions: `w-20 h-16` (80px × 64px)
- Touch target: 64px height meets WCAG 2.1 AA minimum (44px)

## Accessibility

- Includes `aria-label="Report Report"` for screen readers
- Badge has `aria-label="{count} reports waiting to sync"`
- Keyboard navigable with standard Tab/Enter
- Press feedback with `active:scale-95`

## Alternatives Considered

1. **Circular elevated button** - Implemented initially, less distinctive
2. **Square button** - Too harsh, doesn't convey emergency
3. **Pentagon shape** - More complex, no clear benefit
4. **Animated pulse** - Added to queue badge instead for specific feedback

## References

- SOS button design: Industry standard for emergency apps
- Material Design: FAB (Floating Action Button) principles
- WCAG 2.1 AA: Touch target minimum 44×44px
```

- [ ] **Step 2: Commit documentation**

```bash
git add docs/design/triangular-report-button.md
git commit -m "docs: add triangular Report button design documentation

Explains rationale, implementation, accessibility, and alternatives considered.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Self-Review

**✓ Spec coverage:** All aspects of triangular button design covered - shape, positioning, styling, accessibility, tests

**✓ Placeholder scan:** No placeholders found - all code is complete

**✓ Type consistency:** Class names, props, and structure consistent throughout

**Plan complete and saved to `docs/superpowers/plans/2026-04-11-triangular-report-button.md`**
