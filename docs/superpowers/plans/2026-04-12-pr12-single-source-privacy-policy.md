# PR #12 Single Source of Truth for Privacy Policy

**Branch:** `fix/pr12-registeredprofile-error-handling` (worktree)
**Goal:** Resolve duplicate privacy policy content between `public/privacy-policy.md` and `src/app/components/PrivacyPolicy.tsx`

**Issue:** Privacy policy content exists in two places:
1. `public/privacy-policy.md` - raw markdown
2. `src/app/components/PrivacyPolicy.tsx` - React component with same content hardcoded

This creates maintenance burden and sync issues.

---

## Decision: Keep React Component, Remove Markdown File

**Rationale:**
- `PrivacyPolicy.tsx` renders as a proper page with consistent styling
- React component allows dynamic content (env vars, i18n future-proofing)
- The markdown file was intended for static hosting but isn't actually used

---

## Task 1: Verify public/privacy-policy.md Exists

```bash
ls -la public/privacy-policy.md
```

If it exists, we'll remove it (it's not referenced in routes.tsx).

---

## Task 2: Verify PrivacyPolicy Route Points to Component

```bash
grep -n "PrivacyPolicy" src/app/routes.tsx
```

Expected: route uses `<PrivacyPolicy />` component, not markdown file.

---

## Task 3: Document Single Source of Truth Decision

No code changes needed. Just document that:
- `src/app/components/PrivacyPolicy.tsx` is the single source of truth
- `public/privacy-policy.md` (if exists) should be removed or gitignored

---

## Commit

```bash
# If public/privacy-policy.md exists:
git rm public/privacy-policy.md
git commit -m "chore(legal): remove duplicate privacy policy markdown

PrivacyPolicy.tsx React component is the single source of truth.
The markdown file was not referenced by any route.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"

# If public/privacy-policy.md doesn't exist:
# No commit needed, just note in learnings
```

---

## Alternative: If Markdown is Actually Used

If `public/privacy-policy.md` is loaded dynamically somewhere, we need to verify before deleting. Run:

```bash
grep -r "privacy-policy.md" src/
```

If found referenced, this plan changes - we'd need to either:
1. Generate markdown from the React component, OR
2. Load markdown dynamically into the component

For now, assume option 1 (component is source of truth, markdown deleted).
