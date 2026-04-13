# PR #12 Extract Privacy Email to Environment Variable

**Branch:** `fix/pr12-registeredprofile-error-handling` (worktree)
**Goal:** Replace hardcoded `privacy@bantayogalert.gov.ph` with environment variable `VITE_PRIVACY_EMAIL`

**Issue:** `PRIVACY_EMAIL = 'privacy@bantayogalert.gov.ph'` is hardcoded in `PrivacyPolicy.tsx`. This should be configurable via environment variable for different deployments.

---

## Task 1: Add Environment Variable

**Files:**
- Modify: `.env.example`
- Modify: `.env.local` (or create if not exists)

**Steps:**

1. Add to `.env.example`:
```bash
# Privacy
VITE_PRIVACY_EMAIL=privacy@bantayogalert.gov.ph
```

2. Verify `.env.local` exists (gitignored) with actual value:
```bash
VITE_PRIVACY_EMAIL=privacy@bantayogalert.gov.ph
```

---

## Task 2: Update PrivacyPolicy.tsx to Use Environment Variable

**Files:**
- Modify: `src/app/components/PrivacyPolicy.tsx` (from `feature/legal-compliance-dpa` branch)

**Fix:**
```typescript
// FROM:
const PRIVACY_EMAIL = 'privacy@bantayogalert.gov.ph'

// TO:
const PRIVACY_EMAIL = import.meta.env.VITE_PRIVACY_EMAIL || 'privacy@bantayogalert.gov.ph'
```

**Note:** Using `import.meta.env` (Vite pattern) with fallback to default value for local development without the env var set.

---

## Task 3: Verify TypeScript Accepts the Change

**Run:**
```bash
npm run typecheck -- src/app/components/PrivacyPolicy.tsx
```

---

## Commit

```bash
git add .env.example src/app/components/PrivacyPolicy.tsx
git commit -m "chore(legal): extract privacy email to VITE_PRIVACY_EMAIL env var

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```
