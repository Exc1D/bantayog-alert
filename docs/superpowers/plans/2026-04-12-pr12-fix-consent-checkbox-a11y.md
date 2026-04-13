# PR #12 Fix Consent Checkbox Accessibility (Label-Input Association)

**Branch:** `fix/pr12-registeredprofile-error-handling` (worktree)
**Goal:** Fix missing `id` and `htmlFor` attributes on consent checkbox in ReportForm

**Issue:** The consent checkbox input at line 622-642 has:
- No `id` attribute on the `<input>` element
- No `htmlFor` attribute on the `<label>` element
- This breaks keyboard navigation and screen reader association

**Reference:** React `useId` hook for generating unique IDs (researched via context7)

---

## Task 1: Add useId Hook to Generate Unique ID

**Files:**
- Modify: `src/features/report/components/ReportForm.tsx` (from `feature/legal-compliance-dpa` branch)

**Research via context7:**
```typescript
import { useId } from 'react';
const id = useId();
return (
  <label htmlFor={id}>
    <input id={id} />
  </label>
);
```

**Fix:**
```typescript
// Add to imports at top of component (around line 4-10):
import { useState, useRef, useId } from 'react'

// Inside component function, after existing hooks:
const privacyConsentId = useId()

// Update the checkbox input:
<input
  type="checkbox"
  id={privacyConsentId}  // ADD THIS
  name="privacyConsent"
  className="mt-1 w-4 h-4 text-primary-blue border-gray-300 rounded focus:ring-primary-blue"
  checked={privacyConsent}
  onChange={(e) => {
    setPrivacyConsent(e.target.checked)
    if (e.target.checked) setPrivacyConsentError(null)
  }}
/>

// Update the label:
<label htmlFor={privacyConsentId} className="flex items-start gap-3 cursor-pointer">
```

---

## Task 2: Verify No Other Changes Needed

Check that the error message (line 643-646) doesn't need changes - it uses `role="alert"` not `htmlFor`, so it's fine.

---

## Task 3: Run Tests

```bash
npm run test -- ReportForm.test.tsx
```

---

## Commit

```bash
git add src/features/report/components/ReportForm.tsx
git commit -m "fix(a11y): add id and htmlFor to privacy consent checkbox

- Use React useId hook for unique ID generation
- Associate label with input for keyboard/screen reader accessibility

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```
